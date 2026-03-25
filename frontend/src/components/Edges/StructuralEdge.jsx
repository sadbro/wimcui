import { BaseEdge, getBezierPath, useNodes } from "reactflow";
import { useCanvasFilter, useSecurityOverlay } from "../../config/canvasFilterContext";
import { getEdgeOpacity, getSecurityEdgeOpacity } from "../../config/canvasLayers";

export default function StructuralEdge({
  id, source, target, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, markerEnd,
}) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const filter = useCanvasFilter();
  const secOverlay = useSecurityOverlay();
  const nodes = useNodes();
  const nodeById = (nid) => nodes.find((n) => n.id === nid);
  const opacity = secOverlay ? getSecurityEdgeOpacity("structural") : getEdgeOpacity({ source, target }, nodeById, filter);

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: "#aaa",
        strokeWidth: 2,
        strokeDasharray: "6 3",
        opacity,
        transition: "opacity 0.2s ease",
      }}
    />
  );
}