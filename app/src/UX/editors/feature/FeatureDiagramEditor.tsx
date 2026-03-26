// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE DIAGRAM EDITOR
 * ======================
 *
 * Displays the feature pipeline as a visual node diagram using xyflow/react.
 *
 * ARCHITECTURE:
 * - Uses ReactFlow to render an interactive node-based diagram
 * - Feature rules are displayed at the top as entry points
 * - Composite features (aggregate, sequence, scatter, etc.) show child connections
 * - Terminal features (single_block, ore, tree, etc.) are leaf nodes
 * - Unfulfilled dependencies are shown with warning styling
 * - Weights for weighted_random_feature are displayed on edges
 *
 * NODE TYPES:
 * - feature-rule: Entry point nodes (green, at top)
 * - feature: Feature nodes (various colors based on type)
 *
 * EDGE TYPES:
 * - feature-dependency: Shows parent-child relationships with optional weight labels
 */

import { Component } from "react";
import Project from "../../../app/Project";
import CreatorTools from "../../../app/CreatorTools";
import IFile from "../../../storage/IFile";
import Log from "../../../core/Log";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Edge,
  Node,
  NodeChange,
  NodeSelectionChange,
  NodePositionChange,
  NodeDimensionChange,
  EdgeChange,
  Connection,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";
import {
  IFeaturePipeline,
  FeaturePipelineNode,
  getShortId,
  getFeatureTypeName,
  flattenPipeline,
} from "./FeaturePipelineUtilities";
import FeatureNodeComponent from "./FeatureNode";
import FeatureRuleNodeComponent from "./FeatureRuleNode";
import FeatureDependencyEdge from "./FeatureDependencyEdge";
import FeatureDefinition from "../../../minecraft/FeatureDefinition";
import { ProjectItemType } from "../../../app/IProjectItemData";
import ProjectItem from "../../../app/ProjectItem";
import FeatureComponentEditor from "./FeatureComponentEditor";
import { IExtendedFeatureNodeData, IWeightedChildNode, hasNodeId } from "./FeatureDiagramTypes";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation, faFileLines, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import "./FeatureDiagramEditor.css";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

// ═══════════════════════════════════════════════════════════════════════════
// DIAGRAM LAYOUT CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DIAGRAM_RULE_Y_START = 50;
const DIAGRAM_RULE_X_SPACING = 350;
const DIAGRAM_FEATURE_Y_SPACING = 180;
const DIAGRAM_FEATURE_X_SPACING = 280;
const DIAGRAM_INITIAL_X = 100;
const DIAGRAM_UNUSED_FEATURES_X_OFFSET = 600; // X position for unused features panel

interface IFeatureDiagramEditorProps {
  pipeline: IFeaturePipeline;
  selectedNode: FeaturePipelineNode | undefined;
  onNodeSelected: (node: FeaturePipelineNode | undefined) => void;
  onConnectionAdded?: (sourceNodeId: string, targetFeatureId: string) => void;
  onConnectionRemoved?: (sourceNodeId: string, targetFeatureId: string) => void;
  onPipelineChanged?: () => void;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
  heightOffset: number;
  readOnly?: boolean;
  refreshKey?: number;
}

interface IFeatureDiagramEditorState {
  nodes: Node[];
  edges: Edge[];
  nodeMap: Map<string, FeaturePipelineNode>;
  unusedFeatureNodes: Map<string, { item: ProjectItem; id: string; shortId: string; featureType: string }>;
  showConnectionPicker: boolean;
  pendingConnectionSource: string | undefined;
  pendingConnectionSourceHandle: string | undefined;
}

export default class FeatureDiagramEditor extends Component<IFeatureDiagramEditorProps, IFeatureDiagramEditorState> {
  constructor(props: IFeatureDiagramEditorProps) {
    super(props);

    this._handleNodesChange = this._handleNodesChange.bind(this);
    this._handleEdgesChange = this._handleEdgesChange.bind(this);
    this._handleConnect = this._handleConnect.bind(this);
    this._handleConnectEnd = this._handleConnectEnd.bind(this);
    this._handleConnectStart = this._handleConnectStart.bind(this);
    this._isValidConnection = this._isValidConnection.bind(this);
    this._handleConnectionPickerClose = this._handleConnectionPickerClose.bind(this);
    this._handleSelectExistingFeature = this._handleSelectExistingFeature.bind(this);
    this._handleCreateNewFeature = this._handleCreateNewFeature.bind(this);

    const { nodes, edges, nodeMap, unusedFeatureNodes } = this._generateNodesAndEdges(props.pipeline);
    this.state = {
      nodes,
      edges,
      nodeMap,
      unusedFeatureNodes,
      showConnectionPicker: false,
      pendingConnectionSource: undefined,
      pendingConnectionSourceHandle: undefined,
    };
  }

