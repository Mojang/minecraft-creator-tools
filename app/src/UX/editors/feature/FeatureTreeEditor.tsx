// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE TREE EDITOR
 * ===================
 *
 * Displays the feature pipeline as a hierarchical tree with a detail panel.
 *
 * LEFT PANEL: Tree hierarchy showing all features from roots to leaves
 * RIGHT PANEL: Detail editor for the selected node
 *
 * The tree shows:
 * - Feature Rules (blue) at the top
 * - Composite Features (green) in the middle
 * - Terminal Features (purple) at the leaves
 * - Unfulfilled references (orange/dashed) with warning icons
 */

import { Component } from "react";
import Project from "../../../app/Project";
import CreatorTools from "../../../app/CreatorTools";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileLines,
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
  faTriangleExclamation,
  faArrowsDownToLine,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
import {
  IFeaturePipeline,
  FeaturePipelineNode,
  flattenPipeline,
  getFeatureTypeName,
  isCompositeFeatureType,
  getShortId,
} from "./FeaturePipelineUtilities";
import FeatureComponentEditor from "./FeatureComponentEditor";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IFeatureTreeEditorProps extends WithLocalizationProps {
  pipeline: IFeaturePipeline;
  selectedNode: FeaturePipelineNode | undefined;
  onNodeSelected: (node: FeaturePipelineNode | undefined) => void;
  project: Project;
  creatorTools: CreatorTools;
  theme: IProjectTheme;
  heightOffset: number;
  readOnly: boolean;
}

interface IFeatureTreeEditorState {
  expandedNodes: Set<string>;
}

class FeatureTreeEditor extends Component<IFeatureTreeEditorProps, IFeatureTreeEditorState> {
  constructor(props: IFeatureTreeEditorProps) {
    super(props);

    this.state = {
      expandedNodes: new Set(),
    };
  }

  componentDidMount(): void {
    // Expand all nodes by default for better visibility
    this._expandAll();
  }

  componentDidUpdate(prevProps: IFeatureTreeEditorProps): void {
    if (prevProps.pipeline !== this.props.pipeline) {
      this._expandAll();
    }
  }

  _expandAll() {
    const allNodes = flattenPipeline(this.props.pipeline.roots);
    const expandedNodes = new Set<string>();

    for (const node of allNodes) {
      const nodeId = this._getNodeId(node);
      if (nodeId) {
        expandedNodes.add(nodeId);
      }
    }

    this.setState({ expandedNodes });
  }

  _getNodeId(node: FeaturePipelineNode, parentId?: string): string {
    if (node.nodeType === "unfulfilledFeature") {
      // Include parent info to make unique keys for duplicate unfulfilled references
      const baseId = "unfulfilled:" + node.referencedId;
      return parentId ? `${baseId}:parent:${parentId}` : baseId;
    }
    return node.item.projectPath || node.id;
  }

