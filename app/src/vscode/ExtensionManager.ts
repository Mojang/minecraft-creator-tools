// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ExtensionManager - Central orchestrator for the Minecraft Creator Tools VS Code extension.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE OVERVIEW
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * This file is the "brain" of the VS Code extension, managing the complex interplay between:
 *   1. VS Code's extension lifecycle (activation, deactivation, workspace events)
 *   2. The shared CreatorTools codebase (also used by web app, CLI, Electron app)
 *   3. Webview-based UI panels (which run in isolated browser contexts)
 *   4. Storage abstraction layer (file system, mementos, proxies)
 *   5. Minecraft connectivity (local game, dedicated server, remote server)
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * VS CODE EXTENSION LIFECYCLE
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * VS Code extensions have a specific lifecycle that this class hooks into:
 *
 *   ┌─────────────────────────────────────────────────────────────────────────────────┐
 *   │  1. CONSTRUCTION (new ExtensionManager())                                       │
 *   │     - Called from extension.ts when VS Code loads the extension                 │
 *   │     - Sets up CreatorToolsHost.hostType (vsCodeMainNodeJs or vsCodeWebService)  │
 *   │     - Registers command handlers with CommandRegistry                           │
 *   │     - Binds all event handler methods to `this`                                 │
 *   └─────────────────────────────────────────────────────────────────────────────────┘
 *                                       ↓
 *   ┌─────────────────────────────────────────────────────────────────────────────────┐
 *   │  2. ACTIVATION (activate(context))                                              │
 *   │     - Called when extension is first needed (command invoked, file opened, etc.)│
 *   │     - Stores ExtensionContext (subscriptions, globalState, extensionUri, etc.)  │
 *   │     - Registers all VS Code providers:                                          │
 *   │       • WebviewViewProviders (sidebar panels)                                   │
 *   │       • CustomEditorProviders (JSON editor, structure editor)                   │
 *   │       • TaskProvider (Minecraft build tasks)                                    │
 *   │       • TerminalProfileProvider (Minecraft terminal)                            │
 *   │       • LanguageProviders (completions, hover, diagnostics, definitions)        │
 *   │       • Chat Participant and LM Tools (@minecraft language integration)         │
 *   │     - Sets up workspace folder tracking and project management                  │
 *   └─────────────────────────────────────────────────────────────────────────────────┘
 *                                       ↓
 *   ┌─────────────────────────────────────────────────────────────────────────────────┐
 *   │  3. RUNTIME (extension is active)                                               │
 *   │     - Responds to commands, file changes, workspace folder changes              │
 *   │     - Manages Project instances per workspace folder                            │
 *   │     - Proxies messages between webviews and storage layer                       │
 *   │     - Handles deployment to Minecraft (local, remote, dedicated server)         │
 *   └─────────────────────────────────────────────────────────────────────────────────┘
 *                                       ↓
 *   ┌─────────────────────────────────────────────────────────────────────────────────┐
 *   │  4. DEACTIVATION (deactivate())                                                 │
 *   │     - Called when VS Code shuts down or extension is disabled                   │
 *   │     - Disposes task providers and cleans up resources                           │
 *   └─────────────────────────────────────────────────────────────────────────────────┘
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * CLIENT-SERVER ARCHITECTURE (Webviews ↔ Extension Host)
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * VS Code webviews run in isolated browser contexts and cannot directly access:
 *   - Node.js APIs (fs, path, etc.)
 *   - VS Code extension APIs
 *   - The file system
 *
 * This creates a "client-server" model within the extension:
 *
 *   ┌─────────────────────────┐        Messages (postMessage)       ┌─────────────────────┐
 *   │   WEBVIEW (Browser)     │ ◄────────────────────────────────► │  EXTENSION HOST     │
 *   │                         │                                     │  (Node.js)          │
 *   │  • React UI components  │   { command, id, data }             │                     │
 *   │  • Monaco editor        │   ─────────────────────►            │  • ExtensionManager │
 *   │  • BabylonJS 3D views   │                                     │  • StorageProxy     │
 *   │  • Project editing      │   { command, id, data }             │  • VsFsStorage      │
 *   │                         │   ◄─────────────────────            │  • Project          │
 *   └─────────────────────────┘                                     └─────────────────────┘
 *
 * MESSAGE FLOW:
 *   1. Webview calls vscode.postMessage({ command: "asyncopenItem", data: {...} })
 *   2. CreatorToolsHost.onMessage fires in extension host
 *   3. ExtensionManager.doInit() handler processes the message
 *   4. For storage operations, StorageProxy translates to file system calls
 *   5. Response sent back via sendMessageToBrowser()
 *
 * KEY CLASSES IN THIS FLOW:
 *   • StorageProxy - Wraps IStorage with message-based async interface for webviews
 *   • VsFsStorage - IStorage implementation using VS Code's vscode.workspace.fs API
 *   • MementoStorage - IStorage implementation using VS Code's globalState (key-value)
 *   • CreatorToolsHost - Static singleton that webviews use to send messages
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * STORAGE ARCHITECTURE
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Multiple storage backends are used for different purposes:
 *
 *   ┌──────────────────────┬────────────────────────────────────────────────────────────────┐
 *   │ Storage              │ Purpose                                                        │
 *   ├──────────────────────┼────────────────────────────────────────────────────────────────┤
 *   │ _extensionStorage    │ Read-only access to extension's bundled files (data/, res/)   │
 *   │ _prefsStorageProxy   │ User preferences stored in VS Code globalState                │
 *   │ _projectsStorageProxy│ Project metadata stored in VS Code globalState                │
 *   │ _worldStorageProxy   │ World/backup data stored in VS Code globalState               │
 *   │ _storageByWorkspace  │ Per-workspace-folder file system storage (VsFsStorage)        │
 *   └──────────────────────┴────────────────────────────────────────────────────────────────┘
 *
 * Each storage has a corresponding StorageProxy for webview communication:
 *   • Encodes binary data as base64 for safe message passing
 *   • Handles alternate contents (for unsaved editor buffers)
 *   • Routes file/folder operations to the underlying IStorage
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * PROJECT MANAGEMENT
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Each workspace folder can have an associated Project:
 *
 *   _projectsByWorkspaceFolder: { [workspaceUri: string]: Project }
 *
 * Projects are created lazily via ensureStorageAndProjectForFolder():
 *   1. Check if project already exists in cache
 *   2. Create VsFsStorage for the folder
 *   3. Create Project instance with the storage
 *   4. Call project.inferProjectItemsFromFiles() to scan for Minecraft content
 *   5. Cache for future use
 *
 * NEW PROJECT CREATION (complex flow due to VS Code workspace limitations):
 *   1. User selects template from gallery (quickNewStart)
 *   2. User selects folder location
 *   3. Request added to _pendingFolderPopulationRequests (persisted in globalState)
 *   4. If workspace was empty, adding folder causes extension RESTART
 *   5. On restart, considerPendingPopulationRequests() processes pending requests
 *   6. Files downloaded from GitHub and written to folder
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * LANGUAGE PROVIDERS (IntelliSense)
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Registered in registerLanguageProviders() for JSON files:
 *
 *   • McDiagnosticProvider - Runs MCTools validators, shows issues in Problems panel
 *   • McCodeActionProvider - Provides Quick Fix actions from MCTools updaters
 *   • McCompletionProvider - Cross-file completions (textures, geometries, events)
 *   • McHoverProvider - Rich documentation on hover (components, Molang, versions)
 *   • McDefinitionProvider - Go-to-definition for cross-file references
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * LANGUAGE INTEGRATION
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Registered in registerLanguageIntegration():
 *
 *   • McToolsChatParticipant - @minecraft chat participant for Copilot Chat
 *   • McToolsLmTools - Language model tools that Copilot can invoke
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * VS CODE DESKTOP vs WEB (vscode.dev) - CRITICAL DIFFERENCES
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * This extension supports TWO fundamentally different VS Code environments:
 *
 *   ┌─────────────────────────────────────────────────────────────────────────────────────┐
 *   │  VS CODE DESKTOP (Main/Traditional)                                                │
 *   │  ─────────────────────────────────────────────────────────────────────────────────  │
 *   │  • Extension Host runs in FULL Node.js environment                                 │
 *   │  • Has access to: fs, path, child_process, net, etc.                               │
 *   │  • Can spawn subprocesses (e.g., Dedicated Server)                                 │
 *   │  • Can use Node.js native modules                                                  │
 *   │  • CreatorToolsHost.hostType = HostType.vsCodeMainNodeJs                           │
 *   │  • Build artifact: "vscore" (webpack.vsccore.config.js)                            │
 *   └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 *   ┌─────────────────────────────────────────────────────────────────────────────────────┐
 *   │  VS CODE WEB (vscode.dev, github.dev, Codespaces web)                              │
 *   │  ─────────────────────────────────────────────────────────────────────────────────  │
 *   │  • Extension Host runs in a WEB WORKER environment (NOT Node.js!)                  │
 *   │  • NO access to: fs, path, child_process, or any Node.js APIs                      │
 *   │  • Cannot spawn subprocesses                                                       │
 *   │  • Must use VS Code's vscode.workspace.fs for ALL file operations                  │
 *   │  • Many npm packages will NOT work (if they depend on Node.js)                     │
 *   │  • CreatorToolsHost.hostType = HostType.vsCodeWebService                           │
 *   │  • Build artifact: "vscoreweb" (webpack.vsccoreweb.config.js)                      │
 *   └─────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️  DEVELOPER WARNING: When adding new code to the extension host (this file and
 *     anything it imports), you MUST ensure it works in BOTH environments:
 *
 *     ❌ DON'T: import fs from "fs"           - Only works in Desktop
 *     ❌ DON'T: import path from "path"       - Only works in Desktop
 *     ❌ DON'T: require("child_process")      - Only works in Desktop
 *     ❌ DON'T: Use __dirname or __filename   - Only works in Desktop
 *
 *     ✅ DO: Use vscode.workspace.fs          - Works in both
 *     ✅ DO: Use vscode.Uri.joinPath()        - Works in both
 *     ✅ DO: Check CreatorToolsHost.isVsCodeWebService before using Node.js APIs
 *     ✅ DO: Use dynamic imports for Node.js-only code paths
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * BUILD ARTIFACTS (Extension Compilation)
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * The extension is compiled into THREE separate webpack bundles:
 *
 *   ┌──────────────────┬──────────────────────────────────────────────────────────────────┐
 *   │ Artifact         │ Description                                                      │
 *   ├──────────────────┼──────────────────────────────────────────────────────────────────┤
 *   │ vscore           │ Extension Host bundle for VS Code DESKTOP                        │
 *   │                  │ • Compiled by: webpack.vsccore.config.js                         │
 *   │                  │ • Target: node (full Node.js environment)                        │
 *   │                  │ • Output: toolbuild/vscode/dist/extension.js                     │
 *   │                  │ • Can use Node.js APIs, spawn processes, etc.                    │
 *   ├──────────────────┼──────────────────────────────────────────────────────────────────┤
 *   │ vscoreweb        │ Extension Host bundle for VS Code WEB                            │
 *   │                  │ • Compiled by: webpack.vsccoreweb.config.js                      │
 *   │                  │ • Target: webworker (browser web worker, NOT Node.js!)           │
 *   │                  │ • Output: toolbuild/vscode/dist/web/extension.js                 │
 *   │                  │ • Must polyfill or avoid Node.js APIs                            │
 *   │                  │ • Many npm packages need special handling or alternatives        │
 *   ├──────────────────┼──────────────────────────────────────────────────────────────────┤
 *   │ vscweb           │ Webview UI bundle (shared by both Desktop and Web)               │
 *   │                  │ • Compiled by: webpack.vscweb.config.js                          │
 *   │                  │ • Target: web (browser context)                                  │
 *   │                  │ • Output: toolbuild/vscode/dist/web/site.js                      │
 *   │                  │ • Contains React components, Monaco, BabylonJS, etc.             │
 *   │                  │ • Communicates with extension host via postMessage               │
 *   └──────────────────┴──────────────────────────────────────────────────────────────────┘
 *
 * BUILD COMMANDS:
 *   • npm run vscbuild       - Builds ALL three artifacts (full extension build)
 *   • npm run vscorebuild    - Builds only vscore (desktop extension host)
 *   • npm run vscorewebbuild - Builds only vscoreweb (web extension host)
 *   • npm run vscwebbuild    - Builds only vscweb (webview UI)
 *
 * ARCHITECTURE DIAGRAM:
 *
 *   VS Code Desktop:                        VS Code Web (vscode.dev):
 *   ┌─────────────────────────────┐         ┌─────────────────────────────┐
 *   │     VS Code Desktop App     │         │      Browser (Chrome)       │
 *   │  ┌───────────────────────┐  │         │  ┌───────────────────────┐  │
 *   │  │  Extension Host       │  │         │  │  Web Worker           │  │
 *   │  │  (Node.js process)    │  │         │  │  (NOT Node.js!)       │  │
 *   │  │  ┌─────────────────┐  │  │         │  │  ┌─────────────────┐  │  │
 *   │  │  │    vscore       │  │  │         │  │  │   vscoreweb     │  │  │
 *   │  │  │  (extension.js) │  │  │         │  │  │ (extension.js)  │  │  │
 *   │  │  └─────────────────┘  │  │         │  │  └─────────────────┘  │  │
 *   │  └───────────────────────┘  │         │  └───────────────────────┘  │
 *   │           ▲                 │         │           ▲                 │
 *   │           │ postMessage     │         │           │ postMessage     │
 *   │           ▼                 │         │           ▼                 │
 *   │  ┌───────────────────────┐  │         │  ┌───────────────────────┐  │
 *   │  │  Webview (iframe)     │  │         │  │  Webview (iframe)     │  │
 *   │  │  ┌─────────────────┐  │  │         │  │  ┌─────────────────┐  │  │
 *   │  │  │     vscweb      │  │  │         │  │  │     vscweb      │  │  │
 *   │  │  │   (site.js)     │  │  │         │  │  │   (site.js)     │  │  │
 *   │  │  └─────────────────┘  │  │         │  │  └─────────────────┘  │  │
 *   │  └───────────────────────┘  │         │  └───────────────────────┘  │
 *   └─────────────────────────────┘         └─────────────────────────────┘
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * MINECRAFT CONNECTIVITY
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 * Three deployment modes, selected via developUsingXxx commands:
 *
 *   1. MinecraftFlavor.minecraftGameProxy - Deploy to local Minecraft game (websocket)
 *   2. MinecraftFlavor.processHostedProxy - Run embedded Dedicated Server (BDS)
 *   3. MinecraftFlavor.remote - Deploy to remote MCTools server (HTTP)
 *
 * The deployWorldToRemote() and deployToInternal() methods handle the actual deployment,
 * pushing project content to the selected Minecraft instance.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────────
 * RELATED FILES
 * ───────────────────────────────────────────────────────────────────────────────────────────
 *
 *   extension.ts         - Entry point, creates ExtensionManager instance
 *   CreatorToolsHost.ts  - Static singleton for cross-platform host abstraction
 *   StorageProxy.ts      - Message-based storage wrapper for webviews
 *   VsFsStorage.ts       - IStorage implementation for VS Code file system
 *   MementoStorage.ts    - IStorage implementation for VS Code globalState
 *   MainViewProvider.ts  - Sidebar webview panel provider
 *   JsonEditorProvider.ts - Custom editor for Minecraft JSON files
 *   providers/           - Language providers (completions, hover, diagnostics, etc.)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 */

