import { ProjectItemType } from "../../app/IProjectItemData";
import Project from "../../app/Project";
import ProjectItem from "../../app/ProjectItem";
import { InfoItemType } from "../IInfoItemData";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { IProjectInfoTopicData } from "../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../ProjectInfoItem";
import { isValidSkinPurchaseType, Skin } from "../../minecraft/skins/Skin";
import StorageUtilities from "../../storage/StorageUtilities";
import { notApplicable, resultFromTest, resultFromTestWithMessage } from "../tests/TestDefinition";
import { getEnsuredFileOfType } from "../../app/ProjectItemUtilities";
import { getLocKeysFromSkinPack, SkinPack, validateSkinPackJson } from "../../minecraft/skins/SkinPack";
import IFile from "../../storage/IFile";
import LocManager from "../../minecraft/LocManager";

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
  CouldNotFindRelatedPack: {
    id: 120,
    title: "Could Not Find Related Skin Pack",
    defaultMessage: "Could not read skin pack manifest pack",
  },
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

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const title = Object.values(Tests).find((value) => value.id === topicId)?.title || `Unknown Test: ${topicId}`;

    return { title };
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
        resultFromTestWithMessage(Tests.DuplicateTextures, this.id, `Duplicate cape texture found: ${duplicate}`)
      );

    //check for duplicate skin textures
    const skinTextureNames = skins.map((skin) => skin.texture).filter((texture) => !!texture);
    const duplicateTextureResults = skinTextureNames
      .filter((name, index) => skinTextureNames.indexOf(name) !== index)
      .map((duplicate) =>
        resultFromTestWithMessage(Tests.DuplicateTextures, this.id, `Duplicate skin texture found: ${duplicate}`)
      );

    //check orphaned textures
    const knownTextures = new Set([...skinTextureNames]);
    const allTexturesInProject = packItems.filter((item) => item.itemType === ProjectItemType.texture);
    const orphaned = allTexturesInProject.filter((texItem) => !knownTextures.has(texItem.name));

    // CSPJ110
    const orphanResults = orphaned.map((orphan) =>
      resultFromTestWithMessage(Tests.OrphanedTexture, this.id, `${orphan.name} in skin pack not found in skins.json`)
    );

    // combine and return results
    return [...duplicateCapeTexturesResults, ...duplicateTextureResults, ...orphanResults];
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
