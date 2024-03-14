import { Component } from "react";
import "./FileExplorerFolder.css";
import IFolder from "../storage/IFolder";
import FileExplorerFolderDetail from "./FileExplorerFolderDetail";
import FileExplorerFileDetail from "./FileExplorerFileDetail";
import FileExplorer from "./FileExplorer";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import IStorageObject from "../storage/IStorageObject";
import StorageUtilities from "../storage/StorageUtilities";
import FileExplorerContainerFile from "./FileExplorerContainerFile";
import IFile from "../storage/IFile";
import { ThemeInput } from "@fluentui/react-northstar";

interface IFileExplorerFolderProps {
  folder: IFolder;
  fileExplorer: FileExplorer;
  theme: ThemeInput<any>;
  displayFolderDetail: boolean;
  depth: number;
  startExpanded: boolean;
  itemAnnotations?: ItemAnnotationCollection;
  selectedItem: IFile | IFolder | null | undefined;
  onFileSelected?: (file: IFile) => void;
}

interface IFileExplorerFolderState {
  isLoaded: boolean;
  isExpanded: boolean;
}

export default class FileExplorerFolder extends Component<IFileExplorerFolderProps, IFileExplorerFolderState> {
  constructor(props: IFileExplorerFolderProps) {
    super(props);
    this.state = {
      isLoaded: false,
      isExpanded: this.props.startExpanded,
    };

    this._folderExpandToggle = this._folderExpandToggle.bind(this);

    this.loadFolder();
  }

  async loadFolder() {
    await this.props.folder.load(false);

    this.setState({
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

  _folderExpandToggle(newExpandedValue: boolean) {
    this.setState({
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
    let binHeader = "fexfo-bin";

    if (this.props.displayFolderDetail) {
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

    for (const fileName in this.props.folder.files) {
      const file = this.props.folder.files[fileName];

      if (file) {
        if (StorageUtilities.isContainerFile(fileName)) {
          items.push(
            <FileExplorerContainerFile
              file={file}
              key={"fd" + fileName}
              displayFileDetail={true}
              depth={this.props.depth + 1}
              startExpanded={false}
              theme={this.props.theme}
              itemAnnotations={this.getAnnotationsForStorageObject(file)}
              onFileSelected={this.props.onFileSelected}
              selectedItem={this.props.selectedItem}
              fileExplorer={this.props.fileExplorer}
            />
          );
        } else {
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
      for (const folderName in this.props.folder.folders) {
        const childFolder = this.props.folder.folders[folderName];

        if (childFolder) {
          items.push(
            <FileExplorerFolder
              folder={childFolder}
              startExpanded={false}
              theme={this.props.theme}
              key={"fo" + childFolder.name}
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

    return (
      <div className="fexfo-area">
        {header}
        {bin}
      </div>
    );
  }
}
