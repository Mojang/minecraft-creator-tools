import Project from "../../../app/Project";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import ProjectInfoItem from "../../ProjectInfoItem";
import { tryEnsureFiles } from "../../../app/ProjectItemUtilities";
import StorageUtilities from "../../../storage/StorageUtilities";
import { resultFromTest } from "../../tests/TestDefinition";
import { filterAndSeparate } from "../../../core/ArrayUtilities";
import { CheckBetaTests, JsonTypesToRead } from "./CheckBetaFeaturesData";

/**
 * Validates that beta features flags are not used in custom definitions.
 *
 * @see {@link ../../../../public/data/forms/mctoolsval/cbfg.form.json} for topic definitions
 */
export default class CheckBetaFeaturesGenerator implements IProjectInfoGenerator {
  id: string = "CBFG";
  title: string = "Beta Features";
  canAlwaysProcess = true;

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items = project.getItemsCopy();

    const [readJsonItems, failedItems] = await tryEnsureFiles(items, (item) => JsonTypesToRead.has(item.itemType));

    const failedReadResults = failedItems.map((item) =>
      resultFromTest(CheckBetaTests.FailedToReadFile, { id: this.id, item })
    );

    const jsonObjects = await Promise.all(
      readJsonItems.map(
        async (item) => [item, item.primaryFile && (await StorageUtilities.getJsonObject(item.primaryFile))] as const
      )
    );

    const [parsedJson, failedToParse] = filterAndSeparate(jsonObjects, ([_item, json]) => !!json);

    const jsonParseResults = failedToParse
      .map(([item]) => ({ id: this.id, item, data: item.primaryFile?.name }))
      .map((testData) => resultFromTest(CheckBetaTests.FailedToParseJson, testData));

    const useBetaResults = parsedJson
      .filter(([, json]) => json.use_beta_features === true)
      .map(([item]) => resultFromTest(CheckBetaTests.UsingBetaFeatures, { id: this.id, item }));

    return [...failedReadResults, ...jsonParseResults, ...useBetaResults];
  }

  summarize(): void {}
}
