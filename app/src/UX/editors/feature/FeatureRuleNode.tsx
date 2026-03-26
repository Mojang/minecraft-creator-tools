// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE RULE NODE
 * =================
 *
 * Custom xyflow node for displaying a feature rule in the diagram.
 * Feature rules are the entry points that define when and where features are placed.
 */

import { Handle, Position, type NodeProps, Node } from "@xyflow/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileLines, faLocationDot, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import "./FeatureRuleNode.css";
import Utilities from "../../../core/Utilities";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

/**
 * The Node type used for feature rule nodes in the diagram.
 * Provides proper typing for ReactFlow's Node generic.
 */
export type FeatureRuleNode = Node<FeatureRuleNodeData, "feature-rule">;

export interface FeatureRuleNodeData {
  id: string;
  shortId: string;
  placesFeatureId?: string;
  biomes?: string[];
  conditions?: string[];
  theme: IProjectTheme;
  /** Index signature to satisfy ReactFlow's Record<string, unknown> constraint */
  [key: string]: unknown;
}

export default function FeatureRuleNodeComponent(props: NodeProps<FeatureRuleNode>) {
  const { data, selected } = props;
  const colors = getThemeColors();

  let outerClassName = "frn-outer";
  if (selected) {
    outerClassName += " frn-selected";
  }

  return (
    <>
      <div
        className={outerClassName}
        style={{
          borderColor: colors.background1,
        }}
      >
        <div className="frn-header">
          <span className="frn-icon">
            <FontAwesomeIcon icon={faFileLines} />
          </span>
          <span className="frn-title">{Utilities.humanifyMinecraftName(data.shortId)}</span>
        </div>
        <div
          className="frn-type"
          style={{
            backgroundColor: colors.background2,
          }}
        >
          Feature Rule
        </div>
        {data.biomes && data.biomes.length > 0 && (
          <div className="frn-info">
            <FontAwesomeIcon icon={faLocationDot} className="frn-info-icon" />
            <span>
              {data.biomes.length} biome{data.biomes.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
        {data.placesFeatureId && (
          <div className="frn-info">
            <FontAwesomeIcon icon={faLayerGroup} className="frn-info-icon" />
            <span>Places: {Utilities.humanifyMinecraftName(data.placesFeatureId.split(":").pop() || "")}</span>
          </div>
        )}
      </div>

      {/* Source handle for the feature this rule places */}
      <Handle type="source" position={Position.Bottom} id="places" />
      <div className="frn-handle-label">Places</div>
    </>
  );
}
