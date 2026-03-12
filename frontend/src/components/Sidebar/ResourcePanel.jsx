import { useState, useRef } from "react";
import { AWS_REGIONS } from "../../config/awsRegions";
import RoleManager from "./RoleManager";

const MONO = { fontFamily: "'JetBrains Mono', Consolas, monospace" };

const resources = [
  { type: "VPC",          color: "#4d6bfe" },
  { type: "Subnet",       color: "#4d9ffe" },
  { type: "EC2",          color: "var(--text-secondary)" },
  { type: "RDS",          color: "var(--text-secondary)" },
  { type: "LoadBalancer", color: "var(--text-secondary)" },
];

const infraResources = [
  { type: "IGW",        color: "#52c41a", label: "Internet Gateway" },
  { type: "NATGateway", color: "#fa8c16", label: "NAT Gateway"      },
  { type: "RouteTable", color: "#722ed1", label: "Route Table"      },
];

const ghostBtnStyle = {
  width: "100%", padding: "7px 0",
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6, cursor: "pointer",
  fontSize: 12, fontWeight: 500,
};

const solidBtnStyle = {
  width: "100%", padding: "7px 0",
  background: "var(--accent)", color: "white",
  border: "none", borderRadius: 6,
  cursor: "pointer", fontWeight: 500, fontSize: 12,
};

function SectionLabel({ label }) {
  return (
    <div style={{
      ...MONO, fontSize: 10, fontWeight: 700,
      color: "var(--text-muted)", letterSpacing: 1,
      textTransform: "uppercase", margin: "10px 0 6px",
    }}>
      {label}
    </div>
  );
}

function DraggableItem({ type, color, label, onDragStart }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onDragStart={(e) => onDragStart(e, type)}
      draggable
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "7px 10px", marginBottom: 4,
        background: hovered ? "var(--bg-hover)" : "var(--bg-elevated)",
        border: `1px solid ${hovered ? color : "var(--border)"}`,
        cursor: "grab", borderRadius: 6,
        fontSize: 12, color: color,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {label || type}
    </div>
  );
}

function ResourcesTab({ onDragStart }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SectionLabel label="Compute & Data" />
        {resources.map((r) => (
          <DraggableItem key={r.type} {...r} onDragStart={onDragStart} />
        ))}
        <SectionLabel label="Networking" />
        {infraResources.map((r) => (
          <DraggableItem key={r.type} {...r} onDragStart={onDragStart} />
        ))}
      </div>
    </div>
  );
}

function ConfigureTab({ roles, onRolesChange, nodes, onAssignRole }) {
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <RoleManager
        roles={roles || []}
        onRolesChange={onRolesChange}
        nodes={nodes || []}
        onAssignRole={onAssignRole}
      />
    </div>
  );
}

export default function ResourcePanel({
  width = 210, onStartDrag,
  selectedNode, onEditNode,
  theme, onToggleTheme,
  region, onRegionChange,
  onExport, onImport, onReviewCanvas, loading,
  onUndo, onRedo, canUndo, canRedo,
  roles, onRolesChange,
  nodes, onAssignRole,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const fileInputRef = useRef(null);

  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside style={{
      flexBasis: width, flexShrink: 0, flexGrow: 0,
      minWidth: 180, maxWidth: 320,
      padding: "12px 10px",
      background: "var(--bg-surface)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100vh", boxSizing: "border-box",
      position: "relative",
    }}>
      {/* Drag handle — right edge */}
      <div
        onMouseDown={onStartDrag}
        style={{
          position: "absolute", top: 0, right: -3,
          width: 6, height: "100%",
          cursor: "col-resize", zIndex: 10,
        }}
      />

      {/* Persistent header */}
      <div style={{ flexShrink: 0, marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", letterSpacing: 0.5, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              WIMAWS
            </span>
          </div>
          <button
            onClick={onToggleTheme}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            style={{
              background: "var(--bg-hover)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "3px 7px", cursor: "pointer",
              fontSize: 13, lineHeight: 1,
            }}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>

        <select
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          style={{
            width: "100%", background: "var(--bg-elevated)",
            border: "1px solid var(--border)", borderRadius: 6,
            padding: "5px 8px", fontSize: 11,
            color: "var(--text-primary)", cursor: "pointer",
            outline: "none", marginBottom: 8,
          }}
        >
          {AWS_REGIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.value} — {r.label}</option>
          ))}
        </select>

        <input ref={fileInputRef} type="file" accept=".json" onChange={onImport} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
          <button onClick={() => fileInputRef.current?.click()} style={{ ...ghostBtnStyle, flex: 1 }}>
            Import
          </button>
          <button onClick={onExport} style={{ ...ghostBtnStyle, flex: 1 }}>
            Export
          </button>
        </div>
        <div style={{ display: "flex", gap: 5, marginBottom: 5 }}>
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{ ...ghostBtnStyle, flex: 1, opacity: canUndo ? 1 : 0.35, cursor: canUndo ? "pointer" : "default" }}
          >
            ↩ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            style={{ ...ghostBtnStyle, flex: 1, opacity: canRedo ? 1 : 0.35, cursor: canRedo ? "pointer" : "default" }}
          >
            ↪ Redo
          </button>
        </div>
        <button onClick={onReviewCanvas} style={solidBtnStyle}>
          Review Canvas
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 2,
        borderBottom: "1px solid var(--border)",
        marginBottom: 10, flexShrink: 0,
      }}>
        {["Resources", "Configure"].map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              flex: 1, padding: "6px 4px",
              background: "transparent", border: "none",
              borderBottom: activeTab === i ? "2px solid var(--accent)" : "2px solid transparent",
              color: activeTab === i ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer", fontSize: 11,
              fontWeight: activeTab === i ? 700 : 500,
              ...MONO, marginBottom: -1,
              transition: "color 0.15s",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Persistent selected node — visible across all tabs */}
      {selectedNode && selectedNode.data?.resourceType && selectedNode.data?.resourceType !== "Public" && (
        <div style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "8px 0", marginBottom: 8, flexShrink: 0,
        }}>
          <div style={{ ...MONO, fontSize: 10, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Selected
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-primary)", wordBreak: "break-word" }}>
            {selectedNode.data.label}
          </div>
          <button onClick={onEditNode} style={solidBtnStyle}>
            Edit Config
          </button>
        </div>
      )}

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === 0 && (
          <ResourcesTab
            onDragStart={onDragStart}
          />
        )}
        {activeTab === 1 && (
          <ConfigureTab
            roles={roles}
            onRolesChange={onRolesChange}
            nodes={nodes}
            onAssignRole={onAssignRole}
          />
        )}
      </div>
    </aside>
  );
}