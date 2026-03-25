# Contributing to WIMCUI

Thanks for your interest in contributing. This guide covers the most common contribution type: **adding a new AWS resource type**. The resource pipeline is intentionally modular — each step is a separate file, and the pattern is the same for every resource.

---

## Adding a New AWS Resource Type

Adding a resource requires touching **8 files** in a specific order. Each step has a clear pattern you can copy from an existing resource. Use **ElastiCache** as your reference — it's a recent addition that covers all the common patterns (subnets, SGs, traffic rules, HCL generation).

### The Pipeline

```
1. Registry  →  2. Config Fields  →  3. Traffic Rules  →  4. Association Rules
      ↓                                                          ↓
5. Consequence Rules  →  6. HCL Readiness Checks  →  7. HCL Generator  →  8. Canvas Layers
```

---

### Step 1: Resource Registry

**File:** `frontend/src/config/resourceRegistry.js`

Add an entry to `RESOURCE_REGISTRY`. This defines how the resource appears on the canvas.

```javascript
YourResource: {
  label:       "YourResource",
  color:       "#hexcolor",       // border color on canvas
  category:    "compute",         // "network" | "compute" | "infra" | "global"
  defaultSize: { width: 160, height: 60 },
  sgCapable:   true,              // can attach Security Groups?
  iamCapable:  false,             // can attach IAM Roles?
},
```

**Decisions to make:**
- `sgCapable`: true if the resource runs inside a VPC and accepts network traffic (EC2, ECS, RDS, ElastiCache, Lambda with VPC). False for API-accessed services (S3, SQS, DynamoDB).
- `iamCapable`: true if the resource assumes an IAM role (EC2, ECS, Lambda). False for everything else.
- `category`: affects sidebar grouping. Network infra = "network", compute/containers = "compute", supporting services = "global".

---

### Step 2: Config Fields

**File:** `frontend/src/config/resourceConfig.js`

Add a field definitions array for your resource type. This drives the configuration modal.

```javascript
YourResource: [
  {
    key: "subnets",
    label: "Subnets",
    type: "multi-select",        // field types: text, select, multi-select, sg-select, iam-role-select, dependent-select
    parentType: "Subnet",
  },
  {
    key: "engine",
    label: "Engine",
    type: "select",
    options: ["redis", "memcached"],
  },
  {
    key: "name",
    label: "Name",
    type: "text",
    placeholder: "my-resource",
  },
  // ... more fields
  ...baseFields,                 // always include — adds name + description
],
```

**Field types available:**
- `text` — free-form input. Supports `placeholder`, `required`, `validate(value)`.
- `select` — dropdown. Requires `options` array.
- `multi-select` — multi-select dropdown. Use with `parentType` for subnet/VPC selection.
- `sg-select` — Security Group multi-select. Only for `sgCapable` resources.
- `iam-role-select` — IAM Role select. Only for `iamCapable` resources.
- `dependent-select` — options change based on another field. Requires `dependsOn` and `optionMap`.
- `visibleWhen: (form) => boolean` — conditionally show/hide a field based on other field values.

---

### Step 3: Traffic Rules

**File:** `frontend/src/config/trafficRules.js`

Add traffic direction rules. This controls which resources can be connected via traffic edges.

```javascript
YourResource: { allowedSources: ["EC2", "ECS", "Lambda"], allowedTargets: [] },
```

- `allowedSources`: resource types that can send traffic TO this resource.
- `allowedTargets`: resource types this resource can send traffic TO.
- If your resource is API-accessed (S3, SQS, DynamoDB) and doesn't participate in network traffic, set both to `[]` or add it to the null-traffic list.

---

### Step 4: Association Rules (if applicable)

**File:** `frontend/src/config/associationRules.js`

Most resources do NOT need association rules. Only add an entry if your resource has a non-traffic, non-structural relationship with another resource (like RouteTable↔Subnet or SecretsManager↔target).

If your resource doesn't need associations, **skip this file**.

---

### Step 5: Consequence Rules

**File:** `frontend/src/config/consequenceRules.js`

Add warning-level validation rules. These appear in the Review Canvas panel under Availability, Security, Cost, and Configuration categories.

```javascript
{
  id: "yourresource_no_encryption",
  category: "security",
  check: ({ byResourceType }) => {
    const items = byResourceType["YourResource"] || [];
    return items
      .filter((n) => n.data?.config?.encryption !== "true")
      .map((n) => ({
        node: n,
        message: `${n.data.label} does not have encryption enabled`,
      }));
  },
},
```

**Rule categories:** `"availability"`, `"security"`, `"cost"`, `"smell"` (configuration smells).

**What to check for (common patterns):**
- Missing encryption
- Single AZ / no multi-AZ
- Missing auth / access controls
- No consumers / orphan resource
- Expensive defaults (large instance types with no justification)
- Missing names / descriptions

---

### Step 6: HCL Readiness Checks

**File:** `frontend/src/components/Sidebar/ReviewPanel.jsx`

Add hard-fail checks in `buildHclChecks()`. These block HCL generation until fixed. Only check fields that are absolutely required for valid Terraform output.

Two changes needed:

**a) Add the variable extraction** (near the top of `buildHclChecks`):

```javascript
const yourresources = ctx.byResourceType?.["YourResource"] || [];
```

**b) Add the hard-fail checks:**

