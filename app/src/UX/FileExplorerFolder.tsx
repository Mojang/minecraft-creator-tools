import { Component } from "react";
import "./FileExplorerFolder.css";
import IFolder from "../storage/IFolder";
import FileExplorerFolderDetail from "./FileExplorerFolderDetail";
import FileExplorerFileDetail from "./FileExplorerFileDetail";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
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
  expandByDefault?: boolean;
  mode: FileExplorerMode;
  startExpanded: boolean;
  itemAnnotations?: ItemAnnotationCollection;
  selectedItem: IFile | IFolder | null | undefined;
  onFileSelected?: (file: IFile) => void;
  onFolderSelected?: (folder: IFolder) => void;
}

interface IFileExplorerFolderState {
  loadedExtendedPath: string | undefined;
  isExpanded: boolean;
}

export default class FileExplorerFolder extends Component<IFileExplorerFolderProps, IFileExplorerFolderState> {
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
      loadedExtendedPath: this.state.loadedExtendedPath,
      isExpanded: newExpandedValue,
    });
  }

  render() {
    if (!this.state || !this.state.loadedExtendedPath) {
      return <></>;
    }

    const items: any[] = [];
    let header = <></>;
    let binHeader = "fexfo-bin";

    if (this.props.displayFolderDetail || this.props.mode === FileExplorerMode.folderPicker) {
      binHeader = "fexfo-binIndent";
      header = (
        <FileExplorerFolderDetail
          key={"rootDetail"}
          folder={this.props.folder}
          theme={this.props.theme}
          selectedItem={this.props.selectedItem}
          mode={this.props.mode}
          isExpanded={this.state.isExpanded}
          onFolderSelected={this.props.onFolderSelected}
          itemAnnotations={this.props.itemAnnotations}
          fileExplorer={this.props.fileExplorer}
          onExpandedSet={this._folderExpandToggle}
        />
      );
    }

    if (this.props.mode !== FileExplorerMode.folderPicker) {
      this.props.folder.getSortedFileKeys().forEach((fileName) => {
        const file = this.props.folder.files[fileName];

        if (file && !file.canIgnore) {
          if (StorageUtilities.isContainerFile(fileName)) {
            items.push(
              <FileExplorerContainerFile
                file={file}
                key={"fd" + fileName}
                mode={this.props.mode}
                displayFileDetail={true}
                depth={this.props.depth + 1}
                startExpanded={false}
                theme={this.props.theme}
                itemAnnotations={this.getAnnotationsForStorageObject(file)}
                onFileSelected={this.props.onFileSelected}
                onFolderSelected={this.props.onFolderSelected}
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
      });
    }

    let bin = <></>;

    if (this.state.isExpanded) {
      bin = <div className={binHeader}>{items}</div>;
      this.props.folder.getSortedFolderKeys().forEach((folderName) => {
        const childFolder = this.props.folder.folders[folderName];

        if (childFolder && !childFolder.canIgnore) {
          items.push(
            <FileExplorerFolder
              folder={childFolder}
              startExpanded={this.props.expandByDefault || this.props.mode === FileExplorerMode.folderPicker}
              theme={this.props.theme}
              expandByDefault={this.props.expandByDefault}
              key={"fo" + childFolder.name}
              mode={this.props.mode}
              selectedItem={this.props.selectedItem}
              onFileSelected={this.props.onFileSelected}
              onFolderSelected={this.props.onFolderSelected}
              itemAnnotations={this.getAnnotationsForStorageObject(childFolder)}
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
