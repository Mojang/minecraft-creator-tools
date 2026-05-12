import { Component } from "react";
import IAppProps from "../appShell/IAppProps";
import "./MinecraftDisplay.css";
import { CreatorToolsMinecraftState } from "../../app/CreatorTools";
import Project from "../../app/Project";
import MinecraftGameSettingsPanel from "./MinecraftGameSettingsPanel";
import ProjectTools from "../../app/ProjectTools";
import ToolTile, { TT_TILE_SMALL } from "../home/ToolTile";
import IMinecraft, { PrepareAndStartResultType } from "../../app/IMinecraft";
import RemoteMinecraft from "../../app/RemoteMinecraft";
import { DedicatedServerMode, MinecraftFlavor } from "../../app/ICreatorToolsData";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGear } from "@fortawesome/free-solid-svg-icons";
import FunctionEditor from "../codeEditors/FunctionEditor";
import RemoteServerSettingsPanel from "./RemoteServerSettingsPanel";
import { MinecraftPushWorldType } from "../../app/MinecraftPush";

import {
  DedicatedServerMinecraftLabel,
  ConnectModeLabel,
  PushToMinecraftLabel,
  RemoteMinecraftLabel,
  ServerInitializedLabel,
  ServerInitializingLabel,
  ServerRestartLabel,
  ServerStartingLabel,
  ServerStartLabel,
  ServerStopLabel,
  ServerStoppingLabel,
  ToolEditorLabel,
  WebSocketMinecraftLabel,
  WorldSettingsLabel,
} from "../shared/components/feedback/labels/Labels";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";
import { mcColors } from "../hooks/theme/mcColors";
import DedicatedServerSettingsPanel from "../home/DedicatedServerSettingsPanel";
import Log from "../../core/Log";
import WebUtilities from "../utils/WebUtilities";
import { ProjectStatusAreaMode } from "../project/ProjectEditor";
import LogItemArea from "../appShell/LogItemArea";
import IFolder from "../../storage/IFolder";
import WorldDisplay from "../world/WorldDisplay";

import MinecraftToolEditor from "../shared/MinecraftToolEditor";
import WorldManagerSettingsPanel from "./WorldManagerSettingsPanel";
import MinecraftDisplayWelcomePanel from "./MinecraftDisplayWelcomePanel";
import CommandRunner from "../../app/CommandRunner";
import InteractPanel from "./InteractPanel";
import IStatus, { StatusTopic } from "../../app/Status";
import DebugStatsPanel from "../appShell/DebugStatsPanel";
import HttpStorage from "../../storage/HttpStorage";
import ProcessHostedMinecraft from "../../clientapp/ProcessHostedProxyMinecraft";
import EulaAcceptancePanel from "../home/EulaAcceptancePanel";
import { RemoteServerAccessLevel } from "../../app/ICreatorToolsData";
import WorldSettingsArea from "./WorldSettingsArea";
import { IWorldSettings } from "../../minecraft/IWorldSettings";
import WorldsDialog from "./WorldsDialog";
import { faGlobe } from "@fortawesome/free-solid-svg-icons";
import MinecraftUtilities from "../../minecraft/MinecraftUtilities";
import IProjectTheme from "../types/IProjectTheme";
import { WithLocalizationProps, withLocalization } from "../withLocalization";

export enum MinecraftDisplayMode {
  activeMinecraft = 0,
  worldSettings = 1,
  interact = 2,
  info = 3,
  toolEditor = 4,
}

export enum SidebarTab {
  messages = 0,
  players = 1,
  stats = 2,
}

interface IMinecraftDisplayProps extends IAppProps, WithLocalizationProps {
  heightOffset: number;
  project?: Project;
  forceCompact?: boolean;
  isWebServer?: boolean;
  theme: IProjectTheme;
  widthOffset: number;
  ensureMinecraftOnLogin: boolean;
}

interface IMinecraftDisplayState {
  flavor?: MinecraftFlavor;
  mode: MinecraftDisplayMode;
  worldFolder?: IFolder;
  minecraftStatus: ProjectStatusAreaMode;
  showSlotSettingsDialog: boolean;
  showWorldsDialog: boolean;
  currentSlotWorldId?: string;
  sidebarTab: SidebarTab;
  commandInput: string;
  /** List of currently connected player names */
  connectedPlayers: string[];
}

class MinecraftDisplay extends Component<IMinecraftDisplayProps, IMinecraftDisplayState> {
  private _commandValues: string[] = [];
  private _isMountedInternal = false;

  private _getServerBaseUrl(): string {
    // Get the base URL from the current page location (e.g., "localhost" or "myserver.com")
    if (typeof window !== "undefined" && window.location) {
      return window.location.hostname;
    }
    return "localhost";
  }

  private _getSlotPort(slotIndex: number): number {
    // Slot 0 = 19132, Slot 1 = 19164, Slot 2 = 19196, etc. (32-port spacing)
    return MinecraftUtilities.getPortForSlot(slotIndex);
  }

  private _getSlotLabel(slotIndex: number): string {
    const baseUrl = this._getServerBaseUrl();
    const port = this._getSlotPort(slotIndex);
    return `${slotIndex}: ${baseUrl}:${port}`;
  }

  private _getSlots(): string[] {
    return [this._getSlotLabel(0), this._getSlotLabel(1)];
  }

  constructor(props: IMinecraftDisplayProps) {
    super(props);

    this._update = this._update.bind(this);
    this._connectionStateChanged = this._connectionStateChanged.bind(this);
    this._load = this._load.bind(this);
    this._updateDefaultFunction = this._updateDefaultFunction.bind(this);
    this._updatePreferredTextSize = this._updatePreferredTextSize.bind(this);
    this._deployToMinecraft = this._deployToMinecraft.bind(this);
    this._setDedicatedServerMode = this._setDedicatedServerMode.bind(this);
    this._setWebSocketMode = this._setWebSocketMode.bind(this);
    this._setWorldSettingsMode = this._setWorldSettingsMode.bind(this);
    this._setWelcomeMode = this._setWelcomeMode.bind(this);
    this._setRemoteMinecraftMode = this._setRemoteMinecraftMode.bind(this);
    this._startClick = this._startClick.bind(this);
    this._stopDedicatedServerClick = this._stopDedicatedServerClick.bind(this);
    this._statusExpandedSizeChanged = this._statusExpandedSizeChanged.bind(this);
    this._restartDedicatedServerClick = this._restartDedicatedServerClick.bind(this);
    this._handleWorldFolderReady = this._handleWorldFolderReady.bind(this);
    this._commitCommand = this._commitCommand.bind(this);
    this._setToolEditor = this._setToolEditor.bind(this);
    this._handlePanelSelected = this._handlePanelSelected.bind(this);
    this._setInteractMode = this._setInteractMode.bind(this);
    this._handleEulaAccepted = this._handleEulaAccepted.bind(this);
    this._handleSlotChanged = this._handleSlotChanged.bind(this);
    this._openSlotSettings = this._openSlotSettings.bind(this);
    this._closeSlotSettings = this._closeSlotSettings.bind(this);
    this._saveAndRestartServer = this._saveAndRestartServer.bind(this);
    this._handleWorldSettingsChanged = this._handleWorldSettingsChanged.bind(this);
    this._openWorldsDialog = this._openWorldsDialog.bind(this);
    this._closeWorldsDialog = this._closeWorldsDialog.bind(this);
    this._handleWorldsRestartRequired = this._handleWorldsRestartRequired.bind(this);
    this._handleSidebarTabChange = this._handleSidebarTabChange.bind(this);
    this._handleCommandInputChange = this._handleCommandInputChange.bind(this);
    this._handleCommandSubmit = this._handleCommandSubmit.bind(this);
    this._handleToolClick = this._handleToolClick.bind(this);
    this._handlePlayersChanged = this._handlePlayersChanged.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);

