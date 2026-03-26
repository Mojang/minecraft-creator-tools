import {
  CommandPermissionLevel,
  CommandResult,
  CustomCommand,
  CustomCommandOrigin,
  CustomCommandParamType,
  CustomCommandResult,
  CustomCommandStatus,
  Dimension,
  Player,
  ScriptEventCommandMessageAfterEvent,
  StartupEvent,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import AnchorManager from "./AnchorManager";
import PackStorage from "../files/PackStorage";

import forms_index_init from "../data/forms/forms_index";
import generated_index_init from "../data/generated/generated_index";
import IFolder from "../app/storage/IFolder";
import StorageUtilities from "../app/storage/StorageUtilities";
import IPackInfo from "./IPackInfo";
import ActionSet from "../app/actions/ActionSet";
import EntityQueryOptions from "../app/minecraft/EntityQueryOptions";
import BlockAreaSize from "../app/minecraft/BlockAreaSize";
import { SimulatedPlayer } from "@minecraft/server-gametest";
import { ActionExecutive } from "../action_exec/ActionExecutive";
import MinecraftUtilities from "../app/minecraft/MinecraftUtilities";

const blockTypeCharBias: { [typeId: string]: string } = {
  unloaded: "?",
  air: " ",
  dirt: "d",
  stone: "s",
  grass_block: "g",
  leaves: "*",
  water: "~",
  log2: "O",
  flower_pot: "p",
  oak_log: "O",
  spruce_log: "O",
};

export interface IBlockTypeData {
  typeId: string;
}

export interface IEntityData {
  location: Vector3;
  typeId: string;
}

export interface IBlockVolume {
  southWestBottom: Vector3;
  size: Vector3;
  blockPlanes: string[][];
  key: { [characterReference: string]: IBlockTypeData };
}

export interface ICreatorToolsState {
  players: {
    [playerName: string]: {
      name: string;
      blockPlanesInViewFrontToBack: IBlockVolume;
      entitiesAroundPlayer: IEntityData[];
    };
  };
}

export class CreatorTools {
  private _anchorManager: AnchorManager;
  private _psRoot: IFolder;
  private _packInfo: IPackInfo | undefined;
  private _curItemIndex = 0;

  constructor() {
    this._anchorManager = new AnchorManager();
    this._psRoot = PackStorage.current.rootFolder;
    this.startup = this.startup.bind(this);
    this.init = this.init.bind(this);
    this._handleRunActionSet = this._handleRunActionSet.bind(this);
    this._handleGetState = this._handleGetState.bind(this);
    this._handleEval = this._handleEval.bind(this);
    this._processScriptEvent = this._processScriptEvent.bind(this);
  }

  startup(init: StartupEvent) {
    system.afterEvents.scriptEventReceive.subscribe(this._processScriptEvent);

    const runActionSetCommand: CustomCommand = {
      name: "mct:actionset",
      description: "Runs a set of actions within the world",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "instance" },
        { type: CustomCommandParamType.String, name: "actionSetData" },
      ],
    };
    init.customCommandRegistry.registerCommand(runActionSetCommand, this._handleRunActionSet);

    const getStateCommand: CustomCommand = {
      name: "mct:state",
      description: "Gets the current state of the world",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [{ type: CustomCommandParamType.String, name: "instance" }],
    };
    init.customCommandRegistry.registerCommand(getStateCommand, this._handleGetState);

    // SECURITY NOTE — INTENTIONAL DEVELOPER/DEBUG FEATURE
    // The mct:eval command enables runtime JavaScript evaluation inside the Minecraft
    // scripting context. This exists to support interactive debugging and rapid
    // iteration during add-on development (e.g., inspecting world state, testing
    // API calls without reloading packs). It is NOT intended for production use.
    //
    // Safeguards:
    //   - Restricted to CommandPermissionLevel.GameDirectors (operator-only).
    //   - Requires the "script_eval" capability in the behavior pack manifest,
    //     which the Minecraft engine gates separately.
    //   - This behavior pack (creator_tools_ingame) is a development-time tool
    //     and is not shipped to end-user content.
    const evalCommand: CustomCommand = {
      name: "mct:eval",
      description: "[DEV/DEBUG ONLY] Evaluates JavaScript code in the server scripting context",
      permissionLevel: CommandPermissionLevel.GameDirectors,
      mandatoryParameters: [
        { type: CustomCommandParamType.String, name: "instance" },
        { type: CustomCommandParamType.String, name: "code" },
      ],
    };
    init.customCommandRegistry.registerCommand(evalCommand, this._handleEval);
  }

  _processScriptEvent(data: ScriptEventCommandMessageAfterEvent) {
    if (data.id === "mct:actionset") {
      let firstPipe = data.message.indexOf("|");

      if (firstPipe >= 0) {
        let instanceToken = data.message.substring(0, firstPipe);
        let actionSetData = data.message.substring(firstPipe + 1).trim();

        if (actionSetData.endsWith('"')) {
          actionSetData = actionSetData.substring(0, actionSetData.length - 1);
        }

        if (actionSetData.startsWith('"')) {
          actionSetData = actionSetData.substring(1);
        }

        try {
          actionSetData = actionSetData.replace(/\|/gi, '"');

          const actionSetObj = JSON.parse(actionSetData);

          const actionGroup = new ActionSet(actionSetObj);

          let originLoc: Vector3 | undefined = undefined;
          let originDim: Dimension | undefined = undefined;
          let playerToRunAround: Player | undefined = undefined;

          if (data.sourceEntity && data.sourceEntity instanceof Player) {
            playerToRunAround = data.sourceEntity as Player;
          }

          if (!playerToRunAround) {
            for (const player of world.getAllPlayers()) {
              if (player instanceof SimulatedPlayer) {
                playerToRunAround = player;
                break;
              }
            }
          }

          if (!playerToRunAround) {
            for (const player of world.getAllPlayers()) {
              if (player) {
                playerToRunAround = player;
                break;
              }
            }
          }

          if (playerToRunAround) {
            originLoc = playerToRunAround.location;
            originDim = playerToRunAround.dimension;
          } else {
            originLoc = world.getDefaultSpawnLocation();

            if (originLoc.y > 32000) {
              originLoc.y = 80;
            }
            originDim = world.getDimension("overworld");
          }

          ActionExecutive.run(originLoc, originDim, actionGroup);

          console.log("ras|" + instanceToken + "|" + JSON.stringify(this._getState()));
          return;
        } catch (error) {
          console.log("ras|" + instanceToken + "|Failed to parse action set data - " + (error as Error).message);
          return;
        }
        console.log("ras|" + instanceToken + "|No actions run");
      }
    }
    // mct:eval script event handler (developer/debug only — see _evalCode for details)
    if (data.id === "mct:eval") {
      let firstPipe = data.message.indexOf("|");

      if (firstPipe >= 0) {
        let instanceToken = data.message.substring(0, firstPipe);
        let codeData = data.message.substring(firstPipe + 1).trim();

        // Strip surrounding quotes if present (scriptevent transport may add these)
        if (codeData.endsWith('"')) {
          codeData = codeData.substring(0, codeData.length - 1);
        }
        if (codeData.startsWith('"')) {
          codeData = codeData.substring(1);
        }

        const result = this._evalCode(codeData);
        console.log("evl|" + instanceToken + "|" + result);
        return;
      }
    }
  }

  _getState() {
    let state: ICreatorToolsState = { players: {} };

    for (const player of world.getAllPlayers()) {
      if (player.name) {
        let y = Math.floor(player.location.y);

        // TODO: add more sophisticated checks and handling
        // for surface height -- these checks are very imperfect
        if (!MinecraftUtilities.isAutoSurfaceYUsedBySpawnPoints(y)) {
          y = y - 3;
        } else {
          y = 80;
        }

        let playerVolumeLoc = {
          x: Math.floor(player.location.x) - 3,
          y: y,
          z: Math.floor(player.location.z) - 3,
        };
        state.players[player.name] = {
          name: player.name,
          blockPlanesInViewFrontToBack: this._getBlockVolumeAt(player.dimension, playerVolumeLoc, {
            x: 10,
            y: 4,
            z: 10,
          }),
          entitiesAroundPlayer: this._getEntityStateAt(player.dimension, playerVolumeLoc, { x: 10, y: 4, z: 10 }),
        };
      }
    }

    return state;
  }

  _getEntityStateAt(dimension: Dimension, southWestBottom: Vector3, size: Vector3): IEntityData[] {
    const bas = new BlockAreaSize();
    bas.x = size.x;
    bas.y = size.y;
    bas.z = size.z;

    const eqo: any = {
      excludeTypes: ["minecraft:player"],
      location: southWestBottom,
      volume: bas,
    };

    const entities = dimension.getEntities(eqo);

    let entitiesInVolume: IEntityData[] = [];

    for (const entity of entities) {
      entitiesInVolume.push({
        location: entity.location,
        typeId: entity.typeId,
      });
    }

    return entitiesInVolume;
  }

  _getBlockVolumeAt(dimension: Dimension, southWestBottom: Vector3, size: Vector3): IBlockVolume {
    let charsForHashes: { [hash: string]: string } = {};
    let key: { [characterReference: string]: IBlockTypeData } = {};

    let planes: string[][] = [];

    for (let i = 0; i < size.z; i++) {
      let lines: string[] = [];
      for (let j = size.y; j > 0; j--) {
        let line = "";
        for (let k = 0; k < size.x; k++) {
          const block = dimension.getBlock({
            x: southWestBottom.x + k,
            y: southWestBottom.y + j,
            z: southWestBottom.z + i,
          });

          let stateHash = "unloaded";

          if (block) {
            stateHash = block.typeId.toLowerCase();

            if (stateHash.startsWith("minecraft:")) {
              stateHash = stateHash.substring(10);
            }
          }

          let keyChar = charsForHashes[stateHash];

          if (!keyChar) {
            let startingChar = "a";

            if (blockTypeCharBias[stateHash]) {
              startingChar = blockTypeCharBias[stateHash];
            } else {
              startingChar = stateHash.substring(0, 1);
            }

            while (key[startingChar] !== undefined) {
              startingChar = String.fromCharCode(startingChar.charCodeAt(0) + 1);
            }

            charsForHashes[stateHash] = startingChar;

            key[startingChar] = { typeId: stateHash };
            keyChar = startingChar;
          }

          line += keyChar;
        }

        lines.push(line);
      }
      planes.push(lines);
    }

    return {
      southWestBottom: southWestBottom,
      size: size,
      blockPlanes: planes,
      key: key,
    };
  }

  _handleGetState(origin: CustomCommandOrigin, instance: string): CustomCommandResult {
    const state = this._getState();

    return {
      message: "gs|" + instance + "|" + JSON.stringify(state),
      status: CustomCommandStatus.Success,
    };
  }

  /**
   * DEVELOPER/DEBUG ONLY — Evaluate arbitrary JavaScript code in the server scripting context.
   *
   * This method powers the mct:eval command, which is an intentional developer tool
   * for interactive debugging and rapid iteration during add-on development. It is
   * NOT intended for production or end-user scenarios.
   *
   * Security context:
   *   - Only reachable via GameDirectors-level custom commands or operator script events.
   *   - Requires the "script_eval" manifest capability, which the engine gates.
   *   - Executes in the existing server script sandbox — no privilege escalation beyond
   *     what a behavior pack script already has.
   *
   * Decodes pipe-to-quote transport encoding, then executes using new Function().
   * Returns the result as a string, or an error message prefixed with "Error: ".
   */
  private _evalCode(code: string): string {
    // Reverse the pipe-to-quote encoding used by the transport
    code = code.replace(/\|/gi, '"');

    try {
      const evalFunc = new Function("world", "system", "dimension", code);
      const dimension = world.getDimension("overworld");
      const evalResult = evalFunc(world, system, dimension);
      return evalResult !== undefined ? JSON.stringify(evalResult) : "undefined";
    } catch (error) {
      return "Error: " + (error as Error).message;
    }
  }

  _handleEval(origin: CustomCommandOrigin, instance: string, code: string): CustomCommandResult {
    const result = this._evalCode(code);
    const isError = result.startsWith("Error: ");

    return {
      message: "evl|" + instance + "|" + result,
      status: isError ? CustomCommandStatus.Failure : CustomCommandStatus.Success,
    };
  }

  _handleRunActionSet(origin: CustomCommandOrigin, instance: string, actionSetData: string): CustomCommandResult {
    try {
      actionSetData = actionSetData.replace(/\|/gi, '"');

      const actionSetObj = JSON.parse(actionSetData);

      const actionGroup = new ActionSet(actionSetObj);

      let originLoc: Vector3 | undefined = undefined;
      let originDim: Dimension | undefined = undefined;
      let playerToRunAround: Player | undefined = undefined;

      if (origin.sourceEntity instanceof Player) {
        playerToRunAround = origin.sourceEntity as Player;
      }

      if (!playerToRunAround) {
        for (const player of world.getAllPlayers()) {
          if (player instanceof SimulatedPlayer) {
            playerToRunAround = player;
            break;
          }
        }
      }

      if (!playerToRunAround) {
        for (const player of world.getAllPlayers()) {
          if (player) {
            playerToRunAround = player;
            break;
          }
        }
      }

      if (playerToRunAround) {
        originLoc = playerToRunAround.location;
        originDim = playerToRunAround.dimension;
      } else {
        originLoc = world.getDefaultSpawnLocation();
        originDim = world.getDimension("overworld");
      }

      system.run(() => {
        ActionExecutive.run(originLoc, originDim, actionGroup);
      });

      return {
        message: "ras|" + instance + "|" + JSON.stringify(this._getState()),
        status: CustomCommandStatus.Success,
      };
    } catch (error) {
      return {
        message: "ras|" + instance + "|Failed to parse action set data - " + (error as Error).message,
        status: CustomCommandStatus.Failure,
      };
    }
    return {
      message: "ras|" + instance + "|" + actionSetData,
      status: CustomCommandStatus.Success,
    };
  }

  async init() {
    forms_index_init();
    generated_index_init();

    world.sendMessage("Creator Tools init");

    const packInfoFile = await this._psRoot.getFileFromRelativePath("/generated/pack_info.json");

    if (packInfoFile) {
      await packInfoFile.loadContent();

      if (packInfoFile.content && typeof packInfoFile.content === "string") {
        this._packInfo = StorageUtilities.getJsonObject(packInfoFile);
      }
    }
  }

  showNextItemLocation(player: Player) {
    if (this._packInfo) {
      if (this._packInfo.infoItemsByLocation.length === 0) {
        this._curItemIndex = 0;
        return;
      }

      this._curItemIndex++;

      if (this._curItemIndex >= this._packInfo.infoItemsByLocation.length) {
        this._curItemIndex = 0;
      }

      this._setItemLocation(player);
    }
  }

  showPreviousItemLocation(player: Player) {
    if (this._packInfo) {
      if (this._packInfo.infoItemsByLocation.length === 0) {
        this._curItemIndex = 0;
        return;
      }

      this._curItemIndex--;

      if (this._curItemIndex < 0) {
        this._curItemIndex = this._packInfo.infoItemsByLocation.length - 1;
      }

      this._setItemLocation(player);
    }
  }

  _setItemLocation(player: Player) {
    if (!this._packInfo || this._packInfo.infoItemsByLocation.length === 0) {
      this._curItemIndex = 0;
      return;
    }

    const curItem = this._packInfo.infoItemsByLocation[this._curItemIndex];

    if (curItem.location) {
      player.teleport(
        { x: curItem.location.x + 2, y: curItem.location.y + 2, z: curItem.location.z + 2 },
        {
          facingLocation: curItem.location,
        }
      );
    }
  }
}
