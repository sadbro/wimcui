import { BaseEdge, getBezierPath, EdgeLabelRenderer } from "reactflow";

const INGRESS_COLOR = "#52c41a"; // green
const EGRESS_COLOR  = "#ff4d4f"; // red
const EDGE_COLOR    = "#646cff"; // blue

export default function TrafficEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    curvature: 0.4,
  });

  const ingress = data?.ingress || [];
  const egress  = data?.egress  || [];

  const hasIngress = ingress.length > 0;
  const hasEgress  = egress.length  > 0;

  // Build SVG marker ids unique per edge to avoid conflicts
  const ingressMarkerId = `ingress-arrow-${id}`;
  const egressMarkerId  = `egress-arrow-${id}`;
  const blueMarkerId    = `blue-arrow-${id}`;

  // Determine which markers to put at each end
  // markerEnd = target end (ingress arrow — green)
  // markerStart = source end (egress arrow — red)
  const markerEnd   = hasIngress ? `url(#${ingressMarkerId})` : undefined;
  const markerStart = hasEgress  ? `url(#${egressMarkerId})`  : undefined;

  // If only one direction, use blue for that arrow
  // const singleIngressMarker = !hasEgress && hasIngress ? `url(#${blueMarkerId})` : markerEnd;
  // const singleEgressMarker  = !hasIngress && hasEgress ? `url(#${blueMarkerId})` : markerStart;

  const finalMarkerEnd   = !hasEgress && hasIngress ? `url(#${blueMarkerId})` : markerEnd;
  const finalMarkerStart = !hasIngress && hasEgress ? `url(#${blueMarkerId})` : markerStart;

  const strokeColor = selected ? "#4338ca" : EDGE_COLOR;

  return (
    <>
      {/* SVG marker definitions */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <marker id={ingressMarkerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={INGRESS_COLOR} />
          </marker>
          <marker id={egressMarkerId} markerWidth="10" markerHeight="7" refX="5" refY="3.5" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" fill={EGRESS_COLOR} />
          </marker>
          <marker id={blueMarkerId} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
          </marker>
        </defs>
      </svg>

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: selected ? 2.5 : 2,
        }}
        markerEnd={finalMarkerEnd}
        markerStart={finalMarkerStart}
      />

      {/* Label */}
      {(hasIngress || hasEgress) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: "white",
              border: `1px solid ${strokeColor}`,
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 11,
              fontWeight: 700,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            className="nodrag nopan"
          >
            {hasIngress && (
              <span style={{ color: hasEgress ? INGRESS_COLOR : strokeColor }}>
                {ingress.length}
              </span>
            )}
            {hasIngress && hasEgress && (
              <span style={{ color: "#ccc" }}>/</span>
            )}
            {hasEgress && (
              <span style={{ color: hasIngress ? EGRESS_COLOR : strokeColor }}>
                {egress.length}
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}