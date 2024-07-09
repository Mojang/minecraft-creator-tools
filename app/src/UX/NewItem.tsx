import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./NewItem.css";
import { Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import IProjectItemSeed from "../app/IProjectItemSeed";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import IFolder from "../storage/IFolder";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";

interface INewItemProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
  itemType: ProjectItemType;
  onNewItemSeedUpdated: (seed: IProjectItemSeed) => void;
}

interface INewItemState {
  name?: string;
  rootFolder?: IFolder;
  selectedFolder?: IFolder;
  nameIsManuallySet?: boolean;
}

export default class NewItem extends Component<INewItemProps, INewItemState> {
  constructor(props: INewItemProps) {
    super(props);

    this._handleNameChanged = this._handleNameChanged.bind(this);
    this._handleFolderSelected = this._handleFolderSelected.bind(this);

    this.state = {};
  }

  _handleNameChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    let nextNameIsManuallySet = this.state.nameIsManuallySet;

    if (data.value === undefined || data.value === "") {
      nextNameIsManuallySet = false;
    }

    if (this.props.onNewItemSeedUpdated) {
      this.props.onNewItemSeedUpdated({
        name: data.value,
        itemType: this.props.itemType,
        folder: this.state.selectedFolder,
      });
    }

    this.setState({
      name: data.value,
      nameIsManuallySet: nextNameIsManuallySet,
      rootFolder: this.state.rootFolder,
      selectedFolder: this.state.selectedFolder,
    });
  }

  _handleFolderSelected(folder: IFolder) {
    this.setState({
      name: this.state.name,
      nameIsManuallySet: this.state.nameIsManuallySet,
      rootFolder: this.state.rootFolder,
      selectedFolder: folder,
    });

    if (this.props.onNewItemSeedUpdated) {
      this.props.onNewItemSeedUpdated({
        name: this.state.name,
        itemType: this.props.itemType,
        folder: folder,
      });
    }
  }

  componentDidMount(): void {
    this.setRootFolder();
  }

  async setRootFolder() {
    const folder = await ProjectItemUtilities.getDefaultFolderForType(this.props.project, this.props.itemType);

    if (folder) {
      this.setState({
        name: this.state.name,
        nameIsManuallySet: this.state.nameIsManuallySet,
        rootFolder: folder,
        selectedFolder: folder,
      });
    }
  }

  render() {
    if (this.state === null) {
      return <div>Loading...</div>;
    }

    let inputText = this.state.name;

    if (inputText === undefined) {
      inputText = "";
    }

    let folderPicker = <></>;

    if (this.state.rootFolder) {
      folderPicker = (
        <div className="nitem-folderArea">
          <div className="nitem-folderAreaLabel">Choose a folder:</div>
          <FileExplorer
            rootFolder={this.state.rootFolder}
            theme={this.props.theme}
            mode={FileExplorerMode.folderPicker}
            heightOffset={this.props.heightOffset + 140}
            carto={this.props.carto}
            selectedItem={this.state.rootFolder}
            onFolderSelected={this._handleFolderSelected}
            readOnly={false}
          />
        </div>
      );
    }

    return (
      <div className="nitem-outer">
        <div className="nitem-optionsArea">
          <div className="nitem-nameLabel">Name</div>
          <div className="nitem-nameArea">
            <Input
              value={inputText}
              defaultValue={inputText}
              placeholder={ProjectItemUtilities.getNewItemName(this.props.itemType) + " name"}
              onChange={this._handleNameChanged}
            />
          </div>
        </div>
        {folderPicker}
      </div>
    );
  }
}
