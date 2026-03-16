/**
 * SGAutoCreateModal — fires after importing a canvas that has sgCapable nodes
 * with traffic edges but no Security Groups assigned.
 *
 * Offers to auto-create one named SG per affected node.
 * User can accept (auto-create + assign) or skip (consequence rules handle it passively).
 */

const MONO = { fontFamily: "'JetBrains Mono', monospace" };

const SG_COLOR_PALETTE = [
  "#f97316", "#06b6d4", "#84cc16", "#ec4899",
  "#8b5cf6", "#14b8a6", "#f59e0b", "#6366f1",
];

export default function SGAutoCreateModal({ missingNodes, onAutoCreate, onSkip }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 2000,
    }}>
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 10,
        width: 420, maxWidth: "90vw",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
        maxHeight: "80vh",
      }}>
        {/* Header */}
        <div style={{ padding: "18px 24px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: "rgba(249,115,22,0.15)",
              border: "1px solid #f97316",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, flexShrink: 0,
            }}>
              🛡
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Security Groups Missing
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {missingNodes.length} node{missingNodes.length !== 1 ? "s" : ""} with traffic rules but no Security Group assigned
          </div>
        </div>

        {/* Node list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 24px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
            Auto-create will generate one Security Group per node, named after the node.
            Edge-derived rules are added automatically — you can edit or rename them later.
          </div>
          {missingNodes.map((node, i) => {
            const sgName = `${node.data.label.replace(/\./g, "-")}-sg`;
            const color  = SG_COLOR_PALETTE[i % SG_COLOR_PALETTE.length];
            return (
              <div
                key={node.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 6, marginBottom: 4,
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 600 }}>
                    {node.data.label}
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 6 }}>
                      ({node.data.resourceType})
                    </span>
                  </div>
                  <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    → {sgName}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 24px", borderTop: "1px solid var(--border)", flexShrink: 0,
        }}>
          <button
            onClick={onSkip}
            style={{
              background: "transparent", color: "var(--text-secondary)",
              border: "1px solid var(--border)", borderRadius: 6,
              padding: "7px 16px", cursor: "pointer", fontSize: 13,
            }}
          >
            Skip
          </button>
          <button
            onClick={() => onAutoCreate(missingNodes)}
            style={{
              background: "var(--accent)", color: "white",
              border: "none", borderRadius: 6,
              padding: "7px 18px", cursor: "pointer",
              fontSize: 13, fontWeight: 600,
            }}
          >
            Auto-create {missingNodes.length} SG{missingNodes.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}