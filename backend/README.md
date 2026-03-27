# WIMCUI Backend

Flask API server. Handles HCL validation and DAG generation. In production, also serves the built frontend as static files.

## Stack

* Python 3.10+
* Flask + flask-cors
* python-hcl2 — syntax-only HCL validation fallback
* NetworkX — DAG construction
* Terraform binary (optional) — full provider-level validation

## Structure

```
app/
├── main.py                  # Flask app, blueprint registration, static file serving
├── api/
│   ├── hcl_routes.py        # POST /api/validate-hcl, GET /api/validation-mode
│   └── graph_routes.py      # POST /graph/generate-tree
├── services/
│   ├── hcl_validator.py     # Dual-mode validation engine
│   └── dag_builder.py       # NetworkX DAG builder
└── models/
    └── graph_models.py
```

## Dev

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

Runs at `http://localhost:8000`. The Vite dev server proxies `/api/*` and `/graph/*` here.

## Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/validation-mode` | — | Active engine: `terraform`, `hcl2`, or `none` |
| `POST` | `/api/validate-hcl` | `{ hcl, reverse?, mode? }` | Validate HCL, map errors back to canvas nodes |
| `POST` | `/graph/generate-tree` | `{ nodes, edges }` | Build DAG from canvas graph |

## HCL Validation

`hcl_validator.py` supports three modes, selected via the `mode` field in the request body:

**`auto` (default)** — tries `terraform init + validate` with a 30s timeout. If init times out (common on cold start or resource-constrained deployments), falls back to python-hcl2 syntax-only validation automatically.

**`terraform`** — full provider-level validation with a 120s timeout. Catches attribute errors, unknown arguments, and type mismatches against the AWS provider schema. No fallback.

**`hcl2`** — python-hcl2 syntax-only. No provider schema — catches malformed HCL only. Always available.

### Error mapping

`POST /api/validate-hcl` accepts an optional `reverse` map: `{ tfResourceName: canvasNodeId }`. Diagnostic messages are parsed for resource addresses and mapped back to canvas node IDs so the frontend can highlight the specific node that failed.

### Plugin cache

The terraform AWS provider (~200MB) is downloaded on first use and cached at `TF_PLUGIN_CACHE_DIR` (defaults to a system temp directory). In Docker, this is set to `/app/.terraform_cache` and persists across requests.

## Production

In production the backend serves the compiled frontend from `./static/`. The Dockerfile builds the frontend and copies the output there before starting the Flask server.

```bash
# Build and run via Docker
docker build -t wimcui .
docker run -p 8000:8000 wimcui
```

On resource-constrained plans (e.g. Render free tier), terraform init may time out. The server auto-falls back to python-hcl2 in `auto` mode — the UI shows which engine is active.
