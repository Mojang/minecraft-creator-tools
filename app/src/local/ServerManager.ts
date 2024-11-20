import { EventDispatcher } from "ste-events";
import LocalUtilities from "./LocalUtilities";
import * as fs from "fs";
import NodeStorage from "./NodeStorage";
import LocalEnvironment from "./LocalEnvironment";
import axios from "axios";
import ZipStorage from "../storage/ZipStorage";
import IMainInfoVersions from "../minecraft/IMainInfoVersions";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import Carto from "../app/Carto";
import HttpServer from "./HttpServer";
import { DedicatedServerMode, MinecraftTrack } from "../app/ICartoData";
import { IMinecraftStartMessage } from "../app/IMinecraftStartMessage";
import { FileListings } from "./NodeFolder";
import Database from "../minecraft/Database";

export enum ServerManagerFeatures {
  all = 0,
  allWebServices = 1,
  basicWebServices = 2,
}

export default class ServerManager {
  #usePreview: boolean | undefined;
  #httpServer: HttpServer | undefined;

  #carto: Carto;

  #utilities: LocalUtilities;
  #env: LocalEnvironment;

  dataStorage: NodeStorage;

  runOnce: boolean | undefined;

  maxServerIndex: number = 0;

  #features: ServerManagerFeatures = ServerManagerFeatures.all;
  #isPrepared: boolean = false;

  primaryServerPort = 19132;

  backupWorldFileListings: FileListings = {};

  #onShutdown = new EventDispatcher<ServerManager, string>();

  public get isAnyServerRunning() {
    return false;
  }

  public get carto() {
    return this.#carto;
  }

  public get features() {
    return this.#features;
  }

  public set features(featuresIn: ServerManagerFeatures) {
    this.#features = featuresIn;
  }

  public get onShutdown() {
    return this.#onShutdown.asEvent();
  }

  get usePreview() {
    return this.#usePreview;
  }

  set usePreview(newUsePreview: boolean | undefined) {
    this.#usePreview = newUsePreview;
  }

  constructor(env: LocalEnvironment, carto: Carto) {
    this.#utilities = env.utilities;
    this.#env = env;
    this.#carto = carto;

    this.dataStorage = new NodeStorage(this.getRootPath() + "data/", "");
  }

  public stopWebServer() {
    if (this.#httpServer) {
      this.#httpServer.stop();
    }
  }

  public async shutdown(message: string) {
    this.stopWebServer();

    if (this.#onShutdown) {
      this.#onShutdown.dispatch(this, message);
    }
  }

  public ensureHttpServer() {
    if (!this.#httpServer) {
      this.#httpServer = new HttpServer(this.#env, this);
      this.#httpServer.carto = this.#carto;
      this.#httpServer.init();
    }

    return this.#httpServer;
  }

  public get environment() {
    return this.#env;
  }

  getRootPath() {
    let fullPath = __dirname;

    const lastSlash = Math.max(
      fullPath.lastIndexOf("\\", fullPath.length - 2),
      fullPath.lastIndexOf("/", fullPath.length - 2)
    );

    if (lastSlash >= 0) {
      fullPath = fullPath.substring(0, lastSlash + 1);
    }

    return fullPath;
  }

  get effectiveIsUsingPreview() {
    return this.#usePreview || (this.#carto && this.#carto.track === MinecraftTrack.preview);
  }

  replaceVersion(versionString: string, stub: string) {
    if (versionString.endsWith(stub)) {
      return undefined;
    }

    const lastPeriod = versionString.lastIndexOf(".");

    if (lastPeriod >= 0) {
      versionString = versionString.substring(0, lastPeriod - 1) + stub;
      return versionString;
    }

    return undefined;
  }

  async prepare(force?: boolean) {
    if (!force && this.#isPrepared) {
      return;
    }

    this.#isPrepared = true;
  }

  getBasePortForSlot(slotNumber?: number) {
    if (!slotNumber) {
      slotNumber = 0;
    }

    // assume if slotNumber > 79 they actually are suggesting a base port number
    if (slotNumber > 79) {
      return slotNumber;
    }

    // default minecraft base port = 19132, which is slot 0.
    return 19132 + slotNumber * 64;
  }

  getHashFromStartInfo(startInfo?: IMinecraftStartMessage) {
    if (!startInfo) {
      return undefined;
    }

    let hash = "";

    if (startInfo.track) {
      hash += startInfo.track?.toString();
    }

    hash += ".";

    if (startInfo.mode) {
      hash += startInfo.mode;
    }
    hash += ".";

    if (startInfo.projectKey) {
      hash += startInfo.projectKey;
    }

    hash += ".";

    if (startInfo.worldSettings) {
      hash += JSON.stringify(startInfo.worldSettings);
    }

    return hash;
  }

  register() {}
}
