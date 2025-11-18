import { Component } from "react";
import IFile from "../storage/IFile";
import "./ImageManager.css";
import React from "react";
import IPersistable from "./IPersistable";
import CreatorTools from "../app/CreatorTools";
import { Button, ThemeInput } from "@fluentui/react-northstar";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import ImageEditor from "./ImageEditor";
import ProjectItem from "../app/ProjectItem";

interface IImageManagerProps {
  file?: IFile;
  projectItem?: ProjectItem;
  theme: ThemeInput<any>;
  initialContent?: Uint8Array;
  placeholder?: string;
  visualSeed?: number;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  readOnly: boolean;
  creatorTools: CreatorTools;
  onUpdateContent?: (newContent: Uint8Array) => void;
  onCommit?: (newContent: Uint8Array) => void;
}

interface IImageManagerState {
  fileToEdit?: IFile;
  content?: Uint8Array;
  isView: boolean;
}

export default class ImageManager extends Component<IImageManagerProps, IImageManagerState> {
  private rootElt: React.RefObject<HTMLDivElement>;
  private imageElement: HTMLDivElement | null = null;
  private _activeEditorPersistable?: IPersistable;

  constructor(props: IImageManagerProps) {
    super(props);
    this.rootElt = React.createRef();

    this._toggleEdit = this._toggleEdit.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);

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
          this.imageElement.className = "ifm-image";
          this.imageElement.style.height = "calc(100vh - " + heightOffset + "px)";
          this.rootElt.current.appendChild(this.imageElement);
        }

        this.imageElement.style.backgroundImage = "url('" + this.getImageString() + "')";
      }
    }
  }

  componentDidUpdate(prevProps: IImageManagerProps, prevState: IImageManagerState) {
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

  async _toggleEdit() {
    if (this._activeEditorPersistable) {
      await this._activeEditorPersistable.persist();
      if (this.props.setActivePersistable) {
        this.props.setActivePersistable(this);
      }
      this._activeEditorPersistable = undefined;
    }

    this.setState({
      isView: !this.state.isView,
      fileToEdit: this.state.fileToEdit,
      content: this.state.content,
    });
  }

  static getDerivedStateFromProps(props: IImageManagerProps, state: IImageManagerState) {
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

  async persist(): Promise<boolean> {
    return false;
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;

    if (this.props.setActivePersistable) {
      this.props.setActivePersistable(newPersistable);
    }
  }

  render() {
    let editToggle = <></>;
    let interior = <></>;

    if (!this.props.readOnly && this.props.projectItem) {
      editToggle = (
        <div className="ifm-float">
          <Button onClick={this._toggleEdit}>
            <FontAwesomeIcon icon={faEdit} className="fa-lg" />
          </Button>
        </div>
      );
    }

    if (this.state.isView) {
      interior = <div className="ifm-contents" ref={this.rootElt}></div>;
    } else {
      if (
        this.state.fileToEdit &&
        this.state.fileToEdit.content &&
        this.state.fileToEdit.content instanceof Uint8Array &&
        this.props.projectItem
      ) {
        interior = (
          <ImageEditor
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
            projectItem={this.props.projectItem}
            name={this.state.fileToEdit.name}
            content={this.state.fileToEdit.content}
            setActivePersistable={this.props.setActivePersistable}
          />
        );
      } else {
        interior = <div>(Image does not have content.)</div>;
      }
    }

    return (
      <div className="ifm-outer">
        {editToggle}
        {interior}
      </div>
    );
  }
}
