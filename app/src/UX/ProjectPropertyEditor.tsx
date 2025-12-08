import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project, { ProjectTargetStrings } from "../app/Project";
import "./ProjectPropertyEditor.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import {
  Button,
  Dropdown,
  Dialog,
  Input,
  InputProps,
  TextArea,
  TextAreaProps,
  DropdownProps,
  ThemeInput,
} from "@fluentui/react-northstar";

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
import ConnectToGitHub from "./ConnectToGitHub";
import Utilities from "../core/Utilities";
import GitHubManager from "../github/GitHubManager";
import AppServiceProxy from "../core/AppServiceProxy";
import { ProjectEditPreference, ProjectScriptLanguage, ProjectScriptVersion } from "../app/IProjectData";
import CreatorToolsHost, { CreatorToolsThemeStyle, HostType } from "../app/CreatorToolsHost";
import ProjectUtilities from "../app/ProjectUtilities";
import StatusList from "./StatusList";
import { MinecraftTrack } from "../app/ICreatorToolsData";
import { CreatorToolsTargetSettings } from "../app/CreatorTools";

interface IProjectPropertyEditorProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
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

export const ScriptVersionStrings = ["Latest Stable (2.0)", "Stable 1.x"];
export const ProjectFocusStrings = ["General", "GameTests", "World", "Sample Behavior", "Editor Extension"];
export const ProjectEditorPreferences = [
  "<default Creator Tools preferences>",
  "Visual editors, plus hide advanced items",
  "Visual editors",
  "Raw JSON/JavaScript Editing",
];

export default class ProjectPropertyEditor extends Component<IProjectPropertyEditorProps, IProjectPropertyEditorState> {
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
    this._handleSignedIn = this._handleSignedIn.bind(this);
    this._doSignIn = this._doSignIn.bind(this);

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

  _handleCreatorChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
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

  _handleShortNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
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

  _handleTitleChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
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

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.setState({
      name: data.value,
      title: this.state.title,
    });

