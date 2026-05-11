import { Component } from "react";
import IFile from "../../storage/IFile";
import "./TextEditor.css";
import IPersistable from "../types/IPersistable";
import CreatorTools from "../../app/CreatorTools";
import { Stack, IconButton, TextField } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus, faPlay } from "@fortawesome/free-solid-svg-icons";
import Project from "../../app/Project";
import CommandRunner from "../../app/CommandRunner";
import { mcColors } from "../hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface ITextEditorProps extends WithLocalizationProps {
  file?: IFile;
  theme: IProjectTheme;
  placeholder?: string;
  spellCheck?: boolean;
  commitButton?: boolean;
  runCommandButton?: boolean;
  initialContent?: string;
  singleLineMode?: boolean;
  fixedHeight?: number;
  project?: Project;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  readOnly: boolean;
  preferredTextSize: number;
  creatorTools: CreatorTools;
  onUpdatePreferredTextSize: (newSize: number) => void;
  onUpdateContent?: (newContent: string) => void;
  onCommit?: (newContent: string) => void;
}

interface ITextEditorState {
  fileToEdit?: IFile;
  content?: string;
  initialContent?: string;
}

class TextEditor extends Component<ITextEditorProps, ITextEditorState> {
  constructor(props: ITextEditorProps) {
    super(props);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._zoomIn = this._zoomIn.bind(this);
    this._zoomOut = this._zoomOut.bind(this);
    this._sendFunction = this._sendFunction.bind(this);

    this._handleTextAreaChange = this._handleTextAreaChange.bind(this);
    this._handleTextInputChange = this._handleTextInputChange.bind(this);
    this._handleInputKey = this._handleInputKey.bind(this);

    this._commitContent = this._commitContent.bind(this);

    this.state = {
      fileToEdit: props.file,
      content: this.props.initialContent,
      initialContent: this.props.initialContent,
    };
  }

  static getDerivedStateFromProps(props: ITextEditorProps, state: ITextEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
      };