  async componentDidMount() {
    // Load unused features
    await this._loadUnusedFeatures();
  }

  async componentDidUpdate(prevProps: IFeatureDiagramEditorProps) {
    // Regenerate diagram if pipeline changes or refresh is requested
    if (prevProps.pipeline !== this.props.pipeline || prevProps.refreshKey !== this.props.refreshKey) {
      const { nodes, edges, nodeMap, unusedFeatureNodes } = this._generateNodesAndEdges(this.props.pipeline);
      this.setState({ nodes, edges, nodeMap, unusedFeatureNodes }, async () => {
        // Reload unused features after state update
        await this._loadUnusedFeatures();
      });
    }
  }

  async _loadUnusedFeatures() {
    // Find features in the project that aren't part of the current pipeline
    const usedIds = new Set<string>();
    const usedPaths = new Set<string>();

    for (const node of this.props.pipeline.allNodes) {
      if (node.nodeType !== "unfulfilledFeature") {
        usedIds.add(node.id);
        if (node.item.projectPath) {
          usedPaths.add(node.item.projectPath);
        }
      }
    }

    const unusedFeatureNodes = new Map<
      string,
      { item: ProjectItem; id: string; shortId: string; featureType: string }
    >();

    for (const item of this.props.project.items) {
      if (item.itemType === ProjectItemType.featureBehavior) {
        // Skip if this item's path is already in the pipeline
        if (item.projectPath && usedPaths.has(item.projectPath)) {
          continue;
        }

        if (!item.isContentLoaded) {
          await item.loadContent();
        }
        if (item.primaryFile) {
          const featureDef = await FeatureDefinition.ensureOnFile(item.primaryFile);
          if (featureDef && featureDef.id && !usedIds.has(featureDef.id)) {
            const nodeId = item.projectPath || featureDef.id;
            unusedFeatureNodes.set(nodeId, {
              item,
              id: featureDef.id,
              shortId: getShortId(featureDef.id),
              featureType: featureDef.typeString || "unknown",
            });
          }
        }
      }
    }

    // Add unused feature nodes to the diagram if any found
    if (unusedFeatureNodes.size > 0) {
      this._addUnusedFeatureNodesToState(unusedFeatureNodes);
    }
  }

  _addUnusedFeatureNodesToState(
    unusedFeatureNodes: Map<string, { item: ProjectItem; id: string; shortId: string; featureType: string }>
  ) {
    const nodes = [...this.state.nodes];
    const existingNodeIds = new Set(nodes.map((n) => n.id));

    // Find the rightmost X position of existing nodes
    let maxX = DIAGRAM_INITIAL_X;
    for (const node of nodes) {
      if (node.position.x > maxX) {
        maxX = node.position.x;
      }
    }

    // Position unused features to the right, in a column
    const unusedX = maxX + DIAGRAM_UNUSED_FEATURES_X_OFFSET;
    let unusedY = DIAGRAM_RULE_Y_START;

    for (const [nodeId, featureInfo] of unusedFeatureNodes) {
      // Skip if already in the diagram (check both by nodeId and by feature ID)
      if (existingNodeIds.has(nodeId)) continue;
      if (this.state.nodeMap.has(nodeId)) continue;

      nodes.push({
        id: nodeId,
        type: "feature",
        position: { x: unusedX, y: unusedY },
        data: {
          id: featureInfo.id,
          shortId: featureInfo.shortId,
          featureType: featureInfo.featureType,
          isUnfulfilled: false,
          isVanillaReference: false,
          childFeatureIds: [],
          theme: this.props.theme,
          isUnused: true, // Mark as unused for styling
        },
        className: "fde-unused-node",
      });

      unusedY += 100; // Spacing for unused nodes
    }

    this.setState({ nodes, unusedFeatureNodes });
  }

  _getNodeId(node: FeaturePipelineNode): string {
    if (node.nodeType === "unfulfilledFeature") {
      return "unfulfilled:" + node.referencedId;
    }
    return node.item.projectPath || node.id;
  }

