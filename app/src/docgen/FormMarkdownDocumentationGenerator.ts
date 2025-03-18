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

export const MarkdownTop = `---
author: mammerla
ms.author: mikeam
title: "{0}"
description: "{1}"
ms.service: minecraft-bedrock-edition
ms.date: 02/11/2025 
---
`;

export enum ExportMode {
  Other = 0,
  Triggers = 1,
  BlockComponents = 2,
  ItemComponents = 3,
  EntityComponents = 4,
  AIGoals = 5,
  Visuals = 6,
  Fogs = 7,
  Websockets = 8,
  Filters = 9,
  MCToolsVal = 10,
  EventResponses = 11,
  ClientBiomes = 12,
  Biomes = 13,
}

export default class FormMarkdownDocumentationGenerator {
  public async generateMarkdown(formJsonInputFolder: IFolder, outputFolder: IFolder) {
    const formsByPath: { [name: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formJsonInputFolder, outputFolder);

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/EntityGoals/",
      "/entity/minecraft_behavior",
      "Entity",
      "AI Behavior Component"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.Visuals,
      "/VisualReference/",
      "/visual/",
      "Visuals",
      "Visual Element"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.Fogs,
      "/FogsReference/",
      "/fogs/",
      "Fogs",
      "Fog Element"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.Websockets,
      "/WebsocketsReference/",
      "/websockets/",
      "Websockets",
      "Websocket Packet"
    );

    this.exportValidatorMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.MCToolsVal,
      "/MCToolsValReference/",
      "/mctoolsval/",
      "MCTools Validation Rules",
      "MCTools Validation Rules"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.Triggers,
      "/EntityReference/Examples/EntityTriggers/",
      "/entity/minecraft_on",
      "Entity",
      "Entity Trigger"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.Filters,
      "/EntityReference/Examples/Filters/",
      "/entityfilters/",
      "Entity Filters",
      "Entity Filter Element"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.EventResponses,
      "/EntityReference/Examples/EventActions/",
      "/entityevents/",
      "Entity Actions",
      "Entity Action Types"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.BlockComponents,
      "/BlockReference/Examples/BlockComponents/",
      "/block/minecraft_",
      "Block Components",
      "Block Component"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.ItemComponents,
      "/ItemReference/Examples/ItemComponents/",
      "/item/minecraft_",
      "Items",
      "Item Component"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.EntityComponents,
      "/EntityReference/Examples/EntityComponents/",
      "/entity/minecraft_",
      "Entity",
      "Entity Component"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.ClientBiomes,
      "/ClientBiomesReference/Examples/Components/",
      "/clientbiome/",
      "Client Biome",
      "Client Biome"
    );

