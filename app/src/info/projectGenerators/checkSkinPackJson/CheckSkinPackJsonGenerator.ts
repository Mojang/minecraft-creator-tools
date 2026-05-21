import { ProjectItemType } from "../../../app/IProjectItemData";
import Project from "../../../app/Project";
import ProjectItem from "../../../app/ProjectItem";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import ProjectInfoItem from "../../ProjectInfoItem";
import {
  getModelTargetGeometry,
  isValidCapeSize,
  isValidSkinPurchaseType,
  isValidSkinModelTarget,
  Skin,
} from "../../../minecraft/skins/Skin";
import StorageUtilities from "../../../storage/StorageUtilities";
import { isResult, notApplicable, resultFromTest, resultFromTestWithMessage } from "../../tests/TestDefinition";
import { findEnsuredFiles, getEnsuredFile, getEnsuredFileOfType } from "../../../app/ProjectItemUtilities";
import { getLocKeysFromSkinPack, SkinPack, validateSkinPackJson } from "../../../minecraft/skins/SkinPack";
import IFile from "../../../storage/IFile";
import LocManager from "../../../minecraft/LocManager";
import { getSkinTargetFromName } from "../../../minecraft/textures/TextureUtilities";
import TextureDefinition from "../../../minecraft/TextureDefinition";
import { CheckSkinPackJsonTests as Tests } from "./CheckSkinPackJsonData";

const MaxFreeSkins = 2;
const MaxSkinsInAPack = 80;
const LeadingOrTrailingSpaceRegex = /^\s+|\s+$/;

/**
 * Validates skin pack JSON files including skins.json structure and texture references.
 *
 * @see {@link ../../../../public/data/forms/mctoolsval/cspj.form.json} for topic definitions
 */
