import { Component } from "react";
import IFile from "../storage/IFile";
import "./ImageEditor.css";
import React from "react";
import IPersistable from "./IPersistable";
import Carto from "../app/Carto";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import TuiImageEditor from "tui-image-editor";
import "tui-image-editor/dist/tui-image-editor.css";
import "tui-color-picker/dist/tui-color-picker.css";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

interface IImageEditorProps {
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

interface IImageEditorState {
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

export default class ImageEditor extends Component<IImageEditorProps, IImageEditorState> implements IPersistable {
  private rootElt: React.RefObject<HTMLDivElement>;
  private imageEditor: TuiImageEditor | null = null;
  private imageElement: HTMLDivElement | null = null;

  constructor(props: IImageEditorProps) {
    super(props);
    this.rootElt = React.createRef();

    this._toggleEdit = this._toggleEdit.bind(this);

    this.state = {
      fileToEdit: props.file,
      content: this.props.initialContent,
      isView: true,
    };

    this._updateEditor = this._updateEditor.bind(this);

    this.getImageString();
  }

  componentDidMount() {
    this._addImageInterior();
  }

  _addImageInterior() {
    const heightOffset = this.props.heightOffset ? this.props.heightOffset - 1 : 150;

    if (this.rootElt !== null && this.rootElt.current !== null) {
      if (this.imageEditor) {
        this.disposeImageEditor();
      }

      while (this.rootElt.current.childNodes.length > 0) {
        this.rootElt.current.removeChild(this.rootElt.current.childNodes[0]);
      }

      this.imageElement = null;
      this.imageEditor = null;

      if (this.state.isView) {
        if (!this.imageElement) {
          this.imageElement = document.createElement("DIV") as HTMLDivElement;
          this.imageElement.style.imageRendering = "pixelated";
          this.imageElement.style.padding = "1px";
          this.imageElement.className = "ie-image";
          this.imageElement.style.height = "calc(100vh - " + heightOffset + "px)";
          this.rootElt.current.appendChild(this.imageElement);
        }

        this.imageElement.style.backgroundImage = "url('" + this.getImageString() + "')";
      } else {
        this.imageEditor = new TuiImageEditor(this.rootElt.current, {
          usageStatistics: false,
          includeUI: {
            loadImage: {
              path: this.getImageString(),
              name: this.props.file ? this.props.file.name : "file",
            },
            uiSize: {
              width: "100%",
              height: "calc(100vh - " + heightOffset + "px)",
            },
            menuBarPosition: "right",
          },
          selectionStyle: {
            cornerSize: 20,
            rotatingPointOffset: 70,
          },
        });

        window.setTimeout(this._updateEditor, 1000);
      }
    }
  }

  componentDidUpdate(prevProps: IImageEditorProps, prevState: IImageEditorState) {
    if (this.props.file !== prevProps.file) {
      if (this.imageEditor && this.props.file) {
        const str = this.getImageString();
        this.imageEditor.loadImageFromURL(str, this.props.file.name);
      } else if (this.imageElement && this.props.file) {
        this.imageElement.style.backgroundImage = "url('" + this.getImageString() + "')";
      } else {
        this._addImageInterior();
      }
    } else if (this.state.isView !== prevState.isView) {
      this._addImageInterior();
    }
  }

  _updateEditor() {
    if (this.imageEditor === null) {
      return;
    }

    this.imageEditor.resizeCanvasDimension({
      width: 3000,
      height: 3000,
    });
  }

  getImageString() {
    if (this.props.file === undefined) {
      return "";
    }
    if (!this.props.file.isContentLoaded) {
      this.props.file.loadContent();
      return "";
    }

    if (this.props.file.content instanceof Uint8Array) {
      let str = "data:image/";
      str += StorageUtilities.getTypeFromName(this.props.file.name);
      str += ";base64,";

      const base64 = Utilities.uint8ArrayToBase64(this.props.file.content);
      str += base64;

      return str;
    }

    return "";
  }

  componentWillUnmount() {
    this.disposeImageEditor();
  }

  disposeImageEditor() {
    if (this.imageEditor) {
      this.imageEditor.destroy();
      this.imageEditor = null;
    }
  }

  _toggleEdit() {
    this.setState({
      isView: !this.state.isView,
      fileToEdit: this.state.fileToEdit,
      content: this.state.content,
    });
  }

  static getDerivedStateFromProps(props: IImageEditorProps, state: IImageEditorState) {
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
    let editToggle = <></>;

    if (!this.props.readOnly || !this.state.isView) {
      editToggle = (
        <div className="ie-float">
          <Button onClick={this._toggleEdit}>
            <FontAwesomeIcon icon={faEdit} className="fa-lg" />
          </Button>
        </div>
      );
    }

    return (
      <div className="ie-outer">
        {editToggle}
        <div className="ie-contents" ref={this.rootElt}></div>
      </div>
    );
  }
}
