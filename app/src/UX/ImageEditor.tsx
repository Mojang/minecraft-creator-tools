import { Component } from "react";
import IFile from "../storage/IFile";
import "./ImageEditor.css";
import React from "react";
import IPersistable from "./IPersistable";
import Carto from "../app/Carto";
import { ThemeInput } from "@fluentui/react-northstar";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";

interface IImageEditorProps {
  file?: IFile;
  theme: ThemeInput<any>;
  initialContent?: Uint8Array;
  placeholder?: string;
  visualSeed?: number;
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

export default class ImageEditor extends Component<IImageEditorProps, IImageEditorState> implements IPersistable {
  private rootElt: React.RefObject<HTMLDivElement>;
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

    this.getImageString();
  }

  componentDidMount() {
    this._addImageInterior();
  }

  _addImageInterior() {
    const heightOffset = this.props.heightOffset ? this.props.heightOffset - 1 : 150;

    if (this.rootElt !== null && this.rootElt.current !== null) {
      while (this.rootElt.current.childNodes.length > 0) {
        this.rootElt.current.removeChild(this.rootElt.current.childNodes[0]);
      }

      this.imageElement = null;

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
      }
    }
  }

  componentDidUpdate(prevProps: IImageEditorProps, prevState: IImageEditorState) {
    if (this.props.file !== prevProps.file || this.props.visualSeed !== prevProps.visualSeed) {
      if (this.imageElement && this.props.file) {
        this.imageElement.style.backgroundImage = "url('" + this.getImageString() + "')";
      } else {
        this._addImageInterior();
      }
    } else if (this.state.isView !== prevState.isView) {
      this._addImageInterior();
    }
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

    /*if (!this.props.readOnly || !this.state.isView) {
      editToggle = (
        <div className="ie-float">
          <Button onClick={this._toggleEdit}>
            <FontAwesomeIcon icon={faEdit} className="fa-lg" />
          </Button>
        </div>
      );
    }*/

    return (
      <div className="ie-outer">
        {editToggle}
        <div className="ie-contents" ref={this.rootElt}></div>
      </div>
    );
  }
}