    this._connectToProps();

    // In the Electron app, default to hosting BDS locally.
    // This avoids showing the "Connect to Minecraft" mode selection and instead channels the
    // user directly to the dedicated server hosting experience.
    // Override if flavor is undefined, none, OR remote without an auth token (stale persisted state).
    let initialFlavor = props.creatorTools.lastActiveMinecraftFlavor;
    if (CreatorToolsHost.isAppServiceWeb) {
      if (
        initialFlavor === undefined ||
        initialFlavor === MinecraftFlavor.none ||
        (initialFlavor === MinecraftFlavor.remote && !props.creatorTools.remoteServerAuthToken)
      ) {
        initialFlavor = MinecraftFlavor.processHostedProxy;
        props.creatorTools.setMinecraftFlavor(MinecraftFlavor.processHostedProxy);
      }
    }

    this.state = {
      flavor: initialFlavor,
      mode: MinecraftDisplayMode.activeMinecraft,
      minecraftStatus: ProjectStatusAreaMode.expanded,
      showSlotSettingsDialog: false,
      showWorldsDialog: false,
      sidebarTab: SidebarTab.messages,
      commandInput: "",
      connectedPlayers: [],
    };
  }

  private async _startClick() {
    if (this.props.creatorTools.activeMinecraft === undefined) {
      let flavor = this.props.creatorTools.lastActiveMinecraftFlavor;

      if (!flavor) {
        // Use the platform-aware default (processHostedProxy for Electron, remote for web)
        flavor = this.props.creatorTools.defaultMinecraftFlavor;
      }

      if (!flavor) {
        flavor = MinecraftFlavor.processHostedProxy;
      }

      this.props.creatorTools.ensureMinecraft(flavor);
    }

    if (this.props.creatorTools.activeMinecraft === undefined) {
      Log.unexpectedUndefined("SC");
      return;
    }

    // Ensure we're subscribed to worldFolder events on the newly created minecraft instance
    if (!this.props.creatorTools.activeMinecraft.onWorldFolderReady.has(this._handleWorldFolderReady)) {
      this.props.creatorTools.activeMinecraft.onWorldFolderReady.subscribe(this._handleWorldFolderReady);
    }

    const result = await this.props.creatorTools.activeMinecraft.prepareAndStart({
      worldType: MinecraftPushWorldType.flat,
      project: this.props.project,
    });

    if (result.type === PrepareAndStartResultType.error) {
      if (result.errorMessage) {
        Log.debugAlert(result.errorMessage);
      }
      return;
    }

    if (this.props.creatorTools.activeMinecraft && this.props.creatorTools.activeMinecraft.worldFolder) {
      this.setState({
        flavor: this.props.creatorTools.lastActiveMinecraftFlavor,
        mode: MinecraftDisplayMode.activeMinecraft,
        worldFolder: this.props.creatorTools.activeMinecraft?.worldFolder,
        minecraftStatus: this.state.minecraftStatus,
      });
    }
  }

  private async _stopDedicatedServerClick() {
    if (this.props.creatorTools.activeMinecraft === undefined) {
      Log.unexpectedUndefined("SDSC");
      return;
    }

    this.props.creatorTools.activeMinecraft.stop();
  }

  private async _restartDedicatedServerClick() {
    const activeMinecraft = this.props.creatorTools.activeMinecraft;

    if (activeMinecraft && activeMinecraft instanceof RemoteMinecraft) {
      await (activeMinecraft as RemoteMinecraft).restart();
    }
  }

  _deployToMinecraft() {
    if (this.props && this.props.project) {
      this.props.creatorTools.prepareAndStartToMinecraft({
        worldType: MinecraftPushWorldType.flat,
        project: this.props.project,
      });
    }
  }

  _setDedicatedServerMode() {
    this.props.creatorTools.setMinecraftFlavor(MinecraftFlavor.processHostedProxy);
    this.props.creatorTools.save();

    this.setState({
      flavor: MinecraftFlavor.processHostedProxy,
      mode: MinecraftDisplayMode.activeMinecraft,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setWebSocketMode() {
    this.props.creatorTools.setMinecraftFlavor(MinecraftFlavor.minecraftGameProxy);
    this.props.creatorTools.save();

    this.setState({
      flavor: MinecraftFlavor.minecraftGameProxy,
      mode: MinecraftDisplayMode.activeMinecraft,
      worldFolder: this.props.creatorTools.activeMinecraft?.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setRemoteMinecraftMode() {
    this.props.creatorTools.setMinecraftFlavor(MinecraftFlavor.remote);
    this.props.creatorTools.save();

    this.setState({
      flavor: MinecraftFlavor.remote,
      mode: MinecraftDisplayMode.activeMinecraft,
      worldFolder: this.props.creatorTools.activeMinecraft?.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setWorldSettingsMode() {
    this.setState({
      flavor: this.state.flavor,
      mode: MinecraftDisplayMode.worldSettings,
      worldFolder: this.props.creatorTools.activeMinecraft?.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setInteractMode() {
    this.setState({
      flavor: this.state.flavor,
      mode: MinecraftDisplayMode.interact,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setWelcomeMode() {
    this.setState({
      flavor: this.state.flavor,
      mode: MinecraftDisplayMode.info,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setToolEditor() {
    this.setState({
      flavor: this.state.flavor,
      mode: MinecraftDisplayMode.toolEditor,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _handleEulaAccepted() {
    // Update the local state to reflect that EULA has been accepted
    this.props.creatorTools.remoteServerEulaAccepted = true;

    // Trigger a re-render to show the BDS features
    this.forceUpdate();
  }

  async _handleSlotChanged(event: SelectChangeEvent<string>) {
    const slots = this._getSlots();
    const selectedValue = event.target.value;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      if (slot === selectedValue && this.props.creatorTools.remoteServerPort !== i) {
        this.props.creatorTools.remoteServerPort = i;
        this.props.creatorTools.save();

        // When slot changes, we need to refresh the connection to the new slot
        // This will update the world folder and other slot-specific data
        if (this.props.creatorTools.remoteMinecraft) {
          // Reinitialize to connect to the new slot
          await this.props.creatorTools.remoteMinecraft.initialize();
        }

        // Force update to refresh the UI with new slot's data
        this.forceUpdate();
        break;
      }
    }
  }

  _openSlotSettings() {
    this.setState({
      showSlotSettingsDialog: true,
    });
  }

  _closeSlotSettings() {
    this.setState({
      showSlotSettingsDialog: false,
    });
  }

  async _saveAndRestartServer() {
    // Save the settings first
    await this.props.creatorTools.save();

    // Close the dialog
    this.setState({
      showSlotSettingsDialog: false,
    });

    // Stop and restart the server
    const mc = this.props.creatorTools.activeMinecraft;
    if (mc) {
      // Stop the current server
      await mc.stop();

      // Start it again with the updated settings
      await mc.prepareAndStart({
        worldType: MinecraftPushWorldType.flat,
        project: this.props.project,
      });
    }
  }

  _handleWorldSettingsChanged(worldSettings: IWorldSettings) {
    // Settings are automatically saved via CreatorTools
    this.props.creatorTools.save();
  }

  _openWorldsDialog() {
    this.setState({
      showWorldsDialog: true,
    });
  }

  _closeWorldsDialog() {
    this.setState({
      showWorldsDialog: false,
    });
  }

  async _handleWorldsRestartRequired(): Promise<void> {
    // Restart the server after a world restore
    const mc = this.props.creatorTools.activeMinecraft;
    if (mc) {
      await mc.stop();
      await mc.prepareAndStart({
        worldType: MinecraftPushWorldType.flat,
        project: this.props.project,
      });
    }
  }

  _handleSidebarTabChange(tab: SidebarTab) {
    this.setState({
      sidebarTab: tab,
    });
  }

  _handleCommandInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({
      commandInput: event.target.value,
    });
  }

  async _handleCommandSubmit() {
    const command = this.state.commandInput.trim();
    if (command.length > 0) {
      await this._commitCommand(command.startsWith("/") ? command : "/" + command);
      this.setState({
        commandInput: "",
      });
    }
  }

  _handleKeyDown(event: KeyboardEvent) {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    // Map Ctrl+1 through Ctrl+9 to tool indices 0-8, Ctrl+0 to tool index 9
    let toolIndex = -1;
    if (event.key >= "1" && event.key <= "9") {
      toolIndex = parseInt(event.key) - 1;
    } else if (event.key === "0") {
      toolIndex = 9;
    }

    if (toolIndex < 0) {
      return;
    }

    // Don't intercept if focus is in a text input
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this._handleToolClick(toolIndex);
  }

  async _handleToolClick(toolIndex: number) {
    const allTools = ProjectTools.generateTools(this.props.creatorTools, this.props.project);
    if (allTools && toolIndex < allTools.length) {
      const tool = allTools[toolIndex];
      await ProjectTools.executeTool(tool, this.props.creatorTools, this.props.project);
    }
  }

  /**
   * Handle player list changes from RemoteMinecraft.
   */
  _handlePlayersChanged(minecraft: IMinecraft, players: string[]) {
    if (this._isMountedInternal) {
      this.setState({
        connectedPlayers: players,
      });
    }
  }

  componentDidMount() {
    this._isMountedInternal = true;

    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this._handleKeyDown);
    }

    this._load();
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;

    if (typeof window !== "undefined") {
      window.removeEventListener("keydown", this._handleKeyDown);
    }
  }

  async _load() {
    let doUpdate = false;

    await this.props.creatorTools.load();

    if (
      this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy &&
      this.props.creatorTools.successfullyConnectedWebSocketToMinecraft
    ) {
      this.props.creatorTools.ensureMinecraft(this.props.creatorTools.lastActiveMinecraftFlavor);

      doUpdate = true;
    }

    if (this.props.creatorTools.activeMinecraft) {
      if (!this.props.creatorTools.activeMinecraft.onWorldFolderReady.has(this._handleWorldFolderReady)) {
        this.props.creatorTools.activeMinecraft.onWorldFolderReady.subscribe(this._handleWorldFolderReady);
      }

      // Subscribe to player list changes for RemoteMinecraft
      if (this.props.creatorTools.activeMinecraft instanceof RemoteMinecraft) {
        const remoteMc = this.props.creatorTools.activeMinecraft as RemoteMinecraft;
        if (!remoteMc.onPlayersChanged.has(this._handlePlayersChanged)) {
          remoteMc.onPlayersChanged.subscribe(this._handlePlayersChanged);
        }
        // Initialize players list from current state
        const currentPlayers = remoteMc.connectedPlayerNames;
        if (currentPlayers.length > 0 && this.state.connectedPlayers.length === 0) {
          this.setState({
            connectedPlayers: currentPlayers,
          });
        }
      }

      if (this.props.creatorTools.activeMinecraft.worldFolder) {
        doUpdate = true;
      }
    }

    if (this._isMountedInternal && doUpdate && this.props.creatorTools.activeMinecraft) {
      this.setState({
        flavor: this.props.creatorTools.lastActiveMinecraftFlavor,
        worldFolder: this.props.creatorTools.activeMinecraft.worldFolder,
      });
    }
  }

  async _handleWorldFolderReady(minecraft: IMinecraft, folder: IFolder) {
    this.setState({
      flavor: this.props.creatorTools.lastActiveMinecraftFlavor,
      worldFolder: folder,
    });
  }

  _connectionStateChanged(minecraft: IMinecraft, connectionState: CreatorToolsMinecraftState) {
    if (!this._isMountedInternal) {
      return;
    }

    // Ensure we're subscribed to worldFolder events (may have been created after _load ran)
    if (
      this.props.creatorTools.activeMinecraft &&
      !this.props.creatorTools.activeMinecraft.onWorldFolderReady.has(this._handleWorldFolderReady)
    ) {
      this.props.creatorTools.activeMinecraft.onWorldFolderReady.subscribe(this._handleWorldFolderReady);
    }

    // When the server state changes, also check if worldFolder has become available
    const currentWorldFolder = this.props.creatorTools.activeMinecraft?.worldFolder;
    if (currentWorldFolder && !this.state.worldFolder) {
      this.setState({
        worldFolder: currentWorldFolder,
      });
    } else {
      this.forceUpdate();
    }
  }

  componentDidUpdate(prevProps: IMinecraftDisplayProps, prevState: IMinecraftDisplayState) {
    if (prevProps !== undefined && prevProps.project !== undefined) {
      if (prevProps.project !== this.props.project) {
        this._load();
      }
    }
  }

  _connectToProps() {
    if (
      this.props.creatorTools !== undefined &&
      !this.props.creatorTools.onMinecraftStateChanged.has(this._connectionStateChanged)
    ) {
      this.props.creatorTools.onMinecraftStateChanged.subscribe(this._connectionStateChanged);
    }
  }

  async _commitCommand(command: string) {
    this.props.creatorTools.notifyStatusUpdate(command);

    await CommandRunner.runCommandText(this.props.creatorTools, command);
  }

  _update() {
    this.forceUpdate();
  }

  _updateDefaultFunction(newFunction: string) {
    const command = this.props.creatorTools.getCustomTool(0);

    command.text = newFunction;
  }

  _updatePreferredTextSize(newTextSize: number) {
    this.props.creatorTools.preferredTextSize = newTextSize;
  }

  _statusExpandedSizeChanged(newMode: ProjectStatusAreaMode) {
    this.setState({
      flavor: this.state.flavor,
      mode: this.state.mode,
      minecraftStatus: newMode,
      worldFolder: this.state.worldFolder,
    });
  }

  _handlePanelSelected(flavor: MinecraftFlavor) {
    this.props.creatorTools.setMinecraftFlavor(flavor);

    this.setState({
      flavor: flavor,
      mode: MinecraftDisplayMode.activeMinecraft,
      minecraftStatus: this.state.minecraftStatus,
      worldFolder: this.state.worldFolder,
    });
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }
    const width = WebUtilities.getWidth();
    const height = WebUtilities.getHeight();
    let isButtonCompact = this.props.forceCompact === true;

    if (width < 1016) {
      isButtonCompact = true;
    }

    const intl = this.props.intl;
    const toolbarItems: JSX.Element[] = [];
    const hostToolbarItems: JSX.Element[] = [];
    const interiorElements = [];

    const cs = this.props.creatorTools.activeMinecraftState;

    // Only show Mode tab on mctools.dev website or Electron app, not in web server mode
    if (!this.props.isWebServer) {
      toolbarItems.push(
        <Button key="info" onClick={this._setWelcomeMode} title={intl.formatMessage({ id: "project_editor.minecraft.managing_minecraft" })} size="small">
          <ConnectModeLabel
            isCompact={isButtonCompact}
            isSelected={
              this.state.mode === MinecraftDisplayMode.info ||
              this.props.creatorTools.lastActiveMinecraftFlavor === undefined ||
              this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.none
            }
            theme={this.props.theme}
          />
        </Button>
      );
    }

    if (CreatorToolsHost.isAppServiceWeb) {
      if (this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy) {
        toolbarItems.push(
          <Button
            key="dedicatedServer"
            onClick={this._setDedicatedServerMode}
            title={intl.formatMessage({ id: "project_editor.minecraft.deploy_locally" })}
            size="small"
          >
            <DedicatedServerMinecraftLabel
              isCompact={isButtonCompact}
              theme={this.props.theme}
              isSelected={
                this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy &&
                this.state.mode === MinecraftDisplayMode.activeMinecraft
              }
            />
          </Button>
        );
      }

      if (this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy) {
        toolbarItems.push(
          <Button
            key="minecraftWebSockets"
            onClick={this._setWebSocketMode}
            title={intl.formatMessage({ id: "project_editor.minecraft.deploy_locally" })}
            size="small"
          >
            <WebSocketMinecraftLabel
              isCompact={isButtonCompact}
              theme={this.props.theme}
              isSelected={
                this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy &&
                this.state.mode === MinecraftDisplayMode.activeMinecraft
              }
            />
          </Button>
        );
      }
    }

    // Determine if we're connected and compute a display name
    let connectedName: string | undefined = undefined;
    const isConnected =
      cs === CreatorToolsMinecraftState.started ||
      cs === CreatorToolsMinecraftState.prepared ||
      cs === CreatorToolsMinecraftState.initialized;

    if (isConnected && this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.remote) {
      // Use the slot label format: "<slot>: <serverUrl>:<port>"
      const slot = this.props.creatorTools.remoteServerPort;
      if (slot !== undefined && slot >= 0) {
        connectedName = this._getSlotLabel(slot);
      } else {
        connectedName = intl.formatMessage({ id: "project_editor.minecraft.connected" });
      }
    }

    if (
      this.props.creatorTools.lastActiveMinecraftFlavor !== MinecraftFlavor.minecraftGameProxy &&
      this.props.creatorTools.lastActiveMinecraftFlavor !== MinecraftFlavor.processHostedProxy
    ) {
      toolbarItems.push(
        <Button
          key="remote"
          onClick={this._setRemoteMinecraftMode}
          title={intl.formatMessage({ id: "project_editor.minecraft.deploy_remotely" })}
          size="small"
        >
          <RemoteMinecraftLabel
            isCompact={isButtonCompact}
            isWebServer={this.props.isWebServer === true}
            isSelected={
              this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.remote &&
              this.state.mode === MinecraftDisplayMode.activeMinecraft
            }
            theme={this.props.theme}
            connectedName={connectedName}
          />
        </Button>
      );
    }

    // In web server mode, world settings are accessed via the slot settings gear icon
    // In other modes, show the Server Settings tab in the bottom toolbar
    if (!this.props.isWebServer) {
      toolbarItems.push(
        <Button key="worldSettings" onClick={this._setWorldSettingsMode} title={intl.formatMessage({ id: "project_editor.minecraft.configure_world" })} size="small">
          <WorldSettingsLabel
            isCompact={isButtonCompact}
            isSelected={this.state.mode === MinecraftDisplayMode.worldSettings}
            theme={this.props.theme}
          />
        </Button>
      );
    }

    // TODO: Re-enable Interact tab when ready
    // toolbarItems.push(
    //   <Button key="interact" onClick={this._setInteractMode} title="Interact with the active world" size="small">
    //     <InteractLabel
    //       isCompact={isButtonCompact}
    //       isSelected={this.state.mode === MinecraftDisplayMode.interact}
    //       theme={this.props.theme}
    //     />
    //   </Button>
    // );

    toolbarItems.push(
      <Button key="toolEditor" onClick={this._setToolEditor} title={intl.formatMessage({ id: "project_editor.minecraft.configure_tools" })} size="small">
        <ToolEditorLabel
          isCompact={isButtonCompact}
          isSelected={this.state.mode === MinecraftDisplayMode.toolEditor}
          theme={this.props.theme}
        />
      </Button>
    );

    if (
      cs === CreatorToolsMinecraftState.stopped ||
      cs === CreatorToolsMinecraftState.none ||
      cs === CreatorToolsMinecraftState.error ||
      cs === CreatorToolsMinecraftState.disconnected
    ) {
      hostToolbarItems.push(
        <Button
          key="serverStart"
          onClick={this._startClick}
          title={intl.formatMessage({ id: "project_editor.minecraft.start_server" })}
          disabled={
            this.props.creatorTools.defaultMinecraftFlavor === MinecraftFlavor.processHostedProxy &&
            this.props.creatorTools.dedicatedServerMode === DedicatedServerMode.auto &&
            !this.props.creatorTools
              .iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula
          }
          size="small"
        >
          <ServerStartLabel isCompact={isButtonCompact} />
        </Button>
      );
    } else if (cs === CreatorToolsMinecraftState.initializing) {
      hostToolbarItems.push(
        <Button
          key="serverInitting"
          onClick={this._stopDedicatedServerClick}
          title={intl.formatMessage({ id: "project_editor.minecraft.cancel_init_stop" })}
          size="small"
        >
          <ServerInitializingLabel isCompact={isButtonCompact} />
        </Button>
      );
    } else if (cs === CreatorToolsMinecraftState.starting) {
      hostToolbarItems.push(
        <Button
          key="serverStarting"
          onClick={this._stopDedicatedServerClick}
          title={intl.formatMessage({ id: "project_editor.minecraft.cancel_start_stop" })}
          size="small"
        >
          <ServerStartingLabel isCompact={isButtonCompact} />
        </Button>
      );
    } else if (cs === CreatorToolsMinecraftState.initialized) {
      hostToolbarItems.push(
        <Button key="serverInitted" onClick={this._startClick} title={intl.formatMessage({ id: "project_editor.minecraft.start_deploy" })} size="small">
          <ServerInitializedLabel isCompact={isButtonCompact} />
        </Button>
      );
    } else if (cs === CreatorToolsMinecraftState.stopping) {
      hostToolbarItems.push(
        <Button key="serverStop" onClick={this._stopDedicatedServerClick} title={intl.formatMessage({ id: "project_editor.minecraft.stopping" })} size="small">
          <ServerStoppingLabel isCompact={isButtonCompact} />
        </Button>
      );
    } else if (cs === CreatorToolsMinecraftState.started) {
      hostToolbarItems.push(
        <Button key="serverRestart" onClick={this._restartDedicatedServerClick} title={intl.formatMessage({ id: "project_editor.minecraft.restart_server" })} size="small">
          <ServerRestartLabel isCompact={isButtonCompact} />
        </Button>
      );
      hostToolbarItems.push(
        <Button key="serverStop" onClick={this._stopDedicatedServerClick} title={intl.formatMessage({ id: "project_editor.minecraft.stop_server" })} size="small">
          <ServerStopLabel isCompact={isButtonCompact} />
        </Button>
      );
    }

    // Add slot selector dropdown to host toolbar when in web server mode
    // The slot selector allows switching between multiple server slots
    if (this.props.isWebServer === true) {
      const currentSlot = this.props.creatorTools.remoteServerPort ?? 0;
      const slots = this._getSlots();
      hostToolbarItems.push(
        <div className="mid-slotSelector" key="slotSelector">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={currentSlot >= 0 && currentSlot < slots.length ? slots[currentSlot] : slots[0]}
              onChange={this._handleSlotChanged}
              inputProps={{ "aria-label": intl.formatMessage({ id: "project_editor.minecraft.select_server_slot" }) }}
            >
              {slots.map((slot) => (
                <MenuItem key={slot} value={slot}>
                  {slot}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <IconButton
            title={intl.formatMessage({ id: "project_editor.minecraft.edit_slot_settings" })}
            onClick={this._openSlotSettings}
            className="mid-slotSettingsButton"
            size="small"
          >
            <FontAwesomeIcon icon={faGear} className="fa-sm" />
          </IconButton>
        </div>
      );

      // Add Worlds button for admin users
      if (this.props.creatorTools.remoteServerAccessLevel === RemoteServerAccessLevel.admin) {
        hostToolbarItems.push(
          <Button
            key="worlds"
            onClick={this._openWorldsDialog}
            title={intl.formatMessage({ id: "project_editor.minecraft.manage_worlds" })}
            className="mid-worldsButton"
            size="small"
            startIcon={<FontAwesomeIcon icon={faGlobe} className="fa-sm" />}
          >
            {intl.formatMessage({ id: "project_editor.minecraft.worlds" })}
          </Button>
        );
      }

      // Add tool buttons to host toolbar for web server mode
      const allTools = ProjectTools.generateTools(this.props.creatorTools, this.props.project);
      if (allTools && allTools.length > 0 && isConnected) {
        const toolButtons = allTools.map((tool, index) => (
          <button
            key={"tool-" + index}
            className="mid-toolbar-tool-btn"
            onClick={() => this._handleToolClick(index)}
            title={tool.title}
          >
            {tool.title}
          </button>
        ));

        hostToolbarItems.push(
          <div className="mid-toolbar-tools" key="toolButtons">
            {toolButtons}
          </div>
        );
      }
    }

    if (
      this.props.project &&
      (cs === CreatorToolsMinecraftState.initialized ||
        cs === CreatorToolsMinecraftState.prepared ||
        cs === CreatorToolsMinecraftState.started)
    ) {
      hostToolbarItems.push(
        <Button key="play" onClick={this._deployToMinecraft} title={intl.formatMessage({ id: "project_editor.minecraft.deploy_to_minecraft" })} size="small">
          <PushToMinecraftLabel isCompact={isButtonCompact} />
        </Button>
      );
    }

    if (
      this.state.mode === MinecraftDisplayMode.activeMinecraft &&
      this.props.creatorTools.lastActiveMinecraftFlavor !== undefined &&
      this.props.creatorTools.lastActiveMinecraftFlavor !== MinecraftFlavor.none
    ) {
      if (
        this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy &&
        (cs === CreatorToolsMinecraftState.none ||
          cs === CreatorToolsMinecraftState.error ||
          cs === CreatorToolsMinecraftState.disconnected ||
          cs === CreatorToolsMinecraftState.initializing ||
          cs === CreatorToolsMinecraftState.initialized)
      ) {
        interiorElements.push(<MinecraftGameSettingsPanel creatorTools={this.props.creatorTools} key="mcconnect" />);
      } else if (
        this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.remote &&
        (cs === CreatorToolsMinecraftState.none ||
          cs === CreatorToolsMinecraftState.error ||
          cs === CreatorToolsMinecraftState.disconnected ||
          cs === CreatorToolsMinecraftState.preparing ||
          cs === CreatorToolsMinecraftState.prepared ||
          cs === CreatorToolsMinecraftState.started ||
          cs === CreatorToolsMinecraftState.stopped ||
          cs === CreatorToolsMinecraftState.initializing ||
          cs === CreatorToolsMinecraftState.initialized)
      ) {
        // In web server mode, skip the settings panel when connected (it renders empty with just padding)
        const isRemoteConnected =
          cs === CreatorToolsMinecraftState.initialized ||
          cs === CreatorToolsMinecraftState.prepared ||
          cs === CreatorToolsMinecraftState.started;

        if (!this.props.isWebServer || !isRemoteConnected) {
          interiorElements.push(
            <RemoteServerSettingsPanel
              forceCompact={this.props.forceCompact}
              creatorTools={this.props.creatorTools}
              isWebServer={this.props.isWebServer}
              key="rssp"
              ensureMinecraftOnLogin={this.props.ensureMinecraftOnLogin}
            />
          );
        }

        // Show EULA acceptance panel if user is logged in but EULA is not accepted
        // This allows admins to accept the EULA through the web UI
        const isLoggedIn =
          cs === CreatorToolsMinecraftState.initialized ||
          cs === CreatorToolsMinecraftState.prepared ||
          cs === CreatorToolsMinecraftState.started ||
          cs === CreatorToolsMinecraftState.stopped;
        const eulaAccepted = this.props.creatorTools.remoteServerEulaAccepted;
        const permissionLevel = this.props.creatorTools.remoteServerAccessLevel;

        if (isLoggedIn && eulaAccepted === false) {
          interiorElements.push(
            <EulaAcceptancePanel
              key="eulaPanel"
              creatorTools={this.props.creatorTools}
              theme={this.props.theme}
              permissionLevel={permissionLevel}
              onEulaAccepted={this._handleEulaAccepted}
            />
          );
        }

        // Show WorldView when we have worldContentStorage (e.g., after login to remote server)
        // This allows viewing the world map without starting Minecraft
        // Use worldFolder (which points to /api/worldContent/{slot}/world/) not worldContentStorage.rootFolder
        const worldContentFolder = this.props.creatorTools.activeMinecraft?.worldFolder;
        if (
          worldContentFolder &&
          height > 600 &&
          (cs === CreatorToolsMinecraftState.initialized ||
            cs === CreatorToolsMinecraftState.prepared ||
            cs === CreatorToolsMinecraftState.started ||
            cs === CreatorToolsMinecraftState.stopped)
        ) {
          // Get the HttpStorage for debug stats
          const worldContentStorage = this.props.creatorTools.activeMinecraft?.worldContentStorage;
          const httpStorage = worldContentStorage instanceof HttpStorage ? worldContentStorage : undefined;
          // In Electron mode, activeMinecraft is ProcessHostedMinecraft which has IPC debug events
          const processHostedMc =
            this.props.creatorTools.activeMinecraft instanceof ProcessHostedMinecraft
              ? this.props.creatorTools.activeMinecraft
              : undefined;

          // Check if debugger streaming is enabled - if not, don't show the debug stats panel
          const slotConfig = this.props.creatorTools.activeMinecraft?.slotConfig;
          const showDebugPanel = slotConfig?.debuggerStreamingEnabled !== false;

          // Use the new layout with Messages/Players sidebar for any remote connection
          // This provides a consistent experience whether accessing via web server or ProjectEditor
          const isRemoteMinecraft = this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.remote;
          if (this.props.isWebServer || isRemoteMinecraft) {
            // Get log items for messages panel
            const logItems = this.props.creatorTools.status
              .filter((item: IStatus) => item.topic === StatusTopic.minecraft || !item.topic)
              .slice(-100); // Last 100 messages

            // Get players from RemoteMinecraft state
            const players: string[] = this.state.connectedPlayers;

            // Determine sidebar content based on selected tab
            let sidebarContent: JSX.Element | null = null;

            if (this.state.sidebarTab === SidebarTab.stats) {
              // Stats tab - show debug stats panel
              sidebarContent = (
                <div className="mid-stats-panel">
                  <DebugStatsPanel
                    theme={this.props.theme}
                    slot={httpStorage?.slot}
                    storage={httpStorage}
                    minecraft={processHostedMc}
                  />
                </div>
              );
            } else if (this.state.sidebarTab === SidebarTab.messages) {
              sidebarContent = (
                <div className="mid-messages-panel">
                  <div className="mid-messages-list">
                    {logItems.length === 0 ? (
                      <div className="mid-message-item">
                        <span className="mid-message-text">{intl.formatMessage({ id: "project_editor.minecraft.no_messages" })}</span>
                      </div>
                    ) : (
                      logItems.map((item: IStatus, index: number) => {
                        let msgClass = "mid-message-text";
                        if (item.message.toLowerCase().includes("error")) msgClass += " error";
                        else if (item.message.toLowerCase().includes("warn")) msgClass += " warn";
                        else if (item.message.includes("[") && item.message.includes("]")) msgClass += " player";
                        else msgClass += " info";

                        const time = item.time
                          ? new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "";

                        return (
                          <div className="mid-message-item" key={"msg-" + index}>
                            {time && <span className="mid-message-time">{time}</span>}
                            <span className={msgClass}>{item.message}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="mid-command-input-area">
                    <FunctionEditor
                      theme={this.props.theme}
                      project={this.props.project}
                      initialContent=""
                      isCommandEditor={true}
                      singleCommandMode={true}
                      roleId={"sidebarCommandEditor"}
                      readOnly={false}
                      fixedHeight={36}
                      creatorTools={this.props.creatorTools}
                      onUpdatePreferredTextSize={this._updatePreferredTextSize}
                      preferredTextSize={this.props.creatorTools.preferredTextSize}
                    />
                  </div>
                </div>
              );
            } else {
              // Players tab
              sidebarContent = (
                <div className="mid-players-panel">
                  {players.length === 0 ? (
                    <div className="mid-no-players">{intl.formatMessage({ id: "project_editor.minecraft.no_players" })}</div>
                  ) : (
                    <ul className="mid-players-list">
                      {players.map((player, index) => (
                        <li className="mid-player-item" key={"player-" + index}>
                          <div className="mid-player-avatar"></div>
                          <span className="mid-player-name">{player}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            }

            interiorElements.push(
              <div className="mid-webserver-layout" key="maparea-webserver">
                <div className="mid-map-area">
                  <WorldDisplay
                    folder={worldContentFolder}
                    creatorTools={this.props.creatorTools}
                    project={this.props.project}
                    heightOffset={this.props.heightOffset + 100}
                  />
                </div>
                <div className="mid-sidebar">
                  <div className="mid-sidebar-tabs">
                    <button
                      className={"mid-sidebar-tab" + (this.state.sidebarTab === SidebarTab.messages ? " active" : "")}
                      onClick={() => this._handleSidebarTabChange(SidebarTab.messages)}
                    >
                      {intl.formatMessage({ id: "project_editor.minecraft.tab_messages" })}
                    </button>
                    <button
                      className={"mid-sidebar-tab" + (this.state.sidebarTab === SidebarTab.players ? " active" : "")}
                      onClick={() => this._handleSidebarTabChange(SidebarTab.players)}
                    >
                      {intl.formatMessage({ id: "project_editor.minecraft.tab_players" })}
                    </button>
                    <button
                      className={"mid-sidebar-tab" + (this.state.sidebarTab === SidebarTab.stats ? " active" : "")}
                      onClick={() => this._handleSidebarTabChange(SidebarTab.stats)}
                    >
                      {intl.formatMessage({ id: "project_editor.minecraft.tab_stats" })}
                    </button>
                  </div>
                  <div className="mid-sidebar-content">{sidebarContent}</div>
                </div>
              </div>
            );
          } else {
            // Original layout for non-web server mode
            interiorElements.push(
              <div className="mid-map-debug-container" key="maparea-remote">
                <div className="mid-map">
                  <WorldDisplay
                    folder={worldContentFolder}
                    creatorTools={this.props.creatorTools}
                    project={this.props.project}
                    heightOffset={this.props.heightOffset + 340}
                  />
                </div>
                {showDebugPanel && (
                  <div className="mid-debug-stats">
                    <DebugStatsPanel
                      theme={this.props.theme}
                      slot={httpStorage?.slot}
                      storage={httpStorage}
                      minecraft={processHostedMc}
                    />
                  </div>
                )}
              </div>
            );
          }
        }
      } else if (
        this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy &&
        (cs === CreatorToolsMinecraftState.none ||
          cs === CreatorToolsMinecraftState.error ||
          cs === CreatorToolsMinecraftState.disconnected ||
          cs === CreatorToolsMinecraftState.initialized ||
          cs === CreatorToolsMinecraftState.preparing ||
          cs === CreatorToolsMinecraftState.prepared ||
          cs === CreatorToolsMinecraftState.stopped ||
          cs === CreatorToolsMinecraftState.initializing)
      ) {
        interiorElements.push(
          <DedicatedServerSettingsPanel
            creatorTools={this.props.creatorTools}
            key="dedicatedserverpanel"
            onChange={this._update}
            theme={this.props.theme}
          />
        );
      }

      if (
        cs !== CreatorToolsMinecraftState.none &&
        cs !== CreatorToolsMinecraftState.error &&
        cs !== CreatorToolsMinecraftState.disconnected &&
        cs !== CreatorToolsMinecraftState.initializing &&
        cs !== CreatorToolsMinecraftState.initialized &&
        cs !== CreatorToolsMinecraftState.preparing
      ) {
        let content = "";

        const command = this.props.creatorTools.getCustomTool(0);

        if (command.text) {
          content = command.text;
        }

        const commanderArea = [];

        commanderArea.push(
          <div className="mid-commandEditorArea" key="commandtools">
            <FunctionEditor
              theme={this.props.theme}
              project={this.props.project}
              initialContent={content}
              isCommandEditor={true}
              onUpdateContent={this._updateDefaultFunction}
              fixedHeight={146}
              singleCommandMode={false}
              roleId={"commandEditorArea"}
              readOnly={false}
              creatorTools={this.props.creatorTools}
              onUpdatePreferredTextSize={this._updatePreferredTextSize}
              preferredTextSize={this.props.creatorTools.preferredTextSize}
            />
          </div>
        );

        commanderArea.push(
          <div className="mid-logitemarea" key="logitemarea">
            <LogItemArea
              creatorTools={this.props.creatorTools}
              onSetExpandedSize={this._statusExpandedSizeChanged}
              mode={this.state.minecraftStatus}
              filterTopics={[StatusTopic.minecraft]}
              widthOffset={this.props.widthOffset}
            />
          </div>
        );

        // Get the world folder to display - use worldFolder which points to the actual world
        // Skip for remote flavor since it's already handled in the remote server section above
        const displayFolder = this.state.worldFolder || this.props.creatorTools.activeMinecraft?.worldFolder;

        if (
          displayFolder &&
          height > 600 &&
          this.props.creatorTools.lastActiveMinecraftFlavor !== MinecraftFlavor.remote
        ) {
          // Get the storage for debug stats (if available and is HttpStorage)
          const worldContentStorage = this.props.creatorTools.activeMinecraft?.worldContentStorage;
          const httpStorage = worldContentStorage instanceof HttpStorage ? worldContentStorage : undefined;
          // In Electron mode, activeMinecraft is ProcessHostedMinecraft which has IPC debug events
          const processHostedMc =
            this.props.creatorTools.activeMinecraft instanceof ProcessHostedMinecraft
              ? this.props.creatorTools.activeMinecraft
              : undefined;

          // Check if debugger streaming is enabled - if not, don't show the debug stats panel
          const slotConfig = this.props.creatorTools.activeMinecraft?.slotConfig;
          const showDebugPanel = slotConfig?.debuggerStreamingEnabled !== false;

          interiorElements.push(
            <div className="mid-map-debug-container" key="maparea">
              <div className="mid-map">
                <WorldDisplay
                  folder={displayFolder}
                  creatorTools={this.props.creatorTools}
                  project={this.props.project}
                  heightOffset={this.props.heightOffset + 440}
                />
              </div>
              {showDebugPanel && (
                <div className="mid-debug-stats">
                  <DebugStatsPanel
                    theme={this.props.theme}
                    slot={httpStorage?.slot}
                    storage={httpStorage}
                    minecraft={processHostedMc}
                  />
                </div>
              )}
            </div>
          );
        }

        // Only show the bottom commander/tools section when NOT in web server mode
        // In web server mode, tools are in the top toolbar and command input is in the sidebar
        if (!this.props.isWebServer) {
          interiorElements.push(
            <div className="mid-commander" key="commander">
              {commanderArea}
            </div>
          );

          interiorElements.push(
            <div className="mid-spacer" key="spacer1">
              &#160;
            </div>
          );

          const tools = [];

          const allToolsBottom = ProjectTools.generateTools(this.props.creatorTools, this.props.project);

          if (allToolsBottom !== undefined) {
            for (let i = 0; i < allToolsBottom.length; i++) {
              const tool = allToolsBottom[i];

              const tt = (
                <ToolTile
                  key={"tool" + i}
                  creatorTools={this.props.creatorTools}
                  project={this.props.project}
                  tool={tool}
                  displayMode={TT_TILE_SMALL}
                />
              );

              tools.push(tt);
            }
          }

          interiorElements.push(
            <div className="mid-toolBin" key="toolBin">
              {tools}
            </div>
          );
        }
      }
    } else if (this.state.mode === MinecraftDisplayMode.worldSettings) {
      interiorElements.push(
        <WorldManagerSettingsPanel
          creatorTools={this.props.creatorTools}
          project={this.props.project}
          theme={this.props.theme}
          key="wmspanel"
        />
      );
    } else if (this.state.mode === MinecraftDisplayMode.toolEditor) {
      interiorElements.push(
        <MinecraftToolEditor
          creatorTools={this.props.creatorTools}
          project={this.props.project}
          theme={this.props.theme}
          widthOffset={this.props.widthOffset}
          heightOffset={this.props.heightOffset}
        />
      );
    } else if (this.state.mode === MinecraftDisplayMode.interact) {
      interiorElements.push(
        <InteractPanel creatorTools={this.props.creatorTools} project={this.props.project} theme={this.props.theme} />
      );
    } else if (
      this.state.mode === MinecraftDisplayMode.info ||
      this.props.creatorTools.lastActiveMinecraftFlavor === undefined ||
      this.props.creatorTools.lastActiveMinecraftFlavor === MinecraftFlavor.none
    ) {
      interiorElements.push(
        <MinecraftDisplayWelcomePanel
          creatorTools={this.props.creatorTools}
          key="mdwpanel"
          isWebServer={this.props.isWebServer}
          theme={this.props.theme}
          onPanelSelected={this._handlePanelSelected}
        />
      );
    }

    // Slot settings dialog content
    let slotSettingsDialog = null;
    if (this.state.showSlotSettingsDialog) {
      const slotConfig = this.props.creatorTools.activeMinecraft?.slotConfig;
      const currentSlot = this.props.creatorTools.remoteServerPort ?? 0;

      // Determine if server is running
      const isServerRunning =
        cs === CreatorToolsMinecraftState.started ||
        cs === CreatorToolsMinecraftState.prepared ||
        cs === CreatorToolsMinecraftState.initialized;

      const worldSettings: IWorldSettings = this.props.creatorTools.worldSettings ?? {};

      const dialogContent = (
        <div className="mid-slotSettingsContent">
          <div className="mid-slotSettingsSection">
            <div className="mid-slotSettingsSectionHeader">{intl.formatMessage({ id: "project_editor.minecraft.slot_info" })}</div>
            <div className="mid-slotSettingsRow">
              <span className="mid-slotSettingsLabel">{intl.formatMessage({ id: "project_editor.minecraft.slot_label" })}</span>
              <span className="mid-slotSettingsValue">
                {intl.formatMessage({ id: "project_editor.minecraft.slot_value" }, { slot: currentSlot, port: MinecraftUtilities.getPortForSlot(currentSlot) })}
              </span>
            </div>
            <div className="mid-slotSettingsRow">
              <span className="mid-slotSettingsLabel">{intl.formatMessage({ id: "project_editor.minecraft.server_version" })}</span>
              <span className="mid-slotSettingsValue">{slotConfig?.serverVersion ?? intl.formatMessage({ id: "project_editor.minecraft.unknown" })}</span>
            </div>
            <div className="mid-slotSettingsRow">
              <span className="mid-slotSettingsLabel">{intl.formatMessage({ id: "project_editor.minecraft.status_label" })}</span>
              <span className="mid-slotSettingsValue">{isServerRunning ? intl.formatMessage({ id: "project_editor.minecraft.status_running" }) : intl.formatMessage({ id: "project_editor.minecraft.status_stopped" })}</span>
            </div>
          </div>
          <div className="mid-slotSettingsSection">
            <div className="mid-slotSettingsSectionHeader">{intl.formatMessage({ id: "project_editor.minecraft.world_settings" })}</div>
            <div
              className="mid-slotSettingsWorldArea"
              style={{
                backgroundColor:
                  CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? mcColors.offBlack : mcColors.gray1,
                color: CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? mcColors.gray2 : mcColors.gray5,
              }}
            >
              <WorldSettingsArea
                creatorTools={this.props.creatorTools}
                worldSettings={worldSettings}
                displayName={true}
                displayGameTypeProperties={true}
                displayGameAdminProperties={true}
                onWorldSettingsChanged={this._handleWorldSettingsChanged}
              />
            </div>
            {!isServerRunning && (
              <div className="mid-slotSettingsNote">{intl.formatMessage({ id: "project_editor.minecraft.settings_applied_note" })}</div>
            )}
          </div>
        </div>
      );

      // Build footer buttons based on server state
      const footerButtons = isServerRunning ? (
        <DialogActions className="mid-slotSettingsFooter">
          <Button onClick={this._closeSlotSettings}>{intl.formatMessage({ id: "common.close" })}</Button>
          <Button variant="contained" onClick={this._saveAndRestartServer}>
            {intl.formatMessage({ id: "project_editor.minecraft.save_and_restart" })}
          </Button>
        </DialogActions>
      ) : (
        <DialogActions className="mid-slotSettingsFooter">
          <Button variant="contained" onClick={this._closeSlotSettings}>
            {intl.formatMessage({ id: "common.ok" })}
          </Button>
        </DialogActions>
      );

      slotSettingsDialog = (
        <Dialog open={true} onClose={this._closeSlotSettings}>
          <DialogTitle>{intl.formatMessage({ id: "project_editor.minecraft.slot_settings_title" }, { slot: currentSlot })}</DialogTitle>
          <DialogContent>{dialogContent}</DialogContent>
          {footerButtons}
        </Dialog>
      );
    }

    const currentSlot = this.props.creatorTools.remoteServerPort ?? 0;
    const isSlotRunning = cs === CreatorToolsMinecraftState.started || cs === CreatorToolsMinecraftState.prepared;

    return (
      <div className="mid-outer">
        {slotSettingsDialog}
        {this.state.showWorldsDialog && (
          <WorldsDialog
            creatorTools={this.props.creatorTools}
            isOpen={this.state.showWorldsDialog}
            onClose={this._closeWorldsDialog}
            theme={this.props.theme}
            currentSlot={currentSlot}
            currentSlotWorldId={this.state.currentSlotWorldId}
            isSlotRunning={isSlotRunning}
            onRestartRequired={this._handleWorldsRestartRequired}
          />
        )}
        <div className="mid-hostToolBarArea" key="hostToolBar">
          <Stack direction="row" spacing={1} aria-label={intl.formatMessage({ id: "project_editor.minecraft.host_actions_aria" })}>
            {hostToolbarItems}
          </Stack>
        </div>
        <div className="mid-main">{interiorElements}</div>
        <div className="mid-actionsToolBarArea" key="actionsToolBar">
          <Stack direction="row" spacing={1} aria-label={intl.formatMessage({ id: "project_editor.minecraft.actions_aria" })}>
            {toolbarItems}
          </Stack>
        </div>
      </div>
    );
  }
}

export default withLocalization(MinecraftDisplay);
