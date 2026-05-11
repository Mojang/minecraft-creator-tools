import { Component } from "react";
import IFile from "../../storage/IFile";
import "./ImageManager.css";
import React from "react";
import IPersistable from "../types/IPersistable";
import CreatorTools from "../../app/CreatorTools";
import { IconButton } from "@mui/material";
import StorageUtilities from "../../storage/StorageUtilities";
import Utilities from "../../core/Utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit } from "@fortawesome/free-regular-svg-icons";
import ImageEditor from "./ImageEditor";
import ProjectItem from "../../app/ProjectItem";
import ImageCodec from "../../core/ImageCodec";
import Log from "../../core/Log";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IImageManagerProps extends WithLocalizationProps {
  file?: IFile;
  projectItem?: ProjectItem;
  theme: IProjectTheme;
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
  convertedImageUrl?: string; // For TGA files converted to data URL
}

class ImageManager extends Component<IImageManagerProps, IImageManagerState> {
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
      convertedImageUrl: undefined,
    };

    this._ensureImageReady();
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

        const imageUrl = this.state.convertedImageUrl || this.getImageString();
        this.imageElement.style.backgroundImage = "url('" + imageUrl + "')";
      }
    }
  }

  componentDidUpdate(prevProps: IImageManagerProps, prevState: IImageManagerState) {
    if (this.props.file !== prevProps.file || this.props.visualSeed !== prevProps.visualSeed) {
      // File changed - reset converted URL and re-ensure image
      this.setState({ convertedImageUrl: undefined }, () => {
        this._ensureImageReady();
      });
    } else if (this.state.isView !== prevState.isView) {
      this._addImageInterior();
    } else if (this.state.convertedImageUrl !== prevState.convertedImageUrl) {
      // Converted image ready, update display
      this._addImageInterior();
    }
  }

  /**
   * Ensure image is ready for display. For TGA files, this converts them to PNG.
   */
  async _ensureImageReady() {
    if (!this.props.file) {
      return;
    }

    if (!this.props.file.isContentLoaded) {
      await this.props.file.loadContent();
    }

    const fileType = StorageUtilities.getTypeFromName(this.props.file.name);

    // If it's a TGA file, convert to PNG
    if (fileType === "tga" && this.props.file.content instanceof Uint8Array) {
      try {
        // Use ImageCodec for cross-platform TGA to PNG conversion
        const pngDataUrl = await ImageCodec.tgaToPngDataUrl(this.props.file.content);
        if (pngDataUrl) {
          this.setState({ convertedImageUrl: pngDataUrl });
        } else {
          Log.debug("[ImageManager] Failed to convert TGA to PNG");
        }
      } catch (error) {
        Log.debug("[ImageManager] Failed to decode TGA: " + error);
        // Fall back to showing nothing or a placeholder
      }
    } else {
      // Not a TGA, use standard image string
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

    // For TGA files, return empty - the converted URL will be used instead
    const fileType = StorageUtilities.getTypeFromName(this.props.file.name);
    if (fileType === "tga") {
      return ""; // Will be handled by _ensureImageReady
    }

    if (this.props.file.content instanceof Uint8Array) {
      let str = "data:image/";
      str += fileType;
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
          <IconButton onClick={this._toggleEdit} size="small" title={this.props.intl.formatMessage({ id: "project_editor.image_mgr.edit_image" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.image_mgr.edit_image" })}>
            <FontAwesomeIcon icon={faEdit} className="fa-lg" />
          </IconButton>
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
        interior = <div>({this.props.intl.formatMessage({ id: "project_editor.image_mgr.no_content" })})</div>;
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

export default withLocalization(ImageManager);
