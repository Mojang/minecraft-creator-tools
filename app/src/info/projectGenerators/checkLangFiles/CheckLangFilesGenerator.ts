import Project from "../../../app/Project";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import ProjectInfoItem from "../../ProjectInfoItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import StorageUtilities from "../../../storage/StorageUtilities";
import { resultFromTest } from "../../tests/TestDefinition";
import { parseLocalizationCatalogFromItem } from "../../../app/localization/LocalizationCatalog";
import Pack from "../../../minecraft/Pack";
import { CheckLangFilesTests as Tests } from "./CheckLangFilesData";

/*
  Checks languages.json and the various .lang files in a pack to ensure that they match

  For each language in languages.json there should be a corresponding .lang file,
  and each .lang file should have a corresponding entry in languages.json

  There should always be en_US

  @see {@link ../../../../public/data/forms/mctoolsval/langfiles.form.json} for topic definitions
*/
export default class CheckLangFilesGenerator implements IProjectInfoGenerator {
  id: string = "LANGFILES";
  title: string = "Language Files";
  canAlwaysProcess = true;

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const results = await Promise.all(project.packs.map((pack) => this.validatePack(pack)));

    return results.flat();
  }

  async validatePack(pack: Pack) {
    const items = pack.getPackItems();
    const catalogItem = items.find((item) => item.itemType === ProjectItemType.languagesCatalogJson);
    const langItems = items.filter((item) => item.itemType === ProjectItemType.lang);

    if (!catalogItem) {
      return [resultFromTest(Tests.MissingLanguagesJson, { id: this.id })];
    }

    const [catalog, parseErrors] = await parseLocalizationCatalogFromItem(catalogItem);
    if (parseErrors) {
      return parseErrors
        .map((error) => ({ id: this.id, message: error.message, item: catalogItem }))
        .map((data) => resultFromTest(Tests.FailedToParseFile, data));
    }

    if (!catalog.langs.find((lang: string) => lang === "en_US")) {
      return [resultFromTest(Tests.PrimaryLangMissing, { id: this.id, item: catalogItem })];
    }

    const allLangItems = langItems.map((item) => [item, StorageUtilities.getBaseFromName(item.name)] as const);
    const knownLangFileLangs = new Set(allLangItems.map(([, lang]) => lang));
    const knownCatalogLangs = new Set(catalog.langs);

    const langFileNotInCatalogResults = allLangItems
      .filter(([, lang]) => !knownCatalogLangs.has(lang))
      .map(([item]) => resultFromTest(Tests.ExtraLangFile, { id: this.id, item }));

    const catalogLangNotInFile = catalog.langs
      .filter((lang: string) => !knownLangFileLangs.has(lang))
      .map((lang: string) => resultFromTest(Tests.LangFileMissing, { id: this.id, data: lang, item: catalogItem }));

    return [...langFileNotInCatalogResults, ...catalogLangNotInFile];
  }

  summarize() {}
}
