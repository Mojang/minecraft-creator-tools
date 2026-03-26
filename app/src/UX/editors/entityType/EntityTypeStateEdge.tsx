import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, Position } from "@xyflow/react";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

export interface EntityTypeStateEdgeProps extends EdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data: any;
}

export default function EntityTypeStateEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EntityTypeStateEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Bottom,
    targetX,
    targetY,
    targetPosition: Position.Top,
    borderRadius: 0,
  });

  // Square plug size
  const plugSize = 6;
  const isLight = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const activeColor = isLight ? "#388E3C" : "#4CAF50";
  const activeStroke = isLight ? "#1b5e20" : "#2d7a30";
  const inactiveColor = isLight ? "#88888811" : "#99999911";
  const wireColor = data.isLikely ? activeColor : inactiveColor;
  const glowColor = data.isLikely ? (isLight ? "rgba(56, 142, 60, 0.3)" : "rgba(76, 175, 80, 0.4)") : "transparent";
  const glowStrong = isLight ? "rgba(56, 142, 60, 0.6)" : "rgba(76, 175, 80, 0.8)";

  return (
    <>
      {/* Glow layer */}
      {data.isLikely && (
        <path d={edgePath} fill="none" stroke={glowColor} strokeWidth={8} style={{ filter: "blur(4px)" }} />
      )}
      {/* Main wire */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: wireColor,
          strokeWidth: 3,
          strokeLinecap: "square",
        }}
      />
      {/* Square plug at target end */}
      {data.isLikely && (
        <rect
          x={targetX - plugSize / 2}
          y={targetY - plugSize}
          width={plugSize}
          height={plugSize}
          fill={activeColor}
          stroke={activeStroke}
          strokeWidth={1}
          style={{ filter: `drop-shadow(0 0 3px ${glowStrong})` }}
        />
      )}
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            opacity: data.isLikely ? 1 : 0.1,
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            backgroundColor: data.isLikely ? (isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.7)") : "transparent",
            padding: data.isLikely ? "2px 6px" : "0",
            borderRadius: "3px",
            border: data.isLikely ? `1px solid ${activeColor}` : "none",
            color: activeColor,
            fontSize: "x-small",
            textShadow: data.isLikely ? `0 0 4px ${glowStrong}` : "none",
          }}
          className="nodrag nopan"
        >
          {data.title}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
