import { Component } from "react";
import "./CodeToolbox.css";
import { ThemeInput } from "@fluentui/react-northstar";
import IAppProps from "./IAppProps";
import { AppMode } from "./App";
import Project from "./../app/Project";
import ProjectEditor from "./ProjectEditor";
import { CartoEditorViewMode } from "../app/ICartoData";
import ProjectItem from "../app/ProjectItem";
import AppServiceProxy from "../core/AppServiceProxy";
import MessageProxyStorage from "../vscodeweb/MessageProxyStorage";
import Utilities from "../core/Utilities";

interface ICodeToolboxProps extends IAppProps {
  project: Project | null;
  theme: ThemeInput<any>;
  onModeChangeRequested?: (mode: AppMode) => void;
  onProjectSelected?: (project: Project) => void;
}

interface ICodeToolboxState {
  mode: CodeToolboxMode;
}

export enum CodeToolboxMode {
  configuring = 0,
  executing = 1,
  done = 2,
}

export default class CodeToolbox extends Component<ICodeToolboxProps, ICodeToolboxState> {
  constructor(props: ICodeToolboxProps) {
    super(props);

    this._handleProjectItemSelected = this._handleProjectItemSelected.bind(this);

    this.state = {
      mode: CodeToolboxMode.configuring,
    };
  }

  private async _handleProjectItemSelected(newProjectItem: ProjectItem, forceRawView: boolean) {
    if (!newProjectItem.file) {
      return;
    }

    let path = newProjectItem.file.fullPath;

    path = path.replace(/\\/gi, "/");

    const storage = newProjectItem.file.parentFolder.storage;

    if (storage instanceof MessageProxyStorage) {
      path = Utilities.ensureEndsWithSlash(storage.channelId) + Utilities.ensureNotStartsWithSlash(path);
    }

    AppServiceProxy.sendAsync(
      "openItem",
      JSON.stringify({
        path: path,
      })
    );
  }

  render() {
    let interior = <></>;

    if (this.props.project) {
      interior = (
        <ProjectEditor
          carto={this.props.carto}
          theme={this.props.theme}
          onActiveProjectItemChangeRequested={this._handleProjectItemSelected}
          viewMode={CartoEditorViewMode.codeLanding}
          isHosted={true}
          project={this.props.project}
          readOnly={false}
        />
      );
    }

    return <div className="ct-outer">{interior}</div>;
  }
}
