import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import IIndexJson from "../storage/IIndexJson";
import StorageUtilities from "../storage/StorageUtilities";
import DataFormUtilities from "../dataform/DataFormUtilities";
import IField, { FieldDataType } from "../dataform/IField";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import Database from "../minecraft/Database";
import Log from "../core/Log";
import ISimpleReference from "../dataform/ISimpleReference";

export enum ExportMode {
  other = 0,
  triggers = 1,
  blockComponents = 2,
  itemComponents = 3,
  entityComponents = 4,
  AIGoals = 5,
  visuals = 6,
  fogs = 7,
  websockets = 8,
  filters = 9,
  MCToolsVal = 10,
  eventResponses = 11,
  clientBiomes = 12,
  biomes = 13,
  features = 14,
  featureCore = 15,
  clientDeferredRendering = 16,
}

export default class FormDefinitionTypeScriptGenerator {
  public async generateTypes(formJsonInputFolder: IFolder, outputFolder: IFolder) {
    const formsByPath: { [name: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formJsonInputFolder, outputFolder);

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.features,
      "/features/",
      "/features/minecraft_",
      "Feature"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.featureCore,
      "/features/",
      "/feature/feature",
      "Feature Rule"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/entity/",
      "/entity/minecraft_behavior",
      "Entity"
    );

    await this.exportTypeScriptDocs(formsByPath, outputFolder, ExportMode.visuals, "/visual/", "/visual/", "Visuals");

    await this.exportTypeScriptDocs(formsByPath, outputFolder, ExportMode.fogs, "/fogs/", "/fogs/", "Fogs");

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/client_biome/",
      "/client_biome/",
      "Client Biomes"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/deferred_rendering/",
      "/client_deferred_rendering/",
      "Client Biomes"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.websockets,
      "/websockets/",
      "/websockets/",
      "Websockets"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.triggers,
      "/entity/entityTriggers/",
      "/entity/minecraft_on",
      "Entity"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.filters,
      "/entity/filters/",
      "/entityfilters/",
      "Entity Filters"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/entity/eventActions/",
      "/entityevents/",
      "Entity Actions"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.blockComponents,
      "/block/blockComponents/",
      "/block/minecraft_",
      "Block Components"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.itemComponents,
      "/item/itemComponents/",
      "/item/minecraft_",
      "Items"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/entity/entityComponents/",
      "/entity/minecraft_",
      "Entity"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/clientBiomes/components/",
      "/clientbiome/",
      "Client Biome"
    );

