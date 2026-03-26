import { useState, useEffect, useRef } from "react";
import { RESOURCE_REGISTRY } from "../../config/resourceRegistry";
import { getResourceIcon } from "../../config/resourceIcons";

const MONO = { fontFamily: "'JetBrains Mono', Consolas, monospace" };

const TAG_COLORS = {
  structural: "#4d6bfe",
  traffic:    "#52c41a",
  association:"#fa8c16",
  practice:   "#8b5cf6",
};

function Tag({ label, color }) {
  return (
    <span style={{
      ...MONO, fontSize: 9, fontWeight: 600,
      padding: "2px 7px", borderRadius: 4,
      background: `${color}22`, color,
      border: `1px solid ${color}44`,
      textTransform: "uppercase", letterSpacing: 0.5,
    }}>
      {label}
    </span>
  );
}

function ConnectionList({ label, items, color, registryLookup }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <Tag label={label} color={color} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
        {items.map((item) => {
          const reg = registryLookup?.[item];
          const c = reg?.color || "var(--text-muted)";
          return (
            <span key={item} style={{
              ...MONO, fontSize: 10, fontWeight: 500,
              padding: "3px 8px", borderRadius: 5,
              background: `${c}18`, color: c,
              border: `1px solid ${c}33`,
            }}>
              {reg?.label || item}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PracticeItem({ text }) {
  return (
    <div style={{
      display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start",
    }}>
      <span style={{ color: TAG_COLORS.practice, fontSize: 10, marginTop: 2, flexShrink: 0 }}>&#9679;</span>
      <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

function ResourceDetail({ doc, onLoadExample }) {
  const reg = RESOURCE_REGISTRY[doc.type] || {};
  const IconComponent = doc.type ? getResourceIcon(doc.type) : null;
  const color = reg.color || "#888";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: `${color}18`, border: `2px solid ${color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {IconComponent ? <IconComponent size={26} /> : (
            <span style={{ fontSize: 18, color, fontWeight: 700 }}>{(doc.title || doc.type || "?").charAt(0)}</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{doc.title}</div>
          {reg.sgCapable && <Tag label="SG Capable" color="#52c41a" />}
          {" "}
          {reg.iamCapable && <Tag label="IAM Capable" color="#fa8c16" />}
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 16px" }}>
        {doc.description}
      </p>

      {/* Connections */}
      {doc.connections && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Connections
          </div>
          <ConnectionList label="Contains / Parent" items={doc.connections.parents} color={TAG_COLORS.structural} registryLookup={RESOURCE_REGISTRY} />
          <ConnectionList label="Traffic Sources" items={doc.connections.trafficSources} color={TAG_COLORS.traffic} registryLookup={RESOURCE_REGISTRY} />
          <ConnectionList label="Traffic Targets" items={doc.connections.trafficTargets} color={TAG_COLORS.traffic} registryLookup={RESOURCE_REGISTRY} />
          <ConnectionList label="Associations" items={doc.connections.associations} color={TAG_COLORS.association} registryLookup={RESOURCE_REGISTRY} />
        </div>
      )}

      {/* Config Notes */}
      {doc.configNotes && doc.configNotes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Configuration
          </div>
          {doc.configNotes.map((note, i) => (
            <div key={i} style={{
              fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5,
              padding: "4px 0", borderBottom: i < doc.configNotes.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              {note}
            </div>
          ))}
        </div>
      )}

      {/* Practices */}
      {doc.practices && doc.practices.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Best Practices
          </div>
          {doc.practices.map((p, i) => <PracticeItem key={i} text={p} />)}
        </div>
      )}

      {/* Resources list (group docs only) */}
      {doc.resources && doc.resources.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Resources Used
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {doc.resources.map((r) => {
              const rr = RESOURCE_REGISTRY[r];
              const c = rr?.color || "var(--text-muted)";
              return (
                <span key={r} style={{
                  ...MONO, fontSize: 10, fontWeight: 500,
                  padding: "3px 8px", borderRadius: 5,
                  background: `${c}18`, color: c,
                  border: `1px solid ${c}33`,
                }}>
                  {rr?.label || r}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Load Example button */}
      {doc.example && (
        <>
          <button
            onClick={() => onLoadExample(doc.example)}
            style={{
              width: "100%", padding: "10px 0",
              background: "var(--accent)", color: "white",
              border: "none", borderRadius: 6,
              cursor: "pointer", fontWeight: 600, fontSize: 13,
              marginTop: 4,
            }}
          >
            Load Example onto Canvas
          </button>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 6, lineHeight: 1.4 }}>
            Reference example — may need additional resources for production use
          </div>
        </>
      )}
    </div>
  );
}

export default function DocsModal({ initialType, onClose, onLoadExample }) {
  const [index, setIndex] = useState(null);
  const [selectedKey, setSelectedKey] = useState(initialType || null);
  const [doc, setDoc] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [confirmLoad, setConfirmLoad] = useState(null);
  const cache = useRef({});

  // Fetch index on mount
  useEffect(() => {
    fetch("/docs/index.json")
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setIndex({ resources: [], groups: [] }));
  }, []);

  // Fetch individual doc on selection
  useEffect(() => {
    if (!selectedKey) { setDoc(null); return; }
    if (cache.current[selectedKey]) { setDoc(cache.current[selectedKey]); return; }

    setLoadingDoc(true);
    // Determine path: group docs vs resource docs
    const entry = index?.resources?.find((r) => r.key === selectedKey)
      || index?.groups?.find((g) => g.key === selectedKey);
    const folder = entry?.group ? "groups" : "resources";
    fetch(`/docs/${folder}/${selectedKey}.json`)
      .then((r) => r.json())
      .then((data) => {
        cache.current[selectedKey] = data;
        setDoc(data);
      })
      .catch(() => setDoc(null))
      .finally(() => setLoadingDoc(false));
  }, [selectedKey, index]);

  // Auto-select initial type
  useEffect(() => {
    if (initialType) setSelectedKey(initialType);
  }, [initialType]);

  const handleLoadExample = (example) => {
    setConfirmLoad(example);
  };

  const confirmAndLoad = () => {
    if (confirmLoad && onLoadExample) {
      onLoadExample(confirmLoad);
      onClose();
    }
    setConfirmLoad(null);
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div style={{
        background: "var(--bg-elevated)", borderRadius: 12,
        width: 640, maxWidth: "90vw",
        height: "75vh", maxHeight: 600,
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)", border: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 20px 12px", flexShrink: 0,
          borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {selectedKey && (
              <span
                onClick={() => { setSelectedKey(null); setDoc(null); }}
                style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 16, marginRight: 4 }}
                title="Back to list"
              >
                &#8592;
              </span>
            )}
            <h3 style={{ margin: 0, fontSize: 15, color: "var(--text-primary)", fontWeight: 700 }}>
              {selectedKey ? (doc?.title || selectedKey) : "Resource Docs"}
            </h3>
          </div>
          <span onClick={onClose} style={{ cursor: "pointer", color: "var(--text-muted)", fontSize: 18 }}>&#10005;</span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {!index && (
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
          )}

          {/* List view */}
          {index && !selectedKey && (
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {/* Groups section */}
              {index.groups && index.groups.length > 0 && (
                <>
                  <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, margin: "4px 0 8px" }}>
                    Architecture Patterns
                  </div>
                  {index.groups.map((g) => (
                    <div
                      key={g.key}
                      onClick={() => setSelectedKey(g.key)}
                      style={{
                        padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                        border: "1px solid var(--border)", marginBottom: 6,
                        background: "var(--bg-surface)",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{g.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.summary}</div>
                    </div>
                  ))}
                </>
              )}

              {/* Resources section */}
              <div style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, margin: "14px 0 8px" }}>
                Individual Resources
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(index.resources || []).map((r) => {
                  const reg = RESOURCE_REGISTRY[r.key];
                  const color = reg?.color || "var(--text-muted)";
                  const IconComponent = getResourceIcon(r.key);
                  return (
                    <div
                      key={r.key}
                      onClick={() => setSelectedKey(r.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        border: "1px solid var(--border)",
                        background: "var(--bg-surface)",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = color}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: `${color}15`, border: `1.5px solid ${color}88`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        {IconComponent ? <IconComponent size={16} /> : (
                          <span style={{ fontSize: 12, color, fontWeight: 700 }}>{(reg?.label || r.key).charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{r.title}</div>
                        <div style={{ ...MONO, fontSize: 9, color: "var(--text-muted)" }}>{r.summary}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detail view */}
          {index && selectedKey && !loadingDoc && doc && (
            <ResourceDetail doc={doc} onLoadExample={handleLoadExample} />
          )}
          {index && selectedKey && loadingDoc && (
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
          )}
        </div>

        {/* Confirm dialog */}
        {confirmLoad && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 12, zIndex: 10,
          }}>
            <div style={{
              background: "var(--bg-elevated)", borderRadius: 10,
              padding: "20px 24px", maxWidth: 340, textAlign: "center",
              border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                Replace current canvas?
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
                This will replace your current canvas with a reference example. It's a starting point — the review panel will flag what to add for production use.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirmLoad(null)}
                  style={{
                    flex: 1, padding: "8px 0", background: "transparent",
                    border: "1px solid var(--border)", borderRadius: 6,
                    color: "var(--text-secondary)", cursor: "pointer", fontSize: 12,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAndLoad}
                  style={{
                    flex: 1, padding: "8px 0", background: "var(--accent)",
                    border: "none", borderRadius: 6,
                    color: "white", cursor: "pointer", fontWeight: 600, fontSize: 12,
                  }}
                >
                  Replace Canvas
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
