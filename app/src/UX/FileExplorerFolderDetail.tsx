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

    this._handleToggleExpandedClick = this._handleToggleExpandedClick.bind(this);
    this._handleFolderClick = this._handleFolderClick.bind(this);
    this._handleExpandClick = this._handleExpandClick.bind(this);
    this._handleCollapseClick = this._handleCollapseClick.bind(this);
  }

  _handleFolderClick() {
    if (this.props.onFolderSelected) {
      this.props.onFolderSelected(this.props.folder);
    }
  }

  _handleToggleExpandedClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(!this.props.isExpanded);
    }
  }

  _handleCollapseClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(false);
    }
  }

  _handleExpandClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(true);
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
        <div
          className="fexfod-expander"
          onClick={this._handleToggleExpandedClick}
          tabIndex={0}
          title={(this.props.isExpanded ? "Collapse" : "Expand") + " " + this.props.folder.name}
        >
          {this.props.isExpanded ? (
            <FontAwesomeIcon icon={faCaretDown} className="fa-lg" />
          ) : (
            <FontAwesomeIcon icon={faCaretRight} className="fa-lg" />
          )}
        </div>
      );
    }

    return (
      <div
        className={outerTag}
        style={{ backgroundColor: backgroundColor }}
        onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === "Space") {
            this._handleToggleExpandedClick();
          } else if (e.key === "ArrowLeft") {
            this._handleCollapseClick();
          } else if (e.key === "ArrowRight") {
            this._handleExpandClick();
          } else if (e.key === "Enter") {
            this._handleFolderClick();
          }
        }}
      >
        {expander}
        <div
          aria-selected={!!this.props.selectedItem && this.props.selectedItem === this.props.folder}
          className="fexfod-summary"
          role="treeitem"
          aria-expanded={this.props.isExpanded}
          tabIndex={0}
          onClick={this._handleFolderClick}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Space") {
              this._handleToggleExpandedClick();
              e.preventDefault();
              e.stopPropagation();
            } else if (e.key === "ArrowLeft") {
              this._handleCollapseClick();
              e.preventDefault();
              e.stopPropagation();
            } else if (e.key === "ArrowRight") {
              this._handleExpandClick();
              e.preventDefault();
              e.stopPropagation();
            } else if (e.key === "Enter") {
              this._handleFolderClick();
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          title={"Select " + this.props.folder.name}
        >
          <div className="fexfod-icon">
            <FontAwesomeIcon icon={faFolder} className="fa-lg" />
          </div>
          <div className="fexfod-label">{this.props.folder.name}</div>
        </div>
      </div>
    );
  }
}
