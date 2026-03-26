import { Component, ContextType } from "react";
import "./FileExplorerContainerFile.css";
import IFolder from "../../../storage/IFolder";
import FileExplorerFileDetail from "./FileExplorerFileDetail";
import FileExplorer from "./FileExplorer";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import IFile from "../../../storage/IFile";
import StorageUtilities from "../../../storage/StorageUtilities";
import FileExplorerFolder from "./FileExplorerFolder";
import { FileExplorerContext } from "./FileExplorerContext";
import { getAnnotationsForStorageObject } from "../../types/ItemAnnotationUtilities";

interface IFileExplorerContainerFileProps {
  file: IFile;
  fileExplorer: FileExplorer;
  displayFileDetail: boolean;
  depth: number;
  startExpanded: boolean;
  itemAnnotations?: ItemAnnotationCollection;
}

interface IFileExplorerContainerFileState {
  cabinetRootFolder?: IFolder | undefined;
  isLoaded: boolean;
  isExpanded: boolean;
}

export default class FileExplorerContainerFile extends Component<
  IFileExplorerContainerFileProps,
  IFileExplorerContainerFileState
> {
  static contextType = FileExplorerContext;
  declare context: ContextType<typeof FileExplorerContext>;

  constructor(props: IFileExplorerContainerFileProps) {
    super(props);
    this.state = {
      isLoaded: false,
      isExpanded: this.props.startExpanded,
    };

    this._fileExpandToggle = this._fileExpandToggle.bind(this);

    this.loadCabinetFile();
  }

  async loadCabinetFile() {
    let rootFolder = undefined;

    if (StorageUtilities.isContainerFile(this.props.file.storageRelativePath)) {
      await this.props.file.loadContent(false);

      rootFolder = await StorageUtilities.getFileStorageFolder(this.props.file);

      if (typeof rootFolder === "string") {
        return;
      }
    }

    this.setState({
      cabinetRootFolder: rootFolder,
      isLoaded: true,
    });
  }

  _fileExpandToggle(newExpandedValue: boolean) {
    this.setState({
      cabinetRootFolder: this.state.cabinetRootFolder,
      isLoaded: this.state.isLoaded,
      isExpanded: newExpandedValue,
    });
  }

  render() {
    if (!this.state || !this.state.isLoaded) {
      return <></>;
    }

    const items: any[] = [];
    let header = <></>;
    let binHeader = "fexcf-bin";

    if (this.props.displayFileDetail) {
      binHeader = "fexcf-binIndent";
      header = (
        <FileExplorerFileDetail
          key={"rootDetail"}
          file={this.props.file}
          isExpandable={true}
          isExpanded={this.state.isExpanded}
          itemAnnotations={this.props.itemAnnotations}
          fileExplorer={this.props.fileExplorer}
          onExpandedSet={this._fileExpandToggle}
        />
      );
    }

    if (this.state.cabinetRootFolder) {
      for (const fileName in this.state.cabinetRootFolder.files) {
        const file = this.state.cabinetRootFolder.files[fileName];

        if (file) {
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
    }

    let bin = <></>;

    if (this.state.isExpanded) {
      bin = <div className={binHeader}>{items}</div>;

      if (this.state.cabinetRootFolder) {
        for (const folderName in this.state.cabinetRootFolder.folders) {
          const childFolder = this.state.cabinetRootFolder.folders[folderName];

          if (childFolder && !childFolder.canIgnore) {
            items.push(
              <FileExplorerFolder
                folder={childFolder}
                startExpanded={false}
                key={"fo" + childFolder.name}
                itemAnnotations={getAnnotationsForStorageObject(this.props.itemAnnotations, childFolder)}
                fileExplorer={this.props.fileExplorer}
                displayFolderDetail={true}
                depth={this.props.depth + 1}
              />
            );
          }
        }
      }
    }

    return (
      <div className="fexcf-area">
        {header}
        {bin}
      </div>
    );
  }
}
