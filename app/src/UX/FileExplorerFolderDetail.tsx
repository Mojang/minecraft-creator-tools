import { Component } from "react";
import "./FileExplorerFolderDetail.css";
import IFolder from "../storage/IFolder";
import FileExplorer, { FileExplorerMode } from "./FileExplorer";
import { faFolder } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";
import IFile from "../storage/IFile";
import { ThemeInput } from "@fluentui/react-northstar";

interface IFileExplorerFolderDetailProps {
  folder: IFolder;
  fileExplorer: FileExplorer;
  isExpanded: boolean;
  mode: FileExplorerMode;
  theme: ThemeInput<any>;
  itemAnnotations?: ItemAnnotationCollection;
  selectedItem: IFile | IFolder | undefined | null;
  onFolderSelected?: (file: IFolder) => void;
  onExpandedSet?: (newExpandedValue: boolean) => void;
}

interface IFileExplorerFolderDetailState {}

export default class FileExplorerFolderDetail extends Component<
  IFileExplorerFolderDetailProps,
  IFileExplorerFolderDetailState
> {
  constructor(props: IFileExplorerFolderDetailProps) {
    super(props);

    this._handleExpanderClick = this._handleExpanderClick.bind(this);
    this._handleFolderClick = this._handleFolderClick.bind(this);
  }

  _handleFolderClick() {
    if (this.props.onFolderSelected) {
      this.props.onFolderSelected(this.props.folder);
    }
  }

  _handleExpanderClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(!this.props.isExpanded);
    }
  }

  render() {
    let outerTag = "fexfod-area";

    let backgroundColor = undefined;

    if (this.props.selectedItem && this.props.selectedItem === this.props.folder) {
      backgroundColor = this.props.theme.siteVariables?.colorScheme.brand.background3;
    }

    if (this.props.itemAnnotations) {
      for (const annotationPath in this.props.itemAnnotations) {
        const annotationColl = this.props.itemAnnotations[annotationPath];

        if (annotationColl.length > 0) {
          outerTag += " fexfod-containsAnnotatedItems";
          break;
        }
      }
    }

    let expander = <></>;

    if (
      this.props.folder.folderCount > 0 ||
      (this.props.mode !== FileExplorerMode.folderPicker && this.props.folder.fileCount > 0)
    ) {
      expander = (
        <div className="fexfod-expander" onClick={this._handleExpanderClick}>
          {this.props.isExpanded ? (
            <FontAwesomeIcon icon={faCaretDown} className="fa-lg" />
          ) : (
            <FontAwesomeIcon icon={faCaretRight} className="fa-lg" />
          )}
        </div>
      );
    }

    return (
      <div className={outerTag} style={{ backgroundColor: backgroundColor }}>
        {expander}
        <div className="fexfod-icon" onClick={this._handleFolderClick}>
          <FontAwesomeIcon icon={faFolder} className="fa-lg" />
        </div>
        <div className="fexfod-label" onClick={this._handleFolderClick}>
          {this.props.folder.name}
        </div>
      </div>
    );
  }
}
