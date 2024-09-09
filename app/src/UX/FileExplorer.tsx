import { Component, SyntheticEvent } from "react";
import "./FileExplorer.css";
import IFolder from "../storage/IFolder";
import FileExplorerFolder from "./FileExplorerFolder";
import { Button, Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import Carto from "../app/Carto";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import WebUtilities from "./WebUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolderPlus } from "@fortawesome/free-solid-svg-icons";

export enum FileExplorerMode {
  explorer = 0,
  folderPicker = 1,
}

interface IFileExplorerProps {
  rootFolder: IFolder;
  theme: ThemeInput<any>;
  heightOffset: number;
  mode: FileExplorerMode;
  selectedItem: IFile | IFolder | null | undefined;
  itemAnnotations?: ItemAnnotationCollection;

  onFileSelected?: (file: IFile) => void;
  onFolderSelected?: (folder: IFolder) => void;

  carto: Carto;
  readOnly: boolean;

  onRemove?: () => void;
}

interface IFileExplorerState {
  newFolderName: string | undefined;
  selectedItem: IFile | IFolder | null | undefined;
}

export default class FileExplorer extends Component<IFileExplorerProps, IFileExplorerState> {
  constructor(props: IFileExplorerProps) {
    super(props);

    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleNewFolderChanged = this._handleNewFolderChanged.bind(this);
    this._handleNewFolderGo = this._handleNewFolderGo.bind(this);

    this._handleNewFileSelected = this._handleNewFileSelected.bind(this);
    this._handleNewFolderSelected = this._handleNewFolderSelected.bind(this);

    this.state = {
      newFolderName: undefined,
      selectedItem: this.props.selectedItem,
    };
  }

  _handleCloseClick() {
    if (this.props.onRemove) {
      this.props.onRemove();
    }
  }

  getAnnotationsForFolder(folder: IFolder) {
    if (!this.props.itemAnnotations) {
      return undefined;
    }

    const annotations: ItemAnnotationCollection = {};

    for (const path in this.props.itemAnnotations) {
      if (path.startsWith(folder.storageRelativePath)) {
        const annotationList = this.props.itemAnnotations[path];

        annotations[path] = annotationList;
      }
    }

    return annotations;
  }

  _handleNewFolderChanged(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.props.carto === null || this.state == null) {
      return;
    }

    this.setState({
      newFolderName: data.value,
    });
  }

  _handleNewFolderSelected(folder: IFolder) {
    this.setState({
      newFolderName: this.state.newFolderName,
      selectedItem: folder,
    });

    if (this.props.onFolderSelected) {
      this.props.onFolderSelected(folder);
    }
  }

  _handleNewFileSelected(file: IFile) {
    this.setState({
      newFolderName: this.state.newFolderName,
      selectedItem: file,
    });

    if (this.props.onFileSelected) {
      this.props.onFileSelected(file);
    }
  }

  _handleNewFolderGo() {
    if (!this.state.selectedItem) {
      return;
    }

    let name = this.state.newFolderName ? this.state.newFolderName : "New Folder";

    const parentFolder = this.state.selectedItem as IFolder;

    name = StorageUtilities.getUniqueChildFolderName(name, parentFolder);

    const fo = parentFolder.ensureFolder(name);

    this.setState({
      newFolderName: this.state.newFolderName,
      selectedItem: fo,
    });
  }

  render() {
    const height = WebUtilities.getHeight();

    let explorerHeight =
      height > this.props.heightOffset + 100 ? "calc(100vh - " + (this.props.heightOffset - 10) + "px)" : "inherit";

    let accessoryArea = <></>;

    if (this.props.mode === FileExplorerMode.folderPicker && this.state.selectedItem) {
      const label = "Create a new folder at " + this.state.selectedItem.name + ":";
      accessoryArea = (
        <div
          className="fex-newFolderArea"
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          }}
        >
          <div className="fex-newFolderIcon">
            <FontAwesomeIcon icon={faFolderPlus} className="fa-lg" />
          </div>
          <div className="fex-newFolderLabel" title={label}>
            {label}
          </div>
          <div className="fex-newFolderName">
            <Input value={this.state.newFolderName} placeholder="New Folder" onChange={this._handleNewFolderChanged} />
          </div>
          <div className="fex-newFolderGo">
            <Button
              onClick={this._handleNewFolderGo}
              content="Create"
              disabled={this.state.newFolderName === undefined || this.state.newFolderName.length === 0}
            />
          </div>
        </div>
      );
      explorerHeight =
        height > this.props.heightOffset + 100 ? "calc(100vh - " + (this.props.heightOffset + 50) + "px)" : "inherit";
    }

    return (
      <div
        className="fex-area"
        style={{
          maxHeight: explorerHeight,
          minHeight: explorerHeight,
        }}
      >
        <div
          className="fex-folderArea"
          style={{
            borderColor: this.props.theme.siteVariables?.colorScheme.brand.background3,
          }}
        >
          <FileExplorerFolder
            folder={this.props.rootFolder}
            startExpanded={true}
            itemAnnotations={this.getAnnotationsForFolder(this.props.rootFolder)}
            fileExplorer={this}
            theme={this.props.theme}
            mode={this.props.mode}
            selectedItem={this.state.selectedItem}
            onFileSelected={this._handleNewFileSelected}
            onFolderSelected={this._handleNewFolderSelected}
            displayFolderDetail={false}
            depth={0}
          />
        </div>
        {accessoryArea}
      </div>
    );
  }
}
