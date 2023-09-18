import { Component } from "react";
import IFile from "../storage/IFile";
import "./GridEditor.css";
import React from "react";
import IPersistable from "./IPersistable";
import Carto from "../app/Carto";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import TuiGrid from "tui-grid";
import "tui-grid/dist/tui-grid.css";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface IGridEditorProps {
  file?: IFile;
  theme: ThemeInput<any>;
  initialContent?: Uint8Array;
  placeholder?: string;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  readOnly: boolean;
  carto: Carto;
  onUpdateContent?: (newContent: Uint8Array) => void;
  onCommit?: (newContent: Uint8Array) => void;
}

interface IGridEditorState {
  fileToEdit?: IFile;
  content?: Uint8Array;
  isView: boolean;
}

export const whiteTheme = {
  "common.bisize.width": "0",
  "common.bisize.height": "0",
  "common.backgroundColor": "#fff",

  // header
  "header.backgroundImage": "none",
  "header.backgroundColor": "transparent",
  "header.border": "0px",

  // load button
  "loadButton.backgroundColor": "#fff",
  "loadButton.border": "1px solid #ddd",
  "loadButton.color": "#222",
  "loadButton.fontFamily": "'Noto Sans', sans-serif",
  "loadButton.fontSize": "12px",

  // download button
  "downloadButton.backgroundColor": "#fdba3b",
  "downloadButton.border": "1px solid #fdba3b",
  "downloadButton.color": "#fff",
  "downloadButton.fontFamily": "'Noto Sans', sans-serif",
  "downloadButton.fontSize": "12px",

  // main icons
  "menu.normalIcon.color": "#8a8a8a",
  "menu.activeIcon.color": "#555555",
  "menu.disabledIcon.color": "#434343",
  "menu.hoverIcon.color": "#e9e9e9",
  "menu.iconSize.width": "24px",
  "menu.iconSize.height": "24px",

  // submenu icons
  "submenu.normalIcon.color": "#8a8a8a",
  "submenu.activeIcon.color": "#555555",
  "submenu.iconSize.width": "32px",
  "submenu.iconSize.height": "32px",

  // submenu primary color
  "submenu.backgroundColor": "transparent",
  "submenu.partition.color": "#e5e5e5",

  // submenu labels
  "submenu.normalLabel.color": "#858585",
  "submenu.normalLabel.fontWeight": "normal",
  "submenu.activeLabel.color": "#000",
  "submenu.activeLabel.fontWeight": "normal",

  // checkbox style
  "checkbox.border": "1px solid #ccc",
  "checkbox.backgroundColor": "#fff",

  // range style
  "range.pointer.color": "#333",
  "range.bar.color": "#ccc",
  "range.subbar.color": "#606060",

  "range.disabledPointer.color": "#d3d3d3",
  "range.disabledBar.color": "rgba(85,85,85,0.06)",
  "range.disabledSubbar.color": "rgba(51,51,51,0.2)",

  "range.value.color": "#000",
  "range.value.fontWeight": "normal",
  "range.value.fontSize": "11px",
  "range.value.border": "0",
  "range.value.backgroundColor": "#f5f5f5",
  "range.title.color": "#000",
  "range.title.fontWeight": "lighter",

  // colorpicker style
  "colorpicker.button.border": "0px",
  "colorpicker.title.color": "#000",
};

export default class GridEditor extends Component<IGridEditorProps, IGridEditorState> implements IPersistable {
  private rootElt: React.RefObject<HTMLDivElement>;
  private grid: TuiGrid | null = null;
  private gridElement: HTMLDivElement | null = null;

  constructor(props: IGridEditorProps) {
    super(props);
    this.rootElt = React.createRef();

    this._toggleEdit = this._toggleEdit.bind(this);

    this.state = {
      fileToEdit: props.file,
      content: this.props.initialContent,
      isView: true,
    };

    this._updateGrid = this._updateGrid.bind(this);
  }

  componentDidMount() {
    this._addGrid();
  }

  _addGrid() {
    const heightOffset = this.props.heightOffset ? this.props.heightOffset - 11 : 150;

    if (this.rootElt !== null && this.rootElt.current !== null) {
      if (this.grid) {
        this.disposeGrid();
      }

      while (this.rootElt.current.childNodes.length > 0) {
        this.rootElt.current.removeChild(this.rootElt.current.childNodes[0]);
      }

      this.gridElement = null;
      this.grid = null;

      if (this.state.isView) {
        if (!this.gridElement) {
          this.gridElement = document.createElement("DIV") as HTMLDivElement;
          this.gridElement.style.imageRendering = "pixelated";
          this.gridElement.style.padding = "1px";
          this.gridElement.className = "ie-image";
          this.gridElement.style.height = "calc(100vh - " + heightOffset + "px)";
          this.rootElt.current.appendChild(this.gridElement);
        }

        //     this.imageElement.style.backgroundImage = "url('" + this.getImageString() + "')";
      } else {
        this.grid = new TuiGrid({
          el: this.rootElt.current,
          columns: [
            {
              header: "Name",
              name: "name",
            },
            {
              header: "Artist",
              name: "artist",
            },
            {
              header: "Release",
              name: "release",
            },
            {
              header: "Genre",
              name: "genre",
            },
          ],
          data: [
            {
              name: "Beautiful Lies",
              artist: "Bird",
              release: "2016.03.26",
              genre: "Pop",
            },
          ],
        });

        window.setTimeout(this._updateGrid, 1000);
      }
    }
  }

  componentDidUpdate(prevProps: IGridEditorProps, prevState: IGridEditorState) {
    if (this.props.file !== prevProps.file) {
      if (this.grid && this.props.file) {
        //    const str = this.getImageString();
        //    this.imageEditor.loadImageFromURL(str, this.props.file.name);
      } else if (this.gridElement && this.props.file) {
        //    this.imageElement.style.backgroundImage = "url('" + this.getImageString() + "')";
      } else {
        this._addGrid();
      }
    } else if (this.state.isView !== prevState.isView) {
      this._addGrid();
    }
  }

  _updateGrid() {
    if (this.grid === null) {
      return;
    }
  }

  componentWillUnmount() {
    this.disposeGrid();
  }

  disposeGrid() {
    if (this.grid) {
      this.grid.destroy();
      this.grid = null;
    }
  }

  _toggleEdit() {
    this.setState({
      isView: !this.state.isView,
      fileToEdit: this.state.fileToEdit,
      content: this.state.content,
    });
  }

  static getDerivedStateFromProps(props: IGridEditorProps, state: IGridEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isView: true,
      };

      return state;
    }
    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      return state;
    }

    return null; // No change to state
  }

  async persist() {}

  render() {
    return (
      <div className="ie-outer">
        <div className="ie-float">
          <Button onClick={this._toggleEdit}>
            <FontAwesomeIcon icon={faEdit} className="fa-lg" />
          </Button>
        </div>
        <div className="ie-contents" ref={this.rootElt}></div>
      </div>
    );
  }
}
