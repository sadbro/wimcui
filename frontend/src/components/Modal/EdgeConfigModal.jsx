import { useState } from "react";

const PROTOCOLS = ["TCP", "UDP", "ICMP", "HTTP", "HTTPS", "ANY"];
const INGRESS_COLOR = "#52c41a";
const EGRESS_COLOR  = "#ff4d4f";

function RuleRow({ rule, index, onChange, onDelete }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
      <input
        type="text"
        value={rule.port}
        placeholder="Port"
        onChange={(e) => onChange(index, { ...rule, port: e.target.value })}
        style={{ ...inputStyle, flex: 1 }}
      />
      <select
        value={rule.protocol}
        onChange={(e) => onChange(index, { ...rule, protocol: e.target.value })}
        style={{ ...inputStyle, flex: 1 }}
      >
        {PROTOCOLS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <div
        onClick={() => onDelete(index)}
        style={{
          width: 24, height: 24, borderRadius: "50%",
          background: "#ff4d4f", color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 13, fontWeight: "bold", flexShrink: 0,
        }}
      >
        ✕
      </div>
    </div>
  );
}

function RuleSection({ title, color, rules, onChange, onAdd, onDelete, errors }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", minWidth: 60 }}>PORT</div>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text-muted)", minWidth: 80 }}>PROTOCOL</div>
          <div style={{ width: 24 }} />
        </div>
      </div>

      {/* Rules */}
      <div style={{ maxHeight: 150, overflowY: "auto" }}>
        {rules.map((rule, i) => (
          <div key={i}>
            <RuleRow rule={rule} index={i} onChange={onChange} onDelete={onDelete} />
            {errors[i] && (
              <div style={{ fontSize: 11, color: "#ff4d4f", marginTop: -4, marginBottom: 6 }}>
                {errors[i]}
              </div>
            )}
          </div>
        ))}
        {rules.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
            No rules
          </div>
        )}
      </div>

      <button onClick={onAdd} style={{ ...addRuleBtnStyle, borderColor: color, color }}>
        + Add Rule
      </button>
    </div>
  );
}

export default function EdgeConfigModal({
  edgeId = null,
  existingIngress = [], existingEgress = [],
  sourceLabel, targetLabel,
  onSave, onDelete, onCancel
}) {
  const isEditing = existingIngress.length > 0 || existingEgress.length > 0;

  const [ingress, setIngress] = useState(
    isEditing ? existingIngress : [{ port: "", protocol: "TCP" }]
  );
  const [egress, setEgress] = useState(existingEgress);
  const [ingressErrors, setIngressErrors] = useState([]);
  const [egressErrors, setEgressErrors] = useState([]);

  const validateSection = (rules) =>
    rules.map((r) => (!r.port.trim() ? "Port required" : null));

  const handleSave = () => {
    const iErr = validateSection(ingress);
    const eErr = validateSection(egress);
    setIngressErrors(iErr);
    setEgressErrors(eErr);

    const valid = [...iErr, ...eErr].every((e) => e === null);
    if (!valid) return;
    if (ingress.length === 0 && egress.length === 0) return;

    onSave({ ingress, egress });
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 10, padding: 24,
        minWidth: 400, maxWidth: 460,
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)", border: "1px solid var(--border)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>
            {isEditing ? "Edit Connection" : "Configure Connection"}
          </h3>
          <span onClick={onCancel} style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>✕</span>
        </div>

        {/* Direction + ID */}
        <div style={{
          background: "var(--bg-surface)", borderRadius: 6,
          padding: "8px 12px", marginBottom: 16,
          border: "1px solid var(--border-subtle)",
          fontSize: 13, display: "flex", flexDirection: "column", gap: 6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sourceLabel}</span>
            <span style={{ color: "#646cff", fontSize: 16 }}>↔</span>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{targetLabel}</span>
          </div>
          {edgeId && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>ID</span>
              <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{edgeId}</span>
            </div>
          )}
        </div>

        {/* Ingress section */}
        <RuleSection
          title="Ingress"
          color={INGRESS_COLOR}
          rules={ingress}
          errors={ingressErrors}
          onChange={(i, updated) => setIngress((r) => r.map((rule, idx) => idx === i ? updated : rule))}
          onAdd={() => setIngress((r) => [...r, { port: "", protocol: "TCP" }])}
          onDelete={(i) => setIngress((r) => r.filter((_, idx) => idx !== i))}
        />

        <div style={{ borderTop: "1px solid var(--border)", marginBottom: 16 }} />

        {/* Egress section */}
        <RuleSection
          title="Egress"
          color={EGRESS_COLOR}
          rules={egress}
          errors={egressErrors}
          onChange={(i, updated) => setEgress((r) => r.map((rule, idx) => idx === i ? updated : rule))}
          onAdd={() => setEgress((r) => [...r, { port: "", protocol: "TCP" }])}
          onDelete={(i) => setEgress((r) => r.filter((_, idx) => idx !== i))}
        />

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div>
            {isEditing && onDelete && (
              <button onClick={onDelete} style={deleteBtnStyle}>Delete Connection</button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={ingress.length === 0 && egress.length === 0}
              style={{
                ...saveBtnStyle,
                opacity: ingress.length === 0 && egress.length === 0 ? 0.5 : 1,
                cursor: ingress.length === 0 && egress.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {isEditing ? "Save Changes" : "Create Connection"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: "6px 10px", borderRadius: 6,
  border: "1px solid var(--border)", fontSize: 13,
  boxSizing: "border-box", outline: "none", width: "100%",
  background: "var(--bg-surface)", color: "var(--text-primary)",
};

const addRuleBtnStyle = {
  width: "100%", padding: "6px 0", marginTop: 6,
  background: "transparent",
  border: "1px dashed", borderRadius: 6,
  cursor: "pointer", fontSize: 12, fontWeight: 500,
};

const saveBtnStyle = {
  background: "var(--accent)", color: "white",
  border: "none", borderRadius: 6,
  padding: "8px 18px", fontWeight: 500,
};

const cancelBtnStyle = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border)", borderRadius: 6,
  padding: "8px 18px", cursor: "pointer",
};

const deleteBtnStyle = {
  background: "transparent", color: "var(--danger)",
  border: "1px solid var(--danger)", borderRadius: 6,
  padding: "8px 14px", cursor: "pointer", fontWeight: 500,
};