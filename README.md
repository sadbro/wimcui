# WIMCUI — Where Is My Cloud UI

A browser-based infrastructure diagramming and validation tool for AWS. WIMCUI lets you visually design cloud architecture on a canvas, validate it against common infrastructure rules, and review it for Terraform readiness — without writing a single line of configuration upfront.

---

## What It Is

WIMCUI is a WYSIWYG canvas tool for AWS infrastructure design. You drag resources onto a canvas, connect them, configure them, and the tool tells you what is wrong, what is missing, and whether your diagram is ready to generate Terraform HCL from.

The name is intentional. It answers the question architects ask when staring at a wall of Terraform files: where is the thing I am looking for.

---

## What It Can Do

* Drag-and-drop placement of AWS resources: VPC, Subnet, EC2, RDS, Load Balancer, Internet Gateway, NAT Gateway, and Route Table
* Structural edges that model parent-child relationships (VPC contains Subnet, Subnet contains EC2)
* Traffic edges that model ingress and egress rules between compute resources
* Association edges that model Route Table to Subnet and Route Table to IGW/NAT Gateway relationships
* Per-resource configuration via modal: CIDR validation, AZ selection, engine versions, instance types, LB listener/target group settings, and more
* IAM Role system: define roles with colors and policies, assign them to EC2 instances, view assignments on the canvas via color stripes
* Consequence engine: 20+ rules that flag availability, security, cost, and configuration issues in real time
* HCL Readiness review: hard fail checks that block generation until the canvas is valid
* Canvas export and import as JSON
* Undo and redo with full state restoration including edges and IAM assignments
* Dark and light theme
* Region selector

---

## What It Cannot Do (Yet)

* Full Terraform HCL generation — the generator is not yet built. The tool validates readiness but does not output `.tf` files in this version.
* Non-VPC resources — S3, SQS, SNS, Lambda, DynamoDB, and other regional/global services are not yet modeled.
* Security Groups as first-class canvas nodes — SGs are derived at HCL generation time from traffic edge topology and are not directly editable on the canvas.
* Multi-region canvases — one region per canvas.
* Importing existing Terraform or CloudFormation into the canvas.

---

## Repository Structure

```
wimcui/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── graph_routes.py
│   │   ├── services/
│   │   │   └── dag_builder.py
│   │   └── main.py
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
│   │   │   │   └── EdgeConfigModal.jsx
│   │   │   └── Sidebar/
│   │   │       ├── ResourcePanel.jsx
│   │   │       ├── ReviewPanel.jsx
│   │   │       └── RoleManager.jsx
│   │   ├── config/
│   │   │   ├── resourceConfig.js
│   │   │   ├── canvasContext.js
│   │   │   ├── consequenceRules.js
│   │   │   ├── iamConfig.js
│   │   │   ├── rolesContext.js
│   │   │   ├── cidrUtils.js
│   │   │   └── awsRegions.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── Dockerfile
├── render.yaml
└── README.md
```

---

## Setup

### Prerequisites

* Node.js 18 or later
* Python 3.10 or later (backend is currently unused locally — see note below)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

### Backend

The Flask backend is not required for local development. All canvas logic, validation, and consequence rules run entirely in the browser. The backend exists for the HCL generation endpoint which is not yet implemented.

If you want to run it anyway:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m app.main
```

---

## Features

### Canvas

Resources are placed by dragging from the sidebar. Structural edges are created automatically when a child resource (Subnet, EC2, RDS) selects a parent during configuration. Traffic and association edges are drawn manually by connecting node handles. Double-clicking any node or traffic edge opens its configuration modal.

### Resource Configuration

Each resource type has its own set of validated fields. CIDR blocks are checked for format, prefix range, VPC containment, and subnet overlap. RDS engine versions are dependent on engine selection. Load Balancer fields adjust based on whether ALB or NLB is selected. AZ options are pulled from the selected AWS region.

### IAM Roles

Roles are defined in the Configure tab of the sidebar. Each role has a name, a color, and a set of AWS managed policies selected from a grouped catalog. Roles are assigned to EC2 instances either from the sidebar or from within the EC2 config modal. The assigned role appears as a color stripe on the left edge of the EC2 node on the canvas.

### Consequence Engine

The Review Canvas panel runs all consequence rules against the current canvas state and groups results by severity: Availability, Security, Cost, and Configuration. Rules cover single points of failure, missing IGW routes, EC2 instances without IAM roles, redundant policies, NAT placement, RDS in public subnets, load balancer target count, and more.

### HCL Readiness

The HCL Readiness tab lists hard fail checks that must pass before Terraform generation is possible. These include missing required fields, invalid CIDR blocks, duplicate resource names, IAM role name format violations, and duplicate role names.

### Undo and Redo

All destructive and mutating actions are undoable: node deletion, edge deletion, config edits, IAM assignments, node moves, and canvas import. History is capped at 50 steps. Keyboard shortcuts are Ctrl+Z to undo and Ctrl+Y to redo (Cmd on Mac).

### Export and Import

The canvas state — nodes, edges, region, and IAM roles — can be exported as a JSON file and reimported. Dangling role references in imported files are detected and cleared automatically.
