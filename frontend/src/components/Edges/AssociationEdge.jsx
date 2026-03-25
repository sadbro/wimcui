import { BaseEdge, getBezierPath, EdgeLabelRenderer, useNodes } from "reactflow";
import { useCanvasFilter, useSecurityOverlay } from "../../config/canvasFilterContext";
import { getEdgeOpacity, getSecurityEdgeOpacity } from "../../config/canvasLayers";

export default function AssociationEdge({
  id, source, target, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, selected, data,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.3,
  });

  const filter = useCanvasFilter();
  const secOverlay = useSecurityOverlay();
  const allNodes = useNodes();
  const nodeById = (nid) => allNodes.find((n) => n.id === nid);
  const opacity = secOverlay ? getSecurityEdgeOpacity("association") : getEdgeOpacity({ source, target }, nodeById, filter);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "var(--accent)" : "#6b7a99",
          strokeWidth: selected ? 2 : 1.5,
          strokeDasharray: "4 3",
          opacity,
          transition: "opacity 0.2s ease",
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
            opacity,
            transition: "opacity 0.2s ease",
          }}
          className="nodrag nopan"
        >
          {data?.label || "assoc"}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}