  _generateNodesAndEdges(pipeline: IFeaturePipeline): {
    nodes: Node[];
    edges: Edge[];
    nodeMap: Map<string, FeaturePipelineNode>;
    unusedFeatureNodes: Map<string, { item: ProjectItem; id: string; shortId: string; featureType: string }>;
  } {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeMap = new Map<string, FeaturePipelineNode>();
    const unusedFeatureNodes = new Map<
      string,
      { item: ProjectItem; id: string; shortId: string; featureType: string }
    >();
    const addedNodeIds = new Set<string>();
    const addedEdgeIds = new Set<string>();

    // Track positions to avoid overlaps
    const columnPositions: Map<number, number> = new Map(); // depth -> next X position

    // Position calculation helper
    const positionNode = (depth: number, parentX?: number): { x: number; y: number } => {
      const y = DIAGRAM_RULE_Y_START + depth * DIAGRAM_FEATURE_Y_SPACING;

      let x: number;
      if (parentX !== undefined) {
        // Position near parent but check for collisions
        const currentColX = columnPositions.get(depth) || DIAGRAM_INITIAL_X;
        x = Math.max(parentX, currentColX);
      } else {
        x = columnPositions.get(depth) || DIAGRAM_INITIAL_X;
      }

      // Update column position for next node at this depth
      columnPositions.set(depth, x + DIAGRAM_FEATURE_X_SPACING);

      return { x, y };
    };

    // Recursive function to add nodes and edges
    const addNodeRecursive = (
      pipelineNode: FeaturePipelineNode,
      depth: number,
      parentNodeId?: string,
      parentHandleId?: string,
      weight?: number,
      parentX?: number
    ) => {
      const nodeId = this._getNodeId(pipelineNode);

      // Don't add duplicate nodes
      if (addedNodeIds.has(nodeId)) {
        // But do add edges if there's a parent
        if (parentNodeId && parentHandleId) {
          const edgeId = `${parentNodeId}-${nodeId}`;
          if (!addedEdgeIds.has(edgeId)) {
            edges.push({
              id: edgeId,
              source: parentNodeId,
              sourceHandle: parentHandleId,
              target: nodeId,
              targetHandle: "target",
              type: "feature-dependency",
              data: {
                weight,
                dependencyType: depth === 1 ? "places" : "child",
                sourceId: parentNodeId,
                targetId: nodeId,
                isUnfulfilled: pipelineNode.nodeType === "unfulfilledFeature",
              },
            });
            addedEdgeIds.add(edgeId);
          }
        }
        return;
      }

      addedNodeIds.add(nodeId);
      nodeMap.set(nodeId, pipelineNode);

      const position = positionNode(depth, parentX);

      // Create the node
      if (pipelineNode.nodeType === "unfulfilledFeature") {
        nodes.push({
          id: nodeId,
          type: "feature",
          position,
          data: {
            id: pipelineNode.referencedId,
            shortId: getShortId(pipelineNode.referencedId),
            featureType: "unknown",
            isUnfulfilled: true,
            isVanillaReference: pipelineNode.isVanillaReference,
            childFeatureIds: [],
            weight: pipelineNode.weight,
            theme: this.props.theme,
          },
        });
      } else if (pipelineNode.nodeType === "featureRule") {
        nodes.push({
          id: nodeId,
          type: "feature-rule",
          position,
          data: {
            id: pipelineNode.id,
            shortId: pipelineNode.shortId,
            theme: this.props.theme,
          },
        });
      } else {
        // Regular feature
        const childIds = pipelineNode.children.map((child) =>
          child.nodeType === "unfulfilledFeature" ? child.referencedId : child.id
        );

        nodes.push({
          id: nodeId,
          type: "feature",
          position,
          data: {
            id: pipelineNode.id,
            shortId: pipelineNode.shortId,
            featureType: pipelineNode.featureType || "unknown",
            isUnfulfilled: false,
            isVanillaReference: false,
            childFeatureIds: childIds,
            weight: pipelineNode.weight,
            theme: this.props.theme,
          },
        });
      }

      // Add edge from parent
      if (parentNodeId && parentHandleId) {
        const edgeId = `${parentNodeId}-${nodeId}`;
        if (!addedEdgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: parentNodeId,
            sourceHandle: parentHandleId,
            target: nodeId,
            targetHandle: "target",
            type: "feature-dependency",
            data: {
              weight,
              dependencyType: depth === 1 ? "places" : "child",
              sourceId: parentNodeId,
              targetId: nodeId,
              isUnfulfilled: pipelineNode.nodeType === "unfulfilledFeature",
            },
          });
          addedEdgeIds.add(edgeId);
        }
      }

