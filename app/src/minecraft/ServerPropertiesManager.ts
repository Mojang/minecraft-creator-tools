// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFolder from "../storage/IFolder";
import { IWorldSettings } from "./IWorldSettings";
import { Difficulty, GameType, PlayerPermissionsLevel } from "./WorldLevelDat";

enum ServerGameMode {
  survival = "survival",
  creative = "creative",
  adventure = "adventure",
}

enum ServerDifficulty {
  peaceful = "peaceful",
  easy = "easy",
  normal = "normal",
  hard = "hard",
}

enum ServerContentLoggingLevel {
  verbose = "verbose",
  error = "error",
  warning = "warning",
  info = "info",
}

enum ServerPermissionLevel {
  member = "member",
  visitor = "visitor",
  operator = "operator",
}

enum ServerAuthoritativeness {
  clientAuth = "client-auth",
  serverAuth = "server-auth",
  serverAuthWithRewind = "server-auth-with-rewind",
}

/**
 * Network transport BDS uses to accept client connections (`transport=` in
 * server.properties). NetherNet is the BDS default from the 1.26.50 line
 * onward, and those releases only accept client connections over NetherNet.
 */
export enum ServerTransport {
  raknet = "raknet",
  nethernet = "nethernet",
}

/**
 * Generates the server.properties file that MCT-managed Bedrock Dedicated
 * Server instances read at startup. Fields are write-intent values: they are
 * not loaded from an existing file (see readPersisted* for that).
 *
 * Key names, allowed values, and defaults follow the server.properties and
 * bedrock_server_how_to.html files that ship with BDS.
 */
export default class ServerPropertiesManager {
  private _serverFolder?: IFolder;

  name: string = "Dedicated Server";
  gameMode: ServerGameMode = ServerGameMode.survival;
  forceGameMode: boolean = false;
  difficulty: ServerDifficulty = ServerDifficulty.easy;
  allowCheats: boolean = true;
  maxPlayers: number = 10;
  onlineMode: boolean = false;
  emitServerTelemetry: boolean = false;
  allowList: boolean = false;
  serverPort: number = 19132;
  /** Ignored by BDS when transport is nethernet (a dual-stack socket is opened on serverPort). */
  serverPortV6: number = 19133;
  transport: ServerTransport = ServerTransport.nethernet;
  /**
   * Optional `server-udp-ports` value, such as "49152-49200" or "19132:32000".
   * Only written when set; BDS ignores it when transport is raknet.
   */
  serverUdpPorts?: string;
  viewDistance: number = 32;
  tickDistance: number = 4;
  playerIdleTimeout: number = 30;
  maxThreads: number = 8;
  levelName: string = "Bedrock level";
  levelSeed: string = "";
  allowInboundScriptDebugging = true;
  allowOutboundScriptDebugging = true;
  defaultPlayerPermissionLevel: ServerPermissionLevel = ServerPermissionLevel.member;
  contentLogLevel: ServerContentLoggingLevel = ServerContentLoggingLevel.verbose;
  contentLogConsoleOutputEnabled = true;
  texturePackRequired: boolean = false;
  contentLogFileEnabled: boolean = true;
  compressionThreshold: number = 1;
  serverAuthoritativeMovement: ServerAuthoritativeness = ServerAuthoritativeness.serverAuth;
  playerMovementScoreThreshold: number = 20;
  playerMovementDistanceThreshold: number = 0.3;
  playerMovementDurationThresholdInMs: number = 500;
  correctPlayerMovement: boolean = true;
  serverAuthoritativeBlockBreaking: boolean = false;

  public get serverFolder() {
    return this._serverFolder;
  }
  public set serverFolder(newFolder: IFolder | undefined) {
    this._serverFolder = newFolder;
  }

  /** @deprecated BDS renamed `white-list` to `allow-list`; use allowList. */
  public get whiteList() {
    return this.allowList;
  }
  public set whiteList(value: boolean) {
    this.allowList = value;
  }

  public applyFromWorldSettings(worldSettings: IWorldSettings) {
    if (worldSettings.playerPermissionLevel) {
      switch (worldSettings.playerPermissionLevel) {
        case PlayerPermissionsLevel.member:
          this.defaultPlayerPermissionLevel = ServerPermissionLevel.member;
          break;
        case PlayerPermissionsLevel.operator:
          this.defaultPlayerPermissionLevel = ServerPermissionLevel.operator;
          break;
      }
    }
    if (worldSettings.difficulty !== undefined) {
      switch (worldSettings.difficulty) {
        case Difficulty.easy:
          this.difficulty = ServerDifficulty.easy;
          break;
        case Difficulty.normal:
          this.difficulty = ServerDifficulty.normal;
          break;
        case Difficulty.peaceful:
          this.difficulty = ServerDifficulty.peaceful;
          break;
        case Difficulty.hard:
          this.difficulty = ServerDifficulty.hard;
          break;
      }
    }

    if (worldSettings.gameType !== undefined) {
      switch (worldSettings.gameType) {
        case GameType.survival:
          this.gameMode = ServerGameMode.survival;
          this.forceGameMode = true;
          break;
        case GameType.creative:
          this.gameMode = ServerGameMode.creative;
          this.forceGameMode = true;
          break;
        case GameType.adventure:
          this.gameMode = ServerGameMode.adventure;
          this.forceGameMode = true;
          break;
      }
    }

    if (worldSettings.onlineMode !== undefined) {
      this.onlineMode = worldSettings.onlineMode;
    }

    if (worldSettings.emitServerTelemetry !== undefined) {
      this.emitServerTelemetry = worldSettings.emitServerTelemetry;
    }
  }

