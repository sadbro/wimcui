import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from app.api.graph_routes import bp as graph_bp
from app.api.hcl_routes import bp as hcl_bp

app = Flask(__name__)
CORS(app)
app.register_blueprint(graph_bp)
app.register_blueprint(hcl_bp)

STATIC_DIR = os.path.join(os.getcwd(), "static")

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    full_path = os.path.join(STATIC_DIR, path)
    if path and os.path.exists(full_path):
        return send_from_directory(STATIC_DIR, path)
    return send_from_directory(STATIC_DIR, "index.html")

if __name__ == "__main__":
    app.run(debug=True, port=8000)