export default class CheckSkinPackJsonGenerator implements IProjectInfoGenerator {
  id: string = "CSPJ";
  title: string = "Skin Pack Validation";
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
          resultFromTest(Tests.CouldNotFindRelatedPack, {
            id: this.id,
            item: skinPackManifestItem,
            data: skinPackManifestItem.name,
          })
        );
        continue;
      }

      const packItems = skinPack.getPackItems();
      const skinCatalogJsonFile = await getEnsuredFileOfType(packItems, ProjectItemType.skinCatalogJson);

      if (!skinCatalogJsonFile) {
        return [
          resultFromTestWithMessage(
            Tests.JsonNotFoundFile,
            this.id,
            "Could not find skins.json file",
            skinPackManifestItem
          ),
        ];
      }

      // read skin pack from json and return error results if it can't be read or validated
      const skinCatalogJson = await StorageUtilities.getJsonObject(skinCatalogJsonFile);
      const [skinPackManifestObj, errors] = validateSkinPackJson(skinCatalogJson);

      if (errors) {
        return errors.map((error) =>
          resultFromTestWithMessage(Tests.InvalidJsonFile, this.id, error.message, skinPackManifestItem)
        );
      }

      if (!hasValidLocalizationNames(skinPackManifestObj.localization_name, skinPackManifestObj.serialize_name)) {
        return [resultFromTest(Tests.InvalidPackLocName, { id: this.id, item: skinPackManifestItem })];
      }

      allResults.push(...this.validateSkins(skinPackManifestObj.skins, project.isMinecraftCreator));
      allResults.push(
        ...(await this.validateTextures(packItems, skinPackManifestObj.skins, project.isMinecraftCreator))
      );
      allResults.push(...this.checkSkinLocalizations(project.loc, skinPackManifestObj));
    }

    return allResults;
  }

  summarize(): void {}

  private validateSkins(skins: Skin[], isMCCreator: boolean) {
    const results = [];

    const invalidSkins = skins
      .filter((skin) => !isValidSkinPurchaseType(skin.type))
      .map(() => resultFromTestWithMessage(Tests.InvalidSkinType, this.id));
    results.push(...invalidSkins);

    const freeSkins = skins.filter((skin) => skin.type === "free");
    if (freeSkins.length > MaxFreeSkins) {
      const message = `${freeSkins.length} free skins found. Only ${MaxFreeSkins} allowed.`;
      results.push(resultFromTestWithMessage(Tests.TooManyFreeSkins, this.id, message));
    }

    if (!isMCCreator) {
      const nonFPResults = this.validateNonMCRestrictionsForSkin(skins);
      results.push(...nonFPResults);
    }

    return results;
  }

  private async validateTextures(
    packItems: readonly ProjectItem[],
    skins: Skin[],
    isMCCreator: boolean
  ): Promise<ProjectInfoItem[]> {
    //check for duplicate capes
    const capeTextureNames = skins.map((skin) => skin.cape).filter((cape) => !!cape);

    // CSPJ105
    const duplicateCapeTexturesResults = capeTextureNames
      .filter((name, index) => capeTextureNames.indexOf(name) !== index)
      .map((duplicate) =>
        resultFromTestWithMessage(Tests.DuplicateTextures, this.id, `Duplicate cape texture found: ${duplicate}`)
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
        resultFromTestWithMessage(Tests.DuplicateTextures, this.id, `Duplicate skin texture found: ${duplicate}`)
      );

    //check skin textures
    const textureCheck = await Promise.all(
      skins.map((skin) => this.validateTextureImage(skin, packItems, isMCCreator))
    );
    const textureResults = textureCheck.flatMap((result) => result);

    //check orphaned textures
    const knownTextures = new Set([...skinTextureNames, ...capeTextureSet]);
    const allTexturesInProject = packItems.filter((item) => item.itemType === ProjectItemType.texture);
    const orphaned = allTexturesInProject.filter(
      (texItem) => !knownTextures.has(texItem.name) && !texItem.name.startsWith("pack_icon")
    );

    // CSPJ110
    const orphanResults = orphaned.map((orphan) =>
      resultFromTestWithMessage(Tests.OrphanedTexture, this.id, `${orphan.name} in skin pack not found in skins.json`)
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
      results.push(resultFromTestWithMessage(Tests.InvalidNumberOfSkins, this.id));
    }

    if (skins.find((skin) => hasMCOnlyProperties(skin))) {
      const message = "animations and enable_attachables not allowed if not Minecraft Creator";
      results.push(resultFromTestWithMessage(Tests.MCCreatorPropertyNotAllowed, this.id, message));
    }

    if (skins.find((skin) => !!skin.cape)) {
      results.push(resultFromTestWithMessage(Tests.CapeTextureNotAllowed, this.id));
    }

    return results;
  }

  private async validateCapeTextureImage(textureFile: IFile | null) {
    if (!textureFile) {
      return null;
    }

    const texture = await TextureDefinition.ensureOnFile(textureFile);

    if (!texture) {
      const message = `Failed to read file: ${textureFile.name}`;
      return resultFromTestWithMessage(Tests.FailedToReadFile, this.id, message);
    }

    const width = texture.width;
    const height = texture.height;

    if (!width || !height || texture.errorMessage) {
      const message = `Failed to read dimensions from texture: ${texture.errorMessage}`;
      return resultFromTestWithMessage(Tests.FailedToReadFile, this.id, message);
    }

    if (!isValidCapeSize([width, height])) {
      const message = `Texture: ${textureFile.name} is invalid size (${width}x${height})`;
      return resultFromTestWithMessage(Tests.InvalidTextureSize, this.id, message);
    }

    return null;
  }

  private async validateTextureImage(
    skin: Skin,
    items: readonly ProjectItem[],
    isMCCreator: boolean
  ): Promise<ProjectInfoItem[]> {
    const textureFile = await getEnsuredFile(items, (item) => item.name === skin.texture);
    if (!textureFile) {
      return [];
    }
    const textureName = textureFile.name;

    const texture = await TextureDefinition.ensureOnFile(textureFile);

    if (!texture) {
      const message = `Failed to read file: ${textureName}`;
      return [resultFromTestWithMessage(Tests.FailedToReadFile, this.id, message)];
    }

    if (!texture.isContentProcessed) {
      await texture.processContent();
    }

    const width = texture.width;
    const height = texture.height;

    if (!width || !height || texture.errorMessage) {
      const message = `Failed to read dimensions from texture: ${textureName} ${texture.errorMessage}`;
      return [resultFromTestWithMessage(Tests.FailedToReadFile, this.id, message)];
    }

    if (!isValidSkinModelTarget([width, height])) {
      const message = `Texture: ${textureName} is invalid size (${width}x${height})`;
      return [resultFromTestWithMessage(Tests.InvalidTextureSize, this.id, message)];
    }

    // remaining checks do not apply to MC creator
    if (isMCCreator) {
      return [];
    }

    const skinTarget = getSkinTargetFromName(textureName);

    //CSPJ115
    if (!skinTarget) {
      return [
        resultFromTestWithMessage(
          Tests.InvalidSkinModelTarget,
          this.id,
          `No intended model tag in name. Slim model skins must have the prefix or suffix of  'a', 'alex', 'slim', 'customSlim' separated by an '_' ex. <name>_customSlim. Custom model skins must have the prefix or suffix of  's', 'steve', 'custom' separated by an '_' ex. <name>_custom.`
        ),
      ];
    }

    const geoSkinSize = getModelTargetGeometry(skin);

    //CSPJ115
    if (!geoSkinSize) {
      return [
        resultFromTestWithMessage(
          Tests.InvalidSkinModelTarget,
          this.id,
          `geometry property: ${skin.geometry} not allowed`
        ),
      ];
    }

    return [];
  }

  private checkSkinLocalizations(locManager: LocManager, skinPack: SkinPack) {
    const locKeysFromSkinPack = getLocKeysFromSkinPack(skinPack);
    const knownKeys = new Set(locManager.getAllTokenKeys());

    const orphanLocKeyResults = locKeysFromSkinPack
      .filter((key) => !knownKeys.has(key))
      .map((key) =>
        resultFromTestWithMessage(
          Tests.OrphanedLocKey,
          this.id,
          `Loc key [${key}] in skins.json not found in en_US.lang file`
        )
      );

    const knownSkinsKeys = new Set(locKeysFromSkinPack);

    const localizedOrphansResults = [];
    const invalidSpaceResults = [];

    for (const lang of locManager.getAllLanguages()) {
      const orphansResultsForLang = lang
        .getLocKeys()
        .filter((key) => !knownSkinsKeys.has(key) && (key.startsWith("skin.") || key.startsWith("skinpack.")))
        .map((orphanedKey) => `Loc Key: [${orphanedKey}] found in ${lang.language}.lang not found in skins.json`)
        .map((message) => resultFromTestWithMessage(Tests.LocalizedKeyNotFoundInSkinsJson, this.id, message));

      const invalidSpaceResultsForLang = lang
        .getLocKeys()
        .filter((key) => LeadingOrTrailingSpaceRegex.test(key))
        .map(
          (invalidSpacedKey) =>
            `Loc string for key [${invalidSpacedKey}] in ${lang.language}.lang must not contain leading or trailing spaces.`
        )
        .map((message) => resultFromTestWithMessage(Tests.InvalidSpacingOnLocalizedKey, this.id, message));

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
