import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import "./MinecraftToolEditor.css";
import { CartoMinecraftState } from "../app/Carto";
import { Dropdown, DropdownProps, Input, InputProps, ThemeInput } from "@fluentui/react-northstar";
import FunctionEditor from "./FunctionEditor";
import IPersistable from "./IPersistable";
import IMinecraft from "../app/IMinecraft";
import Utilities from "../core/Utilities";
import CartoApp, { HostType } from "../app/CartoApp";
import TextEditor from "./TextEditor";
import { CustomToolType } from "../app/ICustomTool";
import JavaScriptEditor, { ScriptEditorRole } from "./JavaScriptEditor";
import { ProjectScriptLanguage } from "../app/IProjectData";
import Project from "../app/Project";

interface IMinecraftToolEditorProps extends IAppProps {
  heightOffset: number;
  project?: Project;
  theme: ThemeInput<any>;
  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IMinecraftToolEditorState {
  activeCommandIndex: number;
  toolName: string;
}

export default class MinecraftToolEditor
  extends Component<IMinecraftToolEditorProps, IMinecraftToolEditorState>
  implements IPersistable
{
  private _activeEditorPersistable?: IPersistable;
  private _commandValues: string[] = [];

  constructor(props: IMinecraftToolEditorProps) {
    super(props);

    this._update = this._update.bind(this);

    this._updateToolContent = this._updateToolContent.bind(this);
    this._simulateConnection = this._simulateConnection.bind(this);
    this.persist = this.persist.bind(this);
    this._handleNewChildPersistable = this._handleNewChildPersistable.bind(this);
    this._handleCommandChange = this._handleCommandChange.bind(this);
    this._handleCommandTypeChange = this._handleCommandTypeChange.bind(this);
    this._connectionStateChanged = this._connectionStateChanged.bind(this);
    this._handleToolNameUpdate = this._handleToolNameUpdate.bind(this);

    this._connectToProps();

    this.state = {
      activeCommandIndex: 0,
      toolName: this.getNameForTool(0),
    };
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist() {
    if (this._activeEditorPersistable !== undefined) {
      await this._activeEditorPersistable.persist();
    }
  }

  _connectionStateChanged(minecraft: IMinecraft, connectionState: CartoMinecraftState) {
    this.forceUpdate();
  }

  componentDidUpdate(prevProps: IMinecraftToolEditorProps, prevState: IMinecraftToolEditorState) {
    if (prevProps !== undefined && prevProps.carto !== undefined) {
      prevProps.carto.onMinecraftStateChanged.unsubscribe(this._connectionStateChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.carto !== undefined) {
      this.props.carto.onMinecraftStateChanged.subscribe(this._connectionStateChanged);
    }
  }

  _update() {
    this.forceUpdate();
  }

  _simulateConnection() {
    //   this.props.carto.notifyWebSocketStateChanged(CartoWebSocketState.connected);
  }

  _updateToolContent(newFunction: string) {
    const command = this.props.carto.getCustomTool(this.state.activeCommandIndex);

    command.text = newFunction;
  }

  _updatePreferredTextSize(newTextSize: number) {
    this.props.carto.preferredTextSize = newTextSize;
  }

  async _handleCommandChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    await this.persist();

    for (let i = 0; i < this._commandValues.length; i++) {
      if (this._commandValues[i] === data.value) {
        this.setState({
          activeCommandIndex: i,
          toolName: this.getNameForTool(i),
        });

        return;
      }
    }
  }

  async _handleCommandTypeChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    const customTool = this.props.carto.getCustomTool(this.state.activeCommandIndex);

    if (data.value === "Script") {
      customTool.type = CustomToolType.script;
    } else {
      customTool.type = CustomToolType.function;
    }
    await this.persist();

    this.forceUpdate();
  }

  _handleToolNameUpdate(e: SyntheticEvent, data: (InputProps & { value: string }) | undefined) {
    if (data === undefined || this.state == null) {
      return;
    }

    const customTool = this.props.carto.getCustomTool(this.state.activeCommandIndex);

    customTool.name = data.value;

    this.persist();

    this.setState({
      activeCommandIndex: this.state.activeCommandIndex,
      toolName: data.value,
    });
  }

  getNameForTool(index: number) {
    const customTool = this.props.carto.getCustomTool(index);

    let name = "Tool " + (index + 1);

    if (customTool.name) {
      name = customTool.name;
    }

    return name;
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }

    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    let content = "";

    const command = this.props.carto.getCustomTool(this.state.activeCommandIndex);

    if (command.text) {
      content = command.text;
    }

    this._commandValues = [];

    for (let i = 0; i < 9; i++) {
      const name = this.getNameForTool(i);

      this._commandValues.push(name);
    }

    let interior = <></>;
    const customTool = this.props.carto.getCustomTool(this.state.activeCommandIndex);

    if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
      interior = (
        <TextEditor
          theme={this.props.theme}
          onUpdatePreferredTextSize={this._updatePreferredTextSize}
          preferredTextSize={this.props.carto.preferredTextSize}
          readOnly={false}
          carto={this.props.carto}
          initialContent={content}
        />
      );
    } else if (customTool.type === CustomToolType.script) {
      interior = (
        <JavaScriptEditor
          theme={this.props.theme}
          carto={this.props.carto}
          initialContent={content}
          onUpdateContent={this._updateToolContent}
          readOnly={false}
          scriptLanguage={ProjectScriptLanguage.typeScript}
          role={ScriptEditorRole.script}
          preferredTextSize={this.props.carto.preferredTextSize}
          setActivePersistable={this._handleNewChildPersistable}
          onUpdatePreferredTextSize={this._updatePreferredTextSize}
          heightOffset={this.props.heightOffset + 240}
        />
      );
    } else {
      interior = (
        <FunctionEditor
          theme={this.props.theme}
          initialContent={content}
          project={this.props.project}
          isCommandEditor={false}
          roleId={"toolEditor"}
          onUpdateContent={this._updateToolContent}
          readOnly={false}
          carto={this.props.carto}
          preferredTextSize={this.props.carto.preferredTextSize}
          setActivePersistable={this._handleNewChildPersistable}
          onUpdatePreferredTextSize={this._updatePreferredTextSize}
          heightOffset={this.props.heightOffset + 240}
        />
      );
    }
    const toolType = customTool.type === CustomToolType.function ? "Commands" : "Script";

    return (
      <div className="mts-outer">
        <div className="mts-toolArea">
          <div className="mts-toolPicker">
            <Dropdown
              items={this._commandValues}
              placeholder="Select a command"
              defaultValue={this.state.toolName}
              value={this.state.toolName}
              onChange={this._handleCommandChange}
            />
          </div>
          <div className="mts-toolName">
            <span className="mts-label">Name:</span>
            <Input
              clearable
              placeholder={this.getNameForTool(this.state.activeCommandIndex)}
              value={this.state.toolName}
              onChange={this._handleToolNameUpdate}
            />
          </div>
          <div className="mts-typeLabel">Type:</div>
          <div className="mts-toolType">
            <Dropdown
              items={["Commands", "Script"]}
              defaultValue={toolType}
              value={toolType}
              onChange={this._handleCommandTypeChange}
            />
          </div>
          <div className="mts-interior">{interior}</div>
        </div>
      </div>
    );
  }
}
