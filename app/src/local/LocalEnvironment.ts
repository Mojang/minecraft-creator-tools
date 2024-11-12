// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IFile from "../storage/IFile";
import ILocalEnvironmentData from "./ILocalEnvironmentData";
import LocalUtilities from "./LocalUtilities";
import NodeStorage from "./NodeStorage";
import IFolder from "./../storage/IFolder";
import * as fs from "fs";
import Utilities from "../core/Utilities";
import * as crypto from "crypto";
import { threadId } from "worker_threads";
import Log, { LogItem, LogItemLevel } from "../core/Log";
import JsEslintInfoGenerator from "./JsEslintInfoGenerator";
import GeneratorRegistrations from "../info/GeneratorRegistrations";

export const consoleText_reset = "\x1b[0m";
export const consoleText_bright = "\x1b[1m";
export const consoleText_dim = "\x1b[2m";
export const consoleText_underscore = "\x1b[4m";
export const consoleText_blink = "\x1b[5m";
export const consoleText_reverse = "\x1b[7m";
export const consoleText_hidden = "\x1b[8m";

export const consoleText_fgBlack = "\x1b[30m";
export const consoleText_fgRed = "\x1b[31m";
export const consoleText_fgGreen = "\x1b[32m";
export const consoleText_fgYellow = "\x1b[33m";
export const consoleText_fgBlue = "\x1b[34m";
export const consoleText_fgMagenta = "\x1b[35m";
export const consoleText_fgCyan = "\x1b[36m";
export const consoleText_fgWhite = "\x1b[37m";
export const consoleText_fgGray = "\x1b[90m";

export const consoleText_bgBlack = "\x1b[40m";
export const consoleText_bgRed = "\x1b[41m";
export const consoleText_bgGreen = "\x1b[42m";
export const consoleText_bgYellow = "\x1b[43m";
export const consoleText_bgBlue = "\x1b[44m";
export const consoleText_bgMagenta = "\x1b[45m";
export const consoleText_bgCyan = "\x1b[46m";
export const consoleText_bgWhite = "\x1b[47m";
export const consoleText_bgGray = "\x1b[100m";

export const OperationColors = [consoleText_fgGreen, consoleText_fgCyan, consoleText_fgBlue, consoleText_fgMagenta];

export default class LocalEnvironment {
  #data: ILocalEnvironmentData;
  public utilities: LocalUtilities;
  #isLoaded: boolean = false;
  #prefsStorage: NodeStorage;
  #rootPrefFolder: IFolder;
  #configFile: IFile;
  #worldContainerStorage: NodeStorage;

  #displayInfo: boolean = false;
  #displayVerbose: boolean = false;

  _inmemDisplayReadOnlyPasscode?: string;
  _inmemDisplayReadOnlyPasscodeComplement?: string;

  _inmemFullReadOnlyPasscode?: string;
  _inmemFullReadOnlyPasscodeComplement?: string;

  _inmemUpdateStatePasscode?: string;
  _inmemUpdateStatePasscodeComplement?: string;

  _inmemAdminPasscode?: string;
  _inmemAdminPasscodeComplement?: string;

  public get displayInfo() {
    return this.#displayInfo;
  }

  public set displayInfo(newInfoValue: boolean) {
    this.#displayInfo = newInfoValue;
  }

  public get displayVerbose() {
    return this.#displayVerbose;
  }

  public set displayVerbose(newVerboseValue: boolean) {
    this.#displayVerbose = newVerboseValue;
  }

  public get worldContainerStorage() {
    return this.#worldContainerStorage;
  }

  public get worldContainerPath() {
    return this.#data.worldContainerPath;
  }

  public get serverHostPort() {
    return this.#data.serverHostPort;
  }

  public set serverHostPort(newPort: number | undefined) {
    if (newPort !== this.#data.serverHostPort) {
      this.#data.serverHostPort = newPort;
    }
  }

  public get serverDomainName() {
    return this.#data.serverDomainName;
  }

  public set serverDomainName(newDomainName: string | undefined) {
    if (newDomainName !== this.#data.serverDomainName) {
      this.#data.serverDomainName = newDomainName;
    }
  }

  public get serverTitle() {
    return this.#data.serverTitle;
  }

  public set serverTitle(newTitle: string | undefined) {
    if (newTitle !== this.#data.serverTitle) {
      this.#data.serverTitle = newTitle;
    }
  }

  public get serverMessageOfTheDay() {
    return this.#data.serverMessageOfTheDay;
  }

  public set serverMessageOfTheDay(messageOfTheDay: string | undefined) {
    if (messageOfTheDay !== this.#data.serverMessageOfTheDay) {
      this.#data.serverMessageOfTheDay = messageOfTheDay;
    }
  }

