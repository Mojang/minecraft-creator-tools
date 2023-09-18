import ProjectItem from "../app/ProjectItem";
import Project from "./../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import IProjectItemInfoGenerator from "./IProjectItemInfoGenerator";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import ItemCountsInfoGenerator from "./ItemCountsInfoGenerator";
import PackInformationGenerator from "./PackInfoGenerator";
import IProjectInfo from "./IProjectInfo";
import ProjectInfoItem from "./ProjectInfoItem";
import SchemaItemInfoGenerator from "./SchemaItemInfoGenerator";
import UnknownItemGenerator from "./UnknownItemGenerator";
import UnknownFileGenerator from "./UnknownFileGenerator";
import WorldItemInfoGenerator from "./WorldItemInfoGenerator";
import IFolder from "../storage/IFolder";
import IInfoItemData, { InfoItemType } from "./IInfoItemData";
import IProjectInfoGeneratorBase, { IProjectInfoTopicData } from "./IProjectInfoGeneratorBase";
import IProjectInfoData from "./IProjectInfoData";
import JsonFileTagsInfoGenerator from "./JsonFileTagsInfoGenerator";
import { constants } from "../core/Constants";
import Utilities from "../core/Utilities";
import { ProjectItemType } from "../app/IProjectItemData";
import Log from "../core/Log";
import ScriptModuleManager from "../manager/ScriptModuleManager";
import VsCodeFileManager from "../manager/VsCodeFileManager";
import MinEngineVersionManager from "../manager/MinEngineVersionManager";
import BaseGameVersionManager from "../manager/BaseGameVersionManager";
import BehaviorPackEntityTypeManager from "../manager/BehaviorPackEntityTypeManager";

export enum ProjectInfoSuite {
  all,
  currentPlatform,
}

export default class ProjectInfoSet {
  project?: Project;
  suite: ProjectInfoSuite;
  info: IProjectInfo;
  items: ProjectInfoItem[] = [];
  static _generatorsById: { [name: string]: IProjectInfoGenerator } = {};
  _isGenerating: boolean = false;
  _completedGeneration: boolean = false;
  _excludeTests?: string[];
  private _pendingGenerateRequests: ((value: unknown) => void)[] = [];

  constructor(project: Project, suite?: ProjectInfoSuite, excludeTests?: string[]) {
    this.project = project;
    this.info = {};

    if (suite) {
      this.suite = suite;
    } else {
      this.suite = ProjectInfoSuite.all;
    }

    this._excludeTests = excludeTests;
  }

  static projectGenerators = [
    new ItemCountsInfoGenerator(),
    new PackInformationGenerator(),
    new JsonFileTagsInfoGenerator(),
    new ScriptModuleManager(),
    new VsCodeFileManager(),
    new MinEngineVersionManager(),
    new BaseGameVersionManager(),
    new BehaviorPackEntityTypeManager(),
  ];

  static itemGenerators = [new UnknownItemGenerator(), new SchemaItemInfoGenerator(), new WorldItemInfoGenerator()];

  static fileGenerators = [new UnknownFileGenerator()];

  static getTopicData(id: string, index: number): IProjectInfoTopicData | undefined {
    const gen = ProjectInfoSet._generatorsById[id];

    if (gen) {
      return gen.getTopicData(index);
    }

    for (const gen of ProjectInfoSet.projectGenerators) {
      if (gen.id === id) {
        this._generatorsById[id] = gen;

        return gen.getTopicData(index);
      }
    }

    return undefined;
  }

  matchesSuite(
    generator: IProjectFileInfoGenerator | IProjectInfoGenerator | IProjectItemInfoGenerator | IProjectInfoGeneratorBase
  ) {
    if (this.suite === ProjectInfoSuite.all) {
      return true;
    }

    if (this.suite === ProjectInfoSuite.currentPlatform) {
      if (generator.id === "MINENGINEVER" || generator.id === "BASEGAMEVER") {
        return true;
      }
    }

    return false;
  }

