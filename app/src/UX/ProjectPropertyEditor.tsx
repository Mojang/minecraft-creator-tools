import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ProjectPropertyEditor.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import {
  Button,
  Dropdown,
  Dialog,
  Input,
  InputProps,
  Accordion,
  TextArea,
  TextAreaProps,
  DropdownProps,
  ThemeInput,
} from "@fluentui/react-northstar";

import { faDice, faMap, faBinoculars } from "@fortawesome/free-solid-svg-icons";
import ConnectToGitHub from "./ConnectToGitHub";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import GitHubManager from "../github/GitHubManager";
import ProjectExporter from "../app/ProjectExporter";
import AppServiceProxy from "../core/AppServiceProxy";
import { ProjectEditPreference, ProjectScriptLanguage, ProjectScriptVersion } from "../app/IProjectData";
import CartoApp, { HostType } from "../app/CartoApp";
import ProjectUtilities from "../app/ProjectUtilities";

interface IProjectPropertyEditorProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
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

export default class ProjectPropertyEditor extends Component<IProjectPropertyEditorProps, IProjectPropertyEditorState> {
  private tentativeGitHubMode: string = "existing";
  private tentativeGitHubRepoName?: string;
  private tentativeGitHubOwner?: string;
  private tentativeGitHubBranch?: string;
  private tentativeGitHubFolder?: string;
  private tentativeGitHubNewDescription?: string;
  private tentativeCommitMessage?: string;

  private editorPreferences = [
    "Simplified editor experience",
    "Visual editors where possible",
    "Raw JSON/JavaScript Editing",
  ];

