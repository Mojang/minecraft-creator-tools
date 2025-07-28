import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, type EdgeProps } from "@xyflow/react";
import Utilities from "../core/Utilities";

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
  markerEnd,
  data,
}: EventComponentGroupAddEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    targetPosition: Position.Top,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "green", strokeWidth: 2 }} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            color: "green",
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY - 20}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <div style={{ paddingLeft: "4px", fontSize: "x-small" }}>
            <FontAwesomeIcon icon={faPlus} className="fa-lg" />
            {Utilities.humanifyMinecraftName(data.eventId) + " adds "}
          </div>
          <div style={{ fontSize: "x-small", paddingLeft: 14 }}>
            {Utilities.humanifyMinecraftNameRemoveNamespaces(data.componentGroupId)}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