    ProjectUtilities.applyTitle(this.props.project, data.value);
  }

  async _handleBehaviorPackUuidChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    await ProjectUtilities.applyBehaviorPackUniqueId(this.props.project, data.value);
  }

  _handleResourcePackUuidChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.setDefaultResourcePackUniqueIdAndUpdateDependencies(data.value);
  }

  _handleScriptUuidChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.defaultScriptModuleUniqueId = data.value;
  }

  _handleDataUuidChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.defaultDataUniqueId = data.value;
  }

  async _rescanFiles() {
    this.props.project.resetProjectItems();
    await this.props.project.inferProjectItemsFromFilesRootFolder(true);
    await this.props.creatorTools.notifyStatusUpdate("Rescanned " + this.props.project.projectFolder?.fullPath);
    this.forceUpdate();

    if (this.props.onContentUpdated) {
      this.props.onContentUpdated();
    }
  }

  async _handleDescriptionChanged(e: SyntheticEvent<HTMLElement, Event>, data?: TextAreaProps | undefined) {
    if (e === undefined || data === undefined || data.value === undefined) {
      return;
    }

    await ProjectUtilities.applyDescription(this.props.project, data.value);
  }

  _handleDefaultNamespaceChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    this.props.project.defaultNamespace = ProjectUtilities.canonicalizeNamespace(data.value);
  }

  async _handleScriptEntryPointChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props === undefined) {
      return;
    }

    await ProjectUtilities.applyScriptEntryPoint(this.props.project, data.value);
  }

  _handleVersionMajorChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
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

  _handleVersionMinorChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
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

  _handleVersionPatchChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
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

  _handleSignedIn(dummya: string, dummyb: string) {
    this.forceUpdate();
  }

  _handleLanguageChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data.value === "TypeScript") {
      this.props.project.preferredScriptLanguage = ProjectScriptLanguage.typeScript;
    } else {
      this.props.project.preferredScriptLanguage = ProjectScriptLanguage.javaScript;
    }

    this.props.project.save();
  }

  _handleTrackChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
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
    data: DropdownProps
  ) {
    if (data.value === ProjectEditorPreferences[1]) {
      this.props.project.editPreference = ProjectEditPreference.summarized;
    } else if (data.value === ProjectEditorPreferences[2]) {
      this.props.project.editPreference = ProjectEditPreference.editors;
    } else if (data.value === ProjectEditorPreferences[3]) {
      this.props.project.editPreference = ProjectEditPreference.raw;
    } else {
      this.props.project.editPreference = ProjectEditPreference.default;
    }

    this.props.project.save();
  }

  _handleFocusChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    let i = 0;
    for (const str in ProjectFocusStrings) {
      if (data.value === str) {
        this.props.project.focus = i;
      }

      i++;
    }
  }

  _handleVersionChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data.value === "Latest Beta") {
      this.props.project.scriptVersion = ProjectScriptVersion.latestStable;
    } else {
      this.props.project.scriptVersion = ProjectScriptVersion.stable10;
    }
  }

  _doSignIn() {
    if (!GitHubManager.onAuthenticated.has(this._handleSignedIn)) {
      GitHubManager.onAuthenticated.subscribe(this._handleSignedIn);
    }
    GitHubManager.signIn();
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

    targetStrings.push("<default to " + CreatorToolsTargetSettings[index] + ">");

    for (const targetString of CreatorToolsTargetSettings) {
      targetStrings.push(targetString);
    }

    let gitHubConnect = <></>;

    if (!GitHubManager.isSignedIn && CreatorToolsHost.hostType === HostType.webPlusServices) {
      gitHubInner.push(
        <div className="ppe-signInButton" key="signInButton">
          <Button
            content="Sign in to GitHub"
            icon={<FontAwesomeIcon icon={faGithub} className="fa-lg" />}
            onClick={this._doSignIn}
            iconPosition="before"
            primary
          />
        </div>
      );
    }

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
      gitHubInner.push(<div key="notConnected">(project is not connected to GitHub)</div>);

      if (GitHubManager.isSignedIn) {
        gitHubConnect = (
          <Dialog
            cancelButton="Cancel"
            confirmButton="Confirm"
            key="cghC"
            content={
              <ConnectToGitHub
                onGitHubProjectUpdated={this._githubProjectUpdated}
                project={this.props.project}
                creatorTools={this.props.creatorTools}
              />
            }
            onConfirm={this._handleConnectToGitHub}
            header="Select GitHub Project"
            trigger={<Button content="Connect to GitHub Project" iconPosition="before" primary />}
          />
        );
      }
    } else if (CreatorToolsHost.hostType === HostType.webPlusServices) {
      let gitHubFolder = <></>;

      const ghUrl = baseUrl + "#open=gh/" + this.props.project.gitHubOwner + "/" + this.props.project.gitHubRepoName;

      if (this.props.project.gitHubFolder !== undefined) {
        gitHubFolder = (
          <div key="ghfo">
            <div className="ppe-ghheader">Folder:</div>
            <div>{this.props.project.gitHubFolder}</div>
          </div>
        );
      }

      gitHubInner.push(
        <div key="ghProjInfo">
          <div className="ppe-ghheader">Project:</div>
          <div>
            {this.props.project.gitHubOwner}/{this.props.project.gitHubRepoName}
          </div>
          {gitHubFolder}
          <div>
            <div className="ppe-ghshareableUrl" id="ppe-ghshareableUrlLabel">
              Shareable URL:
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
                Link
              </a>
            </div>
          </div>
        </div>
      );

      if (GitHubManager.isSignedIn) {
        gitHubConnect = (
          <Dialog
            cancelButton="Cancel"
            confirmButton="Confirm"
            key="selectGHP"
            content={
              <ConnectToGitHub
                onGitHubProjectUpdated={this._githubProjectUpdated}
                project={this.props.project}
                creatorTools={this.props.creatorTools}
              />
            }
            onConfirm={this._handleConnectToGitHub}
            header="Select GitHub Project"
            trigger={<Button content="Connect to GitHub Project" iconPosition="before" primary />}
          />
        );
      }
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
        rescanStr = "Re-scan files at " + projFolder.fullPath;
      }

      localTools.push(
        <div title={rescanStr} key="rescanLt">
          <Button
            key="rescan"
            content="Re-scan files"
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
    const brand = this.props.theme.siteVariables?.colorScheme?.brand;

    // Theme-aware styles
    const outerStyle: React.CSSProperties = {
      background: brand?.background1,
    };

    const contentStyle: React.CSSProperties = {
      minHeight: height,
      maxHeight: height,
      background: brand?.background2,
    };

    const sectionStyle: React.CSSProperties = {
      background: brand?.background3,
      borderColor: brand?.background4,
    };

    const sectionHeaderStyle: React.CSSProperties = {
      background: brand?.background2,
      color: brand?.foreground,
      borderBottomColor: brand?.background4,
    };

    const advancedSectionHeaderStyle: React.CSSProperties = {
      background: brand?.background2,
      color: brand?.foreground5, // Orange for advanced/warning
      borderBottomColor: brand?.background4,
    };

    const labelStyle: React.CSSProperties = {
      color: brand?.foreground6,
    };

    const uuidFieldStyle: React.CSSProperties = {
      background: brand?.background2,
      borderColor: brand?.background4,
    };

    return (
      <div className={"ppe-outer" + (isDarkMode ? " ppe-dark" : " ppe-light")} style={outerStyle}>
        <div className="ppe-header">
          <FontAwesomeIcon icon={faCubes} className="ppe-headerIcon" />
          Project Properties
        </div>

        <div className="ppe-content" style={contentStyle}>
          {/* Basic Info Section */}
          <div className="ppe-section" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
              <FontAwesomeIcon icon={faUser} className="ppe-sectionIcon" />
              Basic Information
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-creatorlabel">
                  Creator
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
                  Name
                </label>
                <Input
                  aria-labelledby="ppe-namelabel"
                  className="ppe-fieldInput"
                  clearable
                  placeholder="project name"
                  value={this.state.name}
                  onChange={this._handleNameChanged}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-shortNamelabel">
                  Short Name
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
                  Namespace
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
                  Title
                </label>
                <Input
                  aria-labelledby="ppe-titlelabel"
                  className="ppe-fieldInput"
                  clearable
                  placeholder="project title"
                  value={this.state.title}
                  onChange={this._handleTitleChanged}
                />
              </div>
              <div className="ppe-field ppe-field-full">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-descriptionlabel">
                  Description
                </label>
                <TextArea
                  aria-labelledby="ppe-descriptionlabel"
                  className="ppe-fieldTextArea"
                  placeholder="description"
                  value={this.props.project.description}
                  onChange={this._handleDescriptionChanged}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-versionlabel">
                  Version
                </label>
                <div className="ppe-versionInputs">
                  <Input
                    className="ppe-versionInput"
                    clearable
                    aria-label="Major version number"
                    placeholder="major"
                    value={versionMajor + ""}
                    onChange={this._handleVersionMajorChanged}
                  />
                  <span className="ppe-versionDot">.</span>
                  <Input
                    className="ppe-versionInput"
                    clearable
                    aria-label="Minor version number"
                    placeholder="minor"
                    value={versionMinor + ""}
                    onChange={this._handleVersionMinorChanged}
                  />
                  <span className="ppe-versionDot">.</span>
                  <Input
                    className="ppe-versionInput"
                    clearable
                    aria-label="Patch version number"
                    placeholder="patch"
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
              Project Settings
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-focuslabel">
                  Type
                </label>
                <Dropdown
                  aria-labelledby="ppe-focuslabel"
                  className="ppe-fieldDropdown"
                  items={ProjectFocusStrings}
                  placeholder="Select your focus"
                  defaultValue={ProjectFocusStrings[this.props.project.focus]}
                  onChange={this._handleFocusChange}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-tracklabel">
                  Target Minecraft
                </label>
                <Dropdown
                  aria-labelledby="ppe-tracklabel"
                  className="ppe-fieldDropdown"
                  items={targetStrings}
                  placeholder="Select which version of Minecraft to target"
                  defaultValue={targetStrings[this.props.project.track ? (this.props.project.track as number) + 1 : 0]}
                  onChange={this._handleTrackChange}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-defaultEditlabel">
                  Edit Experience
                </label>
                <Dropdown
                  items={ProjectEditorPreferences}
                  aria-labelledby="ppe-defaultEditlabel"
                  className="ppe-fieldDropdown"
                  placeholder="Select your edit experience"
                  defaultValue={ProjectEditorPreferences[this.props.project.editPreference]}
                  onChange={this._handleEditPreferenceChange}
                />
                <div className="ppe-fieldNote">
                  {this.props.project.effectiveEditPreference === ProjectEditPreference.summarized ||
                  this.props.project.editPreference === ProjectEditPreference.editors
                    ? "Visual editors may remove some formatting/comments in JSON files. "
                    : ""}
                  Use '...' menu on items for Raw JSON editing.
                </div>
              </div>
            </div>
          </div>

          {/* Script Settings Section */}
          <div className="ppe-section" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
              <FontAwesomeIcon icon={faCode} className="ppe-sectionIcon" />
              Script Settings
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-scriptLanguagelabel">
                  Language
                </label>
                <Dropdown
                  items={["JavaScript", "TypeScript"]}
                  aria-labelledby="ppe-scriptLanguagelabel"
                  className="ppe-fieldDropdown"
                  placeholder="Select your language"
                  defaultValue={
                    this.props.project.preferredScriptLanguage === ProjectScriptLanguage.javaScript
                      ? "JavaScript"
                      : "TypeScript"
                  }
                  onChange={this._handleLanguageChange}
                />
              </div>
              <div className="ppe-field">
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-scriptVersionlabel">
                  Script Version
                </label>
                <Dropdown
                  items={ScriptVersionStrings}
                  aria-labelledby="ppe-scriptVersionlabel"
                  className="ppe-fieldDropdown"
                  placeholder="Select your version"
                  defaultValue={
                    this.props.project.scriptVersion === ProjectScriptVersion.latestStable
                      ? "Latest Stable"
                      : "Stable 1.x"
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
                GitHub Integration
              </div>
              <div className="ppe-sectionContent">
                {gitHubInner}
                <div className="ppe-ghActions">{gitHubConnect}</div>
              </div>
            </div>
          )}

          {statusArea}

          {/* Tools Section */}
          <div className="ppe-section" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={sectionHeaderStyle}>
              <FontAwesomeIcon icon={faWrench} className="ppe-sectionIcon" />
              Tools
            </div>
            <div className="ppe-sectionContent ppe-toolsContent">{localTools}</div>
          </div>

          {/* Advanced Section */}
          <div className="ppe-section ppe-section-advanced" style={sectionStyle}>
            <div className="ppe-sectionHeader" style={advancedSectionHeaderStyle}>
              <FontAwesomeIcon icon={faFingerprint} className="ppe-sectionIcon" />
              Advanced - Unique Identifiers
            </div>
            <div className="ppe-sectionContent">
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-bpuniqueidlabel">
                  Behavior Pack UUID
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
                    content="Generate"
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewBehaviorPackUniqueId}
                    aria-label="Randomly generate a new Behavior Pack Unique Id"
                    iconPosition="before"
                    primary
                  />
                </div>
              </div>
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-rpuniqueidlabel">
                  Resource Pack UUID
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
                    content="Generate"
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewResourcePackUniqueId}
                    aria-label="Randomly generate a new Resource Pack Unique Id"
                    iconPosition="before"
                    primary
                  />
                </div>
              </div>
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-datauniqueidlabel">
                  Data UUID
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
                    content="Generate"
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewDataUniqueId}
                    aria-label="Randomly generate a new Data Unique Id"
                    iconPosition="before"
                    primary
                  />
                </div>
              </div>
              <div className="ppe-uuidField" style={uuidFieldStyle}>
                <label className="ppe-fieldLabel" style={labelStyle} id="ppe-scriptuniqueidlabel">
                  Script UUID
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
                    content="Generate"
                    icon={<FontAwesomeIcon icon={faDice} />}
                    onClick={this._createNewScriptUniqueId}
                    aria-label="Randomly generate a new Script Unique Id"
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
