// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * FEATURE DEPENDENCY EDGE
 * =======================
 *
 * Custom xyflow edge for showing feature dependencies.
 * Displays the relationship between a parent feature and child feature,
 * including optional weight information for weighted_random_feature.
 */

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, type EdgeProps } from "@xyflow/react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWeight } from "@fortawesome/free-solid-svg-icons";
import "./FeatureDependencyEdge.css";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

export interface FeatureDependencyEdgeProps extends EdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data: FeatureDependencyEdgeData;
}

export interface FeatureDependencyEdgeData {
  weight?: number;
  dependencyType: "places" | "child" | "references";
  sourceId: string;
  targetId: string;
  isUnfulfilled?: boolean;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

export default function FeatureDependencyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
}: FeatureDependencyEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    borderRadius: 4, // More blocky corners for Minecraft feel
  });

  // Handle missing data gracefully (can happen during edge creation)
  if (!data) {
    const fallbackStroke = CreatorToolsHost.theme === CreatorToolsThemeStyle.light ? "#555" : "#666";
    return <BaseEdge id={id} path={edgePath} style={{ stroke: fallbackStroke, strokeWidth: 3 }} />;
  }

  const isUnfulfilled = data.isUnfulfilled;
  const hasWeight = data.weight !== undefined;
  const isLight = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;

  // Water pipe color palette - inspired by Minecraft water
  let strokeColor = isLight ? "#2e7aa8" : "#4a9acc"; // Default: water blue
  let glowColor = isLight ? "rgba(46, 122, 168, 0.4)" : "rgba(74, 154, 204, 0.5)";
  let pipeOuterColor = isLight ? "#1c4a66" : "#2a5a7a"; // Darker outer for pipe effect

  if (isUnfulfilled) {
    strokeColor = isLight ? "#8a5030" : "#aa6644";
    glowColor = isLight ? "rgba(138, 80, 48, 0.3)" : "rgba(170, 102, 68, 0.4)";
    pipeOuterColor = isLight ? "#4a2818" : "#6a3a2a";
  } else if (data.dependencyType === "places") {
    strokeColor = isLight ? "#2ea02e" : "#5cff5c"; // Green for direct placement
    glowColor = isLight ? "rgba(46, 160, 46, 0.3)" : "rgba(92, 255, 92, 0.4)";
    pipeOuterColor = isLight ? "#1a4a1a" : "#2a6a2a";
  } else if (hasWeight) {
    strokeColor = isLight ? "#7a5aa0" : "#aa8acc"; // Purple for weighted
    glowColor = isLight ? "rgba(122, 90, 160, 0.4)" : "rgba(170, 138, 204, 0.5)";
    pipeOuterColor = isLight ? "#3a2a4a" : "#5a4a6a";
  }

  return (
    <>
      {/* Outer pipe layer - darker border */}
      <path
        d={edgePath}
        fill="none"
        stroke={pipeOuterColor}
        strokeWidth={selected ? 10 : 7}
        strokeLinecap="square"
      />

      {/* Inner pipe - the water flow */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? 6 : 4}
        strokeLinecap="square"
        strokeDasharray={isUnfulfilled ? "8,6" : "12,12"}
        className="fde-pipe-animated"
        style={{
          filter: `drop-shadow(0 0 4px ${glowColor})`,
        }}
      />

      {/* Highlight line on top for 3D effect */}
      <path
        d={edgePath}
        fill="none"
        stroke={CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.1)"}
        strokeWidth={1}
        strokeLinecap="square"
        style={{ transform: "translate(-1px, -1px)" }}
      />

      {/* Arrow marker at target - blocky style */}
      <rect
        x={targetX - 6}
        y={targetY - 14}
        width={12}
        height={10}
        fill={strokeColor}
        stroke={pipeOuterColor}
        strokeWidth={2}
        style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
      />

      {/* Weight label if applicable */}
      {hasWeight && (
        <EdgeLabelRenderer>
          <div
            className="fde-edge-label"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <FontAwesomeIcon icon={faWeight} className="fde-edge-label-icon" />
            <span>{data.weight}</span>
          </div>
        </EdgeLabelRenderer>
      )}

      {/* Unfulfilled warning */}
      {isUnfulfilled && (
        <EdgeLabelRenderer>
          <div
            className="fde-edge-label fde-edge-label-warning"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            <span>Missing</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
