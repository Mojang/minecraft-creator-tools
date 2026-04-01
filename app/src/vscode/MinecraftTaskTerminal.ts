import * as vscode from "vscode";
import { CreatorToolsMinecraftState } from "../app/CreatorTools";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import CommandRegistry from "../app/CommandRegistry";
import { MinecraftFlavor } from "../app/ICreatorToolsData";
import IMinecraft, { IMinecraftMessage } from "../app/IMinecraft";
import Log, { LogItem } from "../core/Log";
import ExtensionManager from "./ExtensionManager";

export default class MinecraftTaskTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  onDidWrite: vscode.Event<string> = this.writeEmitter.event;

  private closeEmitter = new vscode.EventEmitter<number>();
  onDidClose?: vscode.Event<number> = this.closeEmitter.event;
  private _extensionManager: ExtensionManager;

  private _activeInput = "";
  private _promptLength = 7;
  private _taskDescription: string;
  private _isSolicitingCommands = false;

  constructor(
    private extensionManager: ExtensionManager,
    private taskDescription: string,
    private flags: string[],
    private getSharedState: () => string | undefined,
    private setSharedState: (state: string) => void
  ) {
    this.output = this.output.bind(this);
    this.handleLog = this.handleLog.bind(this);
    this.closeServerOnStart = this.closeServerOnStart.bind(this);

    this._extensionManager = extensionManager;
    this._taskDescription = taskDescription;
  }

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    switch (this._taskDescription) {
      case "deployToRemote":
        this.deployToRemote();
        break;

      case "deploy":
        this.deploy();
        break;

      case "deployToLocal":
        this.deployToInternal();
        break;

      default:
        this.startRegular("Welcome to Minecraft Terminal.");
        this.solicitCommands();
        break;
    }
  }

  close(): void {
    // The terminal has been closed. Shutdown the build.
    Log.onItemAdded.unsubscribe(this.handleLog);
  }

  closeTerminal(): void {
    Log.onItemAdded.unsubscribe(this.handleLog);

    this.closeEmitter.fire(0);
  }

  output(message: string) {
    this.writeEmitter.fire(message);
  }

  outputLine(message: string) {
    this.writeEmitter.fire(message + "\n");
  }

  handleInput(data: string) {
    if (!data) {
      return;
    }

    if (data === "\x7f") {
      // Backspace
      if (this._activeInput.length === 0) {
        return;
      }
      this._activeInput = this._activeInput.substring(0, this._activeInput.length - 1);
      // Move cursor backward
      this.output("\x1b[D");
      // Delete character
      this.output("\x1b[P");
      return;
    } else if (data.length >= 1 && data.charCodeAt(0) === 13) {
      const command = this._activeInput;
      this._activeInput = "";
      this.output("\n");
      this.outputPrompt();
      const ct = CreatorToolsHost.getCreatorTools();

      if (ct) {
        CommandRegistry.main.runCommand(
          {
            creatorTools: ct,
            project: this.extensionManager.getProject(),
            host: CreatorToolsHost.hostManager,
            minecraft: ct.activeMinecraft,
          },
          command
        );
      }
      /*
      if (command === "serve") {
        this._extensionManager.developUsingDedicatedServer();
      } else if (CreatorToolsHost.carto && CreatorToolsHost.carto.activeMinecraft && command.length > 1) {
        //this.logLine("Could not send command '" + data + "'. Minecraft is not active.");
        //return;
        CreatorToolsHost.carto.activeMinecraft.runCommand(command).then((value: string | undefined) => {
          this.outputPrompt();
        });
      }*/
    } else {
      this._activeInput += data;
      if (this._isSolicitingCommands) {
        this.output(data);
      }
    }
  }

  private async deploy() {
    if (CreatorToolsHost.hostType === HostType.vsCodeWebService) {
      await this.deployToRemote();
    } else {
      await this.deployToInternal();
    }
  }

  private hookNewMinecraft(minecraft: IMinecraft) {
    minecraft.onMessage.subscribe(this.handleNewMinecraftMessage);
  }

  private handleNewMinecraftMessage(minecraft: IMinecraft, message: IMinecraftMessage) {
    this.outputLine(message.message);
  }

  private async deployToRemote(): Promise<void> {
    this.renderHeader("Starting deployment to remote server...", "");
    Log.onItemAdded.subscribe(this.handleLog);

    const folders = vscode.workspace.workspaceFolders;

    if (!folders) {
      this.printLine("No folders available to publish.");
      this.closeTerminal();
      return;
    }

    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct) {
      this.printLine("Minecraft Creator Tools is not ready.");
      this.closeTerminal();
      return;
    }

    await ct.load(true);

    if (!this._extensionManager.context) {
      this.printLine("(Internal error: context is not ready.)");
      this.closeTerminal();
      return;
    }

    if (ct.remoteServerUrl === undefined || ct.remoteServerPasscode === undefined) {
      this.printLine("Remote server url/passcode is not defined. Use the Minecraft settings pane to set this up.\n");
      this.closeTerminal();
      return;
    }

    ct.ensureRemoteMinecraft();

    if (!ct.remoteMinecraft) {
      this.printLine("Unexpected inability to configure remote Minecraft connection.");
      this.closeTerminal();
      return;
    }

    this.hookNewMinecraft(ct.remoteMinecraft);

    if (!ct.remoteServerAuthToken) {
      await ct.remoteMinecraft.initialize();
    }

    if (!ct.remoteServerAuthToken) {
      this.printLine("Could not authenticate to server. Check your URL and passcode.");
      this.closeTerminal();
      return;
    }

    try {
      for (const folder of folders) {
        const result = await this._extensionManager.ensureStorageAndProjectForFolder(
          this._extensionManager.context,
          folder
        );

        if (result.project) {
          this.printLine(
            "Publishing project '" +
              result.project.projectFolder?.storageRelativePath +
              "' to '" +
              ct.fullRemoteServerUrl +
              "'"
          );

          await ct.remoteMinecraft?.prepareAndStart({
            project: result.project,
          });
        } else {
          this.output("Could not establish project for folder '" + folder + "'\n");
        }
      }
    } catch (e) {
      this.printLine("Error publishing to remote minecraft: " + e);
    }

    this.printLine("Done with publish.");

    this.closeTerminal();
  }

  private handleLog(log: Log, item: LogItem) {
    this.printLine(item.message);
  }

  private printLine(message: string) {
    if (this._isSolicitingCommands) {
      // remove existing line of input.
      const promptLength = this._promptLength + this._activeInput.length;

      for (let i = 0; i < promptLength; i++) {
        this.output("\x1b[D");
        // Delete character
        this.output("\x1b[P");
      }
    }

    this.outputLine(message);

    if (this._isSolicitingCommands) {
      this.outputPrompt();
      this.output(this._activeInput);
    }
  }

  private outputPrompt() {
    let prompt = "\x1b[32mmc\x1b[0m";

    this._promptLength = 0;

    const ct = CreatorToolsHost.getCreatorTools();
    if (ct) {
      if (ct.activeMinecraft) {
        if (ct.activeMinecraftState === CreatorToolsMinecraftState.started) {
          prompt += "\x1b[32m";
        } else if (
          ct.activeMinecraftState === CreatorToolsMinecraftState.starting ||
          ct.activeMinecraftState === CreatorToolsMinecraftState.initialized ||
          ct.activeMinecraftState === CreatorToolsMinecraftState.initializing
        ) {
          prompt += "\x1b[33m";
        } else {
          prompt += "\x1b[31m";
        }

        if (ct.lastActiveMinecraftFlavor === MinecraftFlavor.minecraftGameProxy) {
          prompt += "+game";
          this._promptLength += 5;
        }

        if (ct.lastActiveMinecraftFlavor === MinecraftFlavor.remote) {
          prompt += "+remote";
          this._promptLength += 7;
        }

        if (ct.lastActiveMinecraftFlavor === MinecraftFlavor.processHostedProxy) {
          prompt += "+server";
          this._promptLength += 7;
        }

        prompt += "\x1b[0m";
      }
    }

    prompt = prompt + ">";

    this._promptLength += 5; // two spaces + mc + >
    this.output(" " + prompt + " " + this._activeInput);
  }

  private renderHeader(message: string, secondaryMessage: string) {
    this.outputLine("\x1b[32m┌─────┐\x1b[0m");
    this.outputLine("\x1b[32m│ ▄ ▄ │\x1b[0m " + message);
    this.outputLine("\x1b[32m│ ┏▀┓ │\x1b[0m " + secondaryMessage);
    this.outputLine("\x1b[32m└─────┘\x1b[0m");
  }

  private solicitCommands() {
    this.outputPrompt();
    this._isSolicitingCommands = true;
  }

  private async startRegular(message: string) {
    this.renderHeader(message, "\x1b[37mType 'help' for more commands.\x1b[0m");
    Log.onItemAdded.subscribe(this.handleLog);

    const folders = vscode.workspace.workspaceFolders;

    if (!folders) {
      this.printLine("No folders available to publish.");
      this.closeTerminal();
      return;
    }

    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct) {
      this.printLine("Minecraft Creator Tools is not ready.");
      this.closeTerminal();
      return;
    }

    await ct.load(true);

    if (!this._extensionManager.context) {
      this.printLine("(Internal error: context is not ready.)");
      this.closeTerminal();
      return;
    }

    if (ct.processHostedMinecraft) {
      this.hookNewMinecraft(ct.processHostedMinecraft);
    }

    if (ct.gameMinecraft) {
      this.hookNewMinecraft(ct.gameMinecraft);
    }
  }

  private async deployToInternal(): Promise<void> {
    await this.startRegular("Starting deployment to internal server...");

    const folders = vscode.workspace.workspaceFolders;

    if (!folders) {
      this.printLine("(Type 'newProject' to open a folder with Minecraft artifacts to get started.)");
      return;
    }
    const ct = CreatorToolsHost.getCreatorTools();

    if (!this._extensionManager.context || !ct) {
      this.printLine("(Internal error: context is not ready.)");
      this.closeTerminal();
      return;
    }

    const mc = ct.ensureMinecraft(MinecraftFlavor.processHostedProxy);

    if (!mc) {
      this.printLine("(Could not set active Minecraft.)");
      return;
    }

    try {
      for (const folder of folders) {
        const result = await this._extensionManager.ensureStorageAndProjectForFolder(
          this._extensionManager.context,
          folder
        );

        if (result.project) {
          this.printLine(
            "Publishing project '" + result.project.projectFolder?.fullPath + "' to locally hosted Minecraft server."
          );

          mc.onRefreshed.subscribe(this.closeServerOnStart);
          mc.onStateChanged.subscribe(this.closeServerOnStart);

          await mc.prepareAndStart({
            project: result.project,
          });
        } else {
          this.printLine("Could not establish project for folder '" + folder + "'");
        }
      }
    } catch (e) {
      this.printLine("Error publishing to locally hosted minecraft: " + e);
    }

    // don't close the terminal yet because we may still be waiting for BDS to load and start.
    // we basically need to trap all events and call closeServerOnStart appropriately
    //    this.closeTerminal();
  }

  public closeServerOnStart(minecraft: IMinecraft, state: CreatorToolsMinecraftState) {
    if (state === CreatorToolsMinecraftState.started) {
      this.closeTerminal();
    }
  }
}
