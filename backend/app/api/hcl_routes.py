from flask import Blueprint, request, jsonify
from app.services.hcl_validator import validate_hcl

bp = Blueprint("hcl", __name__, url_prefix="/api")


@bp.post("/validate-hcl")
def validate():
    body = request.get_json()
    if not body or "hcl" not in body:
        return jsonify({"error": "Missing 'hcl' field in request body"}), 400

    hcl = body["hcl"]
    reverse = body.get("reverse", {})

    result = validate_hcl(hcl, reverse)
    return jsonify(result)
