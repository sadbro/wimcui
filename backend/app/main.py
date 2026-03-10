import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS
from app.api.graph_routes import bp

STATIC_FOLDER = os.path.join(os.path.dirname(__file__), "..", "static")

app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path="")
CORS(app)
app.register_blueprint(bp)

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    # Serve static asset if it exists (JS, CSS, images etc.)
    static_file = os.path.join(app.static_folder, path)
    if path and os.path.exists(static_file):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=8000)