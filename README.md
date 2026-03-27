# WIMCUI — Where Is My Cloud UI

A browser-based infrastructure diagramming, validation, and Terraform generation tool for AWS. WIMCUI lets you visually design cloud architecture on a canvas, validate it against common infrastructure rules, generate production-ready Terraform HCL, and validate the output — without writing a single line of configuration upfront.

---

## What It Is

WIMCUI is a WYSIWYG canvas tool for AWS infrastructure design. You drag resources onto a canvas, connect them, configure them, and the tool tells you what is wrong, what is missing, and whether your diagram is ready to generate Terraform HCL from.

The name is intentional. It answers the question architects ask when staring at a wall of Terraform files: where is the thing I am looking for.

---

## What It Can Do

### Canvas and Resources

* Drag-and-drop placement of 25 AWS resource types:
  * **Network**: VPC, Subnet, Internet Gateway, NAT Gateway, Route Table
  * **Compute**: EC2, ECS, Lambda, Auto Scaling Group
  * **Database**: RDS, DynamoDB, ElastiCache
  * **Load Balancing**: Application/Network Load Balancer
  * **Storage**: S3, ECR
  * **Messaging**: SQS, SNS, EventBridge, Kinesis
  * **Security**: SecretsManager, WAF, ACM
  * **CDN**: CloudFront
  * **DNS**: Route53
* Structural edges that model parent-child relationships (VPC contains Subnet, Subnet contains EC2)
* Traffic edges that model ingress and egress rules between compute resources
* Association edges that model non-traffic relationships: Route Table to Subnet, ACM to ALB/CloudFront, CloudFront to S3/ALB origin, WAF to ALB/CloudFront/API Gateway, SecretsManager to RDS/ECS
* Per-resource configuration via modal: CIDR validation, AZ selection, engine versions, instance types, LB listener/target group settings, and more
* Editable display name per resource — shown on the canvas label, independent of the internal config name
* Reference examples: each resource type has a loadable canvas example (accessible via the `?` button) with working configs, correct SGs, IAM roles, and architecture notes; 3 group examples covering common patterns (public web server, 3-tier app, serverless API)

### IAM and Security

* IAM Role system: define roles with colors and policies, assign them to EC2, ECS, Lambda, and ASG
* Security Group system: define SGs with inbound/outbound rules, assign to SG-capable resources
* Role and SG assignments visible on canvas via color indicators

### Validation

* Consequence engine: 120+ rules that flag availability, security, cost, and configuration issues in real time
* HCL Readiness checks: hard fail validations that block generation until the canvas is valid
* Per-resource-type checks for all 26 resource types

### HCL Generation and Terraform Validation

* Full Terraform HCL generation covering all 25 resource types, Security Groups, and IAM Roles
* Safe reference resolution: broken references produce `# WARNING:` comments and collected warnings instead of `undefined` in output
* Reverse name map: maps Terraform resource names back to canvas node IDs for error mapping
* Dual-mode Terraform validation:
  * **terraform binary available**: full provider-level validation (catches attribute errors, unknown arguments, type mismatches)
  * **python-hcl2 fallback**: syntax-only validation when terraform is not available (catches malformed HCL)
  * Auto-detection at startup with mode indicator in the UI
* Copy to clipboard, download as `.tf`, and validate — all from the HCL Readiness tab

### Reference Examples

Every resource type has a documentation page accessible by clicking `?` on any canvas node or the sidebar. Each doc page explains what the resource is, how it connects to others, and best practices. Clicking "Load Example" replaces the current canvas with a working reference example that includes:

* Correctly configured nodes with realistic values
* Structural, traffic, and association edges
* Pre-defined Security Groups with appropriate inbound/outbound rules
* IAM roles with relevant AWS managed policies
* A note in the Review panel flagging what to add for production use

Three group examples are also available (Public Web Server, Classic 3-Tier App, Serverless API) and loadable from the sidebar resources panel.

