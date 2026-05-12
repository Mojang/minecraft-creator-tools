import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as http from "http";
import { z } from "zod";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import { DedicatedServerStatus } from "./DedicatedServer";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import Log from "../core/Log";
import HttpUtilities from "./HttpUtilities";
import CreatorTools from "../app/CreatorTools";
import Database from "../minecraft/Database";
import DataFormZod from "../dataform/DataFormZod";
import ServerManager from "./ServerManager";
import LocalEnvironment from "./LocalEnvironment";
import { IMinecraftStartMessage } from "../app/IMinecraftStartMessage";
import { DedicatedServerMode } from "../app/ICreatorToolsData";
import { Difficulty, GameType, Generator, PlayerPermissionsLevel } from "../minecraft/WorldLevelDat";
import { IPackageReference, IWorldSettings } from "../minecraft/IWorldSettings";
import IStatus, { StatusType } from "../app/Status";
import Package from "../app/Package";
import IActionSetData from "../actions/IActionSetData";
import Utilities from "../core/Utilities";
import IVector3 from "../minecraft/IVector3";
import Project from "../app/Project";
import IGalleryItem from "../app/IGalleryItem";
import ProjectExporter from "../app/ProjectExporter";
import ProjectUtilities from "../app/ProjectUtilities";
import ProjectItemCreateManager from "../app/ProjectItemCreateManager";
import ClUtils from "../cli/ClUtils";
import { CommandContextFactory } from "../cli/core/CommandContextFactory";
import CreatorToolsHost from "../app/CreatorToolsHost";
import StorageUtilities from "../storage/StorageUtilities";
import ModelDesignUtilities from "../minecraft/ModelDesignUtilities";
import { IMcpModelDesign } from "../minecraft/IMcpModelDesign";
import { ModelTemplateType, getAvailableTemplateTypes, getModelTemplateAsync } from "../minecraft/ModelDesignTemplates";
import StructureUtilities from "../minecraft/StructureUtilities";
import { IBlockVolume } from "../minecraft/IBlockVolume";
import { MinecraftContentSchema } from "../minecraft/ContentMetaSchemaZod";
import { ContentGenerator } from "../minecraft/ContentGenerator";
import ContentSchemaInferrer, { IInferrerOptions } from "../minecraft/ContentSchemaInferrer";
import PlaywrightPageRenderer from "./PlaywrightPageRenderer";
import ImageGenerationUtilities from "./ImageGenerationUtilities";
import { ServerManagerFeatures } from "./ServerManager";
import NodeStorage from "./NodeStorage";
import ModelDesignDefinition from "../design/ModelDesignDefinition";
import StructureDesignDefinition from "../design/StructureDesignDefinition";
import { ProjectItemType } from "../app/IProjectItemData";
import IFolder from "../storage/IFolder";
import { initializeToolCommands } from "../app/toolcommands";
import { registerNodeOnlyCommands } from "../app/toolcommands/registerNodeCommands";

import * as fs from "fs";
import * as path from "path";
import * as net from "net";
import { PNG } from "pngjs";
import { UNSAFE_PORTS } from "./LocalUtilities";

/**
 * Interface for MCT MCP preferences that can be stored in .mct/mcp/prefs.json files.
 * These preferences control security and feature flags for MCP operations.
 */
export interface IMctMcpPrefs {
  /** If true, allows the readImageFile tool to read image files from this folder and its subfolders */
  allowImageFileReadsInDescendentFolders?: boolean;
  /** If true, allows the writeImageFile tool to write image files to this folder and its subfolders */
  allowImageFileWritesInDescendentFolders?: boolean;
}

/**
 * Cached MCP preferences, keyed by the folder path where the prefs.json was found.
 * This allows us to load prefs only once per session for each unique folder.
 */
interface IMctMcpPrefsCache {
  [folderPath: string]: IMctMcpPrefs;
}

/**
 * Maps a user-facing session name (e.g., "default", "myTestWorld") to a BDS slot number.
 * This allows MCP tools to route commands to the correct server instance.
 */
interface ISessionInfo {
  /** The BDS slot number (0-79) backing this named session */
  slot: number;
  /** Optional description provided when the session was connected/created */
  description?: string;
}

export default class MinecraftMcpServer {
  /** Starting port for the internal HTTP server range */
  private static readonly PORT_RANGE_START = 6136;
  /** Ending port for the internal HTTP server range (200 ports available) */
  private static readonly PORT_RANGE_END = 6336;
  /** Maximum attempts to find an available port before giving up */
  private static readonly PORT_MAX_ATTEMPTS = 20;

  private _server: McpServer;
  private _env: LocalEnvironment | undefined = undefined;
  /** Single HTTP transport instance. Created once in startHttp() and reused for all requests. */
  private _httpTransport: StreamableHTTPServerTransport | undefined = undefined;
  private _creatorTools: CreatorTools | undefined = undefined;

  private _serverManager: ServerManager | undefined;

  /** Cache for loaded MCP preferences, keyed by folder path where prefs.json was found */
  private _mcpPrefsCache: IMctMcpPrefsCache = {};

  /** Folders we've already checked and found no prefs.json (negative cache) */
  private _mcpPrefsNotFoundFolders: Set<string> = new Set();

  /** HTTP server port for model preview rendering (dynamically assigned on startup) */
  private _previewServerPort: number = MinecraftMcpServer.PORT_RANGE_START;

  /**
   * Cached PlaywrightPageRenderer for reuse across preview operations.
   *
   * TODO: The renderer init/health-check/reinit boilerplate is duplicated ~4 times
   * in this file (preview_model, preview_volume, preview_structure, screenshot).
   * Extract into a shared `ensureRendererReady(baseUrl, httpServer)` method.
   */
  private _cachedRenderer: PlaywrightPageRenderer | undefined;

  /** Flag to prevent multiple cleanup calls */
  private _cleaningUp: boolean = false;

  /**
   * Maps user-facing session names to BDS slot numbers.
   * The "default" session is auto-registered when `mct serve` starts BDS on slot 0.
   * Additional sessions can be created via createMinecraftSessionWithContent or
   * connected to existing slots via connectToMinecraftSession.
   */
  private _sessions: { [name: string]: ISessionInfo } = {};

  /**
   * Working folder path for MCP operations.
   * When set via the -i argument, this folder is used as the default context for
   * file operations and is exposed to AI assistants via the MCP protocol's prompts.
   */
  private _workingFolder: string | undefined = undefined;

  /** Getter for the working folder */
  get workingFolder(): string | undefined {
    return this._workingFolder;
  }

  constructor() {
    this._server = new McpServer({
      name: "minecraft-creator-tools",
      version: "1.0.0",
    });

    this._processValidateContent = this._processValidateContent.bind(this);
    this._processValidateContentAtPath = this._processValidateContentAtPath.bind(this);
    this._runActionSet = this._runActionSet.bind(this);
    this._moveSessionPlayerToLocation = this._moveSessionPlayerToLocation.bind(this);
    this._sessionOp = this._sessionOp.bind(this);
    this._runActionSetOp = this._runActionSetOp.bind(this);
    this._createOp = this._createOp.bind(this);
    this._addOp = this._addOp.bind(this);
    this._createMinecraftSession = this._createMinecraftSession.bind(this);
    this._runCommandOp = this._runCommandOp.bind(this);
    this._readImageFileOp = this._readImageFileOp.bind(this);
    this._writeImageFileFromBase64Op = this._writeImageFileFromBase64Op.bind(this);
    this._writeImageFileFromSvgOp = this._writeImageFileFromSvgOp.bind(this);
    this._writeImageFileFromPixelArtOp = this._writeImageFileFromPixelArtOp.bind(this);
    this._designModelOp = this._designModelOp.bind(this);
    this._designStructureOp = this._designStructureOp.bind(this);
    this._createMinecraftContentOp = this._createMinecraftContentOp.bind(this);
    this._getEffectiveContentSchemaOp = this._getEffectiveContentSchemaOp.bind(this);
    this._listMinecraftSessionsOp = this._listMinecraftSessionsOp.bind(this);
    this._connectToMinecraftSessionOp = this._connectToMinecraftSessionOp.bind(this);
  }

  /**
   * Wrapper for McpServer.registerTool that avoids TS2589 "Type instantiation is
   * excessively deep and possibly infinite" caused by the SDK's complex generic
   * inference on ToolCallback<InputArgs>. Casts the callback to `any` to break the
   * recursive type chain while preserving runtime behavior.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _registerTool(name: string, config: Record<string, any>, cb: (...args: any[]) => any): void {
    this._server.registerTool(name, config as any, cb as any);
  }

  /**
   * Ensures a ServerManager instance is available, creating one if needed.
   * If a ServerManager was provided externally (e.g., from HttpServer in `mct serve` mode),
   * it will be reused. Otherwise, a new one is created with the "mcp" slot prefix
   * to isolate MCP servers from other contexts.
   */
  private ensureServerManager(): ServerManager {
    if (!this._env || !this._creatorTools) {
      throw new Error("Creator Tools is not initialized");
    }

    if (!this._serverManager) {
      this._serverManager = new ServerManager(this._env, this._creatorTools);
      // Use "mcp" prefix to isolate MCP server slots from other contexts (serve, vscode)
      this._serverManager.slotPrefix = "mcp";
    }

    return this._serverManager;
  }

  /**
   * Resolve a session name to a slot number.
   * - If sessionName is empty/undefined or "default", returns slot 0 (the default session).
   * - Otherwise, looks up the session in the registered sessions map.
   * - Throws if the session name is not found.
   */
  private _resolveSlot(sessionName?: string): number {
    if (!sessionName || sessionName === "default") {
      return 0;
    }

    const info = this._sessions[sessionName];
    if (info !== undefined) {
      return info.slot;
    }

    throw new Error(
      `Unknown session "${sessionName}". Use listMinecraftSessions to discover sessions or connectToMinecraftSession to register one.`
    );
  }

