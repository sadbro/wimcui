import { AWS_REGIONS } from "../../config/awsRegions";
import { useRef } from "react";

const resources = [
  { type: "VPC", color: "#4d6bfe" },
  { type: "Subnet", color: "#4d9ffe" },
  { type: "EC2",  color: "var(--text-secondary)" },
  { type: "RDS",  color: "var(--text-secondary)" },
  { type: "LoadBalancer",  color: "var(--text-secondary)" },
];

const infraResources = [
  { type: "IGW", color: "#52c41a", label: "Internet Gateway" },
  { type: "NATGateway", color: "#fa8c16", label: "NAT Gateway"      },
  { type: "RouteTable", color: "#722ed1", label: "Route Table"      },
];



export default function ResourcePanel({
  selectedNode, onEditNode,
  theme, onToggleTheme,
  region, onRegionChange,
  onExport, onImport, onReviewCanvas, loading,
}) {
  const fileInputRef = useRef(null);

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  const canEdit = selectedNode && selectedNode.data?.resourceType &&
    selectedNode.data?.resourceType !== "Public";

  return (
    <aside style={{
      width: 200, padding: 12,
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header — region selector + theme toggle */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", letterSpacing: 1, textTransform: "uppercase" }}>
            Resources
          </h3>
          <button
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "var(--bg-hover)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "4px 8px", cursor: "pointer",
              fontSize: 14, lineHeight: 1, color: "var(--text-secondary)",
            }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        <select
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          title="AWS Region — applies to all resources on this canvas"
          style={{
            width: "100%",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "5px 8px",
            fontSize: 11,
            color: "var(--text-primary)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          {AWS_REGIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.value} — {r.label}</option>
          ))}
        </select>
      </div>

      {/* Resource draggables */}
      {resources.map((r) => (
        <div
          key={r.type}
          onDragStart={(e) => onDragStart(e, r.type)}
          draggable
          style={{
            padding: "8px 10px", marginBottom: 5,
            background: "var(--bg-elevated)",
            border: `1px solid var(--border)`,
            cursor: "grab", borderRadius: 6,
            fontSize: 13, color: "var(--text-primary)",
            
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = r.color;
            e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--bg-elevated)";
          }}
        >          <span>{r.type}</span>
        </div>
      ))}

      <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
        Networking
      </div>

      {infraResources.map((r) => (
        <div
          key={r.type}
          onDragStart={(e) => onDragStart(e, r.type)}
          draggable
          style={{
            padding: "8px 10px", marginBottom: 5,
            background: "var(--bg-elevated)",
            border: `1px solid var(--border)`,
            cursor: "grab", borderRadius: 6,
            fontSize: 13, color: r.color,
            
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = r.color;
            e.currentTarget.style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--bg-elevated)";
          }}
        >          <span>{r.label}</span>
        </div>
      ))}

      {/* Canvas controls */}
      <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={onImport}
        style={{ display: "none" }}
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        style={ghostBtnStyle}
      >
        Import
      </button>

      <button
        onClick={onExport}
        style={{ ...ghostBtnStyle, marginTop: 6 }}
      >
        Export
      </button>

      <button
        onClick={onReviewCanvas}
        
        style={{
          ...solidBtnStyle,
          marginTop: 6,

        }}
      >
        Review Canvas
      </button>

      {/* Selected node edit */}
      {canEdit && (
        <div style={{ marginTop: "auto", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Selected
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text-primary)", wordBreak: "break-word" }}>
            {selectedNode.data.label}
          </div>
          <button onClick={onEditNode} style={solidBtnStyle}>
            Edit Config
          </button>
        </div>
      )}
    </aside>
  );
}

const ghostBtnStyle = {
  width: "100%", padding: "7px 0",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6, cursor: "pointer",
  fontSize: 13, fontWeight: 500,
};

const solidBtnStyle = {
  width: "100%", padding: "7px 0",
  background: "var(--accent)", color: "white",
  border: "none", borderRadius: 6,
  cursor: "pointer", fontWeight: 500, fontSize: 13,
};