import { Component } from "react";
import "./FileExplorerContainerFile.css";
import IFolder from "../storage/IFolder";
import FileExplorerFileDetail from "./FileExplorerFileDetail";
import FileExplorer from "./FileExplorer";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import IStorageObject from "../storage/IStorageObject";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import FileExplorerFolder from "./FileExplorerFolder";
import { ThemeInput } from "@fluentui/react-northstar";

interface IFileExplorerContainerFileProps {
  file: IFile;
  fileExplorer: FileExplorer;
  displayFileDetail: boolean;
  depth: number;
  theme: ThemeInput<any>;
  selectedItem: IFile | IFolder | undefined | null;
  onFileSelected?: (file: IFile) => void;
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
    }

    this.setState({
      cabinetRootFolder: rootFolder,
      isLoaded: true,
    });
  }

  getAnnotationsForStorageObject(folderOrFile: IStorageObject) {
    if (!this.props.itemAnnotations) {
      return undefined;
    }

    const annotations: ItemAnnotationCollection = {};

    for (const path in this.props.itemAnnotations) {
      if (path.startsWith(folderOrFile.storageRelativePath)) {
        const annotationList = this.props.itemAnnotations[path];

        annotations[path] = annotationList;
      }
    }

    return annotations;
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
          theme={this.props.theme}
          selectedItem={this.props.selectedItem}
          isExpanded={this.state.isExpanded}
          itemAnnotations={this.props.itemAnnotations}
          fileExplorer={this.props.fileExplorer}
          onFileSelected={this.props.onFileSelected}
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
              theme={this.props.theme}
              selectedItem={this.props.selectedItem}
              onFileSelected={this.props.onFileSelected}
              itemAnnotations={this.getAnnotationsForStorageObject(file)}
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

          if (childFolder) {
            items.push(
              <FileExplorerFolder
                folder={childFolder}
                startExpanded={false}
                key={"fo" + childFolder.name}
                theme={this.props.theme}
                selectedItem={this.props.selectedItem}
                onFileSelected={this.props.onFileSelected}
                itemAnnotations={this.getAnnotationsForStorageObject(childFolder)}
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