  /**
   * Handle an incoming HTTP request by delegating to the single transport.
   *
   * Architecture: We use one StreamableHTTPServerTransport created in startHttp()
   * and connected once to the McpServer. The transport handles session management,
   * initialization, and request routing internally. This avoids the SDK limitation
   * where registerCapabilities() cannot be called after connect().
   *
   * For POST requests, we pre-parse the body since Node's http.IncomingMessage
   * doesn't auto-parse JSON (unlike Express). The parsed body is passed to
   * transport.handleRequest() so it doesn't try to re-parse.
   */
  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse<http.IncomingMessage>) {
    if (!this._httpTransport) {
      this.sendErrorRequest(503, "MCP server transport not initialized", req, res);
      return;
    }

    if (req.method === "POST") {
      const body: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        body.push(chunk);
      });

      req.on("end", async () => {
        try {
          if (body.length < 1) {
            this.sendErrorRequest(400, "Empty request body", req, res);
            return;
          }

          // Parse body as JSON before passing to the transport.
          // The MCP SDK expects a parsed object, not a raw Buffer.
          // (Express does this automatically via express.json() middleware;
          // we must do it manually with Node's raw http server.)
          let parsedBody: unknown;
          try {
            parsedBody = JSON.parse(Buffer.concat(body).toString());
          } catch {
            this.sendErrorRequest(400, "Invalid JSON in request body", req, res);
            return;
          }

          await this._httpTransport!.handleRequest(req, res, parsedBody);
        } catch (e: any) {
          Log.debug("Error handling MCP POST request: " + (e?.message || e));
          if (!res.headersSent) {
            this.sendErrorRequest(500, "Internal server error processing MCP request", req, res);
          }
        }
      });
    } else if (req.method === "GET" || req.method === "DELETE") {
      // GET (SSE streams) and DELETE (session termination) are forwarded directly
      // to the transport which handles session validation internally.
      try {
        await this._httpTransport.handleRequest(req, res);
      } catch (e: any) {
        Log.debug("Error handling MCP " + req.method + " request: " + (e?.message || e));
        if (!res.headersSent) {
          this.sendErrorRequest(500, "Internal server error processing MCP request", req, res);
        }
      }
    } else {
      this.sendErrorRequest(405, "Method not allowed", req, res);
    }
  }

  sendErrorRequest(statusCode: number, message: string, req: http.IncomingMessage, res: http.ServerResponse) {
    Log.message(HttpUtilities.getShortReqDescription(req) + "Error request: " + message);

    if (!res.headersSent) {
      res.writeHead(statusCode);
    }
    res.end(message);
  }

  /**
   * Finds MCP preferences for a given file path by looking for .mct/mcp/prefs.json
   * in the file's parent folder and up to 11 levels of parent folders.
   * Results are cached per session to avoid redundant file system reads.
   *
   * @param filePath The absolute path to the file being accessed
   * @returns The MCP preferences if found, or undefined if no prefs.json exists`
   */
  getMcpPrefsForPath(filePath: string): IMctMcpPrefs | undefined {
    const normalizedPath = path.normalize(filePath);
    let currentDir = path.dirname(normalizedPath);

    // Check up to 11 levels (current parent + 10 ancestors)
    for (let i = 0; i < 10; i++) {
      // Check if we've already found prefs for this folder
      if (this._mcpPrefsCache[currentDir]) {
        return this._mcpPrefsCache[currentDir];
      }

      // Check if we've already determined there are no prefs in this folder
      if (this._mcpPrefsNotFoundFolders.has(currentDir)) {
        // Continue to parent folder
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          // Reached root
          break;
        }
        currentDir = parentDir;
        continue;
      }

      // Look for .mct/mcp/prefs.json in this folder
      const prefsPath = path.join(currentDir, ".mct", "mcp", "prefs.json");

      if (fs.existsSync(prefsPath)) {
        try {
          const prefsContent = fs.readFileSync(prefsPath, "utf-8");
          const prefs: IMctMcpPrefs = JSON.parse(prefsContent);
          // Cache the prefs for this folder
          this._mcpPrefsCache[currentDir] = prefs;
          return prefs;
        } catch (error) {
          Log.debugAlert(`Failed to parse MCP prefs at ${prefsPath}: ${error}`);
          // Mark as not found so we don't keep trying to parse a malformed file
          this._mcpPrefsNotFoundFolders.add(currentDir);
        }
      } else {
        // Mark this folder as checked (no prefs found)
        this._mcpPrefsNotFoundFolders.add(currentDir);
      }

      // Move to parent folder
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root
        break;
      }
      currentDir = parentDir;
    }

    return undefined;
  }

  /**
   * Checks if a specific MCP preference flag is enabled for a given file path.
   *
   * @param filePath The absolute path to the file being accessed
   * @param prefKey The preference key to check
   * @returns true if the preference is explicitly set to true, false otherwise
   */
  isMcpPrefEnabled(filePath: string, prefKey: keyof IMctMcpPrefs): boolean {
    const prefs = this.getMcpPrefsForPath(filePath);
    if (!prefs) {
      return false;
    }
    return prefs[prefKey] === true;
  }

  /**
   * Validates that a file path is safe for MCP operations.
   * Ensures the path doesn't use traversal sequences and that the resolved path
   * stays within the directory tree authorized by the prefs.json file.
   */
  private _validateMcpFilePath(filePath: string): { valid: boolean; error?: string } {
    if (!filePath) {
      return { valid: false, error: "File path is required." };
    }

    // Reject null bytes
    if (filePath.includes("\0")) {
      return { valid: false, error: "File path contains invalid characters." };
    }

    // Resolve to absolute and normalize
    const resolved = path.resolve(filePath);

    // Reject if the resolved path differs from the normalized input in a way that indicates traversal.
    // path.resolve handles ../  but we also explicitly reject the sequences.
    const normalized = path.normalize(filePath);
    if (normalized.includes("..")) {
      return { valid: false, error: "File path must not contain directory traversal sequences (..)." };
    }

    // Reject symlinks on the parent directory to prevent symlink-based escapes
    const parentDir = path.dirname(resolved);
    try {
      if (fs.existsSync(parentDir)) {
        const realParent = fs.realpathSync(parentDir);
        if (realParent !== parentDir) {
          return {
            valid: false,
            error: "File path parent directory resolves through a symlink, which is not allowed.",
          };
        }
      }
    } catch {
      // If we can't check, allow -- the subsequent fs operations will fail naturally
    }

    return { valid: true };
  }

  /**
   * Validates an MCP file path and returns an error CallToolResult if invalid,
   * or undefined if the path is safe. Use as an early-return guard in MCP tool handlers.
   */
  private _checkMcpFilePath(filePath: string): CallToolResult | undefined {
    const pathCheck = this._validateMcpFilePath(filePath);
    if (!pathCheck.valid) {
      return {
        content: [{ type: "text", text: `Error: ${pathCheck.error}` }],
        isError: true,
      };
    }
    return undefined;
  }

  async _processValidateContent(args: { jsonContentOrBase64ZipContent: string }): Promise<CallToolResult> {
    if (!this._creatorTools) {
      throw new Error("Creator Tools is not initialized");
    }

    const projectOrError = await this._creatorTools.createProjectFromContent(args.jsonContentOrBase64ZipContent);

    if (!projectOrError || typeof projectOrError === "string") {
      throw new Error(
        "Failed to create project. Was the content a valid Base64-encoded ZIP file?" +
          (typeof projectOrError === "string" ? " Error: " + projectOrError : "")
      );
    }

    const pis = projectOrError.indevInfoSet;

    await pis.generateForProject();

    const resultObject = pis.getDataObject(undefined, undefined, undefined);

    return {
      content: [{ type: "text", text: JSON.stringify(resultObject, null, 2) }],
      structuredContent: { info: resultObject },
    };
  }

  async _sessionOp(args: { sessionName: string }): Promise<CallToolResult> {
    return {
      content: [{ type: "text", text: "Successfully completed" }],
    };
  }

  /**
   * Lists all Minecraft sessions — both registered named sessions and any
   * active BDS slots discovered via the ServerManager.
   */
  async _listMinecraftSessionsOp(): Promise<CallToolResult> {
    if (!this._creatorTools || !this._env) {
      throw new Error("Creator Tools is not initialized");
    }

    const serverManager = this.ensureServerManager();
    const activeSlots = serverManager.getActiveSlots();

    // Build a merged view: named sessions + any unnamed active slots
    const sessions: {
      name: string;
      slot: number;
      port: number;
      status: string;
    }[] = [];

    // Emit all named sessions
    for (const name of Object.keys(this._sessions)) {
      const info = this._sessions[name];
      const slot = info.slot;
      const port = MinecraftUtilities.getPortForSlot(slot);
      const server = serverManager.getActiveServer(slot);
      const status = server ? DedicatedServerStatus[server.status] : "stopped";
      sessions.push({ name, slot, port, status });
    }

    // Discover active slots that have no name registered
    const namedSlots = new Set(Object.values(this._sessions).map((s) => s.slot));
    for (const slot of activeSlots) {
      if (!namedSlots.has(slot)) {
        const port = MinecraftUtilities.getPortForSlot(slot);
        const server = serverManager.getActiveServer(slot);
        const status = server ? DedicatedServerStatus[server.status] : "stopped";
        sessions.push({ name: `(unnamed slot ${slot})`, slot, port, status });
      }
    }

    return {
      content: [{ type: "text", text: JSON.stringify(sessions, null, 2) }],
    };
  }

  /**
   * Registers an existing BDS slot as a named session so that subsequent
   * tool calls can reference it by name.
   */
  async _connectToMinecraftSessionOp(args: { sessionName: string; slot?: number }): Promise<CallToolResult> {
    if (!this._creatorTools || !this._env) {
      throw new Error("Creator Tools is not initialized");
    }

    const slot = args.slot ?? 0;
    const serverManager = this.ensureServerManager();
    const server = serverManager.getActiveServer(slot);

    if (!server) {
      return {
        content: [
          {
            type: "text",
            text:
              `No active server found on slot ${slot} (port ${MinecraftUtilities.getPortForSlot(slot)}). ` +
              `Use listMinecraftSessions to see active slots, or createMinecraftSessionWithContent to start a new one.`,
          },
        ],
        isError: true,
      };
    }

    this._sessions[args.sessionName] = { slot, description: `Connected to existing slot ${slot}` };

    const status = DedicatedServerStatus[server.status];
    return {
      content: [
        {
          type: "text",
          text: `Session "${args.sessionName}" registered on slot ${slot} (port ${MinecraftUtilities.getPortForSlot(slot)}, status: ${status}).`,
        },
      ],
    };
  }

  async _moveSessionPlayerToLocation(args: {
    sessionName: string;
    playerName: string;
    locationToHavePlayerMoveTo: IVector3;
  }): Promise<CallToolResult> {
    const slot = this._resolveSlot(args.sessionName);

    let result = await this._runActionSet(
      {
        name: "Test Player Move Action Set",
        targetType: 1,
        actions: [
          {
            type: "test_simulated_player_move",
            name: args.playerName,
            location: [
              args.locationToHavePlayerMoveTo.x,
              args.locationToHavePlayerMoveTo.y,
              args.locationToHavePlayerMoveTo.z,
            ],
          },
        ],
      },
      slot
    );

    return {
      content: [{ type: "text", text: "Successfully moved player in session" }],
      structuredContent: { state: result ?? {} },
    };
  }

  async _createMinecraftSession(args: {
    sessionName: string;
    packagedMcaddonOrMcworldFilePath: string;
    testPlayerNameToUse: string;
  }): Promise<CallToolResult> {
    if (!this._creatorTools || !this._env) {
      throw new Error("Creator Tools is not initialized");
    }

    const serverManager = this.ensureServerManager();

    await this._env.load();
    await serverManager.prepare();

    serverManager.ensureHttpServer(6128);

    // Find the next free slot. If slot 0 is already occupied by an active server,
    // pick the first unused slot so we don't clobber an existing session.
    const activeSlots = new Set(serverManager.getActiveSlots());
    const usedSlots = new Set(Object.values(this._sessions).map((s) => s.slot));
    let targetSlot = 0;
    while (activeSlots.has(targetSlot) || usedSlots.has(targetSlot)) {
      targetSlot++;
      if (targetSlot >= 80) {
        throw new Error("No free server slots available (all 80 are in use).");
      }
    }

    const startMessage: IMinecraftStartMessage = {
      mode: DedicatedServerMode.auto,
      path: undefined,
      additionalContentPath: args.packagedMcaddonOrMcworldFilePath,
      forceStartNewWorld: true, // Always start with a fresh world for MCP sessions
      worldSettings: this.getWorldSettings(),
      transientWorld: true, // Mark as transient - world data is reset each deployment
    };

    let srvr = await serverManager.ensureActiveServer(targetSlot, startMessage);

    if (srvr) {
      await srvr.startServer(false, startMessage);
      await srvr.waitUntilStarted();
    }

    // Register the newly created session
    this._sessions[args.sessionName] = { slot: targetSlot, description: `Created with content` };

    let result = await this._runActionSet(
      {
        name: "Test Player Spawn Action Set",
        targetType: 1,
        actions: [{ type: "test_simulated_player_spawn", name: args.testPlayerNameToUse, location: [0, 0, 0] }],
      },
      targetSlot
    );

    const port = MinecraftUtilities.getPortForSlot(targetSlot);
    return {
      content: [
        {
          type: "text",
          text: `Successfully started session "${args.sessionName}" on slot ${targetSlot} (port ${port}).`,
        },
      ],
      structuredContent: { state: result ?? {} },
    };
  }

  async _runActionSet(actionSet: IActionSetData, slot?: number) {
    let actionSetStr = JSON.stringify(actionSet);

    actionSetStr = actionSetStr.replace(/\"/g, "|");

    let token = Utilities.createRandomLowerId(6);

    let result = await this.runCommand(
      'scriptevent mct:actionset "' + token + "|" + actionSetStr + '"',
      token + "|",
      slot
    );
    if (result) {
      let rasIndex = result.indexOf("ras|");

      if (rasIndex) {
        let nextPipe = result.indexOf("|", rasIndex + 5);

        if (nextPipe >= 0) {
          const resultJsonStr = result.substring(nextPipe + 1);

          try {
            const resultObject = JSON.parse(resultJsonStr);
            return resultObject;
          } catch (e) {
            return undefined;
          }
        }
      }
    }
    return undefined;
  }

  getWorldSettings() {
    let gt: GameType = GameType.survival;

    let generator: Generator = Generator.infinite;

    let difficulty: Difficulty = Difficulty.easy;

    let randomSeed = "2000";

    const packRefs: IPackageReference[] = [];

    Package.ensureMinecraftCreatorToolsPackageReference(packRefs);

    const worldSettings: IWorldSettings = {
      gameType: gt,
      generator: generator,
      cheatsEnabled: true,
      difficulty: difficulty,
      playerPermissionLevel: PlayerPermissionsLevel.operator,
      permissionLevel: PlayerPermissionsLevel.operator,
      randomSeed: randomSeed,
      packageReferences: packRefs,
      worldTemplateReferences: undefined,
    };

    return worldSettings;
  }

  async _runActionSetOp(args: { actionSet?: any; sessionName?: string }): Promise<CallToolResult> {
    if (!this._creatorTools || !this._env || !args.actionSet) {
      throw new Error("Creator Tools is not initialized");
    }

    const slot = this._resolveSlot(args.sessionName);
    const serverManager = this.ensureServerManager();

    let srvr = await serverManager.ensureActiveServer(slot);

    if (srvr) {
      await this._runActionSet(args.actionSet, slot);
    }

    return {
      content: [{ type: "text", text: "Successfully ran action set operation" }],
    };
  }

  async _runCommandOp(args: { sessionName: string; command: string }): Promise<CallToolResult> {
    const slot = this._resolveSlot(args.sessionName);
    let result = await this.runCommand(args.command, undefined, slot);
    return {
      content: [{ type: "text", text: result ? result : "No result from command" }],
    };
  }

  async runCommand(command: string, token?: string, slot?: number): Promise<string | undefined> {
    if (!this._creatorTools || !this._env) {
      throw new Error("Creator Tools is not initialized");
    }

    const serverManager = this.ensureServerManager();

    let srvr = await serverManager.ensureActiveServer(slot ?? 0);

    let result = undefined;

    if (srvr) {
      result = await srvr.runCommandImmediate(command, token);
    }

    return result;
  }

  async _processValidateContentAtPath(args: { filePath: string }): Promise<CallToolResult> {
    if (!this._creatorTools) {
      throw new Error("Creator Tools is not initialized");
    }

    const projectOrError = await this._creatorTools.createProjectFromPath(args.filePath);

    if (!projectOrError || typeof projectOrError === "string") {
      throw new Error(
        "Failed to create project. Was the content a valid Base64-encoded ZIP file?" +
          (typeof projectOrError === "string" ? " Error: " + projectOrError : "")
      );
    }

    const pis = projectOrError.indevInfoSet;

    await pis.generateForProject();

    const resultObject = pis.getDataObject(undefined, undefined, undefined);

    return {
      content: [{ type: "text", text: JSON.stringify(resultObject, null, 2) }],
      structuredContent: { info: resultObject },
    };
  }

  async _create(
    project: Project,
    title: string,
    description: string,
    newName: string,
    creator: string,
    template: string
  ) {
    if (!this._env || !this._creatorTools) {
      return;
    }

    await this._env.load();

    if (!this._env.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      Log.message("The Minecraft End User License Agreement and Privacy Statement was not agreed to.");
      return;
    }

    await this._creatorTools.loadGallery();

    if (!this._creatorTools.gallery) {
      Log.message("Not configured correctly to create a project (no gallery).");
      return;
    }
    const galProjects = this._creatorTools.gallery.items;
    let galProject: IGalleryItem | undefined;

    if (template) {
      for (let i = 0; i < galProjects.length; i++) {
        const galProjectCand = galProjects[i];
        if (galProjectCand && galProjectCand.id && galProjectCand.id.toLowerCase() === template.toLowerCase()) {
          galProject = galProjectCand;
        }
      }
    }

    if (!newName) {
      Log.error("Not configured correctly to create a project.");
      return;
    }

    if (!galProject) {
      Log.error("No project was selected.");
      return;
    }

    project = await ProjectExporter.syncProjectFromGitHub(
      true,
      this._creatorTools,
      galProject.gitHubRepoName,
      galProject.gitHubOwner,
      galProject.gitHubBranch,
      galProject.gitHubFolder,
      newName,
      project,
      galProject.fileList,
      async (message: string) => {
        Log.message(message);
      },
      true
    );

    let suggestedShortName: string | undefined = undefined;

    if (newName && creator) {
      suggestedShortName = ProjectUtilities.getSuggestedProjectShortName(creator, newName);
    }

    if (creator) {
      await ProjectUtilities.applyCreator(project, creator);
    }

    await ProjectUtilities.processNewProject(project, title, description, suggestedShortName, false);
  }

  async _add(project: Project, templateType: string, newName: string): Promise<boolean> {
    if (!this._env || !this._creatorTools) {
      Log.error("Not configured correctly to create a project (no mctools core).");
      return false;
    }

    await this._env.load();

    if (!this._env.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyStatementAtMinecraftDotNetSlashEula) {
      Log.message("The Minecraft End User License Agreement and Privacy Statement was not agreed to.");
      return false;
    }

    await this._creatorTools.loadGallery();

    if (!this._creatorTools.gallery) {
      Log.message("Not configured correctly to add an item (no gallery).");
      return false;
    }

    if (templateType && newName) {
      for (const galItem of this._creatorTools.gallery.items) {
        if (galItem.id === templateType) {
          await ProjectItemCreateManager.addFromGallery(project, newName, galItem);
          await project.save();

          return true;
        }
      }
    }

    return false;
  }

  async _createOp(args: {
    folderPathToCreateProjectAt: string;
    title: string;
    description?: string;
    newName: string;
    creator: string;
    template:
      | "addonStarter"
      | "tsStarter"
      | "addonFull"
      | "scriptBox"
      | "dlStarter"
      | "editor-scriptBox"
      | "editor-basics";
  }): Promise<CallToolResult> {
    if (!this._creatorTools) {
      throw new Error("Creator Tools is not initialized");
    }

    if (!fs.existsSync(args.folderPathToCreateProjectAt)) {
      fs.mkdirSync(args.folderPathToCreateProjectAt, { recursive: true });
    }

    const project = ClUtils.createProject(this._creatorTools, {
      ctorProjectName: args.newName,
      localFolderPath: args.folderPathToCreateProjectAt,
    });

    await this._create(
      project,
      args.title,
      args.description ? args.description : "",
      args.newName,
      args.creator,
      args.template
    );

    return {
      content: [{ type: "text", text: "Created! Additional files were added to your project." }],
    };
  }

  async _addOp(args: {
    folderPathToCreateProjectAt: string;
    templateType:
      | "basicUnitCubeBlock"
      | "crateBlock"
      | "basicDieBlock"
      | "sushiRollBlock"
      | "fishBowlBlock"
      | "hardBiscuit"
      | "pear"
      | "elixir"
      | "rod"
      | "key"
      | "customSword"
      | "wrench"
      | "allay"
      | "axolotl"
      | "cat"
      | "cow"
      | "creeper"
      | "enderman"
      | "rabbit"
      | "pig"
      | "sheep"
      | "skeleton"
      | "wolf"
      | "zombie"
      | "spawn_rule"
      | "loot_table"
      | "recipe_shapeless"
      | "recipe_shaped"
      | "feature_rule"
      | "jigsaw"
      | "atmospherics"
      | "color_grading"
      | "lighting"
      | "pbr"
      | "biome_behavior"
      | "entity_behavior"
      | "entity_resources"
      | "item_behavior"
      | "attachable"
      | "block_behavior"
      | "block_culling"
      | "block_catalog"
      | "biome_resource"
      | "aggregate_feature"
      | "animation"
      | "animation_controller"
      | "render_controller";
    name: string;
  }): Promise<CallToolResult> {
    if (!this._creatorTools) {
      throw new Error("Creator Tools is not initialized");
    }

    if (!fs.existsSync(args.folderPathToCreateProjectAt)) {
      fs.mkdirSync(args.folderPathToCreateProjectAt, { recursive: true });
    }

    const project = ClUtils.createProject(this._creatorTools, {
      ctorProjectName: args.name,
      localFolderPath: args.folderPathToCreateProjectAt,
    });

    // Load existing project structure so that addFromGallery places files into
    // the correct existing pack folders rather than creating new ones.
    await project.inferProjectItemsFromFiles();

    let result = await this._add(project, args.templateType, args.name);

    if (!result) {
      return {
        content: [{ type: "text", text: "No items were added." }],
      };
    } else {
      return {
        content: [{ type: "text", text: "Additional items were added." }],
      };
    }
  }

  /**
   * Creates Minecraft content from a meta-schema definition.
   * This is a simplified, AI-friendly format that generates all required files.
   */
  async _createMinecraftContentOp(args: {
    definition: z.infer<typeof MinecraftContentSchema>;
    outputPath: string;
  }): Promise<CallToolResult> {
    if (!this._creatorTools) {
      throw new Error("Creator Tools is not initialized");
    }

    try {
      // Validate the definition
      const parseResult = MinecraftContentSchema.safeParse(args.definition);
      if (!parseResult.success) {
        return {
          content: [
            {
              type: "text",
              text: `Validation error: ${parseResult.error.errors
                .map((e) => `${e.path.join(".")}: ${e.message}`)
                .join(", ")}`,
            },
          ],
        };
      }

      // Generate the content
      const generator = new ContentGenerator(parseResult.data as any);
      const generated = await generator.generate();

      // Resolve where artifacts should actually land. The user may have passed a
      // folder that's inside an existing project, a newly-created empty folder, or
      // a folder that already has unrelated content. See _resolveProjectRoot for
      // the heuristic.
      const resolved = MinecraftMcpServer._resolveProjectRoot(args.outputPath, {
        namespace: parseResult.data.namespace,
        displayName: parseResult.data.displayName,
      });
      const projectRoot = resolved.root;

      // Ensure the resolved project root exists
      if (!fs.existsSync(projectRoot)) {
        fs.mkdirSync(projectRoot, { recursive: true });
      }

      const namespace = parseResult.data.namespace || "custom";

      // Detect existing pack folders so we can reuse them instead of creating duplicates.
      // If a project was previously created (e.g., via createProject), use the first existing
      // behavior/resource pack folder rather than creating a new namespace-based one.
      let bpBasePath = path.join(projectRoot, "behavior_packs", namespace);
      let rpBasePath = path.join(projectRoot, "resource_packs", namespace);

      const existingBpFolder = MinecraftMcpServer._findExistingPackFolder(path.join(projectRoot, "behavior_packs"));
      const existingRpFolder = MinecraftMcpServer._findExistingPackFolder(path.join(projectRoot, "resource_packs"));

      if (existingBpFolder) {
        bpBasePath = existingBpFolder;
      }
      if (existingRpFolder) {
        rpBasePath = existingRpFolder;
      }

      // Write generated files
      const filesWritten: string[] = [];

      // Helper to write files
      const writeFile = (file: { path: string; pack: string; type: string; content: object | string | Uint8Array }) => {
        let basePath = projectRoot;
        if (file.pack === "behavior") {
          basePath = bpBasePath;
        } else if (file.pack === "resource") {
          basePath = rpBasePath;
        }

        const fullPath = path.resolve(basePath, file.path);
        const resolvedOutputPath = path.resolve(projectRoot);

        // Prevent path traversal: ensure the resolved path stays within the output directory
        if (!fullPath.startsWith(resolvedOutputPath + path.sep) && fullPath !== resolvedOutputPath) {
          Log.error("Skipping file with path traversal outside output directory: " + file.path);
          return;
        }

        const dirPath = path.dirname(fullPath);

        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        // Do not overwrite files that already exist (e.g., files created by
        // designModel or manually by the user). Only write new files.
        if (fs.existsSync(fullPath)) {
          return;
        }

        if (file.type === "json") {
          fs.writeFileSync(fullPath, JSON.stringify(file.content, null, 2), "utf-8");
        } else if (file.type === "text") {
          fs.writeFileSync(fullPath, file.content as string, "utf-8");
        } else if (file.type === "png") {
          // Handle both Uint8Array (from ContentGenerator) and base64 string
          if (file.content instanceof Uint8Array) {
            fs.writeFileSync(fullPath, Buffer.from(file.content));
          } else {
            fs.writeFileSync(fullPath, Buffer.from(file.content as string, "base64"));
          }
        }

        filesWritten.push(fullPath);
      };

      // Write all generated files — but preserve existing manifest UUIDs
      // and merge texture atlas files rather than overwriting them.
      if (generated.behaviorPackManifest) {
        MinecraftMcpServer._writeManifestPreservingUuids(bpBasePath, generated.behaviorPackManifest, filesWritten);
      }
      if (generated.resourcePackManifest) {
        MinecraftMcpServer._writeManifestPreservingUuids(rpBasePath, generated.resourcePackManifest, filesWritten);
      }

      for (const file of generated.entityBehaviors) writeFile(file);
      for (const file of generated.entityResources) writeFile(file);
      for (const file of generated.blockBehaviors) writeFile(file);
      for (const file of generated.blockResources) writeFile(file);
      for (const file of generated.itemBehaviors) writeFile(file);
      for (const file of generated.itemResources) writeFile(file);
      for (const file of generated.lootTables) writeFile(file);
      for (const file of generated.recipes) writeFile(file);
      for (const file of generated.spawnRules) writeFile(file);
      for (const file of generated.features) writeFile(file);
      for (const file of generated.featureRules) writeFile(file);
      for (const file of generated.textures) writeFile(file);
      for (const file of generated.geometries) writeFile(file);
      for (const file of generated.renderControllers) writeFile(file);

      // Merge singleton resource pack files: these are pack-wide catalogs where
      // each MCP call should ADD entries rather than overwrite the entire file.
      if (generated.terrainTextures) {
        MinecraftMcpServer._writeSingletonJsonMerging(rpBasePath, generated.terrainTextures, filesWritten);
      }
      if (generated.itemTextures) {
        MinecraftMcpServer._writeSingletonJsonMerging(rpBasePath, generated.itemTextures, filesWritten);
      }
      if (generated.blocksCatalog) {
        MinecraftMcpServer._writeSingletonJsonMerging(rpBasePath, generated.blocksCatalog, filesWritten);
      }
      if (generated.soundDefinitions) {
        MinecraftMcpServer._writeSingletonJsonMerging(rpBasePath, generated.soundDefinitions, filesWritten);
      }
      if (generated.musicDefinitions) {
        MinecraftMcpServer._writeSingletonJsonMerging(rpBasePath, generated.musicDefinitions, filesWritten);
      }

      // Also merge any items in the sounds array that target singleton files
      for (const file of generated.sounds) {
        MinecraftMcpServer._writeSingletonJsonMerging(rpBasePath, file, filesWritten);
      }

      // Build summary
      const summary = generated.summary;
      let summaryText = `Generated ${filesWritten.length} files for namespace "${summary.namespace}":\n`;
      summaryText += `- ${summary.entityCount} entity types\n`;
      summaryText += `- ${summary.blockCount} block types\n`;
      summaryText += `- ${summary.itemCount} item types\n`;
      summaryText += `- ${summary.lootTableCount} loot tables\n`;
      summaryText += `- ${summary.recipeCount} recipes\n`;
      summaryText += `- ${summary.spawnRuleCount} spawn rules\n`;
      summaryText += `- ${summary.featureCount} features\n`;
      summaryText += `\nProject root: ${projectRoot}\n(${resolved.reason})\n`;

      if (summary.warnings.length > 0) {
        summaryText += `\nWarnings:\n${summary.warnings.map((w) => `- ${w}`).join("\n")}`;
      }

      if (summary.errors.length > 0) {
        summaryText += `\nErrors:\n${summary.errors.map((e) => `- ${e}`).join("\n")}`;
      }

      return {
        content: [{ type: "text", text: summaryText }],
        structuredContent: {
          filesWritten,
          projectRoot,
          projectRootReason: resolved.reason,
          summary: generated.summary,
        },
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error generating content: ${error}` }],
      };
    }
  }

  /**
   * Finds the first existing pack folder inside a container directory (e.g., behavior_packs/).
   * Returns the folder path if a pack (folder with manifest.json) is found, otherwise undefined.
   */
  private static _findExistingPackFolder(containerPath: string): string | undefined {
    if (!fs.existsSync(containerPath)) {
      return undefined;
    }

    try {
      for (const entry of fs.readdirSync(containerPath, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const manifestPath = path.join(containerPath, entry.name, "manifest.json");
          if (fs.existsSync(manifestPath)) {
            return path.join(containerPath, entry.name);
          }
        }
      }
    } catch {
      // If we can't read the directory, fall through to create a new folder
    }

    return undefined;
  }

  /**
   * Returns true when the supplied folder already looks like a Bedrock resource
   * pack — i.e. it contains a top-level manifest.json whose modules include a
   * `resources` module. Used by designModel to avoid creating a nested
   * `resource_packs/` subdirectory inside an RP that the caller passed
   * directly, which previously caused a recurring "files written to the wrong
   * path" symptom.
   */
  private static _isResourcePackFolder(folderPath: string): boolean {
    try {
      const manifestPath = path.join(folderPath, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return false;
      }
      const raw = fs.readFileSync(manifestPath, "utf8");
      const parsed = JSON.parse(raw);
      const modules: any[] = Array.isArray(parsed?.modules) ? parsed.modules : [];
      return modules.some((m) => m && typeof m.type === "string" && m.type === "resources");
    } catch {
      return false;
    }
  }

  /**
   * Sanitize a display name or namespace into a safe folder name.
   * Lower-cases, replaces non-alphanumeric runs with '_', trims.
   * Caps length at 64 characters to keep resulting paths well under the
   * Windows MAX_PATH limit once nested inside the project/pack hierarchy.
   */
  private static _toSafeFolderName(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 64) || "addon"
    );
  }

  /**
   * Returns the list of visible child entries in a directory, or an empty array if
   * the directory doesn't exist / can't be read. Hidden/system files (.git, .DS_Store,
   * Thumbs.db, desktop.ini) are ignored when deciding whether a folder is "empty".
   */
  private static _visibleChildren(folder: string): string[] {
    if (!fs.existsSync(folder)) {
      return [];
    }
    try {
      return fs.readdirSync(folder).filter((name) => {
        if (name.startsWith(".")) return false;
        const lower = name.toLowerCase();
        return lower !== "thumbs.db" && lower !== "desktop.ini";
      });
    } catch {
      return [];
    }
  }

  /**
   * Resolves where content should actually be generated, given a user-provided outputPath.
   *
   * Heuristic (in priority order):
   *   1. If outputPath (or a parent within 2 levels) has a Minecraft project reference point
   *      — package.json, behavior_packs/, resource_packs/, or a manifest.json — anchor to
   *      that project root. This is the most common "add to existing project" case.
   *   2. If outputPath doesn't exist, or is empty (ignoring hidden/system files), use it
   *      directly as the project root.
   *   3. Otherwise (outputPath is non-empty with unrelated content), create a subfolder
   *      named after the namespace/displayName and use that as the root.
   *
   * Returns both the resolved root and a human-readable reason string (useful for the
   * tool response so agents learn where files landed and why).
   */
  private static _resolveProjectRoot(
    outputPath: string,
    definition: { namespace?: string; displayName?: string }
  ): { root: string; reason: string } {
    const normalized = path.resolve(outputPath);

    // Walk up at most 2 levels looking for a project reference point.
    let current = normalized;
    for (let depth = 0; depth <= 2; depth++) {
      if (!fs.existsSync(current)) {
        // Parent doesn't exist — stop walking up.
        break;
      }
      const entries = new Set(MinecraftMcpServer._visibleChildren(current));

      if (entries.has("behavior_packs") || entries.has("resource_packs")) {
        return {
          root: current,
          reason:
            depth === 0
              ? "outputPath already contains behavior_packs/ or resource_packs/ — using it as project root"
              : `found behavior_packs/ or resource_packs/ ${depth} level(s) above outputPath — anchoring to that project root`,
        };
      }
      if (entries.has("manifest.json")) {
        // outputPath itself is a pack folder — use its grandparent (project root).
        const grandparent = path.dirname(path.dirname(current));
        return {
          root: grandparent,
          reason: "outputPath appears to be inside a pack (manifest.json present) — anchoring to the project root",
        };
      }
      if (entries.has("package.json")) {
        return {
          root: current,
          reason:
            depth === 0
              ? "outputPath contains package.json — treating it as the project root"
              : `package.json found ${depth} level(s) above outputPath — anchoring to that repo root`,
        };
      }
      // Don't walk up further if the current folder isn't obviously a candidate for "inside a project"
      if (depth === 0) {
        current = path.dirname(current);
      } else {
        break;
      }
    }

    // No reference point found. Check whether outputPath is empty.
    const visible = MinecraftMcpServer._visibleChildren(normalized);
    if (!fs.existsSync(normalized) || visible.length === 0) {
      return {
        root: normalized,
        reason: "outputPath is empty (or does not yet exist) — using it directly as the project root",
      };
    }

    // Non-empty with unrelated content — create a namespaced subfolder to avoid collisions.
    const subfolderName = MinecraftMcpServer._toSafeFolderName(
      definition.namespace || definition.displayName || "addon"
    );
    return {
      root: path.join(normalized, subfolderName),
      reason: `outputPath is non-empty and has no Minecraft project markers — creating subfolder "${subfolderName}" to avoid clobbering existing content`,
    };
  }

  /**
   * Writes a manifest.json file, but preserves the UUIDs from any existing manifest
   * at the same location. This prevents breaking worlds that already reference the pack
   * when content is added across multiple MCP calls.
   */
  private static _writeManifestPreservingUuids(
    packBasePath: string,
    manifestFile: { path: string; pack: string; type: string; content: object | string | Uint8Array },
    filesWritten: string[]
  ) {
    const fullPath = path.join(packBasePath, manifestFile.path);
    const dirPath = path.dirname(fullPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const newManifest = manifestFile.content as any;

    // If an existing manifest is present, preserve its header UUID, module UUIDs, and dependencies
    if (fs.existsSync(fullPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

        if (existing.header?.uuid) {
          newManifest.header.uuid = existing.header.uuid;
        }
        if (existing.header?.version) {
          newManifest.header.version = existing.header.version;
        }

        // Preserve module UUIDs
        if (existing.modules && Array.isArray(existing.modules) && newManifest.modules) {
          for (let i = 0; i < Math.min(existing.modules.length, newManifest.modules.length); i++) {
            if (existing.modules[i]?.uuid) {
              newManifest.modules[i].uuid = existing.modules[i].uuid;
            }
          }
        }

        // Preserve dependencies (they contain cross-pack UUID references)
        if (existing.dependencies && !newManifest.dependencies) {
          newManifest.dependencies = existing.dependencies;
        }
      } catch {
        // If existing manifest is malformed, just write the new one
      }
    }

    fs.writeFileSync(fullPath, JSON.stringify(newManifest, null, 2), "utf-8");
    filesWritten.push(fullPath);
  }

  /**
   * Writes a singleton JSON file (terrain_texture.json, item_texture.json, blocks.json,
   * sound_definitions.json, music_definitions.json, etc.), deep-merging with any existing
   * data so that previously-added entries are preserved instead of being overwritten.
   *
   * Merge strategy:
   * - Recursively merges object keys: new entries win on conflict, but existing
   *   object-valued entries are recursively merged rather than replaced.
   * - Scalar top-level keys from the existing file are preserved if absent in the new content.
   * - This handles texture_data in terrain/item_texture.json, block entries in blocks.json,
   *   entity_sounds.entities in sounds.json, sound_definitions entries, etc.
   */
  private static _writeSingletonJsonMerging(
    packBasePath: string,
    singletonFile: { path: string; pack: string; type: string; content: object | string | Uint8Array },
    filesWritten: string[]
  ) {
    const fullPath = path.join(packBasePath, singletonFile.path);
    const dirPath = path.dirname(fullPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    let newContent = singletonFile.content as any;

    if (fs.existsSync(fullPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        newContent = StorageUtilities.deepMergeJsonObjects(existing, newContent);
      } catch {
        // If existing file is malformed JSON, just write the new content
      }
    }

    fs.writeFileSync(fullPath, JSON.stringify(newContent, null, 2), "utf-8");
    filesWritten.push(fullPath);
  }

  /**
   * Gets the effective content schema for an existing Minecraft project.
   * This analyzes the project's entities, blocks, items, etc. and infers what
   * traits and simplified properties would represent them in meta-schema format.
   *
   * This is the inverse of createMinecraftContentOp - instead of generating
   * native content from a schema, it analyzes native content to produce a schema.
   */
  async _getEffectiveContentSchemaOp(args: {
    folderPath: string;
    options?: {
      minTraitConfidence?: number;
      includeRawComponents?: boolean;
      inferNamespace?: boolean;
      includeBehaviorPresets?: boolean;
      includeComponentGroups?: boolean;
      includeEvents?: boolean;
    };
  }): Promise<CallToolResult> {
    if (!this._creatorTools) {
      throw new Error("Creator Tools is not initialized");
    }

    try {
      // Check if path exists
      if (!fs.existsSync(args.folderPath)) {
        return {
          content: [{ type: "text", text: `Error: Folder not found at path: ${args.folderPath}` }],
          isError: true,
        };
      }

      // Create a project from the path
      const projectOrError = await this._creatorTools.createProjectFromPath(args.folderPath);

      if (!projectOrError || typeof projectOrError === "string") {
        return {
          content: [
            {
              type: "text",
              text:
                `Error: Failed to load project from path: ${args.folderPath}` +
                (typeof projectOrError === "string" ? `. ${projectOrError}` : ""),
            },
          ],
          isError: true,
        };
      }

      // Build inferrer options
      const options: IInferrerOptions = {
        minTraitConfidence: args.options?.minTraitConfidence ?? 0.6,
        includeRawComponents: args.options?.includeRawComponents ?? true,
        inferNamespace: args.options?.inferNamespace ?? true,
        includeBehaviorPresets: args.options?.includeBehaviorPresets ?? true,
        includeComponentGroups: args.options?.includeComponentGroups ?? false,
        includeEvents: args.options?.includeEvents ?? false,
      };

      // Run the inference
      const result = await ContentSchemaInferrer.inferFromProject(projectOrError, options);

      // Build summary text
      let summaryText = `Analyzed content in "${args.folderPath}":\n`;
      summaryText += `- ${result.metadata.entitiesAnalyzed} entities analyzed\n`;
      summaryText += `- ${result.metadata.blocksAnalyzed} blocks analyzed\n`;
      summaryText += `- ${result.metadata.itemsAnalyzed} items analyzed\n`;
      summaryText += `- Inference took ${result.metadata.inferenceTimeMs}ms\n`;

      // Report detected traits
      const entityTraits = Object.entries(result.metadata.allDetectedTraits.entity);
      if (entityTraits.length > 0) {
        summaryText += `\nEntity traits detected:\n`;
        for (const [trait, count] of entityTraits.sort((a, b) => b[1] - a[1])) {
          summaryText += `  - ${trait}: ${count} entities\n`;
        }
      }

      const blockTraits = Object.entries(result.metadata.allDetectedTraits.block);
      if (blockTraits.length > 0) {
        summaryText += `\nBlock traits detected:\n`;
        for (const [trait, count] of blockTraits.sort((a, b) => b[1] - a[1])) {
          summaryText += `  - ${trait}: ${count} blocks\n`;
        }
      }

      const itemTraits = Object.entries(result.metadata.allDetectedTraits.item);
      if (itemTraits.length > 0) {
        summaryText += `\nItem traits detected:\n`;
        for (const [trait, count] of itemTraits.sort((a, b) => b[1] - a[1])) {
          summaryText += `  - ${trait}: ${count} items\n`;
        }
      }

      if (result.metadata.warnings.length > 0) {
        summaryText += `\nWarnings:\n${result.metadata.warnings.map((w) => `- ${w}`).join("\n")}`;
      }

      return {
        content: [
          { type: "text", text: summaryText },
          {
            type: "text",
            text: "\n\nInferred Content Schema:\n```json\n" + JSON.stringify(result.definition, null, 2) + "\n```",
          },
        ],
        structuredContent: {
          definition: result.definition,
          metadata: result.metadata,
        },
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error analyzing content: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Reads an image file and returns its contents as base64-encoded image data
   * that can be displayed by the AI.
   *
   * Requires allowImageFileReadsInDescendentFolders to be set to true in
   * .mct/mcp/prefs.json in the file's parent folder or up to 3 levels above.
   */
  async _readImageFileOp(args: { filePath: string }): Promise<CallToolResult> {
    const filePath = args.filePath;

    // Security check: verify that image file reads are allowed for this path
    if (!this.isMcpPrefEnabled(filePath, "allowImageFileReadsInDescendentFolders")) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Image file reading is not authorized for this path.\n\nTo enable image file reading, create a file at .mct/mcp/prefs.json in the project folder (or up to 3 parent folders above the image) with the following content:\n\n{\n  "allowImageFileReadsInDescendentFolders": true\n}`,
          },
        ],
        isError: true,
      };
    }

    // Validate file path against traversal and symlink attacks
    const pathError1 = this._checkMcpFilePath(filePath);
    if (pathError1) {
      return pathError1;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        content: [{ type: "text", text: `Error: File not found at path: ${filePath}` }],
        isError: true,
      };
    }

    // Get file stats
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      return {
        content: [{ type: "text", text: `Error: Path is a directory, not a file: ${filePath}` }],
        isError: true,
      };
    }

    const mimeType = StorageUtilities.getMimeTypeFromName(filePath);

    // Only allow image files
    if (!StorageUtilities.isImageMimeType(mimeType)) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Not an image file: ${filePath}\nMIME type: ${mimeType}\n\nThis tool only supports image files (.png, .jpg, .gif, .webp, .bmp, .tiff, etc.).`,
          },
        ],
        isError: true,
      };
    }

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString("base64");
      const fitted = MinecraftMcpServer.ensureImageFitsContext(base64Data, mimeType);

      const content: any[] = [];

      // Build image metadata description
      const fileName = path.basename(filePath);
      const fileSizeBytes = fileBuffer.length;
      let dimensionsStr = "";

      // Try to extract image dimensions from the buffer
      try {
        if (mimeType === "image/png" && fileSizeBytes >= 24) {
          // PNG dimensions are at byte offsets 16-23 in the IHDR chunk
          const width = fileBuffer.readUInt32BE(16);
          const height = fileBuffer.readUInt32BE(20);
          dimensionsStr = `${width}x${height}`;
        } else if ((mimeType === "image/jpeg" || mimeType === "image/jpg") && fileSizeBytes > 2) {
          dimensionsStr = MinecraftMcpServer._getJpegDimensions(fileBuffer);
        } else if (mimeType === "image/gif" && fileSizeBytes >= 10) {
          const width = fileBuffer.readUInt16LE(6);
          const height = fileBuffer.readUInt16LE(8);
          dimensionsStr = `${width}x${height}`;
        } else if (mimeType === "image/bmp" && fileSizeBytes >= 26) {
          const width = fileBuffer.readUInt32LE(18);
          const height = Math.abs(fileBuffer.readInt32LE(22));
          dimensionsStr = `${width}x${height}`;
        }
      } catch {
        // Dimension extraction is best-effort; don't fail the whole operation
      }

      let sizeStr: string;
      if (fileSizeBytes >= 1024 * 1024) {
        sizeStr = `${(fileSizeBytes / (1024 * 1024)).toFixed(2)}MB`;
      } else if (fileSizeBytes >= 1024) {
        sizeStr = `${(fileSizeBytes / 1024).toFixed(1)}KB`;
      } else {
        sizeStr = `${fileSizeBytes}B`;
      }

      const modifiedDate = stats.mtime.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      const modifiedTime = stats.mtime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      let metaLines = `Image: ${fileName}`;
      if (dimensionsStr) {
        metaLines += ` | ${dimensionsStr}`;
      }
      metaLines += ` @ ${sizeStr} | ${modifiedDate} ${modifiedTime} | ${mimeType}`;

      if (fitted.wasDownscaled) {
        metaLines += `\nNote: The original image was automatically downscaled to fit within AI context limits. The original file on disk is unchanged.`;
      }

      content.push({
        type: "text",
        text: metaLines,
      });

      content.push({
        type: "image",
        data: fitted.base64,
        mimeType: fitted.mimeType,
      });

      return { content };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error reading image file: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Extract dimensions from a JPEG buffer by scanning for SOF markers.
   * Returns a "widthxheight" string, or empty string if extraction fails.
   */
  private static _getJpegDimensions(buffer: Buffer): string {
    try {
      let offset = 2; // skip SOI marker (0xFFD8)
      while (offset < buffer.length - 1) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        // SOF0 through SOF3 (0xC0-0xC3) contain dimensions
        if (marker >= 0xc0 && marker <= 0xc3) {
          if (offset + 9 <= buffer.length) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return `${width}x${height}`;
          }
          break;
        }
        // Skip to next marker
        if (offset + 3 >= buffer.length) break;
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += 2 + segmentLength;
      }
    } catch {
      // Best-effort
    }
    return "";
  }

  /**
   * Maximum base64 size for images returned from MCP tools to stay safely under
   * API request limits (e.g., Claude's ~4MB total request limit).
   * Base64 encoding inflates binary data by ~33%, and we need headroom for the rest
   * of the request payload (tool definitions, conversation history, etc.), so we
   * cap individual images at ~1.5MB base64. This is more conservative than the 3MB
   * limit to account for conversations with multiple images.
   */
  private static readonly MAX_IMAGE_BASE64_BYTES = 1.5 * 1024 * 1024;

  /**
   * Ensure a base64-encoded image fits within AI context limits.
   * If the image is too large, it will be downscaled and re-encoded as PNG.
   *
   * This should be called before returning any image from an MCP tool to prevent
   * 413 Request Entity Too Large errors from the AI backend.
   *
   * @param base64Data Base64-encoded image data
   * @param mimeType MIME type of the image
   * @returns Object with (possibly downscaled) base64 data and mimeType. The mimeType
   *          may change to "image/png" if the image was re-encoded.
   */
  static ensureImageFitsContext(
    base64Data: string,
    mimeType: string
  ): { base64: string; mimeType: string; wasDownscaled: boolean } {
    if (base64Data.length <= MinecraftMcpServer.MAX_IMAGE_BASE64_BYTES) {
      return { base64: base64Data, mimeType, wasDownscaled: false };
    }

    Log.debug(
      `Image too large for AI context (${(base64Data.length / (1024 * 1024)).toFixed(1)}MB base64). ` +
        `Downscaling to fit under ${(MinecraftMcpServer.MAX_IMAGE_BASE64_BYTES / (1024 * 1024)).toFixed(1)}MB.`
    );

    try {
      const imageBuffer = Buffer.from(base64Data, "base64");
      const result = MinecraftMcpServer._downscaleImageToFit(
        imageBuffer,
        mimeType,
        MinecraftMcpServer.MAX_IMAGE_BASE64_BYTES
      );

      if (result) {
        return { base64: result.base64, mimeType: "image/png", wasDownscaled: true };
      }
    } catch (e) {
      Log.debug(`ensureImageFitsContext failed: ${e}`);
    }

    // If downscaling failed, return original — the caller will get a 413 but at least
    // we tried. This is better than silently dropping the image.
    return { base64: base64Data, mimeType, wasDownscaled: false };
  }

  /**
   * Downscale an image buffer so its base64 representation fits within maxBase64Bytes.
   * Decodes the image to RGBA pixels, computes a scale factor, resizes using bilinear
   * interpolation, and re-encodes as PNG.
   *
   * @param imageBuffer Raw image file bytes (PNG, JPEG, etc.)
   * @param mimeType MIME type of the source image
   * @param maxBase64Bytes Maximum allowed base64 string length
   * @returns Object with base64 string, or undefined if downscaling fails
   */
  private static _downscaleImageToFit(
    imageBuffer: Buffer,
    mimeType: string,
    maxBase64Bytes: number
  ): { base64: string } | undefined {
    try {
      // Decode the source image to RGBA pixels
      let srcWidth: number;
      let srcHeight: number;
      let srcPixels: Uint8Array;

      if (mimeType === "image/png") {
        const png = PNG.sync.read(imageBuffer);
        srcWidth = png.width;
        srcHeight = png.height;
        srcPixels = new Uint8Array(png.data);
      } else {
        // For non-PNG formats (JPEG, BMP, etc.), try pngjs which handles some formats,
        // or fall back gracefully
        try {
          const png = PNG.sync.read(imageBuffer);
          srcWidth = png.width;
          srcHeight = png.height;
          srcPixels = new Uint8Array(png.data);
        } catch {
          Log.debug(`Cannot decode ${mimeType} for downscaling — pngjs only supports PNG directly.`);
          return undefined;
        }
      }

      if (srcWidth <= 0 || srcHeight <= 0) {
        return undefined;
      }

      // Calculate target size. PNG compression ratio varies, but for typical screenshots
      // and Minecraft textures, we estimate ~2-4 bytes per pixel after PNG compression.
      // We use a conservative estimate and may iterate if needed.
      const maxBinaryBytes = Math.floor((maxBase64Bytes * 3) / 4);

      // Start with a scale factor based on area ratio.
      // Estimate compressed PNG at ~3 bytes/pixel average for typical content.
      const estimatedBytesPerPixel = 3;
      const maxPixels = Math.floor(maxBinaryBytes / estimatedBytesPerPixel);
      const currentPixels = srcWidth * srcHeight;

      let scale = Math.sqrt(maxPixels / currentPixels);
      scale = Math.min(scale, 1.0); // Never upscale

      // Apply scale with a small safety margin
      scale *= 0.9;

      let dstWidth = Math.max(1, Math.floor(srcWidth * scale));
      let dstHeight = Math.max(1, Math.floor(srcHeight * scale));

      // Iteratively resize until the encoded result fits
      for (let attempt = 0; attempt < 5; attempt++) {
        const resizedPixels = MinecraftMcpServer._bilinearResize(srcPixels, srcWidth, srcHeight, dstWidth, dstHeight);

        const outPng = new PNG({ width: dstWidth, height: dstHeight });
        outPng.data = Buffer.from(resizedPixels);
        const pngBuffer = PNG.sync.write(outPng);

        const base64 = pngBuffer.toString("base64");

        if (base64.length <= maxBase64Bytes) {
          Log.debug(
            `Downscaled image from ${srcWidth}x${srcHeight} to ${dstWidth}x${dstHeight} ` +
              `(${(base64.length / (1024 * 1024)).toFixed(2)}MB base64)`
          );
          return { base64 };
        }

        // Still too large — shrink further
        const overshoot = base64.length / maxBase64Bytes;
        const shrinkFactor = Math.sqrt(1 / overshoot) * 0.9;
        dstWidth = Math.max(1, Math.floor(dstWidth * shrinkFactor));
        dstHeight = Math.max(1, Math.floor(dstHeight * shrinkFactor));
      }

      Log.debug("Failed to downscale image to fit within limits after 5 attempts");
      return undefined;
    } catch (e) {
      Log.debug(`Image downscaling failed: ${e}`);
      return undefined;
    }
  }

  /**
   * Resize RGBA pixel data using bilinear interpolation.
   * Produces smoother results than nearest-neighbor for downscaling screenshots and textures.
   *
   * @param srcPixels Source RGBA pixel data (4 bytes per pixel)
   * @param srcW Source width
   * @param srcH Source height
   * @param dstW Destination width
   * @param dstH Destination height
   * @returns Resized RGBA pixel data
   */
  private static _bilinearResize(
    srcPixels: Uint8Array,
    srcW: number,
    srcH: number,
    dstW: number,
    dstH: number
  ): Uint8Array {
    const dst = new Uint8Array(dstW * dstH * 4);

    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;

    for (let dstY = 0; dstY < dstH; dstY++) {
      const srcYf = (dstY + 0.5) * yRatio - 0.5;
      const srcY0 = Math.max(0, Math.floor(srcYf));
      const srcY1 = Math.min(srcH - 1, srcY0 + 1);
      const yLerp = srcYf - srcY0;

      for (let dstX = 0; dstX < dstW; dstX++) {
        const srcXf = (dstX + 0.5) * xRatio - 0.5;
        const srcX0 = Math.max(0, Math.floor(srcXf));
        const srcX1 = Math.min(srcW - 1, srcX0 + 1);
        const xLerp = srcXf - srcX0;

        const idx00 = (srcY0 * srcW + srcX0) * 4;
        const idx10 = (srcY0 * srcW + srcX1) * 4;
        const idx01 = (srcY1 * srcW + srcX0) * 4;
        const idx11 = (srcY1 * srcW + srcX1) * 4;

        const dstIdx = (dstY * dstW + dstX) * 4;

        for (let c = 0; c < 4; c++) {
          const top = srcPixels[idx00 + c] * (1 - xLerp) + srcPixels[idx10 + c] * xLerp;
          const bot = srcPixels[idx01 + c] * (1 - xLerp) + srcPixels[idx11 + c] * xLerp;
          dst[dstIdx + c] = Math.round(top * (1 - yLerp) + bot * yLerp);
        }
      }
    }

    return dst;
  }

  /**
   * Writes base64-encoded image data to a file.
   *
   * Requires allowImageFileWritesInDescendentFolders to be set to true in
   * .mct/mcp/prefs.json in the file's parent folder or up to 3 levels above.
   */
  async _writeImageFileFromBase64Op(args: {
    filePath: string;
    base64Data: string;
    mimeType?: string;
  }): Promise<CallToolResult> {
    const filePath = args.filePath;

    // Security check: verify that image file writes are allowed for this path
    if (!this.isMcpPrefEnabled(filePath, "allowImageFileWritesInDescendentFolders")) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Image file writing is not authorized for this path.\n\nTo enable image file writing, create a file at .mct/mcp/prefs.json in the project folder (or up to 3 parent folders above the target location) with the following content:\n\n{\n  "allowImageFileWritesInDescendentFolders": true\n}`,
          },
        ],
        isError: true,
      };
    }

    // Validate file path against traversal and symlink attacks
    const pathError2 = this._checkMcpFilePath(filePath);
    if (pathError2) {
      return pathError2;
    }

    // Determine MIME type from file extension or provided mimeType
    const mimeType = args.mimeType || StorageUtilities.getMimeTypeFromName(filePath);

    // Only allow image files
    if (!StorageUtilities.isImageMimeType(mimeType)) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Not a valid image file extension: ${filePath}\nMIME type: ${mimeType}\n\nThis tool only supports image files (.png, .jpg, .webp, .bmp, .tiff, etc.).`,
          },
        ],
        isError: true,
      };
    }

    try {
      // Ensure the parent directory exists
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Decode base64 and write to file
      const buffer = Buffer.from(args.base64Data, "base64");
      fs.writeFileSync(filePath, buffer);

      // Get file stats for confirmation
      const stats = fs.statSync(filePath);

      // Convert buffer to base64 for returning the image, downscaling if needed
      const resultBase64 = buffer.toString("base64");
      const fitted = MinecraftMcpServer.ensureImageFitsContext(resultBase64, mimeType);

      return {
        content: [
          {
            type: "text",
            text: `Successfully wrote image file:\n  Path: ${filePath}\n  Size: ${stats.size} bytes\n  MIME type: ${mimeType}`,
          },
          {
            type: "image",
            data: fitted.base64,
            mimeType: fitted.mimeType,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error writing image file: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Converts SVG markup to PNG and writes it to a file.
   *
   * Requires allowImageFileWritesInDescendentFolders to be set to true in
   * .mct/mcp/prefs.json in the file's parent folder or up to 3 levels above.
   */
  async _writeImageFileFromSvgOp(args: {
    filePath: string;
    svgContent: string;
    width?: number;
    height?: number;
  }): Promise<CallToolResult> {
    const filePath = args.filePath;

    // Security check: verify that image file writes are allowed for this path
    if (!this.isMcpPrefEnabled(filePath, "allowImageFileWritesInDescendentFolders")) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Image file writing is not authorized for this path.\n\nTo enable image file writing, create a file at .mct/mcp/prefs.json in the project folder (or up to 3 parent folders above the target location) with the following content:\n\n{\n  "allowImageFileWritesInDescendentFolders": true\n}`,
          },
        ],
        isError: true,
      };
    }

    // Validate file path against traversal and symlink attacks
    const pathError3 = this._checkMcpFilePath(filePath);
    if (pathError3) {
      return pathError3;
    }

    try {
      // Ensure the parent directory exists
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Convert SVG to PNG using resvg
      const opts: any = {};

      // Set dimensions if provided
      if (args.width || args.height) {
        opts.fitTo =
          args.width && args.height
            ? { mode: "width", value: args.width } // Use width, height will scale proportionally
            : args.width
              ? { mode: "width", value: args.width }
              : { mode: "height", value: args.height };
      }

      const { Resvg } = await import("@resvg/resvg-js");

      const resvg = new Resvg(args.svgContent, opts);
      const pngData = resvg.render();
      const buffer = Buffer.from(pngData.asPng());

      fs.writeFileSync(filePath, buffer);

      // Get file stats for confirmation
      const stats = fs.statSync(filePath);

      // Convert buffer to base64 for returning the image, downscaling if needed
      const resultBase64 = buffer.toString("base64");
      const fitted = MinecraftMcpServer.ensureImageFitsContext(resultBase64, "image/png");

      return {
        content: [
          {
            type: "text",
            text: `Successfully wrote image file:\n  Path: ${filePath}\n  Size: ${stats.size} bytes\n  Dimensions: ${pngData.width}x${pngData.height}\n  (converted from SVG to PNG)`,
          },
          {
            type: "image",
            data: fitted.base64,
            mimeType: fitted.mimeType,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error writing image file: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Writes an image file from a pixel art definition with paletted pixels.
   *
   * The pixel art format uses ASCII-style lines where each character maps to a color
   * in a palette. Spaces are transparent. This is ideal for creating Minecraft-style
   * pixel art textures.
   *
   * Requires allowImageFileWritesInDescendentFolders to be set to true in
   * .mct/mcp/prefs.json in the file's parent folder or up to 3 levels above.
   */
  async _writeImageFileFromPixelArtOp(args: {
    filePath: string;
    lines: string[];
    palette: { [char: string]: { r?: number; g?: number; b?: number; a?: number; hex?: string } };
    scale?: number;
    backgroundColor?: { r?: number; g?: number; b?: number; a?: number; hex?: string };
  }): Promise<CallToolResult> {
    const filePath = args.filePath;

    // Security check: verify that image file writes are allowed for this path
    if (!this.isMcpPrefEnabled(filePath, "allowImageFileWritesInDescendentFolders")) {
      return {
        content: [
          {
            type: "text",
            text: `Error: Image file writing is not authorized for this path.\n\nTo enable image file writing, create a file at .mct/mcp/prefs.json in the project folder (or up to 3 parent folders above the target location) with the following content:\n\n{\n  "allowImageFileWritesInDescendentFolders": true\n}`,
          },
        ],
        isError: true,
      };
    }

    // Validate file path against traversal and symlink attacks
    const pathError4 = this._checkMcpFilePath(filePath);
    if (pathError4) {
      return pathError4;
    }

    // Validate file extension is PNG
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".png") {
      return {
        content: [
          {
            type: "text",
            text: `Error: Pixel art output must be a PNG file. Got extension: ${ext}`,
          },
        ],
        isError: true,
      };
    }

    // Validate lines
    if (!args.lines || args.lines.length === 0) {
      return {
        content: [{ type: "text", text: "Error: lines array is required and must not be empty" }],
        isError: true,
      };
    }

    // Validate palette
    if (!args.palette || Object.keys(args.palette).length === 0) {
      return {
        content: [{ type: "text", text: "Error: palette is required and must not be empty" }],
        isError: true,
      };
    }

    try {
      // Calculate dimensions from pixel art lines
      const scale = args.scale || 1;
      const artHeight = args.lines.length;
      let artWidth = 0;
      for (const line of args.lines) {
        artWidth = Math.max(artWidth, line.length);
      }

      if (artWidth === 0) {
        return {
          content: [{ type: "text", text: "Error: All lines are empty" }],
          isError: true,
        };
      }

      const width = artWidth * scale;
      const height = artHeight * scale;

      // Create pixel buffer
      const pixels = new Uint8Array(width * height * 4);

      // Helper to parse color
      const parseColor = (
        color: { r?: number; g?: number; b?: number; a?: number; hex?: string } | undefined
      ): { r: number; g: number; b: number; a: number } => {
        if (!color) return { r: 0, g: 0, b: 0, a: 0 };

        if (color.hex) {
          // Parse hex color
          let hex = color.hex;
          if (hex.startsWith("#")) hex = hex.slice(1);

          if (hex.length === 3) {
            // Short form #RGB -> #RRGGBB
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
          }

          const r = parseInt(hex.slice(0, 2), 16) || 0;
          const g = parseInt(hex.slice(2, 4), 16) || 0;
          const b = parseInt(hex.slice(4, 6), 16) || 0;
          const a = hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 255;
          return { r, g, b, a };
        }

        return {
          r: color.r ?? 0,
          g: color.g ?? 0,
          b: color.b ?? 0,
          a: color.a ?? 255,
        };
      };

      // Pre-parse palette
      const parsedPalette: { [char: string]: { r: number; g: number; b: number; a: number } } = {};
      for (const char in args.palette) {
        parsedPalette[char] = parseColor(args.palette[char]);
      }

      // Parse background color
      const bgColor = args.backgroundColor ? parseColor(args.backgroundColor) : { r: 0, g: 0, b: 0, a: 0 };

      // Fill with background color first
      for (let i = 0; i < width * height; i++) {
        pixels[i * 4] = bgColor.r;
        pixels[i * 4 + 1] = bgColor.g;
        pixels[i * 4 + 2] = bgColor.b;
        pixels[i * 4 + 3] = bgColor.a;
      }

      // Draw pixel art
      for (let lineIdx = 0; lineIdx < args.lines.length; lineIdx++) {
        const line = args.lines[lineIdx];

        for (let charIdx = 0; charIdx < line.length; charIdx++) {
          const char = line[charIdx];

          // Space is transparent - skip (background remains)
          if (char === " ") continue;

          const color = parsedPalette[char];
          if (!color) continue; // Unknown character - skip

          // Fill the scaled pixel region
          const startX = charIdx * scale;
          const startY = lineIdx * scale;
          const endX = startX + scale;
          const endY = startY + scale;

          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const idx = (y * width + x) * 4;
              pixels[idx] = color.r;
              pixels[idx + 1] = color.g;
              pixels[idx + 2] = color.b;
              pixels[idx + 3] = color.a;
            }
          }
        }
      }

      // Encode to PNG
      const pngData = ImageGenerationUtilities.encodeRgbaToPng(pixels, width, height);
      if (!pngData) {
        return {
          content: [{ type: "text", text: "Error: Failed to encode PNG" }],
          isError: true,
        };
      }

      // Ensure the parent directory exists
      const parentDir = path.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Write file
      fs.writeFileSync(filePath, Buffer.from(pngData));

      // Get file stats for confirmation
      const stats = fs.statSync(filePath);

      // Convert to base64 for returning the image, downscaling if needed
      const resultBase64 = Buffer.from(pngData).toString("base64");
      const fitted = MinecraftMcpServer.ensureImageFitsContext(resultBase64, "image/png");

      return {
        content: [
          {
            type: "text",
            text: `Successfully wrote pixel art image:\n  Path: ${filePath}\n  Size: ${
              stats.size
            } bytes\n  Dimensions: ${width}x${height} (${artWidth}x${artHeight} at ${scale}x scale)\n  Palette: ${
              Object.keys(args.palette).length
            } colors`,
          },
          {
            type: "image",
            data: fitted.base64,
            mimeType: fitted.mimeType,
          },
        ],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error writing pixel art image: ${error}` }],
        isError: true,
      };
    }
  }

  /**
   * Preview a model design by converting it to geometry and rendering a preview image.
   * Returns the preview as a base64-encoded PNG image.
   */
  async _previewModelDesignOp(args: any): Promise<CallToolResult> {
    if (!this._creatorTools || !this._env) {
      return {
        content: [{ type: "text", text: "Error: Creator Tools is not initialized" }],
        isError: true,
      };
    }

    const design = args.design as IMcpModelDesign;
    if (!design) {
      return {
        content: [{ type: "text", text: "Error: design is required" }],
        isError: true,
      };
    }

    // Validate the design
    const validationErrors = ModelDesignUtilities.validateDesign(design);
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `Design validation errors:\n${validationErrors.map((e) => `  - ${e}`).join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    // Convert the design to geometry
    const conversionResult = ModelDesignUtilities.convertToGeometry(design);
    const geometryJson = JSON.stringify(conversionResult.geometry, null, 2);

    // Generate the texture atlas SVG (for debugging/reference)
    const _atlasSvg = ModelDesignUtilities.generateAtlasSvg(
      conversionResult.atlasRegions,
      conversionResult.textureSize
    );

    // For now, create a simple colored PNG from the SVG using node-canvas or similar
    // Since we may not have those dependencies, we'll generate a simple texture programmatically
    const textureDataUrl = await ImageGenerationUtilities.generateTextureFromAtlas(
      conversionResult.atlasRegions,
      conversionResult.textureSize,
      conversionResult.pixelsPerUnit
    );

    // Set up the HTTP server for rendering
    const serverManager = this.ensureServerManager();
    serverManager.features = ServerManagerFeatures.all;

    const httpServer = serverManager.ensureHttpServer(this._previewServerPort);

    // Generate unique URLs for this render to prevent browser caching
    // Use a random token to ensure each render gets fresh content
    const renderToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const geometryPath = `/temp/preview-geometry-${renderToken}.json`;
    const texturePath = `/temp/preview-texture-${renderToken}.png`;

    // Register temporary content with unique paths
    httpServer.registerTempContent(geometryPath, geometryJson, "application/json");

    if (textureDataUrl) {
      // Convert data URL to binary
      const base64Match = textureDataUrl.match(/^data:image\/png;base64,(.*)$/);
      if (base64Match) {
        const binaryData = Buffer.from(base64Match[1], "base64");
        httpServer.registerTempContent(texturePath, binaryData, "image/png");
      }
    }

    // Use the actual port the HTTP server is listening on (may differ from _previewServerPort
    // if the server was already created for another purpose)
    const baseUrl = `http://localhost:${httpServer.port}`;

    // Wait for the HTTP server to be ready to accept connections
    // This prevents race conditions on first render after MCP server start
    if (!httpServer.isListening) {
      await httpServer.waitForReady();
    }

    // Verify the HTTP server is actually still listening (could have crashed)
    if (!httpServer.isListening) {
      Log.debugAlert(`HTTP server on port ${httpServer.port} is not actually listening. Server may have crashed.`);
      return {
        content: [
          {
            type: "text",
            text: `Error: Internal HTTP server on port ${httpServer.port} is not responding. Please restart the MCP server.`,
          },
        ],
        isError: true,
      };
    }

    // Initialize headless renderer (reuse if already created)
    if (!this._cachedRenderer) {
      this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
      const initialized = await this._cachedRenderer.initialize();

      if (!initialized) {
        httpServer.clearTempContent();
        this._cachedRenderer = undefined;
        return {
          content: [
            {
              type: "text",
              text: "Error: Could not initialize headless renderer. Ensure Chrome/Edge is available.",
            },
          ],
          isError: true,
        };
      }

      // Warm up the browser to improve first-render reliability
      // This creates and destroys a test context to ensure the browser is fully ready
      await this._cachedRenderer.warmUp();
    }

    // Verify browser is still connected (it may have crashed or been disconnected)
    if (!this._cachedRenderer.isBrowserReady()) {
      Log.debug("Browser disconnected, reinitializing...");
      this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
      const reinitialized = await this._cachedRenderer.initialize();
      if (!reinitialized) {
        httpServer.clearTempContent();
        this._cachedRenderer = undefined;
        return {
          content: [{ type: "text", text: "Error: Browser disconnected and could not be reinitialized." }],
          isError: true,
        };
      }
      await this._cachedRenderer.warmUp();
    }

    const renderer = this._cachedRenderer;

    // Build the model viewer URL with unique paths to prevent browser caching
    // Use skipVanilla=true for isolated rendering with procedural sky (no vanilla texture dependencies)
    let modelViewerUrl = `/?mode=modelviewer&geometry=${encodeURIComponent(geometryPath)}&skipVanilla=true`;
    if (textureDataUrl) {
      modelViewerUrl += `&texture=${encodeURIComponent(texturePath)}`;
    }

    const width = args.width || 768;
    const height = args.height || 768;
    const multiAngle = args.multiAngle === true;
    const imageFormat = args.imageFormat || "png"; // PNG default for better MCP client compatibility
    const jpegQuality = args.jpegQuality || 80;

    // Calculate model bounds for dynamic camera positioning
    // Model bounds are in Minecraft pixel coordinates (16 units = 1 block)
    const modelBoundsPixels = ModelDesignUtilities.calculateModelBounds(design);

    // Convert to block coordinates for camera positioning (divide by 16)
    const modelBounds = {
      minX: modelBoundsPixels.minX / 16,
      minY: modelBoundsPixels.minY / 16,
      minZ: modelBoundsPixels.minZ / 16,
      maxX: modelBoundsPixels.maxX / 16,
      maxY: modelBoundsPixels.maxY / 16,
      maxZ: modelBoundsPixels.maxZ / 16,
      maxDimension: modelBoundsPixels.maxDimension / 16,
      center: {
        x: modelBoundsPixels.center.x / 16,
        y: modelBoundsPixels.center.y / 16,
        z: modelBoundsPixels.center.z / 16,
      },
    };

    // Camera distance based on model size for proper framing
    // With narrow FOV (0.35 rad ~20°), we need sufficient distance to see the full model
    // Formula: distance = modelSize * multiplier + baseline offset
    // For humanoid (2 blocks): 2 * 1.2 + 1.5 = 3.9 blocks distance
    // For block (1 block): 1 * 1.2 + 1.5 = 2.7 blocks distance
    const modelSize = modelBounds.maxDimension;
    const radius = Math.max(modelSize * 1.2 + 1.5, 2.5); // Increased for full model visibility

    // The entity is placed at (3.5, 2.0, 3.5) in the viewer world coordinates
    // Model local coordinates need to be offset by this entity position
    const entityWorldX = 3.5;
    const entityWorldY = 2.0;
    const entityWorldZ = 3.5;

    // Center on the actual model bounds, offset by entity world position
    const centerX = entityWorldX + modelBounds.center.x;
    const centerY = entityWorldY + modelBounds.center.y;
    const centerZ = entityWorldZ + modelBounds.center.z;

    // Minimum camera height - never go below the ground plane (y = -0.5) plus margin
    const minCameraY = 0.5;

    // Calculate isometric camera Y - camera should be ABOVE the model center looking down
    // Add radius * factor to place camera at elevated position for proper isometric view
    const isometricY = Math.max(centerY + radius * 0.8, minCameraY);
    const sideViewY = Math.max(centerY + radius * 0.3, minCameraY);

    const anglePresets: { [key: string]: { x: number; y: number; z: number; label: string } } = {
      // Front views - true isometric angle (~35 degrees from horizontal)
      "front-right": {
        x: centerX + radius * 0.7,
        y: isometricY,
        z: centerZ + radius * 0.7,
        label: "Front Right",
      },
      "front-left": {
        x: centerX - radius * 0.7,
        y: isometricY,
        z: centerZ + radius * 0.7,
        label: "Front Left",
      },
      // Back views - isometric
      "back-right": {
        x: centerX + radius * 0.7,
        y: isometricY,
        z: centerZ - radius * 0.7,
        label: "Back Right",
      },
      "back-left": {
        x: centerX - radius * 0.7,
        y: isometricY,
        z: centerZ - radius * 0.7,
        label: "Back Left",
      },
      // Top-down view - steeper angle
      "top-down": {
        x: centerX + radius * 0.4,
        y: centerY + radius * 0.85,
        z: centerZ + radius * 0.4,
        label: "Top Down",
      },
      // Pure side views - below center but clamped
      "side-right": { x: centerX + radius, y: sideViewY, z: centerZ, label: "Side Right" },
      "side-left": { x: centerX - radius, y: sideViewY, z: centerZ, label: "Side Left" },
      // Front and back center views
      front: { x: centerX, y: isometricY, z: centerZ + radius, label: "Front" },
      back: { x: centerX, y: isometricY, z: centerZ - radius, label: "Back" },
    };

    let result: { imageData: Uint8Array | undefined; error?: string };
    // Track actual image dimensions (may differ from requested due to stitching labels)
    let actualWidth = width;
    let actualHeight = height;

    if (multiAngle) {
      // Multi-angle rendering: render from multiple camera positions and stitch together
      // Use four distinct diagonal quadrants for 2x2 grid
      const requestedAngles = args.anglePresets || ["front-right", "front-left", "back-right", "back-left"];
      const anglesToRender = requestedAngles
        .filter((a: string) => anglePresets[a.toLowerCase()])
        .map((a: string) => ({ key: a.toLowerCase(), ...anglePresets[a.toLowerCase()] }));

      if (anglesToRender.length === 0) {
        anglesToRender.push({ key: "front-right", ...anglePresets["front-right"] });
        anglesToRender.push({ key: "back-left", ...anglePresets["back-left"] });
        anglesToRender.push({ key: "side-right", ...anglePresets["side-right"] });
        anglesToRender.push({ key: "top-down", ...anglePresets["top-down"] });
      }

      // Determine grid layout:
      // - 4 images: 2x2 grid
      // - 3 images: pyramid layout (2 on top, 1 spanning bottom)
      // - Otherwise: horizontal row
      const usePyramidLayout = anglesToRender.length === 3;
      const useGrid = anglesToRender.length === 4;
      const cols = useGrid ? 2 : usePyramidLayout ? 2 : anglesToRender.length;
      const rows = useGrid ? 2 : usePyramidLayout ? 2 : 1;

      // Render each angle
      const renderedImages: { label: string; imageData: Uint8Array; isWide?: boolean }[] = [];

      // Calculate timeouts based on model complexity - more bones/cubes need more time
      const boneCount = design.bones?.length || 1;
      const cubeCount = design.bones?.reduce((sum: number, b: any) => sum + (b.cubes?.length || 0), 0) || 1;
      // Canvas timeout: time to wait for page to load and initialize (8s base + up to 12s for complex models)
      const baseCanvasTimeout = 8000;
      const additionalCanvasTimeout = Math.min(boneCount * 500 + cubeCount * 100, 12000);
      const canvasTimeout = Math.round(baseCanvasTimeout + additionalCanvasTimeout);
      // Render wait time: time to wait for meshes to render after canvas appears
      const baseWaitTime = 1500;
      const additionalWaitTime = Math.min(boneCount * 200 + cubeCount * 50, 4000);
      const renderWaitTime = Math.round(baseWaitTime + additionalWaitTime);

      // Track render errors for all angles to provide detailed diagnostics
      const renderErrors: string[] = [];

      for (let i = 0; i < anglesToRender.length; i++) {
        const angle = anglesToRender[i];
        // For pyramid layout: first 2 images are half-width, 3rd is full-width
        const isWideImage = usePyramidLayout && i === 2;
        const imgWidth = isWideImage ? width : Math.floor(width / cols);
        const imgHeight = Math.floor(height / rows);

        const angleUrl = modelViewerUrl + `&cameraX=${angle.x}&cameraY=${angle.y}&cameraZ=${angle.z}`;

        // Add delay between renders to ensure browser stability
        // This is critical for multi-angle renders where we create new contexts in sequence
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        const angleResult = await renderer.renderModelFast(angleUrl, {
          width: imgWidth,
          height: imgHeight,
          renderWaitTime: renderWaitTime,
          canvasTimeout: canvasTimeout,
          imageFormat: "png", // Use PNG for intermediate renders, compress after stitching
          forceNewContext: true, // Force fresh context for each angle to ensure clean render state
        });

        if (angleResult.imageData) {
          renderedImages.push({ label: angle.label, imageData: angleResult.imageData, isWide: isWideImage });
        } else {
          // Capture error for diagnostics
          const errorMsg = angleResult.error || "unknown error";
          renderErrors.push(`${angle.label}: ${errorMsg}`);
          Log.debug(
            `Multi-angle render failed for angle ${angle.key} (${i + 1}/${anglesToRender.length}): ${errorMsg}`
          );
          // For the first failure, include more context to help debugging
          if (i === 0) {
            Log.debug(`  URL: ${angleUrl.substring(0, 100)}...`);
            Log.debug(`  Dimensions: ${imgWidth}x${imgHeight}`);
            Log.debug(`  Timeout: ${canvasTimeout}ms, RenderWait: ${renderWaitTime}ms`);
          }
        }
      }

      // Stitch images together with labels
      // - 2x2 grid for 4 images
      // - Pyramid layout for 3 images (2 on top, 1 spanning bottom)
      // - Horizontal row otherwise
      if (renderedImages.length > 0) {
        const singleWidth = Math.floor(width / cols);
        const singleHeight = Math.floor(height / rows);
        const stitchedImage = await ImageGenerationUtilities.stitchImagesWithLabels(
          renderedImages,
          singleWidth,
          singleHeight,
          cols,
          rows,
          usePyramidLayout ? "pyramid" : undefined
        );
        result = { imageData: stitchedImage };
        // Update actual dimensions: stitched image includes 30px label per row
        const labelHeight = 30;
        actualWidth = singleWidth * cols;
        actualHeight = (singleHeight + labelHeight) * rows;
      } else {
        // All renders failed - provide detailed diagnostic message
        let errorMsg = `No images rendered for multi-angle view. `;
        errorMsg += `Attempted ${anglesToRender.length} angles. `;
        if (renderErrors.length > 0) {
          errorMsg += `Errors: ${renderErrors.join("; ")}`;
        } else {
          errorMsg += `No specific errors captured - browser may not be fully initialized.`;
        }
        result = { imageData: undefined, error: errorMsg };
      }
    } else {
      // Single angle rendering - use front-right angle
      const defaultAngle = anglePresets["front-right"];
      const singleAngleUrl =
        modelViewerUrl + `&cameraX=${defaultAngle.x}&cameraY=${defaultAngle.y}&cameraZ=${defaultAngle.z}`;

      // Calculate timeouts based on model complexity
      const boneCount = design.bones?.length || 1;
      const cubeCount = design.bones?.reduce((sum: number, b: any) => sum + (b.cubes?.length || 0), 0) || 1;
      const baseCanvasTimeout = 8000;
      const additionalCanvasTimeout = Math.min(boneCount * 500 + cubeCount * 100, 12000);
      const canvasTimeout = Math.round(baseCanvasTimeout + additionalCanvasTimeout);
      const baseWaitTime = 1500;
      const additionalWaitTime = Math.min(boneCount * 200 + cubeCount * 50, 4000);
      const renderWaitTime = Math.round(baseWaitTime + additionalWaitTime);

      result = await renderer.renderModelFast(singleAngleUrl, {
        width,
        height,
        renderWaitTime: renderWaitTime,
        canvasTimeout: canvasTimeout,
        imageFormat: imageFormat as "png" | "jpeg",
        jpegQuality,
        forceNewContext: true, // Always use fresh context since temp content changes between calls
      });
    }

    // Don't close renderer - it's cached for reuse
    httpServer.clearTempContent();

    if (result.error) {
      return {
        content: [
          {
            type: "text",
            text: `Rendering failed: ${result.error}\n\nGenerated geometry:\n${geometryJson}`,
          },
        ],
        isError: true,
      };
    }

    if (result.imageData) {
      let finalImageData = result.imageData;

      // Extract texture swatches from the design and append below the render
      // Use combined function to minimize browser launches for reliability
      // Use actual dimensions (which account for stitching label heights in multi-angle mode)
      const swatches = ImageGenerationUtilities.extractTextureSwatches(design);
      if (swatches.length > 0) {
        finalImageData = await ImageGenerationUtilities.generateAndAppendSwatchStrip(
          result.imageData,
          swatches,
          actualWidth,
          actualHeight,
          6
        );
      }

      // Post-process based on format
      let outputFormat = imageFormat as "png" | "jpeg";
      if (imageFormat === "jpeg") {
        // Convert to JPEG (multi-angle stitched images are always PNG initially)
        if (multiAngle) {
          finalImageData = await ImageGenerationUtilities.convertPngToJpeg(finalImageData, jpegQuality);
        }
      }
      // Note: PNG recompression disabled for performance - the parsePng/recompressPng
      // functions are too slow. If response size becomes an issue, consider using
      // a native image library like sharp instead.
      // else {
      //   finalImageData = ImageGenerationUtilities.recompressPng(finalImageData);
      // }

      const rawBase64Image = Buffer.from(finalImageData).toString("base64");
      const outputMimeType = outputFormat === "jpeg" ? "image/jpeg" : "image/png";
      const fitted = MinecraftMcpServer.ensureImageFitsContext(rawBase64Image, outputMimeType);

      // Save image to a temp file so the Electron app can display it
      // The Copilot SDK summarizes MCP tool responses and doesn't expose raw image data
      // to the client, so we need this workaround for UI display
      let tempImagePath: string | undefined;
      try {
        const tempDir = path.join(process.cwd(), "debugoutput", "mcp-previews");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const fileName = `preview-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${outputFormat}`;
        tempImagePath = path.join(tempDir, fileName);
        fs.writeFileSync(tempImagePath, finalImageData);
        Log.debug(`Saved preview image to: ${tempImagePath}`);
      } catch (saveErr) {
        Log.debug(`Failed to save preview image to temp file: ${(saveErr as Error).message}`);
      }

      const responseContent: any[] = [
        {
          type: "image",
          data: fitted.base64,
          mimeType: fitted.mimeType,
        },
      ];

      // Add text with image path so Electron can find it (SDK doesn't expose raw image to client)
      if (tempImagePath) {
        responseContent.push({
          type: "text",
          text: `[MCT_IMAGE_PATH:${tempImagePath}]`,
        });
      }

      // Add warnings if any
      if (conversionResult.warnings.length > 0) {
        responseContent.push({
          type: "text",
          text: `Warnings:\n${conversionResult.warnings.map((w) => `  - ${w}`).join("\n")}`,
        });
      }

      return {
        content: responseContent,
        structuredContent: {
          geometryJson: conversionResult.geometry,
          textureSize: conversionResult.textureSize,
          warnings: conversionResult.warnings,
        },
      };
    }

    return {
      content: [{ type: "text", text: "Error: No image data returned from renderer" }],
      isError: true,
    };
  }

  /**
   * Export a model design to .geo.json and texture.png files.
   */
  async _exportModelDesignOp(args: any): Promise<CallToolResult> {
    const design = args.design as IMcpModelDesign;
    const geometryOutputPath = args.geometryOutputPath as string;
    const textureOutputPath = args.textureOutputPath as string;
    const overwrite = args.overwrite as boolean | undefined;

    if (!design) {
      return {
        content: [{ type: "text", text: "Error: design is required" }],
        isError: true,
      };
    }

    if (!geometryOutputPath || !textureOutputPath) {
      return {
        content: [{ type: "text", text: "Error: geometryOutputPath and textureOutputPath are required" }],
        isError: true,
      };
    }

    // Validate the design
    const validationErrors = ModelDesignUtilities.validateDesign(design);
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `Design validation errors:\n${validationErrors.map((e) => `  - ${e}`).join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    // Check if files exist and overwrite is not set
    if (!overwrite) {
      if (fs.existsSync(geometryOutputPath)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: File already exists: ${geometryOutputPath}\nUse overwrite: true to replace it.`,
            },
          ],
          isError: true,
        };
      }
      if (fs.existsSync(textureOutputPath)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: File already exists: ${textureOutputPath}\nUse overwrite: true to replace it.`,
            },
          ],
          isError: true,
        };
      }
    }

    // Convert the design to geometry
    const conversionResult = ModelDesignUtilities.convertToGeometry(design);
    const geometryJson = JSON.stringify(conversionResult.geometry, null, 2);

    // Generate the texture
    const textureDataUrl = await ImageGenerationUtilities.generateTextureFromAtlas(
      conversionResult.atlasRegions,
      conversionResult.textureSize,
      conversionResult.pixelsPerUnit
    );

    const filesWritten: string[] = [];
    const errors: string[] = [];

    // Write geometry file
    try {
      const geoDir = path.dirname(geometryOutputPath);
      if (!fs.existsSync(geoDir)) {
        fs.mkdirSync(geoDir, { recursive: true });
      }
      fs.writeFileSync(geometryOutputPath, geometryJson, "utf-8");
      filesWritten.push(geometryOutputPath);
    } catch (e) {
      errors.push(`Failed to write geometry file: ${e}`);
    }

    // Write texture file
    if (textureDataUrl) {
      try {
        const texDir = path.dirname(textureOutputPath);
        if (!fs.existsSync(texDir)) {
          fs.mkdirSync(texDir, { recursive: true });
        }

        const base64Match = textureDataUrl.match(/^data:image\/png;base64,(.*)$/);
        if (base64Match) {
          const binaryData = Buffer.from(base64Match[1], "base64");
          fs.writeFileSync(textureOutputPath, binaryData);
          filesWritten.push(textureOutputPath);
        }
      } catch (e) {
        errors.push(`Failed to write texture file: ${e}`);
      }
    } else {
      errors.push("Could not generate texture image");
    }

    if (errors.length > 0 && filesWritten.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Export failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    let resultText = `Successfully exported model design:\n`;
    for (const file of filesWritten) {
      resultText += `  ✓ ${file}\n`;
    }

    if (conversionResult.warnings.length > 0) {
      resultText += `\nWarnings:\n${conversionResult.warnings.map((w) => `  - ${w}`).join("\n")}`;
    }

    if (errors.length > 0) {
      resultText += `\nErrors:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    }

    return {
      content: [{ type: "text", text: resultText }],
      structuredContent: {
        success: filesWritten.length > 0,
        filesWritten,
        geometryJson: conversionResult.geometry,
        warnings: conversionResult.warnings,
        errors,
      },
    };
  }

  /**
   * Unified tool: Creates a 3D model, exports files to project, and returns a preview.
   *
   * This combines the functionality of previewModelDesign and exportModelDesign into
   * a single, project-aware operation that:
   * 1. Validates and converts the design to geometry + texture
   * 2. Saves files to the appropriate project folder (auto-detected)
   * 3. Persists the design to an accessory folder for future iteration
   * 4. Auto-wires to matching entity/block/item if found
   * 5. Returns a preview image
   */
  async _designModelOp(args: any): Promise<CallToolResult> {
    if (!this._creatorTools) {
      return {
        content: [{ type: "text", text: "Error: Creator Tools is not initialized" }],
        isError: true,
      };
    }

    const design = args.design as IMcpModelDesign;
    if (!design) {
      return {
        content: [{ type: "text", text: "Error: design is required" }],
        isError: true,
      };
    }

    const modelId = args.modelId as string;
    if (!modelId) {
      return {
        content: [{ type: "text", text: "Error: modelId is required" }],
        isError: true,
      };
    }

    const projectPath = args.projectPath as string;
    if (!projectPath) {
      return {
        content: [{ type: "text", text: "Error: projectPath is required" }],
        isError: true,
      };
    }

    const usage = (args.usage as "entity" | "block" | "item") || "entity";

    // Validate the design
    const validationErrors = ModelDesignUtilities.validateDesign(design);
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `Design validation errors:\n${validationErrors.map((e) => `  - ${e}`).join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    // Create/load project from the folder path
    const storage = new NodeStorage(projectPath, "");
    const projectFolder = storage.rootFolder;
    await projectFolder.ensureExists();

    const project = new Project(this._creatorTools, path.basename(projectPath), null);
    project.setProjectFolder(projectFolder);

    // Determine the resource-pack folder to write into.
    //
    // Previously this always called
    // `ensureDefaultResourcePackFolder()`, which created a nested
    // `resource_packs/<auto-named>/` *inside* the supplied projectPath. When
    // callers passed projectPath = `…/resource_packs/<my_rp>` (i.e. the RP
    // itself), files landed at `…/resource_packs/<my_rp>/resource_packs/contoso_*/models/…`
    // instead of `…/resource_packs/<my_rp>/models/…`, leaving the entity
    // referencing a non-existent geometry and rendering as the default cube.
    //
    // We now detect when the supplied folder already IS a resource pack — by
    // the presence of a manifest.json with a `resources` module — and write
    // directly into it.
    let rpFolder;
    if (MinecraftMcpServer._isResourcePackFolder(projectPath)) {
      rpFolder = projectFolder;
      Log.debug(`designModel: projectPath is already a resource pack — writing directly into it.`);
    } else {
      rpFolder = await project.ensureDefaultResourcePackFolder();
    }

    // Infer existing items for auto-wiring discovery
    await project.inferProjectItemsFromFilesRootFolder();

    // Determine folder paths based on usage
    const modelsSubPath =
      usage === "block" ? "/models/blocks/" : usage === "item" ? "/models/item/" : "/models/entity/";
    const texturesSubPath =
      usage === "block" ? "/textures/blocks/" : usage === "item" ? "/textures/items/" : "/textures/entity/";

    const modelsFolder = await rpFolder.ensureFolderFromRelativePath(modelsSubPath);
    const texturesFolder = await rpFolder.ensureFolderFromRelativePath(texturesSubPath);

    // Generate geometry and texture
    const conversionResult = ModelDesignUtilities.convertToGeometry(design);
    const geometryJson = JSON.stringify(conversionResult.geometry, null, 2);

    const textureDataUrl = await ImageGenerationUtilities.generateTextureFromAtlas(
      conversionResult.atlasRegions,
      conversionResult.textureSize,
      conversionResult.pixelsPerUnit
    );

    const filesWritten: string[] = [];
    const errors: string[] = [];

    // Write geometry file
    const geoFile = modelsFolder.ensureFile(`${modelId}.geo.json`);
    try {
      geoFile.setContent(geometryJson);
      await geoFile.saveContent(false);
      filesWritten.push(geoFile.storageRelativePath || `${modelId}.geo.json`);
    } catch (e) {
      errors.push(`Failed to write geometry file: ${e}`);
    }

    // Write texture file
    let textureBytes: Uint8Array | undefined;
    if (textureDataUrl) {
      const texFile = texturesFolder.ensureFile(`${modelId}.png`);
      try {
        const base64Match = textureDataUrl.match(/^data:image\/png;base64,(.*)$/);
        if (base64Match) {
          textureBytes = Buffer.from(base64Match[1], "base64");
          texFile.setContent(textureBytes);
          await texFile.saveContent(false);
          filesWritten.push(texFile.storageRelativePath || `${modelId}.png`);
        }
      } catch (e) {
        errors.push(`Failed to write texture file: ${e}`);
      }
    } else {
      errors.push("Could not generate texture image");
    }

    // Determine wiring target
    let wireTarget: string | undefined = undefined;
    if (args.wireTo === false) {
      // Explicit opt-out
      wireTarget = undefined;
    } else if (typeof args.wireTo === "string") {
      // Explicit target
      wireTarget = args.wireTo;
    } else {
      // Auto-discover matching item by modelId
      const matchingItem = project.items.find((item) => {
        if (usage === "entity" && item.itemType === ProjectItemType.entityTypeBehavior) {
          return item.name === modelId;
        }
        if (usage === "block" && item.itemType === ProjectItemType.blockTypeBehavior) {
          return item.name === modelId;
        }
        if (usage === "item" && item.itemType === ProjectItemType.itemTypeBehavior) {
          return item.name === modelId;
        }
        return false;
      });

      if (matchingItem) {
        wireTarget = matchingItem.name;
        Log.debug(`designModel: Auto-discovered matching ${usage}: ${wireTarget}`);
      }
    }

    // TODO: Implement actual wiring to entity/block/item definitions
    // This would update entity_resources.json, terrain_texture.json, etc.
    // For now, we just note if wiring would happen
    let wiringNote = "";
    if (wireTarget) {
      wiringNote = `\n\n💡 Found matching ${usage} "${wireTarget}" - wiring support coming soon.`;
    }

    // Re-infer to get the new project item for the geometry file
    await project.inferProjectItemsFromFilesRootFolder();

    // Save design to accessory folder for future iteration
    const geoProjectItem = project.items.find(
      (item) => item.projectPath && item.projectPath.endsWith(`${modelId}.geo.json`)
    );

    if (geoProjectItem) {
      try {
        const designDef = await ModelDesignDefinition.ensureAsAccessoryOnProjectItem(geoProjectItem);
        if (designDef) {
          await designDef.updateDesign(design, {
            usage,
            wiredTo: wireTarget,
          });
          Log.debug(`designModel: Saved design to accessory folder for ${modelId}`);
        }
      } catch (e) {
        Log.debug(`designModel: Failed to save design to accessory folder: ${e}`);
      }
    }

    // Generate preview image
    let previewImageData: Uint8Array | undefined;
    let previewError: string | undefined;

    try {
      Log.debug(`designModel: Starting preview generation for ${modelId}`);

      // Use the existing preview rendering infrastructure (same pattern as previewModelDesign)
      const serverManager = this.ensureServerManager();
      serverManager.features = ServerManagerFeatures.all;

      const httpServer = serverManager.ensureHttpServer(this._previewServerPort);

      // Generate unique URLs for this render
      const renderToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      const geometryPath = `/temp/designmodel-geometry-${renderToken}.json`;
      const texturePath = `/temp/designmodel-texture-${renderToken}.png`;

      // Register temporary content
      httpServer.registerTempContent(geometryPath, geometryJson, "application/json");

      if (textureDataUrl) {
        const base64Match = textureDataUrl.match(/^data:image\/png;base64,(.*)$/);
        if (base64Match) {
          const binaryData = Buffer.from(base64Match[1], "base64");
          httpServer.registerTempContent(texturePath, binaryData, "image/png");
        }
      }

      // Use the actual port the HTTP server is listening on (may differ from _previewServerPort
      // if the server was already created for another purpose)
      const baseUrl = `http://localhost:${httpServer.port}`;

      // Wait for HTTP server to be ready
      if (!httpServer.isListening) {
        await httpServer.waitForReady();
      }

      // Initialize headless renderer (reuse if already created)
      if (!this._cachedRenderer) {
        this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
        const initialized = await this._cachedRenderer.initialize();
        if (!initialized) {
          httpServer.clearTempContent();
          throw new Error("Could not initialize headless renderer");
        }
        await this._cachedRenderer.warmUp();
      }

      // Verify browser is still connected
      if (!this._cachedRenderer.isBrowserReady()) {
        this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
        const reinitialized = await this._cachedRenderer.initialize();
        if (!reinitialized) {
          httpServer.clearTempContent();
          throw new Error("Browser disconnected and could not be reinitialized");
        }
        await this._cachedRenderer.warmUp();
      }

      const renderer = this._cachedRenderer;

      // Build model viewer URL.
      // NOTE: Do NOT append cameraX/cameraY/cameraZ here. VolumeEditor's ModelPreview
      // view mode auto-frames the shot based on the model's actual bounds (see
      // _calculateEntityMeshBounds / _calculateModelBoundsFromEntities). Passing fixed
      // camera coordinates overrides auto-framing and produces shots that are either
      // comically zoomed in for large models or tiny for small models.
      let modelViewerUrl = `/?mode=modelviewer&geometry=${encodeURIComponent(geometryPath)}&skipVanilla=true`;
      if (textureDataUrl) {
        modelViewerUrl += `&texture=${encodeURIComponent(texturePath)}`;
      }

      const angleUrl = modelViewerUrl;

      const result = await renderer.renderModelFast(angleUrl, {
        width: 768,
        height: 768,
        renderWaitTime: 2000,
        canvasTimeout: 10000,
        imageFormat: "png",
        forceNewContext: true,
      });

      httpServer.clearTempContent();

      if (result.imageData) {
        previewImageData = result.imageData;
        Log.debug(`designModel: Preview image generated, size=${previewImageData.length} bytes`);

        // Also save preview to accessory folder
        if (geoProjectItem) {
          try {
            const designDef = await ModelDesignDefinition.ensureAsAccessoryOnProjectItem(geoProjectItem);
            if (designDef) {
              await designDef.savePreview(previewImageData);
            }
          } catch (e) {
            Log.debug(`designModel: Failed to save preview to accessory folder: ${e}`);
          }
        }
      } else {
        previewError = result.error || "No image data returned from renderer";
        Log.debug(`designModel: No preview image - ${previewError}`);
      }
    } catch (e) {
      previewError = `Preview generation failed: ${e}`;
      Log.debug(`designModel: Preview failed with exception: ${e}`);
    }

    // Build response
    if (errors.length > 0 && filesWritten.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Model creation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`,
          },
        ],
        isError: true,
      };
    }

    let resultText = `✅ Created model "${modelId}" (${usage}):\n`;
    for (const file of filesWritten) {
      resultText += `  ✓ ${file}\n`;
    }

    if (conversionResult.warnings.length > 0) {
      resultText += `\nWarnings:\n${conversionResult.warnings.map((w) => `  - ${w}`).join("\n")}`;
    }

    if (errors.length > 0) {
      resultText += `\nErrors:\n${errors.map((e) => `  - ${e}`).join("\n")}`;
    }

    if (previewError) {
      resultText += `\nPreview: ${previewError}`;
    }

    resultText += wiringNote;

    const responseContent: any[] = [];
    let previewImagePath: string | undefined;

    // Include preview image if available
    if (previewImageData) {
      const rawBase64 = Buffer.from(previewImageData).toString("base64");
      const fitted = MinecraftMcpServer.ensureImageFitsContext(rawBase64, "image/png");

      responseContent.push({
        type: "image",
        data: fitted.base64,
        mimeType: fitted.mimeType,
      });

      // Save to temp file for Electron UI display (SDK workaround)
      // Save in the project folder so it's accessible and not lost
      try {
        const tempDir = path.join(projectPath, ".mct", "previews");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const fileName = `designmodel-${modelId}-${Date.now()}.png`;
        previewImagePath = path.join(tempDir, fileName);
        fs.writeFileSync(previewImagePath, previewImageData);

        responseContent.push({
          type: "text",
          text: `[MCT_IMAGE_PATH:${previewImagePath}]\n\n${resultText}`,
        });
      } catch (saveErr) {
        responseContent.push({
          type: "text",
          text: resultText,
        });
      }
    } else {
      responseContent.push({
        type: "text",
        text: resultText,
      });
    }

    return {
      content: responseContent,
      structuredContent: {
        success: filesWritten.length > 0,
        filesWritten,
        modelId,
        usage,
        wiredTo: wireTarget,
        geometryJson: conversionResult.geometry,
        warnings: conversionResult.warnings,
        errors,
        // Include preview status for debugging
        previewStatus: previewImagePath ? "generated" : previewError || "no-preview",
        // Include preview image path for Electron app (SDK filters out large base64 data)
        previewImagePath,
      },
    };
  }

  /**
   * Unified tool for building structures in Minecraft projects.
   * Combines structure preview + export + project integration into one step.
   */
  async _designStructureOp(args: any): Promise<CallToolResult> {
    if (!this._creatorTools || !this._env) {
      return {
        content: [{ type: "text", text: "Error: Creator Tools is not initialized" }],
        isError: true,
      };
    }

    const blockVolume = args.blockVolume as IBlockVolume;
    if (!blockVolume) {
      return {
        content: [{ type: "text", text: "Error: blockVolume is required" }],
        isError: true,
      };
    }

    const structureId = args.structureId as string;
    if (!structureId) {
      return {
        content: [{ type: "text", text: "Error: structureId is required" }],
        isError: true,
      };
    }

    const projectPath = args.projectPath as string;
    if (!projectPath) {
      return {
        content: [{ type: "text", text: "Error: projectPath is required" }],
        isError: true,
      };
    }

    // Validate the block volume
    if (!blockVolume.blockLayersBottomToTop || !blockVolume.key) {
      return {
        content: [{ type: "text", text: "Error: blockVolume must have blockLayersBottomToTop and key properties" }],
        isError: true,
      };
    }

    // Validate basic structure
    const dimensionError = this._validateBlockVolumeDimensions(blockVolume);
    if (dimensionError) {
      return {
        content: [{ type: "text", text: `Error: ${dimensionError}` }],
        isError: true,
      };
    }

    // Get effective size for reporting (infers if not explicit)
    const effectiveSize = StructureUtilities.getEffectiveSize(blockVolume);

    // Convert IBlockVolume to Structure
    const structure = StructureUtilities.createStructureFromIBlockVolume(blockVolume);

    // Generate MCStructure bytes
    const structureBytes = structure.getMCStructureBytes();
    if (!structureBytes) {
      return {
        content: [{ type: "text", text: "Error: Failed to generate MCStructure bytes from block volume" }],
        isError: true,
      };
    }

    // Set up project from path
    let project: Project;
    try {
      const nodeStorage = new NodeStorage(projectPath, "");
      const projectFolder = nodeStorage.rootFolder;
      await projectFolder.ensureExists();

      project = new Project(this._creatorTools, path.basename(projectPath), null);
      project.setProjectFolder(projectFolder);
      await project.inferProjectItemsFromFilesRootFolder();
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Failed to open project at ${projectPath}: ${e}` }],
        isError: true,
      };
    }

    // Determine structure folder path
    let bpFolder: IFolder | undefined = await project.ensureDefaultBehaviorPackFolder();
    if (!bpFolder) {
      // Create a behavior_packs structure
      bpFolder = project.projectFolder?.ensureFolder("behavior_packs");
      if (!bpFolder) {
        return {
          content: [{ type: "text", text: "Error: Could not create behavior_packs folder" }],
          isError: true,
        };
      }
      bpFolder = bpFolder.ensureFolder("main_bp");
      if (!bpFolder) {
        return {
          content: [{ type: "text", text: "Error: Could not create main_bp folder" }],
          isError: true,
        };
      }
    }

    const structuresFolder = bpFolder.ensureFolder("structures");
    await structuresFolder.ensureExists();

    // Write the structure file
    const structureFile = structuresFolder.ensureFile(`${structureId}.mcstructure`);
    structureFile.setContent(structureBytes);
    await structureFile.saveContent();

    const filesWritten: string[] = [];
    filesWritten.push(structureFile.fullPath);

    // Re-infer to get the new project item for the structure file
    await project.inferProjectItemsFromFilesRootFolder();

    // Save design to accessory folder for future iteration
    const structureProjectItem = project.items.find(
      (item) => item.projectPath && item.projectPath.endsWith(`${structureId}.mcstructure`)
    );

    if (structureProjectItem) {
      try {
        const designDef = await StructureDesignDefinition.ensureAsAccessoryOnProjectItem(structureProjectItem);
        if (designDef) {
          await designDef.updateDesign(blockVolume);
          Log.debug(`designStructure: Saved design to accessory folder for ${structureId}`);
        }
      } catch (e) {
        Log.debug(`designStructure: Failed to save design to accessory folder: ${e}`);
      }
    }

    // Generate preview image
    let previewImageData: Uint8Array | undefined;
    let previewError: string | undefined;

    try {
      // Use the existing preview rendering infrastructure
      const serverManager = this.ensureServerManager();
      serverManager.features = ServerManagerFeatures.all;

      const httpServer = serverManager.ensureHttpServer(this._previewServerPort);

      // Generate unique URLs for this render
      const renderToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      const structurePath = `/temp/designstructure-${renderToken}.mcstructure`;

      // Register temporary content
      httpServer.registerTempContent(structurePath, structureBytes, "application/octet-stream");

      // Use the actual port the HTTP server is listening on (may differ from _previewServerPort
      // if the server was already created for another purpose)
      const baseUrl = `http://localhost:${httpServer.port}`;

      // Wait for HTTP server to be ready
      if (!httpServer.isListening) {
        await httpServer.waitForReady();
      }

      // Initialize headless renderer (reuse if already created)
      if (!this._cachedRenderer) {
        this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
        const initialized = await this._cachedRenderer.initialize();
        if (!initialized) {
          httpServer.clearTempContent();
          throw new Error("Could not initialize headless renderer");
        }
        await this._cachedRenderer.warmUp();
      }

      // Verify browser is still connected
      if (!this._cachedRenderer.isBrowserReady()) {
        this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
        const reinitialized = await this._cachedRenderer.initialize();
        if (!reinitialized) {
          httpServer.clearTempContent();
          throw new Error("Browser disconnected and could not be reinitialized");
        }
        await this._cachedRenderer.warmUp();
      }

      const renderer = this._cachedRenderer;

      // Build structure viewer URL.
      // NOTE: Do NOT append cameraX/cameraY/cameraZ here. VolumeEditor's Structure
      // view mode auto-frames the shot based on the block volume's dimensions
      // (maxDim * 1.5 diagonal offset). Passing fixed camera coordinates overrides
      // auto-framing and mis-frames both tiny and large structures.
      let structureViewerUrl = `/?mode=structureviewer&structure=${encodeURIComponent(structurePath)}&hideChrome=true`;
      structureViewerUrl += `&skipVanilla=false`;
      structureViewerUrl += `&contentRoot=${encodeURIComponent("https://mctools.dev/")}`;

      const angleUrl = structureViewerUrl;

      const result = await renderer.renderModelFast(angleUrl, {
        width: 800,
        height: 600,
        renderWaitTime: 3000,
        canvasTimeout: 15000,
        imageFormat: "png",
        forceNewContext: true,
      });

      httpServer.clearTempContent();

      if (result.imageData) {
        previewImageData = result.imageData;

        // Also save preview to accessory folder
        if (structureProjectItem) {
          try {
            const designDef = await StructureDesignDefinition.ensureAsAccessoryOnProjectItem(structureProjectItem);
            if (designDef) {
              await designDef.savePreview(previewImageData);
            }
          } catch (e) {
            Log.debug(`designStructure: Failed to save preview to accessory folder: ${e}`);
          }
        }
      } else {
        previewError = result.error || "No image data returned from renderer";
      }
    } catch (e) {
      previewError = `Preview generation failed: ${e}`;
    }

    // Build response
    let resultText = `✅ Built structure "${structureId}":\n`;
    for (const file of filesWritten) {
      resultText += `  ✓ ${file}\n`;
    }
    resultText += `\n  Size: ${effectiveSize.x}x${effectiveSize.y}x${effectiveSize.z} blocks`;
    resultText += `\n  Origin: (${blockVolume.southWestBottom.x}, ${blockVolume.southWestBottom.y}, ${blockVolume.southWestBottom.z})`;
    resultText += `\n  Block types: ${Object.keys(blockVolume.key).length}`;

    if (previewError) {
      resultText += `\n\nPreview: ${previewError}`;
    }

    const responseContent: any[] = [];

    // Include preview image if available
    if (previewImageData) {
      const rawBase64 = Buffer.from(previewImageData).toString("base64");
      const fitted = MinecraftMcpServer.ensureImageFitsContext(rawBase64, "image/png");

      responseContent.push({
        type: "image",
        data: fitted.base64,
        mimeType: fitted.mimeType,
      });

      // Save to temp file for Electron UI display (SDK workaround)
      // Save in the project folder so it's accessible and not lost
      try {
        const tempDir = path.join(projectPath, ".mct", "previews");
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const fileName = `designstructure-${structureId}-${Date.now()}.png`;
        const tempImagePath = path.join(tempDir, fileName);
        fs.writeFileSync(tempImagePath, previewImageData);

        responseContent.push({
          type: "text",
          text: `[MCT_IMAGE_PATH:${tempImagePath}]\n\n${resultText}`,
        });
      } catch (saveErr) {
        responseContent.push({
          type: "text",
          text: resultText,
        });
      }
    } else {
      responseContent.push({
        type: "text",
        text: resultText,
      });
    }

    return {
      content: responseContent,
      structuredContent: {
        success: filesWritten.length > 0,
        filesWritten,
        structureId,
        size: effectiveSize,
        origin: blockVolume.southWestBottom,
        blockTypeCount: Object.keys(blockVolume.key).length,
      },
    };
  }

  /**
   * Returns starter model templates for common Minecraft entity types.
   * These provide proper Minecraft-scale geometry with blocky pixel-art style textures.
   */
  async _getModelTemplatesOp(args: { templateType: ModelTemplateType }): Promise<CallToolResult> {
    const template = await getModelTemplateAsync(args.templateType);
    if (!template) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown template type: ${args.templateType}. Available types: ${getAvailableTemplateTypes().join(
              ", "
            )}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text:
            `Template: ${args.templateType}\n\n` +
            `${template.description}\n\n` +
            `This template can be passed directly to designModel.\n` +
            `Customize the colors in the 'textures' dictionary and adjust cube dimensions as needed.\n\n` +
            `Template JSON:\n` +
            "```json\n" +
            JSON.stringify(template, null, 2) +
            "\n```",
        },
      ],
      structuredContent: {
        template: template,
        templateType: args.templateType,
        description: template.description,
      },
    };
  }

  /**
   * Validates an IBlockVolume has the required basic structure.
   * Size is now optional - if not provided, it will be inferred from the data.
   * String lengths and row counts don't need to match exactly - shorter strings
   * and missing rows are treated as air blocks.
   *
   * Returns an error message if validation fails, or undefined if valid.
   */
  private _validateBlockVolumeDimensions(blockVolume: IBlockVolume): string | undefined {
    const layers = blockVolume.blockLayersBottomToTop;

    // Just validate that we have at least some data
    if (!layers || layers.length === 0) {
      return "blockLayersBottomToTop must have at least one layer";
    }

    // Check that each layer has at least one row with content
    let hasContent = false;
    for (const layer of layers) {
      if (layer && layer.length > 0) {
        for (const row of layer) {
          if (row && row.length > 0) {
            hasContent = true;
            break;
          }
        }
        if (hasContent) break;
      }
    }

    if (!hasContent) {
      return "blockLayersBottomToTop must have at least one non-empty row";
    }

    return undefined; // Valid
  }

  /**
   * Preview a structure design (IBlockVolume) by converting it to an MCStructure and rendering a preview image.
   * Returns the preview as a base64-encoded PNG image from multiple angles.
   */
  async _previewStructureDesignOp(args: any): Promise<CallToolResult> {
    if (!this._creatorTools || !this._env) {
      return {
        content: [{ type: "text", text: "Error: Creator Tools is not initialized" }],
        isError: true,
      };
    }

    const blockVolume = args.blockVolume as IBlockVolume;
    if (!blockVolume) {
      return {
        content: [{ type: "text", text: "Error: blockVolume is required" }],
        isError: true,
      };
    }

    // Validate the block volume
    if (!blockVolume.blockLayersBottomToTop || !blockVolume.key) {
      return {
        content: [{ type: "text", text: "Error: blockVolume must have blockLayersBottomToTop and key properties" }],
        isError: true,
      };
    }

    // Validate basic structure (size is optional and will be inferred if not provided)
    const dimensionError = this._validateBlockVolumeDimensions(blockVolume);
    if (dimensionError) {
      return {
        content: [{ type: "text", text: `Error: ${dimensionError}` }],
        isError: true,
      };
    }

    // Get effective size for reporting (infers if not explicit)
    const effectiveSize = StructureUtilities.getEffectiveSize(blockVolume);

    // Convert IBlockVolume to Structure
    const structure = StructureUtilities.createStructureFromIBlockVolume(blockVolume);

    // Generate MCStructure bytes
    const structureBytes = structure.getMCStructureBytes();
    if (!structureBytes) {
      return {
        content: [{ type: "text", text: "Error: Failed to generate MCStructure bytes from block volume" }],
        isError: true,
      };
    }

    // Set up the HTTP server for rendering
    const serverManager = this.ensureServerManager();
    serverManager.features = ServerManagerFeatures.all;

    const httpServer = serverManager.ensureHttpServer(this._previewServerPort);

    // Generate unique URL for this render
    const renderToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const structurePath = `/temp/preview-structure-${renderToken}.mcstructure`;

    // Register temporary content
    httpServer.registerTempContent(structurePath, structureBytes, "application/octet-stream");

    // Use the actual port the HTTP server is listening on (may differ from _previewServerPort
    // if the server was already created for another purpose)
    const baseUrl = `http://localhost:${httpServer.port}`;

    // Wait for the HTTP server to be ready to accept connections
    // This prevents race conditions on first render after MCP server start
    if (!httpServer.isListening) {
      await httpServer.waitForReady();
    }

    // Verify the HTTP server is actually still listening (could have crashed)
    if (!httpServer.isListening) {
      Log.debugAlert(`HTTP server on port ${httpServer.port} is not actually listening. Server may have crashed.`);
      return {
        content: [
          {
            type: "text",
            text: `Error: Internal HTTP server on port ${httpServer.port} is not responding. Please restart the MCP server.`,
          },
        ],
        isError: true,
      };
    }

    // Initialize headless renderer (reuse if already created)
    if (!this._cachedRenderer) {
      this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
      const initialized = await this._cachedRenderer.initialize();

      if (!initialized) {
        httpServer.clearTempContent();
        this._cachedRenderer = undefined;
        return {
          content: [
            {
              type: "text",
              text: "Error: Could not initialize headless renderer. Ensure Chrome/Edge is available.",
            },
          ],
          isError: true,
        };
      }

      // Warm up the browser to improve first-render reliability
      await this._cachedRenderer.warmUp();
    }

    // Verify browser is still connected (it may have crashed or been disconnected)
    if (!this._cachedRenderer.isBrowserReady()) {
      Log.debug("Browser disconnected, reinitializing for structure preview...");
      this._cachedRenderer = new PlaywrightPageRenderer(baseUrl);
      const reinitialized = await this._cachedRenderer.initialize();
      if (!reinitialized) {
        httpServer.clearTempContent();
        this._cachedRenderer = undefined;
        return {
          content: [{ type: "text", text: "Error: Browser disconnected and could not be reinitialized." }],
          isError: true,
        };
      }
      await this._cachedRenderer.warmUp();
    }

    const renderer = this._cachedRenderer;

    const width = args.width || 800;
    const height = args.height || 600;
    const multiAngle = args.multiAngle !== false; // Default to true for structures
    const imageFormat = args.imageFormat || "png";
    const jpegQuality = args.jpegQuality || 80;

    // Build the structure viewer URL
    let structureViewerUrl = `/?mode=structureviewer&structure=${encodeURIComponent(structurePath)}&hideChrome=true`;
    structureViewerUrl += `&skipVanilla=false`;
    structureViewerUrl += `&contentRoot=${encodeURIComponent("https://mctools.dev/")}`;

    // Calculate dimensions (used for camera positioning and timeout calculations)
    const sizeX = effectiveSize.x;
    const sizeY = effectiveSize.y;
    const sizeZ = effectiveSize.z;

    let result: { imageData: Uint8Array | undefined; error?: string };

    if (multiAngle) {
      // Multi-angle rendering for structures
      // Calculate center based on structure dimensions (using inferred size)
      const maxDim = Math.max(sizeX, sizeY, sizeZ);
      const radius = maxDim * 1.5 + 5;

      const centerX = sizeX / 2;
      const centerY = sizeY / 2;
      const centerZ = sizeZ / 2;

      const anglePresets = [
        {
          key: "front-right",
          x: centerX + radius * 0.7,
          y: centerY + radius * 0.5,
          z: centerZ + radius * 0.7,
          label: "Front Right",
        },
        {
          key: "front-left",
          x: centerX - radius * 0.7,
          y: centerY + radius * 0.5,
          z: centerZ + radius * 0.7,
          label: "Front Left",
        },
        {
          key: "back-right",
          x: centerX + radius * 0.7,
          y: centerY + radius * 0.5,
          z: centerZ - radius * 0.7,
          label: "Back Right",
        },
        {
          key: "back-left",
          x: centerX - radius * 0.7,
          y: centerY + radius * 0.5,
          z: centerZ - radius * 0.7,
          label: "Back Left",
        },
        {
          key: "top-down",
          x: centerX,
          y: centerY + radius * 1.2,
          z: centerZ + 0.1, // Slight offset to avoid looking straight down
          label: "Top Down",
        },
        {
          key: "side-right",
          x: centerX + radius,
          y: centerY + radius * 0.3,
          z: centerZ,
          label: "Side Right",
        },
        {
          key: "side-left",
          x: centerX - radius,
          y: centerY + radius * 0.3,
          z: centerZ,
          label: "Side Left",
        },
      ];

      const requestedAngles = args.anglePresets || ["front-right", "back-left"];
      const anglesToRender = requestedAngles
        .map((a: string) => anglePresets.find((p) => p.key === a.toLowerCase()))
        .filter(Boolean);

      if (anglesToRender.length === 0) {
        anglesToRender.push(anglePresets[0], anglePresets[3]); // front-right and back-left
      }

      const cols = anglesToRender.length >= 4 ? 2 : anglesToRender.length;
      const rows = anglesToRender.length >= 4 ? 2 : 1;

      const renderedImages: { label: string; imageData: Uint8Array }[] = [];
      const renderErrors: string[] = [];

      // Calculate timeouts based on structure size - larger structures need more time
      const blockCount = sizeX * sizeY * sizeZ;
      // Canvas timeout: time to wait for page to load and initialize (8s base + up to 15s for large structures)
      const baseCanvasTimeout = 8000;
      const additionalCanvasTimeout = Math.min(blockCount / 500, 15000);
      const canvasTimeout = Math.round(baseCanvasTimeout + additionalCanvasTimeout);
      // Render wait time: time to wait for meshes to render after canvas appears
      const baseWaitTime = 2500;
      const additionalWaitTime = Math.min(blockCount / 250, 6000); // Up to 6 more seconds for very large structures
      const renderWaitTime = Math.round(baseWaitTime + additionalWaitTime);

      for (let i = 0; i < anglesToRender.length; i++) {
        const angle = anglesToRender[i];
        const imgWidth = Math.floor(width / cols);
        const imgHeight = Math.floor(height / rows);

        // Add timestamp to force unique URL and prevent browser caching
        const angleUrl =
          structureViewerUrl + `&cameraX=${angle.x}&cameraY=${angle.y}&cameraZ=${angle.z}&t=${Date.now()}_${i}`;

        const angleResult = await renderer.renderModelFast(angleUrl, {
          width: imgWidth,
          height: imgHeight,
          renderWaitTime: renderWaitTime,
          canvasTimeout: canvasTimeout,
          imageFormat: "png",
          forceNewContext: true, // Force new context for each angle to ensure camera position is applied
        });

        if (angleResult.imageData) {
          renderedImages.push({ label: angle.label, imageData: angleResult.imageData });
        } else if (angleResult.error) {
          renderErrors.push(`${angle.label}: ${angleResult.error}`);
        }
      }

      if (renderedImages.length > 0) {
        const stitchedImage = await ImageGenerationUtilities.stitchImagesWithLabels(
          renderedImages,
          Math.floor(width / cols),
          Math.floor(height / rows),
          cols,
          rows
        );
        result = { imageData: stitchedImage };
      } else {
        // No images rendered - provide helpful error message
        let errorMsg = `No images rendered for multi-angle view. `;
        errorMsg += `Structure size: ${sizeX}x${sizeY}x${sizeZ} (${blockCount} blocks). `;
        errorMsg += `Requested angles: ${requestedAngles.join(", ")}. `;
        errorMsg += `Valid angles found: ${anglesToRender.length}. `;
        if (renderErrors.length > 0) {
          errorMsg += `Render errors: ${renderErrors.join("; ")}`;
        }
        result = { imageData: undefined, error: errorMsg };
      }
    } else {
      // Single angle rendering
      // Calculate timeouts based on structure size - larger structures need more time
      const blockCount = sizeX * sizeY * sizeZ;
      const baseCanvasTimeout = 8000;
      const additionalCanvasTimeout = Math.min(blockCount / 500, 15000);
      const canvasTimeout = Math.round(baseCanvasTimeout + additionalCanvasTimeout);
      const baseWaitTime = 2500;
      const additionalWaitTime = Math.min(blockCount / 250, 6000);
      const renderWaitTime = Math.round(baseWaitTime + additionalWaitTime);

      result = await renderer.renderModelFast(structureViewerUrl, {
        width,
        height,
        renderWaitTime: renderWaitTime,
        canvasTimeout: canvasTimeout,
        imageFormat: imageFormat as "png" | "jpeg",
        jpegQuality,
        forceNewContext: true,
      });
    }

    httpServer.clearTempContent();

    if (result.error) {
      return {
        content: [{ type: "text", text: `Rendering failed: ${result.error}` }],
        isError: true,
      };
    }

    if (result.imageData) {
      let finalImageData = result.imageData;

      if (imageFormat === "jpeg" && multiAngle) {
        finalImageData = await ImageGenerationUtilities.convertPngToJpeg(finalImageData, jpegQuality);
      }

      const rawBase64Image = Buffer.from(finalImageData).toString("base64");
      const structOutputMime = imageFormat === "jpeg" ? "image/jpeg" : "image/png";
      const fitted = MinecraftMcpServer.ensureImageFitsContext(rawBase64Image, structOutputMime);

      return {
        content: [
          {
            type: "image",
            data: fitted.base64,
            mimeType: fitted.mimeType,
          },
          {
            type: "text",
            text: `Structure preview generated: ${effectiveSize.x}x${effectiveSize.y}x${effectiveSize.z} blocks`,
          },
        ],
        structuredContent: {
          size: effectiveSize,
          origin: blockVolume.southWestBottom,
          blockTypeCount: Object.keys(blockVolume.key).length,
        },
      };
    }

    return {
      content: [{ type: "text", text: "Error: No image data returned from renderer" }],
      isError: true,
    };
  }

  /**
   * Export a structure design (IBlockVolume) to an MCStructure file.
   */
  async _exportStructureDesignOp(args: any): Promise<CallToolResult> {
    const blockVolume = args.blockVolume as IBlockVolume;
    const outputPath = args.outputPath as string;
    const overwrite = args.overwrite as boolean | undefined;

    if (!blockVolume) {
      return {
        content: [{ type: "text", text: "Error: blockVolume is required" }],
        isError: true,
      };
    }

    if (!outputPath) {
      return {
        content: [{ type: "text", text: "Error: outputPath is required" }],
        isError: true,
      };
    }

    // Validate the block volume (size is optional and will be inferred if not provided)
    if (!blockVolume.blockLayersBottomToTop || !blockVolume.key) {
      return {
        content: [{ type: "text", text: "Error: blockVolume must have blockLayersBottomToTop and key properties" }],
        isError: true,
      };
    }

    // Validate basic structure
    const dimensionError = this._validateBlockVolumeDimensions(blockVolume);
    if (dimensionError) {
      return {
        content: [{ type: "text", text: `Error: ${dimensionError}` }],
        isError: true,
      };
    }

    // Get effective size for reporting (infers if not explicit)
    const effectiveSize = StructureUtilities.getEffectiveSize(blockVolume);

    // Check if file exists and overwrite is not set
    if (!overwrite && fs.existsSync(outputPath)) {
      return {
        content: [
          {
            type: "text",
            text: `Error: File already exists: ${outputPath}\nUse overwrite: true to replace it.`,
          },
        ],
        isError: true,
      };
    }

    // Convert IBlockVolume to Structure
    const structure = StructureUtilities.createStructureFromIBlockVolume(blockVolume);

    // Generate MCStructure bytes
    const structureBytes = structure.getMCStructureBytes();
    if (!structureBytes) {
      return {
        content: [{ type: "text", text: "Error: Failed to generate MCStructure bytes from block volume" }],
        isError: true,
      };
    }

    // Write the file
    try {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, Buffer.from(structureBytes));
    } catch (e) {
      return {
        content: [{ type: "text", text: `Error: Failed to write file: ${e}` }],
        isError: true,
      };
    }

    const resultText =
      `Successfully exported structure:\n` +
      `  ✓ ${outputPath}\n` +
      `  Size: ${effectiveSize.x}x${effectiveSize.y}x${effectiveSize.z} blocks\n` +
      `  Origin: (${blockVolume.southWestBottom.x}, ${blockVolume.southWestBottom.y}, ${blockVolume.southWestBottom.z})\n` +
      `  Block types: ${Object.keys(blockVolume.key).length}`;

    return {
      content: [{ type: "text", text: resultText }],
      structuredContent: {
        success: true,
        filePath: outputPath,
        size: effectiveSize,
        origin: blockVolume.southWestBottom,
        blockTypeCount: Object.keys(blockVolume.key).length,
      },
    };
  }

  /**
   * Configure MCP prompts that expose server configuration to AI assistants.
   * The main prompt is "working-folder" which tells the AI where to write content.
   */
  _configurePrompts() {
    // Register a prompt that exposes the working folder to AI assistants
    // SDK signature: prompt(name: string, cb: PromptCallback): RegisteredPrompt
    this._server.prompt("working-folder", async () => {
      if (this._workingFolder) {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `The working folder for Minecraft content is: ${this._workingFolder}\n\nWhen creating Minecraft content, use this folder as the base path for all file operations. For example:\n- Create projects at: ${this._workingFolder}\n- Write model designs to: ${this._workingFolder}\n- Save structures to: ${this._workingFolder}\n\nAlways use absolute paths based on this working folder.`,
              },
            },
          ],
        };
      } else {
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: "No working folder has been set. The MCP server was started without the -i argument. You should ask the user where they want to create Minecraft content, or use the current working directory.",
              },
            },
          ],
        };
      }
    });

    // Also register a resource that provides the working folder info
    // SDK signature: resource(name: string, uri: string, readCallback: ReadResourceCallback)
    this._server.resource("working-folder-config", "config://working-folder", async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                workingFolder: this._workingFolder || null,
                hasWorkingFolder: !!this._workingFolder,
                message: this._workingFolder
                  ? `Use ${this._workingFolder} as the base path for Minecraft content operations.`
                  : "No working folder set. Use current directory or ask user for path.",
              },
              null,
              2
            ),
          },
        ],
      };
    });
  }

  async _configureTools() {
    const infoSetForm = Database.ensureFormLoadedSync("info_set", "info");
    const stateForm = Database.ensureFormLoadedSync("action_set", "world_state");
    const actionSetForm = Database.ensureFormLoadedSync("action_set", "action_group");

    if (infoSetForm && actionSetForm && stateForm) {
      const validationResultForm = { info: DataFormZod.getZodSchema(infoSetForm) };
      const actionSetResultForm = { actionSet: DataFormZod.getZodSchema(actionSetForm) };
      const stateResultForm = { state: DataFormZod.getZodSchema(stateForm) };

      this._registerTool(
        "createProject",
        {
          title: "Creates scaffolding and files for a new Minecraft project",
          description: "Creates all of the foundational files for a new Minecraft project.",
          inputSchema: {
            folderPathToCreateProjectAt: z.string(),
            title: z.string(),
            description: z.string().optional(),
            newName: z.string(),
            creator: z.string(),
            template: z.enum([
              "addonStarter",
              "tsStarter",
              "addonFull",
              "scriptBox",
              "dlStarter",
              "editor-scriptBox",
              "editor-basics",
            ]),
          },
        },
        this._createOp
      );

      this._registerTool(
        "addItem",
        {
          title: "Adds files for Minecraft items to a project",
          description: "Adds files for Minecraft items to a project.",
          inputSchema: {
            folderPathToCreateProjectAt: z.string(),
            templateType: z.enum([
              "basicUnitCubeBlock",
              "crateBlock",
              "basicDieBlock",
              "sushiRollBlock",
              "fishBowlBlock",
              "hardBiscuit",
              "pear",
              "elixir",
              "rod",
              "key",
              "customSword",
              "wrench",
              "allay",
              "axolotl",
              "cat",
              "cow",
              "creeper",
              "enderman",
              "rabbit",
              "pig",
              "sheep",
              "skeleton",
              "wolf",
              "zombie",
              "spawn_rule",
              "loot_table",
              "recipe_shapeless",
              "recipe_shaped",
              "feature_rule",
              "jigsaw",
              "atmospherics",
              "color_grading",
              "lighting",
              "pbr",
              "biome_behavior",
              "entity_behavior",
              "entity_resources",
              "item_behavior",
              "attachable",
              "block_behavior",
              "block_culling",
              "block_catalog",
              "biome_resource",
              "aggregate_feature",
              "animation",
              "animation_controller",
              "render_controller",
            ]),
            name: z.string(),
          },
        },
        this._addOp
      );

      // Create Minecraft content from meta-schema definition
      this._registerTool(
        "createMinecraftContent",
        {
          title: "Create Minecraft content from simplified meta-schema",
          description:
            "Create a complete Minecraft Bedrock behavior-pack + resource-pack from a single AI-friendly meta-schema. " +
            "Use this when you are authoring an add-on with multiple entities/blocks/items, loot tables, recipes, spawn rules, " +
            "features, or structures \u2014 it emits manifests and cross-references for you. " +
            "\n\n" +
            "When NOT to use this tool:\n" +
            "  - For a standalone 3D model preview (no project, just a PNG + .geo.json): use `designModel`.\n" +
            "  - For a standalone structure preview (.mcstructure only): use `designStructure`.\n" +
            "  - For a single texture PNG from pixel art: use `writeImageFileFromPixelArt` or `previewTextureSpec`.\n" +
            "  - To analyze or reverse-engineer an existing project: use `getEffectiveContentSchema`.\n" +
            "\n" +
            "The meta-schema has three layers of abstraction you can mix freely: " +
            "(1) traits \u2014 pre-packaged bundles (e.g. 'sword', 'humanoid', 'container'); " +
            "(2) simplified properties (health, damage, color, icon, etc.); " +
            "(3) raw `components` \u2014 full escape hatch to native Minecraft JSON.",
          inputSchema: {
            definition: MinecraftContentSchema,
            outputPath: z
              .string()
              .describe(
                "Absolute path to the folder where content should be generated. Pass the user's current " +
                  "project folder AS-IS \u2014 do NOT append a new subfolder named after the project. " +
                  "The tool auto-resolves the actual write location: " +
                  "(1) if the folder already contains behavior_packs/, resource_packs/, package.json, or a " +
                  "manifest.json, it anchors to that project root; " +
                  "(2) if the folder is empty or doesn't exist yet, it writes directly there; " +
                  "(3) only if the folder has unrelated existing content does it create a namespaced subfolder. " +
                  "The response reports the resolved project root under `projectRoot`."
              ),
          },
        },
        this._createMinecraftContentOp
      );

      // Get effective content schema from existing project
      this._registerTool(
        "getEffectiveContentSchema",
        {
          title: "Get effective content schema for a Minecraft project",
          description:
            "Analyzes an existing Minecraft Bedrock project and infers what traits and simplified properties " +
            "would represent it in the meta-schema format. This is useful for understanding existing content, " +
            "importing legacy projects into the simplified format, or generating documentation. " +
            "Returns an IMinecraftContentDefinition that could be used with createMinecraftContent to recreate similar content.",
          inputSchema: {
            folderPath: z.string().describe("Absolute path to the project folder to analyze"),
            options: z
              .object({
                minTraitConfidence: z
                  .number()
                  .min(0)
                  .max(1)
                  .optional()
                  .describe("Minimum confidence (0-1) for trait detection. Default: 0.6"),
                includeRawComponents: z
                  .boolean()
                  .optional()
                  .describe("Include raw components not explained by traits. Default: true"),
                inferNamespace: z
                  .boolean()
                  .optional()
                  .describe("Try to detect namespace from identifiers. Default: true"),
                includeBehaviorPresets: z
                  .boolean()
                  .optional()
                  .describe("Include behavior presets in addition to traits. Default: true"),
                includeComponentGroups: z
                  .boolean()
                  .optional()
                  .describe("Include component groups as raw data. Default: false"),
                includeEvents: z.boolean().optional().describe("Include events as raw data. Default: false"),
              })
              .optional()
              .describe("Options for controlling inference behavior"),
          },
        },
        this._getEffectiveContentSchemaOp
      );

      // add a validation tool
      this._registerTool(
        "validateContent",
        {
          title: "Validate Minecraft Bedrock content",
          description:
            "Validates content (either single JSON files or a ZIP file encoded as a base64 string) and returns validation results.",
          inputSchema: { jsonContentOrBase64ZipContent: z.string() },
          outputSchema: validationResultForm,
        },
        this._processValidateContent
      );

      // add a validation tool
      this._registerTool(
        "validateFile",
        {
          title: "Validate Minecraft Bedrock at a file path",
          description: "Validates content at a particular file path",
          inputSchema: { filePath: z.string() },
          outputSchema: validationResultForm,
        },
        this._processValidateContentAtPath
      );

      // create a Minecraft server session
      this._registerTool(
        "createMinecraftSessionWithContent",
        {
          title: "Starts a new Minecraft session",
          description:
            "Starts a new Minecraft session using the specified content, which can be used for validating content and gameplay.",
          inputSchema: {
            sessionName: z.string(),
            packagedMcaddonOrMcworldFilePath: z.string(),
            testPlayerNameToUse: z.string(),
          },
          outputSchema: stateResultForm,
        },
        this._createMinecraftSession
      );

      // create a Minecraft server session
      this._registerTool(
        "moveSessionPlayerToLocation",
        {
          title: "Moves a Minecraft player to a specific location in the Minecraft session",
          description: "Moves a player to the specified X/Y/Z coordinates within an active Minecraft session.",
          inputSchema: {
            sessionName: z.string(),
            playerName: z.string(),
            locationToHavePlayerMoveTo: z.object({ x: z.number(), y: z.number(), z: z.number() }),
          },
          outputSchema: stateResultForm,
        },
        this._moveSessionPlayerToLocation
      );

      // run a command
      this._registerTool(
        "runCommandInMinecraft",
        {
          title: "Runs a command in the specified Minecraft session",
          description: "Runs a command in the specified Minecraft session.",
          inputSchema: { sessionName: z.string(), command: z.string() },
        },
        this._runCommandOp
      );

      // run a command
      this._registerTool(
        "runActionSetInMinecraft",
        {
          title: "Runs a set of actions in the specified Minecraft session and returns a resulting state.",
          description: "Runs a set of actions in the specified Minecraft session.",
          inputSchema: actionSetResultForm,
        },
        this._runActionSetOp
      );

      // List all active Minecraft sessions and BDS slots
      this._registerTool(
        "listMinecraftSessions",
        {
          title: "List all active Minecraft sessions",
          description:
            "Lists all active Minecraft sessions, including named sessions and any unnamed active BDS server slots. " +
            "Returns session name, slot number, port, and server status for each.",
          inputSchema: {},
        },
        this._listMinecraftSessionsOp
      );

      // Connect to an existing BDS slot as a named session
      this._registerTool(
        "connectToMinecraftSession",
        {
          title: "Connect to an existing Minecraft session",
          description:
            "Registers an existing Bedrock Dedicated Server slot as a named session. " +
            "Once registered, all session-based tools (runCommandInMinecraft, moveSessionPlayerToLocation, etc.) " +
            "can reference this session by name. Use listMinecraftSessions first to discover available slots.",
          inputSchema: {
            sessionName: z.string().describe("Name to assign to this session for future tool calls"),
            slot: z.number().optional().describe("Server slot number to connect to (0-79). Defaults to 0."),
          },
        },
        this._connectToMinecraftSessionOp
      );
    }

    // Define the Zod schema for model design input

    // Schema for textured rectangle - unified concept for filling rectangular areas
    // This replaces the separate "color" and "noise" properties for easier AI reasoning
    const mcpTexturedRectangleSchema = z
      .object({
        type: z
          .enum(["none", "solid", "random_noise", "dither_noise", "perlin_noise", "stipple_noise", "gradient"])
          .describe(
            "Fill algorithm. " +
              "'none' = fully transparent background (pair with pixelArt for icon-style textures with see-through edges). " +
              "'solid' = flat single color (uses first entry in colors). " +
              "'stipple_noise' = organic materials (skin, stone, leather). " +
              "'dither_noise' = structured patterns (metal, fabric, bricks). " +
              "'perlin_noise' = smooth organic (grass, water, clouds). " +
              "'random_noise' = rough/grainy textures (gravel, sand). " +
              "'gradient' = smooth color transitions."
          ),
        colors: z
          .array(z.string())
          .optional()
          .describe(
            "Colors to use (hex like '#FF0000'). Required for all types except 'none' (omit or pass []). " +
              "For 'solid', only the first color is used. For noise types, provide 2+ colors for richer textures."
          ),
        factor: z
          .number()
          .optional()
          .describe(
            "Noise intensity from 0 to 1. Higher = more variation. Default: 0.2. Ignored for 'solid' and 'none'."
          ),
        seed: z.number().optional().describe("Random seed for deterministic results. Ignored for 'solid' and 'none'."),
        pixelSize: z
          .number()
          .optional()
          .describe("Size of noise pixels. Larger = blockier. Default: 1. Ignored for 'solid' and 'none'."),
        scale: z.number().optional().describe("For perlin_noise: controls smoothness. Larger = smoother. Default: 4."),
      })
      .describe(
        "Textured rectangle fill. Use type:'none' for transparent icon backgrounds with pixelArt overlays, " +
          "type:'solid' for flat colors, or one of the noise/gradient types for Minecraft-style procedural textures."
      );

    // ============================================================================
    // TEXTURE EFFECTS SCHEMAS
    // ============================================================================

    // Lighting effect schema
    const mcpLightingEffectSchema = z
      .object({
        preset: z
          .enum(["inset", "outset", "pillow", "ambient_occlusion"])
          .describe(
            "Lighting preset: " +
              "'inset' = darken top/left, lighten bottom/right (recessed panels); " +
              "'outset' = lighten top/left, darken bottom/right (raised blocks); " +
              "'pillow' = darken edges, lighten center (rounded look); " +
              "'ambient_occlusion' = darken corners/edges (realistic depth)"
          ),
        intensity: z
          .number()
          .optional()
          .describe("Effect intensity (0.0-1.0). Default: 0.3. Higher = more pronounced effect."),
        angle: z
          .number()
          .optional()
          .describe(
            "Light source angle in degrees (0-360). Default: 315 (top-left). 0=right, 90=bottom, 180=left, 270=top."
          ),
      })
      .describe("Lighting effect for pseudo-3D depth simulation");

    // Border side schema (CSS-like individual side configuration)
    const mcpBorderSideSchema = z
      .object({
        style: z
          .enum(["solid", "dashed", "worn", "highlight"])
          .describe(
            "Border style: " +
              "'solid' = continuous line; " +
              "'dashed' = alternating segments; " +
              "'worn' = irregular/weathered edge; " +
              "'highlight' = bright/glowing edge"
          ),
        width: z.number().optional().describe("Border width in pixels (1-8). Default: 1."),
        color: z
          .string()
          .optional()
          .describe("Border color (hex). If not specified, auto-calculated from texture (darker or lighter)."),
      })
      .describe("Configuration for a single border side");

    // Border effect schema (CSS-like syntax with 'all' shorthand and individual sides)
    const mcpBorderEffectSchema = z
      .object({
        all: mcpBorderSideSchema
          .optional()
          .describe("Shorthand: apply this configuration to all sides. Individual side properties override this."),
        top: mcpBorderSideSchema.optional().describe("Top border configuration (overrides 'all')."),
        right: mcpBorderSideSchema.optional().describe("Right border configuration (overrides 'all')."),
        bottom: mcpBorderSideSchema.optional().describe("Bottom border configuration (overrides 'all')."),
        left: mcpBorderSideSchema.optional().describe("Left border configuration (overrides 'all')."),
        seed: z.number().optional().describe("Random seed for 'worn' style deterministic weathering."),
      })
      .describe(
        "Border effect with CSS-like syntax. Use 'all' for uniform borders, or specify individual sides. " +
          "Example: { all: { style: 'highlight', width: 1 } } or { top: { style: 'highlight' }, left: { style: 'highlight' } }"
      );

    // Overlay effect schema
    const mcpOverlayEffectSchema = z
      .object({
        pattern: z
          .enum(["cracks", "scratches", "moss", "rust", "sparkle", "veins"])
          .describe(
            "Overlay pattern: " +
              "'cracks' = dark fracture lines; " +
              "'scratches' = light linear marks; " +
              "'moss' = green organic patches; " +
              "'rust' = orange/brown oxidation; " +
              "'sparkle' = bright highlight dots; " +
              "'veins' = dark branching lines"
          ),
        density: z.number().optional().describe("Coverage density (0.0-1.0). Default: 0.3. Higher = more coverage."),
        color: z
          .string()
          .optional()
          .describe("Override color for the pattern (hex). Uses pattern-appropriate default if not specified."),
        seed: z.number().optional().describe("Random seed for deterministic pattern placement."),
      })
      .describe("Overlay effect for surface weathering and detail");

    // Color variation effect schema
    const mcpColorVariationEffectSchema = z
      .object({
        mode: z
          .enum(["hue_shift", "saturation_jitter", "value_jitter", "palette_snap"])
          .describe(
            "Color variation mode: " +
              "'hue_shift' = randomly shift hue; " +
              "'saturation_jitter' = randomly vary saturation; " +
              "'value_jitter' = randomly vary brightness; " +
              "'palette_snap' = snap colors to nearest palette entry"
          ),
        amount: z.number().optional().describe("Variation amount (0.0-1.0). Default: 0.1. Higher = more variation."),
        palette: z
          .array(z.string())
          .optional()
          .describe("For 'palette_snap': array of colors to snap to (hex strings)."),
        seed: z.number().optional().describe("Random seed for deterministic variation."),
      })
      .describe("Color variation effect to reduce flatness");

    // Tiling effect schema
    const mcpTilingEffectSchema = z
      .object({
        seamless: z.boolean().optional().describe("Make edges seamless for repeating textures by blending edges."),
        pattern: z
          .enum(["brick", "herringbone", "basketweave", "random"])
          .optional()
          .describe("Tiling pattern for block arrangement (applied during generation, not post-process)."),
        offset: z.number().optional().describe("Offset amount for brick pattern (0.0-1.0). Default: 0.5."),
      })
      .describe("Tiling effect for seamless and patterned textures");

    // Combined texture effects schema
    const mcpTextureEffectsSchema = z
      .object({
        lighting: mcpLightingEffectSchema.optional().describe("Lighting effect for pseudo-3D depth."),
        border: mcpBorderEffectSchema.optional().describe("Border effect for edges/outlines (CSS-like syntax)."),
        overlay: z
          .union([mcpOverlayEffectSchema, z.array(mcpOverlayEffectSchema)])
          .optional()
          .describe(
            "Overlay effect(s) for surface detail. Can be a single effect or array of effects applied in order."
          ),
        colorVariation: mcpColorVariationEffectSchema.optional().describe("Color variation effect."),
        tiling: mcpTilingEffectSchema.optional().describe("Tiling effect for seamless textures."),
      })
      .describe(
        "Post-processing effects applied to the texture. " +
          "Order: colorVariation -> lighting -> overlay -> border -> tiling. " +
          "Example: { lighting: { preset: 'inset', intensity: 0.3 }, border: { all: { style: 'highlight' } } }"
      );

    // Schema for pixel color (can use RGBA or hex)
    const mcpPixelColorSchema = z
      .object({
        r: z.number().optional().describe("Red channel (0-255)"),
        g: z.number().optional().describe("Green channel (0-255)"),
        b: z.number().optional().describe("Blue channel (0-255)"),
        a: z.number().optional().describe("Alpha channel (0-255, default 255 = opaque)"),
        hex: z.string().optional().describe("Alternative: hex color string like '#FF0000'"),
      })
      .describe("Pixel color: use either r/g/b values or hex string");

    // Schema for pixel art overlay
    const mcpPixelArtSchema = z
      .object({
        scaleMode: z
          .enum(["unit", "exact", "cover"])
          .optional()
          .describe(
            "How to scale the pixel art: " +
              "'unit' (default) = each character is 1 Minecraft unit, x/y are in units; " +
              "'exact' = each character is 1 pixel, x/y are in pixels; " +
              "'cover' = stretch to fill the face, x/y ignored"
          ),
        x: z
          .number()
          .optional()
          .describe("X offset (in units for 'unit' mode, pixels for 'exact' mode, ignored for 'cover')"),
        y: z
          .number()
          .optional()
          .describe("Y offset (in units for 'unit' mode, pixels for 'exact' mode, ignored for 'cover')"),
        lines: z
          .array(z.string())
          .describe("ASCII art lines where each character maps to a palette color. Space = transparent."),
        palette: z
          .record(z.string(), mcpPixelColorSchema)
          .describe("Map of characters to colors. Do not define space ' ' - it is reserved for transparency."),
      })
      .describe(
        "Pixel art overlay using ASCII patterns. Default scaleMode='unit' means each character = 1 Minecraft unit. " +
          "Example: { lines: ['E E', ' n '], palette: { E: { hex: '#000000' }, n: { hex: '#402020' } } }"
      );

    // Schema for face content - can reference a texture by ID or specify inline content
    const mcpFaceContentSchema = z
      .object({
        textureId: z.string().optional().describe("Reference to a texture defined in the model's textures dictionary"),
        background: mcpTexturedRectangleSchema
          .optional()
          .describe(
            "Background fill using a textured rectangle. " +
              "Examples: { type: 'solid', colors: ['#808080'] } or " +
              "{ type: 'stipple_noise', colors: ['#8B8B8B', '#7A7A7A'], seed: 123 }"
          ),
        svg: z.string().optional().describe("SVG content overlay (rendered on top of background)"),
        pixelArt: z
          .array(mcpPixelArtSchema)
          .optional()
          .describe("Pixel art overlays rendered on top of background/texture. Layers are applied in order."),
        effects: mcpTextureEffectsSchema
          .optional()
          .describe(
            "Post-processing effects applied after rendering. " +
              "Example: { lighting: { preset: 'inset', intensity: 0.3 }, border: { all: { style: 'highlight' } } }"
          ),
        rotation: z.number().optional().describe("Rotation in degrees (0, 90, 180, 270)"),
      })
      .describe(
        "Face content: use textureId to reference a named texture, or specify background (preferred) for inline content"
      );

    const mcpCubeFacesSchema = z.object({
      north: mcpFaceContentSchema.optional(),
      south: mcpFaceContentSchema.optional(),
      east: mcpFaceContentSchema.optional(),
      west: mcpFaceContentSchema.optional(),
      up: mcpFaceContentSchema.optional(),
      down: mcpFaceContentSchema.optional(),
    });

    // Schema for texture definitions (reusable across faces)
    const mcpTextureDefinitionSchema = z
      .object({
        background: mcpTexturedRectangleSchema
          .optional()
          .describe(
            "Background fill for this texture. " +
              "Examples: { type: 'solid', colors: ['#FF0000'] } or " +
              "{ type: 'stipple_noise', colors: ['#8B8B8B', '#7A7A7A'], seed: 123 }"
          ),
        svg: z.string().optional().describe("SVG content overlay (rendered on top of background)"),
        pixelArt: z
          .array(mcpPixelArtSchema)
          .optional()
          .describe("Pixel art overlays rendered on top of background. Layers are applied in order."),
        effects: mcpTextureEffectsSchema
          .optional()
          .describe(
            "Post-processing effects applied after rendering. " +
              "Example: { lighting: { preset: 'outset', intensity: 0.3 }, overlay: { pattern: 'cracks', density: 0.2 } }"
          ),
      })
      .describe("A reusable texture definition with background fill and optional SVG/pixelArt overlay and effects");

    // Helper for 3-element number arrays (replaces z.tuple which generates invalid JSON schema for some validators)
    const vector3Schema = z.array(z.number()).min(3).max(3);
    const vector2Schema = z.array(z.number()).min(2).max(2);

    // Cube schema - NO pivot/rotation at cube level; all rotation is done at bone level
    const mcpDesignCubeSchema = z.object({
      origin: vector3Schema,
      size: vector3Schema,
      faces: mcpCubeFacesSchema,
      inflate: z.number().optional(),
      mirror: z.boolean().optional(),
    });

    // Bone schema - pivot and rotation ARE supported here for animations/posing
    const mcpDesignBoneSchema = z.object({
      name: z.string(),
      parent: z.string().optional(),
      pivot: vector3Schema.optional(),
      rotation: vector3Schema.optional(),
      cubes: z.array(mcpDesignCubeSchema),
      mirror: z.boolean().optional(),
    });

    const mcpModelDesignSchema = z.object({
      formatVersion: z.string().optional(),
      identifier: z.string().describe("Model identifier, e.g., 'custom_block' or 'geometry.custom_block'"),
      description: z.string().optional(),
      textureSize: vector2Schema.optional().describe("Texture atlas size [width, height], default [64, 64]"),
      pixelsPerUnit: z
        .number()
        .optional()
        .describe(
          "Pixels per Minecraft unit for texture generation. " +
            "pixelsPerUnit × 16 = pixels per block. " +
            "Values: 1 (16px/block, vanilla), 2 (32px/block, default HD), 4 (64px/block, high-res)"
        ),
      textures: z
        .record(z.string(), mcpTextureDefinitionSchema)
        .optional()
        .describe(
          "Named texture definitions that can be referenced by faces using textureId. " +
            "Define textures once here, then reference them in faces with { textureId: 'texture_name' }. " +
            "This enables texture reuse across multiple faces and reduces token usage."
        ),
      visibleBoundsSize: vector3Schema.optional(),
      visibleBoundsOffset: vector3Schema.optional(),
      bones: z.array(mcpDesignBoneSchema).describe("The bones that make up this model, each containing cubes"),
    });

    // Register unified designModel tool - combines design preview + export + project integration
    this._registerTool(
      "designModel",
      {
        title: "Design a 3D model in a Minecraft project",
        description:
          "Designs a 3D model (geometry + texture) and saves it to a Minecraft project folder. " +
          "Use this tool for iterative model design - it handles everything in one step:\n\n" +
          "1. ✅ Validates the model design\n" +
          "2. ✅ Creates geometry (.geo.json) and texture (.png) files\n" +
          "3. ✅ Saves files to the correct project location (auto-detects pack structure)\n" +
          "4. ✅ Persists the design for future iteration (update existing models)\n" +
          "5. ✅ Auto-wires to matching entity/block/item if found\n" +
          "6. ✅ Returns a preview image\n\n" +
          "**Usage parameter:**\n" +
          "- 'entity': Saves to /models/entity/ and /textures/entity/ (default)\n" +
          "- 'block': Saves to /models/blocks/ and /textures/blocks/\n" +
          "- 'item': Saves to /models/item/ and /textures/items/\n\n" +
          "**Wiring behavior:**\n" +
          "- By default, auto-discovers matching entity/block/item by modelId and wires the model\n" +
          "- Set wireTo to a specific ID to wire to a different target\n" +
          "- Set wireTo to false to skip wiring entirely\n\n" +
          "**Iteration:** Running this tool again with the same modelId updates the existing files in place.",
        inputSchema: {
          projectPath: z.string().describe("Absolute path to the Minecraft project folder (can be empty folder)"),
          design: mcpModelDesignSchema.describe("The model design specification"),
          modelId: z.string().describe("Unique identifier for the model (e.g., 'disco_pig', 'magic_sword')"),
          usage: z
            .enum(["entity", "block", "item"])
            .optional()
            .describe("What the model is for - determines save location. Default: 'entity'"),
          wireTo: z
            .union([z.string(), z.literal(false)])
            .optional()
            .describe(
              "Wire the model to a specific entity/block/item ID, or false to skip wiring. " +
                "Default: auto-discover matching item by modelId"
            ),
        },
      },
      this._designModelOp
    );

    // Register model templates tool - provides starter designs for common entity types
    this._registerTool(
      "getModelTemplates",
      {
        title: "Get starter model templates for common Minecraft entity types",
        description:
          "Returns starter model designs for common Minecraft entity types. " +
          "These templates provide proper Minecraft-scale geometry with blocky pixel-art textures. " +
          "Use these as starting points and customize colors, proportions, and details. " +
          "\n\n" +
          "Available template types (all coordinates in Minecraft units where 16 units = 1 block):\n" +
          "- 'humanoid': A humanoid mob with head, body, arms, legs (~32 units tall, ~2 blocks)\n" +
          "- 'small_animal': A small quadruped like a pig or sheep (~14 units tall, ~1 block)\n" +
          "- 'large_animal': A larger quadruped like a horse or cow (~24 units tall, ~1.5 blocks)\n" +
          "- 'vehicle': A wheeled vehicle or machine (~48 units long, ~3 blocks)\n" +
          "- 'block': A simple unit cube block (16x16x16 units = 1 block)\n" +
          "- 'item': A handheld sword (~30 units tall, ~2 blocks)\n" +
          "- 'bird': A bipedal bird with wings and beak (~12 units tall, ~0.75 blocks)\n" +
          "- 'insect': An 8-legged spider/insect (~14 units tall, ~38 units wide with legs)\n" +
          "- 'flying': A flying creature with articulated wings (~44 units wingspan, ~2.75 blocks)\n" +
          "- 'fish': An aquatic fish with fins (~6 units long, ~0.4 blocks)\n" +
          "- 'slime': A simple bouncy cube creature (~6 units, great for beginners)\n" +
          "- 'wizard': A robed humanoid spellcaster with pointed hat (~40 units tall)\n" +
          "- 'golem': A large bulky construct (~40 units tall, ~2.5 blocks)\n" +
          "- 'fox': A sleek quadruped with fluffy tail (~12 units tall)\n" +
          "- 'crystal': A geometric floating crystal formation (~20 units tall)\n" +
          "- 'enchanted_sword': A glowing magical sword (~36 units tall)\n" +
          "- 'tropical_fish': A colorful aquatic fish (~6 units)\n" +
          "- 'ghost': A hovering spectral entity (~28 units tall)\n" +
          "- 'robot': A mechanical humanoid (~36 units tall)\n" +
          "- 'mushroom_creature': A fungal creature (~20 units tall)\n" +
          "- 'treasure_chest': An openable container (~12 units tall)\n" +
          "\n--- BLOCK TEMPLATES (16x16x16 = 1 block) ---\n" +
          "- 'stone_brick': Classic masonry block with mortar lines\n" +
          "- 'wooden_crate': Storage crate with metal corner brackets\n" +
          "- 'glowing_ore': Luminescent mineral ore block\n" +
          "- 'mossy_stone': Weathered stone with moss overlay\n" +
          "- 'crystal_block': Translucent crystalline block\n" +
          "- 'tech_block': Sci-fi mechanical block with vents\n" +
          "\n--- ITEM TEMPLATES (handheld objects) ---\n" +
          "- 'potion_bottle': Glass flask with cork stopper\n" +
          "- 'magic_wand': Spellcasting wand with crystal tip\n" +
          "- 'ornate_key': Decorative key with gem inlay\n" +
          "- 'gemstone': Faceted precious stone\n" +
          "- 'apple': Red apple with stem and leaf\n" +
          "- 'pickaxe': Mining tool with iron head",
        inputSchema: {
          templateType: z
            .enum([
              "humanoid",
              "small_animal",
              "large_animal",
              "vehicle",
              "block",
              "item",
              "bird",
              "insect",
              "flying",
              "fish",
              "slime",
              "wizard",
              "golem",
              "fox",
              "crystal",
              "enchanted_sword",
              "tropical_fish",
              "ghost",
              "robot",
              "mushroom_creature",
              "treasure_chest",
              "stone_brick",
              "wooden_crate",
              "glowing_ore",
              "mossy_stone",
              "crystal_block",
              "tech_block",
              "potion_bottle",
              "magic_wand",
              "ornate_key",
              "gemstone",
              "apple",
              "pickaxe",
            ])
            .describe("The type of template to return (entity, block, or item)"),
        },
      },
      this._getModelTemplatesOp.bind(this)
    );

    // Define the IBlockVolume schema for structure design tools
    const blockVolumeVector3Schema = z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    });

    const blockTypeDataSchema = z.object({
      typeId: z.string().describe("Block type identifier, e.g., 'minecraft:stone' or 'stone'"),
      properties: z
        .record(z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe("Optional block state properties, e.g., { facing: 'north', half: 'bottom' }"),
    });

    const blockVolumeSchema = z.object({
      entities: z
        .array(
          z.object({
            locationWithinVolume: blockVolumeVector3Schema,
            typeId: z.string(),
          })
        )
        .optional()
        .describe("Entities within the structure (optional)"),
      southWestBottom: blockVolumeVector3Schema.describe(
        "The world position of the south-west-bottom corner of the structure"
      ),
      size: blockVolumeVector3Schema
        .optional()
        .describe(
          "Optional dimensions (x=width, y=height, z=depth). If omitted, size is automatically inferred from the data."
        ),
      blockLayersBottomToTop: z
        .array(z.array(z.string()))
        .describe(
          "2D array of horizontal layers. Outer array is Y layers from BOTTOM to TOP (like stacking floors). Each layer is array of strings for Z rows from NORTH to SOUTH. Each character in string is X from WEST to EAST. Strings do NOT need to be the same length - shorter strings are treated as having trailing air blocks."
        ),
      key: z
        .record(blockTypeDataSchema)
        .describe("Map of single characters to block type definitions. Use ' ' (space) for air."),
    });

    // Register unified designStructure tool - combines preview + export + project integration
    this._registerTool(
      "designStructure",
      {
        title: "Design a structure in a Minecraft project",
        description:
          "Designs a structure (.mcstructure) and saves it to a Minecraft project folder. " +
          "Use this tool for iterative structure design - it handles everything in one step:\n\n" +
          "1. ✅ Validates the block volume design\n" +
          "2. ✅ Creates the .mcstructure file\n" +
          "3. ✅ Saves to the correct project location (behavior_packs/<pack>/structures/)\n" +
          "4. ✅ Persists the design for future iteration (update existing structures)\n" +
          "5. ✅ Returns a preview image\n\n" +
          "**Block Volume Format:**\n" +
          "IBlockVolume represents a volume of blocks using horizontal layers (like stacking floors):\n" +
          "- blockLayersBottomToTop: Array of Y layers from BOTTOM to TOP (ground floor first, roof last)\n" +
          "- Each layer: Array of strings for Z rows from NORTH to SOUTH (back to front)\n" +
          "- Each string character: X position from WEST to EAST (left to right)\n" +
          "- key: Maps characters to block types\n\n" +
          "**Flexible dimensions:**\n" +
          "- 'size' is OPTIONAL - it will be automatically inferred from your data\n" +
          "- Strings do NOT need to be the same length - shorter strings are treated as trailing air\n\n" +
          "**Iteration:** Running this tool again with the same structureId updates the existing file in place.",
        inputSchema: {
          projectPath: z.string().describe("Absolute path to the Minecraft project folder (can be empty folder)"),
          blockVolume: blockVolumeSchema.describe("The block volume design to build"),
          structureId: z
            .string()
            .describe("Unique identifier for the structure (e.g., 'castle_tower', 'dungeon_room')"),
        },
      },
      this._designStructureOp
    );

    // ========================================================================
    // TEXTURE / IMAGE FILE TOOLS
    // ========================================================================

    this._registerTool(
      "writeImageFile",
      {
        title: "Write a texture image from base64 data",
        description:
          "Writes base64-encoded image data to a PNG file. Use this for saving textures generated externally " +
          "or for converting between image formats. The image is returned as a preview after writing.\n\n" +
          "Requires `allowImageFileWritesInDescendentFolders: true` in `.mct/mcp/prefs.json`.",
        inputSchema: {
          filePath: z.string().describe("Absolute path to write the image file (should end in .png)"),
          base64Data: z.string().describe("Base64-encoded image data (PNG, JPEG, or WebP)"),
          mimeType: z
            .string()
            .optional()
            .describe("MIME type of the input image (e.g., 'image/png'). Auto-detected if omitted."),
        },
      },
      this._writeImageFileFromBase64Op
    );

    this._registerTool(
      "writeImageFileFromSvg",
      {
        title: "Create a texture image from SVG markup",
        description:
          "Converts SVG markup to a PNG texture file. Great for creating Minecraft textures with crisp lines, " +
          "geometric patterns, and precise color control. SVG is rendered at the specified dimensions " +
          "(default: native SVG size) and saved as PNG.\n\n" +
          "Requires `allowImageFileWritesInDescendentFolders: true` in `.mct/mcp/prefs.json`.",
        inputSchema: {
          filePath: z.string().describe("Absolute path to write the PNG file"),
          svgContent: z.string().describe("SVG markup string to render as a texture"),
          width: z.number().optional().describe("Output width in pixels (e.g., 16 for a standard Minecraft texture)"),
          height: z.number().optional().describe("Output height in pixels (e.g., 16 for a standard Minecraft texture)"),
        },
      },
      this._writeImageFileFromSvgOp
    );

    this._registerTool(
      "writeImageFileFromPixelArt",
      {
        title: "Create a texture image from ASCII pixel art",
        description:
          "Creates a PNG texture from an ASCII art definition with a color palette. " +
          "Each character in the art maps to a color, and space characters are transparent. " +
          "Perfect for creating Minecraft block textures (16x16), item icons, and entity skins " +
          "with a simple, readable format.\n\n" +
          "Example: lines=['RRR','RGR','RRR'], palette={R:{hex:'#FF0000'},G:{hex:'#00FF00'}}\n\n" +
          "Requires `allowImageFileWritesInDescendentFolders: true` in `.mct/mcp/prefs.json`.",
        inputSchema: {
          filePath: z.string().describe("Absolute path to write the PNG file"),
          lines: z
            .array(z.string())
            .describe(
              "Array of strings forming the pixel art. Each character maps to a palette color. Space = transparent."
            ),
          palette: z
            .record(
              z.string(),
              z.object({
                r: z.number().optional().describe("Red (0-255)"),
                g: z.number().optional().describe("Green (0-255)"),
                b: z.number().optional().describe("Blue (0-255)"),
                a: z.number().optional().describe("Alpha (0-255, default 255)"),
                hex: z.string().optional().describe("Hex color like '#FF0000' (alternative to r/g/b)"),
              })
            )
            .describe("Map of single characters to colors. Do not define space — it is reserved for transparency."),
          scale: z
            .number()
            .optional()
            .describe("Scale factor — each art pixel becomes scale×scale output pixels. Default: 1."),
          backgroundColor: z
            .object({
              r: z.number().optional(),
              g: z.number().optional(),
              b: z.number().optional(),
              a: z.number().optional(),
              hex: z.string().optional(),
            })
            .optional()
            .describe("Background fill color. Default: fully transparent."),
        },
      },
      this._writeImageFileFromPixelArtOp
    );

    // Add a dynamic worldSession resource that returns real session data
    this._server.registerResource(
      "worldSession",
      new ResourceTemplate("worldSession://{name}", { list: undefined }),
      {
        title: "World Session",
        description: "Minecraft world session information including slot, port, and server status",
      },
      async (uri: any, name: any) => {
        const sessionInfo = this._sessions[name as string];
        if (!sessionInfo) {
          return {
            contents: [
              {
                uri: uri.href,
                text: JSON.stringify({ error: `No session named "${name}" found` }),
              },
            ],
          };
        }

        const slot = sessionInfo.slot;
        const port = MinecraftUtilities.getPortForSlot(slot);
        const serverManager = this.ensureServerManager();
        const server = serverManager.getActiveServer(slot);
        const status = server ? DedicatedServerStatus[server.status] : "stopped";

        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify({ name, slot, port, status, description: sessionInfo.description }),
            },
          ],
        };
      }
    );

    // Initialize ToolCommands (used by CLI, UI, etc. but no longer auto-registered as MCP tools)
    if (this._creatorTools) {
      initializeToolCommands();
      await registerNodeOnlyCommands();
    }
  }

  /**
   * Check if a port is available for use.
   * @param port The port number to check
   * @returns Promise that resolves to true if the port is available, false otherwise
   */
  private static isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();

      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          // Other errors also mean we can't use this port
          resolve(false);
        }
      });

      server.once("listening", () => {
        server.close(() => {
          resolve(true);
        });
      });

      server.listen(port, "localhost");
    });
  }

  /**
   * Find an available port by randomly selecting from the configured range.
   * Excludes browser-unsafe ports that would cause ERR_UNSAFE_PORT errors.
   * @returns Promise that resolves to an available port, or a random port if none found after max attempts
   */
  private async findAvailablePort(): Promise<number> {
    // Build array of safe ports in range (excluding browser-unsafe ports)
    const safePorts: number[] = [];
    for (let port = MinecraftMcpServer.PORT_RANGE_START; port <= MinecraftMcpServer.PORT_RANGE_END; port++) {
      if (!UNSAFE_PORTS.has(port)) {
        safePorts.push(port);
      }
    }

    const triedPorts = new Set<number>();

    for (let attempt = 0; attempt < MinecraftMcpServer.PORT_MAX_ATTEMPTS; attempt++) {
      // Pick a random safe port that we haven't tried yet
      let port: number;
      do {
        port = safePorts[Math.floor(Math.random() * safePorts.length)];
      } while (triedPorts.has(port) && triedPorts.size < safePorts.length);

      triedPorts.add(port);

      const available = await MinecraftMcpServer.isPortAvailable(port);
      if (available) {
        Log.verbose(`Found available port: ${port} (attempt ${attempt + 1})`);
        return port;
      }
      Log.verbose(`Port ${port} is in use, trying another random port...`);
    }

    // If no port is available after max attempts, return a random safe one and let the server handle the error
    const fallbackPort = safePorts[Math.floor(Math.random() * safePorts.length)];
    Log.debugAlert(
      `No available ports found after ${MinecraftMcpServer.PORT_MAX_ATTEMPTS} attempts, using ${fallbackPort}`
    );
    return fallbackPort;
  }

  async startStdio(creatorTools: CreatorTools, env: LocalEnvironment, workingFolder?: string) {
    CreatorToolsHost.contentWebRoot = "https://mctools.dev/";

    this._creatorTools = creatorTools;
    this._env = env;

    // Apply project root auto-discovery to the working folder
    if (workingFolder) {
      this._workingFolder = CommandContextFactory.resolveProjectRoot(workingFolder);
    } else {
      this._workingFolder = workingFolder;
    }

    this._creatorTools.onStatusAdded.subscribe(MinecraftMcpServer.handleStatusAdded);

    if (this._workingFolder) {
      Log.verbose(`MCP server working folder: ${this._workingFolder}`);
    }

    // Find an available port for the internal HTTP server
    this._previewServerPort = await this.findAvailablePort();
    Log.verbose(`MCP server will use port ${this._previewServerPort} for internal HTTP server`);

    await this._configureTools();
    this._configurePrompts();

    const transport = new StdioServerTransport();

    // Helper to clean up and exit
    const cleanupAndExit = async () => {
      // Set a force-exit timeout in case cleanup hangs
      const forceExitTimeout = setTimeout(() => {
        Log.verbose("Force exiting after cleanup timeout");
        process.exit(0);
      }, 3000);
      forceExitTimeout.unref(); // Don't let this timer keep the process alive

      await this.cleanup();
      clearTimeout(forceExitTimeout);
      process.exit(0);
    };

    // Set up cleanup on transport close
    transport.onclose = cleanupAndExit;

    // Handle stdin close (client disconnected)
    process.stdin.on("end", cleanupAndExit);
    process.stdin.on("close", cleanupAndExit);

    // Also handle process signals for clean shutdown
    process.once("SIGINT", cleanupAndExit);
    process.once("SIGTERM", cleanupAndExit);

    this._server.connect(transport);
  }

  /**
   * Clean up resources (browser, HTTP server, etc.)
   */
  async cleanup(): Promise<void> {
    // Prevent multiple cleanup calls
    if (this._cleaningUp) {
      return;
    }
    this._cleaningUp = true;

    // Close the HTTP transport if active
    if (this._httpTransport) {
      try {
        await this._httpTransport.close();
      } catch (e) {
        // Ignore close errors
      }
      this._httpTransport = undefined;
    }

    if (this._cachedRenderer) {
      try {
        await this._cachedRenderer.close();
      } catch (e) {
        // Ignore close errors
      }
      this._cachedRenderer = undefined;
    }

    // Clean up the static cached browser in ImageGenerationUtilities
    try {
      await ImageGenerationUtilities.closeCachedBrowser();
    } catch (e) {
      // Ignore close errors
    }

    if (this._serverManager) {
      // Stop the HTTP server to allow the process to exit
      this._serverManager.stopWebServer();
      this._serverManager = undefined;
    }
  }

  static handleStatusAdded(creatorTools: CreatorTools, status: IStatus) {
    let message = status.message;

    if (status.type === StatusType.operationStarted) {
      message = "[[ START: (" + status.operationId + ") " + message;
    } else if (status.type === StatusType.operationEndedComplete) {
      message = "          " + message + " (" + status.operationId + ")  :END ]]";
    } else if (status.type === StatusType.operationEndedErrors) {
      message = "          " + message + " :END - ERRORS (" + status.operationId + ") ]]";
    }

    Log.message(message);
  }

  async startHttp(creatorTools: CreatorTools, env: LocalEnvironment, serverManager?: ServerManager) {
    CreatorToolsHost.contentWebRoot = "https://mctools.dev/";

    this._creatorTools = creatorTools;
    this._env = env;

    // If a ServerManager is provided (e.g., from HttpServer in `mct serve` mode),
    // reuse it so MCP tools operate on the same BDS instance.
    if (serverManager) {
      this._serverManager = serverManager;
    }

    // Subscribe to status events for logging
    this._creatorTools.onStatusAdded.subscribe(MinecraftMcpServer.handleStatusAdded);

    // Find an available port for the internal preview HTTP server
    this._previewServerPort = await this.findAvailablePort();
    Log.verbose(`MCP HTTP server will use port ${this._previewServerPort} for internal preview server`);

    // Register all tools and prompts BEFORE connecting to transport.
    // The MCP SDK forbids registerCapabilities() after connect(), so the order matters.
    await this._configureTools();
    this._configurePrompts();

    // Create a single transport and connect it to the server.
    // The transport handles session management (init, session IDs, SSE) internally.
    // This follows the MCP SDK's recommended pattern for stateful HTTP servers.
    //
    // DNS rebinding protection is disabled here because HttpServer already restricts
    // MCP access to localhost connections. The SDK's allowedHosts does an exact match
    // on the Host header (e.g., "localhost:6126"), which requires knowing the port at
    // transport creation time and listing every host:port variant. Since the HttpServer
    // layer already validates the remote address, this is unnecessary.
    this._httpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    this._httpTransport.onerror = (error: Error) => {
      Log.debug("MCP HTTP transport error: " + error.message);
    };

    await this._server.connect(this._httpTransport);
    Log.verbose("MCP HTTP transport connected and ready for requests");

    // Auto-register the "default" session if a ServerManager was provided and slot 0
    // already has an active server (e.g., `mct serve` started BDS before MCP).
    if (this._serverManager) {
      const server = this._serverManager.getActiveServer(0);
      if (server) {
        this._sessions["default"] = { slot: 0, description: "Auto-registered from serve" };
        Log.verbose(
          `Auto-registered "default" session on slot 0 (port ${MinecraftUtilities.getPortForSlot(0)}, status: ${DedicatedServerStatus[server.status]})`
        );
      }
    }
  }
}
