import { Handle, Position } from "@xyflow/react";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";
import MinecraftBox from "./MinecraftBox";

import "./EntityTypeComponentSetNode.css";
import Utilities from "../core/Utilities";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { TriggerDescription } from "../minecraft/EntityTypeComponentSetUtilities";

export interface EntityTypeComponentSetNodeProps {
  data: EntityTypeComponentSetNodeData;
  selected: boolean;
}

export interface EntityTypeComponentSetNodeData {
  label: string;
  componentSet: IManagedComponentSetItem;
  entityType: EntityTypeDefinition;
  project: Project;
  connectionPoints: TriggerDescription[];
  isSelected: boolean;
  targetColumn: number;
  theme: ThemeInput<any>;

  onClick: (data: EntityTypeComponentSetNodeData) => void;
}

export default function EntityComponentSetNode(props: EntityTypeComponentSetNodeProps) {
  const handles = [];

  let connectionNodes = [];
  if (props.data.componentSet !== props.data.entityType) {
    connectionNodes.push(
      <Handle
        type="target"
        id="add"
        position={Position.Top}
        style={{ left: 20, top: 4, width: 8, height: 8, color: "green" }}
      />
    );
    connectionNodes.push(
      <Handle
        type="target"
        id="remove"
        position={Position.Top}
        style={{ left: 200, top: 4, width: 8, height: 8, color: "red" }}
      />
    );
  }

  let i = 0;
  for (const connectionPoint of props.data.connectionPoints) {
    let path = connectionPoint.path;
    path = path.replace("_event", "");

    connectionNodes.push(
      <div
        className="ecsn-connectionPoint"
        style={{
          backgroundColor: props.data.theme.siteVariables?.colorScheme.brand.background1,
          borderBottomColor: props.data.theme.siteVariables?.colorScheme.brand.foreground3,
          borderTopColor: props.data.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        {connectionPoint.path ? Utilities.humanifyMinecraftName(path, true) : ""}
      </div>
    );
    const y = i * 38 + 70;

    handles.push(
      <Handle
        type="source"
        position={Position.Right}
        id={connectionPoint.path + "R"}
        style={{ top: y, left: 210, width: 8, height: 8 }}
      />
    );
    handles.push(
      <Handle
        type="source"
        position={Position.Left}
        id={connectionPoint.path + "L"}
        style={{ top: y, left: 6, width: 8, height: 8 }}
      />
    );
    i++;
  }

  let className = "ecsn-outer";

  if (props.selected) {
    className += " ecsn-selected";
  } else {
    className += " ecsn-unselected";
  }

  return (
    <>
      {handles}
      <div className={className}>
        <MinecraftBox className="ecsn-box" theme={props.data.theme}>
          <div className="ecsn-inner">
            <div className="ecsn-header">
              {Utilities.humanifyMinecraftNameRemoveNamespaces(props.data.componentSet.id) +
                (props.data.componentSet === props.data.entityType ? " - Base Properties" : "")}
            </div>
            <div className="ecsn-connectBin">{connectionNodes}</div>
          </div>
        </MinecraftBox>
      </div>
    </>
  );
}
