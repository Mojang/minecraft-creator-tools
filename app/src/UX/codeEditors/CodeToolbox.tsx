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

/**
 * Browser-safe replacement for node's `path.isAbsolute`. Returns true when the
 * given (forward-slash-normalized) path is a Windows drive path, a POSIX
 * absolute path, or a URI (file:, vscode-vfs:, http:, etc.).
 */
function looksLikeAbsolutePath(p: string): boolean {
  return (
    /^[a-zA-Z]:\//.test(p) || // Windows drive path (already normalized to "/")
    p.startsWith("/") || // POSIX absolute
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p) // URI scheme prefix
  );
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

    // Only prepend the storage channel id if `fullPath` looks like a path that's
    // relative to the storage root. Some storage backends (notably the VS Code
    // extension-host-backed storage used via MessageProxyStorage for project
    // content) return file paths that are already absolute — e.g. a Windows
    // drive path `C:/…`, a POSIX absolute path `/…`, or a full URI like
    // `file:/c:/…`. Prefixing the channel id onto those produces broken paths
    // such as `<channelId>/file:/c:/…/scripts/main.ts`, which then hits VS
    // Code's "editor could not be opened because the file was not found"
    // dialog.
    //
    // Note: node's `path.isAbsolute` is not available in the browser bundle
    // (webpack `resolve.fallback` sets `path: false`), so we use the inline
    // helper below.
    if (storage instanceof MessageProxyStorage && !looksLikeAbsolutePath(path)) {
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
