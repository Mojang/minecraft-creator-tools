import ProjectItem from "../app/ProjectItem";
import Utilities from "../core/Utilities";
import IInfoItemData from "./IInfoItemData";
import { InfoItemType } from "./IInfoItemData";

export default class ProjectInfoItem {
  #data: IInfoItemData;
  #projectItem?: ProjectItem;

  get dataObject() {
    return this.#data;
  }

  get itemType() {
    return this.#data.itemType;
  }

  get message() {
    return this.#data.message;
  }

  get generatorId() {
    return this.#data.generatorId;
  }

  get generatorIndex() {
    return this.#data.generatorIndex;
  }

  get projectItem() {
    return this.#projectItem;
  }

  get data() {
    return this.#data.data;
  }

  get content() {
    return this.#data.content;
  }

  get features() {
    return this.#data.features;
  }

  get contentSummary() {
    let errorContent = this.#data.content;
    if (errorContent) {
      errorContent = errorContent.replace(/\n/gi, " ");
      errorContent = errorContent.replace(/\r/gi, " ");

      if (errorContent.length > 80) {
        errorContent = errorContent.substring(0, 77) + "...";
      }
    }

    return errorContent;
  }

  get typeSummary() {
    switch (this.#data.itemType) {
      case InfoItemType.info:
        return "Info";

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

  get typeSummaryShort() {
    let short = this.typeSummary.toUpperCase();

    short = short.replace(/\s/g, "");

    return short;
  }

  toString() {
    let summaryString = this.typeSummaryShort + ": ";

    summaryString += "[" + this.generatorId + Utilities.frontPadToLength(this.generatorIndex, 3, "0") + "] ";

    if (this.projectItem) {
      summaryString += "(" + this.projectItem.storagePath + ") ";
    }

    summaryString += this.message;

    if (this.data) {
      summaryString += ": " + this.data;
    }

    const errorContent = this.contentSummary;

    if (errorContent) {
      summaryString += " [in " + errorContent + "]";
    }

    return summaryString;
  }

  minFeature(name: string, newValue: number) {
    if (this.#data.features === undefined) {
      this.#data.features = {};
    }

    let curVal = this.#data.features[name];

    if (curVal === undefined) {
      curVal = newValue;
    } else {
      curVal = Math.min(curVal, newValue);
    }

    this.#data.features[name] = curVal;
  }

  maxFeature(name: string, newValue: number) {
    if (this.#data.features === undefined) {
      this.#data.features = {};
    }

    let curVal = this.#data.features[name];

    if (curVal === undefined) {
      curVal = newValue;
    } else {
      curVal = Math.max(curVal, newValue);
    }

    this.#data.features[name] = curVal;
  }

  incrementFeature(name: string, incrementalValue?: number) {
    if (this.#data.features === undefined) {
      this.#data.features = {};
    }

    if (!incrementalValue) {
      incrementalValue = 1;
    }

    let curVal = this.#data.features[name];

    if (!curVal) {
      curVal = incrementalValue;
    } else {
      curVal += incrementalValue;
    }

    this.#data.features[name] = curVal;
  }

  constructor(
    itemType: InfoItemType,
    generatorId: string,
    generatorIndex: number,
    message: string,
    projectItem?: ProjectItem,
    data?: string | boolean | number | object | number[],
    itemId?: string,
    content?: string
  ) {
    this.#data = {
      itemType: itemType,
      generatorId: generatorId,
      generatorIndex: generatorIndex,
      message: message,
      itemStoragePath: projectItem ? projectItem.storagePath : undefined,
      data: data,
      itemId: itemId,
      content: content,
      features: undefined,
    };

    this.#projectItem = projectItem;
  }
}
