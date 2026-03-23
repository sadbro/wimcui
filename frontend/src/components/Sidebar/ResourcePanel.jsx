import { useState, useRef } from "react";
import { AWS_REGIONS } from "../../config/awsRegions";
import RoleManager from "./RoleManager";
import { resourcesByCategory } from "../../config/resourceRegistry";
import { getResourceIcon } from "../../config/resourceIcons";
import SGManager from "./SGManager";

const MONO = { fontFamily: "'JetBrains Mono', Consolas, monospace" };

const networkResources = resourcesByCategory("network");
const computeResources = resourcesByCategory("compute");
const infraResources   = resourcesByCategory("infra");
const globalResources  = resourcesByCategory("global");

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

function ResourceTile({ type, color, label, onDragStart }) {
  const [hovered, setHovered] = useState(false);
  const IconComponent = getResourceIcon(type);

  return (
    <div
      onDragStart={(e) => onDragStart(e, type)}
      draggable
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label || type}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 5,
        cursor: "grab", userSelect: "none",
        transition: "transform 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      {/* Icon tile — transparent body, colored border only */}
      <div style={{
        width: 52, height: 52,
        borderRadius: 10,
        background: hovered ? `${color}22` : `${color}11`,
        border: `2px solid ${hovered ? color : `${color}bb`}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "border-color 0.15s, box-shadow 0.15s",
        flexShrink: 0,
        boxShadow: hovered ? `0 0 12px ${color}88` : "none",
      }}>
        {IconComponent ? (
          <IconComponent size={30} />
        ) : (
          <span style={{
            fontSize: 18, color: color,
            fontWeight: 700, lineHeight: 1,
            fontFamily: "system-ui",
          }}>
            {(label || type).charAt(0)}
          </span>
        )}
      </div>
      {/* Label */}
      <span style={{
        ...MONO, fontSize: 9, fontWeight: 600,
        color: hovered ? color : "var(--text-muted)",
        textAlign: "center", lineHeight: 1.2,
        maxWidth: 56, wordBreak: "break-word",
        textTransform: "uppercase", letterSpacing: 0.3,
        transition: "color 0.15s",
      }}>
        {label || type}
      </span>
    </div>
  );
}

// Grid wrapper for a category of resource tiles
function TileGrid({ resources, onDragStart }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: "10px 6px",
      marginBottom: 6,
    }}>
      {resources.map((r) => (
        <ResourceTile key={r.type} {...r} onDragStart={onDragStart} />
      ))}
    </div>
  );
}

function ResourcesTab({ onDragStart }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 2 }}>
        <SectionLabel label="Network" />
        <TileGrid resources={networkResources} onDragStart={onDragStart} />
        <SectionLabel label="Compute & Data" />
        <TileGrid resources={computeResources} onDragStart={onDragStart} />
        <SectionLabel label="Infrastructure" />
        <TileGrid resources={infraResources} onDragStart={onDragStart} />
        {globalResources.length > 0 && (
          <>
            <SectionLabel label="Global Services" />
            <TileGrid resources={globalResources} onDragStart={onDragStart} />
          </>
        )}
      </div>
    </div>
  );
}

function ConfigureTab({ roles, onRolesChange, nodes, edges, onAssignRole, securityGroups, onSGChange, onAssignSG }) {
  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <RoleManager
        roles={roles || []}
        onRolesChange={onRolesChange}
        nodes={nodes || []}
        onAssignRole={onAssignRole}
      />
      <div style={{ borderTop: "1px solid var(--border)", margin: "12px 0" }} />
      <SGManager
        securityGroups={securityGroups || []}
        onSGChange={onSGChange}
        nodes={nodes || []}
        edges={edges || []}
        onAssignSG={onAssignSG}
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
  nodes, edges, onAssignRole,
  securityGroups, onSGChange, onAssignSG,
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
        {/* Import / Export / Undo / Redo — single icon row */}
        <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
          {[
            { icon: "⬇", label: "Import", title: "Import canvas (JSON)", onClick: () => fileInputRef.current?.click(), disabled: false },
            { icon: "⬆", label: "Export", title: "Export canvas (JSON)", onClick: onExport, disabled: false },
            { icon: "↩", label: "Undo",   title: "Undo (Ctrl+Z)",        onClick: onUndo,   disabled: !canUndo },
            { icon: "↪", label: "Redo",   title: "Redo (Ctrl+Y)",        onClick: onRedo,   disabled: !canRedo },
          ].map(({ icon, label, title, onClick, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              title={title}
              style={{
                flex: 1,
                padding: "6px 0",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.35 : 1,
                fontSize: 14,
                lineHeight: 1,
                color: "var(--text-secondary)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                transition: "border-color 0.15s, color 0.15s",
              }}
            >
              <span style={{ fontSize: 13 }}>{icon}</span>
              <span style={{ fontSize: 8, ...MONO, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</span>
            </button>
          ))}
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
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
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
            edges={edges}
            onAssignRole={onAssignRole}
            securityGroups={securityGroups}
            onSGChange={onSGChange}
            onAssignSG={onAssignSG}
          />
        )}
      </div>
    </aside>
  );
}