### Canvas Views

* **Layer filters**: toggle between All, Network, Compute, Data, and Services views — dims unrelated resources and edges for focus
* **Security overlay**: highlights SG-capable resources, flags exposed nodes (no SGs) with red glow, shows SG color glow on protected nodes, dims non-traffic edges

### Canvas Management

* Canvas export and import as JSON with versioned schema and forward migration (current schema: v2)
* Undo and redo with full state restoration including edges and IAM assignments
* Dark and light theme
* Region selector

---

## What It Cannot Do (Yet)

* Multi-region canvases — one region per canvas
* Importing existing Terraform or CloudFormation into the canvas
* Additional resources: VPC Endpoints, Cognito, VPC Peering, EFS, EKS
* Blueprints: saved, shareable, parameterized architecture templates (planned)

---

## Repository Structure

```
wimcui/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── graph_routes.py         # DAG generation endpoint
│   │   │   └── hcl_routes.py           # HCL validation + mode endpoints
│   │   ├── services/
│   │   │   ├── dag_builder.py           # NetworkX DAG builder
│   │   │   └── hcl_validator.py         # Dual-mode terraform/hcl2 validator
│   │   ├── models/
│   │   │   └── graph_models.py
│   │   └── main.py                      # Flask app entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/
│   │   │   │   ├── InfraCanvas.jsx
│   │   │   │   ├── ResourceNode.jsx
│   │   │   │   └── PublicNode.jsx
│   │   │   ├── Edges/
│   │   │   │   ├── StructuralEdge.jsx
│   │   │   │   ├── TrafficEdge.jsx
│   │   │   │   └── AssociationEdge.jsx
│   │   │   ├── Modal/
│   │   │   │   ├── ConfigModal.jsx
│   │   │   │   ├── DocsModal.jsx
│   │   │   │   ├── EdgeConfigModal.jsx
│   │   │   │   └── SGAutoCreateModal.jsx
│   │   │   └── Sidebar/
│   │   │       ├── ResourcePanel.jsx
│   │   │       ├── ReviewPanel.jsx      # Consequence rules, HCL readiness, validation UI
│   │   │       └── RoleManager.jsx
│   │   ├── config/
│   │   │   ├── resourceRegistry.js      # 25 resource type definitions
│   │   │   ├── resourceConfig.js        # Per-type field definitions
│   │   │   ├── hclGenerator.js          # Full HCL generator (all 25 types + SGs + IAM)
│   │   │   ├── canvasContext.js          # buildContext() — derived state from canvas
│   │   │   ├── consequenceRules.js      # Warning-level validation rules
│   │   │   ├── trafficRules.js          # Traffic edge validation
│   │   │   ├── associationRules.js      # Association edge rules
│   │   │   ├── canvasLayers.js          # Layer filter + security overlay helpers
│   │   │   ├── canvasFilterContext.js   # Layer + security overlay React contexts
│   │   │   ├── canvasMigrations.js      # JSON versioning and migration chain
│   │   │   ├── iamConfig.js
│   │   │   ├── rolesContext.js
│   │   │   ├── cidrUtils.js
│   │   │   └── awsRegions.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   └── docs/
│   │       ├── index.json                   # Resource and group manifest
│   │       ├── resources/                   # 25 per-resource doc + example JSONs
│   │       └── groups/                      # 3 group architecture example JSONs
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── Dockerfile                           # Multi-stage: Node build + Python + Terraform
├── render.yaml
└── README.md
```

---

## Setup

### Prerequisites

