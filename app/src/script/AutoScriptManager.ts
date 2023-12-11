import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IAutoScriptData from "./../autoscript/IAutoScriptData";
import AutoScript from "./../autoscript/AutoScript";
import StorageUtilities from "../storage/StorageUtilities";

export default class AutoScriptManager {
  private _jsonFile?: IFile;
  private _jsFile?: IFile;
  private _functionFile?: IFile;
  private _isLoaded: boolean;
  private _autoScript?: AutoScript;

  private _autoScriptData?: IAutoScriptData;

  get autoScript() {
    return this._autoScript;
  }

  private _onLoaded = new EventDispatcher<AutoScriptManager, AutoScriptManager>();

  constructor() {
    this._isLoaded = false;
  }

  public get isLoaded() {
    return this._isLoaded;
  }

  public get jsonFile() {
    return this._jsonFile;
  }

  public get onLoaded() {
    return this._onLoaded.asEvent();
  }

  public get name() {
    if (this._autoScriptData === undefined) {
      return "";
    }

    return this._autoScriptData.name;
  }

  public set name(newName: string) {
    if (this._autoScriptData === undefined) {
      return;
    }

    this._autoScriptData.name = newName;
  }

  public set jsonFile(newFile: IFile | undefined) {
    this._jsonFile = newFile;
  }

  public async load() {
    if (this._jsonFile === undefined || this._isLoaded) {
      return;
    }

    await this._jsonFile.loadContent();

    if (this._jsonFile.content === null || this._jsonFile.content instanceof Uint8Array) {
      return;
    }

    this._autoScriptData = StorageUtilities.getJsonObject(this._jsonFile);

    if (this._autoScriptData) {
      this._autoScript = new AutoScript(this._autoScriptData);

      this._autoScript.ensureLoaded();
      this._autoScript.name = StorageUtilities.getBaseFromName(this._jsonFile.name);
    }

    this._isLoaded = true;
    this._onLoaded.dispatch(this, this);
  }

  private ensureJsFile() {
    if (this._jsonFile === undefined || this._jsFile !== undefined) {
      return;
    }

    const newFileName = StorageUtilities.getBaseFromName(this._jsonFile.name) + ".js";

    this._jsFile = this._jsonFile.parentFolder.ensureFile(newFileName);
  }

  private async ensureFunctionFile() {
    if (this._jsonFile === undefined || this._functionFile !== undefined) {
      return;
    }

    const newFileName = StorageUtilities.getBaseFromName(this._jsonFile.name) + ".mcfunction";

    let functionFolder = this._jsonFile.parentFolder;

    if (functionFolder.name === "scripts" && functionFolder.parentFolder) {
      functionFolder = functionFolder.parentFolder.ensureFolder("functions");
    }

    await functionFolder.ensureExists();

    this._functionFile = functionFolder.ensureFile(newFileName);
  }

  async persist() {
    if (this._jsonFile === undefined) {
      return;
    }

    const bpString = JSON.stringify(this._autoScriptData);

    this._jsonFile.setContent(bpString);

    this.ensureJsFile();
    await this.ensureFunctionFile();

    if (this.autoScript && this._jsFile) {
      const jsString = this.autoScript.generateJavaScript();
      this._jsFile.setContent(jsString);
    }

    if (this.autoScript && this._functionFile) {
      const functionContent = await this.autoScript.generateMCFunction();
      this._functionFile.setContent(functionContent);
    }
  }

  static async ensureAutoScriptOnFile(file: IFile, loadHandler?: IEventHandler<AutoScriptManager, AutoScriptManager>) {
    let autos: AutoScriptManager | undefined = undefined;

    if (file.manager === undefined) {
      autos = new AutoScriptManager();

      autos.jsonFile = file;

      file.manager = autos;
    }

    if (file.manager !== undefined && file.manager instanceof AutoScriptManager) {
      autos = file.manager as AutoScriptManager;

      if (!autos.isLoaded && loadHandler) {
        autos.onLoaded.subscribe(loadHandler);
      }

      await autos.load();
    }

    return autos;
  }
}
