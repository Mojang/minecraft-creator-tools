import Utilities from "../core/Utilities";
import IFormDefinition from "../dataform/IFormDefinition";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import IIndexJson from "../storage/IIndexJson";
import StorageUtilities from "../storage/StorageUtilities";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import DataFormUtilities from "../dataform/DataFormUtilities";
import IField from "../dataform/IField";
import LegacyDocumentationDefinition from "../minecraft/docs/LegacyDocumentationDefinition";
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

export default class DocJsonMarkdownDocumentationGenerator {
  public async generateMarkdown(formJsonInputFolder: IFolder, outputFolder: IFolder) {
    const formsByPath: { [name: string]: IFormDefinition } = {};

    await this.loadFormJsonFromFolder(formsByPath, formJsonInputFolder, outputFolder);

    this.exportMarkdownAggregatedPage(
      formsByPath,
      outputFolder,
      "/AnimationsReference/Examples/AnimationController.md",
      "animations",
      ["/Animation Controllers/"],
      "Animation Controllers",
      "Animation Controllers"
    );

    this.exportMarkdownAggregatedPage(
      formsByPath,
      outputFolder,
      "/AnimationsReference/generated/AnimationGettingStarted.md",
      "animations",
      [
        "/Overview/",
        "/Names/",
        "/Getting Started/Adding Animations/",
        "/Getting Started/Animation Hierarchy/",
        "/Key Frames/",
        "/Transforms/",
      ],
      "Animation Getting Started",
      "Animation Getting Started"
    );

    this.exportMarkdownAggregatedPage(
      formsByPath,
      outputFolder,
      "/AnimationsReference/generated/AnimationRenderController.md",
      "animations",
      ["/Render Controllers/"],
      "Animation and Render Controllers",
      "Animation and Render Controllers"
    );

    this.exportMarkdownAggregatedPage(
      formsByPath,
      outputFolder,
      "/AnimationsReference/Examples/AnimationUpgrading.md",
      "animations",
      [
        "/Getting Started/Upgrade from v1.7 Beta to v1.8/",
        "/Getting Started/Upgrade from v1.8 Beta to v1.10/",
        "/Getting Started/Upgrade from v1.10 to v1.17.30/",
        "/Getting Started/Upgrade from v1.17.30 to v1.18.10/",
        "/Getting Started/Upgrade from v1.18.10 to v1.18.20/",
      ],
      "Animation Controllers",
      "Animation Controllers"
    );
  }

  private getFileNameFromBaseName(baseName: string) {
    let fileName = baseName;

    if (fileName.startsWith("minecraft_on_")) {
      fileName = "minecraftTrigger_" + baseName.substring(10);
    } else if (fileName.startsWith("minecraft_")) {
      fileName = "minecraftComponent_" + baseName.substring(10);
    }

    return fileName;
  }

