import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, Position, type EdgeProps } from "@xyflow/react";
import Utilities from "../../../core/Utilities";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../../app/CreatorToolsHost";

export interface EventComponentGroupAddEdgeProps extends EdgeProps {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data: any;
}

export default function EventComponentGroupAddEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EventComponentGroupAddEdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    targetPosition: Position.Top,
    borderRadius: 0,
  });

  // Square plug size
  const plugSize = 6;
  const isLight = CreatorToolsHost.theme === CreatorToolsThemeStyle.light;
  const addColor = isLight ? "#388E3C" : "#4CAF50";
  const addStroke = isLight ? "#1b5e20" : "#2d7a30";
  const addGlow = isLight ? "rgba(56, 142, 60, 0.3)" : "rgba(76, 175, 80, 0.4)";
  const addGlowStrong = isLight ? "rgba(56, 142, 60, 0.6)" : "rgba(76, 175, 80, 0.8)";

  return (
    <>
      {/* Glow layer */}
      <path d={edgePath} fill="none" stroke={addGlow} strokeWidth={8} style={{ filter: "blur(4px)" }} />
      {/* Main wire */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: addColor,
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
        fill={addColor}
        stroke={addStroke}
        strokeWidth={1}
        style={{ filter: `drop-shadow(0 0 3px ${addGlowStrong})` }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            color: addColor,
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 20}px)`,
            pointerEvents: "all",
            backgroundColor: isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.7)",
            padding: "2px 6px",
            borderRadius: "3px",
            border: `1px solid ${addColor}`,
            textShadow: `0 0 4px ${addGlowStrong}`,
          }}
          className="nodrag nopan"
        >
          <div style={{ paddingLeft: "4px", fontSize: "x-small" }}>
            <FontAwesomeIcon icon={faPlus} className="fa-lg" />
            {" " + Utilities.humanifyMinecraftName(data.eventId) + " adds "}
          </div>
          <div style={{ fontSize: "x-small", paddingLeft: 14 }}>
            {Utilities.humanifyMinecraftNameRemoveNamespaces(data.componentGroupId)}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