    await this.exportTypeScriptDocs(
      formsByPath,
      outputFolder,
      ExportMode.biomes,
      "/biomes/components/",
      "/biome/",
      "Biome"
    );
  }

  private getFileNameFromBaseName(baseName: string, exportMode: ExportMode) {
    let fileName = baseName;

    return fileName;
  }

  public async exportTypeScriptDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    categoryPlural: string
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode);

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        if (!hasEnsuredFolder) {
          await targetFolder.ensureExists();
          hasEnsuredFolder = true;
        }

        let typeName = formO.id ? formO.id : formO.title;

        if (!typeName) {
          Log.unexpectedUndefined("Form: " + baseName);
          return;
        }

        typeName = Utilities.javascriptifyName(typeName, true);

        let fileName = this.getFileNameFromBaseName(typeName, exportMode);

        const typeScriptFile = targetFolder.ensureFile(fileName + ".d.ts");

        await this.saveFormDefinitionTypeScriptDocForm(
          typeScriptFile,
          formO,
          baseName,
          exportMode,
          categoryPlural,
          Utilities.countChar(subFolderPath, "/")
        );
      }
    }
  }

  public async saveFormDefinitionTypeScriptDocForm(
    dtsFile: IFile,
    form: IFormDefinition,
    baseName: string,
    exportMode: ExportMode,
    category: string,
    folderDepth: number
  ) {
    const content: string[] = [];

    let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);

    if (exportMode === ExportMode.websockets && form.id) {
      canonName = form.id;
    }

    content.push("// Copyright (c) Microsoft Corporation.");
    content.push("// Licensed under the MIT License.");
    content.push("// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.");
    content.push("// Project: https://learn.microsoft.com/minecraft/creator/");
    content.push("");

    content.push("/**");
    content.push(" * @packageDocumentation");
    content.push(" * Contains types for working with various Minecraft Bedrock Edition JSON schemas.");
    content.push(" * ");
    content.push(" * " + category + " Documentation - " + canonName);

    if (form.samples) {
      content.push(" * ");
      content.push(" * " + canonName + " Samples");
      let samplesAdded = 0;
      const linesAdded: string[] = [];

      for (const samplePath in form.samples) {
        let sampleArr = form.samples[samplePath];
        let addedHeader = false;

        if (sampleArr && samplesAdded < 12) {
          const sampBaseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(samplePath));

          let targetPath = samplePath;

          for (const sample of sampleArr) {
            let line = "";

            if (
              baseName.startsWith("minecraft_") &&
              (typeof sample.content !== "string" || !sample.content.startsWith("minecraft:"))
            ) {
              line += '"' + canonName + '": ';
            }

            if (typeof sample.content === "object" || Array.isArray(sample.content)) {
              line += JSON.stringify(sample.content, undefined, 2) + "\n";
            } else {
              if (typeof sample.content === "string") {
                let cont = sample.content.trim();

                if (cont.startsWith("{") && cont.endsWith("}")) {
                  line += cont;
                } else {
                  line += '"' + cont;
                }
              } else {
                line += sample.content;
              }
            }

            if (!linesAdded.includes(line)) {
              if (!addedHeader) {
                addedHeader = true;

                if (targetPath !== "samples" && targetPath !== "sample") {
                  if (targetPath.startsWith("/vanilla")) {
                    targetPath = "https://github.com/Mojang/bedrock-samples/tree/preview" + targetPath.substring(8);
                  } else if (targetPath.startsWith("/samples")) {
                    targetPath = "https://github.com/microsoft/minecraft-samples/tree/main" + targetPath.substring(8);
                  }

                  content.push("");
                  content.push(
                    Utilities.humanifyMinecraftName(
                      sampBaseName.substring(0, 1).toUpperCase() + sampBaseName.substring(1)
                    ) +
                      " - " +
                      targetPath
                  );
                  content.push("");
                }
              }

              if (sampleArr.length > 1) {
                content.push(" * At " + sample.path + ": ");
              }

              linesAdded.push(line);
              content.push(line);
              samplesAdded++;
            }
          }
        }
      }
    }
    content.push(" */");
    content.push("\nimport * as jsoncommon from './" + "../".repeat(folderDepth) + "jsoncommon';\n");

    await this.appendType(form, content, 0);

    dtsFile.setContent(content.join("\n"));

    await dtsFile.saveContent();
  }

  public static sanitizeDescription(description: string) {
    description = description.trim();

    description = Utilities.ensureFirstCharIsUpperCase(description);

    if (description.length > 10 && !description.endsWith(".") && !description.endsWith(":")) {
      description += ".";
    }

    return description;
  }

  public getFileNameFromJsonKey(key: string) {
    key = key.toLowerCase();

    key = key.replace(/ /gi, "_");
    key = key.replace(/::/gi, "_");
    key = key.replace(/:/gi, "_");

    return key;
  }

  public async appendType(
    form: IFormDefinition,
    content: string[],
    depth: number,
    altTitle?: string,
    typeStack?: string[]
  ) {
    if (!typeStack) {
      typeStack = [];
    } else {
      typeStack = typeStack.slice();
    }

    let typeName = altTitle ? altTitle : form.id ? form.id : form.title;

    if (!typeName) {
      Log.unexpectedUndefined("Type: " + JSON.stringify(form));
      return;
    }

    typeName = Utilities.javascriptifyName(typeName, true);

    const formId = form.id ? form.id : form.title ? form.title : JSON.stringify(form.fields);
    if (typeStack.includes(formId)) {
      Log.message("Dependency loop in the stack with " + typeName + " in " + typeStack.join(" -> ") + " detected.");
      return;
    }

    content.push("/**");
    typeStack.push(formId);

    if (form.title) {
      FormDefinitionTypeScriptGenerator.appendLongTextWithAsterisks(
        content,
        form.title + (form.id ? " (" + form.id + ")" : ""),
        60,
        1
      );
    }

    if (form.description) {
      FormDefinitionTypeScriptGenerator.appendLongTextWithAsterisks(
        content,
        FormDefinitionTypeScriptGenerator.sanitizeDescription(form.description),
        60,
        1
      );
    }

    if (form.note) {
      FormDefinitionTypeScriptGenerator.appendLongTextWithAsterisks(
        content,
        "Note: " + FormDefinitionTypeScriptGenerator.sanitizeDescription(form.note),
        60,
        1
      );
    }

    if (form.note2) {
      FormDefinitionTypeScriptGenerator.appendLongTextWithAsterisks(
        content,
        "Note: " + FormDefinitionTypeScriptGenerator.sanitizeDescription(form.note2),
        60,
        1
      );
    }

    if (form.note3) {
      FormDefinitionTypeScriptGenerator.appendLongTextWithAsterisks(
        content,
        "Note: " + FormDefinitionTypeScriptGenerator.sanitizeDescription(form.note3),
        60,
        1
      );
    }

    if (form.isDeprecated) {
      content.push(" * IMPORTANT");
      content.push(" * This type is now deprecated, and no longer in use in the latest versions of Minecraft.");
      content.push(" * ");
    }

    if (form.isInternal) {
      content.push(" * IMPORTANT");
      content.push(
        " * This type is internal to vanilla Minecraft usage, and is not functional or supported within custom Minecraft content."
      );
      content.push(" * ");
    }

    const scalarField = DataFormUtilities.getScalarField(form);

    if (scalarField) {
      content.push(" * NOTE: Alternate Simple Representations\n");

      for (const scalarFieldInst of DataFormUtilities.getFieldAndAlternates(scalarField)) {
        content.push(
          " * This can also be represent as a simple `" +
            DataFormUtilities.getFieldTypeDescription(scalarFieldInst.dataType) +
            "`."
        );
      }

      content.push("");
    }
    content.push(" */");

    const subContent: string[] = [];

    content.push("export " + (depth === 0 ? "default " : "") + "interface " + typeName + " {");
    content.push("");

    const fieldsAdded: { [keyName: string]: boolean } = {};

    if (form.fields && form.fields.length > 0) {
      form.fields.sort((a: IField, b: IField) => {
        return a.id.localeCompare(b.id);
      });

      for (const field of form.fields) {
        let fieldName = field.id ? field.id : field.title;

        if (!fieldName) {
          Log.unexpectedUndefined("Field: " + JSON.stringify(field));
          return;
        }

        fieldName = Utilities.wrapJavascriptNameIfNeeded(fieldName);

        if (fieldName.length > 0 && !fieldsAdded[fieldName]) {
          fieldsAdded[fieldName] = true;

          if (field.description || field.samples) {
            content.push("  /**");
            content.push("   * @remarks");

            if (field.description) {
              FormDefinitionTypeScriptGenerator.appendLongTextWithAsterisks(content, field.description, 60, 3);
            }

            if (field.samples) {
              let samplesAdded = 0;
              let renderedHeader = false;
              const samplesUsed: string[] = [];

              for (const samplePath in field.samples) {
                let sampleArr = field.samples[samplePath];

                if (sampleArr && samplesAdded < 3) {
                  const sampleSet: { [id: string]: string } = {};

                  for (const sample of sampleArr) {
                    const sampleVal = JSON.stringify(sample.content);

                    if (!samplesUsed.includes(sampleVal)) {
                      samplesUsed.push(sampleVal);
                      const baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(samplePath));

                      samplesAdded++;

                      const key = baseName.substring(0, 1).toUpperCase() + baseName.substring(1);

                      if (!sampleSet[key]) {
                        sampleSet[key] = sampleVal;
                      } else {
                        sampleSet[key] = sampleSet[key] + ", " + sampleVal;
                      }
                    }
                  }

                  if (samplesAdded > 0) {
                    if (!renderedHeader) {
                      renderedHeader = true;

                      content.push("   * ");
                      content.push("   * Sample Values:");
                    }

                    for (const key in sampleSet) {
                      content.push(
                        "   * " + Utilities.humanifyMinecraftName(key) + ": " + this.sanitizeForTable(sampleSet[key])
                      );
                    }
                  }

                  content.push("   *");
                }
              }
            }

            content.push("   */");
          }

          let fieldTypeName = typeName + Utilities.javascriptifyName(Utilities.ensureFirstCharIsUpperCase(fieldName));

          let subForm = field.subForm;

          if (!subForm && field.subFormId) {
            subForm = await Database.ensureFormLoadedByPath(field.subFormId);
          }

          if (subForm) {
            subContent.push("\n");

            await this.appendType(subForm, subContent, depth + 1, fieldTypeName, typeStack);
          } else if (field.choices) {
            const choices = field.choices;
            subContent.push("\n");

            if (choices.length > 0) {
              await this.appendEnum(form, subContent, choices, depth + 1, fieldTypeName);
            }
          } else {
            fieldTypeName = "object";
          }

          let propLine = "  " + fieldName;

          if (!field.isRequired) {
            propLine += "?";
          }

          propLine += ": ";

          if (!field.alternates) {
            propLine += FormDefinitionTypeScriptGenerator.getTypeScriptFieldTypeDescription(field, fieldTypeName);
          } else {
            propLine += FormDefinitionTypeScriptGenerator.getTypeScriptFieldTypeDescription(field, fieldTypeName);

            for (const altField of field.alternates) {
              let descri = FormDefinitionTypeScriptGenerator.getTypeScriptFieldTypeDescription(altField, fieldTypeName);

              if (!propLine.indexOf(descri)) {
                propLine += " | " + descri;
              }
            }
          }

          propLine += ";";

          content.push(propLine);
          content.push("");
        }
      }
    }

    content.push("}");
    content.push(...subContent);
  }

  public async appendEnum(
    form: IFormDefinition,
    content: string[],
    choices: ISimpleReference[],
    depth: number,
    typeTitle: string
  ) {
    content.push("export enum " + typeTitle + " {");

    const choicesAdded: { [name: string]: boolean } = {};

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i];
      let choiceName = choice.id ? choice.id : choice.title;
      if (!choiceName) {
        Log.unexpectedUndefined("Choice: " + JSON.stringify(form));
        return;
      } else {
        choiceName = choiceName.toString();

        const choiceNameJs = Utilities.ensureFirstCharIsLowerCase(Utilities.javascriptifyName(choiceName, true));

        if (!choicesAdded[choiceNameJs]) {
          choicesAdded[choiceNameJs] = true;

          if (choice.description) {
            content.push("  /**");
            content.push("   * @remarks");
            FormDefinitionTypeScriptGenerator.appendLongTextWithAsterisks(content, choice.description, 60, 3);
            content.push("   */");
          }

          content.push("  " + choiceNameJs + " = " + "`" + choiceName + "`" + (i < choices.length - 1 ? "," : ""));
        }
      }
    }

    content.push("}");
  }

  public static appendLongTextWithAsterisks(
    content: string[],
    text: string,
    maxLineLength: number,
    asteriskSpacing: number
  ) {
    const lines = this.splitIntoLines(text, maxLineLength);

    for (const line of lines) {
      const asterisks = " ".repeat(asteriskSpacing) + "* ";

      content.push(asterisks + line);
    }
  }

  public static splitIntoLines(value: string, maxLineLength: number) {
    const lines: string[] = [];

    const words = value.split(" ");

    let curLine = "";
    for (let i = 0; i < words.length - 1; i++) {
      const nextWord = words[i + 1];

      if (curLine.length + nextWord.length > maxLineLength) {
        lines.push(curLine + words[i]);
        curLine = "";
      } else {
        curLine += words[i] + " ";
      }
    }

    if (curLine.length + words[words.length - 1].length > maxLineLength) {
      lines.push(curLine);
      lines.push(words[words.length - 1]);
    } else {
      lines.push(curLine + words[words.length - 1]);
    }

    return lines;
  }

  public getValueAsString(value: any) {
    if (Array.isArray(value)) {
      let result = "[";

      let index = 0;
      for (const subVal of value) {
        if (index > 0) {
          result += ", ";
        }

        result += subVal.toString();

        index++;
      }
      return result + "]";
    }

    return value.toString();
  }

  public sanitizeForTable(value: string) {
    value = value.replace(/\\r/gi, " ");
    value = value.replace(/\\t/gi, " ");
    value = value.replace(/\\n/gi, "<br>");
    value = value.replace(/\\"/gi, '"');
    value = value.replace(/\r/gi, " ");
    value = value.replace(/\n/gi, "<br>");
    value = value.replace(/  /gi, " ");
    value = value.replace(/  /gi, " ");
    value = value.trim();

    return value;
  }

  static getTypeScriptFieldTypeDescription(field: IField, objectTypeName: string) {
    let strDescription = "string";

    if (field.choices) {
      if (field.mustMatchChoices) {
        strDescription = objectTypeName;
      } else {
        strDescription = objectTypeName + "| string";
      }
    }

    switch (field.dataType) {
      case FieldDataType.int:
        return "number";
      case FieldDataType.boolean:
        return "boolean";
      case FieldDataType.float:
        return "number";
      case FieldDataType.stringEnum:
        return strDescription;
      case FieldDataType.intEnum:
        return "number";
      case FieldDataType.intBoolean:
        return "boolean";
      case FieldDataType.number:
        return "number";
      case FieldDataType.long:
        return "number";
      case FieldDataType.stringLookup:
        return strDescription;
      case FieldDataType.intValueLookup:
        return "number";
      case FieldDataType.point3:
        return "number[]";
      case FieldDataType.intPoint3:
        return "number[]";
      case FieldDataType.longFormString:
        return strDescription;
      case FieldDataType.keyedObjectCollection:
        return "{ [key: string]: any }";
      case FieldDataType.objectArray:
        return (objectTypeName ? objectTypeName : "object") + "[]";
      case FieldDataType.object:
        return objectTypeName ? objectTypeName : "object";
      case FieldDataType.stringArray:
        return "string[]";
      case FieldDataType.intRange:
        return "number[]";
      case FieldDataType.floatRange:
        return "number[]";
      case FieldDataType.minecraftFilter:
        return "jsoncommon.MinecraftFilter";
      case FieldDataType.percentRange:
        return "number[]";
      case FieldDataType.minecraftEventTrigger:
        return "jsoncommon.MinecraftEventTrigger";
      case FieldDataType.minecraftEventReference:
        return "string";
      case FieldDataType.minecraftEventTriggerArray:
        return "jsoncommon.MinecraftEventTrigger[]";
      case FieldDataType.longFormStringArray:
        return strDescription + "[]";
      case FieldDataType.keyedStringCollection:
        return "{ [key: string]: " + strDescription + " }";
      case FieldDataType.version:
        return "string | number[]";
      case FieldDataType.uuid:
        return "string";
      case FieldDataType.keyedBooleanCollection:
        return "{ [key: string]: boolean }";
      case FieldDataType.keyedStringArrayCollection:
        return "{ [key: string]: " + strDescription + "[] }";
      case FieldDataType.arrayOfKeyedStringCollection:
        return "{ [key: string]: " + strDescription + "[] }[]";
      case FieldDataType.keyedKeyedStringArrayCollection:
        return "{ [key: string]: { [key: string]: string[] } }";
      case FieldDataType.keyedNumberCollection:
        return "{ [key: string]: number }";
      case FieldDataType.keyedNumberArrayCollection:
        return "{ [key: string]: number[] }";
      case FieldDataType.numberArray:
        return "number[]";
      case FieldDataType.point2:
        return "number[]";
      case FieldDataType.localizableString:
        return "string";
      case FieldDataType.string:
        return "string";
      case FieldDataType.molang:
        return "string";
      case FieldDataType.molangArray:
        return "string[]";
      default:
        return strDescription;
    }
  }
  public getMarkdownBookmark(id: string) {
    return id.toLowerCase().replace(/ /gi, "-");
  }

  public getFormsFromFilter(formsByPath: { [name: string]: IFormDefinition }, formsPath: string, mode: ExportMode) {
    const filteredList: { [name: string]: IFormDefinition } = {};

    for (const formPath in formsByPath) {
      let includeFile = true;

      if (
        formPath.indexOf("index") >= 0 ||
        formPath.indexOf("overview") >= 0 ||
        formPath.indexOf("describes") >= 0 ||
        formPath.indexOf("versioned") >= 0
      ) {
        includeFile = false;
      }

      if (
        includeFile &&
        formPath.toLowerCase().startsWith(formsPath) &&
        formsByPath[formPath] &&
        (formsPath.indexOf("behavior") >= 0 || formPath.indexOf("behavior") < 0) &&
        (formsPath.indexOf("_on") >= 0 || formPath.indexOf("minecraft_on") < 0)
      ) {
        filteredList[formPath] = formsByPath[formPath];
      }
    }

    return filteredList;
  }

  public async loadFormJsonFromFolder(
    formsByPath: { [name: string]: IFormDefinition },
    inputFolder: IFolder,
    outputFolder: IFolder
  ) {
    if (!inputFolder.isLoaded) {
      await inputFolder.load();
    }

    const fileList: IIndexJson = { files: [], folders: [] };

    for (const folderName in inputFolder.folders) {
      const folder = inputFolder.folders[folderName];

      if (folder) {
        await this.loadFormJsonFromFolder(formsByPath, folder, outputFolder.ensureFolder(folderName));

        fileList.folders.push(folderName);
      }
    }

    for (const fileName in inputFolder.files) {
      const file = inputFolder.files[fileName];

      if (file) {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO) {
          formsByPath[file.storageRelativePath] = jsonO;
        }
      }
    }
  }
}
