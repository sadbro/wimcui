from flask import Blueprint, request, jsonify
from app.services.hcl_validator import validate_hcl, get_validation_mode

bp = Blueprint("hcl", __name__, url_prefix="/api")


@bp.get("/validation-mode")
def validation_mode():
    mode = get_validation_mode()
    return jsonify({
        "mode": mode,
        "description": {
            "terraform": "Full provider-level validation via terraform binary",
            "hcl2": "Syntax-only validation via python-hcl2 (terraform not available)",
            "none": "No validation engine available",
        }.get(mode, "Unknown"),
    })


@bp.post("/validate-hcl")
def validate():
    body = request.get_json()
    if not body or "hcl" not in body:
        return jsonify({"error": "Missing 'hcl' field in request body"}), 400

    hcl = body["hcl"]
    reverse = body.get("reverse", {})

    result = validate_hcl(hcl, reverse)
    return jsonify(result)
