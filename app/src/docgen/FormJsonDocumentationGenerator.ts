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
import { AnnotationCategory } from "../core/ContentIndex";
import DataFormUtilities from "../dataform/DataFormUtilities";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import ISimpleReference from "../core/ISimpleReference";
import { ComparisonType } from "../dataform/ICondition";
import FieldUtilities from "../dataform/FieldUtilities";

export interface JsonTypeSummary {
  title: string;
  category: string;
}

const JsonFormExclusionList = ["is_a", "in_the", "_with_"];

const MAX_FORM_DEPTH = 100;

export default class FormJsonDocumentationGenerator {
  defsById: { [name: string]: JSONSchema7 } = {};
  defsByTitle: { [name: string]: JSONSchema7 } = {};
  defRefs: { [name: string]: number } = {};
  defCategories: { [name: string]: string } = {};

  public async updateFormSource(folder: IFolder, isPreview?: boolean) {
    this.defsById = {};
    this.defsByTitle = {};

    const metadataFolder = isPreview
      ? await Database.loadPreviewMetadataFolder()
      : await Database.loadReleaseMetadataFolder();

    const schemaFolder = metadataFolder?.ensureFolder("json_schemas");

    if (schemaFolder) {
      await this.loadSchemas(schemaFolder, "misc");
    }

    const formJsonFolder = folder.ensureFolder("forms");
    await formJsonFolder.ensureExists();

    await this.exportJsonSchemaForms(formJsonFolder);

    const aiGoalsNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/AI Goals/",
      isPreview
    );

