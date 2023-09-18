import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "./../app/Project";
import ProjectItem from "./../app/ProjectItem";
import JavaScriptEditor, { ScriptEditorRole } from "./JavaScriptEditor";
import JsonEditor from "./JsonEditor";
import MCWorldEditor from "./MCWorldEditor";
import StructureEditor from "./StructureEditor";
import FunctionEditor from "./FunctionEditor";
import Log from "./../core/Log";

import IPersistable from "./IPersistable";
import { ProjectItemType } from "../app/IProjectItemData";
import EntityTypeEditor from "./EntityTypeEditor";
import AutoScriptEditor from "./AutoScriptEditor";
import WorldTestEditor from "./WorldTestEditor";
import IGitHubInfo from "../app/IGitHubInfo";
import GitHubReferenceEditor from "./GitHubReferenceEditor";

import "./ProjectItemEditor.css";
import { ThemeInput } from "@fluentui/react-northstar";
import { ProjectEditPreference, ProjectScriptLanguage } from "../app/IProjectData";
import DocumentedModuleEditor from "./DocumentedModuleEditor";
import DocumentedCommandSetEditor from "./DocumentedCommandSetEditor";
import Utilities from "../core/Utilities";
import CartoApp, { HostType } from "../app/CartoApp";
import TextEditor from "./TextEditor";
import NpmPackageJsonEditor from "./NpmPackageJsonEditor";
import BehaviorPackManifestJsonEditor from "./BehaviorPackManifestJsonEditor";
import ImageEditor from "./ImageEditor";

enum ProjectItemEditorDirtyState {
  clean = 0,
  editorDirty = 1,
  itemDirty = 2,
}

interface IProjectItemEditorProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
  forceRawView: boolean;
  activeProjectItem: ProjectItem | null;
  activeReference: IGitHubInfo | null;
  readOnly: boolean;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IProjectItemEditorState {
  dirtyState: ProjectItemEditorDirtyState;
  loadedItem: ProjectItem | null;
}

