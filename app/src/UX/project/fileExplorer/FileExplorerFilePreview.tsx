import { Component } from "react";
import "./FileExplorerFilePreview.css";
import IFile from "../../../storage/IFile";
import FileExplorer from "./FileExplorer";
import ItemAnnotationCollection from "../../types/ItemAnnotationCollection";
import IFolder from "../../../storage/IFolder";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import IProjectTheme from "../../types/IProjectTheme";

interface IFileExplorerFilePreviewProps {
  file: IFile;
  fileExplorer: FileExplorer;
  isExpandable?: boolean;
  isExpanded?: boolean;
  readOnly?: boolean;
  heightOffset?: number;
  height?: number;
  theme: IProjectTheme;

  selectedItem: IFile | IFolder | undefined | null;

  itemAnnotations?: ItemAnnotationCollection;
}

interface IFileExplorerFilePreviewState {}

export default class FileExplorerFilePreview extends Component<
  IFileExplorerFilePreviewProps,
  IFileExplorerFilePreviewState
> {
  render() {
    let outerCss = "feffp-area";
    let title = "";
    let interior = <></>;
    let backgroundColor = undefined;

    let height = "inherit";

    if (this.props.heightOffset) {
      height = "calc(100vh - " + String(this.props.heightOffset + 10) + "px)";
    } else if (this.props.height) {
      height = this.props.height + "px";
    }

    if (this.props.selectedItem && this.props.selectedItem === this.props.file) {
      const content = this.props.file.content;

      if (typeof content === "string") {
        interior = (
          <textarea
            className="feffp-textArea"
            style={{
              minHeight: height,
              backgroundColor: getThemeColors().background2,
              color: getThemeColors().foreground2,
            }}
            readOnly={this.props.readOnly}
            value={content}
          ></textarea>
        );
      }
    }

    return (
      <div className={outerCss} title={title} style={{ backgroundColor: backgroundColor }}>
        {interior}
      </div>
    );
  }
}
