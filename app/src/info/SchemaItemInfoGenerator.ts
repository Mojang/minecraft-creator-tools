// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import Database from "../minecraft/Database";
import CartoApp from "../app/CartoApp";

import axios from "axios";
import ProjectInfoSet from "./ProjectInfoSet";
import Utilities from "../core/Utilities";
import ContentIndex from "../core/ContentIndex";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { JSONSchema7, validate } from "json-schema";

const JsonSchemaErrorBase = 100;
const NotCurrentFormatVersionBase = 1100;

export enum SchemaItemInfoGeneratorTest {
  couldNotParseJson = 1,
}

export default class SchemaItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "JSON";
  title = "JSON Structure Validation";
  canAlwaysProcess = true;

  _schemaContentByPath: { [id: string]: object } = {};

  constructor() {
    this.loadSchema = this.loadSchema.bind(this);
  }

  getTopicData(topicId: number) {
    return {
      title: topicId.toString(),
    };
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async loadSchema(uri: string) {
    const res = await axios.get(Utilities.ensureEndsWithSlash(CartoApp.contentRoot) + uri);
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
        let verIsCurrent = await MinecraftDefinitions.formatVersionIsCurrent(projectItem);

        if (verIsCurrent) {
          let schemaContents: JSONSchema7 | undefined = this._schemaContentByPath[schemaPath] as
            | JSONSchema7
            | undefined;

          if (!schemaContents) {
            schemaContents = await Database.getSchema(schemaPath);

            if (schemaContents) {
              this._schemaContentByPath[schemaPath] = schemaContents;
            }
          }

          if (schemaContents) {
            let content = projectItem.primaryFile.content;
            let contentObj = undefined;

            content = Utilities.fixJsonContent(content);

            try {
              contentObj = JSON.parse(content);
              const results = validate(contentObj, schemaContents);

              for (const err of results.errors) {
                items.push(
                  new ProjectInfoItem(
                    InfoItemType.warning,
                    this.id,
                    JsonSchemaErrorBase + projectItem.itemType,
                    `JSON structure error`,
                    projectItem,
                    `(${err.property}) ${err.message}`
                  )
                );
              }
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
}
