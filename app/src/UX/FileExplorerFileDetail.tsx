import { Component } from "react";
import "./FileExplorerFileDetail.css";
import IFile from "../storage/IFile";
import FileExplorer from "./FileExplorer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFile } from "@fortawesome/free-regular-svg-icons";
import ItemAnnotationCollection from "./ItemAnnotationCollection";
import { ItemAnnotationType } from "./ItemAnnotation";
import { faCaretDown, faCaretRight } from "@fortawesome/free-solid-svg-icons";

interface IFileExplorerFileDetailProps {
  file: IFile;
  fileExplorer: FileExplorer;
  isExpandable?: boolean;
  isExpanded?: boolean;

  itemAnnotations?: ItemAnnotationCollection;
  onExpandedSet?: (newExpandedValue: boolean) => void;

  onRemove?: () => void;
}

interface IFileExplorerFileDetailState {}

export default class FileExplorerFileDetail extends Component<
  IFileExplorerFileDetailProps,
  IFileExplorerFileDetailState
> {
  constructor(props: IFileExplorerFileDetailProps) {
    super(props);

    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._handleExpanderClick = this._handleExpanderClick.bind(this);
  }

  _handleCloseClick() {
    if (this.props.onRemove) {
      this.props.onRemove();
    }
  }

  _handleExpanderClick() {
    if (this.props.onExpandedSet) {
      this.props.onExpandedSet(!this.props.isExpanded);
    }
  }

  render() {
    let outerCss = "fexfid-area";
    let title = "";

    if (this.props.itemAnnotations) {
      for (const storageName in this.props.itemAnnotations) {
        const annotationColl = this.props.itemAnnotations[storageName];

        for (let i = 0; i < annotationColl.length; i++) {
          if (title.length > 0) {
            title += " ";
          }
          if (annotationColl[i].type === ItemAnnotationType.error && outerCss.indexOf("error") < 1) {
            outerCss += " fexfid-error";
          }

          title += annotationColl[i].message;
        }
      }
    }

    let expandable = <></>;

    if (this.props.isExpandable) {
      expandable = (
        <div className="fexfid-expander" onClick={this._handleExpanderClick}>
          {this.props.isExpanded ? (
            <FontAwesomeIcon icon={faCaretDown} className="fa-lg" />
          ) : (
            <FontAwesomeIcon icon={faCaretRight} className="fa-lg" />
          )}
        </div>
      );
    }

    return (
      <div className={outerCss} title={title}>
        {expandable}
        <div className="fexfid-icon">
          <FontAwesomeIcon icon={faFile} className="fa-lg" />
        </div>
        <div className="fexfid-label">{this.props.file.name}</div>
      </div>
    );
  }
}
