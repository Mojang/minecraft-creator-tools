import Project from "../../app/Project";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { IProjectInfoTopicData } from "../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../ProjectInfoItem";
import { tryEnsureFiles } from "../../app/ProjectItemUtilities";
import { ProjectItemType } from "../../app/IProjectItemData";
import StorageUtilities from "../../storage/StorageUtilities";
import { getTestTitleById, resultFromTest, TestDefinition } from "../tests/TestDefinition";
import { filterAndSeparate } from "../../core/ArrayUtilities";
import ProjectInfoUtilities from "../ProjectInfoUtilities";

enum CheckBetaTest {
  UsingBetaFeatures = "UsingBetaFeatures",
  FailedToParseJson = "FailedToParseJson",
  FailedToReadFile = "FailedToReadFile",
}

const CheckBetaTests: Record<CheckBetaTest, TestDefinition> = {
  FailedToReadFile: { id: 101, title: "Failed to read file" },
  FailedToParseJson: { id: 102, title: "Failed to parse Json", defaultMessage: "Failed to parse json in file" },
  UsingBetaFeatures: { id: 103, title: "Using beta features flag in custom definitions is not allowed" },
};

const JsonTypesToRead = new Set([
  ProjectItemType.behaviorPackManifestJson,
  ProjectItemType.entityTypeBehavior,
  ProjectItemType.blockTypeBehavior,
  ProjectItemType.itemTypeBehavior,
]);

export default class CheckBetaFeaturesGenerator implements IProjectInfoGenerator {
  id: string = "CBFG";
  title: string = "Check Beta Features Generator";
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

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const title = ProjectInfoUtilities.getGeneralTopicTitle(topicId) || getTestTitleById(CheckBetaTests, topicId);

    return { title };
  }

  summarize(): void {}
}
