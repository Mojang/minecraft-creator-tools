import { Component, SyntheticEvent } from "react";
import "./FileExplorer.css";
import IFolder from "../storage/IFolder";
import FileExplorerFolder from "./FileExplorerFolder";
import { Button, Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import CreatorTools from "../app/CreatorTools";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import WebUtilities from "./WebUtilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolderPlus } from "@fortawesome/free-solid-svg-icons";
import FileExplorerFilePreview from "./FileExplorerFilePreview";

export enum FileExplorerMode {
  explorer = 0,
  folderPicker = 1,
}

interface IFileExplorerProps {
  rootFolder: IFolder;
  theme: ThemeInput<any>;
  heightOffset?: number;
  mode: FileExplorerMode;
  forceCompact?: boolean;
  selectFirstFile?: boolean;
  selectedItem?: IFile | IFolder | null | undefined;
  itemAnnotations?: ItemAnnotationCollection;
  expandByDefault?: boolean;
  showPreview?: boolean;
  height?: number;
  onFileSelected?: (file: IFile) => void;
  onFolderSelected?: (folder: IFolder) => void;

  creatorTools: CreatorTools;
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

    let sel = this.props.selectedItem;

    if (!sel && this.props.selectFirstFile) {
      sel = StorageUtilities.getFirstFile(this.props.rootFolder);
    }

    this.state = {
      newFolderName: undefined,
      selectedItem: sel,
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
    if (data === undefined || this.props.creatorTools === null || this.state == null) {
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
    const width = WebUtilities.getWidth();

    let isCompact = false;

    if ((width < 1016 && this.props.showPreview) || this.props.forceCompact === true) {
      isCompact = true;
    }

    let explorerHeight = "inherit";
    let folderAreaHeight = "inherit";

    if (isCompact) {
    } else {
      if (this.props.height) {
        explorerHeight = this.props.height + "px";
        folderAreaHeight = this.props.height - 11 + "px";
      } else if (this.props.heightOffset) {
        explorerHeight =
          height > this.props.heightOffset + 100 ? "calc(100vh - " + (this.props.heightOffset - 10) + "px)" : "inherit";

        folderAreaHeight =
          height > this.props.heightOffset + 100 ? "calc(100vh - " + (this.props.heightOffset + 4) + "px)" : "inherit";
      }
    }

    let accessoryArea = <></>;

    if (this.props.mode === FileExplorerMode.folderPicker && this.state.selectedItem) {
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
          <div className="fex-newFolderLabel" title={"Create a new folder at " + this.state.selectedItem.name}>
            <span>(create a new folder at </span>
            <span style={{ backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background3 }}>
              {this.state.selectedItem.name}
            </span>
            <span>):</span>
          </div>
          <div className="fex-newFolderName">
            <Input
              value={this.state.newFolderName}
              aria-label="New Folder"
              placeholder="New Folder"
              onChange={this._handleNewFolderChanged}
            />
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

      if (this.props.heightOffset) {
        explorerHeight =
          height > this.props.heightOffset + 100
            ? "calc(100vh - " + (this.props.heightOffset + 110) + "px)"
            : "inherit";
        folderAreaHeight =
          height > this.props.heightOffset + 100
            ? "calc(100vh - " + (this.props.heightOffset + 174) + "px)"
            : "inherit";
      }
    }

    let previewArea = <></>;
    let outerClass = "fex-area";
    let folderAreaClass = "fex-folderArea";

    if (this.props.showPreview && this.state.selectedItem && (this.state.selectedItem as IFile).content !== undefined) {
      let previewAreaClass = "fex-previewArea";
      if (isCompact) {
        outerClass = "fex-areaWithPreviewCompact";
        folderAreaClass = "fex-folderAreaCompact";
        previewAreaClass = "fex-previewAreaCompact";
      } else {
        outerClass = "fex-areaWithPreview";
      }

      previewArea = (
        <div className={previewAreaClass}>
          <FileExplorerFilePreview
            selectedItem={this.state.selectedItem as IFile}
            file={this.state.selectedItem as IFile}
            heightOffset={!isCompact ? this.props.heightOffset : undefined}
            height={this.props.height ? this.props.height - 16 : isCompact ? 180 : undefined}
            fileExplorer={this}
            theme={this.props.theme}
            readOnly={this.props.readOnly}
          />
        </div>
      );
    }

    return (
      <div
        className={outerClass}
        style={{
          maxHeight: explorerHeight,
          borderColor: this.props.theme.siteVariables?.colorScheme.brand.background4,
        }}
      >
        <div
          className={folderAreaClass}
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            maxHeight: folderAreaHeight,
          }}
          role="tree"
        >
          <FileExplorerFolder
            folder={this.props.rootFolder}
            startExpanded={true}
            expandByDefault={this.props.expandByDefault}
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
        {previewArea}
        {accessoryArea}
      </div>
    );
  }
}