      // Process children
      if (pipelineNode.nodeType !== "unfulfilledFeature") {
        pipelineNode.children.forEach((child, index) => {
          const handleId = pipelineNode.nodeType === "featureRule" ? "places" : `child-${index}`;

          // Get weight if available (for weighted_random_feature)
          const childWeight = (child as IWeightedChildNode).weight;

          addNodeRecursive(child, depth + 1, nodeId, handleId, childWeight, position.x);
        });
      }
    };

    // Start from roots
    pipeline.roots.forEach((root, index) => {
      // Spread roots horizontally
      const rootX = DIAGRAM_INITIAL_X + index * DIAGRAM_RULE_X_SPACING;
      columnPositions.set(0, rootX + DIAGRAM_FEATURE_X_SPACING);
      addNodeRecursive(root, 0, undefined, undefined, undefined, rootX);
    });

    return { nodes, edges, nodeMap, unusedFeatureNodes };
  }

  _handleNodesChange(nodeChanges: NodeChange[]) {
    const nodes = [...this.state.nodes];
    let selectedPipelineNode: FeaturePipelineNode | undefined = undefined;
    let hasSelectionChange = false;
    let anyNodeSelected = false;

    for (const change of nodeChanges) {
      if (!hasNodeId(change)) continue;
      const nodeIndex = nodes.findIndex((n) => n.id === change.id);
      if (nodeIndex === -1) continue;

      const node = nodes[nodeIndex];

      if (change.type === "position") {
        const pos = (change as NodePositionChange).position;
        if (pos) {
          nodes[nodeIndex] = { ...node, position: pos };
        }
      } else if (change.type === "select") {
        const isSelected = (change as NodeSelectionChange).selected;
        const wasSelected = node.selected;
        nodes[nodeIndex] = { ...node, selected: isSelected };
        hasSelectionChange = true;

        if (isSelected) {
          anyNodeSelected = true;
          const pipelineNode = this.state.nodeMap.get(node.id);

          // Check if this node was already selected (toggle behavior)
          const currentSelectedId = this.props.selectedNode
            ? this.props.selectedNode.nodeType === "unfulfilledFeature"
              ? "unfulfilled:" + this.props.selectedNode.referencedId
              : this.props.selectedNode.item?.projectPath || this.props.selectedNode.id
            : undefined;

          if (currentSelectedId === node.id && wasSelected) {
            // Toggle off - clicking already selected node deselects it
            selectedPipelineNode = undefined;
            nodes[nodeIndex] = { ...node, selected: false };
          } else {
            selectedPipelineNode = pipelineNode;
          }
        }
      } else if (change.type === "dimensions") {
        const dims = (change as NodeDimensionChange).dimensions;
        if (dims) {
          nodes[nodeIndex] = { ...node, width: dims.width, height: dims.height };
        }
      }
    }

    this.setState({ nodes });

    // Notify parent of selection change
    if (hasSelectionChange) {
      if (selectedPipelineNode !== undefined) {
        this.props.onNodeSelected(selectedPipelineNode);
      } else if (!anyNodeSelected) {
        // All nodes were deselected
        this.props.onNodeSelected(undefined);
      }
    }
  }

  _handleEdgesChange(edgeChanges: EdgeChange[]) {
    if (this.props.readOnly) return;

    for (const change of edgeChanges) {
      if (change.type === "remove") {
        // Find the edge being removed
        const edge = this.state.edges.find((e) => e.id === change.id);
        if (edge) {
          this._removeConnection(edge.source, edge.target);
        }
      }
    }
  }

  _isValidConnection(connection: Connection): boolean {
    if (this.props.readOnly) return false;

    // Don't allow self-connections
    if (connection.source === connection.target) return false;

    // Don't allow duplicate connections
    const existingEdge = this.state.edges.find((e) => e.source === connection.source && e.target === connection.target);
    if (existingEdge) return false;

    // Source must be a composite feature or feature rule
    const sourceNode = this.state.nodeMap.get(connection.source || "");
    if (!sourceNode) return false;

    // Target can be any feature in the diagram (including unused ones)
    // Check if the target is in the nodeMap or unusedFeatureNodes
    const targetNode = this.state.nodeMap.get(connection.target || "");
    const targetUnused = this.state.unusedFeatureNodes.get(connection.target || "");
    if (!targetNode && !targetUnused) return false;
    if (targetNode && targetNode.nodeType === "unfulfilledFeature") return false;

    return true;
  }

  _handleConnectStart(
    event: any,
    params: { nodeId: string | null; handleId: string | null; handleType: string | null }
  ) {
    // Store the pending connection source for when user drops in empty space
    if (params.nodeId && params.handleType === "source") {
      this.setState({
        pendingConnectionSource: params.nodeId,
        pendingConnectionSourceHandle: params.handleId || undefined,
      });
    }
  }

  _handleConnectEnd(event: MouseEvent | TouchEvent) {
    // Check if the connection ended over empty space (not on a node)
    // If so, show the connection picker dialog
    const target = event.target as HTMLElement;

    // If dropped on a node handle or node, the onConnect handler will handle it
    // Only show picker if dropped on the background (canvas)
    const isOnBackground =
      target.classList.contains("react-flow__pane") || target.classList.contains("react-flow__background");

    if (isOnBackground && this.state.pendingConnectionSource && !this.props.readOnly) {
      this.setState({ showConnectionPicker: true });
    } else {
      // Clear the pending connection
      this.setState({
        pendingConnectionSource: undefined,
        pendingConnectionSourceHandle: undefined,
      });
    }
  }

  _handleConnectionPickerClose() {
    this.setState({
      showConnectionPicker: false,
      pendingConnectionSource: undefined,
      pendingConnectionSourceHandle: undefined,
    });
  }

  async _handleSelectExistingFeature(featureId: string) {
    const sourceNodeId = this.state.pendingConnectionSource;
    if (!sourceNodeId) return;

    const sourceNode = this.state.nodeMap.get(sourceNodeId);
    if (!sourceNode || sourceNode.nodeType === "unfulfilledFeature") return;

    // Add the connection
    await this._addConnectionToFile(sourceNode, featureId);

    // Notify parent of the change
    if (this.props.onConnectionAdded) {
      this.props.onConnectionAdded(sourceNodeId, featureId);
    }
    if (this.props.onPipelineChanged) {
      this.props.onPipelineChanged();
    }

    this.setState({
      showConnectionPicker: false,
      pendingConnectionSource: undefined,
      pendingConnectionSourceHandle: undefined,
    });
  }

  async _handleCreateNewFeature(featureType: string, featureName: string) {
    const sourceNodeId = this.state.pendingConnectionSource;
    if (!sourceNodeId) return;

    const sourceNode = this.state.nodeMap.get(sourceNodeId);
    if (!sourceNode || sourceNode.nodeType === "unfulfilledFeature") return;

    // TODO: Create the new feature file and add connection
    // For now, just close the picker - full implementation would:
    // 1. Create new feature file in the project
    // 2. Add the connection to the source node
    // 3. Trigger pipeline refresh

    this.setState({
      showConnectionPicker: false,
      pendingConnectionSource: undefined,
      pendingConnectionSourceHandle: undefined,
    });
  }

  async _handleConnect(connection: Connection) {
    if (this.props.readOnly) return;
    if (!connection.source || !connection.target) return;

    // Clear pending connection since we successfully connected
    this.setState({
      pendingConnectionSource: undefined,
      pendingConnectionSourceHandle: undefined,
    });

    const sourceNode = this.state.nodeMap.get(connection.source);

    // Target can be either in the pipeline nodeMap or in unusedFeatureNodes
    let targetFeatureId: string | undefined;
    const targetNode = this.state.nodeMap.get(connection.target);
    const targetUnused = this.state.unusedFeatureNodes.get(connection.target);

    if (targetNode && targetNode.nodeType !== "unfulfilledFeature") {
      targetFeatureId = targetNode.id;
    } else if (targetUnused) {
      targetFeatureId = targetUnused.id;
    }

    if (!sourceNode || !targetFeatureId) return;

    // Update the source node's file to add the connection
    await this._addConnectionToFile(sourceNode, targetFeatureId);

    // Notify parent of the change
    if (this.props.onConnectionAdded) {
      this.props.onConnectionAdded(connection.source, targetFeatureId);
    }
    if (this.props.onPipelineChanged) {
      this.props.onPipelineChanged();
    }
  }

  async _addConnectionToFile(sourceNode: FeaturePipelineNode, targetFeatureId: string) {
    if (sourceNode.nodeType === "unfulfilledFeature") return;

    const file = sourceNode.item.primaryFile;
    if (!file) return;

    await file.loadContent(false);
    const content = file.content;
    if (typeof content !== "string") return;

    try {
      const jsonData = JSON.parse(content);

      if (sourceNode.nodeType === "featureRule") {
        // Update places_feature in feature rule
        if (jsonData["minecraft:feature_rules"]?.description) {
          jsonData["minecraft:feature_rules"].description.places_feature = targetFeatureId;
        }
      } else {
        // Update feature based on type
        const featureType = sourceNode.featureType;
        const featureData = jsonData["minecraft:" + featureType];
        if (!featureData) return;

        if (featureType === "aggregate_feature" || featureType === "sequence_feature") {
          // Add to features array
          if (!featureData.features) {
            featureData.features = [];
          }
          if (!featureData.features.includes(targetFeatureId)) {
            featureData.features.push(targetFeatureId);
          }
        } else if (featureType === "weighted_random_feature") {
          // Add as [featureId, weight] tuple
          if (!featureData.features) {
            featureData.features = [];
          }
          // Check if already exists
          const exists = featureData.features.some((f: any) => (Array.isArray(f) ? f[0] : f) === targetFeatureId);
          if (!exists) {
            featureData.features.push([targetFeatureId, 1]); // Default weight of 1
          }
        } else if (
          featureType === "scatter_feature" ||
          featureType === "search_feature" ||
          featureType === "beards_and_shavers"
        ) {
          featureData.places_feature = targetFeatureId;
        } else if (featureType === "snap_to_surface_feature") {
          featureData.feature_to_snap = targetFeatureId;
        } else if (featureType === "surface_relative_threshold_feature") {
          featureData.feature_to_place = targetFeatureId;
        } else if (featureType === "vegetation_patch_feature") {
          featureData.vegetation_feature = targetFeatureId;
        }
      }

      file.setContent(JSON.stringify(jsonData, null, 2));
      await file.saveContent();

      if (file.manager) {
        await file.manager.persist();
      }
    } catch (e) {
      Log.verbose("JSON parse error in FeatureDiagramEditor._addConnection: " + e);
    }
  }

  async _removeConnection(sourceNodeId: string, targetNodeId: string) {
    const sourceNode = this.state.nodeMap.get(sourceNodeId);
    const targetNode = this.state.nodeMap.get(targetNodeId);

    if (!sourceNode || sourceNode.nodeType === "unfulfilledFeature") return;

    const targetFeatureId =
      targetNode?.nodeType === "unfulfilledFeature" ? targetNode.referencedId : targetNode?.id || "";

    const file = sourceNode.item.primaryFile;
    if (!file) return;

    await file.loadContent(false);
    const content = file.content;
    if (typeof content !== "string") return;

    try {
      const jsonData = JSON.parse(content);

      if (sourceNode.nodeType === "featureRule") {
        // Clear places_feature in feature rule
        if (jsonData["minecraft:feature_rules"]?.description) {
          delete jsonData["minecraft:feature_rules"].description.places_feature;
        }
      } else {
        // Update feature based on type
        const featureType = sourceNode.featureType;
        const featureData = jsonData["minecraft:" + featureType];
        if (!featureData) return;

        if (featureType === "aggregate_feature" || featureType === "sequence_feature") {
          // Remove from features array
          if (Array.isArray(featureData.features)) {
            featureData.features = featureData.features.filter((f: string) => f !== targetFeatureId);
          }
        } else if (featureType === "weighted_random_feature") {
          // Remove from features array (handles both string and tuple format)
          if (Array.isArray(featureData.features)) {
            featureData.features = featureData.features.filter(
              (f: any) => (Array.isArray(f) ? f[0] : f) !== targetFeatureId
            );
          }
        } else if (
          featureType === "scatter_feature" ||
          featureType === "search_feature" ||
          featureType === "beards_and_shavers"
        ) {
          if (featureData.places_feature === targetFeatureId) {
            delete featureData.places_feature;
          }
        } else if (featureType === "snap_to_surface_feature") {
          if (featureData.feature_to_snap === targetFeatureId) {
            delete featureData.feature_to_snap;
          }
        } else if (featureType === "surface_relative_threshold_feature") {
          if (featureData.feature_to_place === targetFeatureId) {
            delete featureData.feature_to_place;
          }
        } else if (featureType === "vegetation_patch_feature") {
          if (featureData.vegetation_feature === targetFeatureId) {
            delete featureData.vegetation_feature;
          }
        }
      }

      file.setContent(JSON.stringify(jsonData, null, 2));
      await file.saveContent();

      if (file.manager) {
        await file.manager.persist();
      }

      // Notify parent of the change
      if (this.props.onConnectionRemoved) {
        this.props.onConnectionRemoved(sourceNodeId, targetFeatureId);
      }
      if (this.props.onPipelineChanged) {
        this.props.onPipelineChanged();
      }
    } catch (e) {
      Log.verbose("JSON parse error in FeatureDiagramEditor._removeConnection: " + e);
    }
  }

  _setActivePersistable = (file: IFile | undefined) => {
    // This could be used to navigate to a file, but for now we just track selection
    // The parent component can handle file navigation if needed
  };

  _renderPipelinePreview(): JSX.Element {
    // Generate a verbal summary of the feature chain
    const allNodes = flattenPipeline(this.props.pipeline.roots);

    if (allNodes.length === 0) {
      return (
        <div className="fde-previewEmpty">
          <div className="fde-previewEmptyMessage">No features to preview.</div>
        </div>
      );
    }

    // Group nodes by depth for a hierarchical display
    const nodesByDepth: Map<number, FeaturePipelineNode[]> = new Map();
    for (const node of allNodes) {
      const depth = node.depth;
      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(node);
    }

    const previewItems: JSX.Element[] = [];
    const sortedDepths = Array.from(nodesByDepth.keys()).sort((a, b) => a - b);

    for (const depth of sortedDepths) {
      const nodesAtDepth = nodesByDepth.get(depth) || [];

      for (const node of nodesAtDepth) {
        let summaryText = "";
        let icon = faLayerGroup;
        let iconClass = "fde-previewIcon";

        if (node.nodeType === "unfulfilledFeature") {
          summaryText = node.isVanillaReference
            ? `References vanilla feature: ${getShortId(node.referencedId)}`
            : `Missing feature: ${getShortId(node.referencedId)}`;
          icon = faTriangleExclamation;
          iconClass = "fde-previewIcon fde-previewIconWarning";
        } else if (node.nodeType === "featureRule") {
          summaryText = `Feature rule "${getShortId(node.id)}" places features in the world`;
          icon = faFileLines;
          iconClass = "fde-previewIcon fde-previewIconRule";
        } else {
          const typeName = getFeatureTypeName(node.featureType);
          const shortId = getShortId(node.id);

          // Generate contextual description based on feature type
          switch (node.featureType) {
            case "aggregate_feature":
              summaryText = `"${shortId}" combines ${node.children.length} features together`;
              break;
            case "sequence_feature":
              summaryText = `"${shortId}" places ${node.children.length} features in sequence`;
              break;
            case "weighted_random_feature":
              summaryText = `"${shortId}" randomly selects from ${node.children.length} features`;
              break;
            case "scatter_feature":
              summaryText = `"${shortId}" scatters features across the terrain`;
              break;
            case "search_feature":
              summaryText = `"${shortId}" searches for valid placement locations`;
              break;
            case "snap_to_surface_feature":
              summaryText = `"${shortId}" snaps features to the surface`;
              break;
            case "surface_relative_threshold_feature":
              summaryText = `"${shortId}" places features relative to surface threshold`;
              break;
            case "single_block_feature":
              summaryText = `"${shortId}" places a single block`;
              break;
            case "ore_feature":
              summaryText = `"${shortId}" generates ore deposits`;
              break;
            case "tree_feature":
              summaryText = `"${shortId}" generates a tree structure`;
              break;
            case "geode_feature":
              summaryText = `"${shortId}" generates a geode formation`;
              break;
            case "structure_template_feature":
              summaryText = `"${shortId}" places a structure template`;
              break;
            case "cave_carver_feature":
            case "underwater_cave_carver_feature":
            case "nether_cave_carver_feature":
              summaryText = `"${shortId}" carves cave passages`;
              break;
            case "vegetation_patch_feature":
              summaryText = `"${shortId}" creates vegetation patches`;
              break;
            default:
              summaryText = `"${shortId}" (${typeName})`;
          }
        }

        previewItems.push(
          <div
            key={`preview-${node.nodeType === "unfulfilledFeature" ? node.referencedId : node.id}-${depth}`}
            className="fde-previewItem"
            style={{ paddingLeft: depth * 16 + 8 }}
          >
            <FontAwesomeIcon icon={icon} className={iconClass} />
            <span className="fde-previewText">{summaryText}</span>
          </div>
        );
      }
    }

    const colors = getThemeColors();
    return (
      <div className="fde-previewContent">
        <div
          className="fde-previewHeader"
          style={{
            backgroundColor: colors.background1,
          }}
        >
          <div className="fde-previewHeaderTitle">Feature Chain Summary</div>
          <div className="fde-previewHeaderSubtitle">
            {allNodes.length} feature{allNodes.length !== 1 ? "s" : ""} in this pipeline
          </div>
        </div>
        <div className="fde-previewList">{previewItems}</div>
      </div>
    );
  }

  _renderRightPanel(): JSX.Element {
    const selectedNode = this.props.selectedNode;

    // If a node is selected, show the form editor
    if (selectedNode) {
      // For unfulfilled features, show a warning state
      if (selectedNode.nodeType === "unfulfilledFeature") {
        return (
          <div className="fde-rightPanelContent">
            <div
              className="fde-rightPanelHeader"
              style={{
                backgroundColor: getThemeColors().background1,
              }}
            >
              <div className="fde-rightPanelHeaderTitle">{getShortId(selectedNode.referencedId)}</div>
              <div className="fde-rightPanelHeaderSubtitle">
                {selectedNode.isVanillaReference ? "Vanilla Feature" : "Missing Feature"}
              </div>
            </div>
            <div className="fde-unfulfilledPanel">
              <div className="fde-unfulfilledIcon">
                <FontAwesomeIcon icon={faTriangleExclamation} />
              </div>
              <div className="fde-unfulfilledMessage">
                {selectedNode.isVanillaReference
                  ? `This feature (${selectedNode.referencedId}) is a vanilla Minecraft feature and cannot be edited.`
                  : `The feature "${selectedNode.referencedId}" was not found in this project. You may need to create it.`}
              </div>
            </div>
          </div>
        );
      }

      // For regular nodes, show the component editor
      const headerTitle = selectedNode.shortId || getShortId(selectedNode.id);
      const headerSubtitle =
        selectedNode.nodeType === "featureRule" ? "Feature Rule" : getFeatureTypeName(selectedNode.featureType);

      return (
        <div className="fde-rightPanelContent">
          <div
            className="fde-rightPanelHeader"
            style={{
              backgroundColor: getThemeColors().background1,
            }}
          >
            <div className="fde-rightPanelHeaderTitle">{headerTitle}</div>
            <div className="fde-rightPanelHeaderSubtitle">{headerSubtitle}</div>
          </div>
          <div className="fde-rightPanelEditor">
            <FeatureComponentEditor
              selectedNode={selectedNode}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              heightOffset={this.props.heightOffset + 80}
              setActivePersistable={this._setActivePersistable}
              readOnly={this.props.readOnly || false}
            />
          </div>
        </div>
      );
    }

    // No node selected - show the pipeline preview
    return this._renderPipelinePreview();
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";

    const diagramColors = getThemeColors();

    if (this.state.nodes.length === 0) {
      return (
        <div
          className="fde-empty"
          style={{
            minHeight: height,
            maxHeight: height,
            backgroundColor: diagramColors.background3,
          }}
        >
          <div className="fde-emptyMessage">No features in this pipeline to display.</div>
        </div>
      );
    }

    return (
      <div
        className="fde-outerContainer"
        style={{
          height: height,
        }}
      >
        {/* Left panel - Diagram */}
        <div
          className="fde-diagramPanel"
          style={{
            backgroundColor: diagramColors.background3,
          }}
        >
          <ReactFlow
            key={`${
              this.props.pipeline.startingNode?.nodeType !== "unfulfilledFeature"
                ? this.props.pipeline.startingNode?.item?.projectPath || "pipeline"
                : "pipeline"
            }-${this.props.refreshKey || 0}-${this.state.nodes.length}`}
            defaultNodes={this.state.nodes}
            defaultEdges={this.state.edges}
            nodeTypes={{
              feature: FeatureNodeComponent,
              "feature-rule": FeatureRuleNodeComponent,
            }}
            edgeTypes={{
              "feature-dependency": FeatureDependencyEdge,
            }}
            onNodesChange={this._handleNodesChange}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable
            colorMode={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"}
            defaultEdgeOptions={{
              type: "feature-dependency",
              markerEnd: { type: MarkerType.ArrowClosed },
            }}
          >
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.type === "feature-rule") return "#5cff5c"; // Emerald for rules
                const nodeData = node.data as IExtendedFeatureNodeData;
                if (nodeData.isUnfulfilled) return "#aa6644"; // Terracotta for missing
                if (nodeData.isUnused) return "#5a5a5a"; // Stone for unused
                return "#5ab4ff"; // Water blue for normal features
              }}
              maskColor={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "rgba(30, 30, 35, 0.7)" : "rgba(200, 200, 205, 0.7)"}
            />
            <Background gap={16} color={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.06)"} />
          </ReactFlow>
        </div>

        {/* Right panel - Form Editor or Preview */}
        <div
          className="fde-rightPanel"
          style={{
            backgroundColor: diagramColors.background2,
            color: diagramColors.foreground2,
          }}
        >
          {this._renderRightPanel()}
        </div>
      </div>
    );
  }
}
