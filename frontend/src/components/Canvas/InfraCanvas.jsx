/* eslint-disable react-hooks/exhaustive-deps */
import React, { useCallback, useState, useEffect, useRef } from "react";
import ResourceNode from "./ResourceNode";
import PublicNode from "./PublicNode";
import ConfigModal from "../Modal/ConfigModal";
import EdgeConfigModal from "../Modal/EdgeConfigModal";
import StructuralEdge from "../Edges/StructuralEdge";
import AssociationEdge from "../Edges/AssociationEdge";
import ReviewPanel from "../Sidebar/ReviewPanel";
import { RolesContext } from "../../config/rolesContext";
import { RESOURCE_REGISTRY } from "../../config/resourceRegistry";
import SGAutoCreateModal from "../Modal/SGAutoCreateModal";
import { SecurityGroupsContext } from "../../config/securityGroupsContext";
import TrafficEdge from "../Edges/TrafficEdge";
import { hasConfig, getRequiredParents, resourceFields } from "../../config/resourceConfig";
import { validateTrafficConnection } from "../../config/trafficRules";
import { validateAssociationConnection } from "../../config/associationRules";
import { cidrContains } from "../../config/cidrUtils";

import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
} from "reactflow";

import "reactflow/dist/style.css";

const nodeTypes = { resourceNode: ResourceNode, publicNode: PublicNode };
const edgeTypes = { structural: StructuralEdge, traffic: TrafficEdge, association: AssociationEdge };

