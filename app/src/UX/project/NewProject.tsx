import { Component, ChangeEvent } from "react";
import IAppProps from "../appShell/IAppProps";
import "./NewProject.css";
import { Button, TextField, Select, MenuItem, FormControl, Box, SelectChangeEvent } from "@mui/material";
import Log from "../../core/Log";
import IProjectSeed from "../../app/IProjectSeed";
import ProjectUtilities from "../../app/ProjectUtilities";
import AppServiceProxy, { AppServiceProxyCommands } from "../../core/AppServiceProxy";
import { LocalFolderLabel } from "../shared/components/feedback/labels/Labels";
import { MinecraftTrack } from "../../app/ICreatorToolsData";
import { CreatorToolsTargetSettings } from "../../app/CreatorTools";
import { ProjectTargetStrings } from "../../app/Project";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChrome, faEdge, faFirefoxBrowser, faSafari } from "@fortawesome/free-brands-svg-icons";
import { faComputer } from "@fortawesome/free-solid-svg-icons";
import { faWindowRestore } from "@fortawesome/free-regular-svg-icons";
import WebUtilities, { BrowserType } from "../utils/WebUtilities";
import IFolder from "../../storage/IFolder";
import FileSystemStorage from "../../storage/FileSystemStorage";
import FileSystemFolder from "../../storage/FileSystemFolder";
import { mcColors } from "../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import IProjectTheme from "../types/IProjectTheme";
interface INewProjectProps extends IAppProps {
  theme: IProjectTheme;
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

