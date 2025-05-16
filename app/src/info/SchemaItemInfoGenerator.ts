// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import Database from "../minecraft/Database";
import CartoApp from "../app/CartoApp";
import { ErrorObject, ValidateFunction } from "ajv";
import Ajv from "ajv";

import axios from "axios";
import ProjectInfoSet from "./ProjectInfoSet";
import Utilities from "../core/Utilities";
import ContentIndex from "../core/ContentIndex";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import ProjectItemUtilities from "../app/ProjectItemUtilities";

const JsonSchemaErrorBase = 100;
const NotCurrentFormatVersionBase = 1100;

export enum SchemaItemInfoGeneratorTest {
  couldNotParseJson = 1,
}

export default class SchemaItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "JSON";
  title = "JSON Schema Validation";
  canAlwaysProcess = true;

  _validatorsByPath: { [id: string]: ValidateFunction } = {};
  _schemaContentByPath: { [id: string]: object } = {};

  uuidRegex = new RegExp("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");

  constructor() {
    this.loadSchema = this.loadSchema.bind(this);
    this.testUuid = this.testUuid.bind(this);
    this.testUri = this.testUri.bind(this);
  }

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async loadSchema(uri: string) {
    console.log("Retrieving " + uri);
    const res = await axios.get(Utilities.ensureEndsWithSlash(CartoApp.contentRoot) + uri);

    console.log("Loading error: " + JSON.stringify(res.data));
    return res.data;
  }

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (
      projectItem.primaryFile &&
      projectItem.primaryFile.content &&
      typeof projectItem.primaryFile.content === "string"
    ) {
      const schemaPath = projectItem.getSchemaPath();

      if (schemaPath) {
        let val = this._validatorsByPath[schemaPath];

        let verIsCurrent = await MinecraftDefinitions.formatVersionIsCurrent(projectItem);

        if (verIsCurrent) {
          if (!val) {
            const schemaContents = await Database.getSchema(schemaPath);

            if (schemaContents) {
              const ajv = new Ajv({
                allErrors: true,
                loadSchema: this.loadSchema,
                strict: false,
                unicodeRegExp: false,
                verbose: true,
              });

              ajv.addFormat("uuid", this.testUuid);
              ajv.addFormat("uri", this.testUri);
              ajv.addFormat("color-hex", this.testUnknownFormat);
              ajv.addFormat("colox-hex", this.testUnknownFormat);
              ajv.addFormat("molang", this.testUnknownFormat);

              val = ajv.compile(schemaContents);

              this._validatorsByPath[schemaPath] = val;
              this._schemaContentByPath[schemaPath] = schemaContents;
            }
          }

          if (val) {
            let content = projectItem.primaryFile.content;
            let contentObj = undefined;

            content = Utilities.fixJsonContent(content);

            try {
              contentObj = JSON.parse(content);
            } catch (e: any) {
              let errorMess: any = e;

              if (e.message) {
                errorMess = e.message;
              }

              items.push(
                new ProjectInfoItem(
                  InfoItemType.error,
                  this.id,
                  SchemaItemInfoGeneratorTest.couldNotParseJson,
                  "Could not parse JSON - " + errorMess,
                  projectItem
                )
              );
            }

            if (contentObj) {
              const result = val(contentObj);

              if (!result && val.errors) {
                for (let i = 0; i < val.errors.length; i++) {
                  const err = val.errors[i];

                  this.addError(items, projectItem, err);
                }
              }
            }
          }
        } else {
          let fvStr = "";

          const fv = await MinecraftDefinitions.getFormatVersion(projectItem);

          if (fv) {
            fvStr = " (is at " + fv.join(".") + ")";
          }

          items.push(
            new ProjectInfoItem(
              InfoItemType.info,
              this.id,
              NotCurrentFormatVersionBase + projectItem.itemType,
              ProjectItemUtilities.getDescriptionForType(projectItem.itemType) +
                " is not at a current format version" +
                fvStr,
              projectItem
            )
          );
        }
      }
    }

    return items;
  }

  addError(
    items: ProjectInfoItem[],
    projectItem: ProjectItem,
    error: ErrorObject<string, Record<string, any>, unknown>
  ) {
    var message = "";

    switch (error.keyword) {
      case "required":
        message = 'Property "' + error.params.missingProperty + '" missing';
        break;
      case "type":
        message = "Wrong type: " + error.instancePath + " " + error.keyword + " " + error.message;
        break;
      default:
        message = error.keyword + " " + error.instancePath + " " + error.message;
        break;
    }

    let errorContent = undefined;

    if (typeof error.data === "string") {
      errorContent = error.data;
    } else if (typeof error.data === "object") {
      let serial = undefined;

      try {
        serial = JSON.stringify(error.data, null, 2);
      } catch (e) {}

      errorContent = serial;
    }

    if (errorContent && errorContent.length > 100) {
      errorContent = errorContent.substring(0, 99);
    }

    let data = undefined;

    if (error.params) {
      for (const key in error.params) {
        let val = error.params[key];

        if (
          typeof val === "string" &&
          key !== "type" &&
          key !== "pattern" &&
          key !== "missingProperty" &&
          key !== "comparison" &&
          key !== "failingKeyword"
        ) {
          // force line breaks in long strings
          if (val.length > 80 && val.indexOf(" ") < 0) {
            val = val.replace(/,/gi, ", ");
          }

          if (data === undefined) {
            data = "";
          } else {
            data += " ";
          }

          if (data.length < 100 && val.length < 100 && key.length < 100) {
            data += "(" + key + ": " + val + ")";
          }
        }
      }
    }

    items.push(
      new ProjectInfoItem(
        InfoItemType.warning,
        this.id,
        JsonSchemaErrorBase + projectItem.itemType,
        message,
        projectItem,
        data,
        undefined,
        errorContent
      )
    );
  }

  testUuid(uuidString: string) {
    return this.uuidRegex.test(uuidString);
  }

  testUnknownFormat(formatString: string) {
    return true;
  }

  testUri(uriString: string) {
    // could get much more sophisticated here...
    return uriString.indexOf("://") >= 0;
  }
}
