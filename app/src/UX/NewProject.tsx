import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import "./NewProject.css";
import {
  Button,
  Dropdown,
  DropdownProps,
  Input,
  InputProps,
  TextArea,
  TextAreaProps,
  ThemeInput,
  Toolbar,
} from "@fluentui/react-northstar";
import Log from "./../core/Log";
import IProjectSeed from "../app/IProjectSeed";
import ProjectUtilities from "../app/ProjectUtilities";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import { CustomSelectableLabel, LocalFolderLabel } from "./Labels";
import { MinecraftTrack } from "../app/ICartoData";
import { CartoTargetStrings } from "../app/Carto";
import { ProjectTargetStrings } from "../app/Project";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChrome, faEdge, faFirefoxBrowser, faSafari } from "@fortawesome/free-brands-svg-icons";
import { faComputer } from "@fortawesome/free-solid-svg-icons";
import { faWindowRestore } from "@fortawesome/free-regular-svg-icons";
import WebUtilities, { BrowserType } from "./WebUtilities";
import IFolder from "../storage/IFolder";
import FileSystemStorage from "../storage/FileSystemStorage";
import FileSystemFolder from "../storage/FileSystemFolder";

interface INewProjectProps extends IAppProps {
  theme: ThemeInput<any>;
  projectSeed: IProjectSeed;
  onNewProjectUpdated: (newProject: IProjectSeed) => void;
}

interface INewProjectState {
  errorMessage?: string;
  newProjectName?: string;
  newProjectPath?: string;
  newProjectShortName?: string;
  newProjectCreator?: string;
  newProjectDescription?: string;
  newProjectTrack?: MinecraftTrack;
  newProjectFolder?: IFolder;
  newProjectFolderTitle?: string;
}

export default class NewProject extends Component<INewProjectProps, INewProjectState> {
  constructor(props: INewProjectProps) {
    super(props);

    this._handleNewProjectNameChange = this._handleNewProjectNameChange.bind(this);
    this._handleNewProjectShortNameChange = this._handleNewProjectShortNameChange.bind(this);
    this._handleNewProjectCreatorChange = this._handleNewProjectCreatorChange.bind(this);
    this._handleNewProjectDescriptionChange = this._handleNewProjectDescriptionChange.bind(this);
    this._handleTrackChange = this._handleTrackChange.bind(this);

    this._handleSelectFolderClick = this._handleSelectFolderClick.bind(this);

    this._useBrowserStorage = this._useBrowserStorage.bind(this);
    this._useLocalStorage = this._useLocalStorage.bind(this);

    this.state = {
      newProjectName: this.props.projectSeed.name,
      newProjectPath: this.props.projectSeed.path,
      newProjectFolder: this.props.projectSeed.targetFolder,
      newProjectFolderTitle: this.props.projectSeed.targetFolderTitle,
      newProjectShortName: this.props.projectSeed.shortName,
      newProjectCreator: this.props.projectSeed.creator,
      newProjectDescription: this.props.projectSeed.description,
      newProjectTrack: this.props.projectSeed.track,
    };
  }

  async _handleTrackChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    let track: MinecraftTrack | undefined = MinecraftTrack.main;

    if (data.value === ProjectTargetStrings[1]) {
      track = MinecraftTrack.main;
    } else if (data.value === ProjectTargetStrings[2]) {
      track = MinecraftTrack.preview;
    } else if (data.value === ProjectTargetStrings[3]) {
      track = MinecraftTrack.edu;
    } else if (data.value === ProjectTargetStrings[4]) {
      track = MinecraftTrack.eduPreview;
    } else {
      track = undefined;
    }

    const newState = {
      errorMessage: undefined,
      newProjectFolder: undefined,
      newProjectFolderTitle: undefined,
      newProjectName: this.state.newProjectName,
      newProjectPath: this.state.newProjectPath,
      newProjectShortName: this.state.newProjectShortName,
      newProjectCreator: this.state.newProjectCreator,
      newProjectDescription: this.state.newProjectDescription,
      newProjectTrack: track,
    };

