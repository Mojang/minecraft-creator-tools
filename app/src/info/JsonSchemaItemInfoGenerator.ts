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

                // Minecraft format_version fields may legitimately be either a three-number
                // array (e.g., [1,0,0]) OR a string (e.g., "1.0.2") - both forms are valid
                // across current Bedrock content. The schema validator can flag one form
                // as a type mismatch against the other, producing a false-positive warning
                // that we suppress below. Only the array-vs-string mismatch is suppressed;
                // genuinely unexpected types (number, boolean, object, ...) still produce a
                // clear "stringified or array form expected" warning so the creator knows.
                const propForCheck = err.property ? err.property.replace("instance.", "") : "";
                const isFormatVersionProperty =
                  propForCheck === "format_version" || propForCheck.endsWith(".format_version");
                const isTypeMismatch = !!errMessage && errMessage.includes("is not of a type");

                if (isFormatVersionProperty && isTypeMismatch) {
                  // Resolve the actual value of format_version so we can decide whether the
                  // type-mismatch is a benign array<->string mix or a genuinely wrong type.
                  // Use the stripped property path (without "instance." prefix) so the
                  // walk actually finds the value in `contentObj` — otherwise resolution
                  // always fails and every format_version produces a false-positive
                  // "Version format needs updating" warning.
                  let formatVersionValue: any = undefined;
                  try {
                    let resolved: any = contentObj;
                    if (propForCheck) {
                      const parts = propForCheck.replace(/\[(\d+)\]/g, ".$1").split(".");
                      for (const part of parts) {
                        if (resolved == null) break;
                        resolved = resolved[part];
                      }
                    }
                    formatVersionValue = resolved;
                  } catch {
                    // ignore - fall through to schema error reporting
                  }

                  const isStringForm = typeof formatVersionValue === "string";
                  const isArrayForm =
                    Array.isArray(formatVersionValue) &&
                    formatVersionValue.every((v) => typeof v === "number");

                  if (isStringForm || isArrayForm) {
                    // Both array and string forms are acceptable for format_version - skip.
                    continue;
                  }

                  // Truly unexpected type (number, boolean, object, null, ...). Surface a
                  // targeted warning instead of the generic "is not of a type" message.
                  items.push(
                    new ProjectInfoItem(
                      InfoItemType.warning,
                      this.id,
                      JsonSchemaErrorBase + projectItem.itemType,
                      `Version format needs updating`,
                      projectItem,
                      `The "format_version" value should be a version string (e.g. "1.21.0") or a three-number array (e.g. [1, 21, 0]).`
                    )
                  );
                  continue;
                }

                if (
                  err.property &&
                  err.property.includes("version") &&
                  errMessage &&
                  errMessage.includes("object value found") &&
                  errMessage.includes("string is required")
                ) {
                  // Bedrock manifest "version" fields (header.version, header.min_engine_version,
                  // modules[].version, dependencies[].version) accept BOTH a three-number array
                  // (e.g. [1, 4, 12]) and a three-number triplet string (e.g. "1.4.12") — but the
                  // accepted form depends on the manifest's top-level `format_version`:
                  //
                  //   format_version 1 / 2  → array form is the canonical/required form.
                  //                           String form is invalid; fail loudly.
                  //   format_version 3+     → string form "1.4.12" is the modern/recommended form.
                  //                           Array form still works but the schema flags it; we
                  //                           emit a recommendation (not a misleading "wrong type").
                  //
                  // Resolve the value AND the manifest's top-level format_version, then decide.
                  let versionValue: any = undefined;
                  try {
                    let resolved: any = contentObj;
                    if (err.property) {
                      const parts = err.property.replace("instance.", "").replace(/\[(\d+)\]/g, ".$1").split(".");
                      for (const part of parts) {
                        if (resolved == null || part === "") break;
                        resolved = resolved[part];
                      }
                    }
                    versionValue = resolved;
                  } catch {
                    // ignore - fall through to generic structure issue handling
                  }

                  const isStringForm = typeof versionValue === "string";
                  const isThreeNumberArray =
                    Array.isArray(versionValue) &&
                    versionValue.length === 3 &&
                    versionValue.every((v) => typeof v === "number");

                  // Top-level manifest format_version (NOT to be confused with header.version).
                  // When non-numeric or absent, treat as legacy (1/2) to keep the conservative path.
                  const manifestFormatVersion =
                    typeof contentObj?.format_version === "number" ? contentObj.format_version : undefined;

                  if (manifestFormatVersion !== undefined && manifestFormatVersion >= 3) {
                    // Modern manifest: string form is recommended.
                    if (isStringForm) {
                      // Already in modern form — fully correct, suppress.
                      continue;
                    }
                    if (isThreeNumberArray) {
                      // Valid legacy form on a modern manifest — emit a RECOMMENDATION (not error)
                      // to upgrade. This is safe to follow and matches the manifest spec.
                      const propPath = err.property.replace("instance.", "");
                      const recommended = `"${versionValue[0]}.${versionValue[1]}.${versionValue[2]}"`;
                      items.push(
                        new ProjectInfoItem(
                          InfoItemType.recommendation,
                          this.id,
                          JsonSchemaErrorBase + projectItem.itemType,
                          `Version can be upgraded to string form`,
                          projectItem,
                          `In manifest format_version ${manifestFormatVersion}, "${propPath}" can be expressed as the string ${recommended} instead of the array [${versionValue.join(", ")}]. Both work, but the string form is the modern convention.`
                        )
                      );
                      continue;
                    }
                  } else {
                    // Legacy manifest (format_version 1/2): array form is required.
                    if (isThreeNumberArray) {
                      // Correct — suppress the false-positive schema warning.
                      continue;
                    }
                    if (isStringForm) {
                      // Genuinely wrong: legacy manifest with a string version. Tell the truth.
                      const propPath = err.property.replace("instance.", "");
                      items.push(
                        new ProjectInfoItem(
                          InfoItemType.warning,
                          this.id,
                          JsonSchemaErrorBase + projectItem.itemType,
                          `Version format incompatible with manifest format_version`,
                          projectItem,
                          `Manifest format_version ${manifestFormatVersion ?? "(unset)"} requires "${propPath}" to be an array like [1, 0, 0], not the string "${versionValue}". Either change the value to the array form OR upgrade the top-level "format_version" to 3 to use the string form.`
                        )
                      );
                      continue;
                    }
                  }

                  // Truly unexpected type (object, boolean, null, etc.). Surface a non-misleading
                  // warning that does NOT push the user toward the wrong form.
                  errorTitle = `Version format unrecognized`;
                  errorDetail = `The "${err.property.replace("instance.", "")}" value is not in a recognized format. Use a three-number array like [1, 0, 0] (manifest format_version 1/2) or a three-number string like "1.0.0" (manifest format_version 3+).`;
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
