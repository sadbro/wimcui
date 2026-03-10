import { BaseEdge, getBezierPath } from "reactflow";

export default function StructuralEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, markerEnd,
}) {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: "#aaa",
        strokeWidth: 2,
        strokeDasharray: "6 3",
      }}
    />
  );
}