import { useState } from "react";
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
    nodes: [],
    loading: false,
  });

  const handleEditNode = () => setEditTrigger((n) => n + 1);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)" }}>
      <ResourcePanel
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
        region={region}
        onRegionChange={setRegion}
        roles={roles}
        onRolesChange={setRoles}
      />
      <InfraCanvas
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