  async generateForProject(force?: boolean) {
    if (force === true && this._completedGeneration) {
      this._completedGeneration = false;
      this._isGenerating = false;
    }

    if (this._completedGeneration) {
      return;
    }

    if (this._isGenerating) {
      const pendingGenerate = this._pendingGenerateRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingGenerate.push(resolve);
      };

      await new Promise(prom);
    } else {
      this._isGenerating = true;

      const projGenerators: IProjectInfoGenerator[] = ProjectInfoSet.projectGenerators;
      const itemGenerators: IProjectItemInfoGenerator[] = ProjectInfoSet.itemGenerators;
      const fileGenerators: IProjectFileInfoGenerator[] = ProjectInfoSet.fileGenerators;

      const genItems: ProjectInfoItem[] = [];

      if (!this.project) {
        Log.throwUnexpectedUndefined("PISGFP");
        return;
      }

      await this.project.loc.load();

      for (let i = 0; i < projGenerators.length; i++) {
        const gen = projGenerators[i];

        if ((!this._excludeTests || !this._excludeTests.includes(gen.id)) && gen && this.matchesSuite(gen)) {
          const results = await gen.generate(this.project);

          for (const item of results) {
            genItems.push(item);
          }
        }
      }

      for (let i = 0; i < this.project.items.length; i++) {
        const pi = this.project.items[i];

        await pi.load();

        for (let j = 0; j < itemGenerators.length; j++) {
          const gen = itemGenerators[j];

          if ((!this._excludeTests || !this._excludeTests.includes(gen.id)) && this.matchesSuite(gen)) {
            const results = await gen.generate(pi);

            for (const item of results) {
              genItems.push(item);
            }
          }
        }
      }

      await this.processFolder(await this.project.ensureProjectFolder(), genItems, fileGenerators, 0);

      this.addSuccesses(genItems, fileGenerators, this._excludeTests);
      this.addSuccesses(genItems, itemGenerators, this._excludeTests);

      this.items = genItems;
      this._completedGeneration = true;

      this.generateProjectMetaInfo();

      const pendingLoad = this._pendingGenerateRequests;
      this._pendingGenerateRequests = [];
      this._isGenerating = false;

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  addSuccesses(genItems: ProjectInfoItem[], fileGenerators: IProjectInfoGeneratorBase[], excludeTests?: string[]) {
    for (const fileGen of fileGenerators) {
      if ((!excludeTests || !excludeTests.includes(fileGen.id)) && this.matchesSuite(fileGen)) {
        const results = this.getItems(genItems, fileGen.id, InfoItemType.testCompleteFail);

        if (results.length === 0) {
          genItems.push(
            new ProjectInfoItem(
              InfoItemType.testCompleteSuccess,
              fileGen.id,
              1,
              `Test ${fileGen.title} completed successfully.`
            )
          );
        }
      }
    }
  }

  public mergeInFeatures(allFeatures: { [featureName: string]: number | undefined }) {
    if (!this.info || !this.info.features) {
      return;
    }

    for (const featureName in this.info.features) {
      const val = this.info.features[featureName];

      if (val !== undefined) {
        let allfValue = allFeatures[featureName];

        if (allfValue === undefined) {
          allfValue = val;
        } else {
          allfValue += val;
        }

        allFeatures[featureName] = allfValue;
      }
    }
  }

  getDataObject(sourceName?: string, sourcePath?: string, sourceHash?: string): IProjectInfoData {
    const items: IInfoItemData[] = [];

    for (let i = 0; i < this.items.length; i++) {
      items.push(this.items[i].dataObject);
    }

    return {
      info: this.info,
      items: items,
      generatorName: constants.name,
      generatorVersion: constants.version,
      sourceName: sourceName,
      sourcePath: sourcePath,
      sourceHash: sourceHash,
    };
  }

  static getSummaryCsvHeaderLine(
    projectInfo: IProjectInfo,
    allFeatures: { [featureName: string]: number | undefined }
  ): string {
    let csvLine = "Name,Title,";

    let fieldNames = [];
    let featureNames = [];

    for (const str in projectInfo) {
      if (str !== "features") {
        fieldNames.push(str);
      }
    }

    for (const str in allFeatures) {
      featureNames.push(str);
    }

    fieldNames = fieldNames.sort(ProjectInfoSet.sortMinecraftFeatures);
    featureNames = featureNames.sort(ProjectInfoSet.sortMinecraftFeatures);

    for (const str of fieldNames) {
      csvLine += Utilities.humanifyJsName(str) + ",";
    }

    for (const str in projectInfo) {
      if (str !== "features") {
        fieldNames.push(str);
      }
    }

    for (const featureName of featureNames) {
      csvLine += featureName + ",";
    }

    return csvLine;
  }

  getReportHtml(sourceName?: string, sourcePath?: string, sourceHash?: string): string {
    const lines = [];

    lines.push("<html><head>");
    lines.push("<script>");
    lines.push(`const _reportObjects = [];

function _addReportJson(data) {
  _reportObjects.push(data);
}
`);
    lines.push(
      "_addReportJson(" + JSON.stringify(this.getDataObject(sourceName, sourcePath, sourceHash), null, 2) + ");"
    );
    lines.push("</script><script>");
    lines.push(`
    function getDataName(name) {
      if (typeof name === "boolean" || typeof name === "number") {
        return name.toString();
      }
    
      let retVal = "";
    
      for (let i = 0; i < name.length; i++) {
        if (i === 0) {
          retVal += name[i].toUpperCase();
        } else {
          if (name[i] >= "A" && name[i] <= "Z") {
            retVal += " ";
          }
          retVal += name[i];
        }
      }
      return retVal;
    }
    
    function getDataSummary(data) {
      if (data) {
        return data;
      }
      
      if (typeof data === "number" || typeof data === "boolean") {
        return data.toString();
      }
      
      if (typeof data === "object") {
        return JSON.stringify(data);
      }
    
      return "(not defined)";
    }  
    
    function getEmptySummary(data) {
    
      if (typeof data === "object") {
        return JSON.stringify(data);
      }
      
      if (typeof data === "number" || typeof data === "boolean") {
        return data.toString();
      }
    
      if (data) {
        return data;
      }
      
      return "";
    }  
    
    function generateReports() {
      for (let i=0; i<_reportObjects.length; i++) {
        document.write("<h1>" + _reportObjects[i].sourceName + "</h1>");
        document.write("<h3>Summary</h3>");
    
        document.write("<div class='summary-grid'>");
        const info = _reportObjects[i].info;
    
        if (info) {
          for (const key in info) {
            const val = info[key];
    
            if (key !== 'features') {
              document.write("<div class='summary-key grid-cell'>" + getDataName(key) + "</div>");
              document.write("<div class='summary-value grid-cell'>" + getDataSummary(val) + "</div>");
            }
          }
    
          if (info["features"]) {
            for (const key in info.features) {
             const val = info.features[key];
    
             if (key !== 'features') {
                document.write("<div class='summary-key grid-cell'>" + key + "</div>");
                document.write("<div class='summary-value grid-cell'>" + getDataSummary(val) + "</div>");
              }
            }
          }
        }
        document.write("</div>");
      }
    
    
      for (const i=0; i<_reportObjects.length; i++) {
        document.write("<h3>Items</h3>");
        document.write("<div class='items-grid'>");
        const info = _reportObjects[i].info;
    
    
        const items = _reportObjects[i].items;
    
        if (items && items.length) {
          for (const item of items) {
            document.write("<div class='items-type grid-cell'>" + item.itemType + "</div>");
            document.write("<div class='items-generator grid-cell'>" + item.generatorId + "</div>");
            document.write("<div class='items-generatorIndex grid-cell'>" + item.generatorIndex + "</div>");
            document.write("<div class='items-message grid-cell'>" + getEmptySummary(item.message) + "</div>");
            document.write("<div class='items-data grid-cell'>" + getEmptySummary(item.data) + "</div>");
            document.write("<div class='items-path grid-cell'>" + getEmptySummary(item.itemStoragePath) + "</div>");
          }
        }
        document.write("</div>");
      }
    } 
    </script>
    <style>
      body {
        font-family: Noto Sans, Arial, Helvetica, sans-serif;
        padding: 8px;
      }
    
      .items-grid {
        display: grid;
        border: solid 1px #606060;
        padding: 0px;
        grid-template-columns: 80px 140px 80px 1fr 1fr 1fr;
      }
    
      .grid-cell {
        border: solid 1px #606060;
        padding: 4px;
        vertical-align: top;
      }
    
      .summary-grid {
        display: grid;
        border: solid 1px #606060;
        padding: 0px;
        grid-template-columns: 520px 1fr;
      }
    
      .summary-key {
        grid-column: 1;
      }
    
      .summary-value {
        grid-column: 2;
      }
      
      .items-type {
        grid-column: 1;
      }
    
      .items-generator {
        grid-column: 2;
      }
      
      .items-generatorIndex {
        grid-column: 3;
      }
      
      .items-message {
        grid-column: 4;
      }
    
      .items-data {
        grid-column: 5;
      }
    
      .items-path {
        grid-column: 6;
      }
    </style>
    </head><body> 
`);
    lines.push("<script>");
    lines.push("generateReports();");
    lines.push("</script>");
    lines.push("</body></html>");

    return lines.join("\n");
  }

  getDataSummary(data: any | undefined) {
    if (typeof data === "number" || typeof data === "boolean") {
      return data.toString();
    } else if (typeof data === "string") {
      return '"' + data + '"';
    } else if (data) {
      return data;
    }

    return "(not defined)";
  }

  static sortMinecraftFeatures(a: string, b: string) {
    a = a.replace("minecraft:", "_");
    b = b.replace("minecraft:", "_");

    return a.localeCompare(b);
  }

  getSummaryCsvLine(
    containerName: string,
    title: string,
    allFeatures: { [featureName: string]: number | undefined }
  ): string {
    let line = containerName + "," + title + ",";

    let fieldNames = [];
    let featureNames = [];

    for (const str in this.info) {
      if (str !== "features") {
        fieldNames.push(str);
      }
    }

    for (const str in allFeatures) {
      featureNames.push(str);
    }

    fieldNames = fieldNames.sort(ProjectInfoSet.sortMinecraftFeatures);
    featureNames = featureNames.sort(ProjectInfoSet.sortMinecraftFeatures);

    for (const str of fieldNames) {
      // @ts-ignore
      line += this.getDataSummary(this.info[str]) + ",";
    }

    for (const featureName of featureNames) {
      let foundItem = false;

      if (this.info && this.info.features) {
        const thisVal = this.info.features[featureName];

        if (typeof thisVal === "number") {
          line += thisVal + ",";
          foundItem = true;
        }
      }

      if (!foundItem) {
        line += ",";
      }
    }

    return line;
  }

  getItemCsvLines(): string[] {
    const lines: string[] = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];

      let line =
        item.generatorId +
        "," +
        item.generatorIndex +
        "," +
        item.typeSummary +
        "," +
        (item.projectItem ? item.projectItem.name : "") +
        ',"' +
        item.message +
        '",';

      if (item.data) {
        if (typeof item.data === "string") {
          line += '"' + item.data + '"';
        } else {
          line += item.data.toString();
        }
      }

      if (item.features) {
        for (const featName in item.features) {
          const val = item.features[featName];

          if (typeof val === "number") {
            line += featName + "," + val + ",";
          } else if (typeof val === "string") {
            line += featName + ',"' + val + '",';
          }
        }
      }

      lines.push(line);
    }

