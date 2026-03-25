import json
import os
import shutil
import subprocess
import tempfile
import re


# Use env var if set (Docker sets TF_PLUGIN_CACHE_DIR=/app/.terraform_cache), else temp dir
PLUGIN_CACHE = os.environ.get("TF_PLUGIN_CACHE_DIR", os.path.join(tempfile.gettempdir(), "wimcui_tf_plugin_cache"))
os.makedirs(PLUGIN_CACHE, exist_ok=True)

TIMEOUT_INIT_EXPLICIT = 120   # seconds — when user explicitly picks terraform
TIMEOUT_INIT_AUTO = 30        # seconds — in auto mode, fail fast and fallback
TIMEOUT_VALIDATE = 30

# Auto-detect terraform availability at import time
TF_AVAILABLE = shutil.which("terraform") is not None

# Try importing python-hcl2 as fallback
try:
    import hcl2 as _hcl2
    import io as _io
    HCL2_AVAILABLE = True
except ImportError:
    HCL2_AVAILABLE = False


def get_validation_mode():
    """Return which validation engine is available."""
    if TF_AVAILABLE:
        return "terraform"
    if HCL2_AVAILABLE:
        return "hcl2"
    return "none"


def _extract_resource_name(detail):
    """Try to pull a terraform resource name from a diagnostic message."""
    match = re.search(r'(\w+\.\w+)', detail or "")
    return match.group(1) if match else None


def _map_to_node_id(resource_addr, reverse):
    """Map a terraform resource address to a canvas node ID."""
    if not resource_addr or not reverse:
        return None

    # Handle snippet context format: 'resource "aws_instance" "web_server"'
    quoted = re.findall(r'"([^"]+)"', resource_addr)
    if len(quoted) >= 2:
        tf_name = quoted[1]
        return reverse.get(tf_name)

    # Handle dotted format: "aws_instance.web_server"
    parts = resource_addr.split(".")
    if len(parts) >= 2:
        tf_name = parts[1]
        return reverse.get(tf_name)

    return None


