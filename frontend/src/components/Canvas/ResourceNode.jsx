import { Handle, Position } from "reactflow";
import { useContext } from "react";
import { RolesContext } from "../../config/rolesContext";
import { SecurityGroupsContext } from "../../config/securityGroupsContext";
import { useCanvasFilter, useSecurityOverlay } from "../../config/canvasFilterContext";
import { isNodeInLayer, getSecurityNodeStyle } from "../../config/canvasLayers";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";
import { resourceColor, resourceLabel } from "../../config/resourceRegistry";

export default function ResourceNode({ id, data, selected }) {
  const resourceType = data?.resourceType;
  const colors = { border: resourceColor(resourceType) };
  const roles = useContext(RolesContext);
  const securityGroups = useContext(SecurityGroupsContext);
  const canvasFilter = useCanvasFilter();
  const secOverlay = useSecurityOverlay();
  const dimmed = !secOverlay && !isNodeInLayer({ data }, canvasFilter);
  const secStyle = secOverlay ? getSecurityNodeStyle({ data }, securityGroups) : null;
  const assignedRoleId = data?.config?.iam_role_id;
  const assignedSGIds  = data?.config?.sg_ids || [];
  const assignedSGs    = assignedSGIds.map((id) => securityGroups.find((s) => s.id === id)).filter(Boolean);
  const assignedRole = assignedRoleId ? roles.find((r) => r.id === assignedRoleId) : null;
  const borderColor = secStyle?.borderColor || (selected ? "var(--accent)" : colors.border);

  // Type chip label — Subnet folds visibility into the chip
  const visibility = data?.config?.visibility;
  const typeChip = resourceType === "Subnet"
    ? `${visibility === "Public" ? "🌐" : "🔒"} Subnet`
    : resourceLabel(resourceType);

  // Show the user label only if it's been set (differs from bare type)
  const userLabel = data.label && data.label !== resourceType ? data.label : null;

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: `1px solid ${borderColor}`,
      borderRadius: 6, padding: "8px 12px",
      position: "relative", minWidth: 100, minHeight: 52,
      width: "100%", height: "100%",
      textAlign: "center", display: "flex",
      alignItems: "center", justifyContent: "center",
      boxSizing: "border-box",
      color: "var(--text-primary)",
      boxShadow: secStyle?.boxShadow || (selected ? `0 0 0 2px ${colors.border}44` : "none"),
      opacity: secStyle ? secStyle.opacity : (dimmed ? 0.15 : 1),
      transition: "opacity 0.2s ease, box-shadow 0.2s ease",
    }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={52} color={colors.border} />
      <div
        onClick={() => data.onDelete && data.onDelete(id)}
        style={{
          position: "absolute", top: -8, right: -8,
          width: 18, height: 18,
          background: "var(--danger)", color: "white",
          borderRadius: "50%", fontSize: 11,
          cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          fontWeight: "bold", lineHeight: 1, zIndex: 10,
        }}
      >
        ✕
      </div>
      <Handle id="top"    type="target" position={Position.Top}    />
      <Handle id="bottom" type="source" position={Position.Bottom} />
      {/* SG stripes — right edge, one per assigned SG stacked */}
      {assignedSGs.map((sg, i) => (
        <div
          key={sg.id}
          style={{
            position: "absolute", top: 0, bottom: 0,
            right: i * (secOverlay ? 7 : 5),
            width: secOverlay ? 6 : 4, borderRadius: "0 6px 6px 0",
            background: sg.color,
            zIndex: 1,
            transition: "width 0.2s ease, right 0.2s ease",
          }}
          title={`SG: ${sg.name}`}
        />
      ))}
      {/* IAM Role stripe */}
      {assignedRole && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 4, borderRadius: "6px 0 0 6px",
          background: assignedRole.color,
          zIndex: 1,
        }}
        title={`IAM Role: ${assignedRole.name}`}
        />
      )}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 3, width: "100%", overflow: "hidden",
      }}>
        <span style={{
          fontSize: 10, lineHeight: 1.2,
          opacity: userLabel ? 0.38 : 0.7,
          letterSpacing: "0.03em",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          maxWidth: "100%", userSelect: "none",
        }}>
          {typeChip}
        </span>
        {userLabel && (
          <span style={{
            fontSize: 13, fontWeight: 500, lineHeight: 1.3,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            maxWidth: "100%",
          }}>
            {userLabel}
          </span>
        )}
      </div>
    </div>
  );
}