    return lines;
  }

  getItems(genItems: ProjectInfoItem[], generatorId: string, itemType: InfoItemType) {
    const resultItems: ProjectInfoItem[] = [];

    for (const genItem of genItems) {
      if (genItem.generatorId === generatorId && genItem.itemType === itemType) {
        resultItems.push(genItem);
      }
    }

    return resultItems;
  }

  async processFolder(
    folder: IFolder,
    genItems: ProjectInfoItem[],
    fileGenerators: IProjectFileInfoGenerator[],
    depth: number
  ) {
    await folder.load(false);

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        await file.loadContent();

        for (const fileGen of fileGenerators) {
          if (this.matchesSuite(fileGen)) {
            const results = await fileGen.generate(file);

            for (const item of results) {
              genItems.push(item);
            }
          }
        }
      }
    }

    if (depth < 10) {
      for (const folderName in folder.folders) {
        const childFolder = folder.folders[folderName];

        if (childFolder && !childFolder.errorStatus && childFolder.name) {
          const name = childFolder.name.toLowerCase();

          if ((!name.startsWith(".") || name.startsWith(".vscode")) && !name.startsWith("node_modules")) {
            await this.processFolder(childFolder, genItems, fileGenerators, depth + 1);
          }
        }
      }
    }
  }

  generateProjectMetaInfo() {
    this.info = {};

    this.info.defaultBehaviorPackUuid = this.getFirstStringValue("PACK", 2);
    this.info.defaultBehaviorPackMinEngineVersion = this.getFirstNumberArrayValue("PACK", 1);
    this.info.defaultBehaviorPackName = this.getFirstNumberArrayValue("PACK", 4);
    this.info.defaultBehaviorPackDescription = this.getFirstNumberArrayValue("PACK", 5);
    this.info.defaultResourcePackUuid = this.getFirstStringValue("PACK", 12);
    this.info.defaultResourcePackMinEngineVersion = this.getFirstNumberArrayValue("PACK", 11);
    this.info.defaultResourcePackName = this.getFirstNumberArrayValue("PACK", 14);
    this.info.defaultResourcePackDescription = this.getFirstNumberArrayValue("PACK", 15);

    this.info.behaviorPackManifestCount = this.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.behaviorPackManifestJson
    );
    this.info.unknownJsonCount = this.getFirstNumberValue("ITEMS", 100 + ProjectItemType.json);
    this.info.entityTypeManifestCount = this.getFirstNumberValue("ITEMS", 100 + ProjectItemType.entityTypeBehaviorJson);
    this.info.itemTypeManifestCount = this.getFirstNumberValue("ITEMS", 100 + ProjectItemType.itemTypeBehaviorJson);
    this.info.blockTypeManifestCount = this.getFirstNumberValue("ITEMS", 100 + ProjectItemType.blockTypeBehaviorJson);
    this.info.resourcePackManifestCount = this.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.resourcePackManifestJson
    );

    this.info.worldCount =
      this.getFirstNumberValue("ITEMS", 100 + ProjectItemType.MCWorld) +
      this.getFirstNumberValue("ITEMS", 100 + ProjectItemType.worldFolder);

    this.info.entityTypeResourceCount = this.getFirstNumberValue("ITEMS", 100 + ProjectItemType.entityTypeResourceJson);

    this.info.behaviorPackAnimationCount = this.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.animationBehaviorJson
    );

    this.info.behaviorPackAnimationControllerCount = this.getFirstNumberValue(
      "ITEMS",
      100 + ProjectItemType.animationControllerBehaviorJson
    );

    this.aggregateFeatures();
  }

  addObjectsToArray(validatorName: string, validatorId: number, parentArray: object[]) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "object") {
          parentArray.push(item.data);
        }
      }
    }
  }

  getFirstStringValue(validatorName: string, validatorId: number) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "string") {
          return item.data;
        }
      }
    }

    return undefined;
  }

  getGeneratorForItem(item: ProjectInfoItem): IProjectInfoGeneratorBase | undefined {
    const itemGens = ProjectInfoSet.itemGenerators;

    for (const itemGen of itemGens) {
      if (itemGen.id === item.generatorId) {
        return itemGen;
      }
    }

    const fileGens = ProjectInfoSet.fileGenerators;
    for (const fileGen of fileGens) {
      if (fileGen.id === item.generatorId) {
        return fileGen;
      }
    }

    const projGens = ProjectInfoSet.projectGenerators;

    for (const projGen of projGens) {
      if (projGen.id === item.generatorId) {
        return projGen;
      }
    }

    return undefined;
  }

  getItemSummary(item: ProjectInfoItem) {
    const gen = this.getGeneratorForItem(item);

    if (gen) {
      const topic = gen.getTopicData(item.generatorIndex);

      if (topic) {
        return topic.title;
      }
    }

    return item.generatorId + "-" + item.generatorIndex;
  }

  aggregateFeatures() {
    if (this.info === undefined) {
      return;
    }

    this.info.features = {};

    for (const item of this.items) {
      if (item.features) {
        for (const featureName in item.features) {
          const val = item.features[featureName];

          if (typeof val === "number") {
            const summary = this.getItemSummary(item);
            const aggName = summary + " " + featureName;

            let aggVal = this.info.features[aggName];

            if (aggVal === undefined) {
              aggVal = val;
            } else if (featureName.startsWith("max ")) {
              aggVal = Math.max(aggVal, val);
            } else if (featureName.startsWith("min ")) {
              aggVal = Math.min(aggVal, val);
            } else {
              aggVal += val;
            }

            this.info.features[aggName] = aggVal;
          }
        }
      }
    }
  }

  getFirstNumberValue(validatorName: string, validatorId: number) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "number") {
          return item.data;
        }
      }
    }

    return 0;
  }

  getFirstNumberArrayValue(validatorName: string, validatorId: number) {
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        const val = item.data;
        if (typeof val === "string") {
          return val;
        } else if (val instanceof Array && val.length && val.length > 0) {
          let ret = "";
          for (let i = 0; i < val.length; i++) {
            if (ret.length > 0) {
              ret += ".";
            }

            ret += val[i];
          }

          return ret;
        }
      }
    }

    return undefined;
  }

  async getInfoForItem(projectItem: ProjectItem) {
    const itemGenerators: IProjectItemInfoGenerator[] = ProjectInfoSet.itemGenerators;
    let genItems: ProjectInfoItem[] = [];

    await projectItem.load();

    for (let j = 0; j < itemGenerators.length; j++) {
      genItems = genItems.concat(await itemGenerators[j].generate(projectItem));
    }

    return genItems;
  }
}
