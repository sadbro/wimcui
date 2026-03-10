import { Handle, Position, useReactFlow } from "reactflow";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";

const VISIBILITY_STYLES = {
  Public:  { bg: "rgba(246,255,237,0.7)", border: "#95de64", label: "#389e0d" },
  Private: { bg: "rgba(255,247,230,0.7)", border: "#ffc069", label: "#d46b08" },
};

export default function SubnetNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow();
  const visibility = data.config?.visibility || "Public";
  const styles = VISIBILITY_STYLES[visibility] || VISIBILITY_STYLES.Public;

  return (
    <div style={{
      background: styles.bg,
      border: `2px ${selected ? "solid " + styles.border : "dashed " + styles.border}`,
      borderRadius: 8,
      position: "relative",
      minWidth: 150,
      minHeight: 100,
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
    }}>
      <NodeResizer isVisible={selected} minWidth={150} minHeight={100} color={styles.border} />

      {/* Label top-left */}
      <div style={{
        position: "absolute", top: 6, left: 10,
        fontSize: 11, fontWeight: 700,
        color: styles.label, letterSpacing: 0.3,
        pointerEvents: "none", userSelect: "none",
      }}>
        {visibility} · {data.config?.name || data.label}
      </div>

      {/* CIDR badge */}
      {data.config?.cidr && (
        <div style={{
          position: "absolute", top: 6, right: 28,
          fontSize: 10, color: styles.label,
          background: "rgba(0,0,0,0.05)",
          padding: "2px 6px", borderRadius: 4,
          pointerEvents: "none", userSelect: "none",
        }}>
          {data.config.cidr}
        </div>
      )}

      {/* Delete button */}
      <div
        onClick={() => deleteElements({ nodes: [{ id }] })}
        style={{
          position: "absolute", top: -8, right: -8,
          width: 18, height: 18,
          background: "#ff4d4f", color: "white",
          borderRadius: "50%", fontSize: 11,
          cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontWeight: "bold", zIndex: 10,
        }}
      >
        ✕
      </div>

      {/* Structural handles */}
      <Handle id="top"    type="target" position={Position.Top}    style={{ opacity: 0 }} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}