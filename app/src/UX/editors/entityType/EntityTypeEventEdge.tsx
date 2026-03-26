import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, Position } from "@xyflow/react";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

export interface EntityTypeEventEdgeProps extends EdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data: any;
}

export default function EntityTypeEventEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EntityTypeEventEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition: data.position,
    targetX,
    targetY,
    targetPosition: Position.Top,
    borderRadius: 0,
  });

  // Square plug size
  const plugSize = 6;
  const isLight = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const wireColor = isLight ? "#cc7000" : "#ff8c00";
  const wireStroke = isLight ? "#a05800" : "#cc7000";
  const wireGlow = isLight ? "rgba(204, 112, 0, 0.4)" : "rgba(255, 140, 0, 0.4)";
  const wireGlowStrong = isLight ? "rgba(204, 112, 0, 0.6)" : "rgba(255, 140, 0, 0.8)";

  return (
    <>
      {/* Glow layer */}
      <path d={edgePath} fill="none" stroke={wireGlow} strokeWidth={8} style={{ filter: "blur(4px)" }} />
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
      <rect
        x={targetX - plugSize / 2}
        y={targetY - plugSize}
        width={plugSize}
        height={plugSize}
        fill={wireColor}
        stroke={wireStroke}
        strokeWidth={1}
        style={{ filter: `drop-shadow(0 0 3px ${wireGlowStrong})` }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            color: wireColor,
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
            backgroundColor: isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.7)",
            padding: "2px 6px",
            borderRadius: "3px",
            border: `1px solid ${wireColor}`,
            fontSize: "x-small",
            textShadow: `0 0 4px ${wireGlowStrong}`,
          }}
          className="nodrag nopan"
        >
          Fires action
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
