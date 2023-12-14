import { Component, SyntheticEvent } from "react";
import "./MinecraftFilter.css";
import IFormComponentProps from "./IFormComponentProps.js";
import { Toolbar } from "@fluentui/react-northstar";
import { IFilter } from "../minecraft/IFilter";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus } from "@fortawesome/free-solid-svg-icons";

export interface IMinecraftFilterProps extends IFormComponentProps {
  data: IFilter;
  objectKey: string | undefined;

  onChange?: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IMinecraftFilterProps
  ) => void;
}

export enum FilterMode {
  single,
  allOf,
  anyOf,
}

interface IMinecraftFilterState {
  filterMode: FilterMode;
  objectKey: string | undefined;
}

export default class MinecraftFilter extends Component<IMinecraftFilterProps, IMinecraftFilterState> {
  constructor(props: IMinecraftFilterProps) {
    super(props);

    this.state = {
      filterMode: FilterMode.single,
      objectKey: this.props.objectKey,
    };
  }

  _addItem() {}

  render() {
    const toolbarItems = [];

    toolbarItems.push({
      icon: <FontAwesomeIcon icon={faPlus} className="fa-lg" />,
      key: "add",
      onClick: this._addItem,
      title: "Add item",
    });

    return (
      <div className="mifi-outer">
        <Toolbar aria-label="Actions  toolbar overflow menu" items={toolbarItems} />
        <div className="mifi-clauseBin"></div>
      </div>
    );
  }
}
