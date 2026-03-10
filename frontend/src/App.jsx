import { useState, useRef } from "react";
import InfraCanvas from "./components/Canvas/InfraCanvas";
import ResourcePanel from "./components/Sidebar/ResourcePanel";
import { DEFAULT_REGION } from "./config/awsRegions";

// Set theme synchronously before first render
document.documentElement.setAttribute("data-theme", "dark");

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [editTrigger, setEditTrigger] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [canvasControls, setCanvasControls] = useState({
    onExport: null,
    onImport: null,
    onReviewCanvas: null,
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
        region={region}
        onRegionChange={setRegion}
        onExport={canvasControls.onExport}
        onImport={canvasControls.onImport}
        onReviewCanvas={canvasControls.onReviewCanvas}
        loading={canvasControls.loading}
      />
      <InfraCanvas
        onSelectionChange={setSelectedNode}
        editTrigger={editTrigger}
        selectedNode={selectedNode}
        onRegisterControls={setCanvasControls}
        region={region}
        onRegionChange={setRegion}
      />
    </div>
  );
}

export default App;