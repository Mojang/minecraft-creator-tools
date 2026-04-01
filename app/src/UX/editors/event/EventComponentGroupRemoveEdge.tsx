import { faMinus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, Position } from "@xyflow/react";
import Utilities from "../../../core/Utilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

export interface EventComponentGroupRemoveEdgeProps extends EdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data: any;
}

export default function EventComponentGroupRemoveEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EventComponentGroupRemoveEdgeProps) {
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
  const removeColor = isLight ? "#b02020" : "#d63030";
  const removeStroke = isLight ? "#6a1414" : "#8a2020";
  const removeGlow = isLight ? "rgba(176, 32, 32, 0.3)" : "rgba(214, 48, 48, 0.4)";
  const removeGlowStrong = isLight ? "rgba(176, 32, 32, 0.6)" : "rgba(214, 48, 48, 0.8)";

  return (
    <>
      {/* Glow layer */}
      <path d={edgePath} fill="none" stroke={removeGlow} strokeWidth={8} style={{ filter: "blur(4px)" }} />
      {/* Main wire */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: removeColor,
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
        fill={removeColor}
        stroke={removeStroke}
        strokeWidth={1}
        style={{ filter: `drop-shadow(0 0 3px ${removeGlowStrong})` }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            color: removeColor,
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + 20}px)`,
            pointerEvents: "all",
            backgroundColor: isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.7)",
            padding: "2px 6px",
            borderRadius: "3px",
            border: `1px solid ${removeColor}`,
            textShadow: `0 0 4px ${removeGlowStrong}`,
          }}
          className="nodrag nopan"
        >
          <div style={{ paddingLeft: "4px", fontSize: "x-small" }}>
            <FontAwesomeIcon icon={faMinus} className="fa-lg" />
            {" " + Utilities.humanifyMinecraftName(data.eventId) + " removes "}
          </div>
          <div style={{ fontSize: "x-small", paddingLeft: 14 }}>
            {Utilities.humanifyMinecraftNameRemoveNamespaces(data.componentGroupId)}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
