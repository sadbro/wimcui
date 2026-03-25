# WIMCUI — Claude Code Context

## Project Overview

WIMCUI (Where Is My Cloud UI) is a browser-based AWS infrastructure diagramming, validation, and Terraform HCL generation tool. React 19 + Vite 7 + ReactFlow 11 frontend, Flask backend with terraform validate integration.

## Architecture

```
frontend/src/
  config/           — all business logic lives here, not in components
  components/
    Canvas/         — ReactFlow canvas, node components
    Edges/          — custom edge components (Structural, Traffic, Association)
    Modal/          — config modals
    Sidebar/        — ResourcePanel, ReviewPanel, RoleManager

backend/app/
  api/              — Flask routes (graph_routes, hcl_routes)
  services/         — business logic (dag_builder, hcl_validator)
```

## Resource Pipeline

Adding a new AWS resource type requires 8 files in order. See CONTRIBUTING.md for the full guide. The files are:

1. `resourceRegistry.js` — type definition (label, color, sgCapable, iamCapable)
2. `resourceConfig.js` — config modal field definitions
3. `trafficRules.js` — allowed traffic sources/targets
4. `associationRules.js` — only if resource has non-traffic associations (most don't)
5. `consequenceRules.js` — warning-level validation rules
6. `ReviewPanel.jsx` — hard-fail HCL readiness checks in `buildHclChecks()`
7. `hclGenerator.js` — Terraform resource mapping, generator function, GENERATION_ORDER
8. `canvasLayers.js` — add to correct layer category

Use **ElastiCache** as the reference implementation — grep for it across all 8 files.

## Key Patterns

### HCL Generator
- All generators receive `(nodes, names, ctx, warnings)` and return an array of blocks
- Use `createRefResolver(names, warnings, label)` for safe reference resolution — never access `names[id]` directly
- Helper functions: `attr()`, `numAttr()`, `boolAttr()`, `rawAttr()`, `refListAttr()`, `block()`, `innerBlock()`, `tagsBlock()`, `comment()`
- `generateHCL(ctx, region)` returns `{ hcl, warnings, reverse }`

### Canvas Context
- `buildContext(nodes, edges, roles, securityGroups)` in `canvasContext.js` is the single derived state object consumed by consequence rules, HCL checks, and the HCL generator
- Never query nodes/edges directly in validation — always go through `ctx`

### Validation
- `consequenceRules.js` — warning-level, grouped by category (availability, security, cost, smell)
- `buildHclChecks()` in ReviewPanel — hard-fail, blocks HCL generation
- Backend `hcl_validator.py` — dual-mode: terraform binary (full validation) or python-hcl2 (syntax only), auto-detects at startup

### Canvas Layers
- Filter state in `canvasFilter` (InfraCanvas), passed via `CanvasFilterContext`
- Nodes read filter via `useCanvasFilter()` hook, edges via `useNodes()` + `getEdgeOpacity()`
- Layers are a view concern — no data mutation, no undo pollution

### Security Overlay
- Separate toggle from layers, passed via `SecurityOverlayContext`
- Mutually exclusive with layer filters — activating security resets layer to "all", selecting a layer turns off security
- Nodes read via `useSecurityOverlay()` hook
- `getSecurityNodeStyle()` in `canvasLayers.js` returns opacity/glow/border overrides
- `getSecurityEdgeOpacity()` keeps traffic edges full, dims others

### Canvas JSON Versioning
- `CANVAS_VERSION` and `migrateCanvas()` in `canvasMigrations.js`
- Export writes integer version, import runs migration chain
- Add migrations in the `MIGRATIONS` registry when schema changes

## Code Style

- Plain JavaScript with JSX — no TypeScript
- All styling is inline `style` props — no CSS files
- Config files use plain objects/arrays, not classes
- Monospace font constant `MONO` used throughout ReviewPanel
- HCL generator uses shared helpers — never raw string concatenation

## What NOT To Do

- Don't mutate node/edge state for view-only concerns (use context/refs instead)
- Don't add resources to `associationRules.js` unless they have a real non-traffic relationship
- Don't access `names[id]` in the HCL generator — use `createRefResolver()` which collects warnings for broken refs
- Don't add `EDGELESS_TYPES` entries for resources that actually use network traffic
- Don't pre-warm terraform provider in Docker — it crashes on resource-constrained hosts

## Ports

- Frontend dev server: 5173 (Vite)
- Backend: 8000 (Flask / Gunicorn)
- Vite proxies `/api/*` and `/graph/*` to backend

## Current Resource Count

26 types: VPC, Subnet, EC2, RDS, LoadBalancer, ECS, IGW, NATGateway, RouteTable, S3, Lambda, DynamoDB, SQS, SNS, EventBridge, SecretsManager, APIGateway, ElastiCache, ECR, Route53, Kinesis, ACM, CloudFront, WAF, ASG