```javascript
// --- YourResource hard fails ---
yourresources.forEach((n) => {
  const cfg = n.data?.config || {};
  if (!cfg.engine)
    checks.push({ ok: false, warn: false, message: `${n.data.label} is missing engine` });
  if (!cfg.name?.trim())
    checks.push({ ok: false, warn: false, message: `${n.data.label} is missing a name` });
});
```

**Also:** If your resource is API-accessed and doesn't need network edges, add it to `EDGELESS_TYPES` in the orphan-check section to prevent false "no edges" warnings.

---

### Step 7: HCL Generator

**File:** `frontend/src/config/hclGenerator.js`

Three changes needed:

**a) Add the Terraform resource type mapping** (in `TF_TYPES`):

```javascript
YourResource: "aws_your_resource_type",
```

**b) Add the generator function** (in the `generators` object):

```javascript
YourResource(nodes, names, ctx, warnings) {
  const blocks = [];
  nodes.forEach((n) => {
    const cfg = n.data?.config || {};
    const name = names[n.id];
    const r = createRefResolver(names, warnings, n.data?.label || name);

    blocks.push(block("aws_your_resource_type", name, name, [
      attr("name", cfg.name || n.data?.label),
      attr("engine", cfg.engine),
      // ... more attributes
      "",
      tagsBlock(cfg.name || n.data?.label),
    ]));
  });
  return blocks;
},
```

**Helper functions available:**
- `attr(key, value)` — string attribute: `key = "value"`
- `numAttr(key, value)` — number attribute: `key = value`
- `boolAttr(key, value)` — boolean attribute: `key = true/false`
- `rawAttr(key, expr)` — raw expression (no quotes): `key = aws_vpc.main.id`
- `refListAttr(key, refs)` — list of references: `key = [aws_subnet.a.id, ...]`
- `innerBlock(name, body)` — nested block
- `block(type, name, label, body)` — resource block wrapper
- `tagsBlock(name)` — standard Name tag block
- `comment(text)` — HCL comment
- `createRefResolver(names, warnings, label)` — returns `r` with `r.ref(type, id, prop)`, `r.name(id)`, `r.list(type, ids, prop)` for safe reference resolution

**c) Add to `GENERATION_ORDER`:**

```javascript
const GENERATION_ORDER = [
  "VPC", "Subnet", "IGW", "NATGateway", "RouteTable",
  "LoadBalancer", "EC2", "ECS", "RDS", "Lambda",
  "S3", "DynamoDB", "SQS", "SNS", "EventBridge",
  "SecretsManager", "APIGateway", "ElastiCache", "ECR",
  "Route53", "Kinesis", "ACM", "CloudFront", "WAF", "ASG",
  "YourResource",   // <-- add here, respecting dependency order
];
```

Place your resource after any resources it references. For example, if your resource references subnets, it must come after "Subnet".

---

### Step 8: Canvas Layers

**File:** `frontend/src/config/canvasLayers.js`

Add your resource type to the appropriate layer category:

| Layer | When to use |
|-------|-------------|
| `network` | VPC infrastructure: VPC, Subnet, IGW, NAT, RouteTable, Route53 |
| `compute` | Runs code: EC2, ECS, Lambda, LoadBalancer |
| `data` | Stores data: RDS, DynamoDB, ElastiCache, S3 |
| `services` | API-accessed: SQS, SNS, EventBridge, Kinesis, SecretsManager, ECR, APIGateway |

```javascript
data: { label: "Data", resourceTypes: ["RDS", "DynamoDB", "ElastiCache", "S3", "YourResource"], ... },
```

---

## Checklist

Use this checklist before submitting a PR for a new resource:

- [ ] `resourceRegistry.js` — entry with label, color, category, sgCapable, iamCapable
- [ ] `resourceConfig.js` — field definitions with correct types and validation
- [ ] `trafficRules.js` — traffic direction rules (or null entry)
- [ ] `associationRules.js` — only if resource has non-traffic associations
- [ ] `consequenceRules.js` — at least 2-3 rules covering security, availability, naming
- [ ] `ReviewPanel.jsx` — hard-fail checks in `buildHclChecks()`, EDGELESS_TYPES if applicable
- [ ] `hclGenerator.js` — TF_TYPES mapping, generator function using `createRefResolver`, GENERATION_ORDER entry
- [ ] `canvasLayers.js` — added to correct layer category
- [ ] `npm run build` passes with no errors
- [ ] Tested on canvas: node can be placed, configured, connected, and generates valid HCL

---

## Other Contributions

### Bug Fixes

1. Fork and create a branch from `main`
2. Make your fix
3. Verify `npm run build` passes
4. Submit a PR with a clear description of what was broken and how you fixed it

### New Features (non-resource)

Open an issue first to discuss the approach. Features that touch the core canvas, validation engine, or HCL generator need alignment before implementation.

---

## Development Setup

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173

# Backend (optional — needed for terraform validate)
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.main   # http://localhost:8000
```

The Vite dev server proxies `/api/*` and `/graph/*` to the backend on port 8000.

---

## Code Style

- No TypeScript — the project uses plain JavaScript with JSX
- No CSS files — all styling is inline via `style` props
- Config files use plain objects and arrays, not classes
- HCL generator functions use the shared helper functions (`attr`, `block`, `createRefResolver`, etc.) — do not write raw string concatenation
- Consequence rules return arrays of `{ node, message }` objects
- Hard-fail checks push `{ ok: false, warn: false, message }` objects
