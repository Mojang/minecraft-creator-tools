import { faMinus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, Position } from "@xyflow/react";
import Utilities from "../core/Utilities";

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
  markerEnd,
  data,
}: EventComponentGroupRemoveEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: Position.Bottom,
    targetX,
    targetY,
    targetPosition: Position.Top,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "red", strokeWidth: 2 }} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + 20}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div style={{ paddingLeft: "4px", fontSize: "x-small" }}>
            <FontAwesomeIcon icon={faMinus} className="fa-lg" />
            {Utilities.humanifyMinecraftName(data.eventId) + " removes "}
          </div>
          <div style={{ fontSize: "x-small", paddingLeft: 14 }}>
            {Utilities.humanifyMinecraftNameRemoveNamespaces(data.componentGroupId)}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
