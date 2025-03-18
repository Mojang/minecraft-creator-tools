import React, { Component, SyntheticEvent } from "react";
import "./SearchCommandEditor.css";
import Carto from "../app/Carto";
import {
  FormInput,
  InputProps,
  List,
  ListProps,
  ThemeInput,
  Toolbar,
  selectableListBehavior,
} from "@fluentui/react-northstar";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import Project from "../app/Project";
import CommandRunner from "../app/CommandRunner";
import { IContentIndex } from "../core/ContentIndex";
import { IAnnotatedValue } from "../core/AnnotatedValue";
import { ProjectEditorAction } from "./ProjectEditorUtilities";

interface ISearchCommandEditorProps {
  theme: ThemeInput<any>;
  placeholder?: string;
  commitButton?: boolean;
  runCommandButton?: boolean;
  initialContent?: string;
  fixedHeight?: number;
  contentIndex?: IContentIndex;
  project?: Project;
  heightOffset?: number;
  isLarge: boolean;
  carto: Carto;
  displayAbove: boolean;
  onUpdateContent?: (newContent: string) => void;
  onCommit?: (newContent: string) => void;
  onActionRequested?: (action: ProjectEditorAction) => void;
  onFilterTextChanged: (newFilterText: string | undefined) => void;
}

interface ISearchCommandEditorState {
  autoCompleteResults?: { [fullKey: string]: IAnnotatedValue[] | undefined } | undefined;
  content?: string;
  initialContent?: string;
  selectedAutoComplete?: number;
}

export default class SearchCommandEditor extends Component<ISearchCommandEditorProps, ISearchCommandEditorState> {
  inputArea: React.RefObject<HTMLDivElement>;
  #isRetrieving = false;

  constructor(props: ISearchCommandEditorProps) {
    super(props);

    this.inputArea = React.createRef();
    this._retrieveSuggestions = this._retrieveSuggestions.bind(this);
    this._handleAutoCompleteSelected = this._handleAutoCompleteSelected.bind(this);

    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleKeyUp = this._handleKeyUp.bind(this);

    this._handleContentUpdated = this._handleContentUpdated.bind(this);
    this._sendFunction = this._sendFunction.bind(this);

    this._handleTextInputChange = this._handleTextInputChange.bind(this);
    this._handleInputKey = this._handleInputKey.bind(this);
    this._handleInputDown = this._handleInputDown.bind(this);

    this._commitContent = this._commitContent.bind(this);

    this.state = {
      content: this.props.initialContent,
      initialContent: this.props.initialContent,
      autoCompleteResults: undefined,
    };
  }

  static getDerivedStateFromProps(props: ISearchCommandEditorProps, state: ISearchCommandEditorState) {
    if (state === undefined || state === null) {
      state = {};

      return state;
    }

    if (props.initialContent !== state.initialContent && props.initialContent !== undefined) {
      state.content = props.initialContent;
      state.initialContent = props.initialContent;

      return state;
    }

    return null; // No change to state
  }

  _handleContentUpdated(newValue: string | undefined, event: any) {}

  async _sendFunction() {
    if (!this.state.content) {
      return;
    }

    await CommandRunner.runCommandText(this.props.carto, this.state.content);
  }

  _handleInputDown(event: React.KeyboardEvent<Element>) {
    if (this.props.onActionRequested) {
      if (event.key === "ArrowUp") {
        this.props.onActionRequested(ProjectEditorAction.projectListUp);
        event.preventDefault();
      }

      if (event.key === "ArrowDown") {
        this.props.onActionRequested(ProjectEditorAction.projectListDown);
        event.preventDefault();
      }
    }
  }

  _handleInputKey(event: React.KeyboardEvent<Element>) {
    if (event.key === "Enter") {
      if (this.state.selectedAutoComplete !== undefined && this.state.autoCompleteResults) {
        const results = this.getResultsFromAutoCompleteResults();

        const text = results[this.state.selectedAutoComplete];

        this.setState({
          content: text,
          initialContent: this.state.initialContent,
          selectedAutoComplete: undefined,
          autoCompleteResults: undefined,
        });
      } else {
        const command = this.state.content;

        if (command && command.length > 4 && command.startsWith("/")) {
          this.props.carto.notifyStatusUpdate(command);

          this.props.carto.runCommand(command, this.props.project);
        }
      }
    }
  }

