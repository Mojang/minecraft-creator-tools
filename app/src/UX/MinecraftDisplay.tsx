import { Component } from "react";
import IAppProps from "./IAppProps";
import ITool from "../app/ITool";
import "./MinecraftDisplay.css";
import { CartoMinecraftState } from "../app/Carto";
import Project from "../app/Project";
import MinecraftGameSettingsPanel from "./MinecraftGameSettingsPanel";
import ProjectTools from "../app/ProjectTools";
import ToolTile, { TT_TILE_SMALL } from "./ToolTile";
import IMinecraft from "../app/IMinecraft";
import { DedicatedServerMode, MinecraftFlavor } from "../app/ICartoData";
import { Toolbar, ThemeInput } from "@fluentui/react-northstar";
import FunctionEditor from "./FunctionEditor";
import RemoteServerSettingsPanel from "./RemoteServerSettingsPanel";
import { MinecraftPushWorldType } from "../app/MinecraftPush";

import {
  DedicatedServerMinecraftLabel,
  InfoLabel,
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
} from "./Labels";
import CartoApp, { HostType } from "../app/CartoApp";
import DedicatedServerSettingsPanel from "./DedicatedServerSettingsPanel";
import AppServiceProxy from "../core/AppServiceProxy";
import Log from "../core/Log";
import WebUtilities from "./WebUtilities";
import { ProjectStatusAreaMode } from "./ProjectEditor";
import LogItemArea from "./LogItemArea";
import MCWorld from "../minecraft/MCWorld";
import IFolder from "../storage/IFolder";
import WorldView from "../worldux/WorldView";
import Utilities from "../core/Utilities";
import TextEditor from "./TextEditor";
import MinecraftToolEditor from "./MinecraftToolEditor";
import WorldManagerSettingsPanel from "./WorldManagerSettingsPanel";
import MinecraftDisplayWelcomePanel from "./MinecraftDisplayWelcomePanel";

export enum MinecraftDisplayMode {
  activeMinecraft = 0,
  worldSettings = 1,
  info = 2,
  toolEditor = 3,
}

interface IMinecraftDisplayProps extends IAppProps {
  heightOffset: number;
  project?: Project;
  forceCompact?: boolean;
  theme: ThemeInput<any>;
  widthOffset: number;
  ensureMinecraftOnLogin: boolean;
}

interface IMinecraftDisplayState {
  allTools: ITool[];
  flavor?: MinecraftFlavor;
  world?: MCWorld;
  mode: MinecraftDisplayMode;
  worldFolder?: IFolder;
  minecraftStatus: ProjectStatusAreaMode;
}

export default class MinecraftDisplay extends Component<IMinecraftDisplayProps, IMinecraftDisplayState> {
  private _commandValues: string[] = [];
  private _isMountedInternal = false;

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

    this._connectToProps();

    this.state = {
      allTools: [],
      flavor: props.carto.lastActiveMinecraftFlavor,
      mode: MinecraftDisplayMode.activeMinecraft,
      minecraftStatus: ProjectStatusAreaMode.minimized,
    };

