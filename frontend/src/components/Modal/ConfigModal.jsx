import { useState, useEffect } from "react";
import { resourceFields } from "../../config/resourceConfig";

function RouteListField({ value, onChange, canvasNodes }) {
  const gatewayNodes = canvasNodes.filter((n) =>
    ["IGW", "NATGateway"].includes(n.data?.resourceType)
  );

  const addRoute = () =>
    onChange([...value, { destination: "", target: gatewayNodes[0]?.id || "" }]);

  const removeRoute = (i) =>
    onChange(value.filter((_, idx) => idx !== i));

  const updateRoute = (i, field, val) =>
    onChange(value.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  return (
    <div>
      {value.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>No routes defined</div>
      )}
      {value.map((route, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input
            type="text"
            placeholder="0.0.0.0/0"
            value={route.destination}
            onChange={(e) => updateRoute(i, "destination", e.target.value)}
            style={{ ...routeInputStyle, flex: 1 }}
          />
          <select
            value={route.target}
            onChange={(e) => updateRoute(i, "target", e.target.value)}
            style={{ ...routeInputStyle, flex: 1 }}
          >
            {gatewayNodes.length === 0 && (
              <option value="">No gateways on canvas</option>
            )}
            {gatewayNodes.map((n) => (
              <option key={n.id} value={n.id}>{n.data.label}</option>
            ))}
          </select>
          <span
            onClick={() => removeRoute(i)}
            style={{ cursor: "pointer", color: "var(--danger)", fontSize: 16, lineHeight: 1 }}
          >✕</span>
        </div>
      ))}
      <button
        onClick={addRoute}
        style={{
          background: "transparent", border: "1px dashed var(--border)",
          borderRadius: 6, padding: "5px 10px",
          color: "var(--text-secondary)", fontSize: 12,
          cursor: "pointer", width: "100%", marginTop: 2,
        }}
      >
        + Add Route
      </button>
    </div>
  );
}

const routeInputStyle = {
  padding: "5px 8px", borderRadius: 6,
  border: "1px solid var(--border)", fontSize: 12,
  background: "var(--bg-surface)", color: "var(--text-primary)",
  outline: "none", boxSizing: "border-box",
};

