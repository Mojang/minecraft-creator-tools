import { Handle, Position } from "@xyflow/react";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import Project from "../../../app/Project";
import "./EntityTypeEventNode.css";
import CreatorTools from "../../../app/CreatorTools";
import EntityTypeDefinition from "../../../minecraft/EntityTypeDefinition";
import ManagedEventActionOrActionSet from "../../../minecraft/ManagedEventActionOrActionSet";
import Utilities from "../../../core/Utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoltLightning } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

export interface EntityTypeEventNodeProps {
  data: EntityTypeEventNodeData;
  selected?: boolean;
}

export interface EntityTypeEventNodeData {
  label: string;
  item: IManagedComponentSetItem;
  project: Project;
  entityType: EntityTypeDefinition;
  entityEvent: ManagedEventActionOrActionSet;
  creatorTools: CreatorTools;
  isSelected: boolean;
  targetColumn: number;
  theme: IProjectTheme;
}

export default function EntityTypeEventNode(props: EntityTypeEventNodeProps) {
  const colors = getThemeColors();
  let innerClassName = "eten-inner";

  if (props.selected) {
    innerClassName += " eten-selected";
  } else {
    innerClassName += " eten-unselected";
  }

  return (
    <>
      <Handle type="target" position={Position.Top} style={{ left: 110 }} />
      <Handle type="source" position={Position.Bottom} style={{ left: 110 }} id="source" />
      <div
        className="eten-outer"
        title={`Event: ${props.data.item.id} — triggers behavior changes like adding or removing component groups`}
        style={{
          backgroundColor: colors.background || "#669966",
          borderColor: colors.background1,
        }}
      >
        <div className={innerClassName}>
          <span className="eten-icon">
            <FontAwesomeIcon icon={faBoltLightning} className="fa-lg" />
          </span>
          <span className="eten-label">{Utilities.humanifyMinecraftName(props.data.item.id)}</span>
        </div>
      </div>
    </>
  );
}
