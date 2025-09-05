import Log from "../core/Log";
import Utilities from "../core/Utilities";
import IFolder from "../storage/IFolder";
import Database from "../minecraft/Database";
import LegacyDocumentationDefinition from "../minecraft/docs/LegacyDocumentationDefinition";
import { MarkdownTop } from "./FormMarkdownDocumentationGenerator";
import IBlocksMetadata from "../minecraft/IBlocksMetadata";

const MaxLinesPerTable = 200;

export const BlockListTop = `# Default Minecraft Block Listings

Listed below are the available blocks for use in Minecraft: Bedrock Edition.

> [!NOTE]
> To learn more about how blocks function in Minecraft: Bedrock Edition, please take a look at the [Block JSON Documentation](../BlockReference/index.yml)

## List of Blocks

`;
export const BlockListTableTop = `| Name | States |
|:-----------|:-----------|`;

export const EntityListTop = `# Default Minecraft Entity Listings

An overview of the Entities that can be used in Addons for Minecraft: Bedrock Edition.

> [!NOTE]
> To learn more about how Entities function in Minecraft: Bedrock Edition, please take a look at the [Entity JSON Documentation](../EntityReference/index.yml)

## Entities List

Listed below are the available Entities for use in Minecraft: Bedrock Edition and their respective ID value.

`;

export const EntityListTableTop = `| Identifier| Full ID| Short ID |
|:-----------|:-----------|:-----------|`;

export const EntityDamageSourceListTop = `## Entity Damage Source

Listed below are the available Damage Sources that can be used when working with Entity components and filters.

| Damage Source|
|:-----------|`;

export const ItemListTop = `# Default Minecraft Item Listings

Listed below are the available Items for use in Minecraft: Bedrock Edition.

> [!NOTE]
> To learn more about how Items function in Minecraft: Bedrock Edition, please take a look at the [Item JSON Documentation](../ItemReference/index.yml)

## List of Items

`;

export const ItemListTableTop = `| Name | ID | 
|:-----------|:-----------|`;

export default class TableMarkdownDocumentationGenerator {
  public async generateMarkdown(outputFolder: IFolder) {
    const addonDocs = await Database.getAddonsDocs();
    const blocksMetadata = await Database.getBlocksMetadata();

    if (!addonDocs || !blocksMetadata) {
      Log.unexpectedUndefined();
      return;
    }

    await this.generateBlockListTable(blocksMetadata, outputFolder);
    await this.generateEntityListTable(outputFolder);
    await this.generateEntityDamageSourcesListTable(outputFolder);
    await this.generateItemListTable(outputFolder);
  }

  public async generateEntityListTable(outputFolder: IFolder) {
    const entitiesNode = await LegacyDocumentationDefinition.loadNode("addons", "/Entities/", true);

    if (!entitiesNode) {
      return;
    }
    const addonEntityLines: string[] = [];

    addonEntityLines.push(
      Utilities.stringFormat(
        MarkdownTop,
        "Default Minecraft Entity Listings",
        "A reference document detailing the entities and damage sources used in addons for Minecraft: Bedrock Edition"
      )
    );

    addonEntityLines.push(EntityListTop);
    addonEntityLines.push(EntityListTableTop);

    const previewFolder = await Database.getPreviewVanillaFolder();

    if (!previewFolder) {
      return;
    }

    const entitiesFolder = await previewFolder.getFolderFromRelativePath("/behavior_pack/entities/");

    if (!entitiesFolder) {
      return;
    }

    if (!entitiesFolder.isLoaded) {
      await entitiesFolder.load();
    }

    let i = 0;
    for (const node of entitiesNode.nodes) {
      if (node.name && node.description && node.default) {
        if (i % MaxLinesPerTable === MaxLinesPerTable - 1) {
          addonEntityLines.push("");
          addonEntityLines.push(EntityListTableTop);
        }

        let line = "| ";

        if (entitiesFolder.files[node.name + ".json"]) {
          line +=
            "[" +
            node.name +
            "](https://github.com/Mojang/bedrock-samples/blob/preview/behavior_pack/entities/" +
            node.name +
            ".json)";
        } else {
          line += node.name;
        }

        line += " | " + node.default + " | " + node.description + " |";

        addonEntityLines.push(line);
        i++;
      }
    }

    const file = await outputFolder.ensureFileFromRelativePath("/VanillaListingsReference/Entities.md");

    file.setContent(addonEntityLines.join("\n"));

    await file.saveContent();
  }