  public async exportMarkdownAggregatedPage(
    formsByPath: { [name: string]: IFormDefinition },
    outputFolder: IFolder,
    filePath: string,
    docCatalogName: string,
    docNodePaths: string[],
    category: string,
    categoryExtended: string
  ) {
    const targetFile = await outputFolder.ensureFileFromRelativePath(filePath);

    if (!targetFile) {
      return;
    }

    const docLines: string[] = [];

    docLines.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + category,
        "A reference document describing all current " + category
      )
    );

    docLines.push("# " + category + "\n");

    for (const docNodePath of docNodePaths) {
      const docNode = await LegacyDocumentationDefinition.loadNode(docCatalogName, docNodePath, true);

      if (docNode) {
        if (docNode.nodes) {
          docLines.push("## " + docNode.name);
          for (const childNode of docNode.nodes) {
            if (childNode.description) {
              docLines.push("");
              docLines.push(...childNode.description);
            }
            if (childNode.examples) {
              for (const example of childNode.examples) {
                if (example.name && example.text) {
                  docLines.push("\n### " + example.name);
                  docLines.push(...example.text);
                }
              }
            }
          }
        }
      } else {
        Log.debugAlert("Could not find '" + docNodePath + "'");
      }
    }

    targetFile.setContent(docLines.join("\n"));
    await targetFile.saveContent();
  }

  public appendForm(form: IFormDefinition, content: string[]) {
    if (form.description) {
      let descrip = form.description.trim();

      if (descrip.length > 10 && !descrip.endsWith(".")) {
        descrip += ".";
      }

      content.push(descrip + "\n");
    }

    if (form.technicalDescription) {
      let techDescrip = form.technicalDescription.trim();

      if (techDescrip.length > 10 && !techDescrip.endsWith(".")) {
        techDescrip += ".";
      }

      content.push(techDescrip + "\n");
    }

    const subContent: string[] = [];
    content.push("\n## Properties\n");

    content.push("|Name       |Default Value |Type |Description |Example Values |");
    content.push("|:----------|:-------------|:----|:-----------|:------------- |");

    form.fields.sort((a: IField, b: IField) => {
      return a.id.localeCompare(b.id);
    });

    for (const field of form.fields) {
      let fieldRow = "| " + field.id + " | ";

      if (field.defaultValue !== undefined) {
        fieldRow += field.defaultValue;
      } else {
        fieldRow += "*not set*";
      }

      fieldRow += " | " + DataFormUtilities.getFieldTypeDescription(field.dataType) + " | ";

      if (field.description) {
        fieldRow += field.description;
      }

      if (field.technicalDescription) {
        fieldRow += field.technicalDescription;
      }

      fieldRow += " | ";

      if (field.subForm && field.subForm.fields.length > 0) {
        subContent.push("\n### Sub item: " + field.id + "\n");

        this.appendForm(field.subForm, subContent);
      }

      if (field.samples) {
        let samplesAdded = 0;
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
                  sampleSet[key] = "`" + sampleVal + "`";
                } else {
                  sampleSet[key] = sampleSet[key] + ", `" + sampleVal + "`";
                }
              }
            }

            let exampleAdded = false;
            for (const key in sampleSet) {
              if (exampleAdded) {
                fieldRow += ", ";
              }

              fieldRow += Utilities.humanifyMinecraftName(key) + ": " + sampleSet[key];

              exampleAdded = true;
            }
          }
        }
      }

      fieldRow += " | ";

      content.push(fieldRow);
    }

    content.push(...subContent);
  }

  public async saveMarkdownDocFromForm(
    markdownFile: IFile,
    form: IFormDefinition,
    baseName: string,
    category: string,
    categoryExtended: string
  ) {
    const content: string[] = [];

    let canonName = EntityTypeDefinition.getComponentFromBaseFileName(baseName);

    content.push(
      Utilities.stringFormat(
        MarkdownTop,
        category + " Documentation - " + canonName,
        "Describes the " + canonName + " " + categoryExtended
      )
    );

    content.push("# " + category + " Documentation - " + canonName + "\n");

    this.appendForm(form, content);

    if (form.samples) {
      content.push("\n## Samples\n");
      let samplesAdded = 0;
      for (const samplePath in form.samples) {
        let sampleArr = form.samples[samplePath];

        if (sampleArr && samplesAdded < 3) {
          const baseName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(samplePath));

          let targetPath = samplePath;

          if (targetPath.startsWith("/vanilla")) {
            targetPath = "https://github.com/Mojang/bedrock-samples/tree/preview" + targetPath.substring(8);
          }

          content.push(
            "### [" + baseName.substring(0, 1).toUpperCase() + baseName.substring(1) + "](" + targetPath + ")"
          );
          for (const sample of sampleArr) {
            if (sampleArr.length > 1) {
              content.push("\nAt " + sample.path + ": ");
            }
            if (typeof sample.content === "object" || Array.isArray(sample.content)) {
              content.push("\n```json\n" + JSON.stringify(sample.content, undefined, 2) + "\n```\n");
            } else {
              content.push("\n`" + sample.content + "`\n");
            }
          }
        }
      }
    }

    markdownFile.setContent(content.join("\n"));

    await markdownFile.saveContent();
  }

  public getFormsFromFilter(formsByPath: { [name: string]: IFormDefinition }, formsPath: string) {
    const filteredList: { [name: string]: IFormDefinition } = {};

    for (const formPath in formsByPath) {
      if (
        formPath.toLowerCase().startsWith(formsPath) &&
        formsByPath[formPath] &&
        (formsPath.indexOf("behavior") >= 0 || formPath.indexOf("behavior") < 0) &&
        (formsPath.indexOf("_on") >= 0 || formPath.indexOf("_on") < 0)
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
        await file.loadContent();

        const jsonO = StorageUtilities.getJsonObject(file);

        if (jsonO) {
          if (Utilities.isUsableAsObjectKey(file.storageRelativePath)) {
            formsByPath[file.storageRelativePath] = jsonO;
          }
        }
      }
    }
  }
}