  get displayReadOnlyPasscode() {
    return this._inmemDisplayReadOnlyPasscode; //this.#data.displayReadOnlyPasscode;
  }

  get displayReadOnlyPasscodeComplement() {
    return this._inmemDisplayReadOnlyPasscodeComplement; //this.#data.displayReadOnlyPasscodeComplement;
  }

  set displayReadOnlyPasscode(newPasscode: string | undefined) {
    if (newPasscode === undefined) {
      throw new Error();
    }

    newPasscode = newPasscode.toLowerCase();
    newPasscode = newPasscode.replace("-", "");

    if (newPasscode.length !== 8 || !Utilities.isAlphaNumeric(newPasscode)) {
      throw new Error(
        "Improperly formatted display read-only passcode. Passcodes should be 8 alphanumeric characters."
      );
    }

    this._inmemDisplayReadOnlyPasscode = newPasscode;
    this._inmemDisplayReadOnlyPasscodeComplement = this.generateRandomPasscode();
  }

  get fullReadOnlyPasscode() {
    return this._inmemFullReadOnlyPasscode;
  }

  get fullReadOnlyPasscodeComplement() {
    return this._inmemFullReadOnlyPasscodeComplement;
  }

  set fullReadOnlyPasscode(newPasscode: string | undefined) {
    if (newPasscode === undefined) {
      throw new Error();
    }

    newPasscode = newPasscode.toLowerCase();
    newPasscode = newPasscode.replace("-", "");

    if (newPasscode.length !== 8 || !Utilities.isAlphaNumeric(newPasscode)) {
      throw new Error("Improperly formatted full read-only passcode. Passcodes should be 8 alphanumeric characters.");
    }

    this._inmemFullReadOnlyPasscode = newPasscode;
    this._inmemFullReadOnlyPasscodeComplement = this.generateRandomPasscode();
  }

  get updateStatePasscode() {
    return this._inmemUpdateStatePasscode;
  }

  get updateStatePasscodeComplement() {
    return this._inmemUpdateStatePasscodeComplement;
  }

  set updateStatePasscode(newPasscode: string | undefined) {
    if (newPasscode === undefined) {
      throw new Error();
    }

    newPasscode = newPasscode.toLowerCase();
    newPasscode = newPasscode.replace("-", "");

    if (newPasscode.length !== 8 || !Utilities.isAlphaNumeric(newPasscode)) {
      throw new Error("Improperly formatted update passcode. Passcodes should be 8 alphanumeric characters.");
    }

    this._inmemUpdateStatePasscode = newPasscode;
    this._inmemUpdateStatePasscodeComplement = this.generateRandomPasscode();
  }

  get adminPasscode() {
    return this._inmemAdminPasscode;
  }
  get adminPasscodeComplement() {
    return this._inmemAdminPasscodeComplement;
  }

  set adminPasscode(newPasscode: string | undefined) {
    if (newPasscode === undefined) {
      throw new Error();
    }

    newPasscode = newPasscode.toLowerCase();
    newPasscode = newPasscode.replace("-", "");

    if (newPasscode.length !== 8 || !Utilities.isAlphaNumeric(newPasscode)) {
      throw new Error("Improperly formatted admin passcode. Passcodes should be 8 alphanumeric characters.");
    }

    this._inmemAdminPasscode = newPasscode;
    this._inmemAdminPasscodeComplement = this.generateRandomPasscode();
  }
  get iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashEula() {
    return this.#data.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashEula;
  }

  set iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashEula(
    iAgreeValue: boolean | undefined
  ) {
    this.#data.iAgreeToTheMinecraftEndUserLicenseAgreementAndPrivacyPolicyAtMinecraftDotNetSlashEula = iAgreeValue;
  }