  _getNodeIcon(node: FeaturePipelineNode) {
    if (node.nodeType === "unfulfilledFeature") {
      return faTriangleExclamation;
    }

    if (node.nodeType === "featureRule") {
      return faFileLines;
    }

    // Feature type icons
    const featureType = node.featureType;
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
        return faCube;
    }
  }

  _getNodeIconClass(node: FeaturePipelineNode): string {
    if (node.nodeType === "unfulfilledFeature") {
      return "fte-treeNodeIcon fte-unfulfilled";
    }

    if (node.nodeType === "featureRule") {
      return "fte-treeNodeIcon fte-featureRule";
    }

    if (isCompositeFeatureType(node.featureType)) {
      return "fte-treeNodeIcon fte-compositeFeature";
    }

    return "fte-treeNodeIcon fte-terminalFeature";
  }

  _handleNodeClick(node: FeaturePipelineNode) {
    this.props.onNodeSelected(node);
  }

  _isNodeSelected(node: FeaturePipelineNode): boolean {
    const selectedNode = this.props.selectedNode;
    if (!selectedNode) return false;

    if (node.nodeType === "unfulfilledFeature" && selectedNode.nodeType === "unfulfilledFeature") {
      return node.referencedId === selectedNode.referencedId;
    }

    if (node.nodeType !== "unfulfilledFeature" && selectedNode.nodeType !== "unfulfilledFeature") {
      return this._getNodeId(node) === this._getNodeId(selectedNode);
    }

    return false;
  }

  _renderTreeNode(node: FeaturePipelineNode, depth: number, parentId?: string): JSX.Element {
    const nodeId = this._getNodeId(node, parentId);
    const isSelected = this._isNodeSelected(node);
    const isUnfulfilled = node.nodeType === "unfulfilledFeature";
    const isVanilla = isUnfulfilled && node.isVanillaReference;

    let className = "fte-treeNode";
    if (isSelected) className += " fte-selected";
    if (isUnfulfilled) className += " fte-unfulfilled";
    if (isVanilla) className += " fte-vanilla";

    let displayName: string;
    let displayType: string;

    if (node.nodeType === "unfulfilledFeature") {
      displayName = getShortId(node.referencedId);
      displayType = isVanilla ? this.props.intl.formatMessage({ id: "project_editor.feature_tree.vanilla_type" }) : this.props.intl.formatMessage({ id: "project_editor.feature_tree.missing_type" });
    } else if (node.nodeType === "featureRule") {
      displayName = node.shortId || getShortId(node.id);
      displayType = this.props.intl.formatMessage({ id: "project_editor.feature_tree.feature_rule" });
    } else {
      displayName = node.shortId || getShortId(node.id);
      displayType = getFeatureTypeName(node.featureType);
    }

    return (
      <div key={nodeId}>
        <div
          className={className}
          onClick={() => this._handleNodeClick(node)}
          style={{
            backgroundColor: isSelected ? getThemeColors().background4 : undefined,
          }}
        >
          {/* Indentation */}
          {Array.from({ length: depth }).map((_, i) => (
            <span key={i} className="fte-treeNodeIndent" />
          ))}

          {/* Icon */}
          <span className={this._getNodeIconClass(node)}>
            <FontAwesomeIcon icon={this._getNodeIcon(node)} />
          </span>

          {/* Content */}
          <span className="fte-treeNodeContent">
            <div className="fte-treeNodeName">{displayName}</div>
            <div className="fte-treeNodeType">{displayType}</div>
          </span>

          {/* Warning for unfulfilled */}
          {isUnfulfilled && !isVanilla && (
            <span className="fte-treeNodeWarning">
              <FontAwesomeIcon icon={faTriangleExclamation} />
            </span>
          )}

          {/* Vanilla badge */}
          {isVanilla && <span className="fte-vanillaBadge">{this.props.intl.formatMessage({ id: "project_editor.feature_tree.vanilla_badge" })}</span>}
        </div>

        {/* Render children */}
        {node.children.map((child) => this._renderTreeNode(child, depth + 1, nodeId))}
      </div>
    );
  }

  render() {
    const height = "calc(100vh - " + this.props.heightOffset + "px)";
    const pipeline = this.props.pipeline;
    const selectedNode = this.props.selectedNode;

    // Build the tree starting from roots
    const treeContent = pipeline.roots.map((root) => this._renderTreeNode(root, 0));

    // Detail panel content
    let detailContent: JSX.Element;

    if (!selectedNode) {
      detailContent = (
        <div className="fte-emptyState">
          <div className="fte-emptyStateIcon">
            <FontAwesomeIcon icon={faLayerGroup} />
          </div>
          <div className="fte-emptyStateTitle">{this.props.intl.formatMessage({ id: "project_editor.feature_tree.select_title" })}</div>
          <div className="fte-emptyStateMessage">
            {this.props.intl.formatMessage({ id: "project_editor.feature_tree.select_desc" })}
          </div>
        </div>
      );
    } else if (selectedNode.nodeType === "unfulfilledFeature") {
      detailContent = (
        <div className="fte-emptyState">
          <div className="fte-emptyStateIcon">
            <FontAwesomeIcon icon={faTriangleExclamation} />
          </div>
          <div className="fte-emptyStateTitle">
            {selectedNode.isVanillaReference ? this.props.intl.formatMessage({ id: "project_editor.feature_tree.vanilla_type" }) : this.props.intl.formatMessage({ id: "project_editor.feature_tree.missing_type" })}
          </div>
          <div className="fte-emptyStateMessage">
            {selectedNode.isVanillaReference
              ? this.props.intl.formatMessage({ id: "project_editor.feature_tree.vanilla_cannot_edit" }, { featureId: selectedNode.referencedId })
              : this.props.intl.formatMessage({ id: "project_editor.feature_tree.missing_not_found" }, { featureName: selectedNode.referencedId })}
          </div>
        </div>
      );
    } else {
      // Show the component editor
      const headerTitle = selectedNode.shortId || getShortId(selectedNode.id);
      const headerSubtitle =
        selectedNode.nodeType === "featureRule" ? "Feature Rule" : getFeatureTypeName(selectedNode.featureType);

      detailContent = (
        <>
          <div
            className="fte-detailHeader"
            style={{
              backgroundColor: getThemeColors().background1,
            }}
          >
            <div className="fte-detailHeaderTitle">{headerTitle}</div>
            <div className="fte-detailHeaderSubtitle">{headerSubtitle}</div>
          </div>
          <div className="fte-detailContent">
            <FeatureComponentEditor
              selectedNode={selectedNode}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              heightOffset={this.props.heightOffset + 80}
              readOnly={this.props.readOnly}
            />
          </div>
        </>
      );
    }

    const treeColors = getThemeColors();

    return (
      <div
        className="fte-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {/* Left panel - tree */}
        <div
          className="fte-treePanel"
          style={{
            backgroundColor: treeColors.background1,
            color: treeColors.foreground1,
          }}
        >
          <div className="fte-treePanelHeader">{this.props.intl.formatMessage({ id: "project_editor.feature_tree.hierarchy_header" })}</div>
          <div
            className="fte-treeList"
            style={{
              maxHeight: `calc(100vh - ${this.props.heightOffset + 40}px)`,
            }}
          >
            {treeContent}
          </div>
        </div>

        {/* Right panel - detail */}
        <div
          className="fte-detailPanel"
          style={{
            backgroundColor: treeColors.background2,
            color: treeColors.foreground2,
          }}
        >
          {detailContent}
        </div>
      </div>
    );
  }
}

export default withLocalization(FeatureTreeEditor);
