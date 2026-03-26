// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE NODE
 * ============
 *
 * Custom xyflow node for displaying a feature in the diagram.
 * Shows the feature type, ID, and connection handles for dependencies.
 */

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLayerGroup,
  faListOl,
  faDice,
  faSprayCan,
  faSearch,
  faCube,
  faGem,
  faTree,
  faDiamond,
  faBuilding,
  faMountain,
  faSeedling,
  faArrowsDownToLine,
  faArrowDown,
  faTriangleExclamation,
  faQuestion,
} from "@fortawesome/free-solid-svg-icons";
import { getFeatureTypeName, isCompositeFeatureType } from "./FeaturePipelineUtilities";
import "./FeatureNode.css";
import Utilities from "../../../core/Utilities";
import { Node } from "@xyflow/react";
import IProjectTheme from "../../types/IProjectTheme";

/**
 * The Node type used for feature nodes in the diagram.
 * Provides proper typing for ReactFlow's Node generic.
 */
export type FeatureNode = Node<FeatureNodeData, "feature">;

export interface FeatureNodeData {
  id: string;
  shortId: string;
  featureType: string;
  isUnfulfilled: boolean;
  isVanillaReference: boolean;
  childFeatureIds: string[];
  weight?: number;
  theme: IProjectTheme;
  /** Index signature to satisfy ReactFlow's Record<string, unknown> constraint */
  [key: string]: unknown;
}

function getFeatureIcon(featureType: string, isUnfulfilled: boolean) {
  if (isUnfulfilled) {
    return faTriangleExclamation;
  }

  switch (featureType) {
    case "aggregate_feature":
      return faLayerGroup;
    case "sequence_feature":
      return faListOl;
    case "weighted_random_feature":
      return faDice;
    case "scatter_feature":
      return faSprayCan;
    case "search_feature":
      return faSearch;
    case "snap_to_surface_feature":
      return faArrowsDownToLine;
    case "surface_relative_threshold_feature":
      return faArrowDown;
    case "vegetation_patch_feature":
      return faSeedling;
    case "single_block_feature":
      return faCube;
    case "ore_feature":
      return faGem;
    case "tree_feature":
      return faTree;
    case "geode_feature":
      return faDiamond;
    case "structure_template_feature":
      return faBuilding;
    case "cave_carver_feature":
    case "underwater_cave_carver_feature":
    case "nether_cave_carver_feature":
      return faMountain;
    default:
      return faQuestion;
  }
}

function getNodeColor(featureType: string, isUnfulfilled: boolean, isVanilla: boolean): string {
  if (isUnfulfilled) {
    return isVanilla ? "#6a6a8a" : "#8a4a4a";
  }

  if (isCompositeFeatureType(featureType)) {
    switch (featureType) {
      case "aggregate_feature":
        return "#5a7a9a";
      case "sequence_feature":
        return "#6a8a6a";
      case "weighted_random_feature":
        return "#8a6a8a";
      case "scatter_feature":
        return "#7a8a5a";
      case "search_feature":
        return "#5a8a7a";
      default:
        return "#5a7a8a";
    }
  }

  // Terminal features
  switch (featureType) {
    case "single_block_feature":
      return "#7a6a5a";
    case "ore_feature":
      return "#8a7a5a";
    case "tree_feature":
      return "#4a7a4a";
    case "geode_feature":
      return "#7a5a8a";
    case "structure_template_feature":
      return "#6a6a7a";
    default:
      return "#5a6a7a";
  }
}

// Get CSS class name for the feature type (Minecraft block-inspired theming)
function getFeatureTypeClass(featureType: string, isUnfulfilled: boolean, isVanilla: boolean): string {
  if (isUnfulfilled) {
    return isVanilla ? "fn-vanilla-style" : "fn-unfulfilled-style";
  }

  switch (featureType) {
    case "aggregate_feature":
      return "fn-aggregate";
    case "sequence_feature":
      return "fn-sequence";
    case "weighted_random_feature":
      return "fn-weighted";
    case "scatter_feature":
      return "fn-scatter";
    case "search_feature":
      return "fn-search";
    case "tree_feature":
      return "fn-tree";
    case "ore_feature":
      return "fn-ore";
    case "single_block_feature":
      return "fn-block";
    case "geode_feature":
      return "fn-geode";
    case "structure_template_feature":
      return "fn-structure";
    case "cave_carver_feature":
    case "underwater_cave_carver_feature":
    case "nether_cave_carver_feature":
      return "fn-cave";
    case "snap_to_surface_feature":
    case "surface_relative_threshold_feature":
      return "fn-snap";
    case "vegetation_patch_feature":
      return "fn-vegetation";
    default:
      return "fn-default";
  }
}

