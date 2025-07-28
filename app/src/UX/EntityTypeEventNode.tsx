import { Handle, Position } from "@xyflow/react";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";
import "./EntityTypeEventNode.css";
import Carto from "../app/Carto";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ManagedEventActionOrActionSet from "../minecraft/ManagedEventActionOrActionSet";
import Utilities from "../core/Utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoltLightning } from "@fortawesome/free-solid-svg-icons";

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
  carto: Carto;
  isSelected: boolean;
  targetColumn: number;
  theme: ThemeInput<any>;
}

export default function EntityTypeEventNode(props: EntityTypeEventNodeProps) {
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
        style={{
          backgroundColor: "#669966",
          borderColor: props.data.theme.siteVariables?.colorScheme.brand.background1,
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
