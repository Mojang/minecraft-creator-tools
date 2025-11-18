// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectItem from "../app/ProjectItem";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import IInfoItemData from "./IInfoItemData";
import { InfoItemType } from "./IInfoItemData";

export default class ProjectInfoItem {
  #data: IInfoItemData;
  #projectItem?: ProjectItem;

  get dataObject() {
    return this.#data;
  }

  get itemType() {
    return this.#data.iTp;
  }

  get message() {
    return this.#data.m;
  }

  set message(newMessage: string | undefined) {
    this.#data.m = newMessage;
  }

  get generatorId() {
    return this.#data.gId;
  }

  get generatorIndex() {
    return this.#data.gIx;
  }

  get projectItem() {
    return this.#projectItem;
  }

  get data() {
    return this.#data.d;
  }

  set data(data: string | boolean | number | number[] | undefined) {
    this.#data.d = data;
  }

  get content() {
    return this.#data.c;
  }

  get featureSets() {
    return this.#data.fs;
  }

  get contentSummary() {
    let errorContent = this.#data.c;
    if (errorContent) {
      errorContent = errorContent.replace(/\n/gi, " ");
      errorContent = errorContent.replace(/\r/gi, " ");

      if (errorContent.length > 80) {
        errorContent = errorContent.substring(0, 77) + "...";
      }
    }

    return errorContent;
  }

  disconnect() {
    this.#projectItem = undefined;
  }

  get typeSummary() {
    switch (this.#data.iTp) {
      case InfoItemType.info:
        return "Info";

      case InfoItemType.warning:
        return "Warning";

      case InfoItemType.recommendation:
        return "Recommendation";

      case InfoItemType.featureAggregate:
        return "Feature aggregation";

      case InfoItemType.testCompleteFail:
        return "Test fail";

      case InfoItemType.testCompleteSuccess:
        return "Test success";

      case InfoItemType.error:
        return "Error";

      default:
        return "Unknown";
    }
  }

  get projectItemPath() {
    if (this.projectItem) {
      return this.projectItem.projectPath;
    } else if (this.#data.p) {
      return this.#data.p;
    }

    return undefined;
  }

