import { JSONSchema7 } from "json-schema";
import Utilities from "../core/Utilities";
import IField, { FieldDataType } from "../dataform/IField";
import IFormDefinition, { IFormSample } from "../dataform/IFormDefinition";
import IFolder from "../storage/IFolder";
import Database from "../minecraft/Database";
import ILegacyDocumentationNode from "../minecraft/docs/ILegacyDocumentation";
import LegacyDocumentationDefinition from "../minecraft/docs/LegacyDocumentationDefinition";
import JsonSchemaDefinition from "../jsonschema/JsonSchemaDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import IFile from "../storage/IFile";
import IIndexJson from "../storage/IIndexJson";
import { AnnotationCategories } from "../core/ContentIndex";
import DataFormUtilities from "../dataform/DataFormUtilities";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ISimpleReference from "../core/ISimpleReference";
import { ComparisonType } from "../dataform/ICondition";

export interface JsonTypeSummary {
  title: string;
  category: string;
}

const TypesToExport: JsonTypeSummary[] = [
  { title: "Block Specifier", category: "block" },
  { title: "block_descriptor", category: "block" },
  { title: "block_legacy_ptr", category: "block" },
  { title: "block_pos", category: "block" },
  { title: "BlockCulling", category: "block_culling" },
  { title: "BlockCulling::Contents", category: "block_culling" },
  { title: "BlockCulling::Contents::Description", category: "block_culling" },
  { title: "BlockCulling::Contents::Rule", category: "block_culling" },
  { title: "BlockCulling::Contents::Rule::GeometryPart", category: "block_culling" },
  { title: "BlockDescriptor", category: "block" },
  { title: "BlockDescriptorSerializer::BlockDescriptorProxy", category: "block" },
  { title: "CameraAimAssistCategoriesDefinition", category: "camera" },
  { title: "CameraAimAssistCategoryDefinition", category: "camera" },
  { title: "CameraAimAssistCategoryPriorities", category: "camera" },
  { title: "CameraAimAssistPresetDefinition", category: "camera" },
  { title: "Color255RGB", category: "misc" },
  { title: "compound_proxy", category: "misc" },
  { title: "ConstantIntProvider", category: "misc" },
  { title: "Coordinate Evaluation Order", category: "misc" },
  { title: "Coordinate Range", category: "misc" },
  { title: "DiggerItemComponent::BlockInfo", category: "item" },
  { title: "expression_node", category: "misc" },
  { title: "ExpressionNode", category: "misc" },
  { title: "ExpressionNode::StringRepresentation", category: "misc" },
  { title: "Feature Rule Conditions", category: "feature" },
  { title: "Feature Rule Definition", category: "feature" },
  { title: "Feature Rule Description", category: "feature" },
  { title: "Filter Group", category: "misc" },
  { title: "Filter Test", category: "misc" },
  { title: "item_descriptor", category: "item" },
  { title: "item_transforms", category: "item" },
  { title: "ItemDescriptor", category: "item" },
  { title: "Jigsaw Joint Type", category: "jigsaw" },
  { title: "JigsawBlockMetadata", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::AlwaysTrueBlock", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::AlwaysTruePos", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::AppendLoot", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::AxisAlignedLinear", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::BlockMatch", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::Passthrough", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::RandomBlockMatch", category: "jigsaw" },
  { title: "JigsawStructure::ProcessorRule::TagMatch", category: "jigsaw" },
  { title: "JigsawStructure::Processors::BlockIgnore", category: "jigsaw" },
  { title: "JigsawStructure::Processors::BlockRules", category: "jigsaw" },
  { title: "JigsawStructure::Processors::Capped", category: "jigsaw" },
  { title: "JigsawStructure::Processors::ProtectedBlock", category: "jigsaw" },
  { title: "JigsawStructure::Rule", category: "jigsaw" },
  { title: "JigsawStructureDefinition::Description", category: "jigsaw" },
  { title: "JigsawStructureMetadata", category: "jigsaw" },
  { title: "JigsawStructureMetadataRegistry", category: "jigsaw" },
  { title: "JigsawStructureProcessorList::Description", category: "jigsaw" },
  { title: "JigsawStructureSet::Description", category: "jigsaw" },
  { title: "JigsawStructureSet::RandomSpreadPlacement", category: "jigsaw" },
  { title: "JigsawStructureSet::Structure", category: "jigsaw" },
  { title: "JigsawStructureTemplatePool::Description", category: "jigsaw" },
  { title: "JigsawStructureTemplatePool::SinglePoolElement", category: "jigsaw" },
  { title: "JigsawStructureTemplatePool::TemplatePoolElement", category: "jigsaw" },
  { title: "menu_category", category: "misc" },
  { title: "minecraft:aim_assist_categories", category: "camera" },
  { title: "minecraft:aim_assist_preset", category: "camera" },
  { title: "minecraft:allow_off_hand", category: "item" },
  { title: "minecraft:armor", category: "item" },
  { title: "minecraft:block_placer", category: "item" },
  { title: "minecraft:bundle_interaction", category: "item" },
  { title: "minecraft:can_destroy_in_creative", category: "item" },
  { title: "minecraft:chargeable", category: "item" },
  { title: "minecraft:compostable", category: "item" },
  { title: "minecraft:compostable", category: "item" },
  { title: "minecraft:cooldown", category: "item" },
  { title: "minecraft:custom_components", category: "item" },
  { title: "minecraft:damage", category: "item" },
  { title: "minecraft:damage_absorption", category: "item" },
  { title: "minecraft:digger", category: "item" },
  { title: "minecraft:display_name", category: "item" },
  { title: "minecraft:durability", category: "item" },
  { title: "minecraft:durability_sensor", category: "item" },
  { title: "minecraft:durability_sensor durability_threshold", category: "item" },
  { title: "minecraft:dyeable", category: "item" },
  { title: "minecraft:enchantable", category: "item" },
  { title: "minecraft:entity_placer", category: "item" },
  { title: "minecraft:food", category: "item" },
  { title: "minecraft:fuel", category: "item" },
  { title: "minecraft:glint", category: "item" },
  { title: "minecraft:hand_equipped", category: "item" },
  { title: "minecraft:hover_text_color", category: "item" },
  { title: "minecraft:icon", category: "item" },
  { title: "minecraft:interact_button", category: "item" },
  { title: "minecraft:item", category: "item" },
  { title: "minecraft:jigsaw_structure_metadata", category: "jigsaw" },
  { title: "minecraft:liquid_clipped", category: "item" },
  { title: "minecraft:max_stack_size", category: "item" },
  { title: "minecraft:on_use", category: "item" },
  { title: "minecraft:on_use_on", category: "item" },
  { title: "minecraft:projectile", category: "item" },
  { title: "minecraft:rarity", category: "item" },
  { title: "minecraft:record", category: "item" },
  { title: "minecraft:render_offsets", category: "item" },
  { title: "minecraft:repairable", category: "item" },
  { title: "minecraft:shooter", category: "item" },
  { title: "minecraft:should_despawn", category: "item" },
  { title: "minecraft:stacked_by_data", category: "item" },
  { title: "minecraft:storage_item", category: "item" },
  { title: "minecraft:tags", category: "item" },
  { title: "minecraft:throwable", category: "item" },
  { title: "minecraft:use_animation", category: "item" },
  { title: "minecraft:use_duration", category: "item" },
  { title: "minecraft:use_modifiers", category: "item" },
  { title: "minecraft:weapon", category: "item" },
  { title: "minecraft:wearable", category: "item" },
  { title: "Random Distribution Type", category: "misc" },
  { title: "repair_items", category: "item" },
  { title: "RepairableItemComponent::RepairItemEntry", category: "item" },
  { title: "Scatter Chance", category: "jigsaw" },
  { title: "Scatter Params", category: "jigsaw" },
  { title: "ShooterItemComponent::Ammunition", category: "item" },
  { title: "ActorDefinitionIdentifier", category: "entity" },
  { title: "DiggerLegacyBlockInfo", category: "item" },
  { title: "IItemComponentLegacyFactoryData::Components", category: "item" },
  { title: "RenderOffsetsItemComponent::TRS", category: "item" },
  { title: "SharedTypes::IntRange", category: "misc" },
  { title: "ShooterItemComponentLegacyFactoryData::ShooterAmmunitionEntry", category: "item" },
  { title: "Trade", category: "trade" },
  { title: "TradeGroup", category: "trade" },
  { title: "TradeItem", category: "trade" },
  { title: "TradeItem::Quantity", category: "trade" },
  { title: "TradeItemList", category: "trade" },
  { title: "TradeTableData", category: "trade" },
  { title: "TradeTier", category: "trade" },
  { title: "trigger", category: "misc" },
];

const MAX_FORM_DEPTH = 100;

export default class FormJsonDocumentationGenerator {
  defsById: { [name: string]: JSONSchema7 } = {};
  defsByTitle: { [name: string]: JSONSchema7 } = {};

  public async updateFormSource(folder: IFolder, isPreview?: boolean) {
    this.defsById = {};
    this.defsByTitle = {};

    const metadataFolder = isPreview
      ? await Database.loadPreviewMetadataFolder()
      : await Database.loadReleaseMetadataFolder();

    const schemaFolder = metadataFolder?.ensureFolder("json_schemas");

    if (schemaFolder) {
      await this.loadSchemas(schemaFolder);
    }

    /*
    Log all possible keys

    for (const key in this.defsByTitle) {
      console.log(key);
    }
    */

    const formJsonFolder = folder.ensureFolder("forms");
    await formJsonFolder.ensureExists();

    await this.exportJsonForms(formJsonFolder);

    const aiGoalsNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/AI Goals/",
      isPreview
    );

    if (aiGoalsNode) {
      await this.generateFormNodesFromNode(formJsonFolder, aiGoalsNode, "entity");
    }

    const attributesNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Attributes/",
      isPreview
    );

    if (attributesNode) {
      await this.generateFormNodesFromNode(formJsonFolder, attributesNode, "entity");
    }

    const propertiesNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Properties/",
      isPreview
    );

    if (propertiesNode) {
      await this.generateFormNodesFromNode(formJsonFolder, propertiesNode, "entity");
    }

    const entityComponentsNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Components/",
      isPreview
    );

    if (entityComponentsNode) {
      await this.generateFormNodesFromNode(formJsonFolder, entityComponentsNode, "entity");
    }

    const triggersComponentsNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Triggers/",
      isPreview
    );

    if (triggersComponentsNode) {
      await this.generateFormNodesFromNode(formJsonFolder, triggersComponentsNode, "entity");
    }

    const filtersComponentsNode = await LegacyDocumentationDefinition.loadNode("entities", "/Filters/", isPreview);

    if (filtersComponentsNode) {
      await this.generateFormNodesFromNode(formJsonFolder, filtersComponentsNode, "entityfilters");
    }

    const entityEventsComponentsNode = await LegacyDocumentationDefinition.loadNode("entity-events", "/", isPreview);

    if (entityEventsComponentsNode) {
      await this.generateFormNodesFromNode(formJsonFolder, entityEventsComponentsNode, "entityevents");
    }

    const blocksComponentsNode = await LegacyDocumentationDefinition.loadNode(
      "blocks",
      "/Blocks/Block Components/",
      isPreview
    );

    if (blocksComponentsNode) {
      await this.generateFormNodesFromNode(formJsonFolder, blocksComponentsNode, "block");
    }

    const schemasNode = await LegacyDocumentationDefinition.loadNode("schemas", "/Schemas/", isPreview);

    if (schemasNode) {
      await this.generateFormNodesFromSchemaDocs(formJsonFolder, schemasNode, "visual");
    }

    const fogsNode = await LegacyDocumentationDefinition.loadNode("fogs", "/Fog Definitions/Fog Schema/", isPreview);

    if (fogsNode) {
      await this.generateFormNodesFromSchemaDocs(formJsonFolder, fogsNode, "fogs");
    }

    const biomesNode = await LegacyDocumentationDefinition.loadNode("biomes", "/Schema/", isPreview);

    if (biomesNode) {
      await this.generateFormNodesFromSchemaDocs(formJsonFolder, biomesNode, "biomes");
    }

    const featuresNode = await LegacyDocumentationDefinition.loadNode("features", "/Supported features/", isPreview);

    if (featuresNode) {
      await this.generateFormNodesFromSchemaDocs(formJsonFolder, featuresNode, "features");
    }
  }

  public async generateFormNodesFromSchemaDocs(
    formJsonFolder: IFolder,
    node: ILegacyDocumentationNode,
    prefix?: string
  ) {
    if (!node.description && !node.examples) {
      return;
    }
    const formStack: IFormDefinition[] = [];
    let formStackIndex = -1;
    const outerForms: (IFormDefinition | undefined)[] = [];
    const objectSkippedAt: number[] = [];

    let lastField: (IField | undefined)[] = [];
    let ignoreNextObject = 0;
    let integrateNextProperty = false;
    let integrateNextNextProperty = false;

    let nodeSet = node.description;

    if (!nodeSet && node.examples) {
      nodeSet = [];

      for (const examp of node.examples) {
        nodeSet.push(...examp.text);
      }
    }

    for (const docLine of nodeSet as string[]) {
      let docLineMod = docLine;
      let commentStr: string | undefined = undefined;
      integrateNextNextProperty = false;

      let commentIndex = docLine.indexOf(" //");

      if (commentIndex > 0) {
        commentStr = docLine.substring(commentIndex + 3);
        docLineMod = docLine.substring(0, commentIndex);
      }

      const docLineTrim = docLineMod.replace(/ /gi, "").trim();

      const startQuote = docLineMod.indexOf('"');
      let endQuote = docLineMod.lastIndexOf('"');
      const endCompare = docLineMod.lastIndexOf(">");

      let mainStr: string | undefined = undefined;
      let endStr: string | undefined = undefined;

      if (startQuote >= 0 && endQuote > startQuote) {
        if (endCompare === endQuote + 1) {
          endQuote = endCompare;
        }

        mainStr = docLineMod.substring(startQuote + 1, endQuote);
        endStr = docLineMod.substring(endQuote + 1);
      }

      if (docLineTrim.endsWith(":{") && !mainStr) {
        // this is the pattern from schemas.json
        const firstColon = docLineTrim.indexOf(":");

        if (firstColon >= 0) {
          formStackIndex++;

          for (let i = formStackIndex; i < MAX_FORM_DEPTH; i++) {
            lastField[i] = undefined;
            objectSkippedAt[i] = 0;
          }

          const form: IFormDefinition = { id: docLineTrim.substring(0, firstColon), fields: [] };

          outerForms.push(form);
          formStack[formStackIndex] = form;

          const secondColon = docLineTrim.indexOf(":", firstColon + 1);
          if (secondColon > firstColon) {
            const verStr = docLineTrim.substring(firstColon + 1, secondColon);

            if (Utilities.isVersionString(verStr)) {
              form.dataVersion = Utilities.normalizeVersionString(verStr);
            }
          }
        }
      } else if (docLineTrim === "{" && formStackIndex < 0) {
        // this is the pattern from fogs.json, features.json (only one form/object, typically) - handle the outer level form
        formStackIndex++;

        for (let i = formStackIndex; i < MAX_FORM_DEPTH; i++) {
          lastField[i] = undefined;
          objectSkippedAt[i] = 0;
        }

        const form: IFormDefinition = {
          id: (prefix ? prefix : "obj") + (outerForms.length > 0 ? outerForms.length + 1 : ""),
          fields: [],
        };

        outerForms.push(form);
        formStack[formStackIndex] = form;
      } else if (docLineTrim === "{") {
        if (ignoreNextObject > 0) {
          ignoreNextObject--;
          objectSkippedAt[formStackIndex]++;
        } else {
          const lastFieldStack = lastField[formStackIndex];
          formStackIndex++;

          for (let i = formStackIndex; i < MAX_FORM_DEPTH; i++) {
            lastField[i] = undefined;
            objectSkippedAt[i] = 0;
          }

          if (lastFieldStack && !lastFieldStack.subForm) {
            const form: IFormDefinition = { id: undefined, fields: [] };
            formStack[formStackIndex] = form;
            lastFieldStack.subForm = form;
          }
        }
      } else if (docLineTrim === "}" && formStackIndex >= 0) {
        if (objectSkippedAt[formStackIndex] > 0) {
          objectSkippedAt[formStackIndex]--;
        } else {
          formStackIndex--;
        }
      }

      if (formStackIndex >= 0 && formStack[formStackIndex] && mainStr) {
        let fieldDefinition: IField | undefined = undefined;
        if (docLineTrim.startsWith('int"')) {
          fieldDefinition = {
            dataType: FieldDataType.int,
            id: mainStr,
            title: Utilities.humanifyMinecraftName(mainStr),
          };
        } else if (docLineTrim.startsWith('bool"')) {
          fieldDefinition = {
            dataType: FieldDataType.boolean,
            id: mainStr,
            title: Utilities.humanifyMinecraftName(mainStr),
          };
        } else if (docLineTrim.startsWith('string"')) {
          fieldDefinition = {
            dataType: FieldDataType.string,
            id: mainStr,
            title: Utilities.humanifyMinecraftName(mainStr),
          };
        } else if (docLineTrim.startsWith('molang"')) {
          fieldDefinition = {
            dataType: FieldDataType.molang,
            id: mainStr,
            title: Utilities.humanifyMinecraftName(mainStr),
          };
        } else if (docLineTrim.startsWith('array"')) {
          fieldDefinition = {
            dataType: FieldDataType.stringArray,
            id: mainStr,
            title: Utilities.humanifyMinecraftName(mainStr),
          };

          const firstArrow = mainStr.indexOf("<");
          const secondArrow = mainStr.indexOf(">");

          const lastFieldStack = lastField[formStackIndex - 1];

          if (firstArrow >= 0 && secondArrow > firstArrow) {
            if (
              lastFieldStack &&
              (lastFieldStack.dataType === FieldDataType.object ||
                lastFieldStack.dataType === FieldDataType.objectArray)
            ) {
              lastFieldStack.dataType = FieldDataType.keyedObjectCollection;
              lastFieldStack.keyDescription = mainStr;
            }
          }

          integrateNextNextProperty = true;
          ignoreNextObject++;
        } else if (docLineTrim.startsWith('enumerated_value"')) {
          const firstArrow = mainStr.indexOf("<");
          const secondArrow = mainStr.indexOf(">");

          if (firstArrow >= 0 && secondArrow > firstArrow) {
            const fieldId = mainStr.substring(0, firstArrow);
            const choiceStr = mainStr.substring(firstArrow + 1, secondArrow);

            const choices = choiceStr.split(",");

            const choiceSet: ISimpleReference[] = [];

            for (const choice of choices) {
              if (choice.length > 0) {
                choiceSet.push({ id: Utilities.removeQuotes(choice) });
              }
            }

            fieldDefinition = {
              dataType: FieldDataType.string,
              id: fieldId,
              choices: choiceSet,
              title: Utilities.humanifyMinecraftName(mainStr),
            };
          } else {
            fieldDefinition = {
              dataType: FieldDataType.string,
              id: mainStr,
              title: Utilities.humanifyMinecraftName(mainStr),
            };
          }
        } else if (docLineTrim.startsWith('object"')) {
          let fieldDataType = FieldDataType.object;

          const firstArrow = mainStr.indexOf("<");
          const secondArrow = mainStr.indexOf(">");

          const lastFieldStack = lastField[formStackIndex - 1];
          const curFieldStack = lastField[formStackIndex];

          if (firstArrow >= 0 && secondArrow > firstArrow) {
            const subStr = mainStr.substring(firstArrow, secondArrow - firstArrow);

            if (subStr.indexOf("array") >= 0 && curFieldStack) {
              if (!curFieldStack.alternates) {
                curFieldStack.alternates = [];
              }
              const newField: IField = {
                id: curFieldStack.id,
                dataType: FieldDataType.objectArray,
              };

              curFieldStack.alternates.push(newField);
              lastField[formStackIndex] = newField;
            } else {
              if (
                lastFieldStack &&
                (lastFieldStack.dataType === FieldDataType.object ||
                  lastFieldStack.dataType === FieldDataType.objectArray)
              ) {
                lastFieldStack.dataType = FieldDataType.keyedObjectCollection;
                lastFieldStack.keyDescription = mainStr;
              }
              ignoreNextObject++;
            }
          } else {
            fieldDefinition = {
              dataType: fieldDataType,
              id: mainStr,
              title: Utilities.humanifyMinecraftName(mainStr),
            };
          }
        } else if (docLineTrim.startsWith('version"')) {
          fieldDefinition = {
            dataType: FieldDataType.version,
            id: mainStr,
            title: Utilities.humanifyMinecraftName(mainStr),
          };
        }

        if (fieldDefinition) {
          if (integrateNextProperty && fieldDefinition.id.indexOf("<") >= 0) {
            if (fieldDefinition.dataType === FieldDataType.molang) {
              const lastFieldStack = lastField[formStackIndex];

              if (lastFieldStack) {
                lastFieldStack.dataType = FieldDataType.molangArray;
              }
            }
            integrateNextProperty = false;
          } else {
            integrateNextProperty = false;
            if (commentStr) {
              fieldDefinition.description = commentStr.trim();
            }

            if (docLineTrim.indexOf(":opt") >= 0) {
              fieldDefinition.isRequired = false;
            } else {
              fieldDefinition.isRequired = true;
            }

            lastField[formStackIndex] = fieldDefinition;
            formStack[formStackIndex].fields.push(fieldDefinition);
          }
        }

        if (integrateNextNextProperty) {
          integrateNextProperty = true;
        }
      }
    }

    for (const form of outerForms) {
      if (form && form.id) {
        const name = this.getFormFileName(form.id, form.dataVersion);

        DataFormUtilities.mergeFields(form);

        DataFormUtilities.fixupFields(form);

        await this.annotateFormJson(form, name, prefix);
        await this.mergeToFile(formJsonFolder, name, form, prefix);
      }
    }
  }

  public async generateFormJson(inputFolder: IFolder, outputFolder: IFolder) {
    await outputFolder.deleteAllFolderContents();

    await this.generateFormJsonFromFolder(inputFolder, outputFolder);
  }

  public async generateFormJsonFromFolder(inputFolder: IFolder, outputFolder: IFolder) {
    await outputFolder.ensureExists();
    await inputFolder.load();

    const fileList: IIndexJson = { files: [], folders: [] };

    for (const folderName in inputFolder.folders) {
      const folder = inputFolder.folders[folderName];

      if (folder) {
        await this.generateFormJsonFromFolder(folder, outputFolder.ensureFolder(folderName));

        fileList.folders.push(folderName);
      }
    }

    for (const fileName in inputFolder.files) {
      const file = inputFolder.files[fileName];

      try {
        if (file) {
          await file.loadContent();

          const jsonO = StorageUtilities.getJsonObject(file);

          if (jsonO) {
            const outputFile = outputFolder.ensureFile(fileName);

            fileList.files.push(fileName);

            await this.finalizeJsonForm(jsonO, outputFile);
          }
        }
      } catch (e) {
        console.log("Error processing " + fileName + ": " + e);
      }
    }

    const indexFile = outputFolder.ensureFile("index.json");
    indexFile.setContent(JSON.stringify(fileList));
    await indexFile.saveContent();
  }

  public async finalizeJsonForm(formObj: IFormDefinition, outputFile: IFile) {
    if (!formObj.source && formObj.id) {
      const id = formObj.id.replace(/\:/gi, "_").replace(/\./gi, "_");

      await outputFile.loadContent();
      const originalNode = StorageUtilities.getJsonObject(outputFile);
      await this.annotateFormJson(formObj, id, outputFile.parentFolder.name, originalNode);
    }

    if (formObj.source) {
      if (!formObj.description || formObj.description === "") {
        formObj.description = formObj.source.description;
      }
      if (!formObj.title || formObj.title === "") {
        formObj.title = formObj.source.title;
      }

      if (formObj.samples) {
        for (const samplePath in formObj.source.samples) {
          formObj.samples[samplePath] = formObj.source.samples[samplePath];
        }
      } else {
        formObj.samples = formObj.source.samples;
      }

      if (!formObj.note) {
        formObj.note = formObj.source.note;
      }

      if (!formObj.note2) {
        formObj.note2 = formObj.source.note2;
      }

      if (!formObj.note3) {
        formObj.note3 = formObj.source.note3;
      }

      if (!formObj.restrictions) {
        formObj.restrictions = formObj.source.restrictions;
      }

      if (!formObj.requires) {
        formObj.requires = formObj.source.requires;
      }

      if (!formObj.scalarField) {
        formObj.scalarField = formObj.source.scalarField;
      }

      if (!formObj.customField) {
        formObj.customField = formObj.source.customField;
      }

      if (!formObj.scalarFieldUpgradeName) {
        formObj.scalarFieldUpgradeName = formObj.source.scalarFieldUpgradeName;
      }

      if (!formObj.isDeprecated) {
        formObj.isDeprecated = formObj.source.isDeprecated;
      }

      if (!formObj.dataVersion) {
        formObj.dataVersion = formObj.source.dataVersion;
      }

      if (formObj.fields && formObj.fields.length === 0) {
        formObj.id = formObj.source.id;

        formObj.fields = formObj.source.fields;
        formObj.source = undefined;
      } else {
        const formFields: { [id: string]: IField } = {};

        if (!formObj.fields) {
          formObj.fields = formObj.source.fields;
        } else {
          for (const targetField of formObj.fields) {
            formFields[targetField.id] = targetField;
          }

          for (const field of formObj.source.fields) {
            const targetField = formFields[field.id];

            if (!targetField) {
              formObj.fields.push(field);
            } else {
              targetField.samples = field.samples;

              if (!targetField.defaultValue) {
                targetField.defaultValue = field.defaultValue;
              }

              if (!targetField.alternates) {
                targetField.alternates = field.alternates;
              }

              if (!targetField.description) {
                targetField.description = field.description;
              }

              if (!targetField.title) {
                targetField.title = field.title;
              }

              if (targetField.dataType === undefined) {
                targetField.dataType = field.dataType;
              }

              if (!targetField.choices) {
                targetField.choices = field.choices;
              }

              if (!targetField.validity) {
                targetField.validity = field.validity;
              }
            }
          }
        }

        formObj.source = undefined;
      }
    }

    outputFile.setContent(JSON.stringify(formObj, undefined, 2));

    await outputFile.saveContent();
  }

  public async exportJsonForms(formJsonFolder: IFolder) {
    for (const typeSummary of TypesToExport) {
      const formNode = await this.getJsonFormFromJsonKey(typeSummary.title);

      if (formNode && formNode.fields.length > 0) {
        const name = this.getFormFileNameFromJsonKey(typeSummary.title);

        await this.annotateFormJson(formNode, name, typeSummary.category);
        await this.mergeToFile(formJsonFolder, name, formNode, typeSummary.category);
      }
    }
  }

  public getFormFileNameFromJsonKey(key: string) {
    key = key.toLowerCase();

    key = key.replace(/ /gi, "_");
    key = key.replace(/::/gi, "_");
    key = key.replace(/:/gi, "_");

    return key;
  }

  private getVersionlessString(key: string) {
    let verStart = key.indexOf(" v1.");

    if (verStart >= 0) {
      const nextSpace = key.indexOf(" ", verStart + 4);

      if (nextSpace >= 0) {
        key = key.substring(0, verStart) + key.substring(nextSpace + 1);
      } else {
        key = key.substring(0, verStart);
      }
    }

    return key;
  }

  public async getJsonFormFromJsonKey(keyName: string) {
    let rootNodeName: string | undefined = undefined;
    let rootNodeNameVersionless: string | undefined = undefined;
    let rootNode: JSONSchema7 | undefined = undefined;

    // attempt to get the latest version of a component by sorting on the node name e.g., minecraft:item v1.21.60 should sort later than minecraft:item v1.21.40
    // though we should replace this with a more sophisticated sorter for version :-/
    for (const key in this.defsByTitle) {
      if (key.indexOf(keyName) >= 0) {
        const keyVersionless = this.getVersionlessString(key);

        if (!rootNodeName || (key.localeCompare(rootNodeName) > 0 && keyVersionless === rootNodeNameVersionless)) {
          rootNodeName = key;
          rootNodeNameVersionless = keyVersionless;
          rootNode = this.defsByTitle[key];
        }
      }
    }

    if (rootNode === undefined) {
      return;
    }

    return await this.getJsonFormFromJsonSchemaDefinition(rootNode, keyName);
  }

  public async getJsonFormFromJsonSchemaDefinition(node: JSONSchema7, nodeName: string) {
    const fields: IField[] = [];

    if (node.properties) {
      for (const propName in node.properties) {
        const propNode = node.properties[propName];

        if (propNode && typeof propNode !== "boolean") {
          const field = await this.getFieldFromJsonPropertyNode(propNode, propName);

          if (field) {
            fields.push(field);
          }
        }
      }
    }

    const docForm: IFormDefinition = {
      title: Utilities.humanifyMinecraftName(nodeName),
      description: node.description ? node.description : Utilities.humanifyMinecraftName(nodeName),
      fields: fields,
    };

    return docForm;
  }

  public async loadSchemas(schemaFolder: IFolder) {
    await schemaFolder.load();

    for (const fileName in schemaFolder.files) {
      const file = schemaFolder.files[fileName];

      if (file && file.type === "json" && file.name !== "index.json") {
        const jsonSchema = await JsonSchemaDefinition.ensureOnFile(file);

        if (jsonSchema && jsonSchema.data) {
          this.processDef(jsonSchema.data);
        }
      }
    }

    for (const folderName in schemaFolder.folders) {
      const folder = schemaFolder.folders[folderName];

      if (folder) {
        await this.loadSchemas(folder);
      }
    }
  }

  private processDef(schemaDef: JSONSchema7) {
    if (schemaDef["$id"]) {
      this.defsById[schemaDef["$id"]] = schemaDef;
    }

    if (schemaDef.title) {
      this.defsByTitle[schemaDef.title] = schemaDef;
    }

    if (schemaDef.definitions) {
      for (const defName in schemaDef.definitions) {
        const def = schemaDef.definitions[defName];

        if (def && typeof def !== "boolean") {
          this.processDef(def);
        }
      }
    }
  }

  public async generateFormNodesFromNode(formJsonFolder: IFolder, node: ILegacyDocumentationNode, prefix?: string) {
    for (const childNode of node.nodes) {
      if (childNode.name) {
        const name = this.getFormFileName(childNode.name);

        const formDocNode = this.getFormFromDocNode(childNode, childNode.name);

        const sourceFormDocNode = await this.getOriginalFormDefinition(formJsonFolder, name, prefix);
        await this.annotateFormJson(formDocNode, name, prefix, sourceFormDocNode);
        await this.mergeToFile(formJsonFolder, name, formDocNode, prefix);
      }
    }
  }

  public async getOriginalFormDefinition(formJsonFolder: IFolder, name: string, categoryName?: string) {
    if (categoryName && categoryName.length > 0) {
      formJsonFolder = formJsonFolder.ensureFolder(categoryName);
    }

    name = name.toLowerCase();
    name = name.replace(/ /gi, "_");

    const file = formJsonFolder.ensureFile(name + ".form.json");

    await file.loadContent();

    return StorageUtilities.getJsonObject(file) as IFormDefinition | undefined;
  }

  public async mergeToFile(formJsonFolder: IFolder, name: string, formDefNode: IFormDefinition, categoryName?: string) {
    if (categoryName && categoryName.length > 0) {
      formJsonFolder = formJsonFolder.ensureFolder(categoryName);
    }

    name = name.toLowerCase();
    name = name.replace(/ /gi, "_");

    const file = formJsonFolder.ensureFile(name + ".form.json");

    await file.loadContent();

    let jsonO = StorageUtilities.getJsonObject(file);

    if (jsonO) {
      (jsonO as IFormDefinition).source = formDefNode;
    } else {
      jsonO = {
        id: formDefNode.id,
        fields: [],
        source: formDefNode,
      };
    }

    file.setContent(JSON.stringify(jsonO, undefined, 2));

    await file.saveContent();
  }

  public async annotateFormJson(
    formDefNode: IFormDefinition,
    name: string,
    prefix?: string,
    originalNode?: IFormDefinition
  ) {
    let canonName = EntityTypeDefinition.getComponentFromBaseFileName(name);
    let isMinecraftComponent = false;

    if (name.startsWith("minecraft_")) {
      isMinecraftComponent = true;

      if (canonName.startsWith("behavior.")) {
        let hasPrioNode = false;

        for (const field of formDefNode.fields) {
          if (field.id === "priority") {
            hasPrioNode = true;
          }
        }

        if (!hasPrioNode) {
          formDefNode.fields.push({
            id: "priority",
            title: "Priority",
            hideSamples: true,
            description:
              "As priority approaches 0, the priority is increased. The higher the priority, the sooner this behavior will be executed as a goal.",
            dataType: 0,
          });
        }
      }
    }

    if (prefix === "entity" && isMinecraftComponent) {
      await this.addVanillaMatches(formDefNode, canonName, [
        AnnotationCategories.entityComponentDependent,
        AnnotationCategories.entityComponentDependentInGroup,
      ]);
      await this.addSamplesMatches(formDefNode, canonName, [
        AnnotationCategories.entityComponentDependent,
        AnnotationCategories.entityComponentDependentInGroup,
      ]);
    } else if (prefix === "item" && isMinecraftComponent) {
      await this.addVanillaMatches(formDefNode, canonName, [AnnotationCategories.itemComponentDependent]);
      await this.addSamplesMatches(formDefNode, canonName, [AnnotationCategories.itemComponentDependent]);
    } else if (prefix === "block" && isMinecraftComponent) {
      await this.addVanillaMatches(formDefNode, canonName, [AnnotationCategories.blockComponentDependent]);
      await this.addSamplesMatches(formDefNode, canonName, [AnnotationCategories.blockComponentDependent]);
    } else if (prefix === "entityfilters") {
      await this.addVanillaMatches(formDefNode, canonName, [AnnotationCategories.entityFilter]);
      await this.addSamplesMatches(formDefNode, canonName, [AnnotationCategories.entityFilter]);
    }

    if (formDefNode.samples) {
      this.distributeSampleValues(formDefNode.samples, formDefNode, [], originalNode);
    }
  }

  public async distributeSampleValues(
    samplesNode: { [name: string]: IFormSample[] },
    formDefNode: IFormDefinition,
    pathTokens: string[],
    originalNode?: IFormDefinition
  ) {
    if (!formDefNode.fields) {
      return;
    }

    const fieldsById: { [id: string]: IField } = {};

    for (const field of formDefNode.fields) {
      fieldsById[field.id] = field;
    }

    const originalFieldsById: { [id: string]: IField } = {};

    if (originalNode && originalNode.fields) {
      for (const field of originalNode.fields) {
        originalFieldsById[field.id] = field;
      }
    }

    for (const exampleFilePath in samplesNode) {
      const sampleList = samplesNode[exampleFilePath];

      if (sampleList) {
        for (const sample of sampleList) {
          if (sample.content && typeof sample.content === "object") {
            let obj: any | undefined = sample.content;

            if (obj) {
              for (const fieldName in obj) {
                const fieldVal = obj[fieldName];
                let subForm: IFormDefinition | undefined = undefined;

                if (
                  !fieldsById[fieldName] &&
                  (!originalNode || !originalNode.customField || originalFieldsById[fieldName])
                ) {
                  let dataType: FieldDataType = FieldDataType.string;

                  if (fieldName.startsWith("on_")) {
                    dataType = FieldDataType.minecraftEventTrigger;
                  } else {
                    if (typeof fieldVal === "number") {
                      dataType = FieldDataType.number;
                    } else if (Array.isArray(fieldVal)) {
                      if (fieldVal.length > 0) {
                        if (typeof fieldVal[0] === "object") {
                          dataType = FieldDataType.objectArray;

                          subForm = DataFormUtilities.generateFormFromObject(fieldName, fieldVal[0], exampleFilePath);
                        } else if (typeof fieldVal[0] === "string") {
                          dataType = FieldDataType.stringArray;
                        }
                      }
                    } else if (typeof fieldVal === "object") {
                      dataType = FieldDataType.object;

                      subForm = DataFormUtilities.generateFormFromObject(fieldName, fieldVal, exampleFilePath);
                    }
                  }

                  const newField = {
                    id: fieldName,
                    title: Utilities.humanifyMinecraftName(fieldName),
                    dataType: dataType,
                    subForm: subForm,
                  };

                  fieldsById[fieldName] = newField;

                  formDefNode.fields.push(newField);
                }
              }
            }
          }
        }
      }
    }

    for (const field of formDefNode.fields) {
      const pathTokensToSearch = pathTokens.slice();

      pathTokensToSearch.push(field.id);

      for (const exampleFilePath in samplesNode) {
        const sampleList = samplesNode[exampleFilePath];

        if (sampleList) {
          for (const sample of sampleList) {
            if (sample.content && typeof sample.content === "object") {
              let obj: any | undefined = sample.content;

              for (let i = 0; i < pathTokensToSearch.length; i++) {
                if (obj && (obj as any)[pathTokensToSearch[i]] !== undefined) {
                  obj = (obj as any)[pathTokensToSearch[i]];
                } else {
                  obj = undefined;
                }
              }

              if (obj) {
                let exampleInstanceCount = 0;

                if (!field.samples) {
                  field.samples = {};
                }

                if (field.subForm) {
                  let exampleObj = obj;

                  if (Array.isArray(exampleObj) && exampleObj.length > 0) {
                    const subSamples: { [path: string]: IFormSample[] } = {};
                    let subSamplesAdded = 0;
                    const path = exampleFilePath;

                    for (const subObj of exampleObj) {
                      if (typeof subObj === "object") {
                        if (!subSamples[path]) {
                          subSamples[path] = [];
                        }

                        subSamples[path].push({
                          path: sample.path + "|" + pathTokensToSearch.join(".") + "|" + subSamplesAdded.toString(),
                          content: subObj,
                        });
                        subSamplesAdded++;
                      }
                    }

                    if (subSamplesAdded > 0) {
                      await this.distributeSampleValues(subSamples, field.subForm, pathTokensToSearch);
                    }
                  }
                }

                const exampleSamp = JSON.stringify(obj);

                const path = exampleFilePath;

                for (const path in field.samples) {
                  for (let i = 0; i < field.samples[path].length; i++) {
                    if (JSON.stringify(field.samples[path][i].content) === exampleSamp) {
                      exampleInstanceCount++;
                    }
                  }
                }

                if (exampleInstanceCount < 2) {
                  if (!field.samples[path]) {
                    field.samples[path] = [];
                  }

                  field.samples[path].push({ path: sample.path, content: obj });
                }
              }
            }
          }
        }
      }
    }
  }

  public async addVanillaMatches(formDefNode: IFormDefinition, name: string, annotations: AnnotationCategories[]) {
    const vanillaMatches = await Database.getPreviewVanillaMatches(name, annotations);

    if (vanillaMatches && vanillaMatches.length > 0) {
      if (!formDefNode.samples) {
        formDefNode.samples = {};
      }

      const vanillaPreview = await Database.getPreviewVanillaFolder();

      if (!vanillaPreview) {
        return;
      }

      for (const match of vanillaMatches) {
        if (match.value.startsWith("/") && match.value.indexOf("metadata") < 0) {
          const file = await vanillaPreview.getFileFromRelativePath(match.value);

          if (file && (await file.exists())) {
            await file.loadContent();
            const jsonO = StorageUtilities.getJsonObject(file);

            if (jsonO) {
              if (!formDefNode.samples["/vanilla" + match.value]) {
                formDefNode.samples["/vanilla" + match.value] = [];
              }
              this.appendNodesByName(formDefNode.samples["/vanilla" + match.value], "minecraft:" + name, jsonO, "/");
            }
          }
        }
      }
    }
  }

  public async addSamplesMatches(formDefNode: IFormDefinition, name: string, annotations: AnnotationCategories[]) {
    const samplesMatches = await Database.getSamplesMatches(name, annotations);

    if (samplesMatches && samplesMatches.length > 0) {
      if (!formDefNode.samples) {
        formDefNode.samples = {};
      }

      const samples = await Database.getSamplesFolder();

      if (!samples) {
        return;
      }

      for (const match of samplesMatches) {
        if (match.value.startsWith("/")) {
          const file = await samples.getFileFromRelativePath(match.value);

          if (file && (await file.exists())) {
            await file.loadContent();
            const jsonO = StorageUtilities.getJsonObject(file);

            if (jsonO) {
              if (!formDefNode.samples["/samples" + match.value]) {
                formDefNode.samples["/samples" + match.value] = [];
              }
              this.appendNodesByName(formDefNode.samples["/samples" + match.value], "minecraft:" + name, jsonO, "/");
            }
          }
        }
      }
    }
  }
  public appendNodesByName(exampleList: IFormSample[], nodeName: string, source: object, path: string) {
    for (const attributeName in source) {
      const childItem = (source as any)[attributeName];

      if (attributeName === nodeName && childItem !== undefined) {
        exampleList.push({ path: path + nodeName + "/", content: childItem });
      } else if (attributeName === "test" && "minecraft:" + childItem === nodeName) {
        exampleList.push({ path: path, content: JSON.stringify(source) });
      } else if (typeof childItem === "object") {
        this.appendNodesByName(exampleList, nodeName, childItem, path + attributeName + "/");
      }
    }
  }

  public getFormFromDocNode(childNode: ILegacyDocumentationNode, name?: string) {
    /*"title": "Break doors annotation",
    "description": "Allows an entity to break doors, assuming that that flags set up for the component to use in navigation. Requires the entity's navigation component to have the parameter can_break_doors set to true.",
    "fields": [
      {
        "id": "break_time",
        "description": "The time in seconds required to break through doors.",
        "dataType": 0
      },
      {
        "id": "min_difficulty",
        "title": "Minimum Difficulty",
        "description": "The minimum difficulty that the world must be on for this entity to break doors.",
        "dataType": 8,
        "lookupId": "difficulty"
      }
    ]*/

    const fields: IField[] = [];

    if (childNode.nodes) {
      for (const fieldNode of childNode.nodes) {
        const field = this.getFieldFromDocNode(fieldNode);

        if (field) {
          fields.push(field);
        }
      }
    }

    const docForm: IFormDefinition = {
      title: name ? Utilities.humanifyMinecraftName(name) : undefined,
      description: childNode.description ? childNode.description.join("\r\n") : undefined,
      fields: fields,
    };

    if (childNode.examples) {
      const examples: IFormSample[] = [];

      for (const example of childNode.examples) {
        if (example.name && example.text) {
          examples.push({
            path: example.name,
            content: example.text.join("\r\n"),
          });
        }
      }
      if (examples.length > 0) {
        if (!docForm.samples) {
          docForm.samples = {};
        }

        docForm.samples["samples"] = examples;
      }
    }

    if (
      childNode.type &&
      childNode.type !== "JSON Object" &&
      childNode.type !== "List" &&
      childNode.type !== "Array" &&
      childNode.type !== "Trigger"
    ) {
      if (childNode.type.indexOf("Boolean") >= 0) {
        docForm.scalarField = {
          id: "boolean",
          title: "Boolean",
          dataType: FieldDataType.boolean,
        };
      } else if (childNode.type.indexOf("String") >= 0) {
        if (
          !docForm.title ||
          (docForm.title.indexOf("eplaceable") < 0 &&
            docForm.title.indexOf("edstone Cond") < 0 &&
            docForm.title.indexOf("iquid Detection") < 0 &&
            docForm.title.indexOf("tem Visual") < 0)
        )
          docForm.scalarField = {
            id: "string",
            title: "String",
            dataType: FieldDataType.string,
          };
      } else if (childNode.type.indexOf("Number") >= 0 || childNode.type.indexOf("Decimal") >= 0) {
        docForm.scalarField = {
          id: "number",
          title: "Number",
          dataType: FieldDataType.number,
        };
      } else if (childNode.type.indexOf("Integer") >= 0) {
        docForm.scalarField = {
          id: "integer",
          title: "Integer",
          dataType: FieldDataType.int,
        };
      }
    }

    return docForm;
  }

  public getFieldFromDocNode(childNode: ILegacyDocumentationNode) {
    let type = FieldDataType.string;

    let typeStr = childNode.type;

    if (typeStr === undefined) {
      typeStr = childNode.name; // this fixup is likely because of mistakes in the source
    }

    switch (typeStr) {
      case "Range [a, b]":
        type = FieldDataType.intRange;
        break;
      case "Trigger":
        type = FieldDataType.minecraftEventTrigger;
        break;
      case "Positive Integer":
      case "Integer":
        type = FieldDataType.int;
        break;
      case "Decimal":
        type = FieldDataType.float;
        break;
      case "Minecraft Filter":
        type = FieldDataType.minecraftFilter;
        break;
      case "Boolean":
        type = FieldDataType.boolean;
        break;
      case "Vector [a, b, c]":
        type = FieldDataType.point3;
        break;
      case "Vector [a, b]":
        type = FieldDataType.point2;
        break;
      case "Molang":
        type = FieldDataType.string;
        break;
      case "Array":
      case "List":
      case "Item Description Properties":
        type = FieldDataType.stringArray;
        break;
      case "JSON Object":
        type = FieldDataType.objectArray;
        break;
      case "Localization String":
        type = FieldDataType.localizableString;
        break;
      case "String":
        type = FieldDataType.string;
        break;
      default:
        type = FieldDataType.string;
        break;
    }

    if (childNode.nodes && childNode.nodes.length > 0 && type === FieldDataType.string) {
      for (const subChildNode of childNode.nodes) {
        if (subChildNode.type === "Array" || (subChildNode.nodes && subChildNode.nodes.length > 0)) {
          type = FieldDataType.object;
        }
      }
    }

    if (
      (childNode.name === "grow_up" ||
        childNode.name === "event" ||
        childNode.name.endsWith("_event") ||
        childNode.name.startsWith("on_")) &&
      !childNode.name.endsWith("_sound_event") &&
      (type === FieldDataType.string || type === FieldDataType.object || type === FieldDataType.objectArray)
    ) {
      type = FieldDataType.minecraftEventTrigger;
    }

    let defaultVal: string | undefined | number | boolean | number[] = undefined;

    if (childNode.default) {
      defaultVal = childNode.default;

      if (
        typeof childNode.default === "string" &&
        childNode.default.startsWith("[") &&
        childNode.default.endsWith("]") &&
        type === FieldDataType.point3
      ) {
        let coordStr = childNode.default.substring(1, childNode.default.length - 1);
        let coordElements = coordStr.split(",");

        let coordArray = [];

        for (let str of coordElements) {
          if (str.length > 0) {
            try {
              const numVal = parseFloat(str);
              coordArray.push(numVal);
            } catch (e) {}
          }
        }
        defaultVal = coordArray;
      } else if (type === FieldDataType.int || type === FieldDataType.intRange) {
        try {
          defaultVal = parseInt(defaultVal);
        } catch (e) {}
      } else if (type === FieldDataType.boolean) {
        try {
          defaultVal = defaultVal === "true" ? true : false;
        } catch (e) {}
      } else if (type === FieldDataType.float) {
        try {
          defaultVal = parseFloat(defaultVal);
        } catch (e) {}
      }

      if (typeof defaultVal === "number" && isNaN(defaultVal)) {
        defaultVal = undefined;
      }
    }

    if (defaultVal === "N/A") {
      defaultVal = undefined;
    }

    const fieldNode: IField = {
      id: childNode.name,
      title: Utilities.humanifyMinecraftName(childNode.name),
      description: childNode.description ? childNode.description.join("\r\n") : undefined,
      defaultValue: defaultVal,
      dataType: type,
    };

    if (childNode.type === "Positive Integer") {
      fieldNode.validity = [];

      fieldNode.validity.push({
        comparison: ComparisonType.greaterThanOrEqualTo,
        value: 0,
      });
    }

    if (childNode.nodes && childNode.nodes.length >= 0) {
      if (type === FieldDataType.string) {
        fieldNode.choices = [];

        for (const choiceNode of childNode.nodes) {
          if (choiceNode.name) {
            let desc = undefined;

            if (typeof choiceNode.description === "string") {
              desc = choiceNode.description;
            } else if (Array.isArray(choiceNode.description)) {
              desc = choiceNode.description.join("\r\n");
            }

            fieldNode.choices.push({
              id: choiceNode.name,
              title: Utilities.humanifyMinecraftName(choiceNode.name),
              description: desc,
            });
          }
        }
      } else {
        const form = this.getFormFromDocNode(childNode);

        if (
          form &&
          (type === FieldDataType.object ||
            type === FieldDataType.objectArray ||
            type === FieldDataType.minecraftFilter)
        ) {
          fieldNode.subForm = form;
        } else if (form && type === FieldDataType.stringArray) {
          fieldNode.dataType = FieldDataType.objectArray;

          fieldNode.subForm = form;
        }
      }
    }

    if (childNode.examples) {
      const examples: IFormSample[] = [];

      for (const example of childNode.examples) {
        if (example.name && example.text) {
          examples.push({
            path: example.name,
            content: example.text.join("\r\n"),
          });
        }
      }
      if (examples.length > 0) {
        if (!fieldNode.samples) {
          fieldNode.samples = {};
        }

        fieldNode.samples["samples"] = examples;
      }
    }

    return fieldNode;
  }

  public getDefinitionFromString(definitionString: string) {
    if (definitionString.startsWith("#/definitions/")) {
      definitionString = definitionString.substring(14);
    }

    try {
      let defId = parseInt(definitionString);

      if (defId !== undefined && !isNaN(defId)) {
        return this.defsById[defId + ""];
      }
    } catch (e) {}

    return undefined;
  }

  public async getFieldFromJsonPropertyNode(childNode: JSONSchema7, propName: string) {
    let id = childNode.$id ? childNode.$id : propName;
    let title = childNode.title ? this.humanifyJsonMinecraftName(childNode.title) : id;

    if (childNode.title === "sequence container" || childNode.title === "associative container") {
      title = this.humanifyJsonMinecraftName(id);
    }

    const fieldNode: IField = {
      id: id,
      title: title,
      description: childNode.description ? childNode.description : title,
      dataType: FieldDataType.object,
    };

    if (childNode.title === "associative container") {
      if (
        childNode.additionalProperties &&
        typeof childNode.additionalProperties !== "boolean" &&
        childNode.additionalProperties.type === "string"
      ) {
        fieldNode.dataType = FieldDataType.keyedStringCollection;
      }
      if (
        childNode.additionalProperties &&
        typeof childNode.additionalProperties !== "boolean" &&
        childNode.additionalProperties.type === "integer"
      ) {
        /*                    "blocks": {
          "minecraft:cauldron": 60,
          "minecraft:water": 60,
          "minecraft:lava": 60
      }*/
        fieldNode.dataType = FieldDataType.keyedNumberCollection;
      } else if (
        childNode.additionalProperties &&
        typeof childNode.additionalProperties !== "boolean" &&
        childNode.additionalProperties.$ref
      ) {
        const subDefNode = this.getDefinitionFromString(childNode.additionalProperties.$ref);

        if (subDefNode) {
          if (subDefNode.title === "compound_proxy") {
            // this is technically an associative array of strings to strings, bools, or ints
            // "states": { "foo": "bar", "baz": 3, "bal": true }
            fieldNode.dataType = FieldDataType.keyedStringCollection;
          } else {
            const subForm = await this.getJsonFormFromJsonSchemaDefinition(subDefNode, propName);

            fieldNode.subForm = subForm;
          }
        }
      } else if (
        childNode.additionalProperties &&
        typeof childNode.additionalProperties !== "boolean" &&
        childNode.additionalProperties.oneOf
      ) {
        // this is probobably  an associative array of strings to strings, bools, or ints
        // "states": { "foo": "bar", "baz": 3, "bal": true }
        /// todo: loop through oneOf to validate this
        fieldNode.dataType = FieldDataType.keyedStringCollection;
      }
    } else if (childNode.title === "sequence container") {
      if (childNode.items && (childNode.items as any).$ref) {
        const subDefNode = this.getDefinitionFromString((childNode.items as any).$ref);

        if (subDefNode) {
          const subForm = await this.getJsonFormFromJsonSchemaDefinition(subDefNode, propName);

          fieldNode.subForm = subForm;
          fieldNode.dataType = FieldDataType.objectArray;
        }
      } else if (childNode.items && (childNode.items as any).type === "string") {
        fieldNode.dataType = FieldDataType.stringArray;
      }
    } else if (childNode.$ref && !childNode.type) {
      const subDefNode = this.getDefinitionFromString((childNode as any).$ref);

      if (subDefNode) {
        const subForm = await this.getJsonFormFromJsonSchemaDefinition(subDefNode, propName);

        fieldNode.subForm = subForm;
        fieldNode.dataType = FieldDataType.object;
      }
    } else {
      switch (childNode.type) {
        case "integer":
          fieldNode.dataType = FieldDataType.int;
          break;
        case "number":
          fieldNode.dataType = FieldDataType.float;
          break;
        case "boolean":
          fieldNode.dataType = FieldDataType.boolean;
          break;
        case "string":
          fieldNode.dataType = FieldDataType.string;
          break;
        case "object":
          fieldNode.dataType = FieldDataType.object;
          break;
        case "array":
          fieldNode.dataType = FieldDataType.objectArray;
          break;
      }
    }

    return fieldNode;
  }

  public humanifyJsonMinecraftName(title: string) {
    while (title.length > 1 && title.startsWith(":")) {
      title = title.substring(1);
    }

    title = title.replace(/::/gi, "_");
    title = title.replace(/:/gi, "_");

    return title;
  }

  public getFormFileName(name: string, dataVersion?: string) {
    name = name.replace(/:/gi, "_").replace(/\./gi, "_");

    // fix up bone visibility
    if (name === "bone_visibility") {
      name = "minecraft_bone_visibility";
    }

    if (dataVersion) {
      name += ".v" + dataVersion;
    }

    return name;
  }
}
