import { Handle, Position } from "@xyflow/react";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import Project from "../../../app/Project";
import MinecraftBox from "../../shared/components/layout/minecraftBox/MinecraftBox";

import "./EntityTypeComponentSetNode.css";
import Utilities from "../../../core/Utilities";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import { TriggerDescription } from "../../../minecraft/EntityTypeComponentSetUtilities";
import ComponentIcon, { getComponentColor } from "../../shared/components/icons/ComponentIcon";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup, faCube } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

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
  theme: IProjectTheme;

  onClick: (data: EntityTypeComponentSetNodeData) => void;
}

export default function EntityComponentSetNode(props: EntityTypeComponentSetNodeProps) {
  let topHandles = [];
  if (props.data.componentSet !== props.data.entityType) {
    topHandles.push(
      <Handle
        key="add-handle"
        type="target"
        id="add"
        position={Position.Top}
        style={{ left: 20, top: 4, width: 8, height: 8, color: "green" }}
      />
    );
    topHandles.push(
      <Handle
        key="remove-handle"
        type="target"
        id="remove"
        position={Position.Top}
        style={{ left: 240, top: 4, width: 8, height: 8, color: "red" }}
      />
    );
  }

  let connectionRows = [];

  for (const connectionPoint of props.data.connectionPoints) {
    let path = connectionPoint.path;
    path = path.replace("_event", "");

    // Extract the base component ID for the icon (e.g., minecraft:behavior.melee_attack from minecraft:behavior.melee_attack.on_attack)
    const pathParts = connectionPoint.path.split(".");
    let componentId = connectionPoint.path;
    if (pathParts.length >= 2) {
      // For paths like "minecraft:behavior.melee_attack.on_attack", take the first two parts
      componentId = pathParts.slice(0, 2).join(".");
    }

    const categoryColor = getComponentColor(componentId);

    connectionRows.push(
      <div
        key={connectionPoint.path}
        className="ecsn-connectionRow"
        style={{
          backgroundColor: getThemeColors().background1,
        }}
      >
        {/* Left handle integrated into the row */}
        <div className="ecsn-handleArea ecsn-handleLeft">
          <Handle type="source" position={Position.Left} id={connectionPoint.path + "L"} className="ecsn-handle" />
        </div>

        {/* Connection point content */}
        <div
          className="ecsn-connectionContent"
          style={{
            borderLeftColor: categoryColor,
          }}
        >
          <ComponentIcon componentId={componentId} size={16} />
          <span className="ecsn-connectionPointText">
            {connectionPoint.path ? Utilities.humanifyMinecraftName(path, true) : ""}
          </span>
        </div>

        {/* Right handle integrated into the row */}
        <div className="ecsn-handleArea ecsn-handleRight">
          <Handle type="source" position={Position.Right} id={connectionPoint.path + "R"} className="ecsn-handle" />
        </div>
      </div>
    );
  }

  let className = "ecsn-outer";

  if (props.selected) {
    className += " ecsn-selected";
  } else {
    className += " ecsn-unselected";
  }

  return (
    <>
      {topHandles}
      <div
        className={className}
        title={
          props.data.componentSet === props.data.entityType
            ? `${Utilities.humanifyMinecraftNameRemoveNamespaces(props.data.componentSet.id)} — base behaviors always active on this mob`
            : `${Utilities.humanifyMinecraftNameRemoveNamespaces(props.data.componentSet.id)} — component group variant that can be added or removed by events`
        }
      >
        <MinecraftBox className="ecsn-box" theme={props.data.theme}>
          <div className="ecsn-inner">
            <div
              className="ecsn-header"
              style={{
                backgroundColor: getThemeColors().background2,
              }}
            >
              <FontAwesomeIcon
                icon={props.data.componentSet === props.data.entityType ? faCube : faLayerGroup}
                className="ecsn-headerIcon"
              />
              {Utilities.humanifyMinecraftNameRemoveNamespaces(props.data.componentSet.id) +
                (props.data.componentSet === props.data.entityType ? " - Base Properties" : "")}
            </div>
            <div className="ecsn-connectBin">{connectionRows}</div>
          </div>
        </MinecraftBox>
      </div>
    </>
  );
}
