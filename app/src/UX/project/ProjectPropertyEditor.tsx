import { Component, SyntheticEvent } from "react";
import IAppProps from "../appShell/IAppProps";
import Project, { ProjectTargetStrings } from "../../app/Project";
import "./ProjectPropertyEditor.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import React from "react";
import { Button as MuiButton } from "@mui/material";

// Compatibility wrappers replacing Northstar components with plain HTML/MUI
// These preserve the (e, {value}) onChange signature used throughout this file

function Input(props: {
  className?: string;
  clearable?: boolean;
  inline?: boolean;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  error?: boolean;
  "aria-labelledby"?: string;
  "aria-label"?: string;
  onChange?: (e: React.SyntheticEvent, data: { value: string } | undefined) => void;
  [key: string]: any;
}) {
  const { className, clearable, inline, error, onChange, ...rest } = props;
  return (
    <input
      className={className || ""}
      placeholder={props.placeholder}
      value={props.value ?? props.defaultValue ?? ""}
      aria-labelledby={props["aria-labelledby"]}
      aria-label={props["aria-label"]}
      style={error ? { borderColor: "red" } : undefined}
      onChange={(e) => onChange?.(e, { value: e.target.value })}
    />
  );
}

function TextArea(props: {
  className?: string;
  placeholder?: string;
  value?: string;
  "aria-labelledby"?: string;
  onChange?: (e: React.SyntheticEvent<HTMLElement, Event>, data?: { value?: string }) => void;
  [key: string]: any;
}) {
  const { className, onChange, ...rest } = props;
  return (
    <textarea
      className={className || ""}
      placeholder={props.placeholder}
      value={props.value ?? ""}
      aria-labelledby={props["aria-labelledby"]}
      onChange={(e) => onChange?.(e, { value: e.target.value })}
    />
  );
}

