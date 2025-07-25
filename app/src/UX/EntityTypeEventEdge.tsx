import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, Position } from "@xyflow/react";

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
  markerEnd,
}: EntityTypeEventEdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: data.position,
    targetX,
    targetY,
    targetPosition: Position.Top,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: "orange", strokeWidth: 2 }} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          Fires action
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