    if (aiGoalsNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, aiGoalsNode, "entity");
    }

    const attributesNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Attributes/",
      isPreview
    );

    if (attributesNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, attributesNode, "entity");
    }

    const propertiesNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Properties/",
      isPreview
    );

    if (propertiesNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, propertiesNode, "entity");
    }

    const entityComponentsNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Components/",
      isPreview
    );

    if (entityComponentsNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, entityComponentsNode, "entity");
    }

    const triggersComponentsNode = await LegacyDocumentationDefinition.loadNode(
      "entities",
      "/Server Entity Documentation/Triggers/",
      isPreview
    );

    if (triggersComponentsNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, triggersComponentsNode, "entity");
    }

    const filtersComponentsNode = await LegacyDocumentationDefinition.loadNode("entities", "/Filters/", isPreview);

    if (filtersComponentsNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, filtersComponentsNode, "entityfilters");
    }

    const entityEventsComponentsNode = await LegacyDocumentationDefinition.loadNode("entity-events", "/", isPreview);

    if (entityEventsComponentsNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, entityEventsComponentsNode, "entityevents");
    }

    const blocksComponentsNode = await LegacyDocumentationDefinition.loadNode(
      "blocks",
      "/Blocks/Block Components/",
      isPreview
    );

    if (blocksComponentsNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, blocksComponentsNode, "block");
    }

    const schemasNode = await LegacyDocumentationDefinition.loadNode("schemas", "/Schemas/", isPreview);

    if (schemasNode) {
      await this.generateFormNodesFromPseudoSchemaDocs(formJsonFolder, schemasNode, "visual");
    }

    const fogsNode = await LegacyDocumentationDefinition.loadNode("fogs", "/Fog Definitions/Fog Schema/", isPreview);

    if (fogsNode) {
      await this.generateFormNodesFromPseudoSchemaDocs(formJsonFolder, fogsNode, "fogs");
    }

    /* These come from JSON schema now.
    const biomesNode = await LegacyDocumentationDefinition.loadNode("biomes", "/Schema/", isPreview);

    if (biomesNode) {
      await this.generateFormNodesFromNode(formJsonFolder, biomesNode, "biomes");
    }
      */

    const featuresNode = await LegacyDocumentationDefinition.loadNode("features", "/Supported features/", isPreview);

    if (featuresNode) {
      const resultForms = await this.generateFormNodesFromPseudoSchemaDocs(formJsonFolder, featuresNode, "features");

      if (resultForms) {
        this.generateSubformsFromFields(formJsonFolder, resultForms, "features");
      }
    }

    const molangQfNode = await LegacyDocumentationDefinition.loadNode(
      "molang",
      "/Query Functions/List of Entity Queries/",
      isPreview
    );

    if (molangQfNode) {
      await this.generateFormNodesFromLegacyDocNode(formJsonFolder, molangQfNode, "molang");
    }
  }

  public async generateSubformsFromFields(
    formJsonFolder: IFolder,
    resultForms: (IFormDefinition | undefined)[],
    prefix?: string
  ) {
    const outerForms: IFormDefinition[] = [];

    for (const form of resultForms) {
      if (form && form.fields) {
        for (const field of form.fields) {
          if (field.subForm) {
            const newForm: IFormDefinition = {
              id: field.id,
              title: field.title,
              fields: field.subForm.fields,
            };

            outerForms.push(newForm);
          }
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

    return outerForms;
  }
  public async generateFormNodesFromPseudoSchemaDocs(
    formJsonFolder: IFolder,
    node: ILegacyDocumentationNode,
    prefix?: string
  ) {
    if (!node.description && !node.examples) {
      return undefined;
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

      if (startQuote >= 0 && endQuote > startQuote) {
        if (endCompare === endQuote + 1) {
          endQuote = endCompare;
        }

        mainStr = docLineMod.substring(startQuote + 1, endQuote);
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

    return outerForms;
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
    if (!formObj.generated_doNotEdit && !formObj.generatedFromSchema_doNotEdit && formObj.id) {
      const id = formObj.id.replace(/:/gi, "_").replace(/\./gi, "_");

      await outputFile.loadContent();
      const originalNode = StorageUtilities.getJsonObject(outputFile);
      await this.annotateFormJson(formObj, id, outputFile.parentFolder.name, originalNode);
    }

    if (formObj.generatedFromSchema_doNotEdit) {
      this.mergeOntoForm(formObj, formObj.generatedFromSchema_doNotEdit);
    }

    if (formObj.generated_doNotEdit) {
      this.mergeOntoForm(formObj, formObj.generated_doNotEdit);
    }

    formObj.generated_doNotEdit = undefined;
    formObj.generatedFromSchema_doNotEdit = undefined;

    outputFile.setContent(JSON.stringify(formObj, undefined, 2));

    await outputFile.saveContent();
  }

  public mergeOntoForm(targetForm: IFormDefinition, formToMergeOn: IFormDefinition) {
    if (!targetForm.description || targetForm.description === "") {
      targetForm.description = formToMergeOn.description;
    }
    if (!targetForm.title || targetForm.title === "") {
      targetForm.title = formToMergeOn.title;
    }

    if (targetForm.samples) {
      for (const samplePath in formToMergeOn.samples) {
        targetForm.samples[samplePath] = formToMergeOn.samples[samplePath];
      }
    } else {
      targetForm.samples = formToMergeOn.samples;
    }

    if (!targetForm.id) {
      targetForm.id = formToMergeOn.id;
    }

    if (!targetForm.note) {
      targetForm.note = formToMergeOn.note;
    }

    if (!targetForm.note2) {
      targetForm.note2 = formToMergeOn.note2;
    }

    if (!targetForm.note3) {
      targetForm.note3 = formToMergeOn.note3;
    }

    if (!targetForm.restrictions) {
      targetForm.restrictions = formToMergeOn.restrictions;
    }

    if (!targetForm.requires) {
      targetForm.requires = formToMergeOn.requires;
    }

    if (!targetForm.scalarField) {
      targetForm.scalarField = formToMergeOn.scalarField;
    }

    if (!targetForm.customField) {
      targetForm.customField = formToMergeOn.customField;
    }

    if (!targetForm.scalarFieldUpgradeName) {
      targetForm.scalarFieldUpgradeName = formToMergeOn.scalarFieldUpgradeName;
    }

    if (!targetForm.isDeprecated) {
      targetForm.isDeprecated = formToMergeOn.isDeprecated;
    }

    if (!targetForm.versionIntroduced) {
      targetForm.versionIntroduced = formToMergeOn.versionIntroduced;
    }

    if (!targetForm.versionDeprecated) {
      targetForm.versionDeprecated = formToMergeOn.versionDeprecated;
    }

    if (!targetForm.tags) {
      targetForm.tags = formToMergeOn.tags;
    }

    if (!targetForm.isInternal) {
      targetForm.isInternal = formToMergeOn.isInternal;
    }

    if (!targetForm.dataVersion) {
      targetForm.dataVersion = formToMergeOn.dataVersion;
    }

    if (targetForm.fields && targetForm.fields.length === 0) {
      targetForm.id = formToMergeOn.id;

      targetForm.fields = formToMergeOn.fields;
    } else {
      const formFields: { [id: string]: IField | undefined } = {};

      if (!targetForm.fields) {
        targetForm.fields = formToMergeOn.fields;
      } else {
        for (const targetField of targetForm.fields) {
          formFields[targetField.id] = targetField;
        }

        for (const mergeOnField of formToMergeOn.fields) {
          const targetField = formFields[mergeOnField.id];

          if (!targetField) {
            targetForm.fields.push(mergeOnField);
          } else {
            if (targetField.isRemoved) {
              formFields[mergeOnField.id] = undefined;

              const newFieldArr: IField[] = [];
              for (const updatedField of targetForm.fields) {
                if (updatedField.id !== mergeOnField.id) {
                  newFieldArr.push(updatedField);
                }
              }

              targetForm.fields = newFieldArr;
            } else {
              targetField.samples = mergeOnField.samples;

              if (!targetField.defaultValue) {
                targetField.defaultValue = mergeOnField.defaultValue;
              }

              if (mergeOnField.subForm) {
                if (!targetField.subForm) {
                  targetField.subForm = {
                    fields: [],
                  };
                }

                this.mergeOntoForm(targetField.subForm, mergeOnField.subForm);
              }

              if (!targetField.alternates) {
                targetField.alternates = mergeOnField.alternates;
              }

              if (!targetField.description) {
                targetField.description = mergeOnField.description;
              }

              if (!targetField.title) {
                targetField.title = mergeOnField.title;
              }

              if (!targetField.versionDeprecated) {
                targetField.versionDeprecated = mergeOnField.versionDeprecated;
              }

              if (!targetField.versionIntroduced) {
                targetField.versionIntroduced = mergeOnField.versionIntroduced;
              }

              if (!targetField.humanifyValues) {
                targetField.humanifyValues = mergeOnField.humanifyValues;
              }

              if (!targetField.tags) {
                targetField.tags = mergeOnField.tags;
              }

              if (!targetField.minLength) {
                targetField.minLength = mergeOnField.minLength;
              }

              if (!targetField.maxLength) {
                targetField.maxLength = mergeOnField.maxLength;
              }

              if (!targetField.minValue) {
                targetField.minValue = mergeOnField.minValue;
              }

              if (!targetField.priority) {
                targetField.priority = mergeOnField.priority;
              }

              if (!targetField.note) {
                targetField.note = mergeOnField.note;
              }

              if (!targetField.note2) {
                targetField.note2 = mergeOnField.note2;
              }

              if (!targetField.note3) {
                targetField.note3 = mergeOnField.note3;
              }

              if (!targetField.fixedLength) {
                targetField.fixedLength = mergeOnField.fixedLength;
              }

              if (!targetField.undefinedIfEmpty) {
                targetField.undefinedIfEmpty = mergeOnField.undefinedIfEmpty;
              }

              if (!targetField.allowedKeys) {
                targetField.allowedKeys = mergeOnField.allowedKeys;
              }

              if (!targetField.objectArrayTitleFieldKey) {
                targetField.objectArrayTitleFieldKey = mergeOnField.objectArrayTitleFieldKey;
              }

              if (!targetField.objectArrayToSubFieldKey) {
                targetField.objectArrayToSubFieldKey = mergeOnField.objectArrayToSubFieldKey;
              }

              if (!targetField.matchObjectArrayLengthToSubFieldLength) {
                targetField.matchObjectArrayLengthToSubFieldLength =
                  mergeOnField.matchObjectArrayLengthToSubFieldLength;
              }

              if (!targetField.matchObjectArrayToSubFieldKey) {
                targetField.matchObjectArrayToSubFieldKey = mergeOnField.matchObjectArrayToSubFieldKey;
              }

              if (!targetField.keyDescription) {
                targetField.keyDescription = mergeOnField.keyDescription;
              }

              if (!targetField.maxValue) {
                targetField.maxValue = mergeOnField.maxValue;
              }

              if (!targetField.suggestedMinValue) {
                targetField.suggestedMinValue = mergeOnField.suggestedMinValue;
              }

              if (!targetField.suggestedMaxValue) {
                targetField.suggestedMaxValue = mergeOnField.suggestedMaxValue;
              }

              if (!targetField.isRequired) {
                targetField.isRequired = mergeOnField.isRequired;
              }

              if (targetField.dataType === undefined) {
                targetField.dataType = mergeOnField.dataType;
              }

              if (mergeOnField.choices) {
                if (!targetField.choices) {
                  targetField.choices = [];
                }

                for (const mergeOnChoice of mergeOnField.choices) {
                  let foundChoice = false;

                  for (const targetChoice of targetField.choices) {
                    if (targetChoice.id === mergeOnChoice.id) {
                      foundChoice = true;

                      if (!targetChoice.title) {
                        targetChoice.title = mergeOnChoice.title;
                      }

                      if (!targetChoice.description) {
                        targetChoice.description = mergeOnChoice.description;
                      }

                      if (!targetChoice.isDeprecated) {
                        targetChoice.isDeprecated = mergeOnChoice.isDeprecated;
                      }

                      if (!targetChoice.iconImage) {
                        targetChoice.iconImage = mergeOnChoice.iconImage;
                      }

                      if (!targetChoice.versionIntroduced) {
                        targetChoice.versionIntroduced = mergeOnChoice.versionIntroduced;
                      }

                      if (!targetChoice.versionDeprecated) {
                        targetChoice.versionDeprecated = mergeOnChoice.versionDeprecated;
                      }

                      break;
                    }
                  }

                  if (!foundChoice) {
                    targetField.choices.push(mergeOnChoice);
                  }
                }

                targetField.choices = mergeOnField.choices;
              }

              if (!targetField.validity) {
                targetField.validity = mergeOnField.validity;
              }
            }
          }
        }
      }
    }
  }

  public async exportJsonSchemaForms(formJsonFolder: IFolder) {
    for (const key in this.defsByTitle) {
      if (
        (!this.defRefs[key] || this.defRefs[key] <= 1) &&
        !this.isDisallowedSchemaFile(key) &&
        key.indexOf(" - ") < 0
      ) {
        await this.processAndExportJsonSchemaNode(formJsonFolder, key);
      }
    }
  }

  isDisallowedSchemaFile(key: string) {
    if (key.indexOf("struct ") >= 0) {
      return true;
    }

    return false;
  }

  private async processAndExportJsonSchemaNode(formJsonFolder: IFolder, title: string) {
    const formNode = await this.getJsonFormFromJsonSchemaKey(title);

    if (formNode && formNode.fields.length > 0) {
      if (title.indexOf("omponents") >= 0) {
        if (formNode.fields) {
          for (const field of formNode.fields) {
            if (field.subForm) {
              const name = this.getFormFileNameBase(field.id);
              const category = this.defCategories[title];

              field.subForm.id = field.id;

              await this.annotateFormJson(field.subForm, name, category);
              await this.mergeToFile(formJsonFolder, name, field.subForm, category, true);
            }
          }
        }
      } else {
        let versionlessTitle = title.substring(title.lastIndexOf(".") + 1);
        versionlessTitle = this.getVersionlessString(versionlessTitle);

        const name = this.getFormFileNameBase(versionlessTitle);

        let matchesExclusion = false;

        for (const exclusion of JsonFormExclusionList) {
          if (name.indexOf(exclusion) >= 0) {
            matchesExclusion = true;
            break;
          }
        }

        if (!matchesExclusion) {
          const category = this.defCategories[title];

          await this.annotateFormJson(formNode, name, category);
          await this.mergeToFile(formJsonFolder, name, formNode, category, true);
        }
      }
    }
  }

  public getFormFileNameBase(key: string) {
    key = key.toLowerCase();

    if (key.startsWith("struct_") || key.startsWith("struct ")) {
      key = key.substring(7);
    }

    if ((key.startsWith("enum_") || key.startsWith("enum ")) && key.indexOf("num_property") < 0) {
      key = key.substring(5);
    }

    key = key.replace("sharedtypes", "");

    key = StorageUtilities.sanitizePathBasic(key);

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

  public async getJsonFormFromJsonSchemaKey(keyName: string) {
    let rootNodeName: string | undefined = undefined;
    let rootNodeNameVersionless: string | undefined = undefined;
    let rootNode: JSONSchema7 | undefined = undefined;

    const keyVersionless = this.getVersionlessString(keyName);

    // attempt to get the latest version of a component by sorting on the node name e.g., minecraft:item v1.21.60 should sort later than minecraft:item v1.21.40
    // though we should replace this with a more sophisticated sorter for version :-/
    for (const candidateKey in this.defsByTitle) {
      const candidateKeyVersionless = this.getVersionlessString(candidateKey);
      if (candidateKeyVersionless === keyVersionless) {
        if (
          !rootNodeName ||
          (candidateKey.localeCompare(rootNodeName) > 0 && candidateKeyVersionless === rootNodeNameVersionless)
        ) {
          rootNodeName = candidateKey;
          rootNodeNameVersionless = candidateKeyVersionless;
          rootNode = this.defsByTitle[candidateKey];
        }
      }
    }

    for (const key in this.defsById) {
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

    if (rootNodeName !== keyName) {
      return;
    }

    return await this.getJsonFormFromJsonSchemaDefinition(rootNode, keyName);
  }

  public async getJsonFormFromJsonSchemaDefinition(node: JSONSchema7, nodeName?: string, fieldList?: string[]) {
    const fields: IField[] = [];

    if (node.properties) {
      for (const propName in node.properties) {
        const propNode = node.properties[propName];

        if (propNode && typeof propNode !== "boolean") {
          const field = await this.getFieldFromJsonPropertyNode(propNode, propName, fieldList);

          if (field) {
            fields.push(field);
          }
        }
      }
    }

    if (!nodeName) {
      if (node.title) {
        nodeName = node.title;
      } else {
        nodeName = "";
      }
    }

    const docForm: IFormDefinition = {
      id: this.humanifyId(nodeName),
      title: Utilities.humanifyMinecraftName(nodeName),
      description: node.description ? node.description : undefined,
      fields: fields,
    };

    return docForm;
  }

  public async loadSchemas(schemaFolder: IFolder, categoryName: string) {
    await schemaFolder.load();

    for (const fileName in schemaFolder.files) {
      const file = schemaFolder.files[fileName];

      if (file && file.type === "json" && file.name !== "index.json") {
        const jsonSchema = await JsonSchemaDefinition.ensureOnFile(file);

        if (jsonSchema && jsonSchema.data) {
          this.processDef(jsonSchema.data, categoryName);
        }
      }
    }

    for (const folderName in schemaFolder.folders) {
      const folder = schemaFolder.folders[folderName];

      if (folder) {
        if (!folder.name.startsWith("v1") && folder.name !== "common" && folder.name !== "components") {
          categoryName = folder.name;
        }

        if (categoryName.startsWith("1.")) {
          categoryName = "misc";
        }

        if (
          (schemaFolder.parentFolder?.name === "client" ||
            schemaFolder.parentFolder?.parentFolder?.name === "client") &&
          categoryName.indexOf("client") < 0
        ) {
          categoryName = "client_" + categoryName;
        }

        await this.loadSchemas(folder, categoryName);
      }
    }
  }

  private processDef(schemaDef: JSONSchema7, category: string, depth: number = 0) {
    if (schemaDef["$id"]) {
      this.defsById[schemaDef["$id"]] = schemaDef;

      if (this.defRefs[schemaDef["$id"]] === undefined) {
        this.defRefs[schemaDef["$id"]] = depth ? 1 : 0;
      }

      if (schemaDef.title && category.indexOf("client") < 0) {
        if (schemaDef.title?.indexOf("lient ") >= 0 && category.indexOf("client") < 0) {
          category = "client_" + category;
        }
      }

      this.defCategories[schemaDef["$id"]] = category;
    }

    if (schemaDef.title) {
      this.defsByTitle[category + "." + schemaDef.title] = schemaDef;

      if (this.defRefs[category + "." + schemaDef.title] === undefined) {
        this.defRefs[category + "." + schemaDef.title] = depth ? 1 : 0;
      }

      this.defCategories[category + "." + schemaDef.title] = category;
    }

    for (const propName in schemaDef.properties) {
      const propNode = schemaDef.properties[propName];

      if (propNode && typeof propNode !== "boolean") {
        if (propNode.$ref) {
          if (this.defRefs[propNode.$ref] === undefined) {
            this.defRefs[propNode.$ref] = 1;
          } else {
            this.defRefs[propNode.$ref]++;
          }
        }
      }
    }

    if (schemaDef.definitions) {
      for (const defName in schemaDef.definitions) {
        const def = schemaDef.definitions[defName];
        if (def && typeof def !== "boolean") {
          this.defsById[defName.toString()] = def;
          this.processDef(def, category, depth + 1);
        }
      }
    }
  }

  public async generateFormNodesFromLegacyDocNode(
    formJsonFolder: IFolder,
    node: ILegacyDocumentationNode,
    prefix?: string
  ) {
    for (const childNode of node.nodes) {
      if (childNode.name) {
        const name = this.getFormFileName(childNode.name);

        const formDocNode = this.getFormFromDocNode(childNode, childNode.name);

        const genFormDocNode = await this.getOriginalFormDefinition(formJsonFolder, name, prefix);
        await this.annotateFormJson(formDocNode, name, prefix, genFormDocNode);
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

  public async mergeToFile(
    formJsonFolder: IFolder,
    name: string,
    formDefNode: IFormDefinition,
    categoryName?: string,
    isSchema?: boolean
  ) {
    if (categoryName && categoryName.length > 0) {
      formJsonFolder = formJsonFolder.ensureFolder(categoryName);
    }

    name = name.toLowerCase();
    name = name.replace(/ /gi, "_");

    const file = formJsonFolder.ensureFile(name + ".form.json");

    await file.loadContent();

    let jsonO = StorageUtilities.getJsonObject(file);

    if (isSchema) {
      if (jsonO) {
        (jsonO as IFormDefinition).generatedFromSchema_doNotEdit = formDefNode;
      } else {
        jsonO = {
          id: formDefNode.id,
          fields: [],
          generatedFromSchema_doNotEdit: formDefNode,
        };
      }
    } else {
      if (jsonO) {
        (jsonO as IFormDefinition).generated_doNotEdit = formDefNode;
      } else {
        jsonO = {
          id: formDefNode.id,
          fields: [],
          generated_doNotEdit: formDefNode,
        };
      }
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
        AnnotationCategory.entityComponentDependent,
        AnnotationCategory.entityComponentDependentInGroup,
      ]);
      await this.addSamplesMatches(formDefNode, canonName, [
        AnnotationCategory.entityComponentDependent,
        AnnotationCategory.entityComponentDependentInGroup,
      ]);
    } else if (prefix === "item" && isMinecraftComponent) {
      await this.addVanillaMatches(formDefNode, canonName, [AnnotationCategory.itemComponentDependent]);
      await this.addSamplesMatches(formDefNode, canonName, [AnnotationCategory.itemComponentDependent]);
    } else if (prefix === "block" && isMinecraftComponent) {
      await this.addVanillaMatches(formDefNode, canonName, [AnnotationCategory.blockComponentDependent]);
      await this.addSamplesMatches(formDefNode, canonName, [AnnotationCategory.blockComponentDependent]);
    } else if (prefix === "entityfilters") {
      await this.addVanillaMatches(formDefNode, canonName, [AnnotationCategory.entityFilter]);
      await this.addSamplesMatches(formDefNode, canonName, [AnnotationCategory.entityFilter]);
    } else if (prefix === "features") {
      await this.addVanillaMatches(formDefNode, canonName, [AnnotationCategory.entityFilter]);
      await this.addSamplesMatches(formDefNode, canonName, [AnnotationCategory.entityFilter]);
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

  public async addVanillaMatches(formDefNode: IFormDefinition, name: string, annotations: AnnotationCategory[]) {
    const vanillaMatches = await Database.getPreviewVanillaMatches(name, true, annotations);

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

  public async addSamplesMatches(formDefNode: IFormDefinition, name: string, annotations: AnnotationCategory[]) {
    const samplesMatches = await Database.getSamplesMatches(name, true, annotations);

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
        exampleList.push({ path: path, content: source });
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
      id: name,
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

  public getDefinitionFromId(definitionString: string) {
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

  public async getFieldFromJsonPropertyNode(
    childNode: JSONSchema7,
    propName: string,
    alreadyProcessedFieldList?: string[]
  ) {
    let id = childNode.$id ? childNode.$id : propName;
    let title = childNode.title ? childNode.title : id;

    title = Utilities.humanifyMinecraftName(this.humanifyJsonMinecraftName(title));

    if (!alreadyProcessedFieldList) {
      alreadyProcessedFieldList = [];
    } else {
      alreadyProcessedFieldList = alreadyProcessedFieldList.slice();
    }

    const fieldNode: IField = {
      id: id,
      title: title,
      description: childNode.description ? childNode.description : undefined,
      dataType: FieldDataType.object,
    };

    if (childNode.minItems !== undefined) {
      fieldNode.minLength = childNode.minItems;
    }

    if (childNode.maxItems !== undefined) {
      fieldNode.maxLength = childNode.maxItems;
    }

    if (childNode.pattern) {
      if (fieldNode.validity === undefined) {
        fieldNode.validity = [];
      }
      fieldNode.validity.push({
        comparison: ComparisonType.matchesPattern,
        value: childNode.pattern,
      });
    }
    if (childNode.required) {
      fieldNode.readOnly = true;
    }

    if (childNode.minimum) {
      if (fieldNode.validity === undefined) {
        fieldNode.validity = [];
      }

      fieldNode.validity.push({
        comparison: ComparisonType.greaterThanOrEqualTo,
        value: childNode.minimum,
      });
    }

    if (childNode.maximum) {
      if (fieldNode.validity === undefined) {
        fieldNode.validity = [];
      }

      fieldNode.validity.push({
        comparison: ComparisonType.lessThanOrEqualTo,
        value: childNode.maximum,
      });
    }

    if (childNode.title === "associative container") {
      if (
        childNode.additionalProperties &&
        typeof childNode.additionalProperties !== "boolean" &&
        childNode.additionalProperties.type === "string"
      ) {
        fieldNode.dataType = FieldDataType.keyedStringCollection;
      } else if (
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
        const id = childNode.additionalProperties.$ref;

        if (!alreadyProcessedFieldList.includes(id)) {
          alreadyProcessedFieldList.push(id);
          const subDefNode = this.getDefinitionFromId(id);

          if (subDefNode) {
            if (subDefNode.title === "compound_proxy") {
              // this is technically an associative array of strings to strings, bools, or ints
              // "states": { "foo": "bar", "baz": 3, "bal": true }
              fieldNode.dataType = FieldDataType.keyedStringCollection;
            } else {
              await this.addChildSchemaNode(
                fieldNode,
                propName,
                subDefNode,
                FieldDataType.keyedStringCollection,
                alreadyProcessedFieldList
              );
            }
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
    } else if (childNode.items && (childNode.items as any).$ref) {
      const id = (childNode.items as any).$ref;

      if (!alreadyProcessedFieldList.includes(id)) {
        alreadyProcessedFieldList.push(id);
        const subDefNode = this.getDefinitionFromId(id);

        if (subDefNode) {
          await this.addChildSchemaNode(
            fieldNode,
            propName,
            subDefNode,
            FieldDataType.objectArray,
            alreadyProcessedFieldList
          );
        }
      } else if (childNode.items && (childNode.items as any).type === "string") {
        fieldNode.dataType = FieldDataType.stringArray;
      }
    } else if (childNode.$ref && (!childNode.type || childNode.type === "object")) {
      const id = (childNode as any).$ref;

      if (!alreadyProcessedFieldList.includes(id)) {
        alreadyProcessedFieldList.push(id);
        const subDefNode = this.getDefinitionFromId(id);

        if (subDefNode) {
          await this.addChildSchemaNode(
            fieldNode,
            propName,
            subDefNode,
            FieldDataType.object,
            alreadyProcessedFieldList
          );
        }
      }
    } else if (childNode.properties && (!childNode.type || childNode.type === "object" || childNode.type === "array")) {
      fieldNode.subForm = await this.getJsonFormFromJsonSchemaDefinition(
        childNode,
        propName,
        alreadyProcessedFieldList
      );
      fieldNode.dataType = childNode.type === "array" ? FieldDataType.objectArray : FieldDataType.object;
    } else if (
      childNode.additionalProperties &&
      (childNode.additionalProperties as any).$ref &&
      (!childNode.type || childNode.type === "object" || childNode.type === "array")
    ) {
      const id = (childNode.additionalProperties as any).$ref;

      if (!alreadyProcessedFieldList.includes(id)) {
        const subDefNode = this.getDefinitionFromId(id);

        if (subDefNode) {
          await this.addChildSchemaNode(
            fieldNode,
            propName,
            subDefNode,
            childNode.type === "array" ? FieldDataType.objectArray : FieldDataType.object,
            alreadyProcessedFieldList
          );
        }
      }
    } else if (
      childNode.additionalProperties &&
      (!childNode.type || childNode.type === "object" || childNode.type === "array")
    ) {
      const keyTypeNodes: JSONSchema7[] = [];
      if ((childNode.additionalProperties as JSONSchema7).type) {
        keyTypeNodes.push(childNode.additionalProperties as JSONSchema7);
      }
      if ((childNode.additionalProperties as any).oneOf) {
        keyTypeNodes.push(...(childNode.additionalProperties as any).oneOf);
      }

      const altFields: IField[] = [];
      let isFirst = true;

      for (const valObj of keyTypeNodes) {
        let childFieldNode: IField = { id: fieldNode.id, dataType: FieldDataType.object };

        switch (valObj.type) {
          case "integer":
          case "number":
            childFieldNode.dataType = FieldDataType.keyedNumberCollection;
            break;
          case "boolean":
            childFieldNode.dataType = FieldDataType.keyedBooleanCollection;
            break;
          case "string":
            childFieldNode.dataType = FieldDataType.keyedStringCollection;
            break;
          case "object":
            childFieldNode.dataType = FieldDataType.keyedObjectCollection;
            break;
        }

        if (isFirst) {
          fieldNode.dataType = childFieldNode.dataType;
          isFirst = false;
        } else {
          altFields.push(childFieldNode);
        }
      }

      if (altFields.length > 0) {
        fieldNode.alternates = altFields;
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
          if (childNode.items && (childNode.items as any).type === "string") {
            fieldNode.dataType = FieldDataType.stringArray;
          } else if (
            childNode.items &&
            ((childNode.items as any).type === "integer" || (childNode.items as any).type === "number")
          ) {
            fieldNode.dataType = FieldDataType.numberArray;
          } else if (fieldNode.subForm) {
            fieldNode.dataType = FieldDataType.objectArray;
          } else {
            fieldNode.dataType = FieldDataType.stringArray;
          }
          break;
      }
    }

    return fieldNode;
  }

  public async addChildSchemaNode(
    fieldNode: IField,
    propName: string,
    subDefNode: JSONSchema7,
    dataType: FieldDataType,
    alreadyProcessedFieldList: string[]
  ) {
    alreadyProcessedFieldList = alreadyProcessedFieldList.slice();

    if (subDefNode.oneOf) {
      const altFields: IField[] = [];
      let isFirst = true;

      for (const subDef of subDefNode.oneOf) {
        if (typeof subDef !== "boolean") {
          let childFieldNode: IField | undefined = { id: fieldNode.id, dataType: FieldDataType.object };

          if (subDef && (subDef as any).$ref) {
            const id = (subDef as any).$ref;

            if (!alreadyProcessedFieldList.includes(id)) {
              const propSubDefNode = this.getDefinitionFromId(id);
              alreadyProcessedFieldList.push(id);

              if (propSubDefNode) {
                if (propSubDefNode.oneOf && !propSubDefNode.properties) {
                  for (const propField of propSubDefNode.oneOf) {
                    if (typeof propField !== "boolean") {
                      const propChildFieldNode = await this.getFieldFromJsonPropertyNode(
                        propField,
                        propName,
                        alreadyProcessedFieldList.slice()
                      );

                      propChildFieldNode.dataType = FieldUtilities.getStringKeyedFieldType(propChildFieldNode.dataType);

                      if (isFirst) {
                        fieldNode.dataType = propChildFieldNode.dataType;
                        fieldNode.subForm = propChildFieldNode.subForm;
                        isFirst = false;
                      } else {
                        propChildFieldNode.description = undefined;
                        propChildFieldNode.title = undefined;

                        altFields.push(propChildFieldNode);
                      }
                    }
                  }
                  childFieldNode = undefined;
                } else {
                  childFieldNode.dataType = dataType;
                  childFieldNode.subForm = await this.getJsonFormFromJsonSchemaDefinition(propSubDefNode, propName);
                }
              }
            }
          } else {
            childFieldNode = await this.getFieldFromJsonPropertyNode(subDef, propName, alreadyProcessedFieldList);
          }

          if (childFieldNode) {
            if (subDefNode.title && subDefNode.title.indexOf("<") >= 0) {
              childFieldNode.dataType = FieldUtilities.getStringKeyedFieldType(childFieldNode.dataType);
            }

            if (isFirst) {
              fieldNode.dataType = childFieldNode.dataType;
              fieldNode.subForm = childFieldNode.subForm;
              isFirst = false;
            } else {
              childFieldNode.description = undefined;
              childFieldNode.title = undefined;

              altFields.push(childFieldNode);
            }
          }
        }
      }

      fieldNode.alternates = altFields;
    } else if (subDefNode.properties) {
      const subForm = await this.getJsonFormFromJsonSchemaDefinition(subDefNode, undefined, alreadyProcessedFieldList);

      fieldNode.subForm = subForm;
      fieldNode.dataType = dataType;
    } else {
      fieldNode.dataType = dataType;
    }
  }

  public humanifyId(title: string) {
    let i = title.indexOf(".");

    if (i > 1) {
      title = title.substring(i + 1);
    }

    title = title.replace("Struct", "");
    title = title.replace("struct", "");

    title = title.replace("Enum", "");
    title = title.replace("enum", "");

    title = title.replace("SharedTypes", "");
    title = title.replace("sharedtypes", "");

    title = title.replace(/::/gi, "_");

    title = title.trim();

    return title;
  }

  public humanifyJsonMinecraftName(title: string) {
    while (title.length > 1 && title.startsWith(":")) {
      title = title.substring(1);
    }

    title = title.replace("Struct", "");
    title = title.replace("struct", "");

    title = title.replace("Enum", "");
    title = title.replace("enum", "");

    title = title.replace("SharedTypes", "");
    title = title.replace("sharedtypes", "");

    title = title.replace(/::/gi, "_");
    title = title.replace(/:/gi, "_");

    title = title.trim();

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

    return this.getFormFileNameBase(name);
  }
}
