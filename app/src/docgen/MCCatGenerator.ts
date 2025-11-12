import Utilities from "../core/Utilities";
import IField, { FieldDataType } from "../dataform/IField";
import IFormDefinition, { IFormSample } from "../dataform/IFormDefinition";
import IFolder from "../storage/IFolder";
import Database from "../minecraft/Database";
import ILegacyDocumentationNode from "../minecraft/docs/ILegacyDocumentation";
import LegacyDocumentationDefinition from "../minecraft/docs/LegacyDocumentationDefinition";
import StorageUtilities from "../storage/StorageUtilities";
import IFile from "../storage/IFile";
import IIndexJson from "../storage/IIndexJson";
import { AnnotationCategory } from "../core/ContentIndex";
import DataFormUtilities from "../dataform/DataFormUtilities";
import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import { ComparisonType } from "../dataform/ICondition";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

export interface JsonTypeSummary {
  title: string;
  category: string;
}

export default class MCCatGenerator {
  public async updateMCCat(folder: IFolder, isPreview?: boolean) {
    await Database.load();

    const metadataFolder = isPreview
      ? await Database.loadPreviewMetadataFolder()
      : await Database.loadReleaseMetadataFolder();

    const newMcCatFile = folder.ensureFile("mccat.json");

    const cat = Database.catalog;

    if (!cat) {
      return;
    }

    const blockAuxToStateNodes = await LegacyDocumentationDefinition.loadNode(
      "addons",
      "/Blocks/AuxValueToBlockStatesMap/",
      isPreview
    );

    if (blockAuxToStateNodes) {
      for (const node of blockAuxToStateNodes?.nodes) {
        let name = node.name;
        let type = node.type;

        if (type) {
          let derivedTypeName = type;
          let description = node.description;
          let descriptStr = description && description.length > 0 ? description[0] : type;
          let leftBracket = descriptStr.indexOf("[");
          let propList: string[] = [];
          let propValues: string[] = [];

          if (leftBracket >= 0) {
            derivedTypeName = descriptStr.substring(0, leftBracket).trim();

            let rightBracket = descriptStr.indexOf("]", leftBracket + 1);
            const propStr = descriptStr.substring(
              leftBracket + 1,
              rightBracket >= 0 ? rightBracket : descriptStr.length
            );

            const props = propStr.split(",");

            for (const prop of props) {
              const eqPos = prop.split("=");
              if (eqPos.length === 2) {
                let propName = eqPos[0].trim().replace(/\"/gi, "");
                let propValue = eqPos[1].trim().replace(/\"/gi, "");

                propList.push(propName);
                propValues.push(propValue);
              }
            }
          } else if (descriptStr.length > 0) {
            derivedTypeName = descriptStr.trim();
          }

          type = MinecraftUtilities.canonicalizeName(type);
          derivedTypeName = MinecraftUtilities.canonicalizeName(derivedTypeName);

          let baseType = cat.blockBaseTypes.find((bt) => bt.n === type);

          if (!baseType) {
            baseType = {
              n: type,
              properties: [],
            };
            cat.blockBaseTypes.push(baseType);
          }

          /*
          for (const propName of propList) {
            let prop: IBlockTypePropertyData | undefined = baseType.properties?.find((p) => p.name === propName);

            if (!prop) {
              prop = {
                name: propName,
                type: BlockPropertyType.intEnum,
              };

              if (!baseType.properties) {
                baseType.properties = [];
              }

              baseType.properties.push(prop);
            }
          }*/

          baseType.properties = undefined;

          if (derivedTypeName !== type) {
            if (!baseType.variants) {
              baseType.variants = [];
            }

            let derivedType = baseType.variants.find(
              (dt) => (baseType && dt.n + baseType.n === derivedTypeName) || dt.n === derivedTypeName
            );

            if (!derivedType) {
              derivedType = {
                n: derivedTypeName,
              };

              baseType.variants.push(derivedType);
            }
          }
        }
      }
    }

    const blockNodes = await LegacyDocumentationDefinition.loadNode("addons", "/Blocks/Blocks/", isPreview);

    if (blockNodes) {
      for (const node of blockNodes.nodes) {
        let name = MinecraftUtilities.canonicalizeName(node.name);

        let existingObj = undefined;

        for (const blockBaseType of cat.blockBaseTypes) {
          if (blockBaseType.n === name) {
            existingObj = blockBaseType;
            break;
          }

          if (blockBaseType.variants) {
            for (const variant of blockBaseType.variants) {
              if (variant.n === name || variant.n + blockBaseType.n === name) {
                existingObj = variant;
                break;
              }
            }
          }
        }

        if (!existingObj && cat.blockBaseTypes) {
          const baseType = {
            n: name,
          };
          cat.blockBaseTypes.push(baseType);
        }
      }
    }

    for (const blockBaseType of cat.blockBaseTypes) {
      if (blockBaseType.variants) {
        for (const variant of blockBaseType.variants) {
          if (variant.n && variant.n.endsWith("_" + blockBaseType.n)) {
            variant.n = variant.n.substring(0, variant.n.length - blockBaseType.n.length);
            variant.id = undefined;
          }
        }

        blockBaseType.variants.sort((a, b) => {
          return a.n.localeCompare(b.n);
        });
      }
      blockBaseType.id = undefined;
    }

    cat.blockBaseTypes.sort((a, b) => {
      return a.n.localeCompare(b.n);
    });

    if (cat.entityTypes) {
      cat.entityTypes.sort((a, b) => {
        return a.id.localeCompare(b.id);
      });
    }

    let out = JSON.stringify(cat, undefined, 2);

    newMcCatFile.setContent(out);

    await newMcCatFile.saveContent();
  }

  static cleanForId(id: string | undefined) {
    if (!id) {
      return "";
    }

    id = Utilities.removeQuotes(id.replace(/\`/gi, ""));

    let parenStart = id.indexOf(" (");

    let parenEnd = id.indexOf(")");

    if (parenStart > 0 && parenEnd > parenStart) {
      id = id.substring(0, parenStart) + id.substring(parenEnd + 1);

      id = id.trim();
    }

    return id;
  }

  public async generateFormJson(inputFolder: IFolder, outputFolder: IFolder) {
    await outputFolder.deleteAllFolderContents();

    await this.generateFormJsonFromFolder(inputFolder, outputFolder);
  }

  public async generateFormJsonFromFolder(inputFolder: IFolder, outputFolder: IFolder) {
    await outputFolder.ensureExists();

    if (!inputFolder.isLoaded) {
      await inputFolder.load();
    }

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

    fileList.files.sort();
    fileList.folders.sort();

    const indexFile = outputFolder.ensureFile("index.json");
    indexFile.setContent(Utilities.consistentStringifyTrimmed(fileList));
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

    if (!targetForm.technicalDescription || targetForm.technicalDescription === "") {
      targetForm.technicalDescription = formToMergeOn.technicalDescription;
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

    if (!targetForm.scalarFieldUpgradeName && formToMergeOn.scalarFieldUpgradeName) {
      targetForm.scalarFieldUpgradeName = formToMergeOn.scalarFieldUpgradeName;
      targetForm.scalarField = undefined; // you can either have a scalarFieldUpgradeName, or a scalarField, but not both. defer to scalarFieldUpgradeName
    } else if (!targetForm.scalarField) {
      targetForm.scalarField = formToMergeOn.scalarField;
    }

    if (!targetForm.customField) {
      targetForm.customField = formToMergeOn.customField;
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

              if (targetField.defaultValue === undefined) {
                targetField.defaultValue = mergeOnField.defaultValue;
              }

              if (mergeOnField.subForm && !targetField.subFormId) {
                if (!targetField.subForm) {
                  targetField.subForm = {
                    fields: [],
                  };
                }

                this.mergeOntoForm(targetField.subForm, mergeOnField.subForm);
              }

              if (mergeOnField.subFormId) {
                targetField.subFormId = mergeOnField.subFormId;
                targetField.subForm = undefined; // you can either have a subFormId, or a subForm, but not both. defer to subFormId
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

              if (!targetField.retainIfEmptyOrDefault) {
                targetField.retainIfEmptyOrDefault = mergeOnField.retainIfEmptyOrDefault;
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

    if (!file.isContentLoaded) {
      await file.loadContent();
    }

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

    if (!file.isContentLoaded) {
      await file.loadContent();
    }

    let jsonO = StorageUtilities.getJsonObject(file);

    if (isSchema) {
      if (jsonO) {
        (jsonO as IFormDefinition).generatedFromSchema_doNotEdit = formDefNode;
      } else {
        jsonO = {
          id: MCCatGenerator.cleanForId(formDefNode.id),
          fields: [],
          generatedFromSchema_doNotEdit: formDefNode,
        };
      }
    } else {
      if (jsonO) {
        (jsonO as IFormDefinition).generated_doNotEdit = formDefNode;
      } else {
        jsonO = {
          id: MCCatGenerator.cleanForId(formDefNode.id),
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
      if (Utilities.isUsableAsObjectKey(field.id)) {
        fieldsById[field.id] = field;
      }
    }

    const originalFieldsById: { [id: string]: IField } = {};

    if (originalNode && originalNode.fields) {
      for (const field of originalNode.fields) {
        if (Utilities.isUsableAsObjectKey(field.id)) {
          originalFieldsById[field.id] = field;
        }
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
                    id: MCCatGenerator.cleanForId(fieldName),
                    title: Utilities.humanifyMinecraftName(fieldName),
                    dataType: dataType,
                    subForm: subForm,
                  };

                  if (Utilities.isUsableAsObjectKey(fieldName)) {
                    fieldsById[fieldName] = newField;
                  }

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
                      if (typeof subObj === "object" && Utilities.isUsableAsObjectKey(path)) {
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
            if (!file.isContentLoaded) {
              await file.loadContent();
            }
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
            if (!file.isContentLoaded) {
              await file.loadContent();
            }
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

  static sanitizeTitle(title: string) {
    if (title.indexOf("enum ") || title.indexOf("struct ")) {
      title = title.replace("enum ", "");
      title = title.replace("struct ", "");
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
          if (field.id.toLowerCase().indexOf("s an obj") >= 0 && field.subForm) {
            for (const subField of field.subForm.fields) {
              fields.push(subField);
            }
          } else {
            fields.push(field);
          }
        }
      }
    }

    const docForm: IFormDefinition = {
      id: MCCatGenerator.cleanForId(name),
      title: name ? Utilities.humanifyMinecraftName(name) : undefined,
      description: childNode.description ? MCCatGenerator.humanifyText(childNode.description.join("\n")) : undefined,
      fields: fields,
    };

    if (childNode.examples) {
      const examples: IFormSample[] = [];

      for (const example of childNode.examples) {
        if (example.name && example.text) {
          examples.push({
            path: example.name,
            content: example.text.join("\n"),
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
      !childNode.name.startsWith("on_increase") &&
      !childNode.name.startsWith("on_break") &&
      (type === FieldDataType.string ||
        type === FieldDataType.object ||
        type === FieldDataType.objectArray ||
        type === FieldDataType.stringArray)
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
      id: MCCatGenerator.cleanForId(childNode.name),
      title: Utilities.humanifyMinecraftName(childNode.name),
      description: childNode.description ? MCCatGenerator.humanifyText(childNode.description.join("\n")) : undefined,
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
              desc = choiceNode.description.join("\n");
            }

            fieldNode.choices.push({
              id: MCCatGenerator.cleanForId(choiceNode.name),
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
            content: example.text.join("\n"),
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

  public getFieldIsDifferentType(fieldA: IField, fieldB: IField) {
    if (fieldA.dataType !== fieldB.dataType) {
      return true;
    }

    if (fieldA.subFormId !== fieldB.subFormId) {
      return true;
    }

    if ((fieldA.subForm && !fieldB.subForm) || (!fieldA.subForm && fieldB.subForm)) {
      return true;
    }

    return false;
  }

  public static humanifyId(title: string) {
    let i = title.indexOf(".");

    if (i > 1) {
      title = title.substring(i + 1);
    }

    title = MCCatGenerator.humanifyText(title);

    return title;
  }

  public static humanifyText(title: string) {
    if (title.indexOf("enum_") >= 0 || title.indexOf("StructuredTypes_") >= 0) {
      let lastUnderScore = title.lastIndexOf("_");

      if (lastUnderScore > 0 && lastUnderScore < title.length - 1) {
        title = title.substring(lastUnderScore + 1);
      }
    }

    title = title.replace(/::/gi, "_");

    title = title.replace("Struct ", "");
    title = title.replace("struct ", "");

    title = title.replace("Struct_", "");
    title = title.replace("struct_", "");

    title = title.replace("Enum ", "");
    title = title.replace("enum ", "");

    title = title.replace("Enum_", "");
    title = title.replace("enum_", "");

    title = title.replace("SharedTypes ", "");
    title = title.replace("sharedtypes ", "");

    title = title.replace("SharedTypes_", "");
    title = title.replace("sharedtypes_", "");

    title = title.trim();

    return title;
  }

  public humanifyJsonMinecraftName(title: string) {
    while (title.length > 1 && title.startsWith(":")) {
      title = title.substring(1);
    }

    title = title.replace(/::/gi, "_");
    title = title.replace(/:/gi, "_");

    title = title.replace("Struct ", "");
    title = title.replace("struct ", "");

    title = title.replace("Struct_", "");
    title = title.replace("struct_", "");

    title = title.replace("Enum ", "");
    title = title.replace("enum ", "");

    title = title.replace("Enum_", "");
    title = title.replace("enum_", "");

    title = title.replace("SharedTypes ", "");
    title = title.replace("sharedtypes ", "");

    title = title.replace("SharedTypes_", "");
    title = title.replace("sharedtypes_", "");

    title = title.trim();

    return title;
  }

  public getFormFileName(name: string, dataVersion?: string) {
    name = name.replace(/:/gi, "_").replace(/\./gi, "_").replace(/\`/gi, "_");

    let leftParen = name.lastIndexOf("(");

    if (leftParen >= 4) {
      name = name.substring(0, leftParen);
    }

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
