import { useState, useEffect, useRef, useCallback } from "react";
import InfraCanvas from "./components/Canvas/InfraCanvas";
import ResourcePanel from "./components/Sidebar/ResourcePanel";

// Set theme synchronously before first render
document.documentElement.setAttribute("data-theme", "dark");

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [editTrigger, setEditTrigger] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [roles, setRoles] = useState([]);
  const [region, setRegion] = useState("us-east-1");
  const [canvasControls, setCanvasControls] = useState({
    onExport: null,
    onImport: null,
    onReviewCanvas: null,
    onAssignRole: null,
    undo: null,
    redo: null,
    canUndo: false,
    canRedo: false,
    nodes: [],
    loading: false,
  });

  // Panel resize state — persisted to localStorage
  const [leftWidth,  setLeftWidth]  = useState(() => parseInt(localStorage.getItem("wimcui_left_width")  || "210", 10));
  const [rightWidth, setRightWidth] = useState(() => parseInt(localStorage.getItem("wimcui_right_width") || "440", 10));

  useEffect(() => { localStorage.setItem("wimcui_left_width",  leftWidth);  }, [leftWidth]);
  useEffect(() => { localStorage.setItem("wimcui_right_width", rightWidth); }, [rightWidth]);

  const startDragLeft = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (e) => setLeftWidth(Math.min(320, Math.max(180, startW + (e.clientX - startX))));
    const onUp   = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [leftWidth]);

  const startDragRight = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (e) => setRightWidth(Math.min(640, Math.max(360, startW - (e.clientX - startX))));
    const onUp   = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
  }, [rightWidth]);

  const handleEditNode = () => setEditTrigger((n) => n + 1);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", overflow: "hidden" }}>
      <ResourcePanel
        width={leftWidth}
        onStartDrag={startDragLeft}
        selectedNode={selectedNode}
        onEditNode={handleEditNode}
        theme={theme}
        onToggleTheme={toggleTheme}
        onExport={canvasControls.onExport}
        onImport={canvasControls.onImport}
        onReviewCanvas={canvasControls.onReviewCanvas}
        loading={canvasControls.loading}
        nodes={canvasControls.nodes || []}
        onAssignRole={canvasControls.onAssignRole}
        onUndo={canvasControls.undo}
        onRedo={canvasControls.redo}
        canUndo={!!canvasControls.canUndo}
        canRedo={!!canvasControls.canRedo}
        region={region}
        onRegionChange={setRegion}
        roles={roles}
        onRolesChange={setRoles}
      />
      <InfraCanvas
        reviewPanelWidth={rightWidth}
        onReviewPanelDrag={startDragRight}
        onSelectionChange={setSelectedNode}
        editTrigger={editTrigger}
        selectedNode={selectedNode}
        onRegisterControls={setCanvasControls}
        region={region}
        onRegionChange={setRegion}
        roles={roles}
        onRolesChange={setRoles}
      />
    </div>
  );
}

export default App;