  /**
   * Read the PERSISTED allow-inbound-script-debugging value from
   * server.properties. The in-memory field above only reflects what this
   * manager intends to write - it is never populated from the file - so
   * verifying what BDS will actually read (e.g., a hand-edited value after
   * the last write) must consult the file itself. Returns undefined when the
   * file or the key is absent.
   */
  public async readPersistedAllowInboundScriptDebugging(): Promise<boolean | undefined> {
    return this.readPersistedBoolean("allow-inbound-script-debugging");
  }

  /**
   * Read the PERSISTED allow-outbound-script-debugging value - the setting
   * that gates the outbound `script debugger connect` direction the managed
   * debugger flow uses by default.
   */
  public async readPersistedAllowOutboundScriptDebugging(): Promise<boolean | undefined> {
    return this.readPersistedBoolean("allow-outbound-script-debugging");
  }

  private async readPersistedBoolean(key: string): Promise<boolean | undefined> {
    if (this._serverFolder === undefined) {
      return undefined;
    }

    const file = this._serverFolder.ensureFile("server.properties");

    await file.loadContent(true);

    if (typeof file.content !== "string") {
      return undefined;
    }

    const match = file.content.match(new RegExp(`^[ \\t]*${key}[ \\t]*=[ \\t]*([^\\r\\n]*)`, "m"));

    if (!match) {
      return undefined;
    }

    return match[1].trim().toLowerCase() === "true";
  }

  public async writeFile() {
    if (this._serverFolder === undefined) {
      return;
    }

    const file = this._serverFolder.ensureFile("server.properties");

    await file.loadContent(true);

    const text = file.content as string;

    // backup the server properties file if it's not generated
    if (text && text.indexOf("# Generated") < 0) {
      const now = new Date();

      const fileCopy = this._serverFolder.ensureFile(
        "server.properties." +
          now.getFullYear() +
          "." +
          (now.getMonth() + 1) +
          "." +
          now.getDate() +
          "." +
          now.getHours() +
          "." +
          now.getMinutes() +
          ".cartobackup"
      );
      fileCopy.setContent(text);

      await fileCopy.saveContent();
    }

    file.setContent(this.generateContent());

    file.saveContent();
  }

  /** Builds the server.properties text that writeFile persists. */
  public generateContent(): string {
    const content = [];

    content.push("# Generated by Minecraft Creator Tools");
    content.push("server-name=" + this.name);
    content.push("gamemode=" + this.gameMode);
    content.push("force-gamemode=" + this.forceGameMode);
    content.push("difficulty=" + this.difficulty);
    content.push("allow-cheats=" + this.allowCheats);
    content.push("max-players=" + this.maxPlayers);
    content.push("online-mode=" + this.onlineMode);
    content.push("emit-server-telemetry=" + this.emitServerTelemetry);
    content.push("allow-list=" + this.allowList);
    content.push("server-port=" + this.serverPort);
    content.push("server-portv6=" + this.serverPortV6);
    content.push("transport=" + this.transport);

    const udpPorts = this.serverUdpPorts
      ?.split(/[\r\n]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .join(",");

    if (udpPorts) {
      content.push("server-udp-ports=" + udpPorts);
    }

    content.push("view-distance=" + this.viewDistance);
    content.push("tick-distance=" + this.tickDistance);
    content.push("player-idle-timeout=" + this.playerIdleTimeout);
    content.push("max-threads=" + this.maxThreads);
    content.push("level-name=" + this.levelName);
    content.push("level-seed=" + this.levelSeed);
    content.push("allow-inbound-script-debugging=" + this.allowInboundScriptDebugging);
    content.push("allow-outbound-script-debugging=" + this.allowOutboundScriptDebugging);
    content.push("default-player-permission-level=" + this.defaultPlayerPermissionLevel);
    content.push("texturepack-required=" + this.texturePackRequired);
    content.push("content-log-file-enabled=" + this.contentLogFileEnabled);
    content.push("content-log-console-output=" + this.contentLogConsoleOutputEnabled);
    content.push("content-log-level=" + this.contentLogLevel);
    content.push("compression-threshold=" + this.compressionThreshold);
    content.push("server-authoritative-movement=" + this.serverAuthoritativeMovement);
    content.push("player-movement-score-threshold=" + this.playerMovementScoreThreshold);
    content.push("player-movement-distance-threshold=" + this.playerMovementDistanceThreshold);
    content.push("player-movement-duration-threshold-in-ms=" + this.playerMovementDurationThresholdInMs);
    content.push("correct-player-movement=" + this.correctPlayerMovement);
    content.push("server-authoritative-block-breaking=" + this.serverAuthoritativeBlockBreaking);

    return content.join("\n");
  }
}
