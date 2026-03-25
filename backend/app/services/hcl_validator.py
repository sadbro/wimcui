import json
import os
import subprocess
import tempfile
import re


# Use env var if set (Docker pre-warms to /app/.terraform_cache), else temp dir
PLUGIN_CACHE = os.environ.get("TF_PLUGIN_CACHE_DIR", os.path.join(tempfile.gettempdir(), "wimcui_tf_plugin_cache"))
os.makedirs(PLUGIN_CACHE, exist_ok=True)

TIMEOUT_INIT = 120   # seconds — first init downloads ~400MB provider
TIMEOUT_VALIDATE = 30


def _extract_resource_name(detail):
    """Try to pull a terraform resource name from a diagnostic message."""
    # Matches patterns like: aws_instance.web_server, aws_vpc.my_vpc
    match = re.search(r'(\w+\.\w+)', detail or "")
    return match.group(1) if match else None


def _map_to_node_id(resource_addr, reverse):
    """Map a terraform resource address to a canvas node ID."""
    if not resource_addr or not reverse:
        return None

    # Handle snippet context format: 'resource "aws_instance" "web_server"'
    quoted = re.findall(r'"([^"]+)"', resource_addr)
    if len(quoted) >= 2:
        tf_name = quoted[1]  # second quoted string is the resource name
        return reverse.get(tf_name)

    # Handle dotted format: "aws_instance.web_server"
    parts = resource_addr.split(".")
    if len(parts) >= 2:
        tf_name = parts[1]
        return reverse.get(tf_name)

    return None


def validate_hcl(hcl, reverse=None):
    """
    Write HCL to a temp dir, run terraform init + validate, return structured result.

    Returns:
        {
            "valid": bool,
            "diagnostics": [
                {
                    "severity": "error" | "warning",
                    "summary": str,
                    "detail": str,
                    "resource": str | None,     # e.g. "aws_instance.web_server"
                    "nodeId": str | None,        # canvas node ID from reverse map
                }
            ],
            "raw_stdout": str,   # raw terraform validate output for debugging
        }
    """
    reverse = reverse or {}

    with tempfile.TemporaryDirectory(prefix="wimcui_tf_") as tmpdir:
        # Write the HCL file
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
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Terraform init timed out",
                    "detail": f"Init exceeded {TIMEOUT_INIT}s — possible network issue downloading the AWS provider.",
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": "",
            }
        except FileNotFoundError:
            return {
                "valid": False,
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Terraform not found",
                    "detail": "terraform binary is not installed or not on PATH.",
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": "",
            }

        if init_result.returncode != 0:
            return {
                "valid": False,
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
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Terraform validate timed out",
                    "detail": f"Validate exceeded {TIMEOUT_VALIDATE}s.",
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": "",
            }

        # Parse the JSON output
        try:
            tf_output = json.loads(val_result.stdout)
        except json.JSONDecodeError:
            return {
                "valid": False,
                "diagnostics": [{
                    "severity": "error",
                    "summary": "Failed to parse terraform output",
                    "detail": val_result.stdout.strip(),
                    "resource": None,
                    "nodeId": None,
                }],
                "raw_stdout": val_result.stdout,
            }

        # Map terraform diagnostics to our format
        diagnostics = []
        for diag in tf_output.get("diagnostics", []):
            summary = diag.get("summary", "")
            detail = diag.get("detail", "")
            severity = diag.get("severity", "error")

            # Try to extract resource address from the diagnostic's snippet
            resource_addr = None
            snippet = diag.get("snippet", {})
            if snippet:
                # snippet.context often has the resource address
                resource_addr = snippet.get("context")

            # Fallback: try to extract from subject or detail text
            if not resource_addr:
                subject = diag.get("range", {})
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
            "diagnostics": diagnostics,
            "raw_stdout": val_result.stdout,
        }
