from flask import Blueprint, request, jsonify
from app.services.dag_builder import build_dag

bp = Blueprint("graph", __name__, url_prefix="/graph")

@bp.post("/generate-tree")
def generate_dag():
    graph = request.get_json()
    dag = build_dag(graph)
    return jsonify({
        "message": "Tree generated successfully",
        "dag": dag
    })