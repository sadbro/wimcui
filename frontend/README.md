# WIMCUI Frontend

React + Vite application. The frontend is the entire product UI — canvas, sidebar, modals, validation display, and HCL output.

## Stack

* React 19 with ReactFlow 11 for the canvas
* Vite for bundling and dev server
* No UI framework — all styling is inline with CSS variables

## Structure

```
src/
├── components/
│   ├── Canvas/
│   │   ├── InfraCanvas.jsx          # Main canvas — nodes, edges, state, all actions
│   │   ├── ResourceNode.jsx         # Standard canvas node
│   │   └── PublicNode.jsx           # Public-facing resource variant node
│   ├── Edges/
│   │   ├── StructuralEdge.jsx       # Parent-child containment edges
│   │   ├── TrafficEdge.jsx          # Ingress/egress edges between compute
│   │   └── AssociationEdge.jsx      # Non-traffic relationship edges
│   ├── Modal/
│   │   ├── ConfigModal.jsx          # Per-resource config form
│   │   ├── DocsModal.jsx            # Resource docs + reference example loader
│   │   ├── EdgeConfigModal.jsx      # Traffic edge rule config
│   │   └── SGAutoCreateModal.jsx    # Prompt to create SGs on import
│   └── Sidebar/
│       ├── ResourcePanel.jsx        # Drag sources, group examples
│       ├── ReviewPanel.jsx          # Consequence rules, HCL readiness, validation
│       └── RoleManager.jsx          # IAM role and SG management
├── config/
│   ├── resourceRegistry.js          # Type metadata (label, icon, category, edge rules)
│   ├── resourceConfig.js            # Per-type field definitions for ConfigModal
│   ├── hclGenerator.js              # Full Terraform HCL generator
│   ├── canvasContext.js             # buildContext() — derived canvas state
│   ├── consequenceRules.js          # Warning-level consequence rules
│   ├── trafficRules.js              # Traffic edge validity rules
│   ├── associationRules.js          # Association edge validity rules
│   ├── canvasLayers.js              # Layer filter + security overlay logic
│   ├── canvasFilterContext.js       # React contexts for layer/security state
│   ├── canvasMigrations.js          # Versioned JSON migration chain
│   ├── iamConfig.js                 # IAM policy catalog
│   ├── rolesContext.js              # Roles + SG React context
│   ├── cidrUtils.js                 # CIDR validation helpers
│   └── awsRegions.js                # Region → AZ map
├── App.jsx
└── main.jsx

public/
└── docs/
    ├── index.json                   # Resource and group doc manifest
    ├── resources/                   # 29 per-resource doc + example JSONs
    └── groups/                      # 9 group architecture example JSONs
```

## Dev

```bash
npm install
npm run dev
```

Runs at `http://localhost:5173`. The Vite dev server proxies `/api/*` and `/graph/*` to the backend at `http://localhost:8000`.

## Key Concepts

**Edge types**: `structural` (parent-child, drawn on config save), `traffic` (manually drawn, drives SG rules), `association` (manually drawn, models non-traffic links like RT→Subnet or ACM→CloudFront).

**Config flow**: double-click a node → ConfigModal opens → on save, `InfraCanvas.onEditSave` reconciles structural edges (by parentType fields), association edges (by assocEdgeDir fields), updates the node label (`config.display_name` → `config.name` → resource type), and writes config back to node data. The node renders as a two-line chip: resource type (small, muted) above the user label.

**Consequence rules**: `buildContext()` in canvasContext.js derives typed node collections and lookup maps from the current canvas. `consequenceRules.js` receives that context and returns typed result objects. ReviewPanel renders them grouped by category.

**HCL readiness**: a separate set of hard-fail checks in ReviewPanel that must all pass before generation is enabled.

**Doc examples**: each resource JSON in `public/docs/resources/` has an `example` field with `nodes`, `edges`, `securityGroups`, and `roles` — a valid canvas export that loads directly. DocsModal loads it via `onLoadExample`.