export default class ProjectItemEditor
  extends Component<IProjectItemEditorProps, IProjectItemEditorState>
  implements IPersistable
{
  private _dirtyState = ProjectItemEditorDirtyState.clean;
  private _activeEditorPersistable?: IPersistable;
  private _isMountedInternal = false;

  constructor(props: IProjectItemEditorProps) {
    super(props);

    this._handleItemLoaded = this._handleItemLoaded.bind(this);
    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._onUpdatePreferredTextSize = this._onUpdatePreferredTextSize.bind(this);
    this._updateFromProps = this._updateFromProps.bind(this);

    if (this.props.activeProjectItem && this.props.activeProjectItem.isLoaded) {
      this.state = {
        dirtyState: ProjectItemEditorDirtyState.clean,
        loadedItem: this.props.activeProjectItem,
      };
    } else {
      this.state = {
        dirtyState: ProjectItemEditorDirtyState.clean,
        loadedItem: null,
      };

      this._updateFromProps();
    }
  }

  componentDidUpdate(prevProps: IProjectItemEditorProps, prevState: IProjectItemEditorState) {
    this._updateFromProps();
  }

  private async _updateFromProps() {
    if (this.props.activeProjectItem !== null && this.props.activeProjectItem !== undefined) {
      if (!this.props.activeProjectItem.isLoaded) {
        this.props.activeProjectItem.onLoaded.subscribe(this._handleItemLoaded);

        await this.props.activeProjectItem.load();
        this._handleItemLoaded(this.props.activeProjectItem);
      } else {
        if (!this.state.loadedItem) {
          this._handleItemLoaded(this.props.activeProjectItem);
        }
      }
    }
  }

  _handleItemLoaded(source: ProjectItem) {
    if (
      this.props != null &&
      source === this.props.activeProjectItem &&
      this._isMountedInternal &&
      source !== this.state?.loadedItem
    ) {
      this.setState({
        dirtyState: this.state.dirtyState,
        loadedItem: source,
      });
    }
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  getActiveProjectItemName() {
    if (this.props.activeProjectItem === null || this.props.activeProjectItem === undefined) {
      return "(no project item selected)";
    } else {
      return this.props.activeProjectItem.storagePath;
    }
  }

  _onUpdatePreferredTextSize(newTextSize: number) {
    this.props.carto.preferredTextSize = newTextSize;
  }

  render() {
    let interior = (
      <div>
        {this.props.activeProjectItem?.storagePath} - {this.props.activeProjectItem?.itemType} -{" "}
        {this.props.activeProjectItem?.isLoaded} -{this.props.activeProjectItem?.file?.storageRelativePath} -{" "}
        {this.props.activeProjectItem?.file?.isContentLoaded ? "loaded" : "unloaded"}
      </div>
    );
    let readOnly = this.props.readOnly;
    const heightOffset = this.props.heightOffset - 4;

    if (this.props.activeReference !== null) {
      interior = (
        <GitHubReferenceEditor
          preferredTextSize={this.props.carto.preferredTextSize}
          project={this.props.project}
          readOnly={readOnly}
          carto={this.props.carto}
          reference={this.props.activeReference}
          heightOffset={heightOffset}
        />
      );
    } else if (this.props.activeProjectItem != null) {
      const file = this.props.activeProjectItem.file;

      const ep = this.props.activeProjectItem.effectiveEditPreference;

      if (this.props.activeProjectItem.isAutogenerated) {
        readOnly = true;
      }

      if (this.props.activeProjectItem.itemType === ProjectItemType.worldFolder) {
        Log.verbose("Showing MCWorld editor for '" + this.props.activeProjectItem.storagePath + "'");

        const pf = this.props.project.projectFolder;

        if (pf !== null && this.props.activeProjectItem.storagePath) {
          const folder = pf.getFolderFromRelativePathLocal(this.props.activeProjectItem.storagePath);
          interior = (
            <MCWorldEditor
              carto={this.props.carto}
              project={this.props.project}
              readOnly={this.props.readOnly}
              heightOffset={heightOffset}
              displayProps={true}
              folder={folder}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        }
      } else if (file !== null && file.isContentLoaded) {
        if (this.props.setActivePersistable !== undefined) {
          this.props.setActivePersistable(this);
        }

        const projItem = this.props.activeProjectItem;

        if (file.type === "js" || file.type === "ts") {
          let pref = this.props.project.preferredScriptLanguage;

          if (file.type === "ts") {
            pref = ProjectScriptLanguage.typeScript;
          }

          if (file.content == null) {
            Log.verbose("Setting null content for file.");
            file.setContent("");
          }

          // Log.verbose("Showing JavaScript editor for '" + file.fullPath + "' size: " + file.content?.length);

          let role = ScriptEditorRole.script;

          if (projItem.itemType === ProjectItemType.testJs) {
            role = ScriptEditorRole.gameTest;
          }

          // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
            interior = (
              <TextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                carto={this.props.carto}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          } else {
            interior = (
              <JavaScriptEditor
                role={role}
                carto={this.props.carto}
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                project={this.props.project}
                scriptLanguage={pref}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          }
        } else if (file.type === "mcfunction") {
          if (file.content == null) {
            file.setContent("");
          }

          Log.verbose("Showing MCFunction editor for '" + file.storageRelativePath + "'");
          // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
            interior = (
              <TextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                carto={this.props.carto}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          } else {
            interior = (
              <FunctionEditor
                theme={this.props.theme}
                carto={this.props.carto}
                project={this.props.project}
                roleId={"itemEditor"}
                isCommandEditor={false}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={this.props.readOnly}
                heightOffset={this.props.heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          }
        } else if (
          (file.type === "png" || file.type === "jpg" || file.type === "jpeg" || file.type === "tga") &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          Log.verbose("Showing image editor for '" + file.storageRelativePath + "'");
          interior = (
            <ImageEditor
              readOnly={this.props.readOnly}
              heightOffset={this.props.heightOffset}
              carto={this.props.carto}
              theme={this.props.theme}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.entityTypeBehaviorJson &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          Log.verbose("Showing entity type editor for '" + file.storageRelativePath + "'");
          interior = (
            <EntityTypeEditor
              readOnly={this.props.readOnly}
              heightOffset={this.props.heightOffset}
              theme={this.props.theme}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.autoScriptJson &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          if (file.content == null) {
            file.setContent("{}");
          }

          Log.verbose("Showing autoscript editor for '" + file.storageRelativePath + "'");
          interior = (
            <AutoScriptEditor
              readOnly={this.props.readOnly}
              heightOffset={this.props.heightOffset}
              file={file}
              carto={this.props.carto}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.worldTest &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          if (file.content == null) {
            file.setContent("{}");
          }

          Log.verbose("Showing world test editor for '" + file.storageRelativePath + "'");
          interior = (
            <WorldTestEditor
              carto={this.props.carto}
              readOnly={this.props.readOnly}
              heightOffset={this.props.heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.typesDefinitionJson &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          if (file.content == null) {
            file.setContent("{}");
          }

          interior = (
            <DocumentedModuleEditor
              carto={this.props.carto}
              theme={this.props.theme}
              typesReadOnly={true}
              docsReadOnly={this.props.readOnly}
              heightOffset={this.props.heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.packageJson &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          if (file.content == null) {
            file.setContent("{}");
          }

          interior = (
            <NpmPackageJsonEditor
              theme={this.props.theme}
              heightOffset={this.props.heightOffset}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.behaviorPackManifestJson &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          if (file.content == null) {
            file.setContent("{}");
          }

          interior = (
            <BehaviorPackManifestJsonEditor
              theme={this.props.theme}
              heightOffset={this.props.heightOffset}
              file={file}
              readOnly={this.props.readOnly}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (
          file.type === "json" &&
          projItem.itemType === ProjectItemType.commandSetDefinitionJson &&
          !(this.props.forceRawView || ep === ProjectEditPreference.raw)
        ) {
          if (file.content == null) {
            file.setContent("{}");
          }

          interior = (
            <DocumentedCommandSetEditor
              carto={this.props.carto}
              theme={this.props.theme}
              typesReadOnly={true}
              docsReadOnly={this.props.readOnly}
              heightOffset={this.props.heightOffset}
              file={file}
              project={this.props.project}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "json") {
          if (file.content == null) {
            file.setContent("");
          }

          Log.verbose("Showing Json editor for '" + file.storageRelativePath + "'");
          // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
          if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
            interior = (
              <TextEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                carto={this.props.carto}
                heightOffset={heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          } else {
            interior = (
              <JsonEditor
                theme={this.props.theme}
                onUpdatePreferredTextSize={this._onUpdatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={readOnly}
                item={this.props.activeProjectItem}
                heightOffset={this.props.heightOffset}
                file={file}
                setActivePersistable={this._handleNewChildPersistable}
              />
            );
          }
        } else if (file.type === "mcproject" || file.type === "mcworld" || file.type === "mctemplate") {
          Log.verbose("Showing MCWorld editor for '" + file.storageRelativePath + "'");
          interior = (
            <MCWorldEditor
              carto={this.props.carto}
              project={this.props.project}
              readOnly={this.props.readOnly}
              displayProps={true}
              heightOffset={this.props.heightOffset}
              file={file}
              setActivePersistable={this._handleNewChildPersistable}
            />
          );
        } else if (file.type === "mcstructure" || file.type === "snbt") {
          Log.verbose("Showing structure editor for '" + file.storageRelativePath + "'");
          interior = (
            <StructureEditor
              project={this.props.project}
              readOnly={this.props.readOnly}
              heightOffset={this.props.heightOffset}
              carto={this.props.carto}
              setActivePersistable={this._handleNewChildPersistable}
              file={file}
            />
          );
        }
      }
    }

    return <div className="pie-outer">{interior}</div>;
  }
}
