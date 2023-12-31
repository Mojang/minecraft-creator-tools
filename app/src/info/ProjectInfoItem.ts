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

  set message(newMessage: string) {
    this.#data.message = newMessage;
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

  set data(data: string | boolean | number | object | number[] | undefined) {
    this.#data.data = data;
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

  disconnect() {
    this.#projectItem = undefined;
  }

  get typeSummary() {
    switch (this.#data.itemType) {
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

  spectrumFeature(name: string, newValue: number) {
    if (this.#data.features === undefined) {
      this.#data.features = {};
    }

    this.incrementFeature(name + " count", 1);
    this.incrementFeature(name + " total", newValue);
    this.maxFeature(name + " max", newValue);
    this.minFeature(name + " min", newValue);

    const curTotal = this.#data.features[name + " total"];
    const curCount = this.#data.features[name + " count"];

    if (curCount && curTotal !== undefined) {
      this.#data.features[name + " average"] = curTotal / curCount;
    }
  }

  spectrumIntFeature(name: string, newValue: number) {
    if (this.#data.features === undefined) {
      this.#data.features = {};
    }

    this.incrementFeature(name + " count", 1);
    this.incrementFeature(name + " total", newValue);
    this.maxFeature(name + " max", newValue);
    this.minFeature(name + " min", newValue);

    const curTotal = this.#data.features[name + " total"];
    const curCount = this.#data.features[name + " count"];

    if (curCount && curTotal !== undefined) {
      this.#data.features[name + " average"] = Math.round(curTotal / curCount);
    }
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