  public async generateEntityDamageSourcesListTable(outputFolder: IFolder) {
    const entitiesNode = await LegacyDocumentationDefinition.loadNode("addons", "/Entity Damage Source/", true);

    if (!entitiesNode) {
      return;
    }
    const addonEntityLines: string[] = [];

    addonEntityLines.push(
      Utilities.stringFormat(
        MarkdownTop,
        "Default Minecraft Entity Damage Source Listings",
        "A reference document detailing the damage sources used in addons for Minecraft: Bedrock Edition"
      )
    );

    addonEntityLines.push(EntityDamageSourceListTop);

    for (const node of entitiesNode.nodes) {
      if (node.name) {
        let line = "| ";

        line += node.name + " |";

        addonEntityLines.push(line);
      }
    }

    const file = await outputFolder.ensureFileFromRelativePath("/VanillaListingsReference/AddonEntityDamageSources.md");

    file.setContent(addonEntityLines.join("\n"));

    await file.saveContent();
  }

  public async generateItemListTable(outputFolder: IFolder) {
    const itemsNode = await LegacyDocumentationDefinition.loadNode("addons", "/Items/", true);

    if (!itemsNode) {
      return;
    }
    const addonItemLines: string[] = [];

    addonItemLines.push(
      Utilities.stringFormat(
        MarkdownTop,
        "Default Minecraft Item Listings",
        "A reference document detailing the items and damage sources used in addons for Minecraft: Bedrock Edition"
      )
    );

    addonItemLines.push(ItemListTop);
    addonItemLines.push(ItemListTableTop);

    const previewFolder = await Database.getPreviewVanillaFolder();

    if (!previewFolder) {
      return;
    }

    const itemsFolder = await previewFolder.getFolderFromRelativePath("/behavior_pack/items/");

    if (!itemsFolder) {
      return;
    }

    if (!itemsFolder.isLoaded) {
      await itemsFolder.load();
    }

    let i = 0;
    for (const node of itemsNode.nodes) {
      if (node.name && node.type) {
        if (i % MaxLinesPerTable === MaxLinesPerTable - 1) {
          addonItemLines.push("");
          addonItemLines.push(ItemListTableTop);
        }

        let line = "| ";

        if (itemsFolder.files[node.name + ".json"]) {
          line +=
            "[" +
            node.name +
            "](https://github.com/Mojang/bedrock-samples/blob/preview/behavior_pack/items/" +
            node.name +
            ".json)";
        } else {
          line += node.name;
        }

        line += " | " + node.type + " |";

        addonItemLines.push(line);
        i++;
      }
    }

    const file = await outputFolder.ensureFileFromRelativePath("/VanillaListingsReference/Items.md");

    file.setContent(addonItemLines.join("\n"));

    await file.saveContent();
  }

  public async generateBlockListTable(blocksMetadata: IBlocksMetadata, outputFolder: IFolder) {
    const addonBlockLines: string[] = [];

    addonBlockLines.push(
      Utilities.stringFormat(
        MarkdownTop,
        "Default Minecraft Block Listings",
        "A reference document listing the available blocks for use in Minecraft: Bedrock Edition"
      )
    );

    addonBlockLines.push(BlockListTop);
    addonBlockLines.push(BlockListTableTop);

    let i = 0;
    for (const dataItem of blocksMetadata.data_items) {
      if (i % MaxLinesPerTable === MaxLinesPerTable - 1) {
        addonBlockLines.push("");
        addonBlockLines.push(BlockListTableTop);
      }

      let line = "| " + dataItem.name + " | ";

      if (dataItem.properties.length > 0) {
        let propIndex = 0;
        for (const prop of dataItem.properties) {
          if (propIndex > 0) {
            line += ", ";
          }
          line += prop.name;

          propIndex++;
        }
      }
      line += " |";

      addonBlockLines.push(line);
      i++;
    }

    const file = await outputFolder.ensureFileFromRelativePath("/VanillaListingsReference/Blocks.md");

    file.setContent(addonBlockLines.join("\n"));

    await file.saveContent();
  }
}
