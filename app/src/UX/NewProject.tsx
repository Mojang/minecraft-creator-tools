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
} from "@fluentui/react-northstar";
import Log from "./../core/Log";
import IProjectSeed from "../app/IProjectSeed";
import ProjectUtilities from "../app/ProjectUtilities";
import AppServiceProxy, { AppServiceProxyCommands } from "../core/AppServiceProxy";
import { LocalFolderLabel } from "./Labels";
import { MinecraftTrack } from "../app/ICartoData";
import { CartoTargetStrings } from "../app/Carto";
import { ProjectTargetStrings } from "../app/Project";

interface INewProjectProps extends IAppProps {
  theme: ThemeInput<any>;
  projectSeed: IProjectSeed;
  onNewProjectUpdated: (newProject: IProjectSeed) => void;
}

interface INewProjectState {
  newProjectName?: string;
  newProjectPath?: string;
  newProjectShortName?: string;
  newProjectCreator?: string;
  newProjectDescription?: string;
  newProjectTrack?: MinecraftTrack;
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

    this.state = {
      newProjectName: this.props.projectSeed.name,
      newProjectPath: this.props.projectSeed.path,
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

  render() {
    const additionalDialogButtons = [];

    if (AppServiceProxy.hasAppServiceOrDebug) {
      let path = this.state.newProjectPath;

      if (path === undefined) {
        let delimiter = "\\";

        if (!AppServiceProxy.hasAppService) {
          delimiter = "/";
        }

        path = this.props.carto.projectsStorage.rootFolder.fullPath + delimiter + this.state.newProjectName;
      }

      additionalDialogButtons.push(
        <div key="newFolderLabel" className="nepro-newFolder">
          Store project at:
        </div>
      );

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