function Dropdown(props: {
  className?: string;
  items?: string[];
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  "aria-labelledby"?: string;
  onChange?: (
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: { value?: string | string[] }
  ) => void;
  [key: string]: any;
}) {
  return (
    <select
      className={props.className || ""}
      value={props.value ?? props.defaultValue ?? ""}
      aria-labelledby={props["aria-labelledby"]}
      onChange={(e) => props.onChange?.(null, { value: e.target.value })}
    >
      {props.items?.map((item: string) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}

function Button(props: {
  content?: string | React.ReactNode;
  icon?: React.ReactNode;
  iconPosition?: string;
  primary?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
  children?: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <MuiButton
      variant={props.primary ? "contained" : "outlined"}
      size="small"
      startIcon={props.iconPosition === "before" ? props.icon : undefined}
      endIcon={props.iconPosition !== "before" ? props.icon : undefined}
      onClick={props.onClick}
      aria-label={props["aria-label"]}
    >
      {props.content || props.children}
    </MuiButton>
  );
}

function Dialog(props: {
  cancelButton?: string;
  confirmButton?: string;
  content?: React.ReactNode;
  onConfirm?: () => void;
  header?: string;
  trigger?: React.ReactNode;
  [key: string]: any;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <span onClick={() => setOpen(true)}>{props.trigger}</span>
      {open && (
        <div className="ppe-dialogOverlay" onClick={() => setOpen(false)}>
          <div className="ppe-dialog" onClick={(e) => e.stopPropagation()}>
            {props.header && <div className="ppe-dialogHeader">{props.header}</div>}
            <div className="ppe-dialogContent">{props.content}</div>
            <div className="ppe-dialogActions">
              {props.cancelButton && <MuiButton onClick={() => setOpen(false)}>{props.cancelButton}</MuiButton>}
              {props.confirmButton && (
                <MuiButton
                  variant="contained"
                  onClick={() => {
                    props.onConfirm?.();
                    setOpen(false);
                  }}
                >
                  {props.confirmButton}
                </MuiButton>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import {
  faDice,
  faBinoculars,
  faUser,
  faFileSignature,
  faCode,
  faCubes,
  faWrench,
  faFingerprint,
} from "@fortawesome/free-solid-svg-icons";
import ConnectToGitHub from "../io/ConnectToGitHub";
import Utilities from "../../core/Utilities";
import AppServiceProxy from "../../core/AppServiceProxy";
import { ProjectEditPreference, ProjectScriptLanguage, ProjectScriptVersion } from "../../app/IProjectData";
import CreatorToolsHost, { CreatorToolsThemeStyle, HostType } from "../../app/CreatorToolsHost";
import ProjectUtilities from "../../app/ProjectUtilities";
import StatusList from "../appShell/StatusList";
import { MinecraftTrack } from "../../app/ICreatorToolsData";
import { CreatorToolsTargetSettings } from "../../app/CreatorTools";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";
import { IntlShape } from "react-intl";

interface IProjectPropertyEditorProps extends IAppProps, WithLocalizationProps {
  project: Project;
  theme: IProjectTheme;
  heightOffset: number;
  onContentUpdated?: () => void;
}

interface IProjectPropertyEditorState {
  name: string;
  title: string;
  defaultNamespace?: string;
  shortName?: string;
  creator?: string;
}

export enum GitHubPropertyType {
  repoName = 0,
  owner = 1,
  branch = 2,
  folder = 3,
  newDescription = 4,
  mode = 5,
  title = 6,
}

export function getScriptVersionStrings(intl: IntlShape): string[] {
  return [
    intl.formatMessage({ id: "project_editor.props.script_latest_stable" }),
    intl.formatMessage({ id: "project_editor.props.script_stable_1x" }),
  ];
}
export function getProjectFocusStrings(intl: IntlShape): string[] {
  return [
    intl.formatMessage({ id: "project_editor.props.focus_general" }),
    intl.formatMessage({ id: "project_editor.props.focus_gametests" }),
    intl.formatMessage({ id: "project_editor.props.focus_world" }),
    intl.formatMessage({ id: "project_editor.props.focus_sample_behavior" }),
    intl.formatMessage({ id: "project_editor.props.focus_editor_extension" }),
  ];
}
export function getProjectEditorPreferences(intl: IntlShape): string[] {
  return [
    intl.formatMessage({ id: "project_editor.props.pref_default" }),
    intl.formatMessage({ id: "project_editor.props.pref_visual_hide_advanced" }),
    intl.formatMessage({ id: "project_editor.props.pref_visual" }),
    intl.formatMessage({ id: "project_editor.props.pref_raw_json" }),
  ];
}

class ProjectPropertyEditor extends Component<IProjectPropertyEditorProps, IProjectPropertyEditorState> {
  private tentativeGitHubMode: string = "existing";
  private tentativeGitHubRepoName?: string;
  private tentativeGitHubOwner?: string;
  private tentativeGitHubNewDescription?: string;

  constructor(props: IProjectPropertyEditorProps) {
    super(props);

    this._createNewBehaviorPackUniqueId = this._createNewBehaviorPackUniqueId.bind(this);
    this._createNewResourcePackUniqueId = this._createNewResourcePackUniqueId.bind(this);
    this._createNewScriptUniqueId = this._createNewScriptUniqueId.bind(this);
    this._createNewDataUniqueId = this._createNewDataUniqueId.bind(this);
    this._update = this._update.bind(this);
    this._githubProjectUpdated = this._githubProjectUpdated.bind(this);
    this._handleTitleChanged = this._handleTitleChanged.bind(this);
    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._handleShortNameChanged = this._handleShortNameChanged.bind(this);
    this._handleCreatorChanged = this._handleCreatorChanged.bind(this);
    this._handleCommitToGitHub = this._handleCommitToGitHub.bind(this);
    this._handleBehaviorPackUuidChanged = this._handleBehaviorPackUuidChanged.bind(this);
    this._handleResourcePackUuidChanged = this._handleResourcePackUuidChanged.bind(this);
    this._handleScriptUuidChanged = this._handleScriptUuidChanged.bind(this);
    this._handleDataUuidChanged = this._handleDataUuidChanged.bind(this);
    this._handleConnectToGitHub = this._handleConnectToGitHub.bind(this);
    this._handleDescriptionChanged = this._handleDescriptionChanged.bind(this);
    this._rescanFiles = this._rescanFiles.bind(this);
    this._handleFocusChange = this._handleFocusChange.bind(this);
    this._handleVersionMajorChanged = this._handleVersionMajorChanged.bind(this);
    this._handleVersionMinorChanged = this._handleVersionMinorChanged.bind(this);
    this._handleVersionPatchChanged = this._handleVersionPatchChanged.bind(this);
    this._handleDefaultNamespaceChanged = this._handleDefaultNamespaceChanged.bind(this);
    this._handleScriptEntryPointChanged = this._handleScriptEntryPointChanged.bind(this);
    this._convertJavaToBedrock = this._convertJavaToBedrock.bind(this);
    this._handleLanguageChange = this._handleLanguageChange.bind(this);
    this._handleTrackChange = this._handleTrackChange.bind(this);
    this._handleEditPreferenceChange = this._handleEditPreferenceChange.bind(this);
    this._handleVersionChange = this._handleVersionChange.bind(this);

    this._connectToProps();

    this.state = {
      name: this.props.project.name,
      title: this.props.project.title,
      defaultNamespace: this.props.project.defaultNamespace,
      shortName: this.props.project.shortName,
      creator: this.props.project.creator,
    };
  }

  _githubProjectUpdated(property: GitHubPropertyType, value: string) {
    switch (property) {
      case GitHubPropertyType.repoName:
        this.tentativeGitHubRepoName = value;
        break;

      case GitHubPropertyType.owner:
        this.tentativeGitHubOwner = value;
        break;

      case GitHubPropertyType.mode:
        this.tentativeGitHubMode = value;
        break;

      case GitHubPropertyType.newDescription:
        this.tentativeGitHubNewDescription = value;
        break;
    }
  }

  componentDidUpdate(prevProps: IProjectPropertyEditorProps, prevState: IProjectPropertyEditorState) {
    if (prevProps !== undefined && prevProps.project !== undefined) {
      prevProps.project.onPropertyChanged.unsubscribe(this._update);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.project !== undefined) {
      if (!this.props.project.onPropertyChanged.has(this._update)) {
        this.props.project.onPropertyChanged.subscribe(this._update);
      }
    }
  }

  _handleCreatorChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.setState({
      name: this.state.name,
      title: this.state.title,
      creator: data.value,
      shortName: this.state.shortName,
      defaultNamespace: this.state.defaultNamespace,
    });

    ProjectUtilities.applyCreator(this.props.project, data.value);
  }

  _handleShortNameChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.setState({
      name: this.state.name,
      title: this.state.title,
      creator: this.state.creator,
      shortName: data.value,
    });

    ProjectUtilities.applyShortName(this.props.project, data.value);
  }

  _handleTitleChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.setState({
      name: this.state.name,
      title: data.value,
      creator: this.state.creator,
      defaultNamespace: this.state.defaultNamespace,
      shortName: this.state.shortName,
    });

    ProjectUtilities.applyTitle(this.props.project, data.value);
  }

  _handleNameChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.setState({
      name: data.value,
      title: this.state.title,
    });

    ProjectUtilities.applyTitle(this.props.project, data.value);
  }

  async _handleBehaviorPackUuidChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    await ProjectUtilities.applyBehaviorPackUniqueId(this.props.project, data.value);
  }

  _handleResourcePackUuidChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.setDefaultResourcePackUniqueIdAndUpdateDependencies(data.value);
  }

  _handleScriptUuidChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.defaultScriptModuleUniqueId = data.value;
  }

  _handleDataUuidChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.defaultDataUniqueId = data.value;
  }

  async _rescanFiles() {
    this.props.project.resetProjectItems();
    await this.props.project.inferProjectItemsFromFilesRootFolder(true);
    await this.props.creatorTools.notifyStatusUpdate(
      this.props.intl.formatMessage(
        { id: "project_editor.props.rescanned" },
        { path: this.props.project.projectFolder?.fullPath }
      )
    );
    this.forceUpdate();

    if (this.props.onContentUpdated) {
      this.props.onContentUpdated();
    }
  }

  async _handleDescriptionChanged(e: SyntheticEvent<HTMLElement, Event>, data?: { value?: string } | undefined) {
    if (e === undefined || data === undefined || data.value === undefined) {
      return;
    }

    await ProjectUtilities.applyDescription(this.props.project, data.value);
  }

  _handleDefaultNamespaceChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.defaultNamespace = ProjectUtilities.canonicalizeNamespace(data.value);
  }

  async _handleScriptEntryPointChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    await ProjectUtilities.applyScriptEntryPoint(this.props.project, data.value);
  }

  _handleVersionMajorChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    const intVal = parseInt(data.value);

    if (isNaN(intVal)) {
      this.props.project.versionMajor = undefined;
    } else {
      this.props.project.versionMajor = intVal;
    }
  }

  _handleVersionMinorChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    const intVal = parseInt(data.value);

    if (isNaN(intVal)) {
      this.props.project.versionMinor = undefined;
    } else {
      this.props.project.versionMinor = intVal;
    }
  }

  _handleVersionPatchChanged(e: SyntheticEvent, data: { value: string } | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    const intVal = parseInt(data.value);

    if (isNaN(intVal)) {
      this.props.project.versionPatch = undefined;
    } else {
      this.props.project.versionPatch = intVal;
    }
  }

  _update() {
    this.forceUpdate();
  }

  _convertJavaToBedrock() {}

  _createNewResourcePackUniqueId() {
    this.props.project.setDefaultResourcePackUniqueIdAndUpdateDependencies(Utilities.createUuid());
  }

  _createNewBehaviorPackUniqueId() {
    this.props.project.setDefaultBehaviorPackUniqueIdAndUpdateDependencies(Utilities.createUuid());
  }

  _createNewDataUniqueId() {
    this.props.project.defaultDataUniqueId = Utilities.createUuid();
  }

  _createNewScriptUniqueId() {
    this.props.project.defaultScriptModuleUniqueId = Utilities.createUuid();
  }

  async _handleConnectToGitHub() {
    if (
      this.tentativeGitHubMode === "new" &&
      this.tentativeGitHubRepoName !== undefined &&
      this.tentativeGitHubNewDescription !== undefined
    ) {
      const gh = this.props.creatorTools.userGitHub;

      if (gh !== null && gh.authenticatedUser !== undefined && gh.authenticatedUser.name !== null) {
        await gh.createRepo(this.tentativeGitHubRepoName, this.tentativeGitHubNewDescription);

        this.props.project.gitHubOwner = gh.authenticatedUser.name;
        this.props.project.gitHubRepoName = this.tentativeGitHubRepoName;
      }
    } else {
      if (this.tentativeGitHubRepoName !== undefined && this.tentativeGitHubOwner !== undefined) {
        this.props.project.gitHubOwner = this.tentativeGitHubOwner;
        this.props.project.gitHubRepoName = this.tentativeGitHubRepoName;
      }
    }

    this.forceUpdate();
  }

  async _handleCommitToGitHub() {
    this.forceUpdate();
  }

  _handleLanguageChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: { value?: string | string[] }
  ) {
    if (data.value === this.props.intl.formatMessage({ id: "project_editor.props.typescript" })) {
      this.props.project.preferredScriptLanguage = ProjectScriptLanguage.typeScript;
    } else {
      this.props.project.preferredScriptLanguage = ProjectScriptLanguage.javaScript;
    }

    this.props.project.save();
  }

  _handleTrackChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: { value?: string | string[] }
  ) {
    if (data.value === ProjectTargetStrings[1]) {
      this.props.project.track = MinecraftTrack.main;
    } else if (data.value === ProjectTargetStrings[2]) {
      this.props.project.track = MinecraftTrack.preview;
    } else if (data.value === ProjectTargetStrings[3]) {
      this.props.project.track = MinecraftTrack.edu;
    } else if (data.value === ProjectTargetStrings[4]) {
      this.props.project.track = MinecraftTrack.eduPreview;
    } else {
      this.props.project.track = undefined;
    }

    this.props.project.save();
  }

  _handleEditPreferenceChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: { value?: string | string[] }
  ) {
    if (data.value === getProjectEditorPreferences(this.props.intl)[1]) {
      this.props.project.editPreference = ProjectEditPreference.summarized;
    } else if (data.value === getProjectEditorPreferences(this.props.intl)[2]) {
      this.props.project.editPreference = ProjectEditPreference.editors;
    } else if (data.value === getProjectEditorPreferences(this.props.intl)[3]) {
      this.props.project.editPreference = ProjectEditPreference.raw;
    } else {
      this.props.project.editPreference = ProjectEditPreference.default;
    }

    this.props.project.save();
    this.forceUpdate();
  }

  _handleFocusChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: { value?: string | string[] }
  ) {
    let i = 0;
    for (const str in getProjectFocusStrings(this.props.intl)) {
      if (data.value === str) {
        this.props.project.focus = i;
      }

      i++;
    }
  }

  _handleVersionChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: { value?: string | string[] }
  ) {
    if (data.value === "Latest Beta") {
      this.props.project.scriptVersion = ProjectScriptVersion.latestStable;
    } else {
      this.props.project.scriptVersion = ProjectScriptVersion.stable10;
    }
  }

  render() {
    const gitHubInner = [];

    const baseUrl = window.location.href;
    const localTools = [];
    let statusArea = <></>;

    if (this.props === undefined) {
      return <></>;
    }

    const targetStrings = [];

    const index = this.props.creatorTools.track ? (this.props.creatorTools.track as number) : 0;

    targetStrings.push(
      this.props.intl.formatMessage(
        { id: "project_editor.props.default_target" },
        { target: CreatorToolsTargetSettings[index] }
      )
    );

    for (const targetString of CreatorToolsTargetSettings) {
      targetStrings.push(targetString);
    }

    let gitHubConnect = <></>;

    if (this.props.project.messages) {
      statusArea = (
        <div className="ppe-statusArea">
          <StatusList
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
            status={this.props.project.messages}
          />
        </div>
      );
    }

    if (
      CreatorToolsHost.hostType === HostType.webPlusServices &&
      (this.props.project.gitHubOwner === undefined || this.props.project.gitHubRepoName === undefined)
    ) {
      gitHubInner.push(
        <div key="notConnected">
          {this.props.intl.formatMessage({ id: "project_editor.props.not_connected_github" })}
        </div>
      );

      gitHubConnect = (
        <Dialog
          cancelButton="Cancel"
          confirmButton={this.props.intl.formatMessage({ id: "project_editor.props.confirm" })}
          key="cghC"
          content={
            <ConnectToGitHub
              onGitHubProjectUpdated={this._githubProjectUpdated}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
            />
          }
          onConfirm={this._handleConnectToGitHub}
          header={this.props.intl.formatMessage({ id: "project_editor.props.select_github_project" })}
          trigger={
            <Button
              content={this.props.intl.formatMessage({ id: "project_editor.props.connect_github_project" })}
              iconPosition="before"
              primary
            />
          }
        />
      );
    } else if (CreatorToolsHost.hostType === HostType.webPlusServices) {
      let gitHubFolder = <></>;

      const ghUrl = baseUrl + "#open=gh/" + this.props.project.gitHubOwner + "/" + this.props.project.gitHubRepoName;

      if (this.props.project.gitHubFolder !== undefined) {
        gitHubFolder = (
          <div key="ghfo">
            <div className="ppe-ghheader">
              {this.props.intl.formatMessage({ id: "project_editor.props.folder_label" })}
            </div>
            <div>{this.props.project.gitHubFolder}</div>
          </div>
        );
      }

      gitHubInner.push(
        <div key="ghProjInfo">
          <div className="ppe-ghheader">
            {this.props.intl.formatMessage({ id: "project_editor.props.project_label" })}
          </div>
          <div>
            {this.props.project.gitHubOwner}/{this.props.project.gitHubRepoName}
          </div>
          {gitHubFolder}
          <div>
            <div className="ppe-ghshareableUrl" id="ppe-ghshareableUrlLabel">
              {this.props.intl.formatMessage({ id: "project_editor.props.shareable_url_label" })}
            </div>
            <Input
              aria-labelledby="ppe-ghshareableUrlLabel"
              inline
              clearable
              value={ghUrl}
              className="ppe-uniqueIdInputValue"
            />
            <div>
              <a target="_blank" rel="noreferrer" href={ghUrl} className="ppe-link">
                {this.props.intl.formatMessage({ id: "project_editor.props.link" })}
              </a>
            </div>
          </div>
        </div>
      );

      gitHubConnect = (
        <Dialog
          cancelButton="Cancel"
          confirmButton={this.props.intl.formatMessage({ id: "project_editor.props.confirm" })}
          key="selectGHP"
          content={
            <ConnectToGitHub
              onGitHubProjectUpdated={this._githubProjectUpdated}
              project={this.props.project}
              creatorTools={this.props.creatorTools}
            />
          }
          onConfirm={this._handleConnectToGitHub}
          header={this.props.intl.formatMessage({ id: "project_editor.props.select_github_project" })}
          trigger={
            <Button
              content={this.props.intl.formatMessage({ id: "project_editor.props.connect_github_project" })}
              iconPosition="before"
              primary
            />
          }
        />
      );
    }

    let behaviorPackUniqueIdIsError = false;

    if (this.props.project !== undefined) {
      if (this.props.project.defaultBehaviorPackUniqueId === undefined) {
        behaviorPackUniqueIdIsError = true;
      } else if (this.props.project.defaultBehaviorPackUniqueId.length !== 36) {
        behaviorPackUniqueIdIsError = true;
      }
    }

    let resourcePackUniqueIdIsError = false;

    if (this.props.project !== undefined) {
      if (this.props.project.defaultResourcePackUniqueId === undefined) {
        resourcePackUniqueIdIsError = true;
      } else if (this.props.project.defaultResourcePackUniqueId.length !== 36) {
        resourcePackUniqueIdIsError = true;
      }
    }

    let dataUniqueIdIsError = false;

    if (this.props.project !== undefined) {
      if (this.props.project.defaultDataUniqueId === undefined) {
        dataUniqueIdIsError = true;
      } else if (this.props.project.defaultDataUniqueId.length !== 36) {
        dataUniqueIdIsError = true;
      }
    }

    let scriptUniqueIdIsError = false;

    if (this.props.project !== undefined) {
      if (this.props.project.defaultScriptModuleUniqueId === undefined) {
        scriptUniqueIdIsError = true;
      } else if (this.props.project.defaultScriptModuleUniqueId.length !== 36) {
        scriptUniqueIdIsError = true;
      }
    }

    if (this.props.creatorTools.workingStorage !== null && AppServiceProxy.hasAppServiceOrDebug) {
      let rescanStr = "Re-scan files";

      const projFolder = this.props.project.projectFolder;

      if (projFolder !== null && projFolder !== undefined) {
        rescanStr = this.props.intl.formatMessage(
          { id: "project_editor.props.rescan_files_at" },
          { path: projFolder.fullPath }
        );
      }

      localTools.push(
        <div title={rescanStr} key="rescanLt">
          <Button
            key="rescan"
            content={this.props.intl.formatMessage({ id: "project_editor.props.rescan_files" })}
            icon={<FontAwesomeIcon icon={faBinoculars} className="fa-lg" />}
            onClick={this._rescanFiles}
            iconPosition="before"
            primary
          />
        </div>
      );
    }

    let versionMajor = this.props.project.versionMajor;

    if (versionMajor === undefined) {
      versionMajor = 0;
    }

    let versionMinor = this.props.project.versionMinor;

    if (versionMinor === undefined) {
      versionMinor = 0;
    }

    let versionPatch = this.props.project.versionPatch;

    if (versionPatch === undefined) {
      versionPatch = 1;
    }

    const height = "calc(100vh - " + (this.props.heightOffset + 62) + "px)";
    const isDarkMode = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
    const brand = getThemeColors();

    // Theme-aware styles
    const outerStyle: React.CSSProperties = {
      background: brand?.background1,
    };

    const contentStyle: React.CSSProperties = {
      background: brand?.background2,
    };

    const sectionStyle: React.CSSProperties = {
      background: brand?.background3,
      borderColor: brand?.background4,
    };

    // a11y (WCAG 1.4.3): section header text uses foreground1 (high-contrast offWhite/offBlack)
    // for ≥4.5:1 contrast on the section header background. The previous value of
    // `brand.foreground` (Minecraft green) measured 3.07:1 on background2 in dark mode.
    // The accent green is preserved on the icon (.ppe-sectionIcon) via CSS, where the
    // 3:1 minimum for non-text contrast (WCAG 1.4.11) is met.
    const sectionHeaderStyle: React.CSSProperties = {
      background: brand?.background2,
      color: brand?.foreground1,
      borderBottomColor: brand?.background4,
    };

    // a11y (WCAG 1.4.3): use foreground5 in dark mode (orange) but switch to a darker
    // warning color in light mode where contrast against background2 is acceptable.
    const advancedSectionHeaderStyle: React.CSSProperties = {
      background: brand?.background2,
      color: isDarkMode ? brand?.foreground5 : "#9a4a00", // Orange for advanced/warning
      borderBottomColor: brand?.background4,
    };

    // a11y (WCAG 1.4.3): field labels use foreground1 (offWhite/offBlack) for ≥4.5:1
    // contrast on the section background. The previous value of `brand.foreground6`
    // measured 2.03:1 in dark mode and ~3.55:1 in light mode against background3.
    const labelStyle: React.CSSProperties = {
      color: brand?.foreground1,
    };

    const uuidFieldStyle: React.CSSProperties = {
      background: brand?.background2,
      borderColor: brand?.background4,
    };

    return (
      <div className={"ppe-outer" + (isDarkMode ? " ppe-dark" : " ppe-light")} style={outerStyle}>
        <div className="ppe-header">
          <FontAwesomeIcon icon={faCubes} className="ppe-headerIcon" />
          {this.props.intl.formatMessage({ id: "project_editor.props.header" })}
        </div>

        <div className="ppe-content" style={contentStyle}>
          {/* Basic Info Section */}
          <div className="ppe-section" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
              <FontAwesomeIcon icon={faUser} className="ppe-sectionIcon" />
              {this.props.intl.formatMessage({ id: "project_editor.props.basic_information" })}
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-creatorlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.creator" })}
                </label>
                <Input
                  aria-labelledby="ppe-creatorlabel"
                  className="ppe-fieldInput"
                  clearable
                  placeholder={this.props.project.effectiveCreator}
                  value={this.state.creator}
                  onChange={this._handleCreatorChanged}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-namelabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.name" })}
                </label>
                <Input
                  aria-labelledby="ppe-namelabel"
                  className="ppe-fieldInput"
                  clearable
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.name_placeholder" })}
                  value={this.state.name}
                  onChange={this._handleNameChanged}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-shortNamelabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.short_name" })}
                </label>
                <Input
                  aria-labelledby="ppe-shortNamelabel"
                  className="ppe-fieldInput"
                  clearable
                  placeholder={
                    this.state.creator && this.state.creator.length > 0 && this.state.name && this.state.name.length > 0
                      ? ProjectUtilities.getSuggestedProjectShortName(this.state.creator, this.state.name)
                      : this.props.project.effectiveShortName
                  }
                  value={this.state.shortName !== "" ? this.state.shortName : undefined}
                  onChange={this._handleShortNameChanged}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-namespacelabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.namespace" })}
                </label>
                <Input
                  className="ppe-fieldInput"
                  clearable
                  aria-labelledby="ppe-namespacelabel"
                  placeholder={this.props.project.effectiveShortName}
                  defaultValue={this.props.project.defaultNamespace}
                  value={this.props.project.defaultNamespace !== "" ? this.state.defaultNamespace : undefined}
                  onChange={this._handleDefaultNamespaceChanged}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-titlelabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.title" })}
                </label>
                <Input
                  aria-labelledby="ppe-titlelabel"
                  className="ppe-fieldInput"
                  clearable
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.title_placeholder" })}
                  value={this.state.title}
                  onChange={this._handleTitleChanged}
                />
              </div>
              <div className="ppe-field ppe-field-full">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-descriptionlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.description" })}
                </label>
                <TextArea
                  aria-labelledby="ppe-descriptionlabel"
                  className="ppe-fieldTextArea"
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.description_placeholder" })}
                  value={this.props.project.description}
                  onChange={this._handleDescriptionChanged}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-versionlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.version" })}
                </label>
                <div className="ppe-versionInputs">
                  <Input
                    className="ppe-versionInput"
                    clearable
                    aria-label={this.props.intl.formatMessage({ id: "project_editor.props.aria_major_version" })}
                    placeholder={this.props.intl.formatMessage({ id: "project_editor.props.major_placeholder" })}
                    value={versionMajor + ""}
                    onChange={this._handleVersionMajorChanged}
                  />
                  <span className="ppe-versionDot">.</span>
                  <Input
                    className="ppe-versionInput"
                    clearable
                    aria-label={this.props.intl.formatMessage({ id: "project_editor.props.aria_minor_version" })}
                    placeholder={this.props.intl.formatMessage({ id: "project_editor.props.minor_placeholder" })}
                    value={versionMinor + ""}
                    onChange={this._handleVersionMinorChanged}
                  />
                  <span className="ppe-versionDot">.</span>
                  <Input
                    className="ppe-versionInput"
                    clearable
                    aria-label={this.props.intl.formatMessage({ id: "project_editor.props.aria_patch_version" })}
                    placeholder={this.props.intl.formatMessage({ id: "project_editor.props.patch_placeholder" })}
                    value={versionPatch + ""}
                    onChange={this._handleVersionPatchChanged}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Project Settings Section */}
          <div className="ppe-section" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
              <FontAwesomeIcon icon={faFileSignature} className="ppe-sectionIcon" />
              {this.props.intl.formatMessage({ id: "project_editor.props.project_settings" })}
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-focuslabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.type" })}
                </label>
                <Dropdown
                  aria-labelledby="ppe-focuslabel"
                  className="ppe-fieldDropdown"
                  items={getProjectFocusStrings(this.props.intl)}
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.select_focus" })}
                  defaultValue={getProjectFocusStrings(this.props.intl)[this.props.project.focus]}
                  onChange={this._handleFocusChange}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-tracklabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.target_minecraft" })}
                </label>
                <Dropdown
                  aria-labelledby="ppe-tracklabel"
                  className="ppe-fieldDropdown"
                  items={targetStrings}
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.select_target_version" })}
                  defaultValue={targetStrings[this.props.project.track ? (this.props.project.track as number) + 1 : 0]}
                  onChange={this._handleTrackChange}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-defaultEditlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.edit_experience" })}
                </label>
                <Dropdown
                  items={getProjectEditorPreferences(this.props.intl)}
                  aria-labelledby="ppe-defaultEditlabel"
                  className="ppe-fieldDropdown"
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.select_edit_experience" })}
                  defaultValue={getProjectEditorPreferences(this.props.intl)[this.props.project.editPreference]}
                  onChange={this._handleEditPreferenceChange}
                />
                <div className="ppe-fieldNote">
                  {this.props.project.effectiveEditPreference === ProjectEditPreference.summarized ||
                  this.props.project.editPreference === ProjectEditPreference.editors
                    ? this.props.intl.formatMessage({ id: "project_editor.props.visual_editors_warning" })
                    : ""}
                  {this.props.intl.formatMessage({ id: "project_editor.props.raw_json_hint" })}
                </div>
              </div>
            </div>
          </div>

          {/* Script Settings Section */}
          <div className="ppe-section" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
              <FontAwesomeIcon icon={faCode} className="ppe-sectionIcon" />
              {this.props.intl.formatMessage({ id: "project_editor.props.script_settings" })}
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-scriptLanguagelabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.language" })}
                </label>
                <Dropdown
                  items={[this.props.intl.formatMessage({ id: "project_editor.props.javascript" }), "TypeScript"]}
                  aria-labelledby="ppe-scriptLanguagelabel"
                  className="ppe-fieldDropdown"
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.select_language" })}
                  defaultValue={
                    this.props.project.preferredScriptLanguage === ProjectScriptLanguage.javaScript
                      ? this.props.intl.formatMessage({ id: "project_editor.props.javascript" })
                      : "TypeScript"
                  }
                  onChange={this._handleLanguageChange}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-scriptVersionlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.script_version" })}
                </label>
                <Dropdown
                  items={getScriptVersionStrings(this.props.intl)}
                  aria-labelledby="ppe-scriptVersionlabel"
                  className="ppe-fieldDropdown"
                  placeholder={this.props.intl.formatMessage({ id: "project_editor.props.select_version" })}
                  defaultValue={
                    this.props.project.scriptVersion === ProjectScriptVersion.latestStable
                      ? "Latest Stable"
                      : this.props.intl.formatMessage({ id: "project_editor.props.script_stable_1x" })
                  }
                  onChange={this._handleVersionChange}
                />
              </div>
            </div>
          </div>

          {/* GitHub Section */}
          {CreatorToolsHost.hostType === HostType.webPlusServices && (
            <div className="ppe-section" style={sectionStyle}>
              <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
                <FontAwesomeIcon icon={faGithub} className="ppe-sectionIcon" />
                {this.props.intl.formatMessage({ id: "project_editor.props.github_integration" })}
              </div>
              <div className="ppe-sectionContent">
                {gitHubInner}
                <div className="ppe-ghActions">{gitHubConnect}</div>
              </div>
            </div>
          )}

          {statusArea}

          {/* Tools Section - only shown when there are tools available */}
          {localTools.length > 0 && (
            <div className="ppe-section" style={sectionStyle}>
              <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
                <FontAwesomeIcon icon={faWrench} className="ppe-sectionIcon" />
                {this.props.intl.formatMessage({ id: "project_editor.props.tools_section" })}
              </div>
              <div className="ppe-sectionContent ppe-toolsContent">{localTools}</div>
            </div>
          )}

          {/* Advanced Section */}
          <div className="ppe-section ppe-section-advanced" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={advancedSectionHeaderStyle}>
              <FontAwesomeIcon icon={faFingerprint} className="ppe-sectionIcon" />
              {this.props.intl.formatMessage({ id: "project_editor.props.advanced_uuids" })}
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-bpuniqueidlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.behavior_pack_uuid" })}
                </label>
                <div className="ppe-uuidRow">
                  <Input
                    aria-labelledby="ppe-bpuniqueidlabel"
                    className="ppe-uuidInput"
                    clearable
                    error={behaviorPackUniqueIdIsError}
                    onChange={this._handleBehaviorPackUuidChanged}
                    value={this.props.project.defaultBehaviorPackUniqueId}
                  />
                  <Button
                    content={this.props.intl.formatMessage({ id: "project_editor.props.generate" })}
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewBehaviorPackUniqueId}
                    aria-label={this.props.intl.formatMessage({ id: "project_editor.props.aria_generate_bp_uuid" })}
                    iconPosition="before"
                    primary
                  />
                </div>
              </div>
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-rpuniqueidlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.resource_pack_uuid" })}
                </label>
                <div className="ppe-uuidRow">
                  <Input
                    className="ppe-uuidInput"
                    clearable
                    aria-labelledby="ppe-rpuniqueidlabel"
                    error={resourcePackUniqueIdIsError}
                    onChange={this._handleResourcePackUuidChanged}
                    value={this.props.project.defaultResourcePackUniqueId}
                  />
                  <Button
                    content={this.props.intl.formatMessage({ id: "project_editor.props.generate" })}
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewResourcePackUniqueId}
                    aria-label={this.props.intl.formatMessage({ id: "project_editor.props.aria_generate_rp_uuid" })}
                    iconPosition="before"
                    primary
                  />
                </div>
              </div>
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-datauniqueidlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.data_uuid" })}
                </label>
                <div className="ppe-uuidRow">
                  <Input
                    className="ppe-uuidInput"
                    clearable
                    error={dataUniqueIdIsError}
                    aria-labelledby="ppe-datauniqueidlabel"
                    onChange={this._handleDataUuidChanged}
                    value={this.props.project.defaultDataUniqueId}
                  />
                  <Button
                    content={this.props.intl.formatMessage({ id: "project_editor.props.generate" })}
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewDataUniqueId}
                    aria-label={this.props.intl.formatMessage({ id: "project_editor.props.aria_generate_data_uuid" })}
                    iconPosition="before"
                    primary
                  />
                </div>
              </div>
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-scriptuniqueidlabel">
                  {this.props.intl.formatMessage({ id: "project_editor.props.script_uuid" })}
                </label>
                <div className="ppe-uuidRow">
                  <Input
                    className="ppe-uuidInput"
                    clearable
                    aria-labelledby="ppe-scriptuniqueidlabel"
                    error={scriptUniqueIdIsError}
                    onChange={this._handleScriptUuidChanged}
                    value={this.props.project.defaultScriptModuleUniqueId}
                  />
                  <Button
                    content={this.props.intl.formatMessage({ id: "project_editor.props.generate" })}
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewScriptUniqueId}
                    aria-label={this.props.intl.formatMessage({ id: "project_editor.props.aria_generate_script_uuid" })}
                    iconPosition="before"
                    primary
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default withLocalization(ProjectPropertyEditor);
