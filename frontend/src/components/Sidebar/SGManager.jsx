import { useState } from "react";
import { RESOURCE_REGISTRY } from "../../config/resourceRegistry";
import { buildContext } from "../../config/canvasContext";

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

const PROTOCOLS = ["TCP", "UDP", "ICMP", "HTTP", "HTTPS", "ALL"];

const SG_COLOR_PALETTE = [
  "#f97316", // orange
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#10b981", // emerald
  "#ef4444", // red
];

// Node types that support SG assignment
const sgCapableTypes = Object.entries(RESOURCE_REGISTRY)
  .filter(([, def]) => def.sgCapable)
  .map(([type]) => type);

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {SG_COLOR_PALETTE.map((c) => (
        <div
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 20, height: 20, borderRadius: 4,
            background: c, cursor: "pointer",
            border: value === c ? "2px solid var(--text-primary)" : "2px solid transparent",
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
}

function RuleRow({ rule, onChange, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
      <input
        type="text"
        value={rule.port}
        placeholder="Port / Range"
        onChange={(e) => onChange({ ...rule, port: e.target.value })}
        style={{
          flex: 1, padding: "5px 8px", borderRadius: 5,
          border: "1px solid var(--border)", fontSize: 12,
          background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none",
        }}
      />
      <select
        value={rule.protocol}
        onChange={(e) => onChange({ ...rule, protocol: e.target.value })}
        style={{
          flex: 1, padding: "5px 6px", borderRadius: 5,
          border: "1px solid var(--border)", fontSize: 12,
          background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none",
        }}
      >
        {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <input
        type="text"
        value={rule.cidr}
        placeholder="CIDR"
        onChange={(e) => onChange({ ...rule, cidr: e.target.value })}
        style={{
          flex: 1, padding: "5px 8px", borderRadius: 5,
          border: "1px solid var(--border)", fontSize: 12,
          background: "var(--bg-surface)", color: "var(--text-primary)", outline: "none",
        }}
      />
      <div
        onClick={onDelete}
        style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "var(--danger)", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 11, fontWeight: "bold", flexShrink: 0,
        }}
      >✕</div>
    </div>
  );
}

function DerivedRuleRow({ rule, direction }) {
  const label = direction === "inbound"
    ? `← ${rule.sourceNodeLabel || rule.sourceNodeId}`
    : `→ ${rule.destNodeLabel   || rule.destNodeId}`;
  return (
    <div style={{
      display: "flex", gap: 6, alignItems: "center", marginBottom: 4,
      padding: "4px 8px", borderRadius: 4,
      background: "var(--bg-surface)",
      border: "1px solid var(--border-subtle)",
      opacity: 0.75,
    }}>
      <span style={{ flex: 1, fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>
        {rule.port} / {rule.protocol}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>{label}</span>
      <span style={{
        fontSize: 9, color: "var(--accent)", border: "1px solid var(--accent)",
        borderRadius: 3, padding: "1px 4px", letterSpacing: 0.5, flexShrink: 0,
      }}>edge</span>
    </div>
  );
}

function SGEditor({ sg, onSave, onCancel, existingSGs = [], nodes = [], edges = [] }) {
  const [name, setName]       = useState(sg?.name    || "");
  const [color, setColor]     = useState(sg?.color   || SG_COLOR_PALETTE[0]);
  const [inbound, setInbound] = useState(sg?.inbound  || []);
  const [outbound, setOutbound] = useState(sg?.outbound || [
    { port: "0", protocol: "ALL", cidr: "0.0.0.0/0" },
  ]);
  const [error, setError] = useState("");

  const addRule = (setter) =>
    setter((r) => [...r, { port: "", protocol: "TCP", cidr: "0.0.0.0/0" }]);

  const updateRule = (setter, i, updated) =>
    setter((r) => r.map((rule, idx) => idx === i ? updated : rule));

  const deleteRule = (setter, i) =>
    setter((r) => r.filter((_, idx) => idx !== i));

  // Derive edge rules live — recomputes whenever edges/nodes change
  const derivedRules = (() => {
    if (!sg?.id || nodes.length === 0) return { inbound: [], outbound: [] };
    const ctx = buildContext(nodes, edges, [], []);
    // find all nodes assigned to this SG
    const assignedNodes = nodes.filter((n) => (n.data?.config?.sg_ids || []).includes(sg.id));
    const inbound  = [];
    const outbound = [];
    assignedNodes.forEach((n) => {
      const result = ctx.deriveNodeSGs(n.id);
      const primary = result[0]; // primary SG absorbs edge rules
      if (primary && primary.sg.id === sg.id) {
        inbound.push(...primary.edgeDerived.inbound);
        outbound.push(...primary.edgeDerived.outbound);
      }
    });
    return { inbound, outbound };
  })();

  const handleSave = () => {
    if (!name.trim()) { setError("Name is required"); return; }
    const duplicate = existingSGs.some(
      (s) => s.name.toLowerCase() === name.trim().toLowerCase() && s.id !== sg?.id
    );
    if (duplicate) { setError("A security group with this name already exists"); return; }
    onSave({ name: name.trim(), color, inbound, outbound });
  };

  const sectionStyle = { marginBottom: 14 };
  const labelStyle = {
    display: "block", fontSize: 12, fontWeight: 600,
    color: "var(--text-secondary)", marginBottom: 4,
  };
  const addBtnStyle = {
    width: "100%", padding: "5px 0", marginTop: 4,
    background: "transparent", border: "1px dashed var(--border)",
    borderRadius: 5, cursor: "pointer", fontSize: 11,
    color: "var(--text-muted)",
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000,
    }}>
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 10,
        padding: 24, width: 420,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ ...MONO, fontSize: 14, color: "var(--text-primary)", fontWeight: 700 }}>
            {sg ? "Edit Security Group" : "New Security Group"}
          </span>
          <span onClick={onCancel} style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</span>
        </div>

        {/* Name */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Name *</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder="e.g. web-tier-sg"
            style={{
              width: "100%", padding: "7px 10px", borderRadius: 6,
              border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
              background: "var(--bg-surface)", color: "var(--text-primary)",
              fontSize: 13, outline: "none", boxSizing: "border-box",
            }}
          />
          {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}
        </div>

        {/* Color */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Color</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: color, flexShrink: 0 }} />
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        {/* Inbound */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Inbound Rules</label>

          {derivedRules.inbound.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                From traffic edges
              </div>
              {derivedRules.inbound.map((rule, i) => (
                <DerivedRuleRow key={i} rule={rule} direction="inbound" />
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Additional rules
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <span style={{ flex: 1, fontSize: 10, color: "var(--text-muted)" }}>PORT</span>
            <span style={{ flex: 1, fontSize: 10, color: "var(--text-muted)" }}>PROTOCOL</span>
            <span style={{ flex: 1, fontSize: 10, color: "var(--text-muted)" }}>SOURCE CIDR</span>
            <div style={{ width: 20 }} />
          </div>
          {inbound.map((rule, i) => (
            <RuleRow
              key={i}
              rule={rule}
              onChange={(u) => updateRule(setInbound, i, u)}
              onDelete={() => deleteRule(setInbound, i)}
            />
          ))}
          {inbound.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
              No additional inbound rules
            </div>
          )}
          <button onClick={() => addRule(setInbound)} style={addBtnStyle}>+ Add Inbound Rule</button>
        </div>

        {/* Outbound */}
        <div style={sectionStyle}>
          <label style={labelStyle}>Outbound Rules</label>

          {derivedRules.outbound.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                From traffic edges
              </div>
              {derivedRules.outbound.map((rule, i) => (
                <DerivedRuleRow key={i} rule={rule} direction="outbound" />
              ))}
            </div>
          )}

          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
            Additional rules
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
            <span style={{ flex: 1, fontSize: 10, color: "var(--text-muted)" }}>PORT</span>
            <span style={{ flex: 1, fontSize: 10, color: "var(--text-muted)" }}>PROTOCOL</span>
            <span style={{ flex: 1, fontSize: 10, color: "var(--text-muted)" }}>DEST CIDR</span>
            <div style={{ width: 20 }} />
          </div>
          {outbound.map((rule, i) => (
            <RuleRow
              key={i}
              rule={rule}
              onChange={(u) => updateRule(setOutbound, i, u)}
              onDelete={() => deleteRule(setOutbound, i)}
            />
          ))}
          <button onClick={() => addRule(setOutbound)} style={addBtnStyle}>+ Add Outbound Rule</button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: 6,
              padding: "7px 16px", cursor: "pointer", fontSize: 13,
            }}
          >Cancel</button>
          <button
            onClick={handleSave}
            style={{
              background: "var(--accent)", color: "white",
              border: "none", borderRadius: 6,
              padding: "7px 16px", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >{sg ? "Save" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SGManager({ securityGroups, onSGChange, nodes = [], edges = [], onAssignSG }) {
  const [editing, setEditing]   = useState(null);
  const [creating, setCreating] = useState(false);
  const [assigning, setAssigning] = useState(null);

  // Nodes that support SG assignment — driven by registry sgCapable flag
  const capableNodes = nodes.filter((n) => sgCapableTypes.includes(n.data?.resourceType));

  // Build context once per render — reactive to both nodes and edges changes
  // This is the single source of truth for all derived SG rule counts in the list + assignment panel
  const ctx = buildContext(nodes, edges, [], securityGroups);

  // Precompute derived rule counts per SG — used in list view and assignment panel
  // Map: sgId -> { inboundDerived, outboundDerived, totalDerived }
  const sgDerivedCounts = securityGroups.reduce((acc, sg) => {
    const assignedNodes = nodes.filter((n) => (n.data?.config?.sg_ids || []).includes(sg.id));
    let inboundDerived = 0, outboundDerived = 0;
    assignedNodes.forEach((n) => {
      const result  = ctx.deriveNodeSGs(n.id);
      const primary = result[0];
      if (primary && primary.sg.id === sg.id) {
        inboundDerived  += primary.edgeDerived.inbound.length;
        outboundDerived += primary.edgeDerived.outbound.length;
      }
    });
    acc[sg.id] = { inboundDerived, outboundDerived, totalDerived: inboundDerived + outboundDerived };
    return acc;
  }, {});

  const handleCreate = (data) => {
    const newSG = { id: `sg_${Date.now()}`, ...data };
    onSGChange([...securityGroups, newSG]);
    setCreating(false);
  };

  const handleEdit = (data) => {
    onSGChange(securityGroups.map((s) => s.id === editing.id ? { ...s, ...data } : s));
    setEditing(null);
  };

  const handleDelete = (sgId) => {
    // Clear sg_ids references on all nodes before removing
    capableNodes
      .filter((n) => (n.data?.config?.sg_ids || []).includes(sgId))
      .forEach((n) => {
        const next = (n.data.config.sg_ids || []).filter((id) => id !== sgId);
        onAssignSG(n.id, next);
      });
    onSGChange(securityGroups.filter((s) => s.id !== sgId));
  };

  const handleAssignToggle = (sgId, nodeId) => {
    const node = capableNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const current = node.data?.config?.sg_ids || [];
    const next = current.includes(sgId)
      ? current.filter((id) => id !== sgId)
      : [...current, sgId];
    onAssignSG(nodeId, next);
  };

  return (
    <div style={{ marginTop: 16 }}>
      {/* Section header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{
          ...MONO, fontSize: 11, fontWeight: 700,
          color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase",
        }}>
          Security Groups
        </span>
        <button
          onClick={() => setCreating(true)}
          style={{
            background: "transparent", border: "1px solid var(--accent)",
            color: "var(--accent)", borderRadius: 5,
            padding: "2px 10px", cursor: "pointer",
            fontSize: 11, fontWeight: 600,
          }}
        >+ New</button>
      </div>

      {securityGroups.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>
          No security groups defined — create one to assign to EC2, RDS, or Load Balancer nodes
        </div>
      ) : (
        securityGroups.map((sg) => (
          <div key={sg.id}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 6, marginBottom: 4,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
            }}>
              {/* Color swatch */}
              <div style={{ width: 12, height: 12, borderRadius: 3, background: sg.color, flexShrink: 0 }} />
              {/* Name + rule count */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...MONO, fontSize: 12, color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sg.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {(() => {
                    const manual  = (sg.inbound?.length || 0) + (sg.outbound?.length || 0);
                    const derived = sgDerivedCounts[sg.id]?.totalDerived || 0;
                    if (derived > 0) return `${manual} manual + ${derived} from edges`;
                    return `${manual} manual rule${manual !== 1 ? "s" : ""}`;
                  })()}
                </div>
              </div>
              <span
                onClick={() => setAssigning(assigning?.id === sg.id ? null : sg)}
                style={{ fontSize: 11, color: assigning?.id === sg.id ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer", userSelect: "none" }}
              >assign</span>
              <span
                onClick={() => setEditing(sg)}
                style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", userSelect: "none" }}
              >edit</span>
              <span
                onClick={() => handleDelete(sg.id)}
                style={{ fontSize: 11, color: "var(--danger)", cursor: "pointer", userSelect: "none" }}
              >✕</span>
            </div>

            {/* Assignment panel */}
            {assigning?.id === sg.id && (
              <div style={{
                margin: "4px 0 8px 0", padding: "8px 10px",
                background: "var(--bg-surface)", borderRadius: 6,
                border: "1px solid var(--border)",
              }}>
                {capableNodes.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No compatible nodes on canvas</div>
                ) : (
                  capableNodes.map((node) => {
                    const assigned = (node.data?.config?.sg_ids || []).includes(sg.id);
                    const otherSGs = securityGroups.filter(
                      (s) => s.id !== sg.id && (node.data?.config?.sg_ids || []).includes(s.id)
                    );
                    return (
                      <div
                        key={node.id}
                        onClick={() => handleAssignToggle(sg.id, node.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "5px 4px", cursor: "pointer", borderRadius: 4,
                          background: assigned ? `${sg.color}18` : "transparent",
                        }}
                      >
                        <div style={{
                          width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                          border: `2px solid ${assigned ? sg.color : "var(--border)"}`,
                          background: assigned ? sg.color : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: "white",
                        }}>
                          {assigned ? "✓" : ""}
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1 }}>
                          {node.data.label}
                          <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>
                            ({node.data.resourceType})
                          </span>
                        </span>
                        {otherSGs.length > 0 && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            +{otherSGs.length} SG{otherSGs.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ))
      )}

      {creating && (
        <SGEditor
          existingSGs={securityGroups}
          nodes={nodes}
          edges={edges}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <SGEditor
          sg={editing}
          existingSGs={securityGroups}
          nodes={nodes}
          edges={edges}
          onSave={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}