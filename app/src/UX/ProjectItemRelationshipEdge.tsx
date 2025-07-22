import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position } from "@xyflow/react";

import "./ProjectItemRelationshipEdge.css";

type ProjectItemRelationshipEdgeEdgeProps = {
  id: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  data: any;
};

export default function ProjectItemRelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: ProjectItemRelationshipEdgeEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: data.direction < 0 ? Position.Left : Position.Right,
    targetX,
    targetY,
    targetPosition: data.direction < 0 ? Position.Right : Position.Left,
  });

  if (data.description) {
    return (
      <>
        <BaseEdge id={id} path={edgePath} />
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="pire-label nodrag nopan"
          >
            {data.description}
          </div>
        </EdgeLabelRenderer>
      </>
    );
  }

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
    </>
  );
}