    this.setState(newState);
    this._updateSeed(newState);
  }

  private _handleNewProjectNameChange(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    const newState = {
      errorMessage: this.state.errorMessage,
      newProjectFolder: this.state.newProjectFolder,
      newProjectFolderTitle: this.state.newProjectFolderTitle,
      newProjectName: data.value,
      newProjectPath: this.state.newProjectPath,
      newProjectShortName: this.state.newProjectShortName,
      newProjectCreator: this.state.newProjectCreator,
      newProjectDescription: this.state.newProjectDescription,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);
  }

  _updateSeed(state?: INewProjectState) {
    if (!state) {
      state = this.state;
    }

    if (this.props.onNewProjectUpdated) {
      this.props.onNewProjectUpdated({
        name: state.newProjectName,
        creator: state.newProjectCreator,
        shortName: state.newProjectShortName,
        path: state.newProjectPath,
        targetFolder: state.newProjectFolder,
        targetFolderTitle: state.newProjectFolderTitle,
        description: state.newProjectDescription,
        galleryProject: this.props.projectSeed.galleryProject,
        track: state.newProjectTrack,
      });
    }
  }

  private _handleNewProjectDescriptionChange(e: SyntheticEvent, data: TextAreaProps | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    const newState = {
      errorMessage: this.state.errorMessage,
      newProjectFolder: this.state.newProjectFolder,
      newProjectFolderTitle: this.state.newProjectFolderTitle,
      newProjectName: this.state.newProjectName,
      newProjectPath: this.state.newProjectPath,
      newProjectShortName: this.state.newProjectShortName,
      newProjectCreator: this.state.newProjectCreator,
      newProjectDescription: data.value,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);
  }

  private _handleNewProjectShortNameChange(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    const newState = {
      errorMessage: this.state.errorMessage,
      newProjectFolder: this.state.newProjectFolder,
      newProjectFolderTitle: this.state.newProjectFolderTitle,
      newProjectName: this.state.newProjectName,
      newProjectPath: this.state.newProjectPath,
      newProjectShortName: data.value,
      newProjectCreator: this.state.newProjectCreator,
      newProjectDescription: this.state.newProjectDescription,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);
  }

  private _handleNewProjectCreatorChange(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    const newState = {
      errorMessage: this.state.errorMessage,
      newProjectFolder: this.state.newProjectFolder,
      newProjectFolderTitle: this.state.newProjectFolderTitle,
      newProjectName: this.state.newProjectName,
      newProjectPath: this.state.newProjectPath,
      newProjectShortName: this.state.newProjectShortName,
      newProjectCreator: data.value,
      newProjectDescription: this.state.newProjectDescription,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);

    if (this.props.carto) {
      this.props.carto.creator = data.value;
      this.props.carto.save();
    }
  }

  private async _handleSelectFolderClick() {
    Log.debug("Opening folder via services.");

    const result = await AppServiceProxy.sendAsync(AppServiceProxyCommands.openFolder, "");

    if (result && result.length > 0) {
      this.setState({
        newProjectName: this.state.newProjectName,
        newProjectPath: result,
      });
    }
  }

  private _useBrowserStorage() {
    const newState = {
      errorMessage: undefined,
      newProjectFolder: undefined,
      newProjectName: this.state.newProjectName,
      newProjectPath: undefined,
      newProjectShortName: this.state.newProjectShortName,
      newProjectCreator: this.state.newProjectCreator,
      newProjectDescription: this.state.newProjectDescription,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);
  }

  private async _useLocalStorage() {
    try {
      const dirHandle = (await window.showDirectoryPicker({
        mode: "readwrite",
      })) as FileSystemDirectoryHandle | undefined;

      if (dirHandle) {
        let fss = new FileSystemStorage(dirHandle as FileSystemDirectoryHandle, dirHandle.name);

        const safeMessage = await (fss.rootFolder as FileSystemFolder).getIsEmptyError();

        if (safeMessage !== undefined) {
          this.setState({
            errorMessage: "You can only create new projects in empty folders.\r\n\r\n" + safeMessage,
            newProjectName: this.state.newProjectName,
            newProjectPath: undefined,
            newProjectFolder: undefined,
            newProjectFolderTitle: undefined,
            newProjectShortName: this.state.newProjectShortName,
            newProjectCreator: this.state.newProjectCreator,
            newProjectDescription: this.state.newProjectDescription,
            newProjectTrack: this.state.newProjectTrack,
          });
          return;
        }

        const newState = {
          errorMessage: undefined,
          newProjectFolder: fss.rootFolder,
          newProjectName: this.state.newProjectName,
          newProjectFolderTitle: dirHandle.name,
          newProjectPath: undefined,
          newProjectShortName: this.state.newProjectShortName,
          newProjectCreator: this.state.newProjectCreator,
          newProjectDescription: this.state.newProjectDescription,
          newProjectTrack: this.state.newProjectTrack,
        };

        this.setState(newState);
        this._updateSeed(newState);
      }
    } catch (e) {
      // likely an AbortError, which is the user canceling the dialog.
    }
  }

  render() {
    const additionalDialogButtons = [];

    additionalDialogButtons.push(
      <div key="newFolderLabel" className="nepro-newFolder">
        Store project at:
      </div>
    );

    if (AppServiceProxy.hasAppService) {
      let path = this.state.newProjectPath;

      if (path === undefined) {
        let delimiter = "\\";

        if (!AppServiceProxy.hasAppService) {
          delimiter = "/";
        }

        path = this.props.carto.projectsStorage.rootFolder.fullPath + delimiter + this.state.newProjectName;
      }

      additionalDialogButtons.push(
        <div className="nepro-newPath" key="newPath">
          <div className="nepro-path">{path}</div>
          <Button
            onClick={this._handleSelectFolderClick}
            content="Select Folder"
            key="selectFolder"
            icon={<LocalFolderLabel isCompact={true} />}
            iconPosition="before"
          />
        </div>
      );
    } else {
      const accessoryToolbar = [];

      let icon = faWindowRestore;

      switch (WebUtilities.getBrowserType()) {
        case BrowserType.chrome:
          icon = faChrome;
          break;
        case BrowserType.firefox:
          icon = faFirefoxBrowser;
          break;
        case BrowserType.safari:
          icon = faSafari;
          break;
        case BrowserType.edgeChrome:
          icon = faEdge;
          break;
      }

      accessoryToolbar.push({
        icon: (
          <CustomSelectableLabel
            icon={<FontAwesomeIcon icon={icon} className="fa-lg" />}
            theme={this.props.theme}
            text={"Temporary browser storage"}
            isSelected={!this.state.newProjectFolder}
            isCompact={false}
          />
        ),
        key: "npUseBrowserStorage",
        onClick: this._useBrowserStorage,
        title: "Use browser storage",
      });

      accessoryToolbar.push({
        icon: (
          <CustomSelectableLabel
            icon={<FontAwesomeIcon icon={faComputer} className="fa-lg" />}
            isSelected={this.state.newProjectFolder !== undefined}
            text={this.state.newProjectPath ? this.state.newProjectPath + " folder on device" : "Use device storage"}
            theme={this.props.theme}
            isCompact={false}
          />
        ),
        key: "npUsdeLocalStorage",
        onClick: this._useLocalStorage,
        title: "Use local storage",
      });

      additionalDialogButtons.push(
        <div className="nepro-browserOptions" key="newPath">
          <Toolbar aria-label="Form accesory toolbar overflow menu" items={accessoryToolbar} />
          <div className="nepro-errorMessage">{this.state.errorMessage}</div>
        </div>
      );
    }

    const targetStrings = [];

    const index = this.props.carto.track ? (this.props.carto.track as number) : 0;

    targetStrings.push("<default to " + CartoTargetStrings[index] + ">");

    for (const targetString of CartoTargetStrings) {
      targetStrings.push(targetString);
    }

    return (
      <div className="nepro-dialog">
        <div className="nepro-newName">Title:</div>
        <div className="nepro-newNameInput">
          <Input
            clearable
            placeholder="Name"
            key="newProjectName"
            defaultValue={this.state.newProjectName}
            onChange={this._handleNewProjectNameChange}
          />
        </div>
        <div className="nepro-newCreator">Creator Name:</div>
        <div className="nepro-SnewCreatorInput">
          <Input
            clearable
            placeholder="Creator Name"
            key="newCreatorName"
            defaultValue={this.state.newProjectCreator}
            onChange={this._handleNewProjectCreatorChange}
          />
        </div>
        <div className="nepro-newShortName">Short Name:</div>
        <div className="nepro-newShortNameInput">
          <Input
            clearable
            placeholder={
              this.state.newProjectCreator &&
              this.state.newProjectCreator.length > 0 &&
              this.state.newProjectName &&
              this.state.newProjectName.length > 0
                ? ProjectUtilities.getSuggestedProjectShortName(this.state.newProjectCreator, this.state.newProjectName)
                : "short name"
            }
            key="newProjectShortName"
            value={this.state.newProjectShortName !== "" ? this.state.newProjectShortName : undefined}
            onChange={this._handleNewProjectShortNameChange}
          />
        </div>
        <div className="nepro-newDescription">Description:</div>
        <div className="nepro-newDescriptionInput">
          <TextArea
            placeholder={this.state.newProjectName ? this.state.newProjectName : "Description"}
            key="newProjectDescription"
            defaultValue={this.state.newProjectDescription}
            onChange={this._handleNewProjectDescriptionChange}
          />
        </div>
        <div className="nepro-newTrack">Target:</div>
        <div className="nepro-newTrackInput">
          <Dropdown items={targetStrings} defaultValue={targetStrings[0]} onChange={this._handleTrackChange} />
        </div>
        {additionalDialogButtons}
      </div>
    );
  }
}