  async _handleTrackChange(event: SelectChangeEvent<string>) {
    let track: MinecraftTrack | undefined = MinecraftTrack.main;
    const value = event.target.value;

    if (value === ProjectTargetStrings[1]) {
      track = MinecraftTrack.main;
    } else if (value === ProjectTargetStrings[2]) {
      track = MinecraftTrack.preview;
    } else if (value === ProjectTargetStrings[3]) {
      track = MinecraftTrack.edu;
    } else if (value === ProjectTargetStrings[4]) {
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

  private _handleNewProjectNameChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (this.state == null) {
      return;
    }

    const newState = {
      errorMessage: this.state.errorMessage,
      newProjectFolder: this.state.newProjectFolder,
      newProjectFolderTitle: this.state.newProjectFolderTitle,
      newProjectName: e.target.value,
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

  private _handleNewProjectDescriptionChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (this.state == null) {
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
      newProjectDescription: e.target.value,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);
  }

  private _handleNewProjectShortNameChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (this.state == null) {
      return;
    }

    const newState = {
      errorMessage: this.state.errorMessage,
      newProjectFolder: this.state.newProjectFolder,
      newProjectFolderTitle: this.state.newProjectFolderTitle,
      newProjectName: this.state.newProjectName,
      newProjectPath: this.state.newProjectPath,
      newProjectShortName: e.target.value,
      newProjectCreator: this.state.newProjectCreator,
      newProjectDescription: this.state.newProjectDescription,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);
  }

  private _handleNewProjectCreatorChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (this.state == null) {
      return;
    }

    const newState = {
      errorMessage: this.state.errorMessage,
      newProjectFolder: this.state.newProjectFolder,
      newProjectFolderTitle: this.state.newProjectFolderTitle,
      newProjectName: this.state.newProjectName,
      newProjectPath: this.state.newProjectPath,
      newProjectShortName: this.state.newProjectShortName,
      newProjectCreator: e.target.value,
      newProjectDescription: this.state.newProjectDescription,
      newProjectTrack: this.state.newProjectTrack,
    };

    this.setState(newState);
    this._updateSeed(newState);

    if (this.props.creatorTools) {
      this.props.creatorTools.creator = e.target.value;
      this.props.creatorTools.save();
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
            errorMessage: "You can only create new projects in empty folders.\n\n" + safeMessage,
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

        path = this.props.creatorTools.projectsStorage.rootFolder.fullPath + delimiter + this.state.newProjectName;
      }

      additionalDialogButtons.push(
        <div className="nepro-newPath" key="newPath">
          <div className="nepro-path">{path}</div>
          <Button
            onClick={this._handleSelectFolderClick}
            key="selectFolder"
            startIcon={<LocalFolderLabel isCompact={true} />}
            variant="outlined"
          >
            Select Folder
          </Button>
        </div>
      );
    } else {
      const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

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

      additionalDialogButtons.push(
        <div className="nepro-browserOptions" key="newPath">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }} role="radiogroup" aria-label="Storage choice">
            <Button
              onClick={this._useBrowserStorage}
              variant={!this.state.newProjectFolder ? "contained" : "outlined"}
              startIcon={<FontAwesomeIcon icon={icon} className="fa-lg" />}
              aria-pressed={!this.state.newProjectFolder}
              title={"Use browser storage" + (!this.state.newProjectFolder ? " selected" : "")}
              sx={{
                justifyContent: "flex-start",
                textTransform: "none",
                backgroundColor: !this.state.newProjectFolder
                  ? isDark
                    ? mcColors.green2
                    : mcColors.green5
                  : "transparent",
              }}
            >
              Browser storage (temporary)
            </Button>
            <Button
              onClick={this._useLocalStorage}
              variant={this.state.newProjectFolder !== undefined ? "contained" : "outlined"}
              startIcon={<FontAwesomeIcon icon={faComputer} className="fa-lg" />}
              aria-pressed={this.state.newProjectFolder !== undefined}
              title={"Use local storage" + (this.state.newProjectFolder ? " selected" : "")}
              sx={{
                justifyContent: "flex-start",
                textTransform: "none",
                backgroundColor:
                  this.state.newProjectFolder !== undefined
                    ? isDark
                      ? mcColors.green2
                      : mcColors.green5
                    : "transparent",
              }}
            >
              {this.state.newProjectPath ? this.state.newProjectPath + " folder on device" : "Use device storage"}
            </Button>
          </Box>
          <div
            className="nepro-errorMessage"
            aria-live="polite"
            aria-atomic="true"
            aria-relevant="all"
            role="alert"
            aria-label={this.state.errorMessage}
          >
            {this.state.errorMessage}
          </div>
        </div>
      );
    }

    const targetStrings = [];

    const index = this.props.creatorTools.track ? (this.props.creatorTools.track as number) : 0;

    targetStrings.push("<default to " + CreatorToolsTargetSettings[index] + ">");

    for (const targetString of CreatorToolsTargetSettings) {
      targetStrings.push(targetString);
    }

    return (
      <div className="nepro-dialog">
        <div className="nepro-newName" id="nepro-newNameLabel">
          Project Name:
        </div>
        <div className="nepro-newNameInput">
          <TextField
            aria-labelledby="nepro-newNameLabel"
            placeholder="Name"
            key="newProjectName"
            defaultValue={this.state.newProjectName}
            onChange={this._handleNewProjectNameChange}
            size="small"
            fullWidth
            variant="outlined"
          />
        </div>
        <div className="nepro-newCreator" id="nepro-newCreatorLabel">
          Creator Name:
        </div>
        <div className="nepro-SnewCreatorInput">
          <TextField
            aria-labelledby="nepro-newCreatorLabel"
            placeholder="Creator Name"
            key="newCreatorName"
            defaultValue={this.state.newProjectCreator}
            onChange={this._handleNewProjectCreatorChange}
            size="small"
            fullWidth
            variant="outlined"
          />
        </div>
        <div className="nepro-newShortName" id="nepro-newShortNameLabel">
          Short Name:
        </div>
        <div className="nepro-newShortNameInput">
          <TextField
            aria-labelledby="nepro-newShortNameLabel"
            placeholder={
              this.state.newProjectCreator &&
              this.state.newProjectCreator.length > 0 &&
              this.state.newProjectName &&
              this.state.newProjectName.length > 0
                ? ProjectUtilities.getSuggestedProjectShortName(this.state.newProjectCreator, this.state.newProjectName)
                : "short name"
            }
            key="newProjectShortName"
            value={this.state.newProjectShortName !== "" ? this.state.newProjectShortName : ""}
            onChange={this._handleNewProjectShortNameChange}
            size="small"
            fullWidth
            variant="outlined"
          />
        </div>
        <div className="nepro-newDescription" id="nepro-newDescriptionLabel">
          Description:
        </div>
        <div className="nepro-newDescriptionInput">
          <TextField
            placeholder={this.state.newProjectName ? this.state.newProjectName : "Description"}
            key="newProjectDescription"
            aria-labelledby="nepro-newDescriptionLabel"
            defaultValue={this.state.newProjectDescription}
            onChange={this._handleNewProjectDescriptionChange}
            multiline
            rows={3}
            fullWidth
            variant="outlined"
          />
        </div>
        <div className="nepro-newTrack" id="nepro-newTrackLabel">
          Target:
        </div>
        <div className="nepro-newTrackInput">
          <FormControl fullWidth size="small">
            <Select
              aria-labelledby="nepro-newTrackLabel"
              defaultValue={targetStrings[0]}
              onChange={this._handleTrackChange}
            >
              {targetStrings.map((targetString, index) => (
                <MenuItem key={index} value={targetString}>
                  {targetString}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        {additionalDialogButtons}
      </div>
    );
  }
}
