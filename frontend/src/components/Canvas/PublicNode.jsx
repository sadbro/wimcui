import { Handle, Position, useReactFlow } from "reactflow";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";

export default function PublicNode({ id, selected }) {
  const { deleteElements } = useReactFlow();
  return (
    <div style={{
      background: "rgba(77,107,254,0.12)",
      border: `2px solid ${selected ? "var(--accent-hover)" : "var(--accent)"}`,
      borderRadius: 8, padding: "10px 16px",
      position: "relative", minWidth: 100, minHeight: 40,
      width: "100%", height: "100%",
      textAlign: "center", display: "flex",
      alignItems: "center", justifyContent: "center",
      boxSizing: "border-box",
      fontWeight: 600, fontSize: 13,
      color: "var(--accent)", gap: 6,
      boxShadow: selected ? "0 0 0 2px rgba(77,107,254,0.3)" : "none",
    }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={40} color="var(--accent)" />
      <div
        onClick={() => deleteElements({ nodes: [{ id }] })}
        style={{
          position: "absolute", top: -8, right: -8,
          width: 18, height: 18,
          background: "var(--danger)", color: "white",
          borderRadius: "50%", fontSize: 11,
          cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontWeight: "bold", zIndex: 10,
        }}
      >
        ✕
      </div>
      <Handle id="top"    type="target" position={Position.Top}    />
      <Handle id="bottom" type="source" position={Position.Bottom} />
      Public / Internet
    </div>
  );
}