import { Handle, Position, useReactFlow } from "reactflow";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";

export default function VpcNode({ id, data, selected }) {
  const { deleteElements } = useReactFlow();

  return (
    <div style={{
      background: "rgba(255, 249, 230, 0.85)",
      border: `2px solid ${selected ? "#d48806" : "#ffd666"}`,
      borderRadius: 10,
      position: "relative",
      minWidth: 200,
      minHeight: 150,
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
    }}>
      <NodeResizer isVisible={selected} minWidth={200} minHeight={150} color="#d48806" />

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

      {/* Label at top-left */}
      <div style={{
        position: "absolute", top: 8, left: 12,
        fontSize: 12, fontWeight: 700,
        color: "#d48806", letterSpacing: 0.3,
        pointerEvents: "none", userSelect: "none",
      }}>
        VPC — {data.label}
      </div>

      {/* CIDR badge */}
      {data.config?.cidr && (
        <div style={{
          position: "absolute", top: 8, right: 28,
          fontSize: 10, color: "#ad8b00",
          background: "rgba(255,214,102,0.3)",
          borderRadius: 4, padding: "1px 6px",
          fontFamily: "monospace",
          pointerEvents: "none",
        }}>
          {data.config.cidr}
        </div>
      )}

      <Handle id="top"    type="target" position={Position.Top}    />
      <Handle id="bottom" type="source" position={Position.Bottom} />
    </div>
  );
}