    this._load();
  }

  private async _startClick() {
    if (this.props.carto.activeMinecraft === undefined) {
      this.props.carto.ensureMinecraft(MinecraftFlavor.processHostedProxy);
    }

    if (this.props.carto.activeMinecraft === undefined) {
      Log.unexpectedUndefined("SC");
      return;
    }

    await this.props.carto.activeMinecraft.prepareAndStart({
      worldType: MinecraftPushWorldType.flat,
      project: this.props.project,
    });
  }

  private async _stopDedicatedServerClick() {
    if (this.props.carto.activeMinecraft === undefined) {
      Log.unexpectedUndefined("SDSC");
      return;
    }

    this.props.carto.activeMinecraft.stop();
  }

  private async _restartDedicatedServerClick() {
    //  this.props.carto.restartDedicatedServer(this.props.project);
  }

  _deployToMinecraft() {
    if (this.props && this.props.project) {
      this.props.carto.prepareAndStartToMinecraft({
        worldType: MinecraftPushWorldType.flat,
        project: this.props.project,
      });
    }
  }

  _setDedicatedServerMode() {
    this.props.carto.setMinecraftFlavor(MinecraftFlavor.processHostedProxy);
    this.props.carto.save();

    this.setState({
      allTools: this.state.allTools,
      flavor: MinecraftFlavor.processHostedProxy,
      world: this.state.world,
      mode: MinecraftDisplayMode.activeMinecraft,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setWebSocketMode() {
    this.props.carto.setMinecraftFlavor(MinecraftFlavor.minecraftGameProxy);
    this.props.carto.save();

    this.setState({
      allTools: this.state.allTools,
      flavor: MinecraftFlavor.minecraftGameProxy,
      world: this.state.world,
      mode: MinecraftDisplayMode.activeMinecraft,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setRemoteMinecraftMode() {
    this.props.carto.setMinecraftFlavor(MinecraftFlavor.remote);
    this.props.carto.save();

    this.setState({
      allTools: this.state.allTools,
      flavor: MinecraftFlavor.remote,
      world: this.state.world,
      mode: MinecraftDisplayMode.activeMinecraft,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setWorldSettingsMode() {
    this.setState({
      allTools: this.state.allTools,
      flavor: this.state.flavor,
      world: this.state.world,
      mode: MinecraftDisplayMode.worldSettings,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setWelcomeMode() {
    this.setState({
      allTools: this.state.allTools,
      flavor: this.state.flavor,
      world: this.state.world,
      mode: MinecraftDisplayMode.info,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _setToolEditor() {
    this.setState({
      allTools: this.state.allTools,
      flavor: this.state.flavor,
      world: this.state.world,
      mode: MinecraftDisplayMode.toolEditor,
      worldFolder: this.state.worldFolder,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  componentDidMount() {
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  async _load() {
    if (this.props.carto.activeMinecraft) {
      this.props.carto.activeMinecraft.onWorldFolderReady.subscribe(this._handleWorldFolderReady);

      if (this.props.carto.activeMinecraft.worldFolder) {
        this._loadWorldFromFolder(this.props.carto.activeMinecraft.worldFolder);
      }
    }

    if (this.props.project !== undefined) {
      const tools = await ProjectTools.generateTools(this.props.project);

      if (this._isMountedInternal) {
        this.setState({
          allTools: tools,
          flavor: this.state.flavor,
          world: this.state.world,
          mode: this.state.mode,
          worldFolder: this.state.worldFolder,
          minecraftStatus: this.state.minecraftStatus,
        });
      }
    }
  }

  async _handleWorldFolderReady(minecraft: IMinecraft, folder: IFolder) {
    this._loadWorldFromFolder(folder);
  }

  async _loadWorldFromFolder(folder: IFolder) {
    if (this.state.worldFolder === folder) {
      return;
    }

    const world = new MCWorld();
    world.project = this.props.project;

    await folder.load(false);

    await world.loadFromFolder(folder);
    Log.debug("Loaded world" + folder.fullPath);
    this.setState({
      allTools: this.state.allTools,
      flavor: this.state.flavor,
      world: world,
      mode: this.state.mode,
      minecraftStatus: this.state.minecraftStatus,
    });
  }

  _connectionStateChanged(minecraft: IMinecraft, connectionState: CartoMinecraftState) {
    this.forceUpdate();
  }

  componentDidUpdate(prevProps: IMinecraftDisplayProps, prevState: IMinecraftDisplayState) {
    if (prevProps !== undefined && prevProps.project !== undefined) {
      if (prevProps.project !== this.props.project) {
        this._load();
      }
    }
  }

  _connectToProps() {
    if (this.props.carto !== undefined) {
      this.props.carto.onMinecraftStateChanged.subscribe(this._connectionStateChanged);
    }
  }

  async _commitCommand(command: string) {
    this.props.carto.notifyStatusUpdate(command);

    await this.props.carto.runMinecraftCommand(command);
  }

  _update() {
    this.forceUpdate();
  }

  _updateDefaultFunction(newFunction: string) {
    const command = this.props.carto.getCustomTool(0);

    command.text = newFunction;
  }

  _updatePreferredTextSize(newTextSize: number) {
    this.props.carto.preferredTextSize = newTextSize;
  }

  _statusExpandedSizeChanged(newMode: ProjectStatusAreaMode) {
    this.setState({
      allTools: this.state.allTools,
      flavor: this.state.flavor,
      mode: this.state.mode,
      minecraftStatus: newMode,
      world: this.state.world,
    });
  }

  _handlePanelSelected(flavor: MinecraftFlavor) {
    this.props.carto.setMinecraftFlavor(flavor);

    this.setState({
      allTools: this.state.allTools,
      flavor: flavor,
      mode: MinecraftDisplayMode.activeMinecraft,
      minecraftStatus: this.state.minecraftStatus,
      world: this.state.world,
    });
  }

  render() {
    if (this.props === undefined || this.state === undefined) {
      return <></>;
    }
    const width = WebUtilities.getWidth();
    let isButtonCompact = this.props.forceCompact === true;

    if (width < 1016) {
      isButtonCompact = true;
    }

    const interiorHeight = "calc(100vh - " + String(this.props.heightOffset + 110) + "px)";

    const toolbarItems = [];
    const hostToolbarItems = [];
    const interiorElements = [];

    const cs = this.props.carto.activeMinecraftState;

    toolbarItems.push({
      icon: (
        <InfoLabel
          isCompact={isButtonCompact}
          isSelected={
            this.state.mode === MinecraftDisplayMode.info ||
            this.props.carto.lastActiveMinecraftFlavor === undefined ||
            this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.none
          }
          theme={this.props.theme}
        />
      ),
      key: "info",
      onClick: this._setWelcomeMode,
      title: "Managing Minecraft",
    });

    if (CartoApp.isAppServiceWeb) {
      if (this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy) {
        toolbarItems.push({
          icon: (
            <DedicatedServerMinecraftLabel
              isCompact={isButtonCompact}
              theme={this.props.theme}
              isSelected={
                this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy &&
                this.state.mode === MinecraftDisplayMode.activeMinecraft
              }
            />
          ),
          key: "dedicatedServer",
          onClick: this._setDedicatedServerMode,
          title: "Deploy this project to Minecraft hosted locally",
        });
      }

      if (this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy) {
        toolbarItems.push({
          icon: (
            <WebSocketMinecraftLabel
              isCompact={isButtonCompact}
              theme={this.props.theme}
              isSelected={
                this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy &&
                this.state.mode === MinecraftDisplayMode.activeMinecraft
              }
            />
          ),
          key: "minecraftWebSockets",
          onClick: this._setWebSocketMode,
          title: "Deploy this project to Minecraft hosted locally",
        });
      }
    }

    if (
      this.props.carto.lastActiveMinecraftFlavor !== MinecraftFlavor.minecraftGameProxy &&
      this.props.carto.lastActiveMinecraftFlavor !== MinecraftFlavor.processHostedProxy
    ) {
      toolbarItems.push({
        icon: (
          <RemoteMinecraftLabel
            isCompact={isButtonCompact}
            isSelected={
              this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.remote &&
              this.state.mode === MinecraftDisplayMode.activeMinecraft
            }
            theme={this.props.theme}
          />
        ),
        key: "remote",
        onClick: this._setRemoteMinecraftMode,
        title: "Deploy this project to Minecraft hosted remotely",
      });
    }

    toolbarItems.push({
      icon: (
        <WorldSettingsLabel
          isCompact={isButtonCompact}
          isSelected={this.state.mode === MinecraftDisplayMode.worldSettings}
          theme={this.props.theme}
        />
      ),
      key: "worldSettings",
      onClick: this._setWorldSettingsMode,
      title: "Configure world settings",
    });

    toolbarItems.push({
      icon: (
        <ToolEditorLabel
          isCompact={isButtonCompact}
          isSelected={this.state.mode === MinecraftDisplayMode.toolEditor}
          theme={this.props.theme}
        />
      ),
      key: "toolEditor",
      onClick: this._setToolEditor,
      title: "Configure tool settings",
    });

    if (AppServiceProxy.hasAppService) {
      if (
        cs === CartoMinecraftState.stopped ||
        cs === CartoMinecraftState.none ||
        cs === CartoMinecraftState.error ||
        cs === CartoMinecraftState.disconnected
      ) {
        hostToolbarItems.push({
          icon: <ServerStartLabel isCompact={isButtonCompact} />,
          key: "serverStart",
          kind: "toggle",
          disabled:
            this.props.carto.defaultMinecraftFlavor === MinecraftFlavor.processHostedProxy &&
            this.props.carto.dedicatedServerMode === DedicatedServerMode.auto &&
            !this.props.carto.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms,
          onClick: this._startClick,
          active: true,
          title: "Start server",
        });
      } else if (cs === CartoMinecraftState.initializing) {
        hostToolbarItems.push({
          icon: <ServerInitializingLabel isCompact={isButtonCompact} />,
          key: "serverInitting",
          kind: "toggle",
          onClick: this._stopDedicatedServerClick,
          active: true,
          title: "Cancel server init; stop server",
        });
      } else if (cs === CartoMinecraftState.starting) {
        hostToolbarItems.push({
          icon: <ServerStartingLabel isCompact={isButtonCompact} />,
          key: "serverStarting",
          kind: "toggle",
          onClick: this._stopDedicatedServerClick,
          active: true,
          title: "Cancel server start; stop server",
        });
      } else if (cs === CartoMinecraftState.initialized) {
        hostToolbarItems.push({
          icon: <ServerInitializedLabel isCompact={isButtonCompact} />,
          key: "serverInitted",
          kind: "toggle",
          onClick: this._stopDedicatedServerClick,
          active: true,
          title: "Stop server",
        });
      } else if (cs === CartoMinecraftState.stopping) {
        hostToolbarItems.push({
          icon: <ServerStoppingLabel isCompact={isButtonCompact} />,
          key: "serverStop",
          kind: "toggle",
          onClick: this._stopDedicatedServerClick,
          active: true,
          title: "Stopping",
        });
      } else if (cs === CartoMinecraftState.started) {
        hostToolbarItems.push({
          icon: <ServerRestartLabel isCompact={isButtonCompact} />,
          key: "serverRestart",
          kind: "toggle",
          onClick: this._restartDedicatedServerClick,
          active: true,
          title: "Restart server",
        });
        hostToolbarItems.push({
          icon: <ServerStopLabel isCompact={isButtonCompact} />,
          key: "serverStop",
          kind: "toggle",
          onClick: this._stopDedicatedServerClick,
          active: true,
          title: "Stop server",
        });
      }
    }

    if (
      this.props.project &&
      (cs === CartoMinecraftState.initialized ||
        cs === CartoMinecraftState.prepared ||
        cs === CartoMinecraftState.started)
    ) {
      hostToolbarItems.push({
        icon: <PushToMinecraftLabel isCompact={isButtonCompact} />,
        key: "play",
        onClick: this._deployToMinecraft,
        title: "Deploy this project to Minecraft",
      });
    }

    if (
      this.state.mode === MinecraftDisplayMode.activeMinecraft &&
      this.props.carto.lastActiveMinecraftFlavor !== undefined &&
      this.props.carto.lastActiveMinecraftFlavor !== MinecraftFlavor.none
    ) {
      if (
        this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy &&
        (cs === CartoMinecraftState.none ||
          cs === CartoMinecraftState.error ||
          cs === CartoMinecraftState.disconnected ||
          cs === CartoMinecraftState.initializing ||
          cs === CartoMinecraftState.initialized)
      ) {
        interiorElements.push(<MinecraftGameSettingsPanel carto={this.props.carto} key="mcconnect" />);
      } else if (
        this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.remote &&
        (cs === CartoMinecraftState.none ||
          cs === CartoMinecraftState.error ||
          cs === CartoMinecraftState.disconnected ||
          cs === CartoMinecraftState.preparing ||
          cs === CartoMinecraftState.prepared ||
          cs === CartoMinecraftState.stopped ||
          cs === CartoMinecraftState.initializing ||
          cs === CartoMinecraftState.initialized)
      ) {
        interiorElements.push(
          <RemoteServerSettingsPanel
            forceCompact={this.props.forceCompact}
            carto={this.props.carto}
            key="rssp"
            ensureMinecraftOnLogin={this.props.ensureMinecraftOnLogin}
          />
        );
      } else if (
        this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy &&
        (cs === CartoMinecraftState.none ||
          cs === CartoMinecraftState.error ||
          cs === CartoMinecraftState.disconnected ||
          cs === CartoMinecraftState.initialized ||
          cs === CartoMinecraftState.preparing ||
          cs === CartoMinecraftState.prepared ||
          cs === CartoMinecraftState.stopped ||
          cs === CartoMinecraftState.initializing)
      ) {
        interiorElements.push(
          <DedicatedServerSettingsPanel
            carto={this.props.carto}
            key="dedicatedserverpanel"
            onChange={this._update}
            theme={this.props.theme}
          />
        );
      }

      if (
        cs !== CartoMinecraftState.none &&
        cs !== CartoMinecraftState.error &&
        cs !== CartoMinecraftState.disconnected &&
        cs !== CartoMinecraftState.initializing &&
        cs !== CartoMinecraftState.initialized &&
        cs !== CartoMinecraftState.preparing
      ) {
        let content = "";

        const command = this.props.carto.getCustomTool(0);

        if (command.text) {
          content = command.text;
        }

        const commanderArea = [];

        commanderArea.push(
          <div className="mid-logitemarea" key="logitemarea">
            <LogItemArea
              carto={this.props.carto}
              onSetExpandedSize={this._statusExpandedSizeChanged}
              mode={this.state.minecraftStatus}
              widthOffset={this.props.widthOffset}
            />
          </div>
        );

        // because electron doesn't work in debug electron due to odd pathing reasons, use a text editor instead
        if (Utilities.isDebug && CartoApp.hostType === HostType.electronWeb) {
          commanderArea.push(
            <div className="mid-commandEditorArea" key="commandtools">
              <TextEditor
                theme={this.props.theme}
                placeholder="<enter command>"
                onUpdatePreferredTextSize={this._updatePreferredTextSize}
                onUpdateContent={this._updateDefaultFunction}
                preferredTextSize={this.props.carto.preferredTextSize}
                readOnly={false}
                commitButton={true}
                singleLineMode={true}
                carto={this.props.carto}
                initialContent={content}
                onCommit={this._commitCommand}
              />
            </div>
          );
        } else {
          commanderArea.push(
            <div className="mid-commandEditorArea" key="commandtools" style={{ height: "50px" }}>
              <FunctionEditor
                theme={this.props.theme}
                project={this.props.project}
                initialContent={content}
                isCommandEditor={true}
                onUpdateContent={this._updateDefaultFunction}
                singleCommandMode={true}
                roleId={"commandEditorArea"}
                readOnly={false}
                carto={this.props.carto}
                onUpdatePreferredTextSize={this._updatePreferredTextSize}
                preferredTextSize={this.props.carto.preferredTextSize}
              />
            </div>
          );
        }

        interiorElements.push(
          <div className="mid-commander" key="commander">
            {commanderArea}
          </div>
        );

        if (this.state.world) {
          interiorElements.push(
            <div className="mid-map" key="maparea">
              <WorldView
                world={this.state.world}
                carto={this.props.carto}
                project={this.props.project}
                heightOffset={this.props.heightOffset + 340}
              />
            </div>
          );
        }

        interiorElements.push(
          <div className="mid-spacer" key="spacer1">
            &#160;
          </div>
        );

        const tools = [];

        if (this.state.allTools !== undefined) {
          for (let i = 0; i < this.state.allTools.length; i++) {
            const tool = this.state.allTools[i];

            const tt = (
              <ToolTile
                key={"tool" + i}
                carto={this.props.carto}
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
    } else if (this.state.mode === MinecraftDisplayMode.worldSettings) {
      interiorElements.push(
        <WorldManagerSettingsPanel carto={this.props.carto} project={this.props.project} key="wmspanel" />
      );
    } else if (
      this.state.mode === MinecraftDisplayMode.info ||
      this.props.carto.lastActiveMinecraftFlavor === undefined ||
      this.props.carto.lastActiveMinecraftFlavor === MinecraftFlavor.none
    ) {
      interiorElements.push(
        <MinecraftDisplayWelcomePanel
          carto={this.props.carto}
          key="mdwpanel"
          theme={this.props.theme}
          onPanelSelected={this._handlePanelSelected}
        />
      );
    } else if (this.state.mode === MinecraftDisplayMode.toolEditor) {
      interiorElements.push(
        <MinecraftToolEditor
          carto={this.props.carto}
          project={this.props.project}
          theme={this.props.theme}
          heightOffset={this.props.heightOffset}
        />
      );
    }

    return (
      <div className="mid-outer">
        <div className="mid-hostToolBarArea" key="hostToolBar">
          <Toolbar aria-label="Actions toolbar overflow menu" items={hostToolbarItems} />
        </div>
        <div
          className="mid-main"
          style={{
            minHeight: interiorHeight,
            maxHeight: interiorHeight,
          }}
        >
          {interiorElements}
        </div>
        <div className="mid-actionsToolBarArea" key="actionsToolBar">
          <Toolbar aria-label="Actions toolbar overflow menu" items={toolbarItems} />
        </div>
      </div>
    );
  }
}
