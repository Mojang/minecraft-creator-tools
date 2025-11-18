import IFile from "../storage/IFile";
import { EventDispatcher, IEventHandler } from "ste-events";
import IActionSetData from "../actions/IActionSetData";
import ActionSet from "../actions/ActionSet";
import StorageUtilities from "../storage/StorageUtilities";
import Project, { FolderContext } from "../app/Project";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import ActionSetScriptGenerator from "./ActionSetScriptGenerator";
import ActionSetCommandGenerator from "./ActionSetCommandGenerator";
import { ProjectItemCreationType, ProjectItemType } from "../app/IProjectItemData";
import ProjectUtilities from "../app/ProjectUtilities";

export default class ActionSetManager {
  private _jsonFile?: IFile;
  private _jsFile?: IFile;
  private _tsFile?: IFile;
  private _functionFile?: IFile;
  private _isLoaded: boolean;
  private _actionSet?: ActionSet;
  private _project: Project;

  private _actionSetData?: IActionSetData;

  get actionSet() {
    return this._actionSet;
  }

  private _onLoaded = new EventDispatcher<ActionSetManager, ActionSetManager>();

  constructor(project: Project, actionSet?: ActionSet) {
    this._isLoaded = false;

    this._actionSet = actionSet;
    this._project = project;
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
    if (this._actionSetData === undefined) {
      return "";
    }

    return this._actionSetData.name;
  }

  public set name(newName: string) {
    if (this._actionSetData === undefined) {
      return;
    }

    this._actionSetData.name = newName;
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

    this._actionSetData = StorageUtilities.getJsonObject(this._jsonFile);

    if (this._actionSetData) {
      this._actionSet = new ActionSet(this._actionSetData);

      this._actionSet.ensureLoaded();
      this._actionSet.name = StorageUtilities.getBaseFromName(this._jsonFile.name);
    }

    this._isLoaded = true;
    this._onLoaded.dispatch(this, this);
  }

  private ensureJsFile() {
    if (this._jsonFile === undefined || this._jsFile !== undefined) {
      return;
    }

    const newFileName = this.getScriptBaseName() + ".js";

    this._jsFile = this._jsonFile.parentFolder.ensureFile(newFileName);
  }

  private getScriptBaseName() {
    let name = "action";

    if (this._jsonFile) {
      name = this._jsonFile.name;
    } else if (this._actionSet && this._actionSet.name) {
      name = this._actionSet.name;
    }

    return MinecraftUtilities.makeNameScriptSafe(StorageUtilities.getBaseFromName(name));
  }

  private async ensureTsFile() {
    if ((this._jsonFile === undefined && this._actionSet === undefined) || this._tsFile !== undefined) {
      return;
    }

    const name = this.getScriptBaseName();

    const genFolder = await this._project.ensureScriptGenFolder();

    const newFileName = name + ".ts";

    this._tsFile = genFolder.ensureFile(newFileName);
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

  async persist(project: Project): Promise<boolean> {
    let didPersist = false;

    if (this._jsonFile) {
      didPersist = this._jsonFile.setObjectContentIfSemanticallyDifferent(this._actionSetData);
    }

    await this.ensureTsFile();
    await this.ensureFunctionFile();

    if (this.actionSet && this._jsFile) {
      this._project.ensureItemFromFile(
        this._jsFile,
        ProjectItemType.js,
        FolderContext.behaviorPack,
        ProjectItemCreationType.generated
      );

      const jsString = ActionSetScriptGenerator.generateScript(this.actionSet, { typeScript: false });
      this._jsFile.setContent(jsString);
    }

    if (this.actionSet && this._tsFile) {
      this._project.ensureItemFromFile(
        this._tsFile,
        ProjectItemType.ts,
        FolderContext.behaviorPack,
        ProjectItemCreationType.generated
      );

      const tsString = ActionSetScriptGenerator.generateScript(this.actionSet, { typeScript: true });
      if (this._tsFile.setContent(tsString)) {
        didPersist = true;
      }

      const baseName = StorageUtilities.getBaseFromName(this._tsFile.name);
      const scriptSafeName = MinecraftUtilities.makeNameScriptSafe(baseName);

      await ProjectUtilities.ensureContentInDefaultScriptFile(
        project,
        "import * as " + scriptSafeName,
        "import * as " + scriptSafeName + ' from "./_gen/' + baseName + '";\n' + scriptSafeName + ".init();\n",
        false
      );
    }

    if (this.actionSet && this._functionFile) {
      const functionContent = ActionSetCommandGenerator.generateMCFunction(this.actionSet);

      if (this._functionFile.setContent(functionContent)) {
        didPersist = true;
      }
    }

    return didPersist;
  }

  static async ensureOnFile(
    file: IFile,
    project: Project,
    loadHandler?: IEventHandler<ActionSetManager, ActionSetManager>
  ) {
    let autos: ActionSetManager | undefined;

    if (file.manager === undefined) {
      autos = new ActionSetManager(project);

      autos.jsonFile = file;

      file.manager = autos;
    }

    if (file.manager !== undefined && file.manager instanceof ActionSetManager) {
      autos = file.manager as ActionSetManager;

      if (!autos.isLoaded) {
        if (loadHandler) {
          autos.onLoaded.subscribe(loadHandler);
        }

        await autos.load();
      }
    }

    return autos;
  }
}
