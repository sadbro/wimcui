import { Handle, Position } from "reactflow";
import { useContext } from "react";
import { RolesContext } from "../../config/rolesContext";
import { NodeResizer } from "@reactflow/node-resizer";
import "@reactflow/node-resizer/dist/style.css";

const RESOURCE_COLORS = {
  VPC:          { border: "#4d6bfe" },
  Subnet:       { border: "#4d9ffe" },
  EC2:          { border: "#8892aa" },
  RDS:          { border: "#8892aa" },
  LoadBalancer: { border: "#8892aa" },
  IGW:          { border: "#52c41a" },
  NATGateway:   { border: "#fa8c16" },
  RouteTable:   { border: "#722ed1" },
};

export default function ResourceNode({ id, data, selected }) {
  const resourceType = data?.resourceType;
  const colors = RESOURCE_COLORS[resourceType] || { border: "var(--border)" };
  const roles = useContext(RolesContext);
  const assignedRoleId = data?.config?.iam_role_id;
  const assignedRole = assignedRoleId ? roles.find((r) => r.id === assignedRoleId) : null;
  const borderColor = selected ? "var(--accent)" : colors.border;

  // Public/private icon for Subnet; globe for IGW
  let visibilityIcon = null;
  if (resourceType === "Subnet") {
    const visibility = data?.config?.visibility;
    visibilityIcon = visibility === "Public" ? "🌐" : "🔒";
  } else if (resourceType === "IGW") {
    visibilityIcon = "🌐";
  }

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: `1px solid ${borderColor}`,
      borderRadius: 6, padding: "8px 12px",
      position: "relative", minWidth: 100, minHeight: 40,
      width: "100%", height: "100%",
      textAlign: "center", display: "flex",
      alignItems: "center", justifyContent: "center",
      boxSizing: "border-box",
      color: "var(--text-primary)", fontSize: 13,
      boxShadow: selected ? `0 0 0 2px ${colors.border}44` : "none",
    }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={40} color={colors.border} />
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
      {visibilityIcon && (
        <span style={{
          position: "absolute", top: 5, left: 7,
          fontSize: 11, lineHeight: 1, opacity: 0.85,
          userSelect: "none",
        }}>
          {visibilityIcon}
        </span>
      )}
      <span>{data.label}</span>
    </div>
  );
}