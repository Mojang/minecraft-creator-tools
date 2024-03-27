// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import NbtBinary from "./NbtBinary";
import { NbtTagType } from "./NbtBinaryTag";
import Log from "../core/Log";
import DataUtilities from "../core/DataUtilities";
import IFlatWorldLayerSet from "./IFlatWorldLayerSet";
import { BackupType, IWorldSettings } from "./IWorldSettings";
import { IErrorMessage, IErrorable } from "../core/IErrorable";
import Utilities from "../core/Utilities";

export enum GameType {
  survival = 0,
  creative = 1,
  adventure = 2,
}

export enum Generator {
  old = 0,
  infinite = 1,
  flat = 2,
}

export enum Difficulty {
  peaceful = 0,
  easy = 1,
  normal = 2,
  hard = 3,
}

export enum PlayerPermissionsLevel {
  visitor = 0,
  member = 1,
  operator = 2,
  custom = 3,
}

export const TOPMOST_BLOCK = 32767;
export const DEFAULT_SPAWN_COORD = -2147483648;

export default class WorldLevelDat implements IWorldSettings, IErrorable {
  public nbt: NbtBinary | undefined;

  public levelName?: string;
  public spawnX?: number;
  public spawnY?: number;
  public spawnZ?: number;
  public gameType?: GameType;
  public generator?: Generator;
  public commandsEnabled?: boolean; // same as "are cheats enabled".. or maybe not?
  public commandBlocksEnabled?: boolean;
  public experimentalGameplay?: boolean;
  public betaApisExperiment?: boolean;
  public deferredTechnicalPreviewExperiment?: boolean;
  public dataDrivenItemsExperiment?: boolean;
  public savedWithToggledExperiments?: boolean;
  public experimentsEverUsed?: boolean;
  public cheatsEnabled?: boolean;
  public attackMobs?: boolean;
  public attackPlayers?: boolean;
  public build?: boolean;
  public doorsAndSwitches?: boolean;
  public flySpeed?: number;
  public flying?: boolean;
  public instaBuild?: boolean;
  public invulnerable?: boolean;
  public lightning?: boolean;
  public mayFly?: boolean;
  public mine?: boolean;
  public op?: boolean;
  public openContainers?: boolean;
  public teleport?: boolean;
  public walkSpeed?: number;

  public isCreatedInEditor?: boolean;
  public isExportedFromEditor?: boolean;
  public isRandomSeedAllowed?: boolean;
  public biomeOverride?: string;
  public centerMapsToOrigin?: boolean;
  public confirmedPlatformLockedContent?: boolean;
  public difficulty?: Difficulty;
  public flatWorldLayers?: IFlatWorldLayerSet;
  public forceGameType?: boolean;
  public inventoryVersion?: string;
  public lanBroadcast?: boolean;
  public lanBroadcastIntent?: boolean;
  public lastPlayed?: bigint;
  public limitedWorldOriginX?: number;
  public limitedWorldOriginY?: number;
  public limitedWorldOriginZ?: number;
  public minimumCompatibleClientVersion?: number[];
  public multiplayerGame?: boolean;
  public multiplayerGameIntent?: boolean;
  public netherScale?: number;
  public networkVersion?: number;
  public platform?: number;
  public platformBroadcastIntent?: number;
  public randomSeed?: string;
  public spawnV1Villagers?: boolean;
  public storageVersion?: number;
  public time?: bigint;
  public worldVersion?: number;
  public xblBroadcastIntent?: number;
  public abilities?: any[];
  public baseGameVersion?: string;
  public bonusChestEnabled?: boolean;
  public bonusChestSpawned?: boolean;
  public commandBlockOutput?: boolean;
  public currentTick?: bigint;
  public doDaylightCycle?: boolean;