const getId = (label, existingNodes) => {
  const key = label.replace(/\s+/g, "_");
  const existing = existingNodes
    .map((n) => n.id)
    .filter((id) => id.startsWith(`${key}_`))
    .map((id) => parseInt(id.split("_").pop(), 10))
    .filter((n) => !isNaN(n));
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${key}_${next}`;
};

function Canvas({ onSelectionChange, editTrigger, selectedNode, onRegisterControls, region = "us-east-1", onRegionChange, roles = [], onRolesChange, reviewPanelWidth = 440, onReviewPanelDrag, securityGroups = [], onSGChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const [pendingDrop, setPendingDrop] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [pendingEdge, setPendingEdge] = useState(null);   // params from onConnect
  const [editingEdge, setEditingEdge] = useState(null);   // existing edge being edited
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingSGPrompt, setPendingSGPrompt] = useState(null); // nodes needing SG auto-create

  // Undo / Redo history
  const [past,   setPast]   = useState([]);
  const [future, setFuture] = useState([]);
  const isDragging = useRef(false);

  // Always-fresh ref to nodes — solves stale closure in callbacks
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const edgesRef = useRef(edges);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  const rolesRef = useRef(roles);
  useEffect(() => { rolesRef.current = roles; }, [roles]);

  const securityGroupsRef = useRef(securityGroups);
  useEffect(() => { securityGroupsRef.current = securityGroups; }, [securityGroups]);

  // Always-fresh ref to showToast
  const showToastRef = useRef(null);

  const snapshot = useCallback(() => {
    setPast((p) => [...p.slice(-49), {
      nodes:          nodesRef.current,
      edges:          edgesRef.current,
      roles:          rolesRef.current,
      securityGroups: securityGroupsRef.current,
    }]);
    setFuture([]);
  }, []); // no deps — reads everything from always-fresh refs

  const undo = useCallback(() => {
    setPast((p) => {
      if (p.length === 0) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [{
        nodes:          nodesRef.current,
        edges:          edgesRef.current,
        roles:          rolesRef.current,
        securityGroups: securityGroupsRef.current,
      }, ...f.slice(0, 49)]);
      setNodes(prev.nodes);
      setEdges(prev.edges);
      if (prev.roles          && onRolesChange) onRolesChange(prev.roles);
      if (prev.securityGroups && onSGChange)    onSGChange(prev.securityGroups);
      return p.slice(0, -1);
    });
  }, [onRolesChange, onSGChange, setNodes, setEdges]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setPast((p) => [...p.slice(-49), {
        nodes:          nodesRef.current,
        edges:          edgesRef.current,
        roles:          rolesRef.current,
        securityGroups: securityGroupsRef.current,
      }]);
      setNodes(next.nodes);
      setEdges(next.edges);
      if (next.roles          && onRolesChange) onRolesChange(next.roles);
      if (next.securityGroups && onSGChange)    onSGChange(next.securityGroups);
      return f.slice(1);
    });
  }, [onRolesChange, onSGChange, setNodes, setEdges]);

  useEffect(() => {
    if (editTrigger > 0 && selectedNode) {
      // Read fresh node from nodesRef to avoid stale config after previous edits
      const freshNode = nodesRef.current.find((n) => n.id === selectedNode.id);
      setEditingNode(freshNode || selectedNode);
    }
  }, [editTrigger]);

  const showToast = useCallback((msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Keep showToast ref fresh
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  // Warn if region changes and subnets already have AZ config
  const prevRegionRef = useRef(region);
  useEffect(() => {
    if (prevRegionRef.current !== region) {
      const subnetsWithAZ = nodes.filter(
        (n) => n.data?.resourceType === "Subnet" && n.data?.config?.availability_zone
      );
      if (subnetsWithAZ.length > 0) {
        showToastRef.current(
          `Region changed — ${subnetsWithAZ.length} subnet(s) have AZ selections that may be invalid for ${region}. Review subnet configs.`,
          true
        );
      }
      prevRegionRef.current = region;
    }
  }, [region, nodes]);

  // Auto-sync route edges from RT config — RT -> IGW/NAT visual edges
  useEffect(() => {
    const routeEdges = [];
    nodes.forEach((node) => {
      if (node.data?.resourceType !== "RouteTable") return;
      const routes = node.data?.config?.routes || [];
      routes.forEach((r) => {
        if (!r.target) return;
        const target = nodes.find((n) => n.id === r.target);
        if (!target) return;
        const targetType = target.data?.resourceType;
        if (targetType !== "IGW" && targetType !== "NATGateway") return;
        routeEdges.push({
          id: `e_route_${node.id}_${r.target}`,
          source: node.id,
          target: r.target,
          type: "association",
          data: { label: "route" },
        });
      });
    });

    setEdges((eds) => {
      const nonRouteEdges = eds.filter((e) => !e.id.startsWith("e_route_"));
      const existingIds = new Set(nonRouteEdges.map((e) => e.id));
      const newRouteEdges = routeEdges.filter((e) => !existingIds.has(e.id));
      return [...nonRouteEdges, ...newRouteEdges];
    });
  }, [nodes]);

  const getNodeType = (nodeId) =>
    nodesRef.current.find((n) => n.id === nodeId)?.data?.resourceType;

  const isPublicNode = (nodeId) => getNodeType(nodeId) === "Public";

  const CONTAINER_TYPES = ["VPC", "Subnet", "IGW", "NATGateway", "RouteTable"];

  const onConnect = useCallback((params) => {
    const sourceType = getNodeType(params.source);
    const targetType = getNodeType(params.target);

    // Check if this is a valid association connection (e.g. RT ↔ Subnet)
    const associationError = validateAssociationConnection(sourceType, targetType);
    if (!associationError) {
      // RT → IGW/NAT are route edges — auto-generated from RT config, not manually drawable
      const isRouteEdge = sourceType === "RouteTable" &&
        (targetType === "IGW" || targetType === "NATGateway");
      if (isRouteEdge) {
        showToastRef.current(
          "RT → IGW/NAT routes are created automatically from Route Table config. Add a route entry in the RT config modal.",
          true
        );
        return;
      }
      // Valid association — create it directly, no modal needed
      setEdges((eds) => eds.concat({
        id: `e_assoc_${params.source}_${params.target}_${Date.now()}`,
        source: params.source,
        target: params.target,
        type: "association",
        data: { label: "assoc" },
      }));
      return;
    }

    // Block manual connections to/from infra nodes that only use structural edges
    if (CONTAINER_TYPES.includes(sourceType) || CONTAINER_TYPES.includes(targetType)) {
      showToastRef.current(
        `Connections to ${sourceType || targetType} are created automatically via config.`,
        true
      );
      return;
    }

    // Validate traffic connection rules
    const trafficError = validateTrafficConnection(sourceType, targetType);
    if (trafficError) {
      showToastRef.current(trafficError, true);
      return;
    }

    // Block Public -> NLB — NLB has no SG, connect Public to EC2 targets directly
    const sourceNode = nodesRef.current.find((n) => n.id === params.source);
    const targetNode = nodesRef.current.find((n) => n.id === params.target);
    const lbNode = sourceType === "LoadBalancer" ? sourceNode : targetType === "LoadBalancer" ? targetNode : null;
    if (lbNode && (sourceType === "Public" || targetType === "Public")) {
      const lbType = lbNode.data?.config?.load_balancer_type;
      if (lbType === "network") {
        showToastRef.current(
          "NLB does not support security groups — connect Public directly to EC2 targets instead.",
          true
        );
        return;
      }
    }

    // Public node — auto-create with default HTTP/HTTPS ingress
    if (isPublicNode(params.source) || isPublicNode(params.target)) {
      setEdges((eds) => eds.concat({
        source: params.source,
        target: params.target,
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        type: "traffic",
        data: {
          ingress: [{ port: "80", protocol: "HTTP" }, { port: "443", protocol: "HTTPS" }],
          egress: [],
        },
      }));
      return;
    }

    setPendingEdge(params);
  }, []);

  const onEdgeClick = useCallback((event, edge) => {
    if (edge.type === "structural")  return; // structural edges are not editable
    if (edge.type === "association") return; // association edges are not editable
    setEditingEdge(edge);
  }, []);

  const buildEdge = (params, ingress, egress) => ({
    source: params.source,
    target: params.target,
    id: `e_${params.source}_${params.target}_${Date.now()}`,
    type: "traffic",
    data: { ingress, egress },
  });

  const onEdgeModalSave = ({ ingress, egress }) => {
    if (!pendingEdge) return;
    setEdges((eds) => eds.concat(buildEdge(pendingEdge, ingress, egress)));
    setPendingEdge(null);
  };

  const onEdgeEditSave = ({ ingress, egress }) => {
    if (!editingEdge) return;
    setEdges((eds) =>
      eds.map((e) =>
        e.id === editingEdge.id
          ? { ...e, data: { ingress, egress } }
          : e
      )
    );
    setEditingEdge(null);
    showToast("Connection updated.");
  };

  const onEdgeDelete = (edgeId) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setEditingEdge(null);
    showToast("Connection deleted.");
  };

  const getNodeLabel = (nodeId) => {
    const node = nodesRef.current.find((n) => n.id === nodeId);
    return node?.data?.label || nodeId;
  };

  const handleSelectionChange = useCallback(({ nodes: selected }) => {
    onSelectionChange(selected.length === 1 ? selected[0] : null);
  }, [onSelectionChange]);

  // Intercept node changes — block removal if node has children
  const handleNodesChange = useCallback((changes) => {
    const removals = changes.filter((c) => c.type === "remove");
    const filteredChanges = changes.filter((change) => {
      if (change.type !== "remove") return true;

      const hasChildren = nodesRef.current.some((n) =>
        Object.values(n.data?.config || {}).includes(change.id)
      );

      if (hasChildren) {
        showToastRef.current("Cannot delete — remove all child nodes first!", true);
        return false;
      }

      return true;
    });

    // Snapshot before keyboard/built-in deletions (✕ button snapshots itself)
    if (removals.length > 0 && filteredChanges.some((c) => c.type === "remove")) {
      snapshotRef.current();
    }

    onNodesChange(filteredChanges);
  }, [onNodesChange]);

  // Intercept edge changes — block removal of parent->child edges
  const handleEdgesChange = useCallback((changes) => {
    const filteredChanges = changes.filter((change) => {
      if (change.type !== "remove") return true;

      const edge = edges.find((e) => e.id === change.id);
      if (!edge) return true;

      // Structural edges cannot be manually deleted
      if (edge.type === "structural") {
        showToastRef.current("Cannot delete — remove the child node first!", true);
        return false;
      }

      // Route edges are auto-generated from RT config — delete the route in the config modal
      if (edge.id.startsWith("e_route_")) {
        showToastRef.current("Route edges are auto-generated — edit routes in the Route Table config.", true);
        return false;
      }

      return true;
    });

    onEdgesChange(filteredChanges);
  }, [onEdgesChange, edges]);

    const placeNode = (type, position, config = {}) => {
    const displayLabel = config.name ? `${type}.${config.name}` : type;
    const newId = getId(type, nodesRef.current);
    setNodes((nds) =>
      nds.concat({
        id: newId,
        type: "resourceNode",
        position,
        data: { label: displayLabel, resourceType: type, config, onDelete: onDeleteNode },
      })
    );
    return newId;
  };

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData("application/reactflow");
    const position = { x: event.clientX - 250, y: event.clientY - 50 };

    // Public node is a special type with its own component
    if (type === "Public") {
      const newId = getId("Public", nodesRef.current);
      setNodes((nds) => nds.concat({
        id: newId,
        type: "publicNode",
        position,
        data: { label: "Public", resourceType: "Public" },
      }));
      return;
    }

    if (hasConfig(type)) {
      const requiredParents = getRequiredParents(type);
      const missingParents = requiredParents.filter(
        (parentType) => !nodesRef.current.some((n) => n.data?.resourceType === parentType)
      );

      if (missingParents.length > 0) {
        showToast(`Add a ${missingParents.join(", ")} to the canvas first!`, true);
        return;
      }

      setPendingDrop({ type, position });
    } else {
      placeNode(type, position);
    }
  }, []);

  // Container types that use ReactFlow parentId for visual containment
      const onModalSave = (config) => {
    if (!pendingDrop) return;
    const type = pendingDrop.type;

    const newNodeId = placeNode(type, pendingDrop.position, config);

    const fields = resourceFields[type] || [];
    const parentEdges = fields
      .filter((f) => f.type === "parent-select" && config[f.key])
      .map((f) => ({
        id: `e_${config[f.key]}_${newNodeId}`,
        source: config[f.key],
        target: newNodeId,
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "structural",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#aaa" },
      }));

    if (parentEdges.length > 0) {
      setEdges((eds) => eds.concat(parentEdges));
    }

    setPendingDrop(null);
  };

  const { deleteElements } = useReactFlow();

  const onDeleteNode = useCallback((nodeId) => {
    // Check for children before deleting
    const hasChildren = nodesRef.current.some((n) =>
      Object.values(n.data?.config || {}).includes(nodeId)
    );
    if (hasChildren) {
      showToastRef.current("Cannot delete — remove all child nodes first!", true);
      return;
    }
    snapshotRef.current();
    deleteElements({ nodes: [{ id: nodeId }] });
  }, [deleteElements]);

  const onNodeDoubleClick = useCallback((event, node) => {
    if (!node.data?.resourceType) return;
    if (node.data.resourceType === "Public") return;
    const freshNode = nodesRef.current.find((n) => n.id === node.id);
    setEditingNode(freshNode || node);
  }, []);

  const onEdgeDoubleClick = useCallback((event, edge) => {
    if (edge.type !== "traffic") return; // only traffic edges are configurable
    setEditingEdge(edge);
  }, []);

  const onNodeDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const onNodeDragStop = useCallback(() => {
    isDragging.current = false;
    snapshotRef.current();
  }, []);

  const onEditSave = (config) => {
    if (!editingNode) return;
    snapshotRef.current();
    const type = editingNode.data.resourceType;

    // VPC CIDR change — validate all child subnets against the new CIDR
    if (type === "VPC" && config.cidr !== editingNode.data.config?.cidr) {
      const childSubnets = nodesRef.current.filter(
        (n) =>
          n.data?.resourceType === "Subnet" &&
          n.data?.config?.vpcId === editingNode.id &&
          n.data?.config?.cidr
      );

      const invalidSubnets = childSubnets.filter(
        (n) => !cidrContains(config.cidr, n.data.config.cidr)
      );

      if (invalidSubnets.length > 0) {
        const list = invalidSubnets
          .map((n) => `${n.data.label} (${n.data.config.cidr})`)
          .join(", ");
        showToast(
          `Cannot change CIDR — the following subnets would become invalid: ${list}. Fix or remove them first.`,
          true
        );
        return;
      }
    }

    const displayLabel = config.name ? `${type}.${config.name}` : type;

    const updatedNode = {
      ...editingNode,
      data: { ...editingNode.data, label: displayLabel, config },
    };
    setNodes((nds) =>
      nds.map((n) => (n.id === editingNode.id ? updatedNode : n))
    );

    // Reconcile structural edges when a parent-select field changes
    const parentFields = (resourceFields[type] || []).filter((f) => f.type === "parent-select");
    if (parentFields.length > 0) {
      setEdges((eds) => {
        let updated = eds;
        parentFields.forEach((f) => {
          const oldParentId = editingNode.data.config?.[f.key];
          const newParentId = config[f.key];
          if (oldParentId === newParentId) return;

          // Remove old structural edge from old parent to this node
          updated = updated.filter(
            (e) => !(e.type === "structural" && e.source === oldParentId && e.target === editingNode.id)
          );

          // Add new structural edge from new parent to this node
          if (newParentId) {
            updated = updated.concat({
              id: `e_${newParentId}_${editingNode.id}`,
              source: newParentId,
              target: editingNode.id,
              sourceHandle: "bottom",
              targetHandle: "top",
              type: "structural",
              markerEnd: { type: MarkerType.ArrowClosed, color: "#aaa" },
            });
          }
        });
        return updated;
      });
    }

    onSelectionChange(updatedNode);
    setEditingNode(null);
    showToast("Node updated.");
  };

  const onDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };

  const CANVAS_VERSION = "1.0";

  const onExport = () => {
    if (nodes.length === 0) {
      showToast("Nothing to export — add some nodes first.", true);
      return;
    }
    setExportFilename(`infra-canvas-${new Date().toISOString().slice(0, 10)}`);
    setExportModalOpen(true);
  };

  const doExport = (filename) => {
    const state = {
      version: CANVAS_VERSION,
      exportedAt: new Date().toISOString(),
      roles: roles || [],
      securityGroups: securityGroups || [],
      region,
      nodes: nodes.map(({ id, type, position, style, data }) => ({ id, type, position, style, data })),
      edges: edges.map(({ id, type, source, target, sourceHandle, targetHandle, markerEnd, data }) => ({
        id, type, source, target, sourceHandle, targetHandle, markerEnd, data,
      })),
    };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.trim() || "infra-canvas"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
    showToast("Canvas exported.");
  };

  const validateImport = (nodes, edges) => {
    const warnings = [];
    const nodeIds = new Set(nodes.map((n) => n.id));

    nodes.forEach((n) => {
      const type = n.data?.resourceType;
      const config = n.data?.config || {};
      const fields = resourceFields[type] || [];

      // Unknown resource type
      if (!type) {
        warnings.push(`Node ${n.id} has no resource type.`);
        return;
      }

      // Missing required fields
      fields.forEach((f) => {
        if (f.required) {
          const value = config[f.key];
          const isEmpty = f.type === "password" ? !value : !value?.toString().trim();
          if (isEmpty) {
            warnings.push(`${type} "${n.data?.label || n.id}" is missing required field: ${f.label}.`);
          }
        }
      });

      // Parent reference exists on canvas
      const parentFields = fields.filter((f) => f.type === "parent-select");
      parentFields.forEach((f) => {
        const parentId = config[f.key];
        if (parentId && !nodeIds.has(parentId)) {
          warnings.push(`${type} "${n.data?.label || n.id}" references missing parent ${f.label} (${parentId}).`);
        }
      });
    });

    // Edge node references
    edges.forEach((e) => {
      if (!nodeIds.has(e.source)) warnings.push(`Edge ${e.id} references missing source node (${e.source}).`);
      if (!nodeIds.has(e.target)) warnings.push(`Edge ${e.id} references missing target node (${e.target}).`);
    });

    return warnings;
  };

  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const state = JSON.parse(evt.target.result);
        if (!state.nodes || !state.edges) throw new Error("Invalid file structure.");

        // Version warning
        if (state.version !== CANVAS_VERSION) {
          showToast(`Warning: file version ${state.version} may not be fully compatible.`, true);
        }

        // Semantic validation
        const warnings = validateImport(state.nodes, state.edges);
        if (warnings.length > 0) {
          showToast(`Canvas imported with ${warnings.length} warning${warnings.length > 1 ? "s" : ""}: ${warnings[0]}${warnings.length > 1 ? ` (+${warnings.length - 1} more)` : ""}`, true);
        }

        if (state.region && onRegionChange) onRegionChange(state.region);
        if (state.roles && onRolesChange) onRolesChange(state.roles);
        if (state.securityGroups && onSGChange) onSGChange(state.securityGroups);

        // Deprecation warning for Public nodes
        const publicNodes = state.nodes.filter((n) => n.data?.resourceType === "Public");
        if (publicNodes.length > 0) {
          showToast(
            `This canvas uses the deprecated Public / Internet node — internet exposure is now modeled via public subnets and Route Table → IGW configuration. The node still works but should be removed.`,
            true
          );
        }

        snapshotRef.current();
        const validRoleIds = new Set((state.roles || []).map((r) => r.id));
        const validSGIds   = new Set((state.securityGroups || []).map((s) => s.id));
        const remappedNodes = state.nodes.map((n) => {
          const roleId = n.data?.config?.iam_role_id;
          const hasDanglingRole = roleId && !validRoleIds.has(roleId);
          const sgIds = n.data?.config?.sg_ids || [];
          const cleanSGIds = sgIds.filter((id) => validSGIds.has(id));
          const hasDanglingSG = cleanSGIds.length !== sgIds.length;
          const cleanConfig = {
            ...(hasDanglingRole ? { ...n.data.config, iam_role_id: "" } : n.data.config),
            ...(hasDanglingSG   ? { sg_ids: cleanSGIds } : {}),
          };
          return {
            ...n,
            type: n.data?.resourceType === "Public" ? "publicNode" : "resourceNode",
            data: {
              ...n.data,
              config: cleanConfig,
              onDelete: onDeleteNode,
            },
          };
        });

        const hadDanglingRole = remappedNodes.some((n, i) => {
          const roleId = state.nodes[i]?.data?.config?.iam_role_id;
          return roleId && !validRoleIds.has(roleId);
        });
        const hadDanglingSG = remappedNodes.some((n, i) => {
          const sgIds = state.nodes[i]?.data?.config?.sg_ids || [];
          return sgIds.some((id) => !validSGIds.has(id));
        });
        if (hadDanglingRole) showToast("Some nodes had references to deleted roles — cleared on import.", true);
        if (hadDanglingSG)   showToast("Some nodes had references to deleted security groups — cleared on import.", true);

        setNodes(remappedNodes);
        setEdges(state.edges);

        // SG auto-create prompt — fire if sgCapable nodes have traffic edges but no sg_ids
        const sgCapableTypes = Object.entries(RESOURCE_REGISTRY)
          .filter(([, def]) => def.sgCapable)
          .map(([type]) => type);
        const importedEdges = state.edges;
        const nodesNeedingSG = remappedNodes.filter((n) => {
          if (!sgCapableTypes.includes(n.data?.resourceType)) return false;
          const hasSGs = (n.data?.config?.sg_ids || []).length > 0;
          if (hasSGs) return false;
          const hasTraffic = importedEdges.some(
            (e) => e.type === "traffic" && (e.source === n.id || e.target === n.id)
          );
          return hasTraffic;
        });
        if (nodesNeedingSG.length > 0) {
          setPendingSGPrompt(nodesNeedingSG);
        } else if (warnings.length === 0 && publicNodes.length === 0) {
          showToast("Canvas imported.");
        }
      } catch (err) {
        showToast(`Import failed: ${err.message}`, true);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const onReviewCanvas = () => {
    if (nodes.length === 0) {
      showToast("Add some nodes first.", true);
      return;
    }
    setReviewOpen(true);
  };

  // Keep stable refs to latest handlers so ResourcePanel never gets stale closures
  const onExportRef = useRef(onExport);
  const onImportRef = useRef(onImport);
  const onReviewCanvasRef = useRef(onReviewCanvas);
  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  const snapshotRef = useRef(snapshot);
  useEffect(() => { onExportRef.current = onExport; }, [onExport]);
  useEffect(() => { onImportRef.current = onImport; }, [onImport]);
  useEffect(() => { onReviewCanvasRef.current = onReviewCanvas; }, [onReviewCanvas]);
  useEffect(() => { undoRef.current = undo; }, [undo]);
  useEffect(() => { redoRef.current = redo; }, [redo]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  // Register stable wrappers once on mount
  useEffect(() => {
    if (onRegisterControls) {
      onRegisterControls({
        onExport:        (...args) => onExportRef.current(...args),
        onImport:        (...args) => onImportRef.current(...args),
        onReviewCanvas:  (...args) => onReviewCanvasRef.current(...args),
        undo:            (...args) => undoRef.current(...args),
        redo:            (...args) => redoRef.current(...args),
        onAssignRole:    (nodeId, roleId) => {
          snapshotRef.current();
          setNodes((nds) => nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, config: { ...n.data.config, iam_role_id: roleId || "" } } }
              : n
          ));
        },
        onAssignSG: (nodeId, sgIds) => {
          snapshotRef.current();
          setNodes((nds) => nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, config: { ...n.data.config, sg_ids: sgIds } } }
              : n
          ));
        },
        loading: false,
      });
    }
  }, []);

  // Sync loading state to parent separately
  useEffect(() => {
    if (onRegisterControls) {
      onRegisterControls((prev) => ({ ...prev, loading }));
    }
  }, [loading]);

  // Sync nodes list to parent so ResourcePanel can read EC2s
  useEffect(() => {
    if (onRegisterControls) {
      onRegisterControls((prev) => ({ ...prev, nodes }));
    }
  }, [nodes]);

  // Sync edges to parent so SGManager can derive live SG rules
  useEffect(() => {
    if (onRegisterControls) {
      onRegisterControls((prev) => ({ ...prev, edges }));
    }
  }, [edges]);

  // Sync undo/redo availability to parent so buttons update reactively
  useEffect(() => {
    if (onRegisterControls) {
      onRegisterControls((prev) => ({ ...prev, canUndo: past.length > 0, canRedo: future.length > 0 }));
    }
  }, [past.length, future.length]);

  // Keyboard shortcuts — undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isDragging.current) return;
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      if (!ctrl) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undoRef.current(); }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redoRef.current(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Auto-create one SG per node, assign it, update App.jsx securityGroups state
  const handleAutoCreateSGs = (nodes) => {
    const SG_COLORS = [
      "#f97316", "#06b6d4", "#84cc16", "#ec4899",
      "#8b5cf6", "#14b8a6", "#f59e0b", "#6366f1",
    ];
    const newSGs = [];
    const nodeUpdates = {};
    nodes.forEach((node, i) => {
      const sgName = `${node.data.label.replace(/\./g, "-")}-sg`;
      // Skip if SG with this name already exists
      const alreadyExists = (securityGroups || []).some((s) => s.name === sgName);
      if (alreadyExists) return;
      const sg = {
        id:       `sg_auto_${Date.now()}_${i}`,
        name:     sgName,
        color:    SG_COLORS[i % SG_COLORS.length],
        inbound:  [],
        outbound: [{ port: "0", protocol: "ALL", cidr: "0.0.0.0/0" }],
      };
      newSGs.push(sg);
      nodeUpdates[node.id] = sg.id;
    });

    if (newSGs.length > 0) {
      snapshotRef.current();
      if (onSGChange) onSGChange([...(securityGroups || []), ...newSGs]);
      setNodes((nds) => nds.map((n) =>
        nodeUpdates[n.id]
          ? { ...n, data: { ...n.data, config: { ...n.data.config, sg_ids: [nodeUpdates[n.id]] } } }
          : n
      ));
      showToast(`Created ${newSGs.length} Security Group${newSGs.length !== 1 ? "s" : ""} — review and edit in the Configure tab.`);
    }
    setPendingSGPrompt(null);
  };

  return (
    <div style={{ flex: 1, minWidth: 0, height: "100%", position: "relative", display: "flex" }}>

      {pendingSGPrompt && (
        <SGAutoCreateModal
          missingNodes={pendingSGPrompt}
          onAutoCreate={handleAutoCreateSGs}
          onSkip={() => { setPendingSGPrompt(null); showToast("Canvas imported."); }}
        />
      )}

      {pendingDrop && (
        <ConfigModal
          resourceType={pendingDrop.type}
          canvasNodes={nodes}
          region={region}
          roles={roles}
          securityGroups={securityGroups}
          onSave={onModalSave}
          onCancel={() => setPendingDrop(null)}
        />
      )}

      {editingNode && (
        <ConfigModal
          resourceType={editingNode.data.resourceType}
          existingConfig={editingNode.data.config || {}}
          canvasNodes={nodes}
          editingNodeId={editingNode.id}
          region={region}
          roles={roles}
          securityGroups={securityGroups}
          onSave={onEditSave}
          onCancel={() => setEditingNode(null)}
        />
      )}

      {/* Export filename modal */}
      {exportModalOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "var(--bg-elevated)", borderRadius: 10, padding: 24, minWidth: 340,
            boxShadow: "0 8px 40px rgba(0,0,0,0.6)", border: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>Export Canvas</h3>
              <span onClick={() => setExportModalOpen(false)} style={{ cursor: "pointer", color: "#999", fontSize: 18 }}>✕</span>
            </div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>Filename</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doExport(exportFilename)}
                autoFocus
                style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, outline: "none", background: "var(--bg-surface)", color: "var(--text-primary)" }}
              />
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>.json</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
              <button onClick={() => setExportModalOpen(false)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 18px", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => doExport(exportFilename)} style={{ background: "var(--accent)", color: "white", border: "none", borderRadius: 6, padding: "8px 18px", cursor: "pointer", fontWeight: 500 }}>
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edge create modal */}
      {pendingEdge && (
        <EdgeConfigModal
          sourceLabel={getNodeLabel(pendingEdge.source)}
          targetLabel={getNodeLabel(pendingEdge.target)}
          onSave={onEdgeModalSave}
          onCancel={() => setPendingEdge(null)}
        />
      )}

      {/* Edge edit modal */}
      {editingEdge && (
        <EdgeConfigModal
          edgeId={editingEdge.id}
          existingIngress={editingEdge.data?.ingress || []}
          existingEgress={editingEdge.data?.egress || []}
          sourceLabel={getNodeLabel(editingEdge.source)}
          targetLabel={getNodeLabel(editingEdge.target)}
          onSave={onEdgeEditSave}
          onDelete={() => onEdgeDelete(editingEdge.id)}
          onCancel={() => setEditingEdge(null)}
        />
      )}

      {toast && (
        <div style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          background: toast.isError ? "var(--danger)" : "var(--success)",
          color: "white",
          padding: "8px 20px",
          borderRadius: 6,
          zIndex: 100,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onSelectionChange={handleSelectionChange}
        onEdgeClick={onEdgeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={["Backspace", "Delete"]}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      {reviewOpen && (
        <ReviewPanel
          nodes={nodes}
          edges={edges}
          region={region}
          roles={roles}
          securityGroups={securityGroups}
          width={reviewPanelWidth}
          onStartDrag={onReviewPanelDrag}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}

export default function InfraCanvas(props) {
  return (
    <RolesContext.Provider value={props.roles || []}>
      <SecurityGroupsContext.Provider value={props.securityGroups || []}>
        <ReactFlowProvider>
          <Canvas {...props} />
        </ReactFlowProvider>
      </SecurityGroupsContext.Provider>
    </RolesContext.Provider>
  );
}