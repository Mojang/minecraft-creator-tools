import { Component, SyntheticEvent } from "react";
import IAppProps from "./IAppProps";
import "./MinecraftToolEditor.css";
import { CreatorToolsMinecraftState } from "../app/CreatorTools";
import { Dropdown, DropdownProps, Input, InputProps, ThemeInput, Toolbar } from "@fluentui/react-northstar";
import FunctionEditor from "./FunctionEditor";
import IPersistable from "./IPersistable";
import IMinecraft from "../app/IMinecraft";
import Utilities from "../core/Utilities";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import TextEditor from "./TextEditor";
import { CustomToolType } from "../app/ICustomTool";
import JavaScriptEditor, { ScriptEditorRole } from "./JavaScriptEditor";
import { ProjectScriptLanguage } from "../app/IProjectData";
import Project from "../app/Project";
import LogItemArea from "./LogItemArea";
import { ProjectStatusAreaMode } from "./ProjectEditor";
import { StatusTopic } from "../app/Status";

interface IMinecraftToolEditorProps extends IAppProps {
  heightOffset: number;
  project?: Project;
  theme: ThemeInput<any>;
  widthOffset: number;

  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IMinecraftToolEditorState {
  activeCommandIndex: number;
  toolName: string;
  minecraftStatus: ProjectStatusAreaMode;
}

export default class MinecraftToolEditor extends Component<IMinecraftToolEditorProps, IMinecraftToolEditorState> {
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
    this._statusExpandedSizeChanged = this._statusExpandedSizeChanged.bind(this);

    this._connectToProps();

    this.state = {
      activeCommandIndex: 0,
      toolName: this.getNameForTool(0),
      minecraftStatus: ProjectStatusAreaMode.minimized,
    };
  }

  _handleNewChildPersistable(newPersistable: IPersistable) {
    this._activeEditorPersistable = newPersistable;
  }

  async persist(): Promise<boolean> {
    if (this._activeEditorPersistable !== undefined) {
      return await this._activeEditorPersistable.persist();
    }

    return false;
  }

  _connectionStateChanged(minecraft: IMinecraft, connectionState: CreatorToolsMinecraftState) {
    this.forceUpdate();
  }

  componentDidUpdate(prevProps: IMinecraftToolEditorProps, prevState: IMinecraftToolEditorState) {
    if (prevProps !== undefined && prevProps.creatorTools !== undefined) {
      prevProps.creatorTools.onMinecraftStateChanged.unsubscribe(this._connectionStateChanged);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.creatorTools !== undefined) {
      this.props.creatorTools.onMinecraftStateChanged.subscribe(this._connectionStateChanged);
    }
  }

  _update() {
    this.forceUpdate();
  }

  _simulateConnection() {
    //   this.props.carto.notifyWebSocketStateChanged(CartoWebSocketState.connected);
  }

  _updateToolContent(newFunction: string) {
    const command = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

    command.text = newFunction;
  }

  _updatePreferredTextSize(newTextSize: number) {
    this.props.creatorTools.preferredTextSize = newTextSize;
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
    const customTool = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

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

    const customTool = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

    customTool.name = data.value;

    this.props.creatorTools.save();

    this.persist();

    this.setState({
      activeCommandIndex: this.state.activeCommandIndex,
      toolName: data.value,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _statusExpandedSizeChanged(newMode: ProjectStatusAreaMode) {
    this.setState({
      activeCommandIndex: this.state.activeCommandIndex,
      toolName: this.state.toolName,
      minecraftStatus: newMode,
    });
  }

  getNameForTool(index: number) {
    const customTool = this.props.creatorTools.getCustomTool(index);

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

    const command = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

    if (command.text) {
      content = command.text;
    }

    this._commandValues = [];

    for (let i = 0; i < 9; i++) {
      const name = "Ctrl-" + (i + 1).toString() + ": " + this.getNameForTool(i);

      this._commandValues.push(name);
    }

    let interior = <></>;
    const customTool = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

    if (Utilities.isDebug && CreatorToolsHost.hostType === HostType.electronWeb) {
      interior = (
        <TextEditor
          theme={this.props.theme}
          onUpdatePreferredTextSize={this._updatePreferredTextSize}
          preferredTextSize={this.props.creatorTools.preferredTextSize}
          readOnly={false}
          project={this.props.project}
          runCommandButton={true}
          onUpdateContent={this._updateToolContent}
          creatorTools={this.props.creatorTools}
          initialContent={content}
        />
      );
    } else if (customTool.type === CustomToolType.script) {
      interior = (
        <JavaScriptEditor
          theme={this.props.theme}
          creatorTools={this.props.creatorTools}
          initialContent={content}
          onUpdateContent={this._updateToolContent}
          readOnly={false}
          scriptLanguage={ProjectScriptLanguage.typeScript}
          role={ScriptEditorRole.script}
          preferredTextSize={this.props.creatorTools.preferredTextSize}
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
          isCommandEditor={true}
          roleId={"toolEditor"}
          onUpdateContent={this._updateToolContent}
          readOnly={false}
          creatorTools={this.props.creatorTools}
          preferredTextSize={this.props.creatorTools.preferredTextSize}
          setActivePersistable={this._handleNewChildPersistable}
          onUpdatePreferredTextSize={this._updatePreferredTextSize}
          heightOffset={this.props.heightOffset + 240}
        />
      );
    }
    const toolType = customTool.type === CustomToolType.function ? "Commands" : "Script";
    const toolbarItems: any[] = [];
    return (
      <div className="mts-outer">
        <div className="mts-toolArea">
          <div className="cose-componentToolBarArea">
            <Toolbar aria-label="Minecraft tool actions" items={toolbarItems} />
          </div>
          <div className="mts-toolPicker">
            <Dropdown
              items={this._commandValues}
              placeholder="Select a command"
              defaultValue={this.state.toolName}
              value={"Ctrl-" + (this.state.activeCommandIndex + 1).toString() + ": " + this.state.toolName}
              onChange={this._handleCommandChange}
            />
          </div>
          <div className="mts-toolName">
            <span className="mts-label" id="mts-toolNameLabel">
              Name:
            </span>
            <Input
              clearable
              aria-labelledby="mts-toolNameLabel"
              placeholder={
                "Ctrl-" +
                (this.state.activeCommandIndex + 1).toString() +
                ": " +
                this.getNameForTool(this.state.activeCommandIndex)
              }
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
          <div className="mts-logArea">
            <LogItemArea
              creatorTools={this.props.creatorTools}
              onSetExpandedSize={this._statusExpandedSizeChanged}
              filterTopics={[StatusTopic.minecraft]}
              mode={this.state.minecraftStatus}
              widthOffset={this.props.widthOffset}
            />
          </div>
        </div>
      </div>
    );
  }
}