def _validate_with_terraform(hcl, reverse, init_timeout):
    """Full terraform init + validate. Returns (result_dict, timed_out_bool)."""
    with tempfile.TemporaryDirectory(prefix="wimcui_tf_") as tmpdir:
        tf_path = os.path.join(tmpdir, "main.tf")
        with open(tf_path, "w") as f:
            f.write(hcl)

        env = os.environ.copy()
        env["TF_PLUGIN_CACHE_DIR"] = PLUGIN_CACHE

        # --- terraform init ---
        try:
            init_result = subprocess.run(
                ["terraform", "init", "-backend=false", "-no-color"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=init_timeout,
                env=env,
            )
        except subprocess.TimeoutExpired:
            return None, True  # signal timeout to caller
        except FileNotFoundError:
            return {
                "valid": False,
                "mode": "terraform",
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Terraform not found",
                    "detail": "terraform binary is not installed or not on PATH.",
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": "",
            }, False

        if init_result.returncode != 0:
            return {
                "valid": False,
                "mode": "terraform",
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Terraform init failed",
                    "detail": init_result.stderr.strip() or init_result.stdout.strip(),
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": init_result.stdout,
            }, False

        # --- terraform validate -json ---
        try:
            val_result = subprocess.run(
                ["terraform", "validate", "-json", "-no-color"],
                cwd=tmpdir,
                capture_output=True,
                text=True,
                timeout=TIMEOUT_VALIDATE,
                env=env,
            )
        except subprocess.TimeoutExpired:
            return {
                "valid": False,
                "mode": "terraform",
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Terraform validate timed out",
                    "detail": f"Validate exceeded {TIMEOUT_VALIDATE}s.",
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": "",
            }, False

        # Parse JSON output
        try:
            tf_output = json.loads(val_result.stdout)
        except json.JSONDecodeError:
            return {
                "valid": False,
                "mode": "terraform",
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Failed to parse terraform output",
                    "detail": val_result.stdout.strip(),
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": val_result.stdout,
            }, False

        diagnostics = []
        for diag in tf_output.get("diagnostics", []):
            summary = diag.get("summary", "")
            detail = diag.get("detail", "")
            severity = diag.get("severity", "error")

            resource_addr = None
            snippet = diag.get("snippet", {})
            if snippet:
                resource_addr = snippet.get("context")

            if not resource_addr:
                resource_addr = _extract_resource_name(detail) or _extract_resource_name(summary)

            node_id = _map_to_node_id(resource_addr, reverse)

            diagnostics.append({
                "severity": severity,
                "summary": summary,
                "detail": detail,
                "resource": resource_addr,
                "nodeId": node_id,
            })

        return {
            "valid": tf_output.get("valid", False),
            "mode": "terraform",
            "diagnostics": diagnostics,
            "raw_stdout": val_result.stdout,
        }, False


def _validate_with_hcl2(hcl, reverse):
    """Fallback: python-hcl2 syntax-only validation."""
    try:
        _hcl2.load(_io.StringIO(hcl))
        return {
            "valid": True,
            "mode": "hcl2",
            "diagnostics": [],
            "raw_stdout": "",
        }
    except Exception as e:
        detail = str(e)

        resource_addr = _extract_resource_name(detail)
        node_id = _map_to_node_id(resource_addr, reverse) if resource_addr else None

        return {
            "valid": False,
            "mode": "hcl2",
            "diagnostics": [{
                "severity": "error",
                "summary": "HCL syntax error",
                "detail": detail,
                "resource": resource_addr,
                "nodeId": node_id,
            }],
            "raw_stdout": "",
        }


def validate_hcl(hcl, reverse=None, mode="auto"):
    """
    Validate HCL using the specified engine.

    mode:
      "auto"      — try terraform (30s timeout), fallback to hcl2 on timeout
      "terraform" — terraform only (120s timeout), no fallback
      "hcl2"      — python-hcl2 only

    Returns:
        {
            "valid": bool,
            "mode": "terraform" | "hcl2" | "none",
            "diagnostics": [...],
            "raw_stdout": str,
            "fallback": bool,        # true if auto mode fell back to hcl2
        }
    """
    reverse = reverse or {}

    # --- Explicit hcl2 mode ---
    if mode == "hcl2":
        if HCL2_AVAILABLE:
            result = _validate_with_hcl2(hcl, reverse)
            result["fallback"] = False
            return result
        return {
            "valid": False,
            "mode": "none",
            "diagnostics": [{
                "severity": "error",
                "summary": "python-hcl2 not installed",
                "detail": "The hcl2 validation engine was requested but python-hcl2 is not installed.",
                "resource": None,
                "nodeId": None,
            }],
            "raw_stdout": "",
            "fallback": False,
        }

    # --- Explicit terraform mode ---
    if mode == "terraform":
        if TF_AVAILABLE:
            result, timed_out = _validate_with_terraform(hcl, reverse, TIMEOUT_INIT_EXPLICIT)
            if timed_out:
                return {
                    "valid": False,
                    "mode": "terraform",
                    "diagnostics": [{
                        "severity": "error",
                        "summary": "Terraform init timed out",
                        "detail": f"Init exceeded {TIMEOUT_INIT_EXPLICIT}s — possible network or resource issue downloading the AWS provider.",
                        "resource": None,
                        "nodeId": None,
                    }],
                    "raw_stdout": "",
                    "fallback": False,
                }
            result["fallback"] = False
            return result
        return {
            "valid": False,
            "mode": "none",
            "diagnostics": [{
                "severity": "error",
                "summary": "Terraform not available",
                "detail": "The terraform validation engine was requested but terraform binary is not on PATH.",
                "resource": None,
                "nodeId": None,
            }],
            "raw_stdout": "",
            "fallback": False,
        }

    # --- Auto mode: try terraform with short timeout, fallback to hcl2 ---
    if TF_AVAILABLE:
        result, timed_out = _validate_with_terraform(hcl, reverse, TIMEOUT_INIT_AUTO)
        if not timed_out:
            result["fallback"] = False
            return result

        # Terraform timed out — fallback to hcl2
        if HCL2_AVAILABLE:
            result = _validate_with_hcl2(hcl, reverse)
            result["fallback"] = True
            result["diagnostics"].insert(0, {
                "severity": "warning",
                "summary": "Fell back to syntax-only validation",
                "detail": f"terraform init timed out after {TIMEOUT_INIT_AUTO}s. Validated with python-hcl2 (syntax only — attribute-level errors are not checked).",
                "resource": None,
                "nodeId": None,
            })
            return result

        # Terraform timed out and no hcl2 fallback
        return {
            "valid": False,
            "mode": "none",
            "diagnostics": [{
                "severity": "error",
                "summary": "Terraform init timed out, no fallback available",
                "detail": f"terraform init exceeded {TIMEOUT_INIT_AUTO}s and python-hcl2 is not installed.",
                "resource": None,
                "nodeId": None,
            }],
            "raw_stdout": "",
            "fallback": False,
        }

    # No terraform — try hcl2
    if HCL2_AVAILABLE:
        result = _validate_with_hcl2(hcl, reverse)
        result["fallback"] = False
        return result

    return {
        "valid": False,
        "mode": "none",
        "diagnostics": [{
            "severity": "error",
            "summary": "No validation engine available",
            "detail": "Neither terraform binary nor python-hcl2 package is installed.",
            "resource": None,
            "nodeId": None,
        }],
        "raw_stdout": "",
        "fallback": False,
    }