  constructor(props: IProjectPropertyEditorProps) {
    super(props);

    this._createNewBehaviorPackUniqueId = this._createNewBehaviorPackUniqueId.bind(this);
    this._createNewResourcePackUniqueId = this._createNewResourcePackUniqueId.bind(this);
    this._createNewScriptUniqueId = this._createNewScriptUniqueId.bind(this);
    this._createNewDataUniqueId = this._createNewDataUniqueId.bind(this);
    this._update = this._update.bind(this);
    this._githubProjectUpdated = this._githubProjectUpdated.bind(this);
    this._githubPushUpdated = this._githubPushUpdated.bind(this);
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
    this._pushGameTestReferenceMap = this._pushGameTestReferenceMap.bind(this);
    this._rescanFiles = this._rescanFiles.bind(this);
    this._handleVersionMajorChanged = this._handleVersionMajorChanged.bind(this);
    this._handleVersionMinorChanged = this._handleVersionMinorChanged.bind(this);
    this._handleVersionPatchChanged = this._handleVersionPatchChanged.bind(this);
    this._handleDefaultNamespaceChanged = this._handleDefaultNamespaceChanged.bind(this);
    this._handleScriptEntryPointChanged = this._handleScriptEntryPointChanged.bind(this);
    this._convertJavaToBedrock = this._convertJavaToBedrock.bind(this);
    this._handleLanguageChange = this._handleLanguageChange.bind(this);
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

  _githubPushUpdated(newCommitMessage: string) {
    this.tentativeCommitMessage = newCommitMessage;
  }

  _githubProjectUpdated(property: GitHubPropertyType, value: string) {
    switch (property) {
      case GitHubPropertyType.repoName:
        this.tentativeGitHubRepoName = value;
        break;

      case GitHubPropertyType.owner:
        this.tentativeGitHubOwner = value;
        break;

      case GitHubPropertyType.branch:
        this.tentativeGitHubBranch = value;
        break;

      case GitHubPropertyType.folder:
        this.tentativeGitHubFolder = value;
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
      this.props.project.onPropertyChanged.subscribe(this._update);
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

    ProjectUtilities.applyName(this.props.project, data.value);
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

    this.props.project.defaultResourcePackUniqueId = data.value;
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
    await this.props.project.inferProjectItemsFromFilesRootFolder(true);
    console.log("Rescanned " + this.props.project.projectFolder?.fullPath);
    this.forceUpdate();
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

  _convertJavaToBedrock() {
    if (!Utilities.isDebug) {
      alert(
        "This was part of some prototype code to convert Java snbts to MCStructures - most of the way there, but not available quite yet.  sorry."
      );
      return;
    }
  }

  _createNewResourcePackUniqueId() {
    this.props.project.defaultResourcePackUniqueId = Utilities.createUuid();
  }

  _createNewBehaviorPackUniqueId() {
    this.props.project.defaultBehaviorPackUniqueId = Utilities.createUuid();
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
      const gh = this.props.carto.userGitHub;

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
    if (this.tentativeCommitMessage !== undefined && this.props.project.differencesFromGitHub !== undefined) {
      Log.debug("Committing updates to GitHub with commit message '" + this.tentativeCommitMessage + "'");

      await this.props.project.commitToGitHub(this.tentativeCommitMessage);
    }

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
  }

  _handleEditPreferenceChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data.value === this.editorPreferences[0]) {
      this.props.project.editPreference = ProjectEditPreference.summarized;
    } else if (data.value === this.editorPreferences[1]) {
      this.props.project.editPreference = ProjectEditPreference.editors;
    } else {
      this.props.project.editPreference = ProjectEditPreference.raw;
    }
  }

  _handleVersionChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data.value === "Latest Beta") {
      this.props.project.scriptVersion = ProjectScriptVersion.latestBeta;
    } else {
      this.props.project.scriptVersion = ProjectScriptVersion.stable10;
    }
  }

  _doSignIn() {
    GitHubManager.onAuthenticated.subscribe(this._handleSignedIn);
    GitHubManager.signIn();
  }

  _pushGameTestReferenceMap() {
    ProjectExporter.generateAndInvokeFlatPackRefMCWorld(this.props.carto, this.props.project);
  }

  render() {
    const gitHubInner = [];
    // const gitHubCommands = [];

    const baseUrl = window.location.href;
    const localTools = [];

    if (this.props === undefined) {
      return <></>;
    }

    let gitHubConnect = <></>;

    if (!GitHubManager.isSignedIn && CartoApp.hostType === HostType.webPlusServices) {
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

    if (
      CartoApp.hostType === HostType.webPlusServices &&
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
                carto={this.props.carto}
              />
            }
            onConfirm={this._handleConnectToGitHub}
            header="Select GitHub Project"
            trigger={<Button content="Connect to GitHub Project" iconPosition="before" primary />}
          />
        );
      }
    } else if (CartoApp.hostType === HostType.webPlusServices) {
      let gitHubFolder = <></>;

      const ghUrl = baseUrl + "?open=gh/" + this.props.project.gitHubOwner + "/" + this.props.project.gitHubRepoName;

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
            <div className="ppe-ghshareableUrl">Shareable URL:</div>
            <Input inline clearable value={ghUrl} className="ppe-uniqueIdInputValue" />

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
                carto={this.props.carto}
              />
            }
            onConfirm={this._handleConnectToGitHub}
            header="Select GitHub Project"
            trigger={<Button content="Connect to GitHub Project" iconPosition="before" primary />}
          />
        );

        /* gitHubCommands.push(
          <Dialog
            key="ghCommandButton"
            cancelButton="Cancel"
            confirmButton="Push"
            content={
              <PushToGitHub
                onGitHubCommitUpdated={this._githubPushUpdated}
                project={this.props.project}
                carto={this.props.carto}
              />
            }
            onConfirm={this._handleCommitToGitHub}
            header="Push to GitHub"
            trigger={<Button content="Commit changes to GitHub" iconPosition="before" primary />}
          />
        );*/
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

    if (this.props.carto.workingStorage !== null && AppServiceProxy.hasAppServiceOrDebug) {
      localTools.push(
        <Button
          key="openGtWorld"
          content="Open GameTest test world"
          icon={<FontAwesomeIcon icon={faMap} className="fa-lg" />}
          onClick={this._pushGameTestReferenceMap}
          iconPosition="before"
          primary
        />
      );

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

    // <Button content="Convert Java to Bedrock" icon={<FontAwesomeIcon icon={faCogs} className="fa-lg" />} onClick={this._convertJavaToBedrock } iconPosition="before" primary />

    let versionMinor = this.props.project.versionMinor;

    if (versionMinor === undefined) {
      versionMinor = 0;
    }

    let versionPatch = this.props.project.versionPatch;

    if (versionPatch === undefined) {
      versionPatch = 1;
    }

    const height = "calc(100vh - " + (this.props.heightOffset + 52) + "px)";

    return (
      <div
        className="ppe-outer"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
        }}
      >
        <div
          className="ppe-header"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          Project Properties
        </div>

        <div
          className="ppe-grid"
          style={{
            minHeight: height,
            maxHeight: height,
          }}
        >
          <div className="ppe-label ppe-creatorlabel">Creator</div>
          <div className="ppe-creatorinput">
            <Input
              inline
              clearable
              placeholder={this.props.project.effectiveCreator}
              value={this.state.creator}
              onChange={this._handleCreatorChanged}
            />
          </div>
          <div className="ppe-label ppe-namelabel">Name</div>
          <div className="ppe-nameinput">
            <Input
              inline
              clearable
              placeholder="project name"
              value={this.state.name}
              onChange={this._handleNameChanged}
            />
          </div>
          <div className="ppe-label ppe-shortNamelabel">Short Name</div>
          <div className="ppe-shortNameinput">
            <Input
              clearable
              placeholder={
                this.state.creator && this.state.creator.length > 0 && this.state.name && this.state.name.length > 0
                  ? ProjectUtilities.getSuggestedProjectShortName(this.state.creator, this.state.name)
                  : this.props.project.effectiveShortName
              }
              key="newProjectShortName"
              value={this.state.shortName !== "" ? this.state.shortName : undefined}
              onChange={this._handleShortNameChanged}
            />
          </div>
          <div className="ppe-label ppe-namespacelabel">Namespace</div>
          <div className="ppe-namespaceinput">
            <Input
              inline
              clearable
              placeholder={this.props.project.effectiveShortName}
              defaultValue={this.props.project.defaultNamespace}
              value={this.props.project.defaultNamespace !== "" ? this.state.defaultNamespace : undefined}
              onChange={this._handleDefaultNamespaceChanged}
            />
          </div>
          <div className="ppe-label ppe-titlelabel">Title</div>
          <div className="ppe-titleinput">
            <Input
              inline
              clearable
              placeholder="project title"
              value={this.state.title}
              onChange={this._handleTitleChanged}
            />
          </div>
          <div className="ppe-label ppe-descriptionlabel">Description</div>
          <div className="ppe-descriptioninput">
            <TextArea
              placeholder="description"
              value={this.props.project.description}
              onChange={this._handleDescriptionChanged}
            />
          </div>
          <div className="ppe-label ppe-defaultEditlabel">Default Edit Experience</div>
          <div className="ppe-defaultEditinput">
            <Dropdown
              items={this.editorPreferences}
              placeholder="Select your edit experience"
              defaultValue={this.editorPreferences[this.props.project.editPreference]}
              onChange={this._handleEditPreferenceChange}
            />
            <div className="ppe-propertyNote">
              {this.props.project.editPreference === ProjectEditPreference.summarized ||
              this.props.project.editPreference === ProjectEditPreference.editors
                ? "When using visual editors, some existing formatting and comments in JSON files may be removed as you edit"
                : ""}
              . You can edit items as Raw JSON using the '...' menu on items in the list.
            </div>
          </div>
          <div className="ppe-label ppe-scriptLanguagelabel">Script Language</div>
          <div className="ppe-scriptLanguageinput">
            <Dropdown
              items={["JavaScript", "TypeScript"]}
              placeholder="Select your language"
              defaultValue={
                this.props.project.preferredScriptLanguage === ProjectScriptLanguage.javaScript
                  ? "JavaScript"
                  : "TypeScript"
              }
              onChange={this._handleLanguageChange}
            />
          </div>
          <div className="ppe-label ppe-scriptVersionlabel">Script Version</div>
          <div className="ppe-scriptVersioninput">
            <Dropdown
              items={["Latest Beta", "Stable 1.x"]}
              placeholder="Select your language"
              defaultValue={
                this.props.project.scriptVersion === ProjectScriptVersion.latestBeta ? "Latest Beta" : "Stable 1.x"
              }
              onChange={this._handleVersionChange}
            />
          </div>
          <div className="ppe-label ppe-versionlabel">Version</div>
          <div className="ppe-versioninput">
            <div className="ppe-versioninputline">
              <Input
                inline
                clearable
                required={false}
                placeholder="major"
                value={versionMajor + ""}
                onChange={this._handleVersionMajorChanged}
              />
              <Input
                inline
                clearable
                required={false}
                placeholder="minor"
                value={versionMinor + ""}
                onChange={this._handleVersionMinorChanged}
              />
              <Input
                inline
                clearable
                required={false}
                placeholder="patch"
                value={versionPatch + ""}
                onChange={this._handleVersionPatchChanged}
              />
            </div>
          </div>

          <div className="ppe-label ppe-ghlabel">
            {CartoApp.hostType === HostType.webPlusServices ? (
              <div>
                <FontAwesomeIcon icon={faGithub} className="fa-lg" />
                &#160;GitHub
              </div>
            ) : (
              <div>&#160;</div>
            )}
          </div>
          <div className="ppe-ghinput">{gitHubInner}</div>
          <div className="ppe-ghbutton">{gitHubConnect}</div>
          <div className="ppe-advancedArea">
            <Accordion
              defaultActiveIndex={[0]}
              panels={[
                {
                  title: "Tools",
                  content: (
                    <div key="toolsAcc" className="ppe-toolArea">
                      {localTools}
                    </div>
                  ),
                },
                {
                  title: "Advanced",
                  content: (
                    <div key="adv" className="ppe-advgrid">
                      <div className="ppe-label ppe-bpuniqueidlabel">Behavior Pack Unique Id</div>
                      <div className="ppe-bpuniqueidinput">
                        <Input
                          inline
                          clearable
                          error={behaviorPackUniqueIdIsError}
                          onChange={this._handleBehaviorPackUuidChanged}
                          value={this.props.project.defaultBehaviorPackUniqueId}
                          className="ppe-bpuniqueIdInputValue"
                        />
                      </div>
                      <div className="ppe-bpuniqueidcreatenew">
                        <Button
                          content="Create new"
                          icon={<FontAwesomeIcon icon={faDice} className="fa-lg" />}
                          onClick={this._createNewBehaviorPackUniqueId}
                          iconPosition="before"
                          primary
                        />
                      </div>
                      <div className="ppe-label ppe-rpuniqueidlabel">Resource Pack Unique Id</div>
                      <div className="ppe-rpuniqueidinput">
                        <Input
                          inline
                          clearable
                          error={resourcePackUniqueIdIsError}
                          onChange={this._handleResourcePackUuidChanged}
                          value={this.props.project.defaultResourcePackUniqueId}
                          className="ppe-rpuniqueIdInputValue"
                        />
                      </div>
                      <div className="ppe-rpuniqueidcreatenew">
                        <Button
                          content="Create new"
                          icon={<FontAwesomeIcon icon={faDice} className="fa-lg" />}
                          onClick={this._createNewResourcePackUniqueId}
                          iconPosition="before"
                          primary
                        />
                      </div>

                      <div className="ppe-label ppe-datauniqueidlabel">Data Unique Id</div>
                      <div className="ppe-datauniqueidinput">
                        <Input
                          inline
                          clearable
                          error={dataUniqueIdIsError}
                          onChange={this._handleBehaviorPackUuidChanged}
                          value={this.props.project.defaultDataUniqueId}
                          className="ppe-uniqueIdInputValue"
                        />
                      </div>
                      <div className="ppe-datauniqueidcreatenew">
                        <Button
                          content="Create new"
                          icon={<FontAwesomeIcon icon={faDice} className="fa-lg" />}
                          onClick={this._createNewDataUniqueId}
                          iconPosition="before"
                          primary
                        />
                      </div>
                      <div className="ppe-label ppe-scriptuniqueidlabel">Script Unique Id</div>
                      <div className="ppe-scriptuniqueidinput">
                        <Input
                          inline
                          clearable
                          error={scriptUniqueIdIsError}
                          onChange={this._handleBehaviorPackUuidChanged}
                          value={this.props.project.defaultScriptModuleUniqueId}
                          className="ppe-uniqueIdInputValue"
                        />
                      </div>
                      <div className="ppe-scriptuniqueidcreatenew">
                        <Button
                          content="Create new"
                          icon={<FontAwesomeIcon icon={faDice} className="fa-lg" />}
                          onClick={this._createNewScriptUniqueId}
                          iconPosition="before"
                          primary
                        />
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>
    );
  }
}
