// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE DIAGRAM TYPES
 * =====================
 *
 * Type definitions for the Feature Diagram Editor's xyflow/ReactFlow nodes and edges.
 * These interfaces provide proper typing for node data, eliminating the need for `as any` casts.
 *
 * REACTFLOW TYPING:
 * ReactFlow's Node<T> generic requires T to extend Record<string, unknown>.
 * The FeatureNodeData and FeatureRuleNodeData interfaces include index signatures
 * to satisfy this constraint while maintaining type safety for known properties.
 *
 * USAGE:
 * - Import these types in FeatureDiagramEditor.tsx
 * - Use FeatureDiagramNode for typed node arrays: Node<FeatureNodeData | FeatureRuleNodeData>[]
 * - Use IExtendedFeatureNodeData for typed access to node.data in the MiniMap
 * - Use hasNodeId() type guard for safe access to change.id
 */

import { Edge, NodeChange } from "@xyflow/react";
import { FeatureNodeData, FeatureNode as FeatureNodeType } from "./FeatureNode";
import { FeatureRuleNode as FeatureRuleNodeType } from "./FeatureRuleNode";

/**
 * Re-export the fully typed Node types from the component files.
 * These are the recommended types to use for arrays of diagram nodes.
 */
export type { FeatureNodeType as FeatureDiagramNode };
export type { FeatureRuleNodeType as FeatureRuleDiagramNode };

/**
 * Union type for all diagram nodes.
 */
export type FeatureDiagramNodeType = FeatureNodeType | FeatureRuleNodeType;

/**
 * Edge data for feature dependency connections.
 */
export interface IFeatureDependencyEdgeData {
  /** Weight for weighted_random_feature connections */
  weight?: number;
  /** Type of dependency relationship */
  dependencyType: "places" | "child";
  /** Source node ID */
  sourceId: string;
  /** Target node ID */
  targetId: string;
  /** Whether this connection points to an unfulfilled (missing) feature */
  isUnfulfilled: boolean;
  [key: string]: unknown;
}

/**
 * A ReactFlow edge representing a dependency between features.
 */
export interface IFeatureDependencyEdge extends Edge<IFeatureDependencyEdgeData> {
  type: "feature-dependency";
}

/**
 * Extended node data that includes diagram-specific flags.
 * Used by the MiniMap to determine node colors.
 *
 * This extends FeatureNodeData to add the isUnused flag that is set
 * for features not connected to any feature rule.
 */
export interface IExtendedFeatureNodeData extends FeatureNodeData {
  /** True if this feature is not connected to any feature rule */
  isUnused?: boolean;
}

/**
 * Type for NodeChange objects that have an id property.
 * Used for type-safe access to change.id in _handleNodesChange.
 */
export interface INodeChangeWithId {
  id: string;
  type: string;
  [key: string]: unknown;
}

/**
 * Checks if a NodeChange has an id property.
 */
export function hasNodeId(change: NodeChange): change is NodeChange & INodeChangeWithId {
  return "id" in change && typeof (change as { id?: unknown }).id === "string";
}

/**
 * Interface for child nodes in FeaturePipelineNode that may have a weight.
 * This allows typed access to the weight property without using `as any`.
 */
export interface IWeightedChildNode {
  weight?: number;
}

// Re-export the node data types for convenience
export type { FeatureNodeData } from "./FeatureNode";
export type { FeatureRuleNodeData } from "./FeatureRuleNode";
