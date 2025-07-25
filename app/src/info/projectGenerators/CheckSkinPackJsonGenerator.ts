import { ProjectItemType } from "../../app/IProjectItemData";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { InfoItemType } from "../IInfoItemData";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { IProjectInfoTopicData } from "../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../ProjectInfoItem";
import {
  getModelTargetGeometry,
  isValidCapeSize,
  isValidSkinPurchaseType,
  isValidSkinModelTarget,
  Skin,
} from "../../minecraft/skins/Skin";
import StorageUtilities from "../../storage/StorageUtilities";
import { isResult, notApplicable, resultFromTest } from "../tests/TestDefinition";
import { findEnsuredFiles, getEnsuredFile, getEnsuredFileOfType } from "../../app/ProjectItemUtilities";
import { getLocKeysFromSkinPack, SkinPack, validateSkinPackJson } from "../../minecraft/skins/SkinPack";
import IFile from "../../storage/IFile";
import LocManager from "../../minecraft/LocManager";
import {
  getSegmentsVisibilities,
  getSkinTargetFromName,
  isOuterAreaIsBlank,
  getSkinTargetByUniquePixelLocations,
} from "../../minecraft/textures/TextureUtilities";
import FileTexture from "../../minecraft/textures/FileTexture";

const MaxFreeSkins = 2;
const MaxSkinsInAPack = 80;
const LeadingOrTrailingSpaceRegex = /^\s+|\s+$/;

const Tests = {
  JsonNotFoundFile: {
    id: 101,
    title: "Skin Pack Json File Not Found",
    severity: InfoItemType.error,
    defaultMessage: "skins.json file not found.",
  },
  InvalidJsonFile: { id: 102, title: "Invalid Json File" },
  InvalidPackLocName: {
    id: 103,
    title: "Invalid Localization Name",
    severity: InfoItemType.error,
    defaultMessage: "skins.json localization_name and serialize_name must be the same.",
  },
  TooManyFreeSkins: { id: 104, title: "More Free Skins Than Allowed" },
  DuplicateTextures: { id: 105, title: "Duplicate Textures Found", severity: InfoItemType.warning },
  CapeTextureNotAllowed: { id: 106, title: "Cape Texture Not Allowed" },
  InvalidTextureSize: { id: 107, title: "Texture Invalid Size" },
  MCCreatorPropertyNotAllowed: { id: 108, title: "Minecraft Creator Property Not Allowed" },
  FailedToReadFile: { id: 109, title: "File Read Failed" },
  OrphanedTexture: { id: 110, title: "Texture Not Found in skins.json" },
  OrphanedLocKey: { id: 111, title: "Loc Key Not Found in Lang File" },
  LocalizedKeyNotFoundInSkinsJson: { id: 112, title: "Localized Key Not Found In skins.json" },
  InvalidSpacingOnLocalizedKey: { id: 113, title: "Localized Key Cannot Have Leading Or Trailing Spaces" },
  InvalidSkinType: { id: 114, title: "Skin Purchase Type Not Allowed" },
  InvalidSkinModelTarget: { id: 115, title: "Invalid Skin Model Target" },
  InvalidNumberOfSkins: {
    id: 116,
    title: "Invalid Number Of Skins",
    defaultMessage: `Maximum Allowable skins is: ${MaxSkinsInAPack}`,
  },
  OuterAreaIsBlank: { id: 117, title: "Outer Area Blank" },
  ModelInvisible: { id: 118, title: "Model Invisible From Some Angles" },
  ModelPartiallyInvisible: { id: 119, title: "Model Partially Invisible", severity: InfoItemType.warning },
  CouldNotFindRelatedPack: { id: 120, title: "Could Not Find Related Skin Pack" },
} as const;

export default class CheckSkinPackJsonGenerator implements IProjectInfoGenerator {
  id: string = "CSPJ";
  title: string = "Check Skin Pack Json Generator";
  canAlwaysProcess = true;

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const skinPackManifestItems = project.getItemsByType(ProjectItemType.skinPackManifestJson);

    const allResults: ProjectInfoItem[] = [];

