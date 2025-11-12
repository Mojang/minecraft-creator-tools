import { Handle, Position } from "@xyflow/react";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";
import "./EntityTypeStateNode.css";
import CreatorTools from "../app/CreatorTools";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import Utilities from "../core/Utilities";
import IEntityTypeState from "../minecraft/IEntityTypeState";
import MinecraftBox from "./MinecraftBox";

export interface EntityTypeStateNodeProps {
  data: EntityTypeStateNodeData;
  selected?: boolean;
}

export interface EntityTypeStateNodeData {
  state: IEntityTypeState;
  project: Project;
  entityType: EntityTypeDefinition;
  isLikely: boolean;
  creatorTools: CreatorTools;
  isSelected: boolean;
  theme: ThemeInput<any>;
}

export default function EntityTypeStateNode(props: EntityTypeStateNodeProps) {
  let outerClassName = "etsn-outer";

  if (props.selected) {
    outerClassName += " etsn-selected";
  } else {
    outerClassName += " etsn-unselected";
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ left: 110 }} id="target" />
      <Handle type="source" position={Position.Bottom} style={{ left: 110 }} id="source" />
      <div className={outerClassName}>
        <MinecraftBox className="etsn-box" theme={props.data.theme}>
          <div className="etsn-inner">
            <span className="etsn-label">{Utilities.humanifyMinecraftName(props.data.state.title).trim()}</span>
          </div>
        </MinecraftBox>
      </div>
    </>
  );
}
