import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath, Position } from "@xyflow/react";

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
  markerEnd,
}: EntityTypeStateEdgeProps) {
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
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: data.isLikely ? "orange" : "#99999911", strokeWidth: 2 }}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            opacity: data.isLikely ? 1 : 0.1,
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          {data.title}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