* Node.js 18 or later
* Python 3.10 or later
* Terraform (optional — enables full provider-level validation locally)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`. The Vite dev server proxies `/api/*` and `/graph/*` to the backend on port 8000.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

The backend runs at `http://localhost:8000`.

If terraform is installed, `POST /api/validate-hcl` runs full provider validation. Otherwise it falls back to python-hcl2 syntax checking. Check `GET /api/validation-mode` to see which engine is active.

---

## Deployment

The project is configured for Render via `render.yaml` and a multi-stage Dockerfile.

```bash
# Build locally to test
docker build -t wimcui .
docker run -p 8000:8000 wimcui
```

The Dockerfile installs the Terraform binary. The AWS provider is downloaded on the first validation request (~30s). On resource-constrained plans where terraform times out, the backend automatically falls back to python-hcl2 syntax validation.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/validation-mode` | Returns active validation engine (`terraform`, `hcl2`, or `none`) |
| POST | `/api/validate-hcl` | Validates HCL — body: `{ hcl, reverse }` |
| POST | `/graph/generate-tree` | Generates DAG from graph — body: `{ nodes, edges }` |

---

## Features

### Canvas

Resources are placed by dragging from the sidebar. Structural edges are created automatically when a child resource selects a parent during configuration. Traffic and association edges are drawn manually by connecting node handles. Double-clicking any node or traffic edge opens its configuration modal.

### Resource Configuration

Each resource type has its own set of validated fields. CIDR blocks are checked for format, prefix range, VPC containment, and subnet overlap. RDS engine versions are dependent on engine selection. Load Balancer fields adjust based on whether ALB or NLB is selected. AZ options are pulled from the selected AWS region.

### IAM Roles

Roles are defined in the Configure tab of the sidebar. Each role has a name, a color, and a set of AWS managed policies selected from a grouped catalog. Roles are assigned to EC2, ECS, Lambda, and ASG. The assigned role appears as a color stripe on the node on the canvas.

### Security Groups

Security Groups are defined in the Configure tab. Each SG has a name, color, and inbound/outbound rules (port, protocol, CIDR). SGs are assigned to SG-capable resources (EC2, ECS, Lambda, RDS, Load Balancer, ElastiCache, ASG). Traffic edges between resources auto-derive additional SG rules.

### Consequence Engine

The Review Canvas panel runs all consequence rules against the current canvas state and groups results by severity: Availability, Security, Cost, and Configuration.

### HCL Generation

The HCL Readiness tab validates readiness, generates Terraform HCL for all canvas resources, and provides copy/download/validate actions. The generator covers all 26 resource types plus Security Groups and IAM Roles with dependency-ordered output.

### Terraform Validation

Generated HCL can be validated against the Terraform AWS provider. The validation engine auto-detects: if the terraform binary is available, it runs full `terraform init + validate` with JSON diagnostics mapped back to canvas nodes. If terraform is unavailable, python-hcl2 provides syntax-only validation. The active engine is shown in the UI.

### Canvas Layers

The top-center pill bar switches between architectural views: All, Network, Compute, Data, and Services. Each layer highlights the relevant resource types and dims everything else. Edges use 3-tier opacity: full for both endpoints in layer, 0.3 for boundary edges, 0.08 for unrelated.

### Security Overlay

A dedicated toggle (separate from layer filters) activates the security view. When active:

* SG-capable resources with assigned Security Groups glow with their primary SG color
* SG-capable resources without SGs are flagged with a red "exposed" glow
* Non-SG-capable resources dim to background
* Traffic edges stay full opacity; structural and association edges dim
* SG color stripes on nodes widen for visibility

The overlay and layer filters are mutually exclusive — activating security resets to "All" view, and selecting a layer filter turns off the security overlay.

### Undo and Redo

All destructive and mutating actions are undoable: node deletion, edge deletion, config edits, IAM assignments, node moves, and canvas import. History is capped at 50 steps. Keyboard shortcuts are Ctrl+Z to undo and Ctrl+Y to redo (Cmd on Mac).

### Export and Import

The canvas state — nodes, edges, region, IAM roles, and Security Groups — can be exported as a JSON file and reimported. Dangling role and SG references in imported files are detected and cleared automatically.
