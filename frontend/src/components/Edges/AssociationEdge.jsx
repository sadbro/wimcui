import { BaseEdge, getBezierPath, EdgeLabelRenderer } from "reactflow";

export default function AssociationEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected, data,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.3,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "var(--accent)" : "#6b7a99",
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: "4 3",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: "var(--bg-elevated)",
            border: "1px solid #6b7a99",
            borderRadius: 3,
            padding: "1px 6px",
            fontSize: 10,
            color: "#6b7a99",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
          className="nodrag nopan"
        >
          {data?.label || "assoc"}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}