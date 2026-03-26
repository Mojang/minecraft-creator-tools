import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import "./InteractPanel.css";
import { Button } from "@mui/material";
import IPersistable from "../types/IPersistable";
import Project from "../../app/Project";
import CreatorTools, { CreatorToolsMinecraftState } from "../../app/CreatorTools";
import IProjectTheme from "../types/IProjectTheme";

interface IInteractPanelProps extends IAppProps {
  setActivePersistable?: (persistObject: IPersistable) => void;
  forceCompact?: boolean;
  project?: Project;
  theme: IProjectTheme;
}

interface IInteractPanelState {}

export default class InteractPanel extends Component<IInteractPanelProps, IInteractPanelState> {
  private _activeEditorPersistable?: IPersistable;

  constructor(props: IInteractPanelProps) {
    super(props);

    this.persist = this.persist.bind(this);
    this.sendMessage = this.sendMessage.bind(this);

    this._onCartoLoaded = this._onCartoLoaded.bind(this);

    this.state = {};

    if (!this.props.creatorTools.isLoaded) {
      this.props.creatorTools.onLoaded.subscribe(this._onCartoLoaded);
      this.props.creatorTools.load();
    }
  }

  private _onCartoLoaded(source: CreatorTools, target: CreatorTools) {
    this.setState({});
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  async sendMessage() {
    if (
      !this.props.creatorTools ||
      !this.props.creatorTools.activeMinecraft ||
      this.props.creatorTools.activeMinecraftState !== CreatorToolsMinecraftState.started
    ) {
      return;
    }

    const mc = this.props.creatorTools.activeMinecraft;

    mc.runCommand("say Hello from Carto!").then((_result) => {
      // Command executed
    });
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    return (
      <div className="intp-outer">
        <div className="intp-header">Interact</div>
        <div>
          <Button variant="contained" onClick={this.sendMessage}>
            Send
          </Button>
        </div>
      </div>
    );
  }
}
