import { Component } from "react";
import "./FileExplorer.css";
import IFolder from "../storage/IFolder";
import FileExplorerFolder from "./FileExplorerFolder";
import { ThemeInput } from "@fluentui/react-northstar";
import Carto from "../app/Carto";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import IFile from "../storage/IFile";

interface IFileExplorerProps {
  rootFolder: IFolder;
  theme: ThemeInput<any>;
  heightOffset: number;

  selectedItem: IFile | IFolder | null | undefined;
  itemAnnotations?: ItemAnnotationCollection;

  onFileSelected?: (file: IFile) => void;

  carto: Carto;
  readOnly: boolean;

  onRemove?: () => void;
}

interface IFileExplorerState {}

export default class FileExplorer extends Component<IFileExplorerProps, IFileExplorerState> {
  constructor(props: IFileExplorerProps) {
    super(props);

    this._handleCloseClick = this._handleCloseClick.bind(this);
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

  render() {
    const explorerHeight = "calc(100vh - " + (this.props.heightOffset - 10) + "px)";

    return (
      <div
        className="fex-area"
        style={{
          maxHeight: explorerHeight,
          minHeight: explorerHeight,
        }}
      >
        <FileExplorerFolder
          folder={this.props.rootFolder}
          startExpanded={true}
          itemAnnotations={this.getAnnotationsForFolder(this.props.rootFolder)}
          fileExplorer={this}
          theme={this.props.theme}
          selectedItem={this.props.selectedItem}
          onFileSelected={this.props.onFileSelected}
          displayFolderDetail={false}
          depth={0}
        />
      </div>
    );
  }
}