  public constructor(subscribeToLog: boolean) {
    this.#data = {};

    this.load = this.load.bind(this);
    this.save = this.save.bind(this);

    this.utilities = new LocalUtilities();

    GeneratorRegistrations.projectGenerators.push(new JsEslintInfoGenerator());

    this.handleNewLogMessage = this.handleNewLogMessage.bind(this);

    if (subscribeToLog) {
      Log.onItemAdded.subscribe(this.handleNewLogMessage);
    }

    if (!fs.existsSync(this.utilities.serverWorkingPath)) {
      fs.mkdirSync(this.utilities.serverWorkingPath, { recursive: true });
    }

    this.#data.worldContainerPath = this.utilities.worldsWorkingPath;

    if (this.utilities.worldsWorkingPath && !fs.existsSync(this.utilities.worldsWorkingPath)) {
      fs.mkdirSync(this.utilities.worldsWorkingPath, { recursive: true });
    }

    this.#worldContainerStorage = new NodeStorage(this.utilities.worldsWorkingPath, "");

    if (!fs.existsSync(this.utilities.cliWorkingPath)) {
      fs.mkdirSync(this.utilities.cliWorkingPath, { recursive: true });
    }

    if (!fs.existsSync(this.utilities.envPrefsPath)) {
      fs.mkdirSync(this.utilities.envPrefsPath, { recursive: true });
    }

    if (!fs.existsSync(this.utilities.packCachePath)) {
      fs.mkdirSync(this.utilities.packCachePath, { recursive: true });
    }

    this.#prefsStorage = new NodeStorage(this.utilities.envPrefsPath, "");

    this.#rootPrefFolder = this.#prefsStorage.rootFolder;

    this.#configFile = this.#rootPrefFolder.ensureFile("envprefs.json");
  }

  public setWorldContainerPath(newPath: string | undefined) {
    if (newPath !== this.#data.worldContainerPath) {
      this.#data.worldContainerPath = newPath;

      if (newPath) {
        if (!fs.existsSync(newPath)) {
          fs.mkdirSync(newPath, { recursive: true });
        }

        this.#worldContainerStorage = new NodeStorage(newPath, "");
      }
    }
  }

  handleNewLogMessage(log: Log, item: LogItem) {
    if (item.level === LogItemLevel.verbose && !this.displayVerbose) {
      return;
    }

    let context = "";

    if (this.displayVerbose) {
      context = threadId + ": ";
    }

    if (item.context && item.context.length > 0) {
      context = item.context + " ";
    }

    if (item.level === LogItemLevel.verbose) {
      console.log(consoleText_fgGray + context + item.message + consoleText_reset);
    } else if (item.level === LogItemLevel.error) {
      console.error(consoleText_fgRed + context + "Error: " + item.message + consoleText_reset);
    } else if (item.level === LogItemLevel.important) {
      console.warn(consoleText_fgYellow + context + "Important: " + item.message + consoleText_reset);
    } else {
      console.log(context + item.message);
    }
  }

  async load() {
    if (this.#isLoaded) {
      return;
    }

    await this.#configFile.loadContent(false);

    if (
      this.#configFile.content !== null &&
      this.#configFile.content !== undefined &&
      typeof this.#configFile.content === "string"
    ) {
      this.#data = JSON.parse(this.#configFile.content as string);
    }

    this.#isLoaded = true;
  }

  async setDefaults() {
    await this.load();

    if (this.#data.serverDomainName === undefined) {
      this.#data.serverDomainName = "localhost";
    }

    if (this.#data.serverHostPort === undefined) {
      this.#data.serverHostPort = 6126;
    }

    if (
      this._inmemDisplayReadOnlyPasscode === undefined ||
      this._inmemDisplayReadOnlyPasscodeComplement === undefined
    ) {
      this._inmemDisplayReadOnlyPasscode = this.generateRandomPasscode();
    }

    if (this._inmemAdminPasscodeComplement === undefined || this._inmemAdminPasscodeComplement === undefined) {
      this._inmemAdminPasscode = this.generateRandomPasscode();
    }

    if (this._inmemFullReadOnlyPasscode === undefined || this._inmemFullReadOnlyPasscodeComplement === undefined) {
      this.fullReadOnlyPasscode = this.generateRandomPasscode();
    }

    if (this._inmemUpdateStatePasscode === undefined || this._inmemUpdateStatePasscodeComplement === undefined) {
      this.updateStatePasscode = this.generateRandomPasscode();
    }

    await this.save();
  }

  generateRandomPasscode() {
    let newPasscode = "";

    for (let i = 0; i < 8; i++) {
      const rand = crypto.randomInt(34); // don't include 0 and 1 to preclude O/I confusion

      if (rand <= 7) {
        newPasscode += String.fromCharCode(rand + 50);
      } else {
        newPasscode += String.fromCharCode(rand + 89); // 89 + 8 = starts at A range.
      }
    }

    return newPasscode;
  }

  generateRandomTokenPassword() {
    let newPasscode = "";

    for (let i = 0; i < 12; i++) {
      const rand = crypto.randomInt(36);

      if (rand <= 9) {
        newPasscode += String.fromCharCode(rand + 48);
      } else {
        newPasscode += String.fromCharCode(rand + 87); // 87 + 10 = starts at A range.
      }
    }

    return newPasscode;
  }

  async save() {
    this.#configFile.setContent(JSON.stringify(this.#data, null, 2));

    this.#configFile.saveContent();
  }
}