  _handleTextInputChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: InputProps | undefined
  ) {
    if (event === null || data === null || data === undefined || data.value === undefined) {
      return;
    }

    this._handleContentChange(data.value.toString(), false);
  }

  _handleContentChange(dataStr: string, clearAutoComplete: boolean) {
    if (this.props.onUpdateContent !== undefined) {
      this.props.onUpdateContent(dataStr);
    }

    if (this.props.onFilterTextChanged) {
      this.props.onFilterTextChanged(dataStr);
    }

    if (this.state && dataStr !== undefined) {
      this.setState({
        content: dataStr,
        initialContent: this.state.initialContent,
        selectedAutoComplete: clearAutoComplete ? undefined : this.state.selectedAutoComplete,
        autoCompleteResults: clearAutoComplete ? undefined : this.state.autoCompleteResults,
      });
    }

    if (
      !clearAutoComplete &&
      this.props.contentIndex &&
      dataStr.length >= this.props.contentIndex.startLength &&
      !this.#isRetrieving
    ) {
      this.#isRetrieving = true;
      window.setTimeout(this._retrieveSuggestions, 200);
    }
  }

  private async _retrieveSuggestions() {
    this.#isRetrieving = false;

    if (this.props.contentIndex === undefined || this.state.content === undefined) {
      return;
    }

    const results = await this.props.contentIndex.getDescendentStrings(this.state.content);

    this.setState({
      content: this.state.content,
      initialContent: this.state.initialContent,
      selectedAutoComplete: undefined,
      autoCompleteResults: results,
    });
  }

  private async _commitContent() {
    if (this.props.onCommit && this.state && this.state.content !== undefined) {
      this.props.onCommit(this.state.content);

      this.setState({
        content: "",
      });
    }
  }

  _handleAutoCompleteSelected(elt: any, event: ListProps | undefined) {
    if (event === undefined || event.selectedIndex === undefined || this.state == null) {
      return;
    }

    const results = [];

    for (const key in this.state.autoCompleteResults) {
      results.push(key);
    }

    const id = results[event.selectedIndex];

    if (id) {
      this._handleContentChange(id, true);
    }
  }

  getResultsFromAutoCompleteResults() {
    const results = [];
    for (const key in this.state.autoCompleteResults) {
      if (key !== this.state.content) {
        results.push(key);
      }
    }

    return results.sort();
  }

  _handleKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowUp") {
      if (this.props.onActionRequested) {
        this.props.onActionRequested(ProjectEditorAction.projectListUp);
      }
    } else if (event.key === "ArrowDown") {
      if (this.props.onActionRequested) {
        this.props.onActionRequested(ProjectEditorAction.projectListDown);
      }
    } else if (event.key === "Tab") {
      if (this.state.autoCompleteResults) {
        const results = this.getResultsFromAutoCompleteResults();

        if (results.length > 0) {
          let nextIndex = this.state.selectedAutoComplete;

          if (event.shiftKey) {
            if (nextIndex === undefined) {
              nextIndex = results.length - 1;
            } else {
              nextIndex--;

              if (nextIndex < 0) {
                nextIndex = undefined;
              }
            }
          } else {
            if (nextIndex === undefined) {
              nextIndex = 0;
            } else {
              nextIndex++;
              if (nextIndex >= results.length) {
                nextIndex = undefined;
              }
            }
          }

          this.setState({
            content: this.state.content,
            initialContent: this.state.initialContent,
            selectedAutoComplete: nextIndex,
            autoCompleteResults: this.state.autoCompleteResults,
          });
        }
      }
      //  this._handleSaveClick();

      event.preventDefault();
      return false;
    }
    return true;
  }

  _handleKeyUp(event: KeyboardEvent) {}

  componentDidMount() {
    if (typeof window !== "undefined") {
      //      window.addEventListener("keydown", this._handleKeyDown);
      //    window.addEventListener("keyup", this._handleKeyUp);
    }
  }

  componentWillUnmount() {
    if (typeof window !== "undefined") {
      //  window.removeEventListener("keydown", this._handleKeyDown);
      //      window.removeEventListener("keyup", this._handleKeyUp);
    }
  }

  render() {
    let interior = <></>;
    let toolbar = <></>;
    let accessoryToolbar = <></>;
    let floatBox = <></>;

    let height = "106px";
    let editorHeight = "106px";

    if (this.props.fixedHeight) {
      height = this.props.fixedHeight + "px";
      editorHeight = this.props.fixedHeight - 40 + "px";
    } else {
      height = "32px";
      editorHeight = "32px";
    }

    let cols = "1f 0px";

    const toolbarItems = [];

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
        <div className="sceed-bottomToolBarArea">
          <Toolbar aria-label="Search command editor toolbar" items={accessoryToolbarItems} />
        </div>
      );
    }

    if (this.state !== null) {
      let content = this.state.content;

      if (content === undefined) {
        content = this.props.initialContent;
      }

      if (
        content &&
        this.props.contentIndex &&
        content.length >= this.props.contentIndex.startLength &&
        this.state.autoCompleteResults
      ) {
        const results = this.getResultsFromAutoCompleteResults();

        if (results.length > 0) {
          let left = 10;
          let top = 10;

          if (this.inputArea && this.inputArea.current) {
            left = this.inputArea.current.offsetLeft;
            top = this.inputArea.current.offsetTop + this.inputArea.current.offsetHeight;

            if (this.state.content) {
              const c = document.createElement("canvas");
              const ctx = c.getContext("2d");
              if (ctx) {
                ctx.font = '18px source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace';
                const txtWidth = ctx.measureText(this.state.content).width;

                left = left + txtWidth;
              }
            }
          }

          const listItems = [];
          let itemIndex = 0;
          for (const result of results) {
            listItems.push({
              key: "scel" + itemIndex,
              content: (
                <div className="sceed-floatListItem" title={result}>
                  {result}
                </div>
              ),
            });
            itemIndex++;
          }

          if (this.props.displayAbove) {
            top = Math.max(0, top - (50 + Math.min(180, results.length * 36)));
          }

          floatBox = (
            <div
              className="sceed-floatBox"
              style={{
                left: left,
                top: top,
                backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
                color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
              }}
            >
              <div className="sceed-list">
                <List
                  selectable
                  items={listItems}
                  aria-label="List of suggestions"
                  accessibility={selectableListBehavior}
                  onSelectedIndexChange={this._handleAutoCompleteSelected}
                  selectedIndex={this.state.selectedAutoComplete}
                  defaultSelectedIndex={this.state.selectedAutoComplete}
                />
              </div>
            </div>
          );
        }
      }

      interior = (
        <FormInput
          autoComplete="off"
          fluid={true}
          style={{
            height: editorHeight,
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background6,
          }}
          key="sceed-forminput"
          id="sceed-forminput"
          className={this.props.isLarge ? "sceed-text-large" : "sceed-text"}
          autoFocus={true}
          label="Search:"
          placeholder={this.props.placeholder}
          defaultValue={content as string}
          value={content as string}
          onKeyPress={this._handleInputKey}
          onKeyDown={this._handleInputDown}
          onChange={this._handleTextInputChange}
        />
      );
    }

    return (
      <div
        className="sceed-area"
        style={{
          minHeight: height,
          maxHeight: height,
        }}
      >
        {toolbar}
        <div className="sceed-input-area" style={{ gridTemplateColumns: cols }}>
          <div className="sceed-input" ref={this.inputArea}>
            {interior}
          </div>
          <div className="sceed-accessoryToolbar">{accessoryToolbar}</div>
          {floatBox}
        </div>
      </div>
    );
  }
}
