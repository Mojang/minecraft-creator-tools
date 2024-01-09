import { IWorldSettings } from "../minecraft/IWorldSettings";
import ICustomTool from "./ICustomTool";

export enum CartoEditorViewMode {
  itemsOnLeft = 0,
  itemsOnRight = 1,
  itemsOnLeftAndMinecraftToolbox = 2,
  itemsOnRightAndMinecraftToolbox = 3,
  toolboxFocus = 4,
  mainFocus = 5,
  itemsFocus = 6,
  codeLanding = 7,
}

export enum MinecraftTrack {
  main = 0,
  preview = 1,
}

export enum MinecraftFlavor {
  none = 0,
  remote = 1,
  processHostedProxy = 2,
  minecraftGameProxy = 3,
}

// see DedicatedServerCommandHandler to ensure these stay in sync
export enum DedicatedServerMode {
  auto = 0,
  source = 1,
  direct = 2,
}

export enum MinecraftGameConnectionMode {
  localMinecraft = 0,
  localMinecraftPreview = 1,
  remoteMinecraft = 2,
}

export enum WindowState {
  regular = 0,
  minimized = 1,
  maximized = 2,
  docked = 3,
}

export default interface ICartoData {
  successfullyConnectedWebSocketToMinecraft: boolean;
  successfullyConnectedToRemoteMinecraft: boolean;
  successfullyStartedMinecraftServer: boolean;
  processHostedMinecraftTrack?: MinecraftTrack;
  worldSettings?: IWorldSettings;
  autoStartMinecraft: boolean;
  showScreenOnConnect: boolean;
  useEditor?: boolean;
  creator?: string;
  preferredTextSize?: number;
  preferredSuite?: number;
  editorViewMode?: CartoEditorViewMode;
  defaultFunction?: string;
  customTools: ICustomTool[];
  iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashTerms?: boolean;
  autoStartDedicatedServer?: boolean;
  dedicatedServerMode?: DedicatedServerMode;
  dedicatedServerPath?: string;
  dedicatedServerSlotCount?: number;
  lastActiveMinecraftFlavor?: MinecraftFlavor;
  webSocketMode?: MinecraftGameConnectionMode;
  remoteServerUrl?: string;
  remoteServerPort?: number;
  remoteServerPasscode?: string;
  remoteServerAuthToken?: string;
  remoteServerAccessLevel?: RemoteServerAccessLevel;
  windowX?: number;
  windowY?: number;
  collapsedTypes?: number[];
  windowHeight?: number;
  windowWidth?: number;
  windowSlot?: number;
  windowState?: WindowState;
}

export enum RemoteServerAccessLevel {
  none = 0,
  displayReadOnly = 1,
  fullReadOnly = 2,
  updateState = 3,
  admin = 4,
}
