import { Component } from "react";
import "./CodeToolbox.css";
import IAppProps from "../appShell/IAppProps";
import { AppMode } from "../appShell/App";
import Project from "../../app/Project";
import ProjectEditor from "../project/ProjectEditor";
import { CreatorToolsEditorViewMode } from "../../app/ICreatorToolsData";
import ProjectItem from "../../app/ProjectItem";
import AppServiceProxy from "../../core/AppServiceProxy";
import MessageProxyStorage from "../../vscodeweb/MessageProxyStorage";
import Utilities from "../../core/Utilities";
import { ProjectItemEditorView } from "../project/ProjectEditorUtilities";
import IProjectTheme from "../types/IProjectTheme";
import CodeToolboxNoProjectLanding from "./CodeToolboxNoProjectLanding";

interface ICodeToolboxProps extends IAppProps {
  project: Project | null;
  theme: IProjectTheme;
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

  private async _handleProjectItemSelected(newProjectItem: ProjectItem, itemView: ProjectItemEditorView) {
    if (!newProjectItem.primaryFile) {
      return;
    }

    let path = newProjectItem.primaryFile.fullPath;

    path = path.replace(/\\/gi, "/");

    const storage = newProjectItem.primaryFile.parentFolder.storage;

    if (storage instanceof MessageProxyStorage) {
      path = Utilities.ensureEndsWithSlash(storage.channelId) + Utilities.ensureNotStartsWithSlash(path);
    }

    AppServiceProxy.sendAsync(
      "openItem",
      JSON.stringify({
        path: path,
        openAsRawText: itemView === ProjectItemEditorView.singleFileRaw,
      })
    );
  }

  render() {
    let interior = <></>;

    if (this.props.project) {
      interior = (
        <ProjectEditor
          creatorTools={this.props.creatorTools}
          theme={this.props.theme}
          heightOffset={0}
          onActiveProjectItemChangeRequested={this._handleProjectItemSelected}
          viewMode={CreatorToolsEditorViewMode.itemsFocus}
          isHosted={true}
          hideMainToolbar={false}
          project={this.props.project}
          readOnly={false}
        />
      );
    } else {
      interior = (
        <CodeToolboxNoProjectLanding
          creatorTools={this.props.creatorTools}
          project={null}
          theme={this.props.theme}
          forceNewProject={false}
          onModeChangeRequested={this.props.onModeChangeRequested}
        />
      );
    }

    return <div className="ct-outer">{interior}</div>;
  }
}
