import { Component } from "react";
import "./EventEditor.css";
import { IDataFormProps } from "../dataformux/DataForm";
import Database from "../minecraft/Database";
import { Toolbar, ThemeInput } from "@fluentui/react-northstar";
import IManagedComponentSetItem from "../minecraft/IManagedComponentSetItem";

interface IEventEditorEditorProps {
  componentSetItem: IManagedComponentSetItem;
  isDefault: boolean;
  theme: ThemeInput<any>;
}

interface IEventEditorEditorState {}

export default class EventEditorEditor extends Component<IEventEditorEditorProps, IEventEditorEditorState> {
  constructor(props: IEventEditorEditorProps) {
    super(props);

    this._addComponentGroupClick = this._addComponentGroupClick.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
  }

  _addComponentGroupClick() {
    this.forceUpdate();
  }

  async _updateManager() {}

  _handleCloseClick(props: IDataFormProps) {
    if (!props.tag) {
      return;
    }

    const componentId = props.tag;

    if (componentId) {
      this.props.componentSetItem.removeComponent(componentId);
      this.forceUpdate();
    }
  }

  render() {
    if (Database.uxCatalog === null) {
      this._updateManager();

      return <div>Loading...</div>;
    }

    const toolbarItems: any[] = [];
    let title = <></>;

    if (this.props.isDefault) {
      title = <div>Default</div>;
    }

    const componentGroupAdds: any[] = [];

    return (
      <div className="eved-area">
        <div className="eved-componentArea">
          <div className="eved-titleArea">{title}</div>
          <div className="eved-componentToolBarArea">
            <Toolbar aria-label="Event editing toolbar" items={toolbarItems} />
          </div>
        </div>
        <div className="eved-cgAddBin">{componentGroupAdds}</div>
      </div>
    );
  }
}