  public daylightCycle?: number;
  public doEntityDrops?: boolean;
  public doFireTick?: boolean;
  public doImmediateRespawn?: boolean;
  public doInsomnia?: boolean;
  public doMobLoot?: boolean;
  public doMobSpawning?: boolean;
  public doTileDrops?: boolean;
  public doWeatherCycle?: boolean;
  public drowningDamage?: boolean;
  public eduOffer?: number;
  public educationFeaturesEnabled?: boolean;
  public fallDamage?: boolean;
  public fireDamage?: boolean;
  public freezeDamage?: boolean;
  public functionCommandLimit?: number;
  public hasBeenLoadedInCreative?: boolean;
  public hasLockedBehaviorPack?: boolean;
  public hasLockedResourcePack?: boolean;
  public immutableWorld?: boolean;
  public isFromLockedTemplate?: boolean;
  public isFromWorldTemplate?: boolean;
  public isSingleUseWorld?: boolean;
  public isWorldTemplateOptionLocked?: boolean;
  public keepInventory?: boolean;
  public lastOpenedWithVersion?: number[];
  public lightningTime?: number;
  public lightningLevel?: number;
  public limitedWorldDepth?: number;
  public limitedWorldWidth?: number;
  public maxCommandChainLength?: number;
  public mobGriefing?: boolean;
  public naturalRegeneration?: boolean;
  public permissionsLevel?: PlayerPermissionsLevel;
  public playerPermissionsLevel?: PlayerPermissionsLevel;
  public prid?: string;
  public pvp?: boolean;
  public rainLevel?: number;
  public rainTime?: number;
  public randomTickSpeed?: number;
  public requiresCopiedPackRemovalCheck?: boolean;
  public respawnBlocksExplode?: boolean;
  public sendCommandFeedback?: boolean;
  public serverChunkTickRange?: number;
  public showBorderEffect?: boolean;
  public showCoordinates?: boolean;
  public showDeathMessages?: boolean;
  public showTags?: boolean;
  public spawnMobs?: boolean;
  public spawnRadius?: number;
  public startWithMapEnabled?: boolean;
  public texturePacksRequired?: boolean;
  public tntExplodes?: boolean;
  public useMsaGamertagsOnly?: boolean;
  public worldStartCount?: bigint;
  public worldPolicies?: number;

  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];

  context?: string;

  // inert in this class, but added for compatibility w/ IWorldSettings
  backupType?: BackupType;
  useCustomSettings?: boolean;

  createNbt() {
    const nbt = new NbtBinary();

    nbt.context = this.context;

    return nbt;
  }

  private _pushError(message: string, contextIn?: string) {
    this.isInErrorState = true;

    if (this.errorMessages === undefined) {
      this.errorMessages = [];
    }

    Log.error(message + (contextIn ? " " + contextIn : ""));

    this.errorMessages.push({
      message: message,
      context: contextIn,
    });
  }

  loadFromNbtBytes(bytes: Uint8Array, context?: string) {
    this.isInErrorState = false;
    this.errorMessages = undefined;

    const tag = new NbtBinary();

    tag.context = this.context;

    const fileType = DataUtilities.getUnsignedInteger(bytes[0], bytes[1], bytes[2], bytes[3], true);
    const restOfLength = DataUtilities.getUnsignedInteger(bytes[4], bytes[5], bytes[6], bytes[7], true);

    if (fileType < 4 || fileType === 7 || fileType > 10) {
      /* 10 has been recently observed? */
      this._pushError("Unexpected world level dat type (" + fileType + ")", context);
      return;
    }

    // some type 8 maps have restOfLength === bytes.length - 16 (?)
    if (restOfLength !== bytes.length - 8 && restOfLength !== bytes.length - 16) {
      this._pushError("Unexpected world level dat length.", context);
      return;
    }

    tag.fromBinary(bytes, true, false, 8);

    this.nbt = tag;

    this.loadFromNbt(tag);

    Utilities.appendErrors(this, tag, context);
  }

  ensureNbt() {
    if (this.nbt !== undefined) {
      return;
    }

    const tag = new NbtBinary();

    tag.context = this.context;

    tag.ensureRoot();

    this.nbt = tag;
  }

  getBytes() {
    this.ensureNbt();

    if (this.nbt !== undefined) {
      const bytes = this.nbt.toBinary();

      if (bytes !== undefined) {
        const fullBytes = new Uint8Array(bytes.length + 8);

        for (let i = 0; i < bytes.length; i++) {
          fullBytes[i + 8] = bytes[i];
        }

        DataUtilities.writeUnsignedInteger(fullBytes, 0, 10, true);
        DataUtilities.writeUnsignedInteger(fullBytes, 4, bytes.length, true);

        return fullBytes;
      }
    }

    Log.fail("Could not create MC level bytes for updating.");

    return undefined;
  }

  persist() {
    this.ensureNbt();

    if (this.nbt !== undefined) {
      this._saveToNbt(this.nbt);
    }
  }

  ensureDefaults() {
    if (this.biomeOverride === undefined) {
      this.biomeOverride = "";
    }

    if (this.centerMapsToOrigin === undefined) {
      this.centerMapsToOrigin = false;
    }

    if (this.confirmedPlatformLockedContent === undefined) {
      this.confirmedPlatformLockedContent = false;
    }

    if (this.savedWithToggledExperiments === undefined) {
      this.savedWithToggledExperiments = false;
    }

    if (this.experimentsEverUsed === undefined) {
      this.experimentsEverUsed = false;
    }

    if (this.difficulty === undefined) {
      this.difficulty = Difficulty.easy;
    }

    if (this.forceGameType === undefined) {
      this.forceGameType = false;
    }

    if (this.experimentsEverUsed === undefined) {
      this.experimentsEverUsed = false;
    }

    if (this.savedWithToggledExperiments === undefined) {
      this.savedWithToggledExperiments = false;
    }

    if (this.isCreatedInEditor === undefined) {
      this.isCreatedInEditor = false;
    }

    if (this.isExportedFromEditor === undefined) {
      this.isExportedFromEditor = false;
    }

    if (this.flatWorldLayers === undefined) {
      this.flatWorldLayers = {
        biome_id: 1,
        block_layers: [
          { block_name: "minecraft:bedrock", count: 1 },
          { block_name: "minecraft:dirt", count: 2 },
          { block_name: "minecraft:grass", count: 1 },
        ],
        encoding_version: 6,
        structure_options: null,
        world_version: "version.post_1_18",
      };
    }

    if (this.forceGameType === undefined) {
      this.forceGameType = false;
    }

    if (this.gameType === undefined) {
      this.gameType = GameType.creative;
    }

    if (this.generator === undefined) {
      this.generator = Generator.infinite;
    }

    if (this.inventoryVersion === undefined) {
      this.inventoryVersion = "1.20.0";
    }

    if (this.lanBroadcast === undefined) {
      this.lanBroadcast = true;
    }

    if (this.lanBroadcastIntent === undefined) {
      this.lanBroadcastIntent = true;
    }

    if (this.lastPlayed === undefined) {
      const newDate = new Date();

      this.lastPlayed = BigInt(Math.floor(newDate.getTime() / 1000));
    }

    if (this.limitedWorldOriginX === undefined) {
      this.limitedWorldOriginX = 0;
    }

    if (this.limitedWorldOriginY === undefined) {
      this.limitedWorldOriginY = TOPMOST_BLOCK;
    }

    if (this.limitedWorldOriginZ === undefined) {
      this.limitedWorldOriginZ = 0;
    }

    if (this.minimumCompatibleClientVersion === undefined) {
      this.minimumCompatibleClientVersion = [1, 20, 0, 0, 0];
    }

    if (this.multiplayerGame === undefined) {
      this.multiplayerGame = true;
    }

    if (this.multiplayerGameIntent === undefined) {
      this.multiplayerGameIntent = true;
    }

    if (this.netherScale === undefined) {
      this.netherScale = 8;
    }

    if (this.networkVersion === undefined) {
      this.networkVersion = 588;
    }

    if (this.platform === undefined) {
      this.platform = 2;
    }

    if (this.platformBroadcastIntent === undefined) {
      this.platformBroadcastIntent = 2;
    }

    if (this.randomSeed === undefined) {
      this.randomSeed = "3025905974105939481";
    }

    if (this.spawnV1Villagers === undefined) {
      this.spawnV1Villagers = false;
    }

    if (this.spawnX === undefined) {
      this.spawnX = 0;
    }

    if (this.spawnY === undefined) {
      this.spawnY = TOPMOST_BLOCK;
    }

    if (this.spawnZ === undefined) {
      this.spawnZ = 0;
    }

    if (this.storageVersion === undefined) {
      this.storageVersion = 10;
    }

    if (this.time === undefined) {
      this.time = BigInt(1);
    }

    if (this.worldVersion === undefined) {
      this.worldVersion = 1;
    }

    if (this.xblBroadcastIntent === undefined) {
      this.xblBroadcastIntent = 2;
    }

    if (this.baseGameVersion === undefined) {
      this.baseGameVersion = "*";
    }

    if (this.bonusChestEnabled === undefined) {
      this.bonusChestEnabled = false;
    }

    if (this.bonusChestSpawned === undefined) {
      this.bonusChestSpawned = false;
    }

    if (this.commandBlockOutput === undefined) {
      this.commandBlockOutput = true;
    }

    if (this.commandBlocksEnabled === undefined) {
      this.commandBlocksEnabled = true;
    }

    if (this.commandsEnabled === undefined) {
      this.commandsEnabled = true;
    }

    if (this.cheatsEnabled === undefined) {
      this.cheatsEnabled = true;
    }

    if (this.currentTick === undefined) {
      this.currentTick = BigInt(1);
    }

    if (this.doDaylightCycle === undefined) {
      this.doDaylightCycle = true;
    }

    if (this.daylightCycle === undefined) {
      this.daylightCycle = 0;
    }

    if (this.doEntityDrops === undefined) {
      this.doEntityDrops = true;
    }

    if (this.doFireTick === undefined) {
      this.doFireTick = true;
    }

    if (this.doImmediateRespawn === undefined) {
      this.doImmediateRespawn = false;
    }

    if (this.doInsomnia === undefined) {
      this.doInsomnia = true;
    }

    if (this.doMobLoot === undefined) {
      this.doMobLoot = true;
    }

    if (this.doMobSpawning === undefined) {
      this.doMobSpawning = true;
    }

    if (this.doTileDrops === undefined) {
      this.doTileDrops = true;
    }

    if (this.doWeatherCycle === undefined) {
      this.doWeatherCycle = true;
    }

    if (this.drowningDamage === undefined) {
      this.drowningDamage = true;
    }

    if (this.eduOffer === undefined) {
      this.eduOffer = 0;
    }

    if (this.educationFeaturesEnabled === undefined) {
      this.educationFeaturesEnabled = false;
    }

    if (this.fallDamage === undefined) {
      this.fallDamage = true;
    }

    if (this.fireDamage === undefined) {
      this.fireDamage = true;
    }

    if (this.freezeDamage === undefined) {
      this.freezeDamage = true;
    }

    if (this.functionCommandLimit === undefined) {
      this.functionCommandLimit = 10000;
    }

    if (this.hasBeenLoadedInCreative === undefined) {
      this.hasBeenLoadedInCreative = true;
    }

    if (this.hasLockedBehaviorPack === undefined) {
      this.hasLockedBehaviorPack = false;
    }

    if (this.hasLockedResourcePack === undefined) {
      this.hasLockedResourcePack = false;
    }

    if (this.immutableWorld === undefined) {
      this.immutableWorld = false;
    }

    if (this.isFromLockedTemplate === undefined) {
      this.isFromLockedTemplate = false;
    }
    if (this.isRandomSeedAllowed === undefined) {
      this.isRandomSeedAllowed = false;
    }

    if (this.isFromWorldTemplate === undefined) {
      this.isFromWorldTemplate = false;
    }

    if (this.isSingleUseWorld === undefined) {
      this.isSingleUseWorld = false;
    }

    if (this.isWorldTemplateOptionLocked === undefined) {
      this.isWorldTemplateOptionLocked = false;
    }

    if (this.keepInventory === undefined) {
      this.keepInventory = false;
    }

    if (this.lastOpenedWithVersion === undefined) {
      this.lastOpenedWithVersion = [1, 20, 0, 0, 1];
    }

    if (this.lightningTime === undefined) {
      this.lightningTime = 124600;
    }
    if (this.lightningLevel === undefined) {
      this.lightningLevel = 0;
    }

    if (this.limitedWorldDepth === undefined) {
      this.limitedWorldDepth = 16;
    }

    if (this.limitedWorldWidth === undefined) {
      this.limitedWorldWidth = 16;
    }

    if (this.maxCommandChainLength === undefined) {
      this.maxCommandChainLength = 65535;
    }

    if (this.mobGriefing === undefined) {
      this.mobGriefing = true;
    }

    if (this.naturalRegeneration === undefined) {
      this.naturalRegeneration = true;
    }

    if (this.permissionsLevel === undefined) {
      this.permissionsLevel = PlayerPermissionsLevel.visitor;
    }

    if (this.playerPermissionsLevel === undefined) {
      this.playerPermissionsLevel = PlayerPermissionsLevel.member;
    }

    if (this.prid === undefined) {
      this.prid = "";
    }

    if (this.pvp === undefined) {
      this.pvp = true;
    }

    if (this.rainLevel === undefined) {
      this.rainLevel = 0;
    }

    if (this.rainTime === undefined) {
      this.rainTime = 94841;
    }

    if (this.randomTickSpeed === undefined) {
      this.randomTickSpeed = 1;
    }

    if (this.requiresCopiedPackRemovalCheck === undefined) {
      this.requiresCopiedPackRemovalCheck = false;
    }

    if (this.respawnBlocksExplode === undefined) {
      this.respawnBlocksExplode = true;
    }

    if (this.sendCommandFeedback === undefined) {
      this.sendCommandFeedback = true;
    }

    if (this.serverChunkTickRange === undefined) {
      this.serverChunkTickRange = 4;
    }

    if (this.showBorderEffect === undefined) {
      this.showBorderEffect = true;
    }

    if (this.showCoordinates === undefined) {
      this.showCoordinates = false;
    }

    if (this.showDeathMessages === undefined) {
      this.showDeathMessages = true;
    }

    if (this.showTags === undefined) {
      this.showTags = true;
    }

    if (this.spawnMobs === undefined) {
      this.spawnMobs = true;
    }

    if (this.spawnRadius === undefined) {
      this.spawnRadius = 5;
    }

    if (this.startWithMapEnabled === undefined) {
      this.startWithMapEnabled = false;
    }

    if (this.texturePacksRequired === undefined) {
      this.texturePacksRequired = false;
    }

    if (this.tntExplodes === undefined) {
      this.tntExplodes = true;
    }
    if (this.useMsaGamertagsOnly === undefined) {
      this.useMsaGamertagsOnly = false;
    }

    if (this.worldStartCount === undefined) {
      this.worldStartCount = BigInt(4294967294);
    }

    if (this.attackMobs === undefined) {
      this.attackMobs = true;
    }

    if (this.attackPlayers === undefined) {
      this.attackPlayers = true;
    }

    if (this.build === undefined) {
      this.build = true;
    }

    if (this.doorsAndSwitches === undefined) {
      this.doorsAndSwitches = true;
    }

    if (this.flySpeed === undefined) {
      this.flySpeed = 0.5;
    }

    if (this.flying === undefined) {
      this.flying = false;
    }

    if (this.instaBuild === undefined) {
      this.instaBuild = false;
    }

    if (this.invulnerable === undefined) {
      this.invulnerable = false;
    }

    if (this.lightning === undefined) {
      this.lightning = false;
    }

    if (this.mayFly === undefined) {
      this.mayFly = false;
    }

    if (this.mine === undefined) {
      this.mine = true;
    }

    if (this.op === undefined) {
      this.op = false;
    }

    if (this.openContainers === undefined) {
      this.openContainers = true;
    }
    if (this.teleport === undefined) {
      this.teleport = true;
    }

    if (this.walkSpeed === undefined) {
      this.walkSpeed = 0.1;
    }
  }

  applyFromWorldSettings(settings: IWorldSettings) {
    if (settings.generator !== undefined) {
      this.generator = settings.generator;
    }

    if (settings.gameType !== undefined) {
      this.gameType = settings.gameType;
    }

    if (settings.difficulty !== undefined) {
      this.difficulty = settings.difficulty;
    }

    if (settings.commandsEnabled !== undefined) {
      this.commandsEnabled = settings.commandsEnabled;
    }

    if (settings.cheatsEnabled !== undefined) {
      this.cheatsEnabled = settings.cheatsEnabled;
    }

    if (settings.randomSeed !== undefined) {
      this.randomSeed = settings.randomSeed;
    }

    if (settings.name !== undefined) {
      this.levelName = settings.name;
    }

    if (settings.lastPlayed !== undefined) {
      this.lastPlayed = BigInt(settings.lastPlayed);
    }

    if (settings.betaApisExperiment === true) {
      this.betaApisExperiment = settings.betaApisExperiment;
    } else if (settings.betaApisExperiment === false) {
      this.betaApisExperiment = false;
    }

    if (settings.deferredTechnicalPreviewExperiment === true) {
      this.deferredTechnicalPreviewExperiment = settings.deferredTechnicalPreviewExperiment;
    } else if (settings.deferredTechnicalPreviewExperiment === false) {
      this.deferredTechnicalPreviewExperiment = false;
    }
  }

  _saveToNbt(binary: NbtBinary) {
    const root = binary.root;

    if (root == null) {
      return;
    }

    if (this.biomeOverride !== undefined) {
      root.ensureTag("BiomeOverride", NbtTagType.string).value = this.biomeOverride;
    }

    if (this.centerMapsToOrigin !== undefined) {
      root.ensureTag("CenterMapsToOrigin", NbtTagType.byte).value = this.centerMapsToOrigin;
    }

    if (this.confirmedPlatformLockedContent !== undefined) {
      root.ensureTag("ConfirmedPlatformLockedContent", NbtTagType.byte).value = this.confirmedPlatformLockedContent;
    }

    if (this.difficulty !== undefined) {
      root.ensureTag("Difficulty", NbtTagType.int).value = this.difficulty;
    }

    if (this.flatWorldLayers !== undefined) {
      root.ensureTag("FlatWorldLayers", NbtTagType.string).value = JSON.stringify(this.flatWorldLayers).trim();
    }

    if (this.forceGameType !== undefined) {
      root.ensureTag("ForceGameType", NbtTagType.byte).value = this.forceGameType;
    }

    if (this.gameType !== undefined) {
      root.ensureTag("GameType", NbtTagType.int).value = this.gameType;
    }

    if (this.generator !== undefined) {
      root.ensureTag("Generator", NbtTagType.int).value = this.generator;
    }

    if (this.inventoryVersion !== undefined) {
      root.ensureTag("InventoryVersion", NbtTagType.string).value = this.inventoryVersion;
    }

    if (this.lanBroadcast !== undefined) {
      root.ensureTag("LANBroadcast", NbtTagType.byte).value = this.lanBroadcast;
    }

    if (this.lanBroadcastIntent !== undefined) {
      root.ensureTag("LANBroadcastIntent", NbtTagType.byte).value = this.lanBroadcastIntent;
    }

    if (this.lastPlayed !== undefined) {
      root.ensureTag("LastPlayed", NbtTagType.long).value = this.lastPlayed;
    }

    if (this.levelName !== undefined) {
      root.ensureTag("LevelName", NbtTagType.string).value = this.levelName;
    }

    if (this.limitedWorldOriginX !== undefined) {
      root.ensureTag("LimitedWorldOriginX", NbtTagType.int).value = this.limitedWorldOriginX;
    }

    if (this.limitedWorldOriginY !== undefined) {
      root.ensureTag("LimitedWorldOriginY", NbtTagType.int).value = this.limitedWorldOriginY;
    }

    if (this.limitedWorldOriginZ !== undefined) {
      root.ensureTag("LimitedWorldOriginZ", NbtTagType.int).value = this.limitedWorldOriginZ;
    }

    if (this.minimumCompatibleClientVersion && this.minimumCompatibleClientVersion.length > 0) {
      const tag = root.ensureTag("MinimumCompatibleClientVersion", NbtTagType.list);
      tag.setListFromArray(this.minimumCompatibleClientVersion);
    }

    if (this.multiplayerGame !== undefined) {
      root.ensureTag("MultiplayerGame", NbtTagType.byte).value = this.multiplayerGame;
    }

    if (this.multiplayerGameIntent !== undefined) {
      root.ensureTag("MultiplayerGameIntent", NbtTagType.byte).value = this.multiplayerGameIntent;
    }

    if (this.netherScale !== undefined) {
      root.ensureTag("NetherScale", NbtTagType.int).value = this.netherScale;
    }

    if (this.networkVersion !== undefined) {
      root.ensureTag("NetworkVersion", NbtTagType.int).value = this.networkVersion;
    }

    if (this.platform !== undefined) {
      root.ensureTag("Platform", NbtTagType.int).value = this.platform;
    }

    if (this.platformBroadcastIntent !== undefined) {
      root.ensureTag("PlatformBroadcastIntent", NbtTagType.int).value = this.platformBroadcastIntent;
    }

    if (this.randomSeed !== undefined) {
      try {
        const seedBig = BigInt(this.randomSeed);
        root.ensureTag("RandomSeed", NbtTagType.long).value = seedBig;
      } catch (e) {
        Log.debugAlert("Could not set seed: " + this.randomSeed);
      }
    }

    if (this.spawnV1Villagers !== undefined) {
      root.ensureTag("SpawnV1Villagers", NbtTagType.byte).value = this.spawnV1Villagers;
    }

    if (this.spawnX !== undefined) {
      root.ensureTag("SpawnX", NbtTagType.int).value = this.spawnX;
    }

    if (this.spawnY !== undefined) {
      root.ensureTag("SpawnY", NbtTagType.int).value = this.spawnY;
    }

    if (this.spawnZ !== undefined) {
      root.ensureTag("SpawnZ", NbtTagType.int).value = this.spawnZ;
    }

    if (this.storageVersion !== undefined) {
      root.ensureTag("StorageVersion", NbtTagType.int).value = this.storageVersion;
    }

    if (this.time !== undefined) {
      root.ensureTag("Time", NbtTagType.long).value = this.time;
    }

    if (this.worldVersion !== undefined) {
      root.ensureTag("WorldVersion", NbtTagType.int).value = this.worldVersion;
    }

    if (this.xblBroadcastIntent !== undefined) {
      root.ensureTag("XBLBroadcastIntent", NbtTagType.int).value = this.xblBroadcastIntent;
    }
    const abilitiesTag = root.ensureTag("abilities", NbtTagType.compound);

    if (this.attackMobs !== undefined) {
      abilitiesTag.ensureTag("attackmobs", NbtTagType.byte).value = this.attackMobs;
    }

    if (this.attackPlayers !== undefined) {
      abilitiesTag.ensureTag("attackplayers", NbtTagType.byte).value = this.attackPlayers;
    }

    if (this.build !== undefined) {
      abilitiesTag.ensureTag("build", NbtTagType.byte).value = this.build;
    }

    if (this.doorsAndSwitches !== undefined) {
      abilitiesTag.ensureTag("doorsandswitches", NbtTagType.byte).value = this.doorsAndSwitches;
    }

    if (this.flySpeed !== undefined) {
      abilitiesTag.ensureTag("flySpeed", NbtTagType.float).value = this.flySpeed;
    }

    if (this.flying !== undefined) {
      abilitiesTag.ensureTag("flying", NbtTagType.byte).value = this.flying;
    }

    if (this.instaBuild !== undefined) {
      abilitiesTag.ensureTag("instabuild", NbtTagType.byte).value = this.instaBuild;
    }

    if (this.invulnerable !== undefined) {
      abilitiesTag.ensureTag("invulnerable", NbtTagType.byte).value = this.invulnerable;
    }

    if (this.lightning !== undefined) {
      abilitiesTag.ensureTag("lightning", NbtTagType.byte).value = this.lightning;
    }

    if (this.mayFly !== undefined) {
      abilitiesTag.ensureTag("mayfly", NbtTagType.byte).value = this.mayFly;
    }

    if (this.mine !== undefined) {
      abilitiesTag.ensureTag("mine", NbtTagType.byte).value = this.mine;
    }

    if (this.op !== undefined) {
      abilitiesTag.ensureTag("op", NbtTagType.byte).value = this.op;
    }

    if (this.openContainers !== undefined) {
      abilitiesTag.ensureTag("opencontainers", NbtTagType.byte).value = this.openContainers;
    }

    if (this.teleport !== undefined) {
      abilitiesTag.ensureTag("teleport", NbtTagType.byte).value = this.teleport;
    }

    if (this.walkSpeed !== undefined) {
      abilitiesTag.ensureTag("walkSpeed", NbtTagType.float).value = this.walkSpeed;
    }

    if (this.baseGameVersion !== undefined) {
      root.ensureTag("baseGameVersion", NbtTagType.string).value = this.baseGameVersion;
    }

    if (this.bonusChestEnabled !== undefined) {
      root.ensureTag("bonusChestEnabled", NbtTagType.byte).value = this.bonusChestEnabled;
    }

    if (this.bonusChestSpawned !== undefined) {
      root.ensureTag("bonusChestSpawned", NbtTagType.byte).value = this.bonusChestSpawned;
    }

    if (this.cheatsEnabled !== undefined) {
      root.ensureTag("cheatsEnabled", NbtTagType.byte).value = this.cheatsEnabled;
    }

    if (this.commandBlockOutput !== undefined) {
      root.ensureTag("commandblockoutput", NbtTagType.byte).value = this.commandBlockOutput;
    }

    if (this.commandBlocksEnabled !== undefined) {
      root.ensureTag("commandblocksenabled", NbtTagType.byte).value = this.commandBlocksEnabled;
    }

    if (this.commandsEnabled !== undefined) {
      root.ensureTag("commandsEnabled", NbtTagType.byte).value = this.commandsEnabled;
    }

    if (this.currentTick !== undefined) {
      root.ensureTag("currentTick", NbtTagType.long).value = this.currentTick;
    }

    if (this.daylightCycle !== undefined) {
      root.ensureTag("daylightCycle", NbtTagType.int).value = this.daylightCycle;
    }

    if (this.doDaylightCycle !== undefined) {
      root.ensureTag("dodaylightcycle", NbtTagType.byte).value = this.doDaylightCycle;
    }

    if (this.doEntityDrops !== undefined) {
      root.ensureTag("doentitydrops", NbtTagType.byte).value = this.doEntityDrops;
    }

    if (this.doFireTick !== undefined) {
      root.ensureTag("dofiretick", NbtTagType.byte).value = this.doFireTick;
    }

    if (this.doImmediateRespawn !== undefined) {
      root.ensureTag("doimmediaterespawn", NbtTagType.byte).value = this.doImmediateRespawn;
    }

    if (this.doInsomnia !== undefined) {
      root.ensureTag("doinsomnia", NbtTagType.byte).value = this.doInsomnia;
    }

    if (this.doMobLoot !== undefined) {
      root.ensureTag("domobloot", NbtTagType.byte).value = this.doMobLoot;
    }

    if (this.doMobSpawning !== undefined) {
      root.ensureTag("domobspawning", NbtTagType.byte).value = this.doMobSpawning;
    }

    if (this.doTileDrops !== undefined) {
      root.ensureTag("dotiledrops", NbtTagType.byte).value = this.doTileDrops;
    }

    if (this.doWeatherCycle !== undefined) {
      root.ensureTag("doweathercycle", NbtTagType.byte).value = this.doWeatherCycle;
    }

    if (this.drowningDamage !== undefined) {
      root.ensureTag("drowningdamage", NbtTagType.byte).value = this.drowningDamage;
    }

    if (this.eduOffer !== undefined) {
      root.ensureTag("eduOffer", NbtTagType.int).value = this.eduOffer;
    }

    if (this.educationFeaturesEnabled !== undefined) {
      root.ensureTag("educationFeaturesEnabled", NbtTagType.byte).value = this.educationFeaturesEnabled;
    }

    if (
      this.betaApisExperiment ||
      this.dataDrivenItemsExperiment ||
      this.deferredTechnicalPreviewExperiment ||
      this.savedWithToggledExperiments ||
      this.experimentsEverUsed
    ) {
      const experimentsTag = root.ensureTag("experiments", NbtTagType.compound);

      if (this.betaApisExperiment) {
        experimentsTag.ensureTag("gametest", NbtTagType.byte).value = 1;
      } else {
        experimentsTag.removeTag("gametest");
      }

      if (this.dataDrivenItemsExperiment) {
        experimentsTag.ensureTag("data_driven_items", NbtTagType.byte).value = 1;
      } else {
        experimentsTag.removeTag("data_driven_items");
      }

      if (this.deferredTechnicalPreviewExperiment) {
        experimentsTag.ensureTag("deferred_technical_preview", NbtTagType.byte).value = 1;
      } else {
        experimentsTag.removeTag("deferred_technical_preview");
      }

      if (this.savedWithToggledExperiments !== undefined) {
        experimentsTag.ensureTag("saved_with_toggled_experiments", NbtTagType.byte).value =
          this.savedWithToggledExperiments;
      }

      if (this.experimentsEverUsed !== undefined) {
        experimentsTag.ensureTag("experiments_ever_used", NbtTagType.byte).value = this.experimentsEverUsed;
      }
    }

    if (this.fallDamage !== undefined) {
      root.ensureTag("falldamage", NbtTagType.byte).value = this.fallDamage;
    }

    if (this.fireDamage !== undefined) {
      root.ensureTag("firedamage", NbtTagType.byte).value = this.fireDamage;
    }

    if (this.freezeDamage !== undefined) {
      root.ensureTag("freezedamage", NbtTagType.byte).value = this.freezeDamage;
    }

    if (this.functionCommandLimit !== undefined) {
      root.ensureTag("functioncommandlimit", NbtTagType.int).value = this.functionCommandLimit;
    }

    if (this.hasBeenLoadedInCreative !== undefined) {
      root.ensureTag("hasBeenLoadedInCreative", NbtTagType.byte).value = this.hasBeenLoadedInCreative;
    }

    if (this.hasLockedBehaviorPack !== undefined) {
      root.ensureTag("hasLockedBehaviorPack", NbtTagType.byte).value = this.hasLockedBehaviorPack;
    }

    if (this.hasLockedResourcePack !== undefined) {
      root.ensureTag("hasLockedResourcePack", NbtTagType.byte).value = this.hasLockedResourcePack;
    }

    if (this.immutableWorld !== undefined) {
      root.ensureTag("immutableWorld", NbtTagType.byte).value = this.immutableWorld;
    }

    if (this.isCreatedInEditor !== undefined) {
      root.ensureTag("isCreatedInEditor", NbtTagType.byte).value = this.isCreatedInEditor;
    }

    if (this.isExportedFromEditor !== undefined) {
      root.ensureTag("isExportedFromEditor", NbtTagType.byte).value = this.isExportedFromEditor;
    }

    if (this.isFromLockedTemplate !== undefined) {
      root.ensureTag("isFromLockedTemplate", NbtTagType.byte).value = this.isFromLockedTemplate;
    }

    if (this.isFromWorldTemplate !== undefined) {
      root.ensureTag("isFromWorldTemplate", NbtTagType.byte).value = this.isFromWorldTemplate;
    }

    if (this.isRandomSeedAllowed !== undefined) {
      root.ensureTag("isRandomSeedAllowed", NbtTagType.byte).value = this.isRandomSeedAllowed;
    }

    if (this.isSingleUseWorld !== undefined) {
      root.ensureTag("isSingleUseWorld", NbtTagType.byte).value = this.isSingleUseWorld;
    }

    if (this.isWorldTemplateOptionLocked !== undefined) {
      root.ensureTag("isWorldTemplateOptionLocked", NbtTagType.byte).value = this.isWorldTemplateOptionLocked;
    }

    if (this.keepInventory !== undefined) {
      root.ensureTag("keepinventory", NbtTagType.byte).value = this.keepInventory;
    }

    if (this.lastOpenedWithVersion && this.lastOpenedWithVersion.length > 0) {
      const tag = root.ensureTag("lastOpenedWithVersion", NbtTagType.list);
      tag.setListFromArray(this.lastOpenedWithVersion);
    }

    if (this.lightningLevel !== undefined) {
      root.ensureTag("lightningLevel", NbtTagType.float).value = this.lightningLevel;
    }

    if (this.lightningTime !== undefined) {
      root.ensureTag("lightningTime", NbtTagType.int).value = this.lightningTime;
    }

    if (this.limitedWorldDepth !== undefined) {
      root.ensureTag("limitedWorldDepth", NbtTagType.int).value = this.limitedWorldDepth;
    }

    if (this.limitedWorldWidth !== undefined) {
      root.ensureTag("limitedWorldWidth", NbtTagType.int).value = this.limitedWorldWidth;
    }

    if (this.maxCommandChainLength !== undefined) {
      root.ensureTag("maxcommandchainlength", NbtTagType.int).value = this.maxCommandChainLength;
    }

    if (this.mobGriefing !== undefined) {
      root.ensureTag("mobgriefing", NbtTagType.byte).value = this.mobGriefing;
    }

    if (this.naturalRegeneration !== undefined) {
      root.ensureTag("naturalregeneration", NbtTagType.byte).value = this.naturalRegeneration;
    }

    if (this.permissionsLevel !== undefined) {
      root.ensureTag("permissionsLevel", NbtTagType.int).value = this.permissionsLevel;
    }

    if (this.playerPermissionsLevel !== undefined) {
      root.ensureTag("playerPermissionsLevel", NbtTagType.int).value = this.playerPermissionsLevel;
    }
    if (this.prid !== undefined) {
      root.ensureTag("prid", NbtTagType.string).value = this.prid;
    }

    if (this.pvp !== undefined) {
      root.ensureTag("pvp", NbtTagType.byte).value = this.pvp;
    }

    if (this.rainLevel !== undefined) {
      root.ensureTag("rainLevel", NbtTagType.float).value = this.rainLevel;
    }

    if (this.rainTime !== undefined) {
      root.ensureTag("rainTime", NbtTagType.int).value = this.rainTime;
    }

    if (this.randomTickSpeed !== undefined) {
      root.ensureTag("randomtickspeed", NbtTagType.int).value = this.randomTickSpeed;
    }

    if (this.requiresCopiedPackRemovalCheck !== undefined) {
      root.ensureTag("requiresCopiedPackRemovalCheck", NbtTagType.byte).value = this.requiresCopiedPackRemovalCheck;
    }

    if (this.respawnBlocksExplode !== undefined) {
      root.ensureTag("respawnblocksexplode", NbtTagType.byte).value = this.respawnBlocksExplode;
    }

    if (this.sendCommandFeedback !== undefined) {
      root.ensureTag("sendcommandfeedback", NbtTagType.byte).value = this.sendCommandFeedback;
    }

    if (this.serverChunkTickRange !== undefined) {
      root.ensureTag("serverChunkTickRange", NbtTagType.int).value = this.serverChunkTickRange;
    }

    if (this.showBorderEffect !== undefined) {
      root.ensureTag("showbordereffect", NbtTagType.byte).value = this.showBorderEffect;
    }

    if (this.showCoordinates !== undefined) {
      root.ensureTag("showcoordinates", NbtTagType.byte).value = this.showCoordinates;
    }

    if (this.showDeathMessages !== undefined) {
      root.ensureTag("showdeathmessages", NbtTagType.byte).value = this.showDeathMessages;
    }

    if (this.showTags !== undefined) {
      root.ensureTag("showtags", NbtTagType.byte).value = this.showTags;
    }

    if (this.spawnMobs !== undefined) {
      root.ensureTag("spawnMobs", NbtTagType.byte).value = this.spawnMobs;
    }

    if (this.spawnRadius !== undefined) {
      root.ensureTag("spawnradius", NbtTagType.int).value = this.spawnRadius;
    }

    if (this.startWithMapEnabled !== undefined) {
      root.ensureTag("startWithMapEnabled", NbtTagType.byte).value = this.startWithMapEnabled;
    }

    if (this.texturePacksRequired !== undefined) {
      root.ensureTag("texturePacksRequired", NbtTagType.byte).value = this.texturePacksRequired;
    }
    if (this.tntExplodes !== undefined) {
      root.ensureTag("tntexplodes", NbtTagType.byte).value = this.tntExplodes;
    }

    if (this.useMsaGamertagsOnly !== undefined) {
      root.ensureTag("useMsaGamertagsOnly", NbtTagType.byte).value = this.useMsaGamertagsOnly;
    }

    if (this.worldStartCount !== undefined) {
      root.ensureTag("worldStartCount", NbtTagType.long).value = this.worldStartCount;
    }

    // const worldPoliciesTag = root.ensureTag("world_policies", NbtTagType.compound);
  }

  loadFromNbt(binary: NbtBinary) {
    this.nbt = binary;

    if (binary.root == null) {
      return;
    }

    const root = binary.root;

    let tag = root.find("LevelName");

    if (tag !== null) {
      this.levelName = tag.valueAsString;
    }

    tag = root.find("SpawnX");

    if (tag !== null) {
      this.spawnX = tag.valueAsInt;
    }

    tag = root.find("SpawnY");

    if (tag !== null) {
      this.spawnY = tag.valueAsInt;
    }

    tag = root.find("SpawnZ");

    if (tag !== null) {
      this.spawnZ = tag.valueAsInt;
    }

    tag = root.find("GameType");

    if (tag !== null) {
      this.gameType = tag.valueAsInt;
    }

    tag = root.find("Generator");

    if (tag !== null) {
      this.generator = tag.valueAsInt;
    }

    tag = root.find("commandsEnabled");

    if (tag !== null) {
      this.commandsEnabled = tag.valueAsBoolean;
    }

    tag = root.find("cheatsEnabled");

    if (tag !== null) {
      this.cheatsEnabled = tag.valueAsBoolean;
    }

    tag = root.find("commandsblocksenabled");

    if (tag !== null) {
      this.commandBlocksEnabled = tag.valueAsBoolean;
    }

    tag = root.find("experimentalgameplay");

    if (tag !== null) {
      this.experimentalGameplay = tag.valueAsBoolean;
    }

    tag = root.find("BiomeOverride");
    if (tag !== null) {
      this.biomeOverride = tag.valueAsString;
    }

    tag = root.find("CenterMapsToOrigin");
    if (tag !== null) {
      this.centerMapsToOrigin = tag.valueAsBoolean;
    }

    tag = root.find("ConfirmedPlatformLockedComponent");
    if (tag !== null) {
      this.confirmedPlatformLockedContent = tag.valueAsBoolean;
    }

    tag = root.find("Difficulty");
    if (tag !== null) {
      this.difficulty = tag.valueAsInt;
    }

    tag = root.find("FlatWorldLayers");
    if (tag !== null) {
      this.flatWorldLayers = tag.valueAsJSONObject;
    }

    tag = root.find("ForceGameType");
    if (tag !== null) {
      this.forceGameType = tag.valueAsBoolean;
    }

    tag = root.find("InventoryVersion");
    if (tag !== null) {
      this.inventoryVersion = tag.valueAsString;
    }

    tag = root.find("LANBroadcast");
    if (tag !== null) {
      this.lanBroadcast = tag.valueAsBoolean;
    }

    tag = root.find("LANBroadcastIntent");
    if (tag !== null) {
      this.lanBroadcastIntent = tag.valueAsBoolean;
    }

    tag = root.find("LastPlayed");
    if (tag !== null) {
      this.lastPlayed = tag.valueAsBigInt;
    }

    tag = root.find("LimitedWorldOriginX");
    if (tag !== null) {
      this.limitedWorldOriginX = tag.valueAsInt;
    }
    tag = root.find("LimitedWorldOriginY");
    if (tag !== null) {
      this.limitedWorldOriginY = tag.valueAsInt;
    }

    tag = root.find("LimitedWorldOriginZ");
    if (tag !== null) {
      this.limitedWorldOriginZ = tag.valueAsInt;
    }

    tag = root.find("MinimumCompatibleClientVersion");
    if (tag !== null) {
      this.minimumCompatibleClientVersion = tag.valueAsNumericArray;
    }

    tag = root.find("lastOpenedWithVersion");
    if (tag !== null) {
      this.lastOpenedWithVersion = tag.valueAsNumericArray;
    }

    tag = root.find("MultiplayerGame");
    if (tag !== null) {
      this.multiplayerGame = tag.valueAsBoolean;
    }

    tag = root.find("MultiplayerGameIntent");
    if (tag !== null) {
      this.multiplayerGameIntent = tag.valueAsBoolean;
    }

    tag = root.find("NetherScale");
    if (tag !== null) {
      this.netherScale = tag.valueAsInt;
    }

    tag = root.find("NetworkVersion");
    if (tag !== null) {
      this.networkVersion = tag.valueAsInt;
    }

    tag = root.find("Platform");
    if (tag !== null) {
      this.platform = tag.valueAsInt;
    }

    tag = root.find("PlatformBroadcastIntent");
    if (tag !== null) {
      this.platformBroadcastIntent = tag.valueAsInt;
    }

    tag = root.find("RandomSeed");
    if (tag !== null) {
      this.randomSeed = tag.valueAsBigInt.toString();
    }

    tag = root.find("SpawnV1Villagers");
    if (tag !== null) {
      this.spawnV1Villagers = tag.valueAsBoolean;
    }

    tag = root.find("StorageVersion");
    if (tag !== null) {
      this.storageVersion = tag.valueAsInt;
    }

    tag = root.find("Time");
    if (tag !== null) {
      this.time = tag.valueAsBigInt;
    }

    tag = root.find("WorldVersion");
    if (tag !== null) {
      this.worldVersion = tag.valueAsInt;
    }

    tag = root.find("XBLBroadcastIntent");
    if (tag !== null) {
      this.xblBroadcastIntent = tag.valueAsInt;
    }

    tag = root.find("baseGameVersion");
    if (tag !== null) {
      this.baseGameVersion = tag.valueAsString;
    }

    tag = root.find("bonusChestEnabled");
    if (tag !== null) {
      this.bonusChestEnabled = tag.valueAsBoolean;
    }

    tag = root.find("bonusChestSpawned");
    if (tag !== null) {
      this.bonusChestSpawned = tag.valueAsBoolean;
    }

    tag = root.find("commandblockoutput");
    if (tag !== null) {
      this.commandBlockOutput = tag.valueAsBoolean;
    }

    tag = root.find("MultiplayerGame");
    if (tag !== null) {
      this.multiplayerGame = tag.valueAsBoolean;
    }

    tag = root.find("currentTick");
    if (tag !== null) {
      this.currentTick = tag.valueAsBigInt;
    }

    tag = root.find("dodaylightcycle");
    if (tag !== null) {
      this.doDaylightCycle = tag.valueAsBoolean;
    }

    tag = root.find("daylightCycle");
    if (tag !== null) {
      this.daylightCycle = tag.valueAsInt;
    }

    tag = root.find("doentitydrops");
    if (tag !== null) {
      this.doEntityDrops = tag.valueAsBoolean;
    }

    tag = root.find("dofiretick");
    if (tag !== null) {
      this.doFireTick = tag.valueAsBoolean;
    }

    tag = root.find("doimmediaterespawn");
    if (tag !== null) {
      this.doImmediateRespawn = tag.valueAsBoolean;
    }

    tag = root.find("doinsomnia");
    if (tag !== null) {
      this.doInsomnia = tag.valueAsBoolean;
    }

    tag = root.find("domobloot");
    if (tag !== null) {
      this.doMobLoot = tag.valueAsBoolean;
    }

    tag = root.find("domobspawning");
    if (tag !== null) {
      this.doMobSpawning = tag.valueAsBoolean;
    }

    tag = root.find("dotiledrops");
    if (tag !== null) {
      this.doTileDrops = tag.valueAsBoolean;
    }

    tag = root.find("doweathercycle");
    if (tag !== null) {
      this.doWeatherCycle = tag.valueAsBoolean;
    }

    tag = root.find("drowningdamage");
    if (tag !== null) {
      this.drowningDamage = tag.valueAsBoolean;
    }

    tag = root.find("eduOffer");
    if (tag !== null) {
      this.eduOffer = tag.valueAsInt;
    }

    tag = root.find("educationFeaturesEnabled");
    if (tag !== null) {
      this.educationFeaturesEnabled = tag.valueAsBoolean;
    }

    tag = root.find("falldamage");
    if (tag !== null) {
      this.fallDamage = tag.valueAsBoolean;
    }

    tag = root.find("freezedamage");
    if (tag !== null) {
      this.freezeDamage = tag.valueAsBoolean;
    }

    tag = root.find("functioncommandlimit");
    if (tag !== null) {
      this.functionCommandLimit = tag.valueAsInt;
    }

    tag = root.find("hasBeenLoadedInCreative");
    if (tag !== null) {
      this.hasBeenLoadedInCreative = tag.valueAsBoolean;
    }

    tag = root.find("hasLockedBehaviorPack");
    if (tag !== null) {
      this.hasLockedBehaviorPack = tag.valueAsBoolean;
    }

    tag = root.find("hasLockedResourcePack");
    if (tag !== null) {
      this.hasLockedResourcePack = tag.valueAsBoolean;
    }

    tag = root.find("immutableWorld");
    if (tag !== null) {
      this.immutableWorld = tag.valueAsBoolean;
    }

    tag = root.find("isFromLockedTemplate");
    if (tag !== null) {
      this.isFromLockedTemplate = tag.valueAsBoolean;
    }

    tag = root.find("isRandomSeedAllowed");
    if (tag !== null) {
      this.isRandomSeedAllowed = tag.valueAsBoolean;
    }

    tag = root.find("isCreatedInEditor");
    if (tag !== null) {
      this.isCreatedInEditor = tag.valueAsBoolean;
    }

    tag = root.find("isExportedFromEditor");
    if (tag !== null) {
      this.isExportedFromEditor = tag.valueAsBoolean;
    }

    tag = root.find("isFromWorldTemplate");
    if (tag !== null) {
      this.isFromWorldTemplate = tag.valueAsBoolean;
    }

    tag = root.find("isSingleUseWorld");
    if (tag !== null) {
      this.isSingleUseWorld = tag.valueAsBoolean;
    }

    tag = root.find("isWorldTemplateOptionLocked");
    if (tag !== null) {
      this.isWorldTemplateOptionLocked = tag.valueAsBoolean;
    }

    tag = root.find("keepinventory");
    if (tag !== null) {
      this.keepInventory = tag.valueAsBoolean;
    }

    tag = root.find("lightningTime");
    if (tag !== null) {
      this.lightningTime = tag.valueAsInt;
    }

    tag = root.find("lightningLevel");
    if (tag !== null) {
      this.lightningLevel = tag.valueAsFloat;
    }

    tag = root.find("limitedWorldDepth");
    if (tag !== null) {
      this.limitedWorldDepth = tag.valueAsInt;
    }

    tag = root.find("limitedWorldWidth");
    if (tag !== null) {
      this.limitedWorldWidth = tag.valueAsInt;
    }

    tag = root.find("maxcommandchainlength");
    if (tag !== null) {
      this.maxCommandChainLength = tag.valueAsInt;
    }

    tag = root.find("mobgriefing");
    if (tag !== null) {
      this.mobGriefing = tag.valueAsBoolean;
    }

    tag = root.find("naturalregeneration");
    if (tag !== null) {
      this.naturalRegeneration = tag.valueAsBoolean;
    }

    tag = root.find("permissionsLevel");
    if (tag !== null) {
      this.permissionsLevel = tag.valueAsInt;
    }

    tag = root.find("playerPermissionsLevel");
    if (tag !== null) {
      this.playerPermissionsLevel = tag.valueAsInt;
    }

    tag = root.find("prid");
    if (tag !== null) {
      this.prid = tag.valueAsString;
    }

    tag = root.find("pvp");
    if (tag !== null) {
      this.pvp = tag.valueAsBoolean;
    }

    tag = root.find("rainLevel");
    if (tag !== null) {
      this.rainLevel = tag.valueAsFloat;
    }

    tag = root.find("rainTime");
    if (tag !== null) {
      this.rainTime = tag.valueAsInt;
    }

    tag = root.find("randomtickspeed");
    if (tag !== null) {
      this.randomTickSpeed = tag.valueAsInt;
    }

    tag = root.find("requiresCopiedPackRemovalCheck");
    if (tag !== null) {
      this.requiresCopiedPackRemovalCheck = tag.valueAsBoolean;
    }

    tag = root.find("respawnblocksexplode");
    if (tag !== null) {
      this.respawnBlocksExplode = tag.valueAsBoolean;
    }

    tag = root.find("sendcommandfeedback");
    if (tag !== null) {
      this.sendCommandFeedback = tag.valueAsBoolean;
    }

    tag = root.find("serverChunkTickRange");
    if (tag !== null) {
      this.serverChunkTickRange = tag.valueAsInt;
    }

    tag = root.find("showbordereffect");
    if (tag !== null) {
      this.showBorderEffect = tag.valueAsBoolean;
    }

    tag = root.find("showcoordinates");
    if (tag !== null) {
      this.showCoordinates = tag.valueAsBoolean;
    }

    tag = root.find("showdeathmessages");
    if (tag !== null) {
      this.showDeathMessages = tag.valueAsBoolean;
    }

    tag = root.find("showtags");
    if (tag !== null) {
      this.showTags = tag.valueAsBoolean;
    }

    tag = root.find("spawnMobs");
    if (tag !== null) {
      this.spawnMobs = tag.valueAsBoolean;
    }

    tag = root.find("spawnradius");
    if (tag !== null) {
      this.spawnRadius = tag.valueAsInt;
    }

    tag = root.find("startWithMapEnabled");
    if (tag !== null) {
      this.startWithMapEnabled = tag.valueAsBoolean;
    }

    tag = root.find("texturePacksRequired");
    if (tag !== null) {
      this.texturePacksRequired = tag.valueAsBoolean;
    }

    tag = root.find("tntexplodes");
    if (tag !== null) {
      this.tntExplodes = tag.valueAsBoolean;
    }

    tag = root.find("useMsaGamertagsOnly");
    if (tag !== null) {
      this.useMsaGamertagsOnly = tag.valueAsBoolean;
    }

    tag = root.find("worldStartCount");
    if (tag !== null) {
      this.worldStartCount = tag.valueAsBigInt;
    }

    tag = root.find("abilities");

    if (tag !== null) {
      const attackMobs = tag.find("attackmobs");

      if (attackMobs) {
        this.attackMobs = attackMobs.valueAsBoolean;
      }

      const attackPlayers = tag.find("attackplayers");

      if (attackPlayers) {
        this.attackPlayers = attackPlayers.valueAsBoolean;
      }
      const build = tag.find("build");

      if (build) {
        this.build = build.valueAsBoolean;
      }

      const doorsAndSwitches = tag.find("doorsandswitches");

      if (doorsAndSwitches) {
        this.doorsAndSwitches = doorsAndSwitches.valueAsBoolean;
      }

      const flySpeed = tag.find("flySpeed");

      if (flySpeed) {
        this.flySpeed = flySpeed.valueAsFloat;
      }

      const flying = tag.find("flying");

      if (flying) {
        this.flying = flying.valueAsBoolean;
      }

      const instabuild = tag.find("instabuild");

      if (instabuild) {
        this.instaBuild = instabuild.valueAsBoolean;
      }

      const invulnerable = tag.find("invulnerable");

      if (invulnerable) {
        this.invulnerable = invulnerable.valueAsBoolean;
      }

      const lightning = tag.find("lightning");

      if (lightning) {
        this.lightning = lightning.valueAsBoolean;
      }

      const mayFly = tag.find("mayfly");

      if (mayFly) {
        this.mayFly = mayFly.valueAsBoolean;
      }

      const mine = tag.find("mine");

      if (mine) {
        this.mine = mine.valueAsBoolean;
      }

      const op = tag.find("op");

      if (op) {
        this.op = op.valueAsBoolean;
      }

      const openContainers = tag.find("opencontainers");

      if (openContainers) {
        this.openContainers = openContainers.valueAsBoolean;
      }

      const teleport = tag.find("teleport");

      if (teleport) {
        this.teleport = teleport.valueAsBoolean;
      }

      const walkSpeed = tag.find("walkSpeed");

      if (walkSpeed) {
        this.walkSpeed = walkSpeed.valueAsFloat;
      }
    }

    tag = root.find("experiments");
    this.betaApisExperiment = undefined;
    this.dataDrivenItemsExperiment = undefined;

    if (tag !== null) {
      const gameTest = tag.find("gametest");

      if (gameTest !== null && gameTest.valueAsInt === 1) {
        this.betaApisExperiment = true;
      } else {
        this.betaApisExperiment = false;
      }

      const ddi = tag.find("data_driven_items");

      if (ddi !== null && ddi.valueAsInt === 1) {
        this.dataDrivenItemsExperiment = true;
      } else {
        this.dataDrivenItemsExperiment = false;
      }

      const eeu = tag.find("experiments_ever_used");

      if (eeu !== null) {
        this.experimentsEverUsed = eeu.valueAsBoolean;
      } else {
        this.experimentsEverUsed = false;
      }

      const swtoggex = tag.find("saved_with_toggled_experiments");

      if (swtoggex !== null) {
        this.savedWithToggledExperiments = swtoggex.valueAsBoolean;
      } else {
        this.savedWithToggledExperiments = false;
      }
    }
  }
}
