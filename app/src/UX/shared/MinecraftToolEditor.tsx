import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import "./MinecraftToolEditor.css";
import { CreatorToolsMinecraftState } from "../../app/CreatorTools";
import {
  TextField,
  FormControl,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  SelectChangeEvent,
} from "@mui/material";
import { LazyFunctionEditor } from "../appShell/LazyComponents";
import IPersistable from "../types/IPersistable";
import IMinecraft from "../../app/IMinecraft";
import Utilities from "../../core/Utilities";
import CreatorToolsHost, { HostType } from "../../app/CreatorToolsHost";
import { LazyTextEditor } from "../appShell/LazyComponents";
import { CustomToolType } from "../../app/ICustomTool";
import { LazyJavaScriptEditor, ScriptEditorRole } from "../appShell/LazyComponents";
import { ProjectScriptLanguage } from "../../app/IProjectData";
import Project from "../../app/Project";
import LogItemArea from "../appShell/LogItemArea";
import { ProjectStatusAreaMode } from "../project/ProjectEditor";
import { StatusTopic } from "../../app/Status";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

interface IMinecraftToolEditorProps extends IAppProps, WithLocalizationProps {
  heightOffset: number;
  project?: Project;
  theme: IProjectTheme;
  widthOffset: number;

  setActivePersistable?: (persistObject: IPersistable) => void;
}

interface IMinecraftToolEditorState {
  activeCommandIndex: number;
  toolName: string;
  minecraftStatus: ProjectStatusAreaMode;
}

class MinecraftToolEditor extends Component<IMinecraftToolEditorProps, IMinecraftToolEditorState> {
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

    this.props.creatorTools.save();
  }

  _updatePreferredTextSize = (newTextSize: number) => {
    this.props.creatorTools.preferredTextSize = newTextSize;
  };

  async _handleCommandChange(event: SelectChangeEvent<string>) {
    await this.persist();

    const value = event.target.value;
    for (let i = 0; i < this._commandValues.length; i++) {
      if (this._commandValues[i] === value) {
        this.setState({
          activeCommandIndex: i,
          toolName: this.getNameForTool(i),
        });

        return;
      }
    }
  }

  async _handleCommandTypeChange(_event: React.MouseEvent<HTMLElement>, newValue: string | null) {
    if (newValue === null) {
      return; // Don't allow deselecting both
    }

    const customTool = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

    if (newValue === "Script") {
      customTool.type = CustomToolType.script;
    } else {
      customTool.type = CustomToolType.function;
    }

    await this.persist();

    this.forceUpdate();
  }

  _handleToolNameUpdate(e: React.ChangeEvent<HTMLInputElement>) {
    if (this.state == null) {
      return;
    }

    const value = e.target.value;
    const customTool = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

    customTool.name = value;

    this.props.creatorTools.save();

    this.persist();

    this.setState({
      activeCommandIndex: this.state.activeCommandIndex,
      toolName: value,
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

    let name = this.props.intl.formatMessage({ id: "project_editor.mc_tool.default_name" }) + (index + 1);

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
      const name = this.props.intl.formatMessage({ id: "project_editor.mc_tool.ctrl_prefix" }) + (i + 1).toString() + ": " + this.getNameForTool(i);

      this._commandValues.push(name);
    }

    let interior = <></>;
    const customTool = this.props.creatorTools.getCustomTool(this.state.activeCommandIndex);

    if (Utilities.isDebug && CreatorToolsHost.hostType === HostType.electronWeb) {
      interior = (
        <LazyTextEditor
          theme={this.props.theme}
          onUpdatePreferredTextSize={this._updatePreferredTextSize}
          preferredTextSize={this.props.creatorTools.preferredTextSize}
          readOnly={false}
          project={this.props.project}
          runCommandButton={true}
          onUpdateContent={this._updateToolContent}
          creatorTools={this.props.creatorTools}
          initialContent={content}
          content={content}
        />
      );
    } else if (customTool.type === CustomToolType.script) {
      interior = (
        <LazyJavaScriptEditor
          theme={this.props.theme}
          creatorTools={this.props.creatorTools}
          initialContent={content}
          content={content}
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
        <LazyFunctionEditor
          theme={this.props.theme}
          initialContent={content}
          content={content}
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
    return (
      <div className="mts-outer">
        <div className="mts-toolBar">
          <div className="mts-toolPicker">
            <FormControl size="small" fullWidth>
              <Select
                value={"Ctrl-" + (this.state.activeCommandIndex + 1).toString() + ": " + this.state.toolName}
                onChange={this._handleCommandChange}
                displayEmpty
              >
                {this._commandValues.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <div className="mts-toolName">
            <span className="mts-label" id="mts-toolNameLabel">
              {this.props.intl.formatMessage({ id: "project_editor.mc_tool.name_label" })}
            </span>
            <TextField
              size="small"
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
          <div className="mts-toolType">
            <ToggleButtonGroup
              value={toolType}
              exclusive
              onChange={this._handleCommandTypeChange}
              size="small"
              aria-label={this.props.intl.formatMessage({ id: "project_editor.mc_tool.type_aria" })}
            >
              <ToggleButton value="Commands" title={this.props.intl.formatMessage({ id: "project_editor.mc_tool.type_commands" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.mc_tool.type_commands" })}>
                <span className="mts-typeIcon">/say</span>
              </ToggleButton>
              <ToggleButton value="Script" title={this.props.intl.formatMessage({ id: "project_editor.mc_tool.type_script" })} aria-label={this.props.intl.formatMessage({ id: "project_editor.mc_tool.type_script" })}>
                <span className="mts-typeIcon">&#123; &#125;</span>
              </ToggleButton>
            </ToggleButtonGroup>
          </div>
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
    );
  }
}

export default withLocalization(MinecraftToolEditor);