import * as vscode from "vscode";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import Database from "../minecraft/Database";
import MementoStorage from "./MementoStorage";
import Log, { LogItem, LogItemLevel } from "../core/Log";
import Utilities from "../core/Utilities";
import VsLocalUtilities from "./VsLocalUtilities";
import StructureEditorProvider from "./StructureEditorProvider";
import JsonEditorProvider from "./JsonEditorProvider";
import MainViewProvider from "./MainViewProvider";
import StorageProxy from "../storage/StorageProxy";
import { MinecraftTaskProvider } from "./MinecraftTaskProvider";
import { MinecraftPushWorldType } from "../app/MinecraftPush";
import Project from "../app/Project";
import ProjectExporter from "../app/ProjectExporter";
import VsFsStorage from "./VsFsStorage";
import IStorage from "../storage/IStorage";
import StartPageProvider from "./StartPageProvider";
import IMinecraft from "../app/IMinecraft";
import MinecraftTaskTerminal from "./MinecraftTaskTerminal";
import ValidationPageProvider from "./ValidationPageProvider";
import { MinecraftFlavor } from "../app/ICreatorToolsData";
import IGalleryItem, { GalleryItemType } from "../app/IGalleryItem";
import CommandRegistry, { CommandScope } from "../app/CommandRegistry";
import IContext from "../app/IContext";
import { CommandStatus } from "../app/ICommand";
import ILocalUtilities from "../core/ILocalUtilities";
import ProjectUtilities from "../app/ProjectUtilities";
import ProjectCreateManager from "../app/ProjectCreateManager";
import {
  McDiagnosticProvider,
  McCodeActionProvider,
  McCompletionProvider,
  McHoverProvider,
  McDefinitionProvider,
  McDecorationProvider,
  McToolsChatParticipant,
  McToolsLmTools,
} from "./providers";
import McPreviewPanel from "./McPreviewPanel";

export default class ExtensionManager {
  public activeProjectPath: string = "";

  public context: vscode.ExtensionContext | undefined;

  isActivated = false;
  _willBeRebooted = false;
  processHostedMinecraft: IMinecraft | undefined;
  gameMinecraft: IMinecraft | undefined;

  sharedState: string = "";

  _terminals: MinecraftTaskTerminal[] = [];

