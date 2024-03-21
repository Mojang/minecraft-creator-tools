// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectItem from "../app/ProjectItem";
import Project from "./../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import IProjectItemInfoGenerator from "./IProjectItemInfoGenerator";
import IProjectFileInfoGenerator from "./IProjectFileInfoGenerator";
import IProjectInfo from "./IProjectInfo";
import ProjectInfoItem from "./ProjectInfoItem";
import IFolder from "../storage/IFolder";
import IInfoItemData, { InfoItemType } from "./IInfoItemData";
import IProjectInfoGeneratorBase, { IProjectInfoTopicData } from "./IProjectInfoGeneratorBase";
import IProjectInfoData, { ProjectInfoSuite } from "./IProjectInfoData";
import { constants } from "../core/Constants";
import Utilities from "../core/Utilities";
import Log from "../core/Log";
import { StatusTopic } from "../app/Status";
import GeneratorRegistrations from "./GeneratorRegistrations";
import StorageUtilities from "../storage/StorageUtilities";
import ContentIndex from "../core/ContentIndex";

export default class ProjectInfoSet {
  project?: Project;
  suite: ProjectInfoSuite;
  info: IProjectInfo;
  items: ProjectInfoItem[] = [];
  itemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined } = {};
  contentIndex: ContentIndex;

  static _generatorsById: { [name: string]: IProjectInfoGenerator } = {};
  _isGenerating: boolean = false;
  _completedGeneration: boolean = false;
  _excludeTests?: string[];
  private _pendingGenerateRequests: ((value: unknown) => void)[] = [];

  static CommonCsvHeader = "Test,TestId,Type,Item,Message,Data,Path";

  static getSuiteFromString(suiteName: string) {
    switch (suiteName.toLowerCase()) {
      case "addon":
      case "addons":
        return ProjectInfoSuite.addOn;

      case "currentplatform":
        return ProjectInfoSuite.currentPlatform;

      default:
        return ProjectInfoSuite.allExceptAddOn;
    }
  }

  get completedGeneration() {
    return this._completedGeneration;
  }

  constructor(
    project?: Project,
    suite?: ProjectInfoSuite,
    excludeTests?: string[],
    info?: IProjectInfo,
    items?: IInfoItemData[],
    index?: ContentIndex
  ) {
    this.project = project;
    this.info = info ? info : {};
    this.contentIndex = index ? index : new ContentIndex();

    if (items) {
      for (const item of items) {
        let projectItem = undefined;

        if (item.p) {
          if (project) {
            projectItem = project.getItemByStoragePath(item.p);
          }

          if (!this.itemsByStoragePath[item.p]) {
            this.itemsByStoragePath[item.p] = [];
          }

          let projectInfoItem = new ProjectInfoItem(
            item.iTp,
            item.gId,
            item.gIx,
            item.m,
            projectItem,
            item.d,
            item.iId,
            item.c
          );

          this.itemsByStoragePath[item.p]?.push(projectInfoItem);
          this.items.push(projectInfoItem);
        } else {
          this.items.push(
            new ProjectInfoItem(item.iTp, item.gId, item.gIx, item.m, projectItem, item.d, item.iId, item.c)
          );
        }
      }
    }

    if (suite) {
      this.suite = suite;
    } else {
      this.suite = ProjectInfoSuite.allExceptAddOn;
    }

    if (index) {
      if (info) {
        for (const key in info) {
          const val = (info as any)[key];

          if (val && typeof val === "string") {
            if (ProjectInfoSet.isAggregableFieldName(key)) {
              index.parseTextContent("inspector", val);
            }
          }
        }
      }
    }

    this._excludeTests = excludeTests;
  }

  static getTopicData(id: string, index: number): IProjectInfoTopicData | undefined {
    const gen = ProjectInfoSet._generatorsById[id];

    if (gen) {
      return gen.getTopicData(index);
    }

    for (const gen of GeneratorRegistrations.projectGenerators) {
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
        generator.id === "TEXTURE" ||
        generator.id === "MINENGINEVER" ||
        generator.id === "WORLDDATA"
      ) {
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

      const valOperId = await this.project?.carto.notifyOperationStarted(
        "Validating '" + this.project.name + "'",
        StatusTopic.validation
      );

      this.info.summary = undefined;

      const projGenerators: IProjectInfoGenerator[] = GeneratorRegistrations.projectGenerators;
      const itemGenerators: IProjectItemInfoGenerator[] = GeneratorRegistrations.itemGenerators;
      const fileGenerators: IProjectFileInfoGenerator[] = GeneratorRegistrations.fileGenerators;

      const genItems: ProjectInfoItem[] = [];
      const genItemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined } = {};
      const genContentIndex = new ContentIndex();

      if (!this.project) {
        Log.throwUnexpectedUndefined("PISGFP");
        return;
      }

      await this.project.loc.load();

      for (let i = 0; i < projGenerators.length; i++) {
        const gen = projGenerators[i];

        if ((!this._excludeTests || !this._excludeTests.includes(gen.id)) && gen && this.matchesSuite(gen)) {
          GeneratorRegistrations.configureForSuite(gen, this.suite);

          try {
            const results = await gen.generate(this.project, genContentIndex);

            for (const item of results) {
              this.pushItem(genItems, genItemsByStoragePath, item);
            }
          } catch (e: any) {
            genItems.push(new ProjectInfoItem(InfoItemType.internalProcessingError, gen.id, 500, e.toString()));
          }
        }
      }

      for (let i = 0; i < this.project.items.length; i++) {
        const pi = this.project.items[i];

        await pi.load();

        for (let j = 0; j < itemGenerators.length; j++) {
          const gen = itemGenerators[j];

          if ((!this._excludeTests || !this._excludeTests.includes(gen.id)) && this.matchesSuite(gen)) {
            GeneratorRegistrations.configureForSuite(gen, this.suite);
            try {
              const results = await gen.generate(pi, genContentIndex);

              for (const item of results) {
                this.pushItem(genItems, genItemsByStoragePath, item);
              }
            } catch (e: any) {
              genItems.push(new ProjectInfoItem(InfoItemType.internalProcessingError, gen.id, 501, e.toString()));
            }
          }
        }
      }

      await this.processFolder(
        this.project,
        await this.project.ensureProjectFolder(),
        genItems,
        genItemsByStoragePath,
        genContentIndex,
        fileGenerators,
        0
      );

      this.addSuccesses(genItems, genItemsByStoragePath, fileGenerators, this._excludeTests);
      this.addSuccesses(genItems, genItemsByStoragePath, itemGenerators, this._excludeTests);

      this.items = genItems;

      this.itemsByStoragePath = genItemsByStoragePath;
      this.contentIndex = genContentIndex;

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

  addSuccesses(
    genItems: ProjectInfoItem[],
    genItemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined },
    fileGenerators: IProjectInfoGeneratorBase[],
    excludeTests?: string[]
  ) {
    for (const fileGen of fileGenerators) {
      if ((!excludeTests || !excludeTests.includes(fileGen.id)) && this.matchesSuite(fileGen)) {
        const results = ProjectInfoSet.getItemsInCollectionByType(genItems, fileGen.id, InfoItemType.testCompleteFail);

        if (results.length === 0) {
          this.pushItem(
            genItems,
            genItemsByStoragePath,
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

  pushItem(
    itemSet: ProjectInfoItem[],
    itemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined },
    item: ProjectInfoItem
  ) {
    if (
      item.projectItem &&
      item.projectItem.storagePath &&
      item.itemType !== InfoItemType.info &&
      item.itemType !== InfoItemType.featureAggregate
    ) {
      if (!itemsByStoragePath[item.projectItem.storagePath]) {
        itemsByStoragePath[item.projectItem.storagePath] = [];
      }

      itemsByStoragePath[item.projectItem.storagePath]?.push(item);
    }

    itemSet.push(item);
  }

  public mergeFeatureSetsAndFieldsTo(
    allFeatureSets: { [setName: string]: { [measureName: string]: number | undefined } | undefined },
    allFields: { [featureName: string]: boolean | undefined }
  ) {
    if (!this.info || !this.info.featureSets) {
      return;
    }

    for (const str in this.info) {
      if (str !== "features") {
        allFields[str] = true;
      }
    }

    for (const str in allFields) {
      let inf = this.info as any;

      if (ProjectInfoSet.isAggregableFieldName(str)) {
        if (inf[str] === undefined) {
          inf[str] = "";
        }
      }
    }

    for (const featureName in this.info.featureSets) {
      const myFeature = this.info.featureSets[featureName];

      if (myFeature !== undefined) {
        let allFeature = allFeatureSets[featureName];

        if (allFeature === undefined) {
          allFeature = {};
          allFeatureSets[featureName] = allFeature;
        }

        for (const measureName in myFeature) {
          const measureVal = myFeature[measureName];

          if (measureVal !== undefined) {
            let allMeasureVal = allFeature[measureName];

            if (allMeasureVal === undefined) {
              allMeasureVal = measureVal;
            } else {
              allMeasureVal += measureVal;
            }

            allFeature[measureName] = allMeasureVal;
          }
        }
      }
    }
  }

  ensureGenerators() {
    if (!this.info) {
      return;
    }

    if (this.info.summary !== undefined) {
      return;
    }

    this.info.summary = {};

    for (let i = 0; i < this.items.length; i++) {
      const gId = this.items[i].generatorId;
      const gIndex = this.items[i].generatorIndex;

      let gen = this.info.summary[gId];

      if (gen === undefined) {
        gen = {};

        this.info.summary[gId] = gen;
      }

      let genI = gen[gIndex];

      if (genI === undefined) {
        genI = {};

        gen[gIndex] = genI;
      }

      const topicInfo = ProjectInfoSet.getTopicData(gId, gIndex);

      if (topicInfo) {
        genI.title = topicInfo.title;
      }

      if (genI.defaultMessage === undefined && this.items[i].message !== genI.title) {
        genI.defaultMessage = this.items[i].message;
      }
    }

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const gId = item.generatorId;
      const gIndex = item.generatorIndex;

      let gen = this.info.summary[gId];

      if (gen === undefined) {
        gen = {};

        this.info.summary[gId] = gen;
      }

      let genI = gen[gIndex];

      if (genI === undefined) {
        genI = {};

        gen[gIndex] = genI;
      }

      if (item.itemType !== InfoItemType.featureAggregate) {
        switch (item.itemType) {
          case InfoItemType.error:
            genI.errors = genI.errors ? genI.errors + 1 : 1;
            break;
          case InfoItemType.testCompleteFail:
            genI.testCompleteFails = genI.testCompleteFails ? genI.testCompleteFails + 1 : 1;
            break;
          case InfoItemType.testCompleteSuccess:
            genI.testCompleteSuccesses = genI.testCompleteSuccesses ? genI.testCompleteSuccesses + 1 : 1;
            break;
          case InfoItemType.warning:
            genI.warnings = genI.warnings ? genI.warnings + 1 : 1;
            break;
          case InfoItemType.recommendation:
            genI.recommendations = genI.recommendations ? genI.recommendations + 1 : 1;
            break;
          case InfoItemType.internalProcessingError:
            genI.internalProcessingErrors = genI.internalProcessingErrors ? genI.internalProcessingErrors + 1 : 1;
            break;
        }
      }

      if (this.items[i].message === genI.defaultMessage || this.items[i].message === genI.title) {
        this.items[i].message = undefined;
      }
    }
  }

  shouldIncludeInIndex(data: IInfoItemData) {
    if (data.gId === "JSON" || data.gId === "ESLINT") {
      return false;
    }

    return true;
  }

  getDataObject(
    sourceName?: string,
    sourcePath?: string,
    sourceHash?: string,
    isIndexOnly?: boolean
  ): IProjectInfoData {
    const items: IInfoItemData[] = [];

    this.ensureGenerators();

    for (let i = 0; i < this.items.length; i++) {
      const dataObj = this.items[i].dataObject;

      if (!isIndexOnly || this.shouldIncludeInIndex(dataObj)) {
        items.push(dataObj);
      }
    }

    return {
      info: this.info,
      items: items,
      index: this.contentIndex.data,
      generatorName: constants.name,
      suite: this.suite,
      generatorVersion: constants.version,
      sourceName: sourceName,
      sourcePath: sourcePath,
      sourceHash: sourceHash,
    };
  }

  static isAggregableFieldName(name: string) {
    if (name !== "features" && name !== "summary" && name !== "featureSets" && name !== "defaultIcon") {
      return true;
    }

    return false;
  }

  static isAggregableFeatureMeasureName(name: string) {
    if (!name.startsWith("#")) {
      return true;
    }

    return false;
  }

  static getSummaryCsvHeaderLine(
    projectInfo: IProjectInfo,
    allFeatures: { [setName: string]: { [measureName: string]: number | undefined } | undefined }
  ): string {
    let csvLine = "Name,Title,Reds,Area,";

    let fieldNames = [];

    for (const str in projectInfo) {
      if (ProjectInfoSet.isAggregableFieldName(str)) {
        fieldNames.push(str);
      }
    }

    fieldNames = fieldNames.sort(ProjectInfoSet.sortMinecraftFeatures);

    for (const str of fieldNames) {
      csvLine += Utilities.humanifyJsName(str) + ",";
    }

    for (const str in projectInfo) {
      if (ProjectInfoSet.isAggregableFieldName(str)) {
        fieldNames.push(str);
      }
    }

    for (const featureName in allFeatures) {
      const feature = allFeatures[featureName];

      if (feature) {
        for (const measureName in feature) {
          if (ProjectInfoSet.isAggregableFeatureMeasureName(measureName)) {
            const measure = feature[measureName];

            if (measure !== undefined) {
              csvLine += ProjectInfoSet.getDataSummary(featureName + " " + measureName) + ",";
            }
          }
        }
      }
    }

    return csvLine;
  }

  getIndexJson(sourceName?: string, sourcePath?: string, sourceHash?: string) {
    return JSON.stringify(this.getDataObject(sourceName, sourcePath, sourceHash, true));
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
    const dataObject = this.getDataObject(sourceName, sourcePath, sourceHash);

    dataObject.index = undefined;
    lines.push("_addReportJson(" + JSON.stringify(dataObject, null, 2) + ");");
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
    
            if (key !== 'featureSets' && key !== 'defaultIcon' && key !== 'summary') {
              document.write("<tr>");
              document.write("<td class='summary-key items-cell'>" + getDataName(key) + "</td>");
              document.write("<td class='summary-value items-cell'>" + getDataSummary(val) + "</td>");
              document.write("</tr>");
            }
          }
    
          if (info["featureSets"]) {
            for (const featureName in info.featureSets) {
              const feature = info.featureSets[featureName];
    
              for (const measureName in feature) {
                const val = feature[measureName];

                 document.write("<tr>");
                document.write("<td class='summary-key items-cell'>" + featureName + " " + measureName + "</td>");
                document.write("<td class='summary-value items-cell'>" + getDataSummary(val) + "</td>");
                document.write("</tr>");
              }
            }
          }
        }
        document.write("</table>");
      }
    
    
      for (let i=0; i<_reportObjects.length; i++) {
        document.write("<h3>Items</h3>");
        document.write("<table class='items-table'>");
        const info = _reportObjects[i].info;
    
    
        const items = _reportObjects[i].items;
    
        if (items && items.length) {
          for (const item of items) {
            if (item.itemType !== 2) {
              document.write("<tr>");
              document.write("<td class='items-type items-cell'>" + getDescriptionForItemType(item.iTp) + "</td>");
              document.write("<td class='items-generator items-cell'>" + item.gId + "</td>");
              document.write("<td class='items-generatorIndex items-cell'>" + item.gIx + "</td>");
              document.write("<td class='items-message items-cell'>" + getEmptySummary(item.m) + "</td>");
              document.write("<td class='items-data items-cell'>" + getEmptySummary(item.d) + "</td>");
              document.write("<td class='items-path items-cell'>" + getEmptySummary(item.p) + "</td>");
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
        border: solid 1px #606060;
        padding: 0px;
        max-width: 100vw;
      }
    
      .items-cell {
        border: solid 1px #606060;
        padding: 4px;
        vertical-align: top;
        font-size: x-small;
        overflow-wrap: anywhere;
        max-width: 25vw;
      }
    
      .summary-table {
        border: solid 1px #606060;
        padding: 0px;
        max-width: 100vw;
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

    if (!this.info || !this.info.featureSets) {
      return 0;
    }
    /*
    let val = this.info.featureSets["Animation content-size total"];
    if (val) {
      red += val * 0.2;
    }

    val = this.info.featureSets["Animation controller content-size total"];
    if (val) {
      red += val * 0.5;
    }

    val = this.info.featureSets["Attachable content-size total"];
    if (val) {
      red += val * 0.1;
    }

    val = this.info.featureSets["Function content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Tick content-size total"];
    if (val) {
      red += val * 20;
    }

    val = this.info.featureSets["Command execute"];
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["Behavior pack animation content-size total"];
    if (val) {
      red += val * 0.8;
    }

    val = this.info.featureSets["Behavior pack animation controller content-size total"];
    if (val) {
      red += val * 1.2;
    }

    val = this.info.featureSets["Biome resources content-size total"];
    if (val) {
      red += val * 1.2;
    }

    val = this.info.featureSets["Block minecraft:chain_command_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["Block minecraft:command_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["Block minecraft:repeating_command_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["Block minecraft:structure_block"];
    if (val) {
      red += val * 8;
    }

    val = this.info.featureSets["Block minecraft:observer"];
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["Block minecraft:comparator"];
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["Block minecraft:dropper"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Block minecraft:hopper"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Block minecraft:pressure_plate"];
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["Block minecraft:lever"];
    if (val) {
      red += val * 4;
    }

    val = this.info.featureSets["Block minecraft:lit_redstone_lamp"];
    if (val) {
      red += val;
    }

    val = this.info.featureSets["Block minecraft:redstone_block"];
    if (val) {
      red += val;
    }

    val = this.info.featureSets["Block minecraft:redstone_torch"];
    if (val) {
      red += val;
    }

    val = this.info.featureSets["Block minecraft:redstone_wire"];
    if (val) {
      red += val;
    }

    val = this.info.featureSets["Block type content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Entity dialogue content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Entity type content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Entity type resources content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["Item type content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Item type resources content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["JavaScript content-size total"];
    if (val) {
      red += val * 2;
    }

    val = this.info.featureSets["Loot table content-size total"];
    if (val) {
      red += val;
    }

    val = this.info.featureSets["Model content-size total"];
    if (val) {
      red += val * 0.1;
    }

    val = this.info.featureSets["Particle content-size total"];
    if (val) {
      red += val * 0.4;
    }

    val = this.info.featureSets["Recipe content-size total"];
    if (val) {
      red += val * 0.4;
    }

    val = this.info.featureSets["Render controller content-size total"];
    if (val) {
      red += val * 0.5;
    }

    val = this.info.featureSets["Spawn rule content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["Trading content-size total"];
    if (val) {
      red += val * 1;
    }

    val = this.info.featureSets["User interface content-size total"];
    if (val) {
      red += val * 2;
    }*/

    return red;
  }

  getSummaryCsvLine(
    containerName: string,
    title: string,
    allFeatures: { [setName: string]: { [measureName: string]: number | undefined } | undefined } | undefined
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

    for (const str in this.info) {
      if (ProjectInfoSet.isAggregableFieldName(str)) {
        fieldNames.push(str);
      }
    }

    fieldNames = fieldNames.sort(ProjectInfoSet.sortMinecraftFeatures);

    for (const str of fieldNames) {
      // @ts-ignore
      line += ProjectInfoSet.getDataSummary(this.info[str]) + ",";
    }

    if (this.info.featureSets) {
      for (const featureName in allFeatures) {
        const allFeature = allFeatures[featureName];
        const thisFeature = this.info.featureSets[featureName];

        if (allFeature) {
          for (const measureName in allFeature) {
            if (ProjectInfoSet.isAggregableFeatureMeasureName(measureName)) {
              if (thisFeature) {
                const measure = thisFeature[measureName];

                if (measure !== undefined) {
                  if (typeof measure === "number") {
                    line += measure;
                  }
                }
              }
              line += ",";
            }
          }
        }
      }
    }

    return line;
  }

  getItemCsvLines(): string[] {
    const lines: string[] = [];

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];

      if (item.itemType !== InfoItemType.featureAggregate) {
        let sp = "";

        if (item.projectItem && item.projectItem.storagePath) {
          sp = item.projectItem.storagePath;
        }

        let data: string | number | boolean | object = "";
        if (item.data) {
          if (typeof item.data === "object") {
            data = JSON.stringify(item.data);
          } else {
            data = item.data;
          }
        }

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
          '","' +
          data +
          '",' +
          sp +
          ",";

        if (item.data) {
          if (typeof item.data === "string") {
            line += '"' + item.data + '"';
          } else {
            line += item.data.toString();
          }
        }

        if (item.featureSets) {
          for (const featName in item.featureSets) {
            const feature = item.featureSets[featName];

            if (feature) {
              for (const measureName in feature) {
                if (ProjectInfoSet.isAggregableFeatureMeasureName(measureName)) {
                  const measure = feature[measureName];

                  if (measure !== undefined) {
                    if (typeof measure === "number") {
                      line += featName + " " + measureName + "," + measure + ",";
                    } else if (typeof measure === "string") {
                      line += featName + " " + measureName + ',"' + measure + '",';
                    }
                  }
                }
              }
            }
          }
        }

        lines.push(line);
      }
    }

    return lines;
  }

  getItems(generatorId: string, itemIndex: number) {
    const resultItems: ProjectInfoItem[] = [];

    for (const genItem of this.items) {
      if (genItem.generatorId === generatorId && genItem.generatorIndex === itemIndex) {
        resultItems.push(genItem);
      }
    }

    return resultItems;
  }

  getItemsByType(generatorId: string, itemType: InfoItemType) {
    return ProjectInfoSet.getItemsInCollectionByType(this.items, generatorId, itemType);
  }

  getItemsByStoragePath(path: string) {
    if (!this.itemsByStoragePath) {
      return;
    }

    return this.itemsByStoragePath[path];
  }
  static getItemsInCollectionByType(genItems: ProjectInfoItem[], generatorId: string, itemType: InfoItemType) {
    const resultItems: ProjectInfoItem[] = [];

    for (const genItem of genItems) {
      if (genItem.generatorId === generatorId && genItem.itemType === itemType) {
        resultItems.push(genItem);
      }
    }

    return resultItems;
  }

  async processFolder(
    project: Project,
    folder: IFolder,
    genItems: ProjectInfoItem[],
    genItemsByStoragePath: { [storagePath: string]: ProjectInfoItem[] | undefined },
    genContentIndex: ContentIndex,
    fileGenerators: IProjectFileInfoGenerator[],
    depth: number
  ) {
    await folder.load(false);

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        const projectItem = project.getItemByFile(file);
        if (projectItem && projectItem.storagePath) {
          genContentIndex.insert(StorageUtilities.getBaseFromName(fileName), projectItem.storagePath);
          genContentIndex.insert(folder.storageRelativePath, projectItem.storagePath);

          await file.loadContent();

          if (file.content && typeof file.content === "string") {
            const fileExtension = StorageUtilities.getTypeFromName(fileName);

            if (projectItem && projectItem.storagePath) {
              switch (fileExtension) {
                case "json":
                  genContentIndex.parseJsonContent(projectItem.storagePath, file.content);
                  break;
                case "ts":
                case "js":
                  genContentIndex.parseJsContent(projectItem.storagePath, file.content);
                  break;
              }
            }
          }

          for (const fileGen of fileGenerators) {
            if (this.matchesSuite(fileGen)) {
              try {
                const results = await fileGen.generate(project, file, genContentIndex);

                for (const item of results) {
                  this.pushItem(genItems, genItemsByStoragePath, item);
                }
              } catch (e: any) {
                genItems.push(new ProjectInfoItem(InfoItemType.internalProcessingError, fileGen.id, 502, e.toString()));
              }
            }
          }
          if (StorageUtilities.isContainerFile(file.storageRelativePath)) {
            const zipFolder = await StorageUtilities.getFileStorageFolder(file);

            if (zipFolder) {
              await this.processFolder(
                project,
                zipFolder,
                genItems,
                genItemsByStoragePath,
                genContentIndex,
                fileGenerators,
                depth + 1
              );
            }
          }
        }
      }
    }

    if (depth < 15) {
      for (const folderName in folder.folders) {
        const childFolder = folder.folders[folderName];

        if (childFolder && !childFolder.errorStatus && childFolder.name) {
          const name = childFolder.name.toLowerCase();

          if ((!name.startsWith(".") || name.startsWith(".vscode")) && !name.startsWith("node_modules")) {
            await this.processFolder(
              project,
              childFolder,
              genItems,
              genItemsByStoragePath,
              genContentIndex,
              fileGenerators,
              depth + 1
            );
          }
        }
      }
    }
  }

  generateProjectMetaInfo() {
    this.info = {};

    const projGenerators: IProjectInfoGenerator[] = GeneratorRegistrations.projectGenerators;
    const itemGenerators: IProjectItemInfoGenerator[] = GeneratorRegistrations.itemGenerators;
    const fileGenerators: IProjectFileInfoGenerator[] = GeneratorRegistrations.fileGenerators;

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

  removeItems(validatorName: string, validatorIds: number[]) {
    const itemsNext = [];
    for (const item of this.items) {
      if (item.generatorId !== validatorName || !validatorIds.includes(item.generatorIndex)) {
        itemsNext.push(item);
      }
    }

    this.items = itemsNext;
  }

  getGeneratorForItem(item: ProjectInfoItem): IProjectInfoGeneratorBase | undefined {
    const itemGens = GeneratorRegistrations.itemGenerators;

    for (const itemGen of itemGens) {
      if (itemGen.id === item.generatorId) {
        return itemGen;
      }
    }

    const fileGens = GeneratorRegistrations.fileGenerators;
    for (const fileGen of fileGens) {
      if (fileGen.id === item.generatorId) {
        return fileGen;
      }
    }

    const projGens = GeneratorRegistrations.projectGenerators;

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

    this.info.featureSets = {};

    for (const item of this.items) {
      if (item.featureSets) {
        for (const featureSetName in item.featureSets) {
          const featureSet = item.featureSets[featureSetName];

          const aggFeatureSetName = this.getItemSummary(item) + " " + featureSetName;

          for (const measureName in featureSet) {
            const measure = featureSet[measureName];

            if (typeof measure === "number") {
              let feature = this.info.featureSets[aggFeatureSetName];

              if (feature === undefined) {
                feature = {};
                this.info.featureSets[aggFeatureSetName] = feature;
              }

              let aggVal = feature[measureName];

              if (aggVal === undefined) {
                aggVal = measure;
              } else if (measureName.startsWith("Max ")) {
                aggVal = Math.max(aggVal, measure);
              } else if (featureSetName.startsWith("Min ")) {
                aggVal = Math.min(aggVal, measure);
              } else {
                aggVal += measure;
              }

              feature[measureName] = aggVal;
            }
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

  async getInfoForItem(projectItem: ProjectItem, contentIndex: ContentIndex) {
    const itemGenerators: IProjectItemInfoGenerator[] = GeneratorRegistrations.itemGenerators;
    let genItems: ProjectInfoItem[] = [];

    await projectItem.load();

    for (let j = 0; j < itemGenerators.length; j++) {
      try {
        const infoItems = await itemGenerators[j].generate(projectItem, contentIndex);

        for (const infoItem of infoItems) {
          genItems.push(infoItem);
        }
      } catch (e: any) {
        genItems.push(
          new ProjectInfoItem(InfoItemType.internalProcessingError, itemGenerators[j].id, 504, e.toString())
        );
      }
    }

    return genItems;
  }
}