    this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.Biomes,
      "/BiomesReference/Examples/Components/",
      "/biome/",
      "Biome",
      "Biome"
    );

    this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/AIGoalList.md",
      "/entity/minecraft_behavior",
      "Entity Behavior (AI) Components",
      "EntityGoals"
    );

    this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.Filters,
      "/EntityReference/Examples/FilterList.md",
      "/entityfilters/",
      "Entity Filter Types",
      "Filters"
    );

    this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.EventResponses,
      "/EntityReference/Examples/EventActions.md",
      "/entityevents/",
      "Event Actions",
      "EventActions"
    );
  }

  private getFileNameFromBaseName(baseName: string, exportMode: ExportMode) {
    let fileName = baseName;

    if (exportMode === ExportMode.Triggers && fileName.startsWith("minecraft_on_")) {
      fileName = "minecraftTrigger_" + baseName.substring(10);
    } else if (exportMode === ExportMode.Triggers && fileName.startsWith("minecraft_on_")) {
      fileName = "minecraftTrigger_" + baseName.substring(10);
    } else if (exportMode === ExportMode.AIGoals && fileName.startsWith("minecraft_behavior")) {
      fileName = "minecraftB" + baseName.substring(11);
    } else if (exportMode === ExportMode.EntityComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraftComponent_" + baseName.substring(10);
    } else if (exportMode === ExportMode.BlockComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraftBlock_" + baseName.substring(10);
    } else if (exportMode === ExportMode.ItemComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraft_" + baseName.substring(10);
    } else if (exportMode === ExportMode.ClientBiomes && fileName.startsWith("minecraft_")) {
      fileName = "minecraftClientBiomes_" + baseName.substring(10);
    } else if (exportMode === ExportMode.Biomes && fileName.startsWith("minecraft_")) {
      fileName = "minecraftBiomes_" + baseName.substring(10);
    }

    fileName = fileName.replace("_horse_", "_horse.");
    fileName = fileName.replace("_jump_", "_jump.");

    if (fileName.indexOf("movement_tracking") < 0) {
      fileName = fileName.replace("_movement_", "_movement.");
    }
    fileName = fileName.replace("_navigation_", "_navigation.");
    fileName = fileName.replace("_player_", "_player.");

    return fileName;
  }

  public async exportMarkdownAggregatedPage(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    filePath: string,
    formsPath: string,
    category: string,
    categoryExtended: string
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(filePath);

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

        let fileName = this.getFileNameFromBaseName(baseName, exportMode);

        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveMarkdownDocFromForm(markdownFile, formO, baseName, exportMode, category, categoryExtended);
      }
    }
  }

  public async exportValidatorMarkdownCatalogDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    categoryPlural: string,
    categorySingular: string
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

        let fileName = this.getFileNameFromBaseName(baseName, exportMode);

        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveValidatorMarkdownDocFromForm(
          markdownFile,
          formO,
          baseName,
          exportMode,
          categoryPlural,
          categorySingular
        );
      }
    }
  }

  public async exportMarkdownCatalogDocs(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    categoryPlural: string,
    categorySingular: string
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

        let fileName = this.getFileNameFromBaseName(baseName, exportMode);

        const markdownFile = targetFolder.ensureFile(fileName + ".md");

        await this.saveMarkdownDocFromForm(markdownFile, formO, baseName, exportMode, categoryPlural, categorySingular);
      }
    }
  }

  public async exportMarkdownDocListPage(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    category: string,
    subFolderName: string
  ) {
    const targetFile = await outputFolder.ensureFileFromRelativePath(subFolderPath);

    if (!targetFile) {
      return;
    }

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode);

    const content: string[] = [];
    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + category,
        "A reference document describing all current " + category
      )
    );

    content.push("| " + category + " | Description |");
    content.push("|:-----|:----------|");

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        let canonName = EntityTypeDefinition.getComponentFromBaseFileName(baseName);

        content.push(
          "| [" +
            canonName +
            "](" +
            subFolderName +
            "/" +
            this.getFileNameFromBaseName(baseName, exportMode) +
            ".md)| " +
            (formO.description ? this.sanitizeForTable(this.getFirstSentence(formO.description)) : "") +
            " |"
        );
      }
    }

    targetFile.setContent(content.join("\r\n"));

    await targetFile.saveContent();
  }

  private getFirstSentence(description: string) {
    let endOfSentence = description.indexOf(". ");

    if (endOfSentence >= 0) {
      description = description.substring(0, endOfSentence + 1);
    }

    return description;
  }

  public async saveMarkdownDocFromForm(
    markdownFile: IFile,
    form: IFormDefinition,
    baseName: string,
    exportMode: ExportMode,
    category: string,
    categoryExtended: string
  ) {
    const content: string[] = [];

    let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);

    if (exportMode === ExportMode.Websockets && form.id) {
      canonName = form.id;
    }

    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + canonName,
        "Describes the " + canonName + " " + categoryExtended.toLowerCase()
      )
    );

    content.push("# " + category + " Documentation - " + canonName + "\r\n");

    if (form.isDeprecated) {
      content.push("> [!IMPORTANT]");
      content.push("> This type is now deprecated, and no longer in use in the latest versions of Minecraft.");
      content.push("");
    }

    if (form.isInternal) {
      content.push("> [!IMPORTANT]");
      content.push(
        "> This type is internal to vanilla Minecraft usage, and is not functional or supported within custom Minecraft content."
      );
      content.push("");
    }

    await this.appendForm(form, content, 0);

    if (form.samples) {
      content.push("\r\n## Samples\r\n");
      let samplesAdded = 0;
      const linesAdded: string[] = [];

      for (const samplePath in form.samples) {
        let sampleArr = form.samples[samplePath];
        let addedHeader = false;

        if (sampleArr && samplesAdded < 12) {
          const sampBaseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(samplePath));

          let targetPath = samplePath;

          for (const sample of sampleArr) {
            let line = "\r\n```json\r\n";

            if (
              baseName.startsWith("minecraft_") &&
              (typeof sample.content !== "string" || !sample.content.startsWith("minecraft:"))
            ) {
              line += '"' + canonName + '": ';
            }

            if (typeof sample.content === "object" || Array.isArray(sample.content)) {
              line += JSON.stringify(sample.content, undefined, 2) + "\r\n```\r\n";
            } else {
              if (typeof sample.content === "string") {
                let cont = sample.content.trim();

                if (cont.startsWith("{") && cont.endsWith("}")) {
                  line += cont + "\r\n```\r\n";
                } else {
                  line += '"' + cont + '"\r\n```\r\n';
                }
              } else {
                line += sample.content + "\r\n```\r\n";
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

                  content.push(
                    "#### [" +
                      Utilities.humanifyMinecraftName(
                        sampBaseName.substring(0, 1).toUpperCase() + sampBaseName.substring(1)
                      ) +
                      "](" +
                      targetPath +
                      ")\r\n"
                  );
                }
              }

              if (sampleArr.length > 1) {
                content.push("At " + sample.path + ": ");
              }

              linesAdded.push(line);
              content.push(line);
              samplesAdded++;
            }
          }
        }
      }
    }

    markdownFile.setContent(content.join("\r\n"));

    await markdownFile.saveContent();
  }

  public async saveValidatorMarkdownDocFromForm(
    markdownFile: IFile,
    form: IFormDefinition,
    baseName: string,
    exportMode: ExportMode,
    category: string,
    categoryExtended: string
  ) {
    const content: string[] = [];

    let canonName = "minecraft:" + EntityTypeDefinition.getComponentFromBaseFileName(baseName);

    if (exportMode === ExportMode.Websockets && form.id) {
      canonName = form.id;
    }

    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + canonName,
        "Describes the " + canonName + " " + categoryExtended.toLowerCase()
      )
    );

    content.push("# " + category + " Documentation - " + canonName + "\r\n");

    if (form.isDeprecated) {
      content.push("> [!IMPORTANT]");
      content.push("> This type is now deprecated, and no longer in use in the latest versions of Minecraft.");
      content.push("");
    }

    await this.appendValidatorForm(form, content, 0);

    markdownFile.setContent(content.join("\r\n"));

    await markdownFile.saveContent();
  }

  public sanitizeDescription(description: string) {
    description = description.trim();

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

  public async appendForm(form: IFormDefinition, content: string[], depth: number, altTitle?: string) {
    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\r\n");
    }

    if (form.note) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note) + "\r\n");
    }

    if (form.note2) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note2) + "\r\n");
    }

    if (form.note3) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note3) + "\r\n");
    }

    if (form.requires) {
      let descStr = "";
      const entityComponents = [];
      for (const dep of form.requires) {
        if (dep.type === "tame_owner") {
          content.push("> [!Note]");
          content.push(
            "> Requires a player to be set as the tame owner via taming (or the `tame` command, or the tame API on EntityTameableComponent) in order to work properly."
          );
        } else if (dep.type === "targeting_entity_component") {
          content.push("> [!Note]");
          content.push(
            "> Requires a target in order to work properly. Entities can generate targets via one of the following behaviors:"
          );
          content.push("> ");
          content.push(
            "> * [minecraft:behavior.nearest_attackable_target](../EntityGoals/minecraftBehavior_nearest_attackable_target.md)"
          );
          content.push("> * [minecraft:behavior.hurt_by_target](../EntityGoals/minecraftBehavior_hurt_by_target.md)");
        } else if (dep.type === "entity_component" || dep.type === "item_component" || dep.type === "block_component") {
          if (dep.description) {
            if (descStr.length > 0) {
              descStr += " ";
            }
            descStr += dep.description;
          }
          entityComponents.push(dep.id);
        }
      }

      if (entityComponents.length > 0) {
        content.push("> [!Note]");
        if (entityComponents.length === 1) {
          content.push("> Requires the following component in order to work properly:");
        } else {
          content.push("> Requires the following components in order to work properly:");
        }
        content.push("> ");
        for (const entityComponent of entityComponents) {
          content.push(
            "> * [" +
              Utilities.humanifyMinecraftName(entityComponent) +
              " (" +
              entityComponent +
              ")](../EntityComponents/minecraftComponent_" +
              this.getFileNameFromJsonKey(entityComponent.substring(10)) +
              ".md)"
          );
        }

        if (descStr.length >= 0) {
          content.push("> " + descStr);
        }
      }
    }

    if (form.restrictions) {
      const entityTypes = [];
      let descStr = "";

      for (const restriction of form.restrictions) {
        if (restriction.type === "entity_type") {
          entityTypes.push(restriction.id);

          if (restriction.description) {
            if (descStr.length > 0) {
              descStr += " ";
            }
            descStr += restriction.description;
          }
        }
      }

      if (entityTypes.length > 0) {
        content.push("> [!Note]");
        if (entityTypes.length === 1) {
          content.push("> Can only be used on the following type of entity:");
        } else {
          content.push("> Can only be used on the following types of entity:");
        }
        content.push("> ");

        for (const entityType of entityTypes) {
          content.push("> * " + Utilities.humanifyMinecraftName(entityType) + " (" + entityType + ")");
        }

        if (descStr.length >= 0) {
          content.push("> " + descStr);
        }
      }
    }

    const scalarField = DataFormUtilities.getScalarField(form);

    if (scalarField) {
      content.push("## Alternate Simple Representations\r\n");

      for (const scalarFieldInst of DataFormUtilities.getFieldAndAlternates(scalarField)) {
        content.push(
          "This item can also be represented as a `" +
            DataFormUtilities.getFieldTypeDescription(scalarFieldInst.dataType) +
            "`."
        );
      }

      content.push("");
    }

    let title = undefined;

    if (form.title) {
      if (form.title === form.id) {
        title = Utilities.humanifyMinecraftName(form.id);
      } else {
        title = form.title;
      }
    } else if (form.id) {
      title = Utilities.humanifyMinecraftName(form.id);
    } else if (altTitle) {
      title = altTitle;
    } else {
      title = "Item";
    }

    if (form.fields && form.fields.length > 0) {
      const subContent: string[] = [];
      if (depth > 0) {
        content.push("\r\n#### " + title + " Properties\r\n");
      } else {
        content.push("\r\n## " + title + " Properties\r\n");
      }

      content.push("|Name       |Default Value |Type |Description |Example Values |");
      content.push("|:----------|:-------------|:----|:-----------|:------------- |");

      form.fields.sort((a: IField, b: IField) => {
        return a.id.localeCompare(b.id);
      });

      let fullFieldList: IField[] = [];

      for (const field of form.fields) {
        fullFieldList.push(field);

        if (field.alternates) {
          let i = 0;
          for (const altField of field.alternates) {
            i++;

            if (!altField.id || altField.id === field.id) {
              altField.id = field.id + " (Alternate " + i + ")";
            }

            fullFieldList.push(altField);
          }
        }
      }

      for (const field of fullFieldList) {
        let fieldRow = "| " + field.id + " | ";

        if (field.defaultValue !== undefined) {
          fieldRow += this.getValueAsString(field.defaultValue);
        } else {
          fieldRow += "*not set*";
        }

        const fieldName = Utilities.humanifyMinecraftName(field.id);
        const fieldLink =
          "(#" + this.getMarkdownBookmark(fieldName) + "-" + (field.choices ? "choices" : "item-type") + ")";

        let subForm = field.subForm;

        if (!subForm && field.subFormId) {
          subForm = await Database.ensureFormLoadedByPath(field.subFormId);
        }

        if (subForm && subForm.fields.length > 0) {
          if (field.dataType === FieldDataType.objectArray) {
            fieldRow += " | Array of [" + fieldName + "]" + fieldLink + " items | ";
          } else if (field.dataType === FieldDataType.keyedObjectCollection) {
            fieldRow += " | Key/item pairs of [" + fieldName + "]" + fieldLink + " items | ";
          } else {
            fieldRow += " | [" + fieldName + "]" + fieldLink + " item | ";
          }
        } else if (field.choices) {
          fieldRow += " | [" + fieldName + "]" + fieldLink + " choices | ";

          subContent.push("\r\n### " + fieldName + " choices\r\n");

          subContent.push("|Value       |Title |Description |");
          subContent.push("|:-----------|:-----|:-----------|");

          for (const choice of field.choices) {
            let choiceRow = "";

            choiceRow += "| " + choice.id;
            choiceRow +=
              " | " + (choice.title ? this.sanitizeForTable(choice.title) : Utilities.humanifyMinecraftName(choice.id));
            choiceRow += " | " + (choice.description ? this.sanitizeForTable(choice.description) : "") + "|";

            subContent.push(choiceRow);
          }
        } else if (field.dataType === FieldDataType.minecraftEventTrigger) {
          fieldRow +=
            " | [" +
            DataFormUtilities.getFieldTypeDescription(field.dataType) +
            "](../Definitions/NestedTables/triggers.md) | ";
        } else {
          let fieldTypes = "";

          for (const scalarFieldInst of DataFormUtilities.getFieldAndAlternates(field)) {
            if (fieldTypes.length > 0) {
              fieldTypes += " or ";
            }

            fieldTypes += DataFormUtilities.getFieldTypeDescription(scalarFieldInst.dataType);
          }

          fieldRow += " | " + fieldTypes + " | ";
        }

        if (field.description) {
          fieldRow += this.sanitizeForTable(field.description);

          if (field.note) {
            fieldRow += " " + this.sanitizeForTable(field.note);
          }

          if (field.note2) {
            fieldRow += " " + this.sanitizeForTable(field.note2);
          }

          if (field.note3) {
            fieldRow += " " + this.sanitizeForTable(field.note3);
          }
        }

        fieldRow += " | ";

        if (subForm && subForm.fields.length > 0) {
          subContent.push("\r\n## " + fieldName + " item type");

          await this.appendForm(subForm, subContent, depth + 1, fieldName);
        }

        if (field.samples) {
          let samplesAdded = 0;
          const samplesUsed: string[] = [];
          let addedKey = false;

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
                    sampleSet[key] = "`" + sampleVal + "`";
                  } else {
                    sampleSet[key] = sampleSet[key] + ", `" + sampleVal + "`";
                  }
                }
              }

              for (const key in sampleSet) {
                if (addedKey) {
                  fieldRow += ", ";
                }

                fieldRow += Utilities.humanifyMinecraftName(key) + ": " + this.sanitizeForTable(sampleSet[key]);
                addedKey = true;
              }
            }
          }
        }

        fieldRow += " | ";

        content.push(fieldRow);
      }

      content.push(...subContent);
    }
  }

  public async appendValidatorForm(form: IFormDefinition, content: string[], depth: number, altTitle?: string) {
    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\r\n");
    }

    if (form.note) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note) + "\r\n");
    }

    if (form.note2) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note2) + "\r\n");
    }

    if (form.note3) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note3) + "\r\n");
    }

    let title = undefined;

    if (form.title) {
      if (form.title === form.id) {
        title = Utilities.humanifyMinecraftName(form.id);
      } else {
        title = form.title;
      }
    } else if (form.id) {
      title = Utilities.humanifyMinecraftName(form.id);
    } else if (altTitle) {
      title = altTitle;
    } else {
      title = "Item";
    }

    if (form.fields && form.fields.length > 0) {
      const subContent: string[] = [];
      if (depth > 0) {
        content.push("\r\n#### " + title + " Properties\r\n");
      } else {
        content.push("\r\n## " + title + " Properties\r\n");
      }

      content.push("|Name       |Description |");
      content.push("|:----------|:-------------|");

      form.fields.sort((a: IField, b: IField) => {
        return a.id.localeCompare(b.id);
      });

      let fullFieldList: IField[] = [];

      for (const field of form.fields) {
        fullFieldList.push(field);

        if (field.alternates) {
          let i = 0;
          for (const altField of field.alternates) {
            i++;

            if (!altField.id || altField.id === field.id) {
              altField.id = field.id + " (Alternate " + i + ")";
            }

            fullFieldList.push(altField);
          }
        }
      }

      for (const field of fullFieldList) {
        let fieldRow = "| " + field.id + " | ";

        if (field.description) {
          fieldRow += this.sanitizeForTable(field.description);

          if (field.note) {
            fieldRow += " " + this.sanitizeForTable(field.note);
          }

          if (field.note2) {
            fieldRow += " " + this.sanitizeForTable(field.note2);
          }

          if (field.note3) {
            fieldRow += " " + this.sanitizeForTable(field.note3);
          }
        }

        fieldRow += " | ";

        content.push(fieldRow);
      }

      content.push(...subContent);
    }
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
    await inputFolder.load();

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
        await file.loadContent();

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO) {
          formsByPath[file.storageRelativePath] = jsonO;
        }
      }
    }
  }
}
