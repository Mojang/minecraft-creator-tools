import { Component, SyntheticEvent } from "react";
import IFile from "./../storage/IFile";
import "./TextEditor.css";
import IPersistable from "./IPersistable";
import Carto from "../app/Carto";
import { FormInput, InputProps, TextArea, TextAreaProps, ThemeInput, Toolbar } from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearchPlus, faSearchMinus, faPlay } from "@fortawesome/free-solid-svg-icons";
import Project from "../app/Project";
import CommandRunner from "../app/CommandRunner";

interface ITextEditorProps {
  file?: IFile;
  theme: ThemeInput<any>;
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
  carto: Carto;
  onUpdatePreferredTextSize: (newSize: number) => void;
  onUpdateContent?: (newContent: string) => void;
  onCommit?: (newContent: string) => void;
}

interface ITextEditorState {
  fileToEdit?: IFile;
  content?: string;
  initialContent?: string;
}

export default class TextEditor extends Component<ITextEditorProps, ITextEditorState> implements IPersistable {
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

  async persist() {}

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

    await CommandRunner.runCommandText(this.props.carto, this.state.content);
  }

  _updateZoom() {
    /*    if (this.editor === undefined) {
      return;
    }

    if (val !== undefined) {
      this.props.onUpdatePreferredTextSize(Math.round(val));
    }*/
  }

  _handleTextAreaChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: TextAreaProps | undefined
  ) {
    if (event === null || data === null || data === undefined) {
      return;
    }

    if (this.props.onUpdateContent !== undefined && data.value) {
      this.props.onUpdateContent(data.value);
    }

    if (this.state && this.state.fileToEdit && data.value) {
      this.state.fileToEdit.setContent(data.value);
    } else if (this.state && this.state.content !== undefined && data.value !== undefined) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        content: data.value,
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

  _handleTextInputChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: InputProps | undefined
  ) {
    if (event === null || data === null || data === undefined || data.value === undefined) {
      return;
    }

    const dataStr = data.value.toString();

    if (this.props.onUpdateContent !== undefined) {
      this.props.onUpdateContent(dataStr);
    }

    if (this.state && this.state.fileToEdit && dataStr) {
      this.state.fileToEdit.setContent(dataStr);
    } else if (this.state && this.state.content !== undefined && dataStr) {
      this.setState({
        fileToEdit: this.state.fileToEdit,
        content: dataStr,
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

    const toolbarItems = [
      {
        icon: <FontAwesomeIcon icon={faSearchPlus} className="fa-lg" />,
        key: "zoomIn",
        onClick: this._zoomIn,
        title: "Toggle whether hidden items are shown",
      },
      {
        icon: <FontAwesomeIcon icon={faSearchMinus} className="fa-lg" />,
        key: "zoomOut",
        onClick: this._zoomOut,
        title: "Toggle whether hidden items are shown",
      },
    ];

    if (this.props.runCommandButton) {
      toolbarItems.push({
        icon: <FontAwesomeIcon icon={faPlay} className="fa-lg" />,
        key: "run",
        onClick: this._sendFunction,
        title: "Send this function over to Minecraft",
      });
    }

    const accessoryToolbarItems = [];

    if (this.props.commitButton) {
      cols = "1fr 34px";
      accessoryToolbarItems.push({
        icon: <FontAwesomeIcon icon={faPlay} className="fa-lg" />,
        key: "run",
        onClick: this._commitContent,
        title: "Send this function over to Minecraft",
      });

      accessoryToolbar = (
        <div className="texed-bottomToolBarArea">
          <Toolbar aria-label="Editor toolbar overflow menu" items={accessoryToolbarItems} />
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
            <FormInput
              fluid={true}
              style={{
                height: editorHeight,
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
              }}
              key="forminput"
              id="forminput"
              className="texed-text"
              placeholder={this.props.placeholder}
              defaultValue={content as string}
              value={content as string}
              onKeyPress={this._handleInputKey}
              spellCheck={this.props.spellCheck}
              onChange={this._handleTextInputChange}
            />
          );
        } else {
          interior = (
            <TextArea
              fluid={true}
              style={{
                height: editorHeight,
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
              }}
              key="textarea"
              id="textarea"
              className="texed-text"
              placeholder={this.props.placeholder}
              defaultValue={content as string}
              value={content as string}
              spellCheck={this.props.spellCheck}
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
            <Toolbar aria-label="Editor toolbar overflow menu" items={toolbarItems} />
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
