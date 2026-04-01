import { Component, ContextType } from "react";
import "./FileExplorerFolder.css";
import IFolder from "../../../storage/IFolder";
import FileExplorerFolderDetail from "./FileExplorerFolderDetail";
import FileExplorerFileDetail from "./FileExplorerFileDetail";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import StorageUtilities from "../../../storage/StorageUtilities";
import FileExplorerContainerFile from "./FileExplorerContainerFile";
import { FileExplorerContext } from "./FileExplorerContext";
import { getAnnotationsForStorageObject } from "../../types/ItemAnnotationUtilities";

interface IFileExplorerFolderProps {
  folder: IFolder;
  fileExplorer: FileExplorer;
  displayFolderDetail: boolean;
  depth: number;
  expandByDefault?: boolean;
  startExpanded: boolean;
  itemAnnotations?: ItemAnnotationCollection;
}

interface IFileExplorerFolderState {
  loadedExtendedPath: string | undefined;
  isExpanded: boolean;
}

export default class FileExplorerFolder extends Component<IFileExplorerFolderProps, IFileExplorerFolderState> {
  static contextType = FileExplorerContext;
  declare context: ContextType<typeof FileExplorerContext>;

  constructor(props: IFileExplorerFolderProps) {
    super(props);
    this.state = {
      loadedExtendedPath: undefined,
      isExpanded: this.props.startExpanded,
    };

    this._folderExpandToggle = this._folderExpandToggle.bind(this);
  }

  componentDidMount(): void {
    this.loadFolder();
  }

  componentDidUpdate(
    prevProps: Readonly<IFileExplorerFolderProps>,
    prevState: Readonly<IFileExplorerFolderState>,
    snapshot?: any
  ): void {
    if (prevProps.folder !== this.props.folder) {
      this.loadFolder();
    }
  }

  async loadFolder() {
    if (this.props.folder.extendedPath !== this.state.loadedExtendedPath) {
      await this.props.folder.load();
    }

    this.setState({
      loadedExtendedPath: this.props.folder.extendedPath,
    });
  }

  _folderExpandToggle(newExpandedValue: boolean) {
    this.setState({
      loadedExtendedPath: this.state.loadedExtendedPath,
      isExpanded: newExpandedValue,
    });
  }

  render() {
    if (!this.state || !this.state.loadedExtendedPath) {
      return <></>;
    }

    const { theme, selectedItem, mode, onFileSelected, onFolderSelected, project } = this.context;

    const items: any[] = [];
    let header = <></>;
    let binHeader = "fexfo-bin";

    if (this.props.displayFolderDetail || mode === FileExplorerMode.folderPicker) {
      binHeader = "fexfo-binIndent";
      header = (
        <FileExplorerFolderDetail
          key={"rootDetail"}
          folder={this.props.folder}
          isExpanded={this.state.isExpanded}
          itemAnnotations={this.props.itemAnnotations}
          fileExplorer={this.props.fileExplorer}
          onExpandedSet={this._folderExpandToggle}
        />
      );
    }

    if (mode !== FileExplorerMode.folderPicker) {
      this.props.folder.getSortedFileKeys().forEach((fileName) => {
        const file = this.props.folder.files[fileName];

        if (file && !file.canIgnore) {
          if (StorageUtilities.isContainerFile(fileName)) {
            items.push(
              <FileExplorerContainerFile
                file={file}
                key={"fd" + fileName}
                displayFileDetail={true}
                depth={this.props.depth + 1}
                startExpanded={false}
                itemAnnotations={getAnnotationsForStorageObject(this.props.itemAnnotations, file)}
                fileExplorer={this.props.fileExplorer}
              />
            );
          } else {
            items.push(
              <FileExplorerFileDetail
                file={file}
                key={"fd" + fileName}
                itemAnnotations={getAnnotationsForStorageObject(this.props.itemAnnotations, file)}
                fileExplorer={this.props.fileExplorer}
              />
            );
          }
        }
      });
    }

    let bin = <></>;

    if (this.state.isExpanded) {
      bin = (
        <div className={binHeader} role="group">
          {items}
        </div>
      );
      this.props.folder.getSortedFolderKeys().forEach((folderName) => {
        const childFolder = this.props.folder.folders[folderName];

        if (childFolder && !childFolder.canIgnore) {
          // First-level folders (depth 0 rendering children at depth 1) should be expanded by default
          const shouldStartExpanded =
            this.props.depth === 0 || this.props.expandByDefault || mode === FileExplorerMode.folderPicker;

          items.push(
            <FileExplorerFolder
              folder={childFolder}
              startExpanded={shouldStartExpanded}
              expandByDefault={this.props.expandByDefault}
              key={"fo" + childFolder.name}
              itemAnnotations={getAnnotationsForStorageObject(this.props.itemAnnotations, childFolder)}
              fileExplorer={this.props.fileExplorer}
              displayFolderDetail={true}
              depth={this.props.depth + 1}
            />
          );
        }
      });
    }

    return (
      <div className="fexfo-area">
        {header}
        {bin}
      </div>
    );
  }
}