  get shortProjectItemPath() {
    if (this.projectItem && this.projectItem.projectPath) {
      return MinecraftUtilities.getAfterPackPath(this.projectItem.projectPath);
    } else if (this.#data.p) {
      return MinecraftUtilities.getAfterPackPath(this.#data.p);
    }

    return undefined;
  }

  get typeSummaryShort() {
    let short = this.typeSummary.toUpperCase();

    short = short.replace(/\s/g, "");

    return short;
  }

  toString() {
    let summaryString = this.typeSummaryShort + ": ";

    summaryString += "[" + this.generatorId + Utilities.frontPadToLength(this.generatorIndex, 3, "0") + "] ";

    if (this.projectItem) {
      summaryString += "(" + this.projectItem.projectPath + ") ";
    } else if (this.#data.p) {
      summaryString += "(" + this.#data.p + ") ";
    }

    if (this.message) {
      summaryString += this.message;
    }

    if (this.data) {
      summaryString += ": " + this.data;
    }

    const errorContent = this.contentSummary;

    if (errorContent) {
      summaryString += " [in " + errorContent + "]";
    }

    return summaryString;
  }

  minFeature(setName: string, measureName: string, newValue: number) {
    if (this.#data.fs === undefined) {
      this.#data.fs = {};
    }

    setName = Utilities.convertToJsonKey(setName);
    measureName = Utilities.convertToJsonKey(measureName);

    if (!Utilities.isUsableAsObjectKey(setName)) {
      Log.unsupportedToken(setName);
      throw new Error();
    }

    let setVal = this.#data.fs[setName];

    if (setVal === undefined) {
      setVal = {};

      this.#data.fs[setName] = setVal;
    }

    let curVal = setVal[measureName];

    if (curVal === undefined) {
      curVal = newValue;
    } else {
      curVal = Math.min(curVal, newValue);
    }

    setVal[measureName] = curVal;
  }

  maxFeature(setName: string, measureName: string, newValue: number) {
    if (this.#data.fs === undefined) {
      this.#data.fs = {};
    }

    setName = Utilities.convertToJsonKey(setName);
    measureName = Utilities.convertToJsonKey(measureName);

    if (!Utilities.isUsableAsObjectKey(setName)) {
      Log.unsupportedToken(setName);
      throw new Error();
    }

    let setVal = this.#data.fs[setName];

    if (setVal === undefined) {
      setVal = {};

      this.#data.fs[setName] = setVal;
    }

    let curVal = setVal[measureName];

    if (curVal === undefined) {
      curVal = newValue;
    } else {
      curVal = Math.max(curVal, newValue);
    }

    setVal[measureName] = curVal;
  }

  getFeatureContaining(token: string) {
    token = token.toLowerCase();

    for (const setName in this.#data.fs) {
      const featureSet = this.#data.fs[setName];

      if (featureSet) {
        for (const measureName in featureSet) {
          if (measureName.toLowerCase().indexOf(token) >= 0) {
            return featureSet[measureName];
          }
        }
      }
    }

    return undefined;
  }

  getFeatureMeasureNumber(setName: string, measure: string) {
    measure = measure.toLowerCase();

    if (!this.#data.fs) {
      return 0;
    }

    setName = Utilities.convertToJsonKey(setName);

    const featureSet = this.#data.fs[setName];

    if (featureSet) {
      for (const measureName in featureSet) {
        if (measureName.toLowerCase() === measure) {
          return featureSet[measureName];
        }
      }
    }

    return 0;
  }

  getNonZeroFeatureMeasures(): string[] {
    const results: string[] = [];

    if (!this.#data.fs) {
      return results;
    }

    for (const setName in this.#data.fs) {
      const featureSet = this.#data.fs[setName];

      if (featureSet) {
        for (const measureName in featureSet) {
          const val = featureSet[measureName];
          if (
            val !== undefined &&
            typeof val === "number" &&
            val > 0 &&
            (measureName === "count" || measureName === "instanceCount")
          ) {
            results.push(setName);
          }
        }
      }
    }

    return results;
  }

  spectrumFeature(setName: string, newValue: number) {
    if (this.#data.fs === undefined) {
      this.#data.fs = {};
    }

    setName = Utilities.convertToJsonKey(setName);

    if (!Utilities.isUsableAsObjectKey(setName)) {
      Log.unsupportedToken(setName);
      throw new Error();
    }

    this.incrementFeature(setName, "instanceCount", 1);
    this.incrementFeature(setName, "total", newValue);
    this.maxFeature(setName, "max", newValue);
    this.minFeature(setName, "min", newValue);

    let setVal = this.#data.fs[setName];

    if (setVal === undefined) {
      setVal = {};

      this.#data.fs[setName] = setVal;
    }

    const curTotal = setVal["total"];
    const curCount = setVal["instanceCount"];

    if (curCount && curTotal !== undefined) {
      setVal["average"] = curTotal / curCount;
    }
  }

  spectrumIntFeature(setName: string, newValue: number) {
    if (this.#data.fs === undefined) {
      this.#data.fs = {};
    }

    setName = Utilities.convertToJsonKey(setName);

    let setVal = this.#data.fs[setName];

    if (setVal === undefined) {
      setVal = {};

      this.#data.fs[setName] = setVal;
    }

    this.incrementFeature(setName, "instanceCount", 1);
    this.incrementFeature(setName, "total", newValue);

    this.maxFeature(setName, "max", newValue);
    this.minFeature(setName, "min", newValue);

    const curTotal = setVal["total"];
    const curCount = setVal["instanceCount"];

    if (curCount && curTotal !== undefined) {
      setVal["average"] = Math.round(curTotal / curCount);
    }
  }

  incrementFeature(setName: string, measureName: string = "count", incrementalValue: number = 1) {
    if (this.#data.fs === undefined) {
      this.#data.fs = {};
    }

    setName = Utilities.convertToJsonKey(setName);
    measureName = Utilities.convertToJsonKey(measureName);

    if (!Utilities.isUsableAsObjectKey(setName)) {
      return;
    }

    let setVal = this.#data.fs[setName];

    if (setVal === undefined) {
      setVal = this.#data.fs[setName] = {};
    }

    setVal[measureName] = (setVal[measureName] ?? 0) + incrementalValue;
  }

  setFeature(setName: string, measureName: string, value: number) {
    if (this.#data.fs === undefined) {
      this.#data.fs = {};
    }

    setName = Utilities.convertToJsonKey(setName);
    measureName = Utilities.convertToJsonKey(measureName);

    if (!Utilities.isUsableAsObjectKey(setName)) {
      return;
    }

    let setVal = this.#data.fs[setName];
    if (setVal === undefined) {
      setVal = this.#data.fs[setName] = {};
    }

    setVal[measureName] = value;
  }

  constructor(
    itemType: InfoItemType,
    generatorId: string,
    generatorIndex: number,
    message?: string,
    projectItem?: ProjectItem,
    data?: string | boolean | number | number[],
    itemId?: string,
    content?: string,
    projectItemPath?: string
  ) {
    this.#data = {
      iTp: itemType,
      gId: generatorId,
      gIx: generatorIndex,
      m: message,
      p: projectItem ? projectItem.projectPath : projectItemPath,
      d: data,
      iId: itemId,
      c: content,
      fs: undefined,
    };

    this.#projectItem = projectItem;
  }
}
