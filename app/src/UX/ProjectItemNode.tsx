import { Handle, Position } from "@xyflow/react";
import ProjectItem from "../app/ProjectItem";
import Project from "../app/Project";
import "./ProjectItemNode.css";
import MinecraftBox from "./MinecraftBox";
import { ThemeInput } from "@fluentui/react-northstar";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { ProjectItemType } from "../app/IProjectItemData";
import ColorUtilities from "../core/ColorUtilities";

export interface ProjectItemNodeProps {
  data: {
    label: string;
    item: ProjectItem;
    project: Project;
    isSelected: boolean;
    targetColumn: number;
    theme: ThemeInput<any>;
  };
}

export default function ProjectItemNode(props: ProjectItemNodeProps) {
  let className = "pino-inner";

  if (props.data.isSelected) {
    className += " pino-inner-selected";
  }
  const color = ProjectItemUtilities.getColorForType(props.data.item.itemType);

  color.alpha = 0.2;

  const content = (
    <div className={className}>
      <div
        className="pino-type"
        style={{
          backgroundColor: ColorUtilities.toCss(color),
        }}
      >
        {ProjectItemUtilities.getDescriptionForType(props.data.item.itemType)}
      </div>
      <div className={"pino-name"}>{props.data.label}</div>
    </div>
  );

  if (props.data.item.itemType === ProjectItemType.entityTypeBehavior) {
    return (
      <MinecraftBox className="pino-outer" theme={props.data.theme}>
        <Handle type="target" position={Position.Right} style={{ top: 20 }} />
        {content}
        <Handle type="source" position={Position.Left} />
        <Handle key="sourceRight" type="source" position={Position.Right} id="sourceRight" style={{ top: 40 }} />
      </MinecraftBox>
    );
  }

  return (
    <MinecraftBox className="pino-outer" theme={props.data.theme}>
      <Handle type="target" position={props.data.targetColumn < 5 ? Position.Right : Position.Left} />
      {content}
      <Handle type="source" position={props.data.targetColumn < 5 ? Position.Left : Position.Right} />
    </MinecraftBox>
  );
}
