import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import IIndexJson from "../storage/IIndexJson";
import StorageUtilities from "../storage/StorageUtilities";
import DataFormUtilities from "../dataform/DataFormUtilities";
import IField, { FieldDataType } from "../dataform/IField";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { ComparisonType } from "../dataform/ICondition";
import FieldUtilities from "../dataform/FieldUtilities";
import Log from "../core/Log";

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
  deferredRendering = 16,
  molang = 17,
  culling = 18,
  manifest = 19,
}

export default class FormMarkdownDocumentationGenerator {
  public async generateMarkdown(formJsonInputFolder: IFolder, outputFolder: IFolder) {
    const formsByPath: { [name: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formJsonInputFolder, outputFolder);

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.features,
      "/FeaturesReference/Examples/Features/",
      "/features/minecraft_",
      "Feature",
      "Feature Type"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.features,
      "/FeaturesReference/Examples/FeatureList.md",
      "/features/minecraft_",
      "Features",
      "Features"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.featureCore,
      "/FeaturesReference/Examples/Features/",
      "/feature/",
      "Feature",
      "Feature Type"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.features,
      "/FeaturesReference/Examples/Features/TOC.yml",
      "/features/minecraft_",
      "- name: Features List\n  href: ../FeatureList.md",
      "minecraft_"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/EntityGoals/",
      "/entity/minecraft_behavior",
      "Entity",
      "AI Behavior Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.visuals,
      "/VisualReference/",
      "/visual/",
      "Visuals",
      "Visual Element"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.fogs,
      "/FogsReference/",
      "/fogs/",
      "Fogs",
      "Fog Element"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.websockets,
      "/WebsocketsReference/",
      "/websockets/",
      "Websockets",
      "Websocket Packet"
    );

    await this.exportValidatorMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.MCToolsVal,
      "/MCToolsValReference/",
      "/mctoolsval/",
      "MCTools Validation Rules",
      "MCTools Validation Rules"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.triggers,
      "/EntityReference/Examples/EntityTriggers/",
      "/entity/minecraft_on",
      "Entity",
      "Entity Trigger"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.filters,
      "/EntityReference/Examples/Filters/",
      "/entityfilters/",
      "Entity Filters",
      "Entity Filter Element"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/EntityReference/Examples/EventActions/",
      "/entityevents/",
      "Entity Actions",
      "Entity Action Types"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.blockComponents,
      "/BlockReference/Examples/BlockComponents/",
      "/block/minecraft_",
      "Block Components",
      "Block Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.itemComponents,
      "/ItemReference/Examples/ItemComponents/",
      "/item_components/minecraft_",
      "Items",
      "Item Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/EntityComponents/",
      "/entity/minecraft_",
      "Entity",
      "Entity Component"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.deferredRendering,
      "/DeferredRendering/",
      "/client_deferred_rendering/",
      "Deferred Rendering",
      "Deferred Rendering"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/ClientBiomesReference/Examples/Components/",
      "/client_biome/",
      "Client Biome",
      "Client Biome"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.manifest,
      "/ManifestReference/",
      "/3.0.0/",
      "Pack Manifest",
      "Pack Manifest"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/ClientBiomesReference/Examples/ComponentList.md",
      "/client_biome/minecraft_",
      "Client Biomes",
      "Components"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.clientBiomes,
      "/ClientBiomesReference/Examples/Components/TOC.yml",
      "/client_biome/minecraft_",
      "- name: Components List\r\n  href: ../ComponentList.md",
      "minecraftClientBiomes_"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/ComponentList.md",
      "/entity/minecraft_",
      "Entity Components",
      "EntityComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/EntityComponents/TOC.yml",
      "/entity/minecraft_",
      "- name: Components List\n  href: ../ComponentList.md",
      "minecraftComponent_"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.biomes,
      "/BiomesReference/Examples/Components/",
      "/biome/",
      "Biome",
      "Biome"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.biomes,
      "/BiomesReference/Examples/ComponentList.md",
      "/biome/minecraft_",
      "Biomes",
      "Components",
      ["capped.", "frozen_ocean.", "mesa.", "overworld.", "swamp", "the_end."] // these end up as children of surface_builder
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.biomes,
      "/BiomesReference/Examples/Components/TOC.yml",
      "/biome/minecraft_",
      "- name: Components List\n  href: ../ComponentList.md",
      "minecraftBiomes_",
      ["capped.", "frozen_ocean.", "mesa.", "overworld.", "swamp.", "the_end."]
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.blockComponents,
      "/BlockReference/Examples/BlockComponents/BlockComponentsList.md",
      "/block/minecraft_",
      "Block Components",
      "."
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.blockComponents,
      "/BlockReference/Examples/BlockComponents/TOC.yml",
      "/block/minecraft_",
      "- name: Block Components List\n  href: BlockComponentsList.md"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.itemComponents,
      "/ItemReference/Examples/ItemComponentList.md",
      "/item_components/minecraft_",
      "Item Components",
      "./ItemComponents"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.itemComponents,
      "/ItemReference/Examples/ItemComponents/TOC.yml",
      "/item_components/minecraft_",
      "- name: Item Components List\n  href: ../ItemComponentList.md"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.culling,
      "/BlockCullingReference/",
      "/block_culling/",
      "Block Culling",
      "Block Culling"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.culling,
      "/BlockCullingReference/TOC.yml",
      "/block_culling/"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.triggers,
      "/EntityReference/Examples/TriggerList.md",
      "/entity/minecraft_on",
      "Entity Triggers",
      "EntityTriggers"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.entityComponents,
      "/EntityReference/Examples/EntityTriggers/TOC.yml",
      "/entity/minecraft_on",
      "- name: Triggers List\n  href: ../TriggerList.md",
      "minecraftTrigger_"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/AIGoalList.md",
      "/entity/minecraft_behavior",
      "Entity Behavior (AI) Components",
      "EntityGoals"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.AIGoals,
      "/EntityReference/Examples/EntityGoals/TOC.yml",
      "/entity/minecraft_behavior",
      "- name: AI Component List\n  href: ../AIGoalList.md"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.filters,
      "/EntityReference/Examples/FilterList.md",
      "/entityfilters/",
      "Entity Filter Types",
      "Filters"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.filters,
      "/EntityReference/Examples/Filters/TOC.yml",
      "/entityfilters/",
      "- name: Entity Filter List\n  href: ../FilterList.md"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/EntityReference/Examples/EventActions.md",
      "/entityevents/",
      "Event Actions",
      "EventActions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/EntityReference/Examples/EventActions/TOC.yml",
      "/entityevents/",
      "- name: Entity Event List\n  href: ../EventActions.md"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/QueryFunctions/",
      "/molang/query_",
      "Molang",
      "Molang"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/QueryFunctions.md",
      "/molang/query_",
      "Molang Query Functions",
      "queryfunctions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/MolangReference/Examples/MolangConcepts/QueryFunctions/TOC.yml",
      "/molang/query_",
      "- name: Molang Query Function List\n  href: ../QueryFunctions.md"
    );