      return state;
    }

    if (props.initialContent !== state.initialContent && props.initialContent !== undefined) {
      state.content = props.initialContent;
      state.initialContent = props.initialContent;

      return state;
    }

    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      return state;
    }

    return null; // No change to state
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {}

  async persist(): Promise<boolean> {
    return false;
  }

  _zoomIn() {
    this._updateZoom();
  }

  _zoomOut() {
    this._updateZoom();
  }

  async _sendFunction() {
    if (!this.state.content) {
      return;
    }

    await CommandRunner.runCommandText(this.props.creatorTools, this.state.content);
  }

  _updateZoom() {
    /*    if (this.editor === undefined) {
      return;
    }

    if (val !== undefined) {
      this.props.onUpdatePreferredTextSize(Math.round(val));
    }*/
  }

  _handleTextAreaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;

    if (this.props.onUpdateContent !== undefined && value) {
      this.props.onUpdateContent(value);
    }

    if (this.state && this.state.fileToEdit && value) {
      this.state.fileToEdit.setContent(value);
    } else if (this.state && this.state.content !== undefined && value !== undefined) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        content: value,
        initialContent: this.state.initialContent,
      });
      return;
    }

    this.forceUpdate();
  }

  _handleInputKey(event: React.KeyboardEvent<Element>) {
    if (event.key === "Enter" && this.props.singleLineMode === true) {
      this._commitContent();
    } else if (event.ctrlKey === true && event.key === "Enter") {
      this._commitContent();
    }
  }

  _handleTextInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;

    if (this.props.onUpdateContent !== undefined) {
      this.props.onUpdateContent(value);
    }

    if (this.state && this.state.fileToEdit && value) {
      this.state.fileToEdit.setContent(value);
    } else if (this.state && this.state.content !== undefined && value) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        content: value,
        initialContent: this.state.initialContent,
      });
      return;
    }

    this.forceUpdate();
  }

  async _commitContent() {
    if (this.props.onCommit && this.state && this.state.content !== undefined) {
      this.props.onCommit(this.state.content);

      this.setState({
        fileToEdit: this.state.fileToEdit,
        content: this.props.singleLineMode === true ? "" : this.state.content,
      });
    }
  }

  render() {
    let interior = <></>;
    let toolbar = <></>;
    let accessoryToolbar = <></>;
    const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

    let height = "106px";
    let editorHeight = "106px";

    if (this.props.fixedHeight) {
      height = this.props.fixedHeight + "px";
      editorHeight = this.props.fixedHeight - 40 + "px";
    } else if (this.props.singleLineMode) {
      height = "32px";
      editorHeight = "32px";
    } else if (this.props.heightOffset) {
      height = "calc(100vh - " + this.props.heightOffset + "px)";
      editorHeight = "calc(100vh - " + (this.props.heightOffset + 6) + "px)";
    }

    let cols = "1f 0px";

    if (this.props.commitButton) {
      cols = "1fr 34px";

      accessoryToolbar = (
        <div className="texed-bottomToolBarArea">
          <Stack direction="row" spacing={1} aria-label={this.props.intl.formatMessage({ id: "project_editor.text_ed.toolbar_aria" })}>
            <IconButton onClick={this._commitContent} title={this.props.intl.formatMessage({ id: "project_editor.text_ed.send_title" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.text_ed.send_aria" })} size="small">
              <FontAwesomeIcon icon={faPlay} className="fa-lg" />
            </IconButton>
          </Stack>
        </div>
      );
    }

    if (this.state !== null) {
      let content = this.state.content;

      if (content === undefined) {
        content = this.props.initialContent;
      }

      if (
        content === undefined &&
        this.state.fileToEdit !== undefined &&
        typeof this.state.fileToEdit.content === "string"
      ) {
        content = this.state.fileToEdit.content as string;
      }

      if (content !== undefined) {
        if (this.props.setActivePersistable !== undefined) {
          this.props.setActivePersistable(this);
        }

        if (this.props.singleLineMode) {
          interior = (
            <TextField
              fullWidth
              size="small"
              sx={{
                height: editorHeight,
                backgroundColor: isDark ? mcColors.gray4 : mcColors.gray5,
              }}
              key="forminput"
              id="forminput"
              className="texed-text"
              placeholder={this.props.placeholder}
              value={content as string}
              onKeyPress={this._handleInputKey}
              inputProps={{ spellCheck: this.props.spellCheck }}
              onChange={this._handleTextInputChange}
            />
          );
        } else {
          interior = (
            <TextField
              fullWidth
              multiline
              sx={{
                height: editorHeight,
                backgroundColor: isDark ? mcColors.gray4 : mcColors.gray5,
              }}
              key="textarea"
              id="textarea"
              className="texed-text"
              placeholder={this.props.placeholder}
              value={content as string}
              inputProps={{ spellCheck: this.props.spellCheck }}
              onChange={this._handleTextAreaChange}
            />
          );
        }
      }
    }

    if (!this.props.singleLineMode) {
      toolbar = (
        <div className="texed-toolBarArea">
          <div className="texed-title">&#160;</div>
          <div className="texed-toolbar">
            <Stack direction="row" spacing={1} aria-label={this.props.intl.formatMessage({ id: "project_editor.text_ed.toolbar_aria" })}>
              <IconButton onClick={this._zoomIn} title={this.props.intl.formatMessage({ id: "project_editor.text_ed.zoom_in_title" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.text_ed.zoom_in_aria" })} size="small">
                <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />
              </IconButton>
              <IconButton onClick={this._zoomOut} title={this.props.intl.formatMessage({ id: "project_editor.text_ed.zoom_out_title" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.text_ed.zoom_out_aria" })} size="small">
                <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />
              </IconButton>
              {this.props.runCommandButton && (
                <IconButton onClick={this._sendFunction} title={this.props.intl.formatMessage({ id: "project_editor.text_ed.send_title" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.text_ed.send_aria" })} size="small">
                  <FontAwesomeIcon icon={faPlay} className="fa-lg" />
                </IconButton>
              )}
            </Stack>
          </div>
        </div>
      );
    }

    return (
      <div
        className="texed-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {toolbar}
        <div className="texed-input-area" style={{ gridTemplateColumns: cols }}>
          <div className="texed-input">{interior}</div>
          <div className="texed-accessoryToolbar">{accessoryToolbar}</div>
        </div>
      </div>
    );
  }
}

export default withLocalization(TextEditor);