    for (const skinPackManifestItem of skinPackManifestItems) {
      if (!skinPackManifestItems.length) {
        return notApplicable();
      }

      const skinPack = await skinPackManifestItem.getPack();

      if (!skinPack) {
        allResults.push(
          resultFromTest(
            Tests.CouldNotFindRelatedPack,
            this.id,
            "Could not read skin pack manifest pack",
            skinPackManifestItem,
            skinPackManifestItem.name
          )
        );
        continue;
      }

      const packItems = skinPack.getPackItems();
      const skinCatalogJsonFile = await getEnsuredFileOfType(packItems, ProjectItemType.skinCatalogJson);

      if (!skinCatalogJsonFile) {
        return [
          resultFromTest(Tests.JsonNotFoundFile, this.id, "Could not find skins.json file", skinPackManifestItem),
        ];
      }

      // read skin pack from json and return error results if it can't be read or validated
      const skinCatalogJson = await StorageUtilities.getJsonObject(skinCatalogJsonFile);
      const [skinPackManifestObj, errors] = validateSkinPackJson(skinCatalogJson);

      if (errors) {
        return errors.map((error) =>
          resultFromTest(Tests.InvalidJsonFile, this.id, error.message, skinPackManifestItem)
        );
      }

      if (!hasValidLocalizationNames(skinPackManifestObj.localization_name, skinPackManifestObj.serialize_name)) {
        return [resultFromTest(Tests.InvalidPackLocName, this.id, undefined, skinPackManifestItem)];
      }

      allResults.push(...this.validateSkins(skinPackManifestObj.skins, project.isMinecraftCreator));
      allResults.push(
        ...(await this.validateTextures(packItems, skinPackManifestObj.skins, project.isMinecraftCreator))
      );
      allResults.push(...this.checkSkinLocalizations(project.loc, skinPackManifestObj));
    }