    await this.exportMarkdownCatalogDocs(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/MathFunctions/",
      "/molang/math_",
      "Molang",
      "Molang"
    );

    await this.exportMarkdownDocListPage(
      formsByPath,
      outputFolder,
      ExportMode.molang,
      "/MolangReference/Examples/MolangConcepts/MathFunctions.md",
      "/molang/math_",
      "Molang Math Functions",
      "mathfunctions"
    );

    await this.exportListYml(
      formsByPath,
      outputFolder,
      ExportMode.eventResponses,
      "/MolangReference/Examples/MolangConcepts/MathFunctions/TOC.yml",
      "/molang/math_",
      "- name: Molang Math Function List\n  href: ../MathFunctions.md"
    );
  }

  private getFileNameFromBaseName(baseName: string, exportMode: ExportMode) {
    let fileName = baseName;

    if (exportMode === ExportMode.triggers && fileName.startsWith("minecraft_on_")) {
      fileName = "minecraftTrigger_" + baseName.substring(10);
    } else if (exportMode === ExportMode.triggers && fileName.startsWith("minecraft_on_")) {
      fileName = "minecraftTrigger_" + baseName.substring(10);
    } else if (exportMode === ExportMode.AIGoals && fileName.startsWith("minecraft_behavior")) {
      fileName = "minecraftB" + baseName.substring(11);
    } else if (exportMode === ExportMode.entityComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraftComponent_" + baseName.substring(10);
    } else if (exportMode === ExportMode.blockComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraftBlock_" + baseName.substring(10);
    } else if (exportMode === ExportMode.itemComponents && fileName.startsWith("minecraft_")) {
      fileName = "minecraft_" + baseName.substring(10);
    } else if (exportMode === ExportMode.clientBiomes && fileName.startsWith("minecraft_")) {
      fileName = "minecraftClientBiomes_" + baseName.substring(10);
    } else if (exportMode === ExportMode.biomes && fileName.startsWith("minecraft_")) {
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
    categoryExtended: string,
    exclusionList?: string[]
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(filePath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

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
    categorySingular: string,
    exclusionList?: string[]
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

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
    categorySingular: string,
    exclusionList?: string[]
  ) {
    const targetFolder = await outputFolder.ensureFolderFromRelativePath(subFolderPath);

    if (!targetFolder) {
      return;
    }

    let hasEnsuredFolder = false;

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

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
    subFolderName: string,
    exclusionList?: string[]
  ) {
    const targetFile = await outputFolder.ensureFileFromRelativePath(subFolderPath);

    if (!targetFile) {
      return;
    }

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

    const content: string[] = [];
    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + category,
        "A reference document describing all current " + category
      )
    );

    let internalDepCount = 0;

    content.push("# " + category + " Documentation\n");
    content.push("| " + category + " | Description |");
    content.push("|:-----|:----------|");

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO && !formO.isDeprecated && !formO.isInternal) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        let canonName = EntityTypeDefinition.getComponentFromBaseFileName(baseName);

        if (formO.id) {
          canonName = formO.id;
        } else if (formO.title) {
          canonName = formO.title;
        }

        canonName = canonName?.replace(/\`/gi, "");

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
      } else if (formO) {
        internalDepCount++;
      }
    }

    if (internalDepCount > 0) {
      content.push("");
      content.push("## Internal/Deprecated Components");
      content.push("These components are either deprecated or internal to Minecraft and not usable in custom content.");
      content.push("");

      content.push("| " + category + " | Description |");
      content.push("|:-----|:----------|");

      for (const formPath in formsByPath) {
        const formO = formsByPath[formPath];

        if (formO && (formO.isDeprecated || formO.isInternal)) {
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
    }

    targetFile.setContent(content.join("\n"));

    await targetFile.saveContent();
  }

  public async exportListYml(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    exportMode: ExportMode,
    subFolderPath: string,
    formsPath: string,
    header?: string,
    prefix?: string,
    exclusionList?: string[]
  ) {
    const targetFile = await outputFolder.ensureFileFromRelativePath(subFolderPath);

    if (!targetFile) {
      return;
    }
    const content: string[] = [];

    if (header) {
      content.push(header);
    }

    formsByPath = this.getFormsFromFilter(formsByPath, formsPath, exportMode, exclusionList);

    for (const formPath in formsByPath) {
      const formO = formsByPath[formPath];

      if (formO && !formO.isDeprecated && !formO.isInternal) {
        let baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(formPath));

        if (baseName.endsWith(".form")) {
          baseName = baseName.substring(0, baseName.length - 5);
        }

        if (prefix && baseName.startsWith("minecraftComponent_")) {
          baseName = prefix + baseName.substring(19);
        } else if (prefix && baseName.startsWith("minecraft_")) {
          baseName = prefix + baseName.substring(10);
        } else if (prefix) {
          baseName = prefix + baseName;
        }

        let name = formO.id ? formO.id : formO.title;

        name = name?.replace(/\`/gi, "");

        content.push("- name: " + name);
        content.push("  href: " + this.getFileNameFromBaseName(baseName, exportMode) + ".md");
      }
    }

    targetFile.setContent(content.join("\n"));

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

    if (exportMode === ExportMode.websockets && form.id) {
      canonName = form.id;
    }

    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + canonName,
        "Describes the " + canonName + " " + categoryExtended.toLowerCase()
      )
    );

    content.push("# " + category + " Documentation - " + canonName + "\n");

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
      content.push("\n## Samples\n");
      let samplesAdded = 0;
      const linesAdded: string[] = [];

      for (const samplePath in form.samples) {
        let sampleArr = form.samples[samplePath];
        let addedHeader = false;

        if (sampleArr && samplesAdded < 12) {
          const sampBaseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(samplePath));

          let targetPath = samplePath;

          if (!Array.isArray(sampleArr)) {
            console.log("Malformed sample node at `" + samplePath + "` for file at `" + markdownFile.fullPath + "`");
          } else {
            for (const sample of sampleArr) {
              let line = "\n```json\n";

              if (
                baseName.startsWith("minecraft_") &&
                (typeof sample.content !== "string" || !sample.content.startsWith("minecraft:"))
              ) {
                line += '"' + canonName + '": ';
              }

              if (typeof sample.content === "object" || Array.isArray(sample.content)) {
                line += JSON.stringify(sample.content, undefined, 2) + "\n```\n";
              } else {
                if (typeof sample.content === "string") {
                  let cont = sample.content.trim();

                  if (cont.startsWith("{") && cont.endsWith("}")) {
                    line += cont + "\n```\n";
                  } else {
                    line += '"' + cont + '"\n```\n';
                  }
                } else {
                  line += sample.content + "\n```\n";
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
                        ")\n"
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
    }

    markdownFile.setContent(content.join("\n"));

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

    if (exportMode === ExportMode.websockets && form.id) {
      canonName = form.id;
    }

    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + canonName,
        "Describes the " + canonName + " " + categoryExtended.toLowerCase()
      )
    );

    content.push("# " + category + " Documentation - " + canonName + "\n");

    if (form.isDeprecated) {
      content.push("> [!IMPORTANT]");
      content.push("> This type is now deprecated, and no longer in use in the latest versions of Minecraft.");
      content.push("");
    }

    await this.appendValidatorForm(form, content, 0);

    markdownFile.setContent(content.join("\n"));

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

  public async appendForm(
    form: IFormDefinition,
    content: string[],
    depth: number,
    altTitle?: string,
    formStack?: string[],
    formsAppended?: { [name: string]: boolean }
  ) {
    if (!formStack) {
      formStack = [];
    } else {
      formStack = formStack.slice();
    }

    if (!formsAppended) {
      formsAppended = {};
    }

    const formId = form.id ? form.id : form.title ? form.title : JSON.stringify(form.fields);

    if (formStack.includes(formId)) {
      Log.message("Dependency loop in the stack with " + formId + " in " + formStack.join(" -> ") + " detected.");
      return;
    }

    formStack.push(formId);

    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\n");
    }

    if (form.technicalDescription) {
      content.push(this.sanitizeDescription(form.technicalDescription) + "\n");
    }

    if (form.note) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note) + "\n");
    }

    if (form.note2) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note2) + "\n");
    }

    if (form.note3) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note3) + "\n");
    }

    if (form.versionIntroduced || form.versionDeprecated) {
      content.push("> [!Note]");

      if (form.versionDeprecated) {
        content.push("> This item no longer works after format versions of at least " + form.versionIntroduced + ".\n");
      }

      if (form.versionIntroduced) {
        content.push("> This item requires a format version of at least " + form.versionIntroduced + ".\n");
      }
    }

    if (form.requires) {
      let descStr = "";
      const entityComponents = [];

      if (!Array.isArray(form.requires)) {
        console.log("Malformed requires node at `" + JSON.stringify(form.requires) + "`");
      } else {
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
          } else if (
            dep.type === "entity_component" ||
            dep.type === "item_component" ||
            dep.type === "block_component"
          ) {
            if (dep.description) {
              if (descStr.length > 0) {
                descStr += " ";
              }
              descStr += dep.description;
            }
            entityComponents.push(dep.id);
          }
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
      content.push("## Alternate Simple Representations\n");

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
        title = Utilities.humanifyMinecraftName(form.id, true);
      } else {
        title = form.title;
      }
    } else if (form.id) {
      title = Utilities.humanifyMinecraftName(form.id, true);
    } else if (altTitle) {
      title = altTitle;
    } else {
      title = "Item";
    }

    if (form.fields && form.fields.length > 0) {
      const subContent: string[] = [];
      if (depth > 0) {
        content.push("\n#### " + title + " Properties\n");
      } else {
        content.push("\n## " + title + " Properties\n");
      }

      content.push("|Name       |Default Value |Type |Description |Example Values |");
      content.push("|:----------|:-------------|:----|:-----------|:------------- |");

      form.fields.sort((a: IField, b: IField) => {
        if (a.isDeprecated && !b.isDeprecated) {
          return 1;
        } else if (!a.isDeprecated && b.isDeprecated) {
          return -1;
        }
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
        let modifiedSubFieldId = field.id;
        let subFormTitle = undefined;
        let subForm = await FieldUtilities.getSubForm(field);

        if (subForm) {
          subFormTitle = subForm.title
            ? subForm.title
            : subForm.id
            ? Utilities.humanifyMinecraftName(subForm.id)
            : undefined;

          if (subFormTitle) {
            const lastAlt = modifiedSubFieldId.lastIndexOf("(Alternate");

            if (lastAlt >= 0) {
              modifiedSubFieldId = modifiedSubFieldId.substring(0, lastAlt);
              modifiedSubFieldId += "(" + subFormTitle + ")";
            } else {
              modifiedSubFieldId += " (" + subFormTitle + ")";
            }
          } else {
            subFormTitle = "item type";
          }
        }

        if (field.isDeprecated) {
          modifiedSubFieldId = "(deprecated) " + modifiedSubFieldId;
        }

        let fieldRow = "| " + (field.alternates ? modifiedSubFieldId : field.id) + " | ";

        if (field.defaultValue !== undefined) {
          fieldRow += this.getValueAsString(field.defaultValue);
        } else {
          fieldRow += "*not set*";
        }

        let fieldName = Utilities.humanifyMinecraftName(modifiedSubFieldId);

        if (subForm && subForm.fields && subForm.fields.length > 0 && subFormTitle && field.subFormId) {
          const fieldLink = "(#" + this.getMarkdownBookmark(subFormTitle) + ")";

          if (field.dataType === FieldDataType.objectArray) {
            fieldRow += " | Array of [" + fieldName + "]" + fieldLink + " items | ";
          } else if (field.dataType === FieldDataType.keyedObjectCollection) {
            fieldRow += " | Key/item pairs of [" + fieldName + "]" + fieldLink + " items | ";
          } else {
            fieldRow += " | [" + fieldName + "]" + fieldLink + " item | ";
          }

          if (!formsAppended[subFormTitle]) {
            subContent.push("\n## " + subFormTitle);

            await this.appendForm(subForm, subContent, depth + 1, subFormTitle, formStack, formsAppended);
            formsAppended[subFormTitle] = true;
          }
        } else if (subForm && subForm.fields && subForm.fields.length > 0 && subFormTitle) {
          const fieldLink = "(#" + this.getMarkdownBookmark(fieldName) + ")";

          if (field.dataType === FieldDataType.objectArray) {
            fieldRow += " | Array of [" + fieldName + "]" + fieldLink + " items | ";
          } else if (field.dataType === FieldDataType.keyedObjectCollection) {
            fieldRow += " | Key/item pairs of [" + fieldName + "]" + fieldLink + " items | ";
          } else {
            fieldRow += " | [" + fieldName + "]" + fieldLink + " item | ";
          }

          if (!formsAppended[fieldName]) {
            subContent.push("\n## " + fieldName);

            await this.appendForm(subForm, subContent, depth + 1, fieldName, formStack, formsAppended);
            formsAppended[fieldName] = true;
          }
        } else if (field.choices) {
          const fieldLink = "(#" + this.getMarkdownBookmark(fieldName) + "-choices)";

          fieldRow += " | [" + fieldName + "]" + fieldLink + " choices | ";

          subContent.push("\n### " + fieldName + " choices\n");

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

          fieldTypes = DataFormUtilities.getFieldTypeDescription(field.dataType);

          fieldRow += " | " + fieldTypes + " | ";
        }

        if (field.description) {
          let descrip = field.description;

          descrip += " " + this.addAdditionalNotes(field);

          if (field.technicalDescription) {
            descrip += " " + field.technicalDescription;
          }

          descrip = descrip.trim();

          if (field.isDeprecated) {
            descrip = "Deprecated - no longer in use. " + descrip;
          }

          if (field.versionDeprecated) {
            descrip +=
              " This property no longer works after format versions of at least " + form.versionIntroduced + ".";
          }

          if (field.versionIntroduced) {
            descrip += " This item requires a format version of at least " + form.versionIntroduced + ".";
          }

          fieldRow += this.sanitizeForTable(descrip);

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

  public addAdditionalNotes(field: IField) {
    let descrip = "";

    if (field.minLength) {
      descrip += "Value must have at least " + field.minLength + " items. ";
    }
    if (field.maxLength) {
      descrip += "Value must have at most " + field.maxLength + " items. ";
    }
    if (field.validity) {
      for (const cond of field.validity) {
        if (cond.comparison === ComparisonType.matchesPattern) {
          descrip += 'Value must match a regular expression pattern of "' + cond.value + '". ';
        } else if (cond.comparison) {
          descrip += "Value must be " + cond.comparison + " " + cond.value + ". ";
        }
      }
    }
    return descrip;
  }

  public async appendValidatorForm(form: IFormDefinition, content: string[], depth: number, altTitle?: string) {
    if (form.description) {
      content.push(this.sanitizeDescription(form.description) + "\n");
    }

    if (form.technicalDescription) {
      content.push(this.sanitizeDescription(form.technicalDescription) + "\n");
    }

    if (form.note) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note) + "\n");
    }

    if (form.note2) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note2) + "\n");
    }

    if (form.note3) {
      content.push("> [!Note]");
      content.push("> " + this.sanitizeDescription(form.note3) + "\n");
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
        content.push("\n#### " + title + " Properties\n");
      } else {
        content.push("\n## " + title + " Properties\n");
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
    return id.toLowerCase().replace(/ /gi, "-").replace(/\(/gi, "").replace(/\)/gi, "");
  }

  public getFormsFromFilter(
    formsByPath: { [name: string]: IFormDefinition },
    formsPath: string,
    mode: ExportMode,
    exclusionList?: string[]
  ) {
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

      if (exclusionList && includeFile) {
        for (const exclude of exclusionList) {
          if (formPath.indexOf(exclude) >= 0) {
            includeFile = false;
            break;
          }
        }
      }

      if (
        includeFile &&
        formPath.toLowerCase().startsWith(formsPath) &&
        formsByPath[formPath] &&
        Utilities.isUsableAsObjectKey(formPath) &&
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
