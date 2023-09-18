import ProjectItem from "../app/ProjectItem";
import Utilities from "../core/Utilities";
import IUpdateResult, { UpdateResultType } from "./IUpdateResult";

export default class ProjectUpdateResult {
  #data: IUpdateResult;

  get dataObject() {
    return this.#data;
  }

  get resultType() {
    return this.#data.resultType;
  }

  get message() {
    return this.#data.message;
  }

  get updaterId() {
    return this.#data.updaterId;
  }

  get updaterIndex() {
    return this.#data.updaterIndex;
  }

  get data() {
    return this.#data.data;
  }

  get content() {
    return this.#data.content;
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
    switch (this.#data.resultType) {
      case UpdateResultType.noChange:
        return "No changes";

      case UpdateResultType.updatedFile:
        return "Updated file";

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

    summaryString += "[" + this.updaterId + Utilities.frontPadToLength(this.updaterIndex, 3, "0") + "] ";

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

  constructor(
    resultType: UpdateResultType,
    updaterId: string,
    updaterIndex: number,
    message: string,
    projectItem?: ProjectItem,
    data?: string | boolean | number | object | number[],
    itemId?: string,
    content?: string
  ) {
    this.#data = {
      resultType: resultType,
      updaterId: updaterId,
      updaterIndex: updaterIndex,
      message: message,
      itemStoragePath: projectItem ? projectItem.storagePath : undefined,
      data: data,
      itemId: itemId,
      content: content,
    };
  }
}
