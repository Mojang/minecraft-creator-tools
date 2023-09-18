import { Component } from "react";
import "./FileExplorerFolderDetail.css";
import IFolder from "../storage/IFolder";
import FileExplorer from "./FileExplorer";
import { faFolder } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";

interface IFileExplorerFolderDetailProps {
  folder: IFolder;
  fileExplorer: FileExplorer;
  isExpanded: boolean;
  itemAnnotations?: ItemAnnotationCollection;
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
  }

  _handleExpanderClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(!this.props.isExpanded);
    }
  }

  render() {
    let outerTag = "fexfod-area";

    if (this.props.itemAnnotations) {
      for (const annotationPath in this.props.itemAnnotations) {
        const annotationColl = this.props.itemAnnotations[annotationPath];

        if (annotationColl.length > 0) {
          outerTag += " fexfod-containsAnnotatedItems";
          break;
        }
      }
    }

    return (
      <div className={outerTag}>
        <div className="fexfod-expander" onClick={this._handleExpanderClick}>
          {this.props.isExpanded ? (
            <FontAwesomeIcon icon={faCaretDown} className="fa-lg" />
          ) : (
            <FontAwesomeIcon icon={faCaretRight} className="fa-lg" />
          )}
        </div>
        <div className="fexfod-icon">
          <FontAwesomeIcon icon={faFolder} className="fa-lg" />
        </div>
        <div className="fexfod-label">{this.props.folder.name}</div>
      </div>
    );
  }
}