// Generate a brief summary of what this feature does
function getFeatureSummary(featureType: string, childCount: number, weight?: number): string {
  switch (featureType) {
    case "aggregate_feature":
      return `Combines ${childCount} feature${childCount !== 1 ? "s" : ""} at same location`;
    case "sequence_feature":
      return `Runs ${childCount} feature${childCount !== 1 ? "s" : ""} in order`;
    case "weighted_random_feature":
      return `Randomly picks from ${childCount} weighted option${childCount !== 1 ? "s" : ""}`;
    case "scatter_feature":
      return "Scatters features across area with distribution";
    case "search_feature":
      return "Searches for valid placement position";
    case "snap_to_surface_feature":
      return "Adjusts position to surface level";
    case "surface_relative_threshold_feature":
      return "Places relative to surface height";
    case "single_block_feature":
      return "Places a single block";
    case "ore_feature":
      return "Generates ore vein cluster";
    case "tree_feature":
      return "Grows a tree structure";
    case "geode_feature":
      return "Creates geode formation";
    case "structure_template_feature":
      return "Places a structure template";
    case "vegetation_patch_feature":
      return "Creates patch of vegetation";
    case "cave_carver_feature":
    case "underwater_cave_carver_feature":
    case "nether_cave_carver_feature":
      return "Carves cave system";
    default:
      return "Feature";
  }
}

// Get the label for source handles based on feature type
function getHandleLabel(featureType: string): string {
  switch (featureType) {
    case "sequence_feature":
      return "Features";
    case "aggregate_feature":
      return "Features";
    case "weighted_random_feature":
      return "Features";
    case "scatter_feature":
      return "Places";
    case "search_feature":
      return "Places";
    case "snap_to_surface_feature":
      return "Feature";
    case "surface_relative_threshold_feature":
      return "Feature";
    case "vegetation_patch_feature":
      return "Feature";
    default:
      return "Child";
  }
}

export default function FeatureNodeComponent(props: NodeProps<FeatureNode>) {
  const { data, selected } = props;
  const icon = getFeatureIcon(data.featureType, data.isUnfulfilled);
  const nodeColor = getNodeColor(data.featureType, data.isUnfulfilled, data.isVanillaReference);
  const typeClass = getFeatureTypeClass(data.featureType, data.isUnfulfilled, data.isVanillaReference);
  const summary = getFeatureSummary(data.featureType, data.childFeatureIds.length, data.weight);
  const isComposite = isCompositeFeatureType(data.featureType);

  let outerClassName = `fn-outer ${typeClass}`;
  if (selected) {
    outerClassName += " fn-selected";
  }
  if (data.isUnfulfilled) {
    outerClassName += " fn-unfulfilled";
  }

  // Generate handles for child connections (for composite features)
  const childHandles = [];
  if (isComposite && data.childFeatureIds.length > 0) {
    const handleSpacing = 100 / (data.childFeatureIds.length + 2);
    for (let i = 0; i < data.childFeatureIds.length; i++) {
      childHandles.push(
        <Handle
          key={`child-${i}`}
          type="source"
          position={Position.Bottom}
          id={`child-${i}`}
          style={{ left: `${handleSpacing * (i + 1)}%` }}
        />
      );
    }
    // Also add a "new child" handle for adding more children
    childHandles.push(
      <Handle
        key="child-new"
        type="source"
        position={Position.Bottom}
        id={`child-${data.childFeatureIds.length}`}
        style={{ left: `${handleSpacing * (data.childFeatureIds.length + 1)}%` }}
      />
    );
  } else if (isComposite) {
    // Single centered handle for composite features with no children yet
    childHandles.push(<Handle key="child-default" type="source" position={Position.Bottom} id="source" />);
  }

  return (
    <>
      {/* Target handle for incoming connections */}
      <Handle type="target" position={Position.Top} id="target" />

      <div className={outerClassName}>
        <div className="fn-header">
          <span className="fn-icon">
            <FontAwesomeIcon icon={icon} />
          </span>
          <span className="fn-title">{Utilities.humanifyMinecraftName(data.shortId)}</span>
        </div>
        <div className="fn-type">
          {data.isUnfulfilled
            ? data.isVanillaReference
              ? "Vanilla Feature"
              : "Missing Feature"
            : getFeatureTypeName(data.featureType)}
        </div>
        {/* Summary text describing what this feature does */}
        <div className="fn-summary">{summary}</div>
        {data.weight !== undefined && (
          <div className="fn-weight">
            <FontAwesomeIcon icon={faDice} className="fn-weight-icon" />
            Weight: {data.weight}
          </div>
        )}
      </div>

      {/* Child handles for outgoing connections */}
      {childHandles}

      {/* Handle label for composite features */}
      {isComposite && <div className="fn-handle-label">{getHandleLabel(data.featureType)}</div>}

      {/* Single source handle for non-composite features (they don't have children) */}
      {!isComposite && !data.isUnfulfilled && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          className="fn-handle fn-handle-source"
          style={{ visibility: "hidden" }}
        />
      )}
    </>
  );
}