  _webViewsByChannelId: { [channelId: string]: vscode.Webview[] } = {};
  _storageProxyByWorkspaceFolder: { [workspaceUriPath: string]: StorageProxy } = {};
  _storageByWorkspaceFolder: { [workspaceUriPath: string]: IStorage } = {};
  _projectsByWorkspaceFolder: { [workspaceUriPath: string]: Project } = {};
  _extensionStorage: VsFsStorage | undefined;
  _prefsStorageProxy: StorageProxy | undefined;
  _worldStorageProxy: StorageProxy | undefined;
  _projectsStorageProxy: StorageProxy | undefined;
  _extensionStorageProxy: StorageProxy | undefined;
  _packStorageProxy: StorageProxy | undefined;
  _minecraftTaskProviderDisposable: vscode.Disposable | undefined;

  // Language providers for enhanced IntelliSense
  _diagnosticProvider: McDiagnosticProvider | undefined;
  _codeActionProvider: McCodeActionProvider | undefined;
  _completionProvider: McCompletionProvider | undefined;
  _hoverProvider: McHoverProvider | undefined;
  _definitionProvider: McDefinitionProvider | undefined;
  _decorationProvider: McDecorationProvider | undefined;

  // Language integration: Chat participant and LM tools
  _chatParticipant: McToolsChatParticipant | undefined;
  _lmTools: McToolsLmTools | undefined;

  static _pendingFolderPopulationRequests: {
    name: string;
    workspaceUri: string;
    project: IGalleryItem;
    time: number;
  }[] = [];

  constructor(isWeb: boolean) {
    this.workspaceFoldersChanged = this.workspaceFoldersChanged.bind(this);
    this.considerPendingPopulationRequests = this.considerPendingPopulationRequests.bind(this);
    this.quickNewStartCommand = this.quickNewStartCommand.bind(this);
    this.addItemToProject = this.addItemToProject.bind(this);
    this.deployToRemoteCommand = this.deployToRemoteCommand.bind(this);
    this.developUsingDedicatedServerCommand = this.developUsingDedicatedServerCommand.bind(this);
    this.developUsingMinecraftGameCommand = this.developUsingMinecraftGameCommand.bind(this);
    this.developUsingRemoteMinecraftCommand = this.developUsingRemoteMinecraftCommand.bind(this);
    this.deployToInternalCommand = this.deployToInternalCommand.bind(this);

    CreatorToolsHost.hostManager = this;

    if (isWeb) {
      CreatorToolsHost.hostType = HostType.vsCodeWebService;
    } else {
      CreatorToolsHost.hostType = HostType.vsCodeMainNodeJs;
    }

    CommandRegistry.main.registerCommand("newproject", CommandScope.any, this.quickNewStartCommand);
    CommandRegistry.main.registerCommand("deploytoserver", CommandScope.any, this.deployToInternalCommand);
    CommandRegistry.main.registerCommand("deploytoremote", CommandScope.any, this.deployToRemoteCommand);
    CommandRegistry.main.registerCommand(
      "developusingdedicatedserver",
      CommandScope.any,
      this.developUsingDedicatedServerCommand
    );
    CommandRegistry.main.registerCommand(
      "developusingminecraftgame",
      CommandScope.any,
      this.developUsingMinecraftGameCommand
    );
    CommandRegistry.main.registerCommand(
      "developusingremoteminecraft",
      CommandScope.any,
      this.developUsingRemoteMinecraftCommand
    );
  }

  public activate(context: vscode.ExtensionContext) {
    this.context = context;

    CreatorToolsHost.contentWebRoot = context.extensionUri.toString();

    // For VS Code extension, use mctools.dev for vanilla content (textures, samples, vanilla packs)
    // since we don't bundle the large vanilla packs with the extension
    CreatorToolsHost.vanillaContentRoot = "https://mctools.dev/";

    Log.verbose("Loaded Minecraft Creator Tools @ " + new Date().toTimeString());
    this.isActivated = true;

    Utilities.setIsDebug(context.extensionMode === vscode.ExtensionMode.Development);

    Log.onItemAdded.subscribe(this.handleNewLogMessage);

    LogItem.alertFunction = this.logAsAlert;

    this.doInit(context);

    this.doInitAsync(context);

    const provider = new MainViewProvider(context, context.extensionUri, this);

    context.subscriptions.push(vscode.window.registerWebviewViewProvider(MainViewProvider.viewType, provider));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(MainViewProvider.explorerViewType, provider));

