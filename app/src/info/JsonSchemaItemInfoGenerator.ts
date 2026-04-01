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

export enum JsonSchemaItemInfoGeneratorTest {
  couldNotParseJson = 1,
}

/**
 * Validates JSON files against official JSON schema definitions at public/schemas.
 *
 * @see {@link ../../public/data/forms/mctoolsval/json.form.json} for topic definitions
 */
export default class JsonSchemaItemInfoGenerator implements IProjectInfoItemGenerator {
  id = "JSON";
  title = "JSON Schema Validation";
  canAlwaysProcess = true;

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
      const schemaPath = projectItem.getOfficialSchemaPath();

      if (schemaPath) {
        let verIsCurrent = await MinecraftDefinitions.formatVersionIsCurrent(projectItem);

        if (verIsCurrent) {
          let schemaContents: JSONSchema7 | undefined = (await Database.getOfficialSchema(schemaPath)) as
            | JSONSchema7
            | undefined;

          if (schemaContents) {
            let content = projectItem.primaryFile.content;
            let contentObj: any = undefined;

            content = Utilities.fixJsonContent(content);

            try {
              contentObj = JSON.parse(content);
              const results = validate(contentObj, schemaContents);

              for (const err of results.errors) {
                let errorTitle = `JSON structure error`;
                let errorDetail = `(${err.property}) ${err.message}`;

                // Sanitize [object Object] from error messages - the jsonschema library
                // bakes toString() of object values into the message. Resolve the actual value
                // from contentObj using the property path and show a truncated JSON representation.
                const errMessage = err.message
                  ? err.message.replace(/\[object Object\]/g, () => {
                      try {
                        // Resolve the value from the parsed content using the error's property path.
                        // Paths look like "minecraft:spawn_rules.conditions[0]"
                        let resolved: any = contentObj;
                        if (err.property) {
                          const parts = err.property.replace(/\[(\d+)\]/g, ".$1").split(".");
                          for (const part of parts) {
                            if (resolved == null) break;
                            resolved = resolved[part];
                          }
                        }
                        if (resolved !== undefined && resolved !== null && typeof resolved === "object") {
                          const json = JSON.stringify(resolved);
                          return json.length > 30 ? json.substring(0, 30) + "..." : json;
                        }
                        return "(object)";
                      } catch {
                        return "(object)";
                      }
                    })
                  : "";

                // Make version format errors more user-friendly
                if (
                  err.property &&
                  err.property.includes("version") &&
                  errMessage &&
                  errMessage.includes("object value found") &&
                  errMessage.includes("string is required")
                ) {
                  errorTitle = `Version format needs updating`;
                  errorDetail = `The version is written as numbers [1,0,0] but should be text like "1.0.0". This is easy to fix — just change it to a quoted string.`;
                } else if (errMessage && errMessage.includes("is not one of enum values")) {
                  // Make enum errors friendlier
                  const propName = err.property ? err.property.replace("instance.", "") : "a field";
                  errorTitle = `Invalid value`;
                  errorDetail = `The value for "${propName}" isn't recognized. Check for typos or see the documentation for valid options.`;
                } else if (errMessage && errMessage.includes("requires property")) {
                  // Make required property errors friendlier
                  const match = errMessage.match(/requires property "([^"]+)"/);
                  const missingProp = match ? match[1] : "a required field";
                  errorTitle = `Missing required field`;
                  errorDetail = `This item is missing the "${missingProp}" field, which is needed for it to work properly.`;
                } else if (errMessage && errMessage.includes("is not of a type")) {
                  // Make type mismatch errors friendlier
                  const propName = err.property ? err.property.replace("instance.", "") : "a field";
                  errorTitle = `Wrong value type`;
                  errorDetail = `The value for "${propName}" is the wrong type. ${errMessage.includes("string") ? "It should be text." : errMessage.includes("number") ? "It should be a number." : errMessage.includes("boolean") ? "It should be true or false." : "Check the expected format."}`;
                } else {
                  // General case - still improve the property path display
                  const propName = err.property ? err.property.replace("instance.", "") : "";
                  errorTitle = `Structure issue`;
                  errorDetail = propName ? `In "${propName}": ${errMessage}` : errMessage || "Unexpected structure";
                }

                items.push(
                  new ProjectInfoItem(
                    InfoItemType.warning,
                    this.id,
                    JsonSchemaErrorBase + projectItem.itemType,
                    errorTitle,
                    projectItem,
                    errorDetail
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
                  JsonSchemaItemInfoGeneratorTest.couldNotParseJson,
                  "This file has a syntax error and can't be read as JSON. Check for missing commas, brackets, or quotes. Details: " +
                    errorMess,
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
