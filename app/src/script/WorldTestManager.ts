import IFile from "../storage/IFile";
import Log from "../core/Log";
import { EventDispatcher, IEventHandler } from "ste-events";
import IWorldTestDefinition from "../worldtest/IWorldTestDefinition";
import WorldTest from "./../worldtest/WorldTest";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "./../app/Project";
import Structure from "../minecraft/Structure";
import BlockCube from "../minecraft/BlockCube";
import BlockLocation from "../minecraft/BlockLocation";
import Utilities from "../core/Utilities";

export default class WorldTestManager {
  private _jsonFile?: IFile;
  private _jsFile?: IFile;
  private _functionFile?: IFile;
  private _structureFile?: IFile;
  private _isLoaded: boolean;
  private _worldTest?: WorldTest;
  private _worldTestData?: IWorldTestDefinition;

  get worldTest() {
    return this._worldTest;
  }

  private _onLoaded = new EventDispatcher<WorldTestManager, WorldTestManager>();

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
    if (this._worldTestData === undefined) {
      return "";
    }

    return this._worldTestData.name;
  }

  public set name(newName: string) {
    if (this._worldTestData === undefined) {
      return;
    }

    this._worldTestData.name = newName;
  }

  public set jsonFile(newFile: IFile | undefined) {
    this._jsonFile = newFile;
  }

  public async load() {
    if (this._jsonFile === undefined || this._isLoaded) {
      return;
    }

    await this._jsonFile.loadContent();

    if (!this._jsonFile.content || this._jsonFile.content instanceof Uint8Array) {
      return;
    }

    try {
      const data: any = JSON.parse(this._jsonFile.content);

      this._worldTestData = data;

      if (data) {
        this._worldTest = new WorldTest(data);

        this._worldTest.ensureLoaded();
        this._worldTest.name = StorageUtilities.getBaseFromName(this._jsonFile.name);
      }
    } catch (e) {
      Log.fail("Could not parse world test JSON " + e);
    }

    this._isLoaded = true;
    this._onLoaded.dispatch(this, this);
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
    if (this._jsonFile === undefined || this._worldTest === undefined) {
      return;
    }

    const bpString = JSON.stringify(this._worldTest.data, null, 2);

    this._jsonFile.setContent(bpString);

    this.ensureFunctionFile();
  }

  async persistSideFiles(project: Project) {
    if (!project.defaultBehaviorPackFolder || this._jsonFile === undefined) {
      Log.unexpectedUndefined("WTM");
      return;
    }

    if (this._jsFile === undefined) {
      const scriptsFolder = project.defaultBehaviorPackFolder.ensureFolder("scripts");

      await scriptsFolder.ensureExists();

      const newFileName = StorageUtilities.getBaseFromName(this._jsonFile.name) + ".gen.js";

      this._jsFile = scriptsFolder.ensureFile(newFileName);
    }

    if (this._structureFile === undefined) {
      const structuresFolder = project.defaultBehaviorPackFolder.ensureFolder("structures");

      await structuresFolder.ensureExists();

      const structuresSubFolder = structuresFolder.ensureFolder("gametest");

      await structuresSubFolder.ensureExists();

      const newFileName = StorageUtilities.getBaseFromName(this._jsonFile.name) + "empty.mcstructure";

      this._structureFile = structuresSubFolder.ensureFile(newFileName);
    }

    if (this.worldTest && this._jsFile) {
      const jsString = this.worldTest.generateGameTestJavaScript(this._jsonFile.name);
      this._jsFile.setContent(jsString);
    }

    if (this.worldTest) {
      const functionsFolder = project.defaultBehaviorPackFolder.ensureFolder("functions");

      await functionsFolder.ensureExists();

      for (let i = 0; i < this.worldTest.areas.length; i++) {
        const area = this.worldTest.areas[i];

        for (let j = 0; j < area.scripts.length; j++) {
          const script = area.scripts[j];

          const functionFile = functionsFolder.ensureFile(
            Utilities.getSimpleString(area.title + (i + 1).toString() + script.name + (j + 1).toString()) +
              ".mcfunction"
          );

          const functionString = "tp " + area.location.x + " " + area.location.y + " " + area.location.z;
          /*"\r\ngametest run " +
            Utilities.getSimpleString(area.title) +
            ":" +
            Utilities.getSimpleString(script.name + (j + 1).toString());*/

          functionFile.setContent(functionString);
        }
      }
    }

    if (this.worldTest && this._structureFile) {
      const structure = new Structure();
      const cube = new BlockCube();

      cube.setMaxDimensions(8, 8, 8);

      structure.cube = cube;

      cube.getBlock(new BlockLocation(0, 0, 0)).typeName = "minecraft:dirt";

      const bytes = structure.getMCStructureBytes();

      if (bytes) {
        this._structureFile.setContent(bytes);
      }
    }
  }

  static async ensureWorldTestOnFile(file: IFile, loadHandler?: IEventHandler<WorldTestManager, WorldTestManager>) {
    let wtm = undefined;
    if (file.manager === undefined) {
      const wtm = new WorldTestManager();

      wtm.jsonFile = file;

      file.manager = wtm;
    }

    if (file.manager !== undefined && file.manager instanceof WorldTestManager) {
      wtm = file.manager as WorldTestManager;

      if (!wtm.isLoaded && loadHandler) {
        wtm.onLoaded.subscribe(loadHandler);
      }

      await wtm.load();
    }

    return wtm;
  }
}