    context.subscriptions.push(StartPageProvider.register(context, this));
    context.subscriptions.push(StructureEditorProvider.register(context, this));
    context.subscriptions.push(JsonEditorProvider.register(context, this));

    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(this.workspaceFoldersChanged));

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.showTerminal", () => {
        const term = new MinecraftTaskTerminal(
          this,
          "",
          [""],
          () => this.sharedState,
          (state: string) => (this.sharedState = state)
        );

        this._terminals.push(term);

        const terminal = vscode.window.createTerminal({ name: `Minecraft`, pty: term });
        terminal.show();
      })
    );

    const me = this;

    context.subscriptions.push(
      vscode.window.registerTerminalProfileProvider("mctools.minecraft", {
        provideTerminalProfile(token: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalProfile> {
          const term = new MinecraftTaskTerminal(
            me,
            "",
            [""],
            () => me.sharedState,
            (state: string) => (me.sharedState = state)
          );

          me._terminals.push(term);

          return {
            options: { name: `Minecraft`, pty: term },
          };
        },
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.quickNewStart", () => {
        if (this.context) {
          this.quickNewStart();
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.addItem", () => {
        if (this.context) {
          this.addItemToProject();
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.developUsingDedicatedServer", () => {
        if (this.context) {
          this.developUsingDedicatedServer();
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.developUsingMinecraftGame", () => {
        if (this.context) {
          this.developUsingMinecraftGame();
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.developUsingRemoteMinecraft", () => {
        if (this.context) {
          this.developUsingRemoteMinecraft();
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.showStartPage", () => {
        if (this.context) {
          StartPageProvider.show(this.context.extensionUri, this);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.showInfoPage", () => {
        if (this.context) {
          ValidationPageProvider.show(this.context.extensionUri, this);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.packageWorld", () => {
        this.updatePackageBuilds();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.showMinecraftPane", () => {
        if (this.context) {
          const panel = vscode.window.createWebviewPanel("mctools", "Minecraft Viewer", vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
          });

          panel.webview.onDidReceiveMessage((e: any) => {
            CreatorToolsHost.notifyNewMessage(panel.webview, e);
          });

          this.registerWebview(this.activeProjectPath, panel.webview);
          panel.webview.html = this.getWebviewContent(panel.webview, "codetoolbox");
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.deployToRemote", () => {
        if (this.context) {
          this.deployWorldToRemote();
        }
      })
    );

    const workspaceRoot =
      vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : undefined;

    if (!workspaceRoot) {
      return;
    }

    this._minecraftTaskProviderDisposable = vscode.tasks.registerTaskProvider(
      MinecraftTaskProvider.MinecraftTasksType,
      new MinecraftTaskProvider(this)
    );

    // Register Minecraft language providers for enhanced IntelliSense
    this.registerLanguageProviders(context);

    // Register language integration (Chat Participant and Language Model Tools)
    this.registerLanguageIntegration(context);

    // Register Live Preview commands
    this.registerPreviewCommands(context);

    // Register editor switch commands (MCTools editor vs text editor)
    this.registerEditorSwitchCommands(context);

    Log.verbose("Done loading Minecraft Creator Tools @ " + new Date().toTimeString());
  }

  public getProject() {
    for (const projName in this._projectsByWorkspaceFolder) {
      return this._projectsByWorkspaceFolder[projName];
    }

    return undefined;
  }

  /**
   * Register language providers for Minecraft JSON files.
   * This provides enhanced IntelliSense, diagnostics, quick fixes, and navigation.
   */
  private registerLanguageProviders(context: vscode.ExtensionContext): void {
    const jsonSelector: vscode.DocumentSelector = {
      language: "json",
      scheme: "file",
    };

    // Storage provider for language providers that need project access
    const storageProvider = (uri: vscode.Uri): IStorage | undefined => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        return undefined;
      }
      return this._storageByWorkspaceFolder[workspaceFolder.uri.toString()];
    };

    // 1. Diagnostics - wire MCTools validators to Problems panel
    this._diagnosticProvider = new McDiagnosticProvider(storageProvider);
    this._diagnosticProvider.activate(context);

    // 2. Code Actions / Quick Fixes - wire MCTools updaters to fix menu
    this._codeActionProvider = new McCodeActionProvider(storageProvider);
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(jsonSelector, this._codeActionProvider, {
        providedCodeActionKinds: McCodeActionProvider.providedCodeActionKinds,
      })
    );

    // 3. Completions - cross-file IntelliSense (texture paths, geometries, events, etc.)
    this._completionProvider = new McCompletionProvider(storageProvider);
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        jsonSelector,
        this._completionProvider,
        '"', // Trigger on quote
        ":", // Trigger on colon
        "/" // Trigger on path separator
      )
    );

    // 4. Hover - rich documentation for components, format_version, Molang
    this._hoverProvider = new McHoverProvider(storageProvider);
    context.subscriptions.push(vscode.languages.registerHoverProvider(jsonSelector, this._hoverProvider));

    // 5. Definition - go-to-definition for textures, geometries, events, entities
    this._definitionProvider = new McDefinitionProvider(storageProvider);
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(jsonSelector, this._definitionProvider));

    // 6. Decorations - inline component summaries
    this._decorationProvider = new McDecorationProvider();
    context.subscriptions.push(this._decorationProvider);

    Log.debug("Minecraft language providers registered successfully");
  }

  /**
   * Register language integration: Chat Participant and Language Model Tools.
   * This enables @minecraft in Copilot Chat and provides tools for AI assistance.
   *
   * - Chat Participant: @minecraft for interactive chat-based help
   * - LM Tools: Tools that Copilot can invoke for Minecraft-specific operations
   *
   * @see McToolsChatParticipant
   * @see McToolsLmTools
   */
  private registerLanguageIntegration(context: vscode.ExtensionContext): void {
    // Storage provider for AI providers that need project access
    const storageProvider = (uri: vscode.Uri): IStorage | undefined => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        return undefined;
      }
      return this._storageByWorkspaceFolder[workspaceFolder.uri.toString()];
    };

    // Project provider - gets or creates a project for a workspace folder
    const projectProvider = async (uri: vscode.Uri): Promise<Project | undefined> => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        return undefined;
      }

      const key = workspaceFolder.uri.toString();

      // Return cached project if available
      if (this._projectsByWorkspaceFolder[key]) {
        return this._projectsByWorkspaceFolder[key];
      }

      // Try to create a new project
      const storage = this._storageByWorkspaceFolder[key];
      if (!storage) {
        return undefined;
      }

      try {
        const creatorTools = CreatorToolsHost.getCreatorTools();
        if (!creatorTools) {
          return undefined;
        }

        const project = new Project(creatorTools, workspaceFolder.name, null);
        await project.setProjectFolder(storage.rootFolder);
        await project.inferProjectItemsFromFiles();

        this._projectsByWorkspaceFolder[key] = project;
        return project;
      } catch (error) {
        Log.debug(`Failed to create project for AI integration: ${error}`);
        return undefined;
      }
    };

    // 1. Register Chat Participant (@minecraft)
    this._chatParticipant = new McToolsChatParticipant(storageProvider, projectProvider);
    this._chatParticipant.register(context);

    // 2. Register Language Model Tools
    this._lmTools = new McToolsLmTools(storageProvider, projectProvider);
    this._lmTools.register(context);

    Log.debug("Minecraft AI integration registered successfully");
  }

  /**
   * Register preview commands for Minecraft content files.
   * This enables live preview panels for entities, blocks, and items.
   */
  private registerPreviewCommands(context: vscode.ExtensionContext): void {
    const me = this;

    // Command: Open preview for current document
    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.showPreview", () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && me.context) {
          McPreviewPanel.createOrShow(me.context.extensionUri, me, activeEditor.document);
        } else {
          vscode.window.showInformationMessage("No active Minecraft file to preview");
        }
      })
    );

    // Command: Open preview to the side
    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.showPreviewToSide", () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && me.context) {
          McPreviewPanel.createOrShow(me.context.extensionUri, me, activeEditor.document);
        }
      })
    );

    // Register webview serializer for panel revival on reload
    if (vscode.window.registerWebviewPanelSerializer) {
      context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer(McPreviewPanel.viewType, {
          async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any): Promise<void> {
            if (me.context) {
              McPreviewPanel.revive(webviewPanel, me.context.extensionUri, me);
            }
          },
        })
      );
    }

    Log.debug("Minecraft preview commands registered successfully");
  }

  /**
   * Registers commands for switching between MCTools custom editor and VS Code's text editor.
   */
  private registerEditorSwitchCommands(context: vscode.ExtensionContext): void {
    // Command: Open current JSON file with MCTools custom editor
    // When invoked from explorer/context menu, the URI is passed as an argument
    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.openWithMCToolsEditor", async (contextUri?: vscode.Uri) => {
        let uri: vscode.Uri | undefined;

        // First try to use the context menu URI (when invoked from Explorer)
        if (contextUri && contextUri.fsPath.endsWith(".json")) {
          uri = contextUri;
        } else {
          // Fall back to active text editor (when invoked from command palette)
          const activeEditor = vscode.window.activeTextEditor;
          if (activeEditor && activeEditor.document.uri.fsPath.endsWith(".json")) {
            uri = activeEditor.document.uri;
          }
        }

        if (uri) {
          await vscode.commands.executeCommand("vscode.openWith", uri, "mctools.json");
        } else {
          vscode.window.showInformationMessage("No JSON file is currently open");
        }
      })
    );

    // Command: Open current JSON file with VS Code's default text editor
    context.subscriptions.push(
      vscode.commands.registerCommand("mctools.openWithTextEditor", async () => {
        const activeEditor = vscode.window.activeTextEditor;
        const activeCustomEditor = vscode.window.tabGroups.activeTabGroup.activeTab;

        // Get the URI from either the active text editor or active custom editor tab
        let uri: vscode.Uri | undefined;

        if (activeEditor && activeEditor.document.uri.fsPath.endsWith(".json")) {
          uri = activeEditor.document.uri;
        } else if (activeCustomEditor?.input && typeof activeCustomEditor.input === "object") {
          const input = activeCustomEditor.input as { uri?: vscode.Uri };
          if (input.uri && input.uri.fsPath.endsWith(".json")) {
            uri = input.uri;
          }
        }

        if (uri) {
          await vscode.commands.executeCommand("vscode.openWith", uri, "default");
        } else {
          vscode.window.showInformationMessage("No JSON file is currently open");
        }
      })
    );

    Log.debug("Minecraft editor switch commands registered successfully");
  }

  public async quickNewStartCommand(context: IContext, name: string, args: string[]) {
    await this.quickNewStart();
    return { status: CommandStatus.completed };
  }

  public async quickNewStart() {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct || !this.context) {
      Log.unexpectedUndefined("QNS");
      return;
    }
    /*
    const project = await this.getProject();

    if (!project) {
      vscode.window.showInformationMessage("No project selected.");
      return;
    }*/

    await ct.loadGallery();

    if (!ct.gallery) {
      vscode.window.showInformationMessage("Could not load gallery of Minecraft projects.");
      return;
    }
    const items: vscode.QuickPickItem[] = [];
    const projects: IGalleryItem[] = [];
    let selectedProj: IGalleryItem | undefined;

    for (const proj of ct.gallery.items) {
      if (proj.type === GalleryItemType.project || proj.type === GalleryItemType.editorProject) {
        items.push({
          label: proj.title,
          detail: proj.description,
        });

        projects.push(proj);
      }
    }

    const result = await vscode.window.showQuickPick(items, {});

    for (let i = 0; i < items.length; i++) {
      if (result === items[i]) {
        selectedProj = projects[i];
      }
    }

    if (selectedProj === undefined) {
      vscode.window.showInformationMessage("No project was selected.");
      return;
    }

    const folderUris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Select folder",
    });

    if (!folderUris || folderUris.length < 1) {
      vscode.window.showInformationMessage("No folder was selected; Create new project canceled.");
      return;
    }

    const workspaceFolderUri = folderUris[0];

    const projectName = await vscode.window.showInputBox({
      prompt: "New project name",
    });

    if (!projectName) {
      vscode.window.showInformationMessage("No project name was selected.");
      return;
    }

    await this.createNewProject(projectName, workspaceFolderUri, selectedProj);
  }

  /**
   * Adds a new item (entity type, block type, item type, or code sample) to the current project.
   * Presents a series of quick picks to guide the user through selecting the category, item, and name.
   */
  public async addItemToProject() {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct || !this.context) {
      Log.unexpectedUndefined("AITP");
      return;
    }

    // Get the current project from the workspace
    const project = this.getProject();

    if (!project) {
      vscode.window.showErrorMessage("No Minecraft project is open. Please open a folder with a Minecraft add-on.");
      return;
    }

    await ct.loadGallery();

    if (!ct.gallery) {
      vscode.window.showInformationMessage("Could not load gallery of Minecraft items.");
      return;
    }

    // Define the categories available for adding items
    interface CategoryItem extends vscode.QuickPickItem {
      galleryTypes: GalleryItemType[];
    }

    const categories: CategoryItem[] = [
      {
        label: "$(symbol-class) Entity Type",
        description: "Add a new mob or entity to your project",
        galleryTypes: [GalleryItemType.entityType],
      },
      {
        label: "$(symbol-misc) Block Type",
        description: "Add a new custom block to your project",
        galleryTypes: [GalleryItemType.blockType],
      },
      {
        label: "$(package) Item Type",
        description: "Add a new custom item to your project",
        galleryTypes: [GalleryItemType.itemType],
      },
      {
        label: "$(code) Code Sample",
        description: "Add a code sample or snippet to your project",
        galleryTypes: [GalleryItemType.codeSample, GalleryItemType.editorCodeSample],
      },
    ];

    // Step 1: Pick a category
    const selectedCategory = await vscode.window.showQuickPick(categories, {
      placeHolder: "Select the type of item to add",
      title: "Add Item to Project",
    });

    if (!selectedCategory) {
      return; // User cancelled
    }

    // Step 2: Filter gallery items by the selected category
    interface GalleryQuickPickItem extends vscode.QuickPickItem {
      galleryItem: IGalleryItem;
    }

    const galleryItems: GalleryQuickPickItem[] = [];

    for (const item of ct.gallery.items) {
      if (selectedCategory.galleryTypes.includes(item.type)) {
        galleryItems.push({
          label: item.title,
          description: item.description,
          detail: item.id,
          galleryItem: item,
        });
      }
    }

    if (galleryItems.length === 0) {
      vscode.window.showInformationMessage("No items available in this category.");
      return;
    }

    // Step 2: Pick an item from the gallery
    const selectedGalleryItem = await vscode.window.showQuickPick(galleryItems, {
      placeHolder: "Select an item to add",
      title: "Choose Item Template",
    });

    if (!selectedGalleryItem) {
      return; // User cancelled
    }

    const galleryItem = selectedGalleryItem.galleryItem;

    // Step 3: Ask for the name
    const suggestedName = galleryItem.id;
    const itemName = await vscode.window.showInputBox({
      prompt: "Enter a name for the new item",
      value: suggestedName,
      placeHolder: "my_custom_item",
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return "Name cannot be empty";
        }
        // Basic validation: only allow lowercase letters, numbers, and underscores
        if (!/^[a-z][a-z0-9_]*$/.test(value)) {
          return "Name must start with a lowercase letter and contain only lowercase letters, numbers, and underscores";
        }
        return undefined;
      },
    });

    if (!itemName) {
      return; // User cancelled
    }

    // Step 4: Add the item based on its type
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Adding ${galleryItem.title}...`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: "Copying files..." });

          switch (galleryItem.type) {
            case GalleryItemType.entityType:
              await ProjectCreateManager.addEntityTypeFromGallery(project, galleryItem, itemName);
              break;
            case GalleryItemType.blockType:
              await ProjectCreateManager.addBlockTypeFromGallery(project, galleryItem, itemName);
              break;
            case GalleryItemType.itemType:
              await ProjectCreateManager.addItemTypeFromGallery(project, galleryItem, itemName);
              break;
            case GalleryItemType.codeSample:
            case GalleryItemType.editorCodeSample:
              if (galleryItem.sampleSet) {
                const snippet = await Database.getSnippet(galleryItem.sampleSet, galleryItem.id);
                if (snippet) {
                  await ProjectUtilities.injectSnippet(
                    project,
                    snippet,
                    galleryItem.type === GalleryItemType.editorCodeSample
                  );
                  await project.save();
                } else {
                  vscode.window.showWarningMessage("Could not find the code sample snippet.");
                  return;
                }
              } else {
                vscode.window.showWarningMessage("This code sample does not have a sample set configured.");
                return;
              }
              break;
            default:
              vscode.window.showWarningMessage("This item type is not yet supported for adding.");
              return;
          }

          progress.report({ message: "Done!" });
        }
      );

      vscode.window.showInformationMessage(`Successfully added "${itemName}" to your project.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to add item: ${errorMessage}`);
      Log.fail("Failed to add item to project: " + errorMessage);
    }
  }

  public async createProjectAskForFolder(projectName: string, galleryProject: IGalleryItem) {
    if (!CreatorToolsHost.getCreatorTools() || !this.context) {
      Log.unexpectedUndefined("QNS");
      return;
    }

    const folderUris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Select folder",
    });

    if (!folderUris || folderUris.length < 1) {
      vscode.window.showInformationMessage("No folder was selected; create new project canceled.");
      return;
    }

    const workspaceFolderUri = folderUris[0];

    await this.createNewProject(projectName, workspaceFolderUri, galleryProject);
  }

  async createNewProject(projectName: string, workspaceFolderUri: vscode.Uri, galleryProject: IGalleryItem) {
    if (!CreatorToolsHost.getCreatorTools() || !this.context) {
      Log.unexpectedUndefined("CNP");
      return;
    }
    ExtensionManager._pendingFolderPopulationRequests.push({
      name: projectName,
      workspaceUri: workspaceFolderUri.toString(),
      project: galleryProject,
      time: new Date().getTime(),
    });

    // IMPORTANT: Must await this before openFolder or the state won't be persisted
    await this.context.globalState.update(
      "pendingPopulationRequests",
      ExtensionManager._pendingFolderPopulationRequests
    );

    this._willBeRebooted = !vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length < 1;

    if (!this._willBeRebooted) {
      await this.considerPendingPopulationRequests();

      if (ExtensionManager._pendingFolderPopulationRequests.length === 0) {
        return;
      }
    }
    if (this._willBeRebooted) {
      // If VS Code has no folder open, just open this folder directly (not as a workspace)
      // This avoids creating an .code-workspace file
      try {
        await vscode.commands.executeCommand("vscode.openFolder", workspaceFolderUri, {
          forceNewWindow: false,
        });
      } catch (e) {
        // openFolder can throw "Cancelled" if the folder switch is interrupted - this is expected
        Log.debug("Open folder was interrupted: " + e);
      }

      return;
    }

    // this will spawn a new VSCode window (which is a separate extension process) pointed at the workspace folder
    // and then pending populating requests will be handled in that new window.
    try {
      await vscode.commands.executeCommand("vscode.openFolder", workspaceFolderUri, {
        forceNewWindow: true,
      });
    } catch (e) {
      // openFolder can throw "Cancelled" if the folder switch is interrupted - this is expected
      Log.debug("Open folder was interrupted: " + e);
    }

    /*    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 1) {
      vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0,
        1
      );
    }*/
  }

  async considerPendingPopulationRequests() {
    if (!this.context) {
      return;
    }

    const val =
      this.context.globalState.get<{ name: string; workspaceUri: string; project: IGalleryItem; time: number }[]>(
        "pendingPopulationRequests"
      );

    if (!val) {
      return;
    }

    ExtensionManager._pendingFolderPopulationRequests = val;

    const remainingFolderPopulationRequests: {
      name: string;
      workspaceUri: string;
      project: IGalleryItem;
      time: number;
    }[] = [];

    const curTime = new Date().getTime();

    for (let i = 0; i < ExtensionManager._pendingFolderPopulationRequests.length; i++) {
      const req = ExtensionManager._pendingFolderPopulationRequests[i];

      if (req && req.time && curTime - req.time < 30000) {
        const result = await this.populateIntoWorkspace(req.name, vscode.Uri.parse(req.workspaceUri), req.project);

        if (!result) {
          remainingFolderPopulationRequests.push(req);
        }
      }
    }

    ExtensionManager._pendingFolderPopulationRequests = remainingFolderPopulationRequests;

    this.context.globalState.update("pendingPopulationRequests", ExtensionManager._pendingFolderPopulationRequests);
  }

  async populateIntoWorkspace(name: string, workspaceFolderUri: vscode.Uri, galleryProject: IGalleryItem) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct || !this.context) {
      Log.unexpectedUndefined("PIW");
      return false;
    }

    let workspaceFolderIndex = -1;
    let selectedWorkspaceFolder = undefined;

    // re-find our workspace folder
    if (vscode.workspace.workspaceFolders) {
      let index = 0;
      const targetCanonical = this.canonicalizeUri(workspaceFolderUri);

      for (const workspaceFolder of vscode.workspace.workspaceFolders) {
        const candidateCanonical = this.canonicalizeUri(workspaceFolder.uri);
        Log.debug("Comparing folders: target='" + targetCanonical + "' candidate='" + candidateCanonical + "'");

        if (candidateCanonical === targetCanonical) {
          workspaceFolderIndex = index;
          selectedWorkspaceFolder = workspaceFolder;
          break;
        }
        index++;
      }
    }

    if (workspaceFolderIndex < 0 || !selectedWorkspaceFolder) {
      // If exact match failed but we only have one folder, use it (common case for new project creation)
      if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length === 1) {
        Log.debug("Using single workspace folder as fallback");
        workspaceFolderIndex = 0;
        selectedWorkspaceFolder = vscode.workspace.workspaceFolders[0];
      } else {
        Log.debug(
          "Could not find folder for " + workspaceFolderUri.path + "|" + vscode.workspace.workspaceFolders?.length
        );

        return false;
      }
    }

    const storageAndProject = await this.ensureStorageAndProjectForFolder(this.context, selectedWorkspaceFolder);

    const project = storageAndProject.project;

    if (!project) {
      vscode.window.showInformationMessage("Could not create project for " + workspaceFolderUri.path);
      return false;
    }

    project.originalGalleryId = galleryProject.id;

    vscode.window.showInformationMessage("Adding files from '" + galleryProject.title + "'...");

    const proj = await ProjectExporter.syncProjectFromGitHub(
      true,
      ct,
      galleryProject.gitHubRepoName,
      galleryProject.gitHubOwner,
      galleryProject.gitHubBranch,
      galleryProject.gitHubFolder,
      name,
      project,
      galleryProject.fileList
    );

    if (
      galleryProject.id !== undefined &&
      galleryProject.sampleSet !== undefined &&
      (galleryProject.type === GalleryItemType.codeSample || galleryProject.type === GalleryItemType.editorCodeSample)
    ) {
      vscode.window.showInformationMessage("Adding sample " + galleryProject.id);

      proj.originalSampleId = galleryProject.id;

      const snippet = await Database.getSnippet(galleryProject.sampleSet, galleryProject.id);

      if (snippet) {
        await ProjectUtilities.injectSnippet(proj, snippet, galleryProject.type === GalleryItemType.editorCodeSample);
      }
    }

    if (proj && proj.projectFolder) {
      await proj.projectFolder.saveAll();
    }

    vscode.window.showInformationMessage("Done! Run npm install in the workspace folder to add any dependencies.");

    return true;
  }

  canonicalizeUri(uri: vscode.Uri) {
    let path = uri.toString().toLowerCase();

    path = path.replace(/%3a/g, ":");
    path = path.replace(/file:\/\//g, "");

    return path;
  }

  async clearWorkspaceFolder(workspaceFolderUri: vscode.Uri): Promise<boolean> {
    if (!workspaceFolderUri || !this.context) {
      return false;
    }

    const storage = new VsFsStorage(this.context, workspaceFolderUri.fsPath, "");

    const folder = storage.rootFolder;

    if (!folder.isLoaded) {
      await folder.load();
    }

    // check if the workspace is empty, or clear it
    if (folder.fileCount > 0 || folder.folderCount > 0) {
      const answer = await vscode.window.showQuickPick(["Yes", "No"], {
        placeHolder: `Remove ${folder.fileCount + folder.folderCount} files and folders from the folder ${
          workspaceFolderUri.fsPath
        } before adding new new files?`,
      });

      if (!answer) {
        return false;
      }

      if (answer === "Yes") {
      }
    }

    return true;
  }

  async developUsingMinecraftGameCommand(context: IContext, name: string, args: string[]) {
    await this.developUsingMinecraftGame();
    return { status: CommandStatus.completed };
  }

  public async developUsingMinecraftGame() {
    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct) {
      return;
    }

    if (ct.lastActiveMinecraftFlavor !== MinecraftFlavor.minecraftGameProxy) {
      ct.setMinecraftFlavor(MinecraftFlavor.minecraftGameProxy);
      await ct.save();

      vscode.window.showInformationMessage("Developing using the Minecraft game hosted on this PC.");
    }
  }

  async developUsingRemoteMinecraftCommand(context: IContext, name: string, args: string[]) {
    await this.developUsingRemoteMinecraft();
    return { status: CommandStatus.completed };
  }

  public async developUsingRemoteMinecraft() {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct) {
      return;
    }

    if (ct.lastActiveMinecraftFlavor !== MinecraftFlavor.remote) {
      ct.setMinecraftFlavor(MinecraftFlavor.remote);
      await ct.save();

      vscode.window.showInformationMessage("Developing using a remotely hosted Minecraft Dedicated Server hosted.");
    }
  }

  async developUsingDedicatedServerCommand(context: IContext, name: string, args: string[]) {
    await this.developUsingDedicatedServer();
    return { status: CommandStatus.completed };
  }

  public async developUsingDedicatedServer() {
    const ct = CreatorToolsHost.getCreatorTools();
    if (!ct) {
      return;
    }

    if (!ct.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      const result = await vscode.window.showQuickPick(
        ["Yes, I agree to the Minecraft End User License Agreement and Privacy Policy", "Cancel"],
        {
          title:
            "To run Minecraft Bedrock Dedicated Server, you must agree to the Minecraft End User License Agreement (https://minecraft.net/terms) and privacy policy (https://go.microsoft.com/fwlink/?LinkId=521839).",
        }
      );

      if (result?.startsWith("Yes")) {
        ct.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula = true;
        await ct.save();
      }
    }

    if (!ct.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      vscode.window.showInformationMessage("Minecraft Bedrock Dedicated Server was canceled.");
      return;
    }

    if (ct.lastActiveMinecraftFlavor !== MinecraftFlavor.processHostedProxy) {
      ct.setMinecraftFlavor(MinecraftFlavor.processHostedProxy);
      await ct.save();

      vscode.window.showInformationMessage("Developing using built-in Minecraft Bedrock Dedicated Server.");
    }

    if (this.processHostedMinecraft) {
      vscode.window.showInformationMessage("Starting Minecraft Bedrock Dedicated Server.");
      await this.processHostedMinecraft.initialize();
      await this.processHostedMinecraft.prepareAndStart({
        project: this.getProject(),
      });
    }
  }

  public deactivate(): void {
    this.isActivated = false;
    Log.verbose("Deactivating Minecraft Creator Tools @ " + new Date().toTimeString());

    if (this._minecraftTaskProviderDisposable) {
      this._minecraftTaskProviderDisposable.dispose();
    }
  }

  processWorkspaceFolderMessages(sender: any, args: { command: string; id: string; data: any }) {
    for (const key in this._storageProxyByWorkspaceFolder) {
      const storageProxy = this._storageProxyByWorkspaceFolder[key];

      if (storageProxy) {
        storageProxy.processMessage(sender, args.command, args.id, args.data);
      }
    }
  }

  registerWebview(id: string, webview: vscode.Webview) {
    if (!this._webViewsByChannelId[id]) {
      this._webViewsByChannelId[id] = [];
    }

    this._webViewsByChannelId[id].push(webview);
  }

  unregisterWebview(id: string, webview: vscode.Webview) {
    if (!this._webViewsByChannelId[id]) {
      return;
    }

    const newWebviews = [];

    const existingWebviews = this._webViewsByChannelId[id];

    for (let i = 0; i < existingWebviews.length; i++) {
      if (existingWebviews[i] !== webview) {
        newWebviews.push(existingWebviews[i]);
      }
    }

    this._webViewsByChannelId[id] = newWebviews;
  }

  getSubscribers(id: string) {
    let result = this._webViewsByChannelId[id];

    if (!result) {
      result = [];
    }

    return result;
  }

  async updateProjectsAndFolders() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || !this.context) {
      return;
    }

    for (const folder of folders) {
      await this.ensureStorageAndProjectForFolder(this.context, folder);
    }

    await this.considerPendingPopulationRequests();
  }

  hasStoragePath(path: string) {
    return this._storageByWorkspaceFolder[path] !== undefined;
  }

  // VSCode will backup files to a separate hidden disk location.  This is to hold content when you "tab away" in VSC with
  // unsaved changes, or say if VSC crashes and comes back later with unsaved changes.
  // If VSCode has stored a backup for a file, use this function to register those alternate contents as the latest version
  // that HTML editors should use rather than the actual "disk contents"
  registerAlternateContents(storageRelativePath: string, content: string | Uint8Array) {
    for (const path in this._storageProxyByWorkspaceFolder) {
      this._storageProxyByWorkspaceFolder[path].registerAlternateContents(storageRelativePath, content);
    }

    if (this._projectsStorageProxy) {
      this._projectsStorageProxy.registerAlternateContents(storageRelativePath, content);
    }
  }

  clearAlternateContents(storageRelativePath: string) {
    for (const path in this._storageProxyByWorkspaceFolder) {
      this._storageProxyByWorkspaceFolder[path].clearAlternateContents(storageRelativePath);
    }

    if (this._projectsStorageProxy) {
      this._projectsStorageProxy.clearAlternateContents(storageRelativePath);
    }
  }

  registerStorage(storage: IStorage, path: string) {
    this._storageProxyByWorkspaceFolder[path] = new StorageProxy(storage, path, this.sendMessageToBrowser, this);
    this._storageProxyByWorkspaceFolder[path].encodeBinary = true;
    this._storageByWorkspaceFolder[path] = storage;
  }

  async ensureStorageAndProjectForFolder(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder) {
    const ct = CreatorToolsHost.getCreatorTools();
    const path = folder.uri.toString();

    if (this._storageByWorkspaceFolder[path]) {
      return { storage: this._storageByWorkspaceFolder[path], project: this._projectsByWorkspaceFolder[path] };
    }

    const newStorage = new VsFsStorage(context, path, folder.name);
    let project = undefined;

    this.activeProjectPath = path;

    this.registerStorage(newStorage, path);

    Log.assert(ct !== undefined);
    if (ct) {
      project = new Project(ct, folder.name, null);

      this._projectsByWorkspaceFolder[path] = project;

      project.setProjectFolder(newStorage.rootFolder);

      await project.inferProjectItemsFromFiles();
    }

    return { storage: newStorage, project: project };
  }

  async updatePackageBuilds() {
    const folders = vscode.workspace.workspaceFolders;
    const ct = CreatorToolsHost.getCreatorTools();

    if (!folders || !this.context || !ct) {
      return;
    }

    for (const folder of folders) {
      const result = await this.ensureStorageAndProjectForFolder(this.context, folder);

      if (result.project) {
        const buildFolder = await result.project.ensureDistFolder();
        await buildFolder.ensureExists();
        const newBytes = await ProjectExporter.generateFlatBetaApisWorldWithPacksZipBytes(ct, result.project, "Test");

        if (newBytes) {
          const file = await buildFolder.ensureFile("gametest.mcworld");
          vscode.window.showInformationMessage("Creating package " + buildFolder.fullPath + "gametest.mcworld");

          file.setContent(newBytes);
          await file.saveContent();
        }
      }
    }
  }

  async deployToInternalCommand(context: IContext, name: string, args: string[]) {
    await this.deployToInternal();
    return { status: CommandStatus.completed };
  }

  private async deployToInternal(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders) {
      Log.message("Workspace folder is not open.");
      return;
    }

    const ct = CreatorToolsHost.getCreatorTools();

    if (!this.context || !ct) {
      return;
    }

    let mc = this.processHostedMinecraft;

    if (!mc) {
      mc = ct.ensureMinecraft(MinecraftFlavor.processHostedProxy);
    }

    if (!mc) {
      Log.error("(Could not set active Minecraft.)");
      return;
    }

    try {
      for (const folder of folders) {
        const result = await this.ensureStorageAndProjectForFolder(this.context, folder);

        if (result.project) {
          Log.message(
            "Publishing project '" + result.project.projectFolder?.fullPath + "' to locally hosted Minecraft server."
          );

          await mc.prepareAndStart({
            project: result.project,
          });
        } else {
          Log.message("Could not establish project for folder '" + folder + "'");
        }
      }
    } catch (e) {
      Log.message("Error publishing to locally hosted minecraft: " + e);
    }
  }

  async deployToRemoteCommand(context: IContext, name: string, args: string[]) {
    await this.deployWorldToRemote();
    return { status: CommandStatus.completed };
  }

  async deployWorldToRemote() {
    const folders = vscode.workspace.workspaceFolders;

    Log.verbose("Considering publishing to remote Minecraft");

    if (!folders) {
      Log.verbose("No folders available to publish.");
      return false;
    }

    const ct = CreatorToolsHost.getCreatorTools();

    if (!ct) {
      Log.verbose("Minecraft Creator Tools is not ready.");
      return false;
    }

    await ct.load(true);

    if (!this.context) {
      Log.verbose("Context is not ready.");
      return false;
    }

    if (ct.remoteServerUrl === undefined || ct.remoteServerPasscode === undefined) {
      Log.message("Remote server url/passcode is not defined. Use the Minecraft settings pane to set this up.");
      return false;
    }

    ct.ensureRemoteMinecraft();

    if (!ct.remoteMinecraft) {
      Log.unexpectedUndefined("DWTR");
      return false;
    }

    if (!ct.remoteServerAuthToken) {
      await ct.remoteMinecraft.initialize();
    }

    if (!ct.remoteServerAuthToken) {
      Log.message("Could not authenticate to server. Check your URL and passcode.");
      return false;
    }

    try {
      for (const folder of folders) {
        const result = await this.ensureStorageAndProjectForFolder(this.context, folder);

        if (result.project) {
          Log.verbose(
            "Publishing project '" +
              result.project.projectFolder?.storageRelativePath +
              "' to '" +
              ct.fullRemoteServerUrl +
              "'"
          );

          await ct.remoteMinecraft?.prepareAndStart({
            project: result.project,
            worldType: MinecraftPushWorldType.inferFromProject,
          });
        } else {
          Log.debug("Could not establish project for folder '" + folder + "'");
        }
      }
    } catch (e) {
      Log.debug("Error publishing to remote minecraft: " + e);
    }

    Log.verbose("Done with publish");

    return true;
  }

  handleNewLogMessage(log: Log, item: LogItem) {
    if (item.level === LogItemLevel.debug) {
      return;
    }

    try {
      if (item.level === LogItemLevel.error || item.level === LogItemLevel.important) {
        vscode.window.showInformationMessage(item.message);
      }
      /*
    const sbi = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);

    sbi.text =message;

    sbi.show();
*/
    } catch (e) {
      Log.debug("Unable to show error: " + e + " " + item.message);
    }
  }

  getWebviewContent(webview: vscode.Webview, mode: string, documentUri?: string, projectPath?: string) {
    if (!this.context) {
      return "<html><body><h3>Error loading page.</h3></body></html>";
    }

    // Use the provided projectPath or fall back to activeProjectPath
    const effectiveProjectPath = projectPath ?? this.activeProjectPath;

    let additionalVars = "";

    if (
      documentUri &&
      effectiveProjectPath &&
      documentUri.toLowerCase().startsWith(effectiveProjectPath.toLowerCase())
    ) {
      documentUri = Utilities.ensureStartsWithSlash(documentUri.substring(effectiveProjectPath.length));

      additionalVars = additionalVars + 'g_modeParameter = "' + documentUri + '";';
    }

    // contentRoot points to extension root for data files, res, etc.
    const contentRoot = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "")).toString();
    // webRoot points to web/ folder for webpack chunks - derived from script path
    const scriptPath = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "web", "web.js")).toString();
    const webRoot = scriptPath.substring(0, scriptPath.lastIndexOf("/") + 1);
    const cssPath = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "web", "web.css")).toString();

    /*    if (this.context.extensionMode === vscode.ExtensionMode.Development && CreatorToolsHost.isVsCodeWeb) {
      contentRoot = "http://localhost:3000/static/devextensions/";
      scriptPath = "http://localhost:3000/static/devextensions/app/web.js";
      cssPath = "http://localhost:3000/static/devextensions/app/web.css";
    }*/

    return `<!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Minecraft Creator Tools</title>
    <link rel="stylesheet" href="${cssPath}">
    <script language='javascript'>
    g_contentRoot = "${contentRoot}";
    g_webRoot = "${webRoot}";
    g_vanillaContentRoot = "https://mctools.dev/";
    g_isVsCodeMain = ${CreatorToolsHost.hostType === HostType.vsCodeMainNodeJs};
    g_isVsCodeWeb = ${CreatorToolsHost.hostType === HostType.vsCodeWebService};
    g_projectPath = "${effectiveProjectPath}";
    g_initialMode = "${mode}";
    ${additionalVars}
    g_isDebug = ${Utilities.isDebug};
    </script>
  <script defer="true" src="${scriptPath}"></script>
  </head>
    <body>
      <div id="root" translate="no" class="notranslate"></div>
    </body>
  </html>`;
  }

  logAsAlert(message: string) {
    Log.verbose("Alert: " + message);

    try {
      vscode.window.showInformationMessage(message);
      /*
    const sbi = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);

    sbi.text =message;

    sbi.show();
*/
    } catch (e) {
      Log.debug("Unable to show error: " + e + " " + message);
    }
  }

  workspaceFoldersChanged(e: vscode.WorkspaceFoldersChangeEvent) {
    if (this._willBeRebooted) {
      return;
    }

    this.updateProjectsAndFolders();
  }

  doInit(context: vscode.ExtensionContext) {
    CreatorToolsHost.prefsStorage = new MementoStorage(context.globalState, "prefs");
    CreatorToolsHost.projectsStorage = new MementoStorage(context.globalState, "projects");
    CreatorToolsHost.packStorage = new MementoStorage(context.globalState, "packs");
    CreatorToolsHost.worldStorage = new MementoStorage(context.globalState, "worlds");

    this._prefsStorageProxy = new StorageProxy(CreatorToolsHost.prefsStorage, "prefs", this.sendMessageToBrowser, this);
    this._packStorageProxy = new StorageProxy(CreatorToolsHost.packStorage, "packs", this.sendMessageToBrowser, this);
    this._worldStorageProxy = new StorageProxy(
      CreatorToolsHost.worldStorage,
      "worlds",
      this.sendMessageToBrowser,
      this
    );
    this._projectsStorageProxy = new StorageProxy(
      CreatorToolsHost.projectsStorage,
      "projects",
      this.sendMessageToBrowser,
      this
    );

    CreatorToolsHost.onMessage.subscribe(async (sender, args) => {
      if (args.command === undefined || args.id === undefined) {
        return;
      }

      // Log.message("New message from browser: " + JSON.stringify(args));

      let subCommand = args.command;
      let requestId = "";

      if (subCommand.indexOf("|") >= 0) {
        const commandSplit = Utilities.splitUntil(subCommand, "|", 1);

        if (commandSplit.length >= 2) {
          subCommand = commandSplit[0];
          requestId = commandSplit[1];

          switch (subCommand) {
            case "asyncreloadMct":
              const ct = CreatorToolsHost.getCreatorTools();
              if (ct) {
                await ct.load(true);
              }
              break;

            case "asynccloseAllStartPages":
              if (this.context) {
                StartPageProvider.closeAllStartPages();
              }
              this.sendMessageToBrowser(sender, "asynccloseAllStartPagesComplete|" + requestId, "appsvc", "");
              break;

            case "asyncshowNewProjectPage":
              if (this.context) {
                StartPageProvider.show(this.context.extensionUri, this);
              }
              this.sendMessageToBrowser(sender, "asyncshowNewProjectPageComplete|" + requestId, "appsvc", "");
              break;

            case "asyncstartNewProject":
              const jsonStartNewProject = JSON.parse(args.data);

              if (jsonStartNewProject.galleryProject) {
                await this.createProjectAskForFolder(jsonStartNewProject.name, jsonStartNewProject.galleryProject);
              }
              // If the extension is being rebooted due to workspace folder changes, don't try to send
              // messages to the webview which may be disposed
              if (!this._willBeRebooted) {
                this.sendMessageToBrowser(sender, "asyncshowNewProjectComplete|" + requestId, "appsvc", "");
              }
              break;

            case "asyncopenItem":
              const jsonOpenItem = JSON.parse(args.data);

              if (jsonOpenItem.path) {
                let rawPath: string = jsonOpenItem.path;

                // Normalize path shapes coming from the webview:
                //   - Windows absolute paths (`C:/…`, `C:\…`)           -> Uri.file
                //   - POSIX absolute paths (`/…`)                       -> Uri.file
                //   - `file:/c:/…` or `file:/home/...` (malformed)      -> repair to `file:///…`, then Uri.parse
                //   - `file:///c:/…` (proper file URI)                  -> Uri.parse
                //   - Other schemes (e.g. `vscode-vfs://`)              -> Uri.parse
                //
                // Why this matters: `Uri.parse("C:/Users/x/main.ts")` parses scheme=`c`,
                // which then fails to open and shows VS Code's "The editor could not be
                // opened because the file was not found" dialog. Also, stripping `file:/`
                // entirely would turn POSIX malformed URIs like `file:/home/user/a.json`
                // into `home/user/a.json`, incorrectly losing the leading slash.
                const fileUriSingleSlash = /^file:\/(?!\/)/i; // matches `file:/X` but not `file://…`
                if (fileUriSingleSlash.test(rawPath)) {
                  rawPath = rawPath.replace(fileUriSingleSlash, "file:///");
                }

                const looksLikeWindowsPath = /^[a-zA-Z]:[\\/]/.test(rawPath);
                const looksLikePosixPath = rawPath.startsWith("/") && !rawPath.startsWith("//");
                const hasFullScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawPath);

                let uri: vscode.Uri;
                if (!hasFullScheme && (looksLikeWindowsPath || looksLikePosixPath)) {
                  uri = vscode.Uri.file(rawPath);
                } else {
                  uri = vscode.Uri.parse(rawPath);
                }

                Log.verbose(
                  `asyncopenItem: rawPath="${jsonOpenItem.path}" -> normalized="${rawPath}" -> uri="${uri.toString()}" (scheme=${uri.scheme}, fsPath=${uri.fsPath})`
                );

                const isJsonFile = rawPath.toLowerCase().endsWith(".json");

                // Check user setting for default editor preference
                const config = vscode.workspace.getConfiguration("mctools.jsonEditor");
                const defaultToRawEditor = config.get<boolean>("defaultToRawEditor", false);

                if (isJsonFile && (jsonOpenItem.openAsRawText || defaultToRawEditor)) {
                  // User requested raw text OR setting prefers raw editor
                  await vscode.commands.executeCommand("vscode.openWith", uri, "default");
                } else if (isJsonFile) {
                  // Default: open JSON files with MCTools custom editor
                  await vscode.commands.executeCommand("vscode.openWith", uri, "mctools.json");
                } else {
                  // Non-JSON files: use default open behavior
                  await vscode.commands.executeCommand("vscode.open", uri);
                }
                //vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.One });
                this.sendMessageToBrowser(sender, "asyncopenItemComplete|" + requestId, "appsvc", "");
              }
              break;

            case "asyncexecuteCommand":
              const jsonCommand = JSON.parse(args.data);

              if (jsonCommand.command && jsonCommand.arguments) {
                // this.logAsMessage("Running command " + jsonCommand.command + "|" + jsonCommand.arguments.length);
                await vscode.commands.executeCommand(jsonCommand.command, jsonCommand.arguments);
                this.sendMessageToBrowser(sender, "asyncexecuteCommandComplete|" + requestId, "appsvc", "");
              }
              break;

            case "asyncshowSaveDialog":
              try {
                const jsonSaveDialog = JSON.parse(args.data);
                const filters: { [key: string]: string[] } = jsonSaveDialog.filters || {};

                const saveUri = await vscode.window.showSaveDialog({
                  defaultUri: jsonSaveDialog.defaultFileName
                    ? vscode.Uri.file(jsonSaveDialog.defaultFileName)
                    : undefined,
                  filters: filters,
                  saveLabel: "Save",
                });

                if (saveUri) {
                  this.sendMessageToBrowser(
                    sender,
                    "asyncshowSaveDialogComplete|" + requestId,
                    "appsvc",
                    JSON.stringify({ path: saveUri.fsPath })
                  );
                } else {
                  this.sendMessageToBrowser(
                    sender,
                    "asyncshowSaveDialogComplete|" + requestId,
                    "appsvc",
                    JSON.stringify({ cancelled: true })
                  );
                }
              } catch (e) {
                this.sendMessageToBrowser(
                  sender,
                  "asyncshowSaveDialogComplete|" + requestId,
                  "appsvc",
                  JSON.stringify({ error: String(e) })
                );
              }
              break;

            case "asyncsaveBinaryFile":
              try {
                const jsonSaveBinary = JSON.parse(args.data);
                const filePath = jsonSaveBinary.path;
                const base64Data = jsonSaveBinary.base64Data;

                if (filePath && base64Data) {
                  // Decode base64 to binary
                  const binaryString = Buffer.from(base64Data, "base64");
                  const fileUri = vscode.Uri.file(filePath);

                  await vscode.workspace.fs.writeFile(fileUri, binaryString);

                  this.sendMessageToBrowser(
                    sender,
                    "asyncsaveBinaryFileComplete|" + requestId,
                    "appsvc",
                    JSON.stringify({ success: true, path: filePath })
                  );
                } else {
                  this.sendMessageToBrowser(
                    sender,
                    "asyncsaveBinaryFileComplete|" + requestId,
                    "appsvc",
                    JSON.stringify({ error: "Missing path or data" })
                  );
                }
              } catch (e) {
                this.sendMessageToBrowser(
                  sender,
                  "asyncsaveBinaryFileComplete|" + requestId,
                  "appsvc",
                  JSON.stringify({ error: String(e) })
                );
              }
              break;
          }
        }
      }

      switch (args.command) {
        case "logMessage":
          this.logAsAlert("Webview: " + args.data);
          break;

        default:
          if (this._extensionStorageProxy) {
            this._extensionStorageProxy.processMessage(sender, args.command, args.id, args.data);
          }

          if (this._prefsStorageProxy) {
            this._prefsStorageProxy.processMessage(sender, args.command, args.id, args.data);
          }
          if (this._projectsStorageProxy) {
            this._projectsStorageProxy.processMessage(sender, args.command, args.id, args.data);
          }

          this.processWorkspaceFolderMessages(sender, args);
      }
    });

    // this is access to the binary files and assets of the extension itself.
    this._extensionStorage = new VsFsStorage(context, context.extensionUri.toString(), "extension");

    this._extensionStorageProxy = new StorageProxy(
      this._extensionStorage,
      "extension",
      this.sendMessageToBrowser,
      this
    );
    this._extensionStorageProxy.isReadOnly = true;

    const utilities = new VsLocalUtilities(context, this._extensionStorage);

    Database.local = utilities;

    CreatorToolsHost.isLocalNode = true;

    CreatorToolsHost.init();

    const ct = CreatorToolsHost.getCreatorTools();

    if (ct && this.processHostedMinecraft) {
      ct.processHostedMinecraft = this.processHostedMinecraft;
    }

    if (ct && this.gameMinecraft) {
      ct.gameMinecraft = this.gameMinecraft;
    }
  }

  async doInitAsync(context: vscode.ExtensionContext) {
    const ct = CreatorToolsHost.getCreatorTools();
    if (ct) {
      ct.local = Database.local as ILocalUtilities;
      await ct.load();
    }

    await this.updateProjectsAndFolders();
  }

  sendMessageToAllBrowsers(command: string, id: string, data: any) {
    for (const channelId in this._webViewsByChannelId) {
      const chanArr = this._webViewsByChannelId[channelId];

      for (let i = 0; i < chanArr.length; i++) {
        // Log.message("Sending message to " + channelId + "|" + command + "|" + id + "|" + JSON.stringify(data));
        this.sendMessageToBrowser(chanArr[i], command, id, data);
      }
    }
  }

  sendMessageToBrowserById(source: vscode.Webview, command: string, id: string, data: any) {
    for (const channelId in this._webViewsByChannelId) {
      const chanArr = this._webViewsByChannelId[channelId];

      for (let i = 0; i < chanArr.length; i++) {
        const candWv = chanArr[i];

        if (candWv === source) {
          // Log.message("Sending message to " + channelId + "|" + command + "|" + id + "|" + JSON.stringify(data));
          this.sendMessageToBrowser(chanArr[i], command, id, data);
        }
      }
    }
  }

  sendMessageToBrowser(sender: any, command: string, id: string, data: any) {
    if (sender.length) {
      for (const obj of sender) {
        (obj as vscode.Webview).postMessage({ command: command, id: id, data: data });
      }
    } else {
      (sender as vscode.Webview).postMessage({ command: command, id: id, data: data });
    }
  }
}