    return allResults;
  }

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const title = Object.values(Tests).find((value) => value.id === topicId)?.title || `Unknown Test: ${topicId}`;

    return { title };
  }

  summarize(): void {}

  private validateSkins(skins: Skin[], isMCCreator: boolean) {
    const results = [];

    const invalidSkins = skins
      .filter((skin) => !isValidSkinPurchaseType(skin.type))
      .map(() => resultFromTest(Tests.InvalidSkinType, this.id));
    results.push(...invalidSkins);

    const freeSkins = skins.filter((skin) => skin.type === "free");
    if (freeSkins.length > MaxFreeSkins) {
      const message = `${freeSkins.length} free skins found. Only ${MaxFreeSkins} allowed.`;
      results.push(resultFromTest(Tests.TooManyFreeSkins, this.id, message));
    }

    if (!isMCCreator) {
      const nonFPResults = this.validateNonMCRestrictionsForSkin(skins);
      results.push(...nonFPResults);
    }

    return results;
  }

  private async validateTextures(
    packItems: ProjectItem[],
    skins: Skin[],
    isMCCreator: boolean
  ): Promise<ProjectInfoItem[]> {
    //check for duplicate capes
    const capeTextureNames = skins.map((skin) => skin.cape).filter((cape) => !!cape);

    // CSPJ105
    const duplicateCapeTexturesResults = capeTextureNames
      .filter((name, index) => capeTextureNames.indexOf(name) !== index)
      .map((duplicate) =>
        resultFromTest(Tests.DuplicateTextures, this.id, `Duplicate cape texture found: ${duplicate}`)
      );

    //check cape textures
    const capeTextureSet = new Set(capeTextureNames);
    const capeTextures = await findEnsuredFiles(packItems, (item) => capeTextureSet.has(item.name));

    const capeCheck = await Promise.all(capeTextures.map((cape) => this.validateCapeTextureImage(cape)));
    const capeResults = capeCheck.filter(isResult);

    //check for duplicate skin textures
    const skinTextureNames = skins.map((skin) => skin.texture).filter((texture) => !!texture);
    const duplicateTextureResults = skinTextureNames
      .filter((name, index) => skinTextureNames.indexOf(name) !== index)
      .map((duplicate) =>
        resultFromTest(Tests.DuplicateTextures, this.id, `Duplicate skin texture found: ${duplicate}`)
      );

    //check skin textures
    const textureCheck = await Promise.all(
      skins.map((skin) => this.validateTextureImage(skin, packItems, isMCCreator))
    );
    const textureResults = textureCheck.flatMap((result) => result);

    //check orphaned textures
    const knownTextures = new Set([...skinTextureNames, ...capeTextureSet]);
    const allTexturesInProject = packItems.filter((item) => item.itemType === ProjectItemType.texture);
    const orphaned = allTexturesInProject.filter((texItem) => !knownTextures.has(texItem.name));

    // CSPJ110
    const orphanResults = orphaned.map((orphan) =>
      resultFromTest(Tests.OrphanedTexture, this.id, `${orphan.name} in skin pack not found in skins.json`)
    );

    // combine and return results
    return [
      ...duplicateCapeTexturesResults,
      ...capeResults,
      ...duplicateTextureResults,
      ...textureResults,
      ...orphanResults,
    ];
  }

  private validateNonMCRestrictionsForSkin(skins: Skin[]) {
    const results = [];

    if (skins.length > MaxSkinsInAPack) {
      results.push(resultFromTest(Tests.InvalidNumberOfSkins, this.id));
    }

    if (skins.find((skin) => hasMCOnlyProperties(skin))) {
      const message = "animations and enable_attachables not allowed if not Minecraft Creator";
      results.push(resultFromTest(Tests.MCCreatorPropertyNotAllowed, this.id, message));
    }

    if (skins.find((skin) => !!skin.cape)) {
      results.push(resultFromTest(Tests.CapeTextureNotAllowed, this.id));
    }

    return results;
  }

  private async validateCapeTextureImage(textureFile: IFile | null) {
    if (!textureFile) {
      return null;
    }

    const texture = await FileTexture.readTextureFromProjectFile(textureFile);

    if (!texture) {
      const message = `Failed to read file: ${textureFile.name}`;
      return resultFromTest(Tests.FailedToReadFile, this.id, message);
    }

    if (!isValidCapeSize([texture.width, texture.height])) {
      const message = `Texture: ${textureFile.name} is invalid size (${texture.width}x${texture.height})`;
      return resultFromTest(Tests.InvalidTextureSize, this.id, message);
    }

    return null;
  }

  private async validateTextureImage(
    skin: Skin,
    items: ProjectItem[],
    isMCCreator: boolean
  ): Promise<ProjectInfoItem[]> {
    const textureFile = await getEnsuredFile(items, (item) => item.name === skin.texture);
    if (!textureFile) {
      return [];
    }
    const textureName = textureFile.name;

    const texture = await FileTexture.readTextureFromProjectFile(textureFile);

    if (!texture) {
      const message = `Failed to read file: ${textureName}`;
      return [resultFromTest(Tests.FailedToReadFile, this.id, message)];
    }

    if (!isValidSkinModelTarget([texture.width, texture.height])) {
      const message = `Texture: ${textureName} is invalid size (${texture.width}x${texture.height})`;
      return [resultFromTest(Tests.InvalidTextureSize, this.id, message)];
    }

    // remaining checks do not apply to MC creator
    if (isMCCreator) {
      return [];
    }

    const skinTarget = getSkinTargetFromName(textureName);

    if (!skinTarget) {
      return [
        resultFromTest(
          Tests.InvalidSkinModelTarget,
          this.id,
          `No intended model tag in name. Slim model skins must have the prefix or suffix of  'a', 'alex', 'slim', 'customSlim' separated by an '_' ex. <name>_customSlim. Custom model skins must have the prefix or suffix of  's', 'steve', 'custom' separated by an '_' ex. <name>_custom.`
        ),
      ];
    }

    const geoSkinSize = getModelTargetGeometry(skin);

    if (!geoSkinSize) {
      return [resultFromTest(Tests.InvalidSkinModelTarget, this.id, `geometry property: ${skin.geometry} not allowed`)];
    }

    const pixelSkinSize = getSkinTargetByUniquePixelLocations(texture);

    const isSizeConsistent = skinTarget === geoSkinSize && skinTarget === pixelSkinSize;
    if (!isSizeConsistent) {
      const message = `Model size indicators are inconsistent. name: ${skinTarget}, geometry: ${geoSkinSize}, image data: ${pixelSkinSize}`;
      return [resultFromTest(Tests.InvalidSkinModelTarget, this.id, message)];
    }

    if (!isOuterAreaIsBlank(texture, skinTarget)) {
      const message = `[${textureFile.name}]: Ensure that no pixels not visible on the model are filled in with an alpha greater than 0`;
      return [resultFromTest(Tests.OuterAreaIsBlank, this.id, message)];
    }

    const segmentVisibilities = getSegmentsVisibilities(texture, skinTarget);

    const visErrors = segmentVisibilities
      .flatMap((segment) => {
        const messages = [];
        if (!segment.visibilities.top && !segment.visibilities.bottom) {
          messages.push(
            `The ${segment.segmentName} is not visible from the top and the bottom. This could cause this part of the model to be completely invisible from certain angles.`
          );
        }

        if (!segment.visibilities.front && segment.visibilities.back) {
          messages.push(
            `The ${segment.segmentName} is not visible from the front and the back. This could cause this part of the model to be completely invisible from certain angles.`
          );
        }

        if (!segment.visibilities.left && !segment.visibilities.right) {
          messages.push(
            `The ${segment.segmentName} is not visible from the right and the left. This could cause this part of the model to be completely invisible from certain angles.`
          );
        }

        return messages;
      })
      .map((message) => resultFromTest(Tests.ModelInvisible, this.id, message));

    const visWarnings = segmentVisibilities
      .flatMap((segment) =>
        Object.entries(segment.visibilities)
          .filter(([_side, isVisible]) => !isVisible)
          .map(([side]) => `Side: [${side}] of segment: [${segment.segmentName}] is not visible!`)
      )
      .map((message) => resultFromTest(Tests.ModelPartiallyInvisible, this.id, message));

    return [...visErrors, ...visWarnings];
  }

  private checkSkinLocalizations(locManager: LocManager, skinPack: SkinPack) {
    const locKeysFromSkinPack = getLocKeysFromSkinPack(skinPack);
    const knownKeys = new Set(locManager.getAllTokenKeys());

    const orphanLocKeyResults = locKeysFromSkinPack
      .filter((key) => !knownKeys.has(key))
      .map((key) =>
        resultFromTest(Tests.OrphanedLocKey, this.id, `Loc key [${key}] in skins.json not found in en_US.lang file`)
      );

    const knownSkinsKeys = new Set(locKeysFromSkinPack);

    const localizedOrphansResults = [];
    const invalidSpaceResults = [];

    for (const lang of locManager.getAllLanguages()) {
      const orphansResultsForLang = lang
        .getLocKeys()
        .filter((key) => !knownSkinsKeys.has(key) && (key.startsWith("skin.") || key.startsWith("skinpack.")))
        .map((orphanedKey) => `Loc Key: [${orphanedKey}] found in ${lang.language}.lang not found in skins.json`)
        .map((message) => resultFromTest(Tests.LocalizedKeyNotFoundInSkinsJson, this.id, message));

      const invalidSpaceResultsForLang = lang
        .getLocKeys()
        .filter((key) => LeadingOrTrailingSpaceRegex.test(key))
        .map(
          (invalidSpacedKey) =>
            `Loc string for key [${invalidSpacedKey}] in ${lang.language}.lang must not contain leading or trailing spaces.`
        )
        .map((message) => resultFromTest(Tests.InvalidSpacingOnLocalizedKey, this.id, message));

      localizedOrphansResults.push(...orphansResultsForLang);
      invalidSpaceResults.push(...invalidSpaceResultsForLang);
    }

    return [...orphanLocKeyResults, ...localizedOrphansResults, ...invalidSpaceResults];
  }
}

function hasValidLocalizationNames(localizationName?: string, serializeName?: string): localizationName is string {
  return !!localizationName && !!serializeName && localizationName === serializeName;
}

function hasMCOnlyProperties(skin: Skin) {
  return !!skin.animations || !!skin.enable_attachables;
}
