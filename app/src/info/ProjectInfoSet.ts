import ProjectItem from "../app/ProjectItem";
import Project from "./../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import IProjectItemInfoGenerator from "./IProjectItemInfoGenerator";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import ItemCountsInfoGenerator from "./ItemCountsInfoGenerator";
import PackInformationGenerator from "./PackInfoGenerator";
import LineSizeInfoGenerator from "./LineSizeInfoGenerator";
import IProjectInfo from "./IProjectInfo";
import ProjectInfoItem from "./ProjectInfoItem";
import SchemaItemInfoGenerator from "./SchemaItemInfoGenerator";
import UnknownItemGenerator from "./UnknownItemGenerator";
import UnknownFileGenerator from "./UnknownFileGenerator";
import WorldItemInfoGenerator from "./WorldItemInfoGenerator";
import IFolder from "../storage/IFolder";
import IInfoItemData, { InfoItemType } from "./IInfoItemData";
import IProjectInfoGeneratorBase, { IProjectInfoTopicData } from "./IProjectInfoGeneratorBase";
import IProjectInfoData, { ProjectInfoSuite } from "./IProjectInfoData";
import JsonFileTagsInfoGenerator from "./JsonFileTagsInfoGenerator";
import { constants } from "../core/Constants";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import ScriptModuleManager from "../manager/ScriptModuleManager";
import VsCodeFileManager from "../manager/VsCodeFileManager";
import MinEngineVersionManager from "../manager/MinEngineVersionManager";
import BaseGameVersionManager from "../manager/BaseGameVersionManager";
import BehaviorPackEntityTypeManager from "../manager/BehaviorPackEntityTypeManager";
import WorldDataInfoGenerator from "./WorldDataInfoGenerator";
import { StatusTopic } from "../app/Status";
import PackMetaDataInformationGenerator from "./PackMetaDataInfoGenerator";
import AddOnRequirementsGenerator from "./AddOnRequirementsGenerator";
import StrictPlatformInfoGenerator from "./StrictPlatformInfoGenerator";
import AddOnItemRequirementsGenerator from "./AddOnItemRequirementsGenerator";

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

  constructor(
    project?: Project,
    suite?: ProjectInfoSuite,
    excludeTests?: string[],
    info?: IProjectInfo,
    items?: IInfoItemData[]
  ) {
    this.project = project;
    this.info = info ? info : {};

    if (items) {
      for (const item of items) {
        this.items.push(
          new ProjectInfoItem(
            item.itemType,
            item.generatorId,
            item.generatorIndex,
            item.message,
            undefined,
            item.data,
            item.itemId,
            item.content
          )
        );
      }
    }

    if (suite) {
      this.suite = suite;
    } else {
      this.suite = ProjectInfoSuite.allExceptAddOn;
    }

    this._excludeTests = excludeTests;
  }

  static projectGenerators = [
    new ItemCountsInfoGenerator(),
    new LineSizeInfoGenerator(),
    new PackInformationGenerator(),
    new JsonFileTagsInfoGenerator(),
    new ScriptModuleManager(),
    new VsCodeFileManager(),
    new MinEngineVersionManager(),
    new BaseGameVersionManager(),
    new BehaviorPackEntityTypeManager(),
    new AddOnRequirementsGenerator(),
    new StrictPlatformInfoGenerator(),
  ];

  static itemGenerators = [
    new UnknownItemGenerator(),
    new PackMetaDataInformationGenerator(),
    new SchemaItemInfoGenerator(),
    new WorldItemInfoGenerator(),
    new WorldDataInfoGenerator(),
    new AddOnItemRequirementsGenerator(),
  ];

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
    if (this.suite === ProjectInfoSuite.allExceptAddOn && generator.id.indexOf("ADDON") < 0) {
      return true;
    }

    if (this.suite === ProjectInfoSuite.currentPlatform) {
      if (generator.id === "MINENGINEVER" || generator.id === "BASEGAMEVER") {
        return true;
      }
    }

    if (this.suite === ProjectInfoSuite.addOn) {
      if (
        generator.id.indexOf("ADDON") >= 0 ||
        generator.id === "STRICT" ||
        generator.id === "MINENGINEVER" ||
        generator.id === "WORLDDATA"
      ) {
        return true;
      }
    }

    return false;
  }

  configureForSuite(
    generator: IProjectFileInfoGenerator | IProjectInfoGenerator | IProjectItemInfoGenerator | IProjectInfoGeneratorBase
  ) {
    if (generator.id === "WORLDDATA" && this.suite === ProjectInfoSuite.addOn) {
      (generator as WorldDataInfoGenerator).performAddOnValidations = true;
    } else if (generator.id === "WORLDDATA") {
      (generator as WorldDataInfoGenerator).performAddOnValidations = false;
    }
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

      const valOperId = await this.project?.carto.notifyOperationStarted(
        "Validating '" + this.project.name + "'",
        StatusTopic.validation
      );

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
          this.configureForSuite(gen);

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
            this.configureForSuite(gen);

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

      if (valOperId !== undefined) {
        await this.project?.carto.notifyOperationEnded(
          valOperId,
          "Completed validation of '" + this.project.name + "'",
          StatusTopic.validation
        );
      }

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  disconnectFromProject() {
    this.project = undefined;

    for (const pi of this.items) {
      pi.disconnect();
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

  public mergeInFeatures(
    allFeatures: { [featureName: string]: number | undefined },
    allFields: { [featureName: string]: boolean | undefined }
  ) {
    if (!this.info || !this.info.features) {
      return;
    }

    for (const str in this.info) {
      if (str !== "features") {
        allFields[str] = true;
      }
    }

    for (const str in allFields) {
      let inf = this.info as any;

      if (str !== "features") {
        if (inf[str] === undefined) {
          inf[str] = "";
        }
      }
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
      suite: this.suite,
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
    let csvLine = "Name,Title,Reds,Area,";

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
      csvLine += ProjectInfoSet.getDataSummary(featureName) + ",";
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
    
        document.write("<table class='summary-table'>");
        const info = _reportObjects[i].info;
    
        if (info) {
          for (const key in info) {
            const val = info[key];
    
            if (key !== 'features') {
              document.write("<tr>");
              document.write("<td class='summary-key items-cell'>" + getDataName(key) + "</td>");
              document.write("<td class='summary-value items-cell'>" + getDataSummary(val) + "</td>");
              document.write("</tr>");
            }
          }
    
          if (info["features"]) {
            for (const key in info.features) {
             const val = info.features[key];
    
             if (key !== 'features') {
                document.write("<tr>");
                document.write("<td class='summary-key items-cell'>" + key + "</td>");
                document.write("<td class='summary-value items-cell'>" + getDataSummary(val) + "</td>");
                document.write("</tr>");
              }
            }
          }
        }
        document.write("</table>");
      }
    
    
      for (const i=0; i<_reportObjects.length; i++) {
        document.write("<h3>Items</h3>");
        document.write("<table class='items-table'>");
        const info = _reportObjects[i].info;
    
    
        const items = _reportObjects[i].items;
    
        if (items && items.length) {
          for (const item of items) {
            if (item.itemType !== 2) {
              document.write("<tr>");
              document.write("<td class='items-type items-cell'>" + getDescriptionForItemType(item.itemType) + "</td>");
              document.write("<td class='items-generator items-cell'>" + item.generatorId + "</td>");
              document.write("<td class='items-generatorIndex items-cell'>" + item.generatorIndex + "</td>");
              document.write("<td class='items-message items-cell'>" + getEmptySummary(item.message) + "</td>");
              document.write("<td class='items-data items-cell'>" + getEmptySummary(item.data) + "</td>");
              document.write("<td class='items-path items-cell'>" + getEmptySummary(item.itemStoragePath) + "</td>");
              document.write("</tr>");
            }
          }
        }
        document.write("</table>");
      }
    } 

    function getDescriptionForItemType(itemType) {
      switch (itemType) {
        case 0: 
          return "SUCCESS";
          break;
        case 1: 
          return "FAIL";
          break;
        case 3: 
          return "ERROR";
          break;
        case 4: 
          return "WARN";
          break;
        case 5: 
          return "INTERNALERR";
          break;
        case 6: 
          return "RECOMMEND";
          break;          
      }
      return "INFO";
    }

    </script>
    <style>
      body {
        font-family: Noto Sans, Arial, Helvetica, sans-serif;
        padding: 8px;
      }
    
      .items-table {
        display: grid;
        border: solid 1px #606060;
        padding: 0px;
      }
    
      .items-cell {
        border: solid 1px #606060;
        padding: 4px;
        vertical-align: top;
      }
    
      .summary-table {
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

  static getDataSummary(data: any | undefined) {
    if (typeof data === "number" || typeof data === "boolean") {
      return data.toString();
    } else if (data) {
      return '"' + data.replace(/"/gi, "'") + '"';
    }

    return "(not defined)";
  }

  static sortMinecraftFeatures(a: string, b: string) {
    a = a.replace("minecraft:", "_");
    b = b.replace("minecraft:", "_");

    return a.localeCompare(b);
  }

  getArea(title: string) {
    title = title.toLowerCase();

    if (title.indexOf("furniture") >= 0) {
      return "Furniture";
    }

    if (title.indexOf("skyblock") >= 0 || title.indexOf("sky block") >= 0) {
      return "Skyblock";
    }

    if (title.indexOf("oneblock") >= 0 || title.indexOf("one block") >= 0) {
      return "One block";
    }

    if (title.indexOf("lucky") >= 0) {
      return "Lucky";
    }

    if (title.indexOf("parkour") >= 0) {
      return "Parkour";
    }

    if (title.indexOf("surviv") >= 0) {
      return "Survival";
    }

    if (
      title.indexOf("weapon") >= 0 ||
      title.indexOf("potion") >= 0 ||
      title.indexOf("tool") >= 0 ||
      title.indexOf("hook") >= 0
    ) {
      return "Tools";
    }

    if (
      title.indexOf("roleplay") >= 0 ||
      title.indexOf("teen") >= 0 ||
      title.indexOf("illionair") >= 0 ||
      title.indexOf("hacker") >= 0
    ) {
      return "Roleplay";
    }

    if (
      title.indexOf("mob") >= 0 ||
      title.indexOf("pirate") >= 0 ||
      title.indexOf("unicorn") >= 0 ||
      title.indexOf("alien") >= 0 ||
      title.indexOf("animals") >= 0 ||
      title.indexOf("cats") >= 0 ||
      title.indexOf("dogs") >= 0 ||
      title.indexOf("dragon") >= 0
    ) {
      return "Mob";
    }

    if (title.indexOf("vehicles") >= 0 || title.indexOf("car") >= 0 || title.indexOf("plane") >= 0) {
      return "Vehicles";
    }

    if (
      title.indexOf("island") >= 0 ||
      title.indexOf("kingdom") >= 0 ||
      title.indexOf("tower") >= 0 ||
      title.indexOf("mansion") >= 0 ||
      title.indexOf("village") >= 0 ||
      title.indexOf("resort") >= 0 ||
      title.indexOf("castle") >= 0 ||
      title.indexOf("base") >= 0 ||
      title.indexOf("town") >= 0 ||
      title.indexOf("city") >= 0 ||
      title.indexOf("fortress") >= 0 ||
      title.indexOf("citadel") >= 0 ||
      title.indexOf("outpost") >= 0 ||
      title.indexOf("farm") >= 0 ||
      title.indexOf("hotel") >= 0 ||
      title.indexOf("castle") >= 0
    ) {
      return "Area";
    }

    if (title.indexOf("simulat") >= 0) {
      return "Simulator";
    }

    return "General";
  }

  getRed() {
    let red = 0;

    if (!this.info || !this.info.features) {
      return 0;
    }

    let val = this.info.features["Animation content-size total"];
    if (val) {
      red += val * 0.2;
    }

    val = this.info.features["Animation controller content-size total"];
    if (val) {
      red += val * 0.5;
    }

    val = this.info.features["Attachable content-size total"];
    if (val) {
      red += val * 0.1;
    }

    val = this.info.features["Function content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Tick content-size total"];
    if (val) {
      red += val * 20;
    }

    val = this.info.features["Command execute"];
    if (val) {
      red += val * 4;
    }

    val = this.info.features["Behavior pack animation content-size total"];
    if (val) {
      red += val * 0.8;
    }

    val = this.info.features["Behavior pack animation controller content-size total"];
    if (val) {
      red += val * 1.2;
    }

    val = this.info.features["Biome resources content-size total"];
    if (val) {
      red += val * 1.2;
    }

    val = this.info.features["Block minecraft:chain_command_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.features["Block minecraft:command_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.features["Block minecraft:repeating_command_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.features["Block minecraft:structure_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.features["Block minecraft:observer"];
    if (val) {
      red += val * 4;
    }

    val = this.info.features["Block minecraft:comparator"];
    if (val) {
      red += val * 4;
    }

    val = this.info.features["Block minecraft:dropper"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Block minecraft:hopper"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Block minecraft:pressure_plate"];
    if (val) {
      red += val * 1;
    }

    val = this.info.features["Block minecraft:lever"];
    if (val) {
      red += val * 4;
    }

    val = this.info.features["Block minecraft:lit_redstone_lamp"];
    if (val) {
      red += val;
    }

    val = this.info.features["Block minecraft:redstone_block"];
    if (val) {
      red += val;
    }

    val = this.info.features["Block minecraft:redstone_torch"];
    if (val) {
      red += val;
    }

    val = this.info.features["Block minecraft:redstone_wire"];
    if (val) {
      red += val;
    }

    val = this.info.features["Block type content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Entity dialogue content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Entity type content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Entity type resources content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.features["Item type content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Item type resources content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.features["JavaScript content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.features["Loot table content-size total"];
    if (val) {
      red += val;
    }

    val = this.info.features["Model content-size total"];
    if (val) {
      red += val * 0.1;
    }

    val = this.info.features["Particle content-size total"];
    if (val) {
      red += val * 0.4;
    }

    val = this.info.features["Recipe content-size total"];
    if (val) {
      red += val * 0.4;
    }

    val = this.info.features["Render controller content-size total"];
    if (val) {
      red += val * 0.5;
    }

    val = this.info.features["Spawn rule content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.features["Trading content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.features["User interface content-size total"];
    if (val) {
      red += val * 2;
    }

    return red;
  }

  getSummaryCsvLine(
    containerName: string,
    title: string,
    allFeatures: { [featureName: string]: number | undefined }
  ): string {
    let line =
      ProjectInfoSet.getDataSummary(containerName) +
      "," +
      ProjectInfoSet.getDataSummary(title) +
      "," +
      this.getRed() +
      "," +
      this.getArea(title) +
      ",";

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
      line += ProjectInfoSet.getDataSummary(this.info[str]) + ",";
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

    const projGenerators: IProjectInfoGenerator[] = ProjectInfoSet.projectGenerators;
    const itemGenerators: IProjectItemInfoGenerator[] = ProjectInfoSet.itemGenerators;
    const fileGenerators: IProjectFileInfoGenerator[] = ProjectInfoSet.fileGenerators;

    for (let j = 0; j < projGenerators.length; j++) {
      projGenerators[j].summarize(this.info, this);
    }

    for (let j = 0; j < itemGenerators.length; j++) {
      itemGenerators[j].summarize(this.info, this);
    }

    for (let j = 0; j < fileGenerators.length; j++) {
      fileGenerators[j].summarize(this.info, this);
    }

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

  getSummedNumberValue(validatorName: string, validatorId: number) {
    let sum = 0;
    for (const item of this.items) {
      if (item.generatorId === validatorName && item.generatorIndex === validatorId && item.data) {
        if (typeof item.data === "number") {
          sum += item.data;
        }
      }
    }

    return sum;
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