export default function ConfigModal({
  resourceType,
  existingConfig = {},
  canvasNodes = [],
  editingNodeId = null,
  region = "us-east-1",
  roles = [],
  onSave,
  onCancel,
}) {
  const fields = resourceFields[resourceType] || [];

  const getParentOptions = (parentType) =>
    canvasNodes.filter((n) => n.data?.resourceType === parentType);

  const buildInitial = () =>
    fields.reduce((acc, f) => {
      if (existingConfig[f.key] !== undefined) {
        acc[f.key] = existingConfig[f.key];
      } else if (f.type === "iam-role-select") {
        acc[f.key] = "";
      } else if (f.type === "multi-select") {
        acc[f.key] = existingConfig[f.key] !== undefined ? existingConfig[f.key] : [];
      } else if (f.type === "select") {
        const opts = f.getOptions ? f.getOptions(canvasNodes, {}, region) : (f.options || []);
        acc[f.key] = existingConfig[f.key] !== undefined ? existingConfig[f.key] : (opts[0] || "");
      } else if (f.type === "dependent-select") {
        const firstKey = Object.keys(f.optionsMap)[0];
        acc[f.key] = f.optionsMap[firstKey]?.[0] || "";
      } else if (f.type === "parent-select") {
        const parents = getParentOptions(f.parentType);
        acc[f.key] = parents.length > 0 ? parents[0].id : "";
      } else {
        acc[f.key] = "";
      }
      return acc;
    }, {});

  const [form, setForm] = useState(buildInitial);
  const [errors, setErrors] = useState({});

  // Reset dependent-select fields when their dependency changes
  useEffect(() => {
    const dependentFields = fields.filter((f) => f.type === "dependent-select");
    if (dependentFields.length === 0) return;
    setForm((prev) => {
      const updated = { ...prev };
      dependentFields.forEach((f) => {
        const depValue = prev[f.dependsOn];
        const validOptions = f.optionsMap[depValue] || [];
        if (!validOptions.includes(prev[f.key])) {
          updated[f.key] = validOptions[0] || "";
        }
      });
      return updated;
    });
  }, [fields.map((f) => f.type === "dependent-select" ? form[f.dependsOn] : null).join(",")]);

  useEffect(() => {
    setForm(buildInitial());
    setErrors({});
  }, [resourceType]);

  const validate = () => {
    const newErrors = {};
    fields.forEach((f) => {
      // Skip validation for hidden fields
      if (f.visibleWhen && !f.visibleWhen(form)) return;
      const value = form[f.key] ?? "";
      const isEmpty = f.type === "password"
        ? !value
        : f.type === "multi-select"
        ? !Array.isArray(value) || value.length === 0
        : !value?.toString().trim();
      if (f.required && isEmpty) {
        newErrors[f.key] = `${f.label} is required`;
      } else if (f.validate && !isEmpty) {
        const err = f.validate(value, form, canvasNodes, editingNodeId);
        if (err) newErrors[f.key] = err;
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(form);
  };

  const isEditing = !!editingNodeId;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 10, padding: 24,
        minWidth: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", border: "1px solid var(--border)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>
            {isEditing ? `Edit ${resourceType}` : `Configure ${resourceType}`}
          </h3>
          <span onClick={onCancel} style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</span>
        </div>

        {/* ID chip — only shown when editing */}
        {isEditing && (
          <div style={{
            background: "var(--bg-surface)", borderRadius: 6,
            padding: "6px 10px", marginBottom: 16,
            border: "1px solid var(--border-subtle)",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              ID
            </span>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>
              {editingNodeId}
            </span>
          </div>
        )}

        {/* Fields */}
        {fields.map((f) => {
          // visibleWhen — skip field if condition not met
          if (f.visibleWhen && !f.visibleWhen(form)) return null;

          const parentOptions = f.type === "parent-select" ? getParentOptions(f.parentType) : [];

          return (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4, color: "var(--text-secondary)" }}>
                {f.label} {f.required && <span style={{ color: "var(--danger)" }}>*</span>}
              </label>

              {f.type === "parent-select" ? (
                <select
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={inputStyle}
                >
                  {parentOptions.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.data.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "select" ? (
                <select
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={inputStyle}
                >
                  {(f.getOptions ? f.getOptions(canvasNodes, form, region) : (f.options || [])).map((opt) => (
                    <option key={opt} value={opt}>
                      {f.optionLabels?.[opt] || opt}
                    </option>
                  ))}
                </select>
              ) : f.type === "dependent-select" ? (
                <select
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={inputStyle}
                >
                  {(f.optionsMap[form[f.dependsOn]] || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.type === "password" ? (
                <input
                  type="password"
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ ...inputStyle, borderColor: errors[f.key] ? "var(--danger)" : "var(--border)" }}
                />
              ) : f.type === "multi-select" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {(f.getOptions
                    ? f.getOptions(canvasNodes, form, region)
                    : f.parentType
                    ? canvasNodes.filter((n) => n.data?.resourceType === f.parentType)
                        .map((n) => ({ value: n.id, label: n.data.label }))
                    : (f.options || []).map((o) => ({ value: o, label: o }))
                  ).map((opt) => {
                    const val = typeof opt === "string" ? opt : opt.value;
                    const lbl = typeof opt === "string" ? opt : opt.label;
                    const selected = (form[f.key] || []).includes(val);
                    return (
                      <div
                        key={val}
                        onClick={() => {
                          const current = form[f.key] || [];
                          const next = selected
                            ? current.filter((v) => v !== val)
                            : [...current, val];
                          setForm({ ...form, [f.key]: next });
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "6px 10px", borderRadius: 6, cursor: "pointer",
                          background: selected ? "var(--accent)22" : "var(--bg-surface)",
                          border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                          fontSize: 12, color: selected ? "var(--accent)" : "var(--text-secondary)",
                          userSelect: "none",
                        }}
                      >
                        <span style={{
                          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                          border: `2px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                          background: selected ? "var(--accent)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, color: "white",
                        }}>
                          {selected ? "✓" : ""}
                        </span>
                        {lbl}
                      </div>
                    );
                  })}
                  {f.minItems && (form[f.key] || []).length < f.minItems && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Select at least {f.minItems}
                    </span>
                  )}
                </div>
              ) : f.type === "iam-role-select" ? (
                <div>
                  <select
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    style={{
                      width: "100%", padding: "7px 10px",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6, fontSize: 13,
                      color: form[f.key] ? "var(--text-primary)" : "var(--text-muted)",
                      cursor: "pointer", outline: "none",
                    }}
                  >
                    <option value="">None</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} ({role.policies.length} {role.policies.length === 1 ? "policy" : "policies"})
                      </option>
                    ))}
                  </select>
                  {roles.length === 0 && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                      No roles defined — create one in the Configure tab
                    </div>
                  )}
                </div>
              ) : f.type === "route-list" ? (
                <RouteListField
                  value={form[f.key] || []}
                  onChange={(routes) => setForm({ ...form, [f.key]: routes })}
                  canvasNodes={canvasNodes}
                />
              ) : (
                <input
                  type="text"
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ ...inputStyle, borderColor: errors[f.key] ? "var(--danger)" : "var(--border)" }}
                />
              )}

              {errors[f.key] && (
                <span style={{ fontSize: 11, color: "var(--danger)" }}>{errors[f.key]}</span>
              )}
            </div>
          );
        })}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
          <button onClick={handleSave} style={saveBtnStyle}>
            {isEditing ? "Save Changes" : "Place Node"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "7px 10px",
  borderRadius: 6, border: "1px solid var(--border)",
  fontSize: 13, boxSizing: "border-box", outline: "none",
  background: "var(--bg-surface)", color: "var(--text-primary)",
};

const saveBtnStyle = {
  background: "var(--accent)", color: "white",
  border: "none", borderRadius: 6,
  padding: "8px 18px", cursor: "pointer", fontWeight: 500,
};

const cancelBtnStyle = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border)", borderRadius: 6,
  padding: "8px 18px", cursor: "pointer",
};