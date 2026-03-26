// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "./ProjectInfoItem";
import ProjectItem from "../app/ProjectItem";
import IProjectInfoItemGenerator from "./IProjectItemInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import Database from "../minecraft/Database";
import CreatorToolsHost from "../app/CreatorToolsHost";

import axios from "axios";
import ProjectInfoSet from "./ProjectInfoSet";
import Utilities from "../core/Utilities";
import ContentIndex from "../core/ContentIndex";
import MinecraftDefinitions from "../minecraft/MinecraftDefinitions";
import ProjectItemUtilities from "../app/ProjectItemUtilities";
import { JSONSchema7, validate } from "json-schema";

const JsonSchemaErrorBase = 100;
const NotCurrentFormatVersionBase = 1100;

export enum CommunitySchemaItemInfoGeneratorTest {
  couldNotParseJson = 1,
}

/**
 * Validates JSON files against JSON schema definitions.
 *
 * @see {@link ../../public/data/forms/mctoolsval/comjson.form.json} for topic definitions
 */
export default class CommunitySchemaItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "COMJSON";
  title = "Community JSON Schema Validation";
  canAlwaysProcess = true;

  _schemaContentByPath: { [id: string]: object } = {};

  constructor() {
    this.loadSchema = this.loadSchema.bind(this);
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async loadSchema(uri: string) {
    const res = await axios.get(Utilities.ensureEndsWithSlash(CreatorToolsHost.contentWebRoot) + uri);
    return res.data;
  }

  async generate(projectItem: ProjectItem, contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    if (
      projectItem.primaryFile &&
      projectItem.primaryFile.content &&
      typeof projectItem.primaryFile.content === "string"
    ) {
      const schemaPath = projectItem.getCommunitySchemaPath();

      if (schemaPath) {
        let verIsCurrent = await MinecraftDefinitions.formatVersionIsCurrent(projectItem);

        if (verIsCurrent) {
          let schemaContents: JSONSchema7 | undefined = this._schemaContentByPath[schemaPath] as
            | JSONSchema7
            | undefined;

          if (!schemaContents) {
            schemaContents = await Database.getCommunitySchema(schemaPath);

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
                  CommunitySchemaItemInfoGeneratorTest.couldNotParseJson,
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
