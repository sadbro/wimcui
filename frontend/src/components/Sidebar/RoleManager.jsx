import { useState } from "react";
import { IAM_POLICY_GROUPS, ROLE_COLOR_PALETTE } from "../../config/iamConfig";

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
      {ROLE_COLOR_PALETTE.map((c) => (
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

function PolicySelector({ selected, onChange }) {
  return (
    <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 4 }}>
      {IAM_POLICY_GROUPS.map((group) => (
        <div key={group.group} style={{ marginBottom: 10 }}>
          <div style={{
            ...MONO, fontSize: 10, fontWeight: 700,
            color: "var(--text-muted)", letterSpacing: 1,
            textTransform: "uppercase", marginBottom: 4,
          }}>
            {group.group}
          </div>
          {group.policies.map((p) => {
            const checked = selected.includes(p.key);
            return (
              <div
                key={p.key}
                onClick={() => {
                  const next = checked
                    ? selected.filter((k) => k !== p.key)
                    : [...selected, p.key];
                  onChange(next);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: 5, cursor: "pointer",
                  background: checked ? "var(--accent)22" : "transparent",
                  marginBottom: 2,
                }}
              >
                <div style={{
                  width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                  border: `2px solid ${checked ? "var(--accent)" : "var(--border)"}`,
                  background: checked ? "var(--accent)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: "white",
                }}>
                  {checked ? "✓" : ""}
                </div>
                <span style={{ fontSize: 12, color: checked ? "var(--accent)" : "var(--text-secondary)" }}>
                  {p.label}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function RoleEditor({ role, onSave, onCancel, existingRoles = [] }) {
  const [name, setName]         = useState(role?.name || "");
  const [color, setColor]       = useState(role?.color || ROLE_COLOR_PALETTE[0]);
  const [policies, setPolicies] = useState(role?.policies || []);
  const [error, setError]       = useState("");

  const handleSave = () => {
    if (!name.trim()) { setError("Role name is required"); return; }
    const duplicate = existingRoles.some(
      (r) => r.name.toLowerCase() === name.trim().toLowerCase() && r.id !== role?.id
    );
    if (duplicate) { setError("A role with this name already exists"); return; }
    onSave({ name: name.trim(), color, policies });
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
        padding: 24, width: 380,
        border: "1px solid var(--border)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        maxHeight: "85vh", overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ ...MONO, fontSize: 14, color: "var(--text-primary)", fontWeight: 700 }}>
            {role ? "Edit Role" : "New Role"}
          </span>
          <span onClick={onCancel} style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</span>
        </div>

        {/* Name */}
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
          Role Name *
        </label>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="e.g. app-server"
          style={{
            width: "100%", padding: "7px 10px", borderRadius: 6,
            border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
            background: "var(--bg-surface)", color: "var(--text-primary)",
            fontSize: 13, outline: "none", boxSizing: "border-box",
          }}
        />
        {error && <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span>}

        {/* Color */}
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginTop: 14, marginBottom: 4 }}>
          Color
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: color, flexShrink: 0 }} />
          <ColorPicker value={color} onChange={setColor} />
        </div>

        {/* Policies */}
        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginTop: 14, marginBottom: 4 }}>
          Policies
          <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 6 }}>
            ({policies.length} selected)
          </span>
        </label>
        <PolicySelector selected={policies} onChange={setPolicies} />

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: "transparent", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: 6,
              padding: "7px 16px", cursor: "pointer", fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: "var(--accent)", color: "white",
              border: "none", borderRadius: 6,
              padding: "7px 16px", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            {role ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoleManager({ roles, onRolesChange, nodes = [], onAssignRole }) {
  const [editing, setEditing]     = useState(null);
  const [creating, setCreating]   = useState(false);
  const [assigning, setAssigning] = useState(null); // role being assigned

  const ec2Nodes = nodes.filter((n) => n.data?.resourceType === "EC2");

  const handleAssign = (roleId, nodeId, checked) => {
    if (onAssignRole) onAssignRole(nodeId, checked ? roleId : "");
  };

  const handleCreate = (data) => {
    const newRole = { id: `role_${Date.now()}`, ...data };
    onRolesChange([...roles, newRole]);
    setCreating(false);
  };

  const handleEdit = (data) => {
    onRolesChange(roles.map((r) => r.id === editing.id ? { ...r, ...data } : r));
    setEditing(null);
  };

  const handleDelete = (roleId) => {
    nodes
      .filter((n) => n.data?.config?.iam_role_id === roleId)
      .forEach((n) => onAssignRole(n.id, ""));
    onRolesChange(roles.filter((r) => r.id !== roleId));
  };

  return (
    <div>
      {/* Section header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 8,
      }}>
        <span style={{
          ...MONO, fontSize: 11, fontWeight: 700,
          color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase",
        }}>
          IAM Roles
        </span>
        <button
          onClick={() => setCreating(true)}
          style={{
            background: "transparent", border: "1px solid var(--accent)",
            color: "var(--accent)", borderRadius: 5,
            padding: "2px 10px", cursor: "pointer",
            fontSize: 11, fontWeight: 600,
          }}
        >
          + New
        </button>
      </div>

      {/* Role list */}
      {roles.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "6px 0" }}>
          No roles defined — create one to assign to EC2 nodes
        </div>
      ) : (
        roles.map((role) => (
          <div key={role.id}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 6, marginBottom: 4,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {/* Color swatch */}
            <div style={{
              width: 12, height: 12, borderRadius: 3,
              background: role.color, flexShrink: 0,
            }} />
            {/* Name + policy count */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...MONO, fontSize: 12, color: "var(--text-primary)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {role.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {role.policies.length} {role.policies.length === 1 ? "policy" : "policies"}
              </div>
            </div>
            {/* Assign / Edit / Delete */}
            <span
              onClick={() => setAssigning(assigning?.id === role.id ? null : role)}
              style={{ fontSize: 11, color: assigning?.id === role.id ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer", userSelect: "none" }}
            >
              assign
            </span>
            <span
              onClick={() => setEditing(role)}
              style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", userSelect: "none" }}
            >
              edit
            </span>
            <span
              onClick={() => handleDelete(role.id)}
              style={{ fontSize: 11, color: "var(--danger)", cursor: "pointer", userSelect: "none" }}
            >
              ✕
            </span>
          </div>

          {/* Assignment panel — EC2 node list */}
          {assigning?.id === role.id && (
            <div style={{
              margin: "4px 0 8px 0", padding: "8px 10px",
              background: "var(--bg-surface)", borderRadius: 6,
              border: "1px solid var(--border)",
            }}>
              {ec2Nodes.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>No EC2 nodes on canvas</div>
              ) : (
                ec2Nodes.map((node) => {
                  const assigned = node.data?.config?.iam_role_id === role.id;
                  const otherRole = roles.find((r) => r.id === node.data?.config?.iam_role_id && r.id !== role.id);
                  return (
                    <div
                      key={node.id}
                      onClick={() => handleAssign(role.id, node.id, !assigned)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "5px 4px", cursor: "pointer", borderRadius: 4,
                        background: assigned ? `${role.color}18` : "transparent",
                      }}
                    >
                      <div style={{
                        width: 13, height: 13, borderRadius: 3, flexShrink: 0,
                        border: `2px solid ${assigned ? role.color : "var(--border)"}`,
                        background: assigned ? role.color : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 9, color: "white",
                      }}>
                        {assigned ? "✓" : ""}
                      </div>
                      <span style={{ fontSize: 12, color: "var(--text-primary)", flex: 1 }}>
                        {node.data.label}
                      </span>
                      {otherRole && (
                        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          has: {otherRole.name}
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

      {/* Modals */}
      {creating && (
        <RoleEditor
          existingRoles={roles}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {editing && (
        <RoleEditor
          role={editing}
          existingRoles={roles}
          onSave={handleEdit}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}