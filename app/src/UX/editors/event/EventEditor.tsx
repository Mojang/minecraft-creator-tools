import { Component } from "react";
import "./EventEditor.css";
import { IDataFormProps } from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import { Stack } from "@mui/material";
import IManagedComponentSetItem from "../../../minecraft/IManagedComponentSetItem";
import IProjectTheme from "../../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../../withLocalization";

interface IEventEditorEditorProps extends WithLocalizationProps {
  componentSetItem: IManagedComponentSetItem;
  isDefault: boolean;
  theme: IProjectTheme;
}

interface IEventEditorEditorState {}

class EventEditorEditor extends Component<IEventEditorEditorProps, IEventEditorEditorState> {
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
      title = <div>{this.props.intl.formatMessage({ id: "project_editor.event_ed.default_title" })}</div>;
    }

    const componentGroupAdds: any[] = [];

    return (
      <div className="eved-area">
        <div className="eved-componentArea">
          <div className="eved-titleArea">{title}</div>
          <div className="eved-componentToolBarArea">
            <Stack direction="row" spacing={0.5} aria-label={this.props.intl.formatMessage({ id: "project_editor.event_ed.toolbar_aria" })}>
              {/* Toolbar items can be added here */}
            </Stack>
          </div>
        </div>
        <div className="eved-cgAddBin">{componentGroupAdds}</div>
      </div>
    );
  }
}

export default withLocalization(EventEditorEditor);
