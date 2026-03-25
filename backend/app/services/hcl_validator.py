import json
import os
import shutil
import subprocess
import tempfile
import re


# Use env var if set (Docker pre-warms to /app/.terraform_cache), else temp dir
PLUGIN_CACHE = os.environ.get("TF_PLUGIN_CACHE_DIR", os.path.join(tempfile.gettempdir(), "wimcui_tf_plugin_cache"))
os.makedirs(PLUGIN_CACHE, exist_ok=True)

TIMEOUT_INIT = 120   # seconds — first init downloads ~400MB provider
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


def _validate_with_terraform(hcl, reverse):
    """Full terraform init + validate."""
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
                timeout=TIMEOUT_INIT,
                env=env,
            )
        except subprocess.TimeoutExpired:
            return {
                "valid": False,
                "mode": "terraform",
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Terraform init timed out",
                    "detail": f"Init exceeded {TIMEOUT_INIT}s — possible network issue downloading the AWS provider.",
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": "",
            }

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
            }

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
            }

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
            }

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
        }


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

        # Try to extract resource context from the error
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


def validate_hcl(hcl, reverse=None):
    """
    Validate HCL using the best available engine.
    - terraform binary available → full provider-level validation
    - python-hcl2 available → syntax-only validation
    - neither → error

    Returns:
        {
            "valid": bool,
            "mode": "terraform" | "hcl2" | "none",
            "diagnostics": [...],
            "raw_stdout": str,
        }
    """
    reverse = reverse or {}

    if TF_AVAILABLE:
        return _validate_with_terraform(hcl, reverse)

    if HCL2_AVAILABLE:
        return _validate_with_hcl2(hcl, reverse)

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
    }
