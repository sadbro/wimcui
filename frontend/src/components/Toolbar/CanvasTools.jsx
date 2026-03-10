import { useRef } from "react";

export default function CanvasTools({ onGenerateDAG, loading, onExport, onImport }) {
  const fileInputRef = useRef(null);

  return (
    <div style={{
      position: "absolute", top: 12, left: 220, zIndex: 10,
      background: "var(--bg-elevated)",
      padding: "8px 12px",
      border: "1px solid var(--border)", borderRadius: 8,
      display: "flex", gap: 8, alignItems: "center",
      boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
    }}>
      <input ref={fileInputRef} type="file" accept=".json" onChange={onImport} style={{ display: "none" }} />

      <button onClick={() => fileInputRef.current?.click()} style={ghostBtn}>
        Import
      </button>
      <button onClick={onExport} style={ghostBtn}>
        Export
      </button>

      <div style={{ width: 1, height: 20, background: "var(--border)" }} />

      <button
        onClick={onGenerateDAG}
        disabled={loading}
        style={{
          ...solidBtn,
          opacity: loading ? 0.6 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Generating..." : "Generate DAG"}
      </button>
    </div>
  );
}

const ghostBtn = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 6, padding: "6px 14px",
  fontSize: 13, fontWeight: 500, cursor: "pointer",
};

const solidBtn = {
  background: "var(--accent)",
  color: "white", border: "none",
  borderRadius: 6, padding: "6px 14px",
  fontSize: 13, fontWeight: 500,
};