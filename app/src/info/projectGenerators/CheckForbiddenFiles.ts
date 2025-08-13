import Project from "../../app/Project";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { IProjectInfoTopicData } from "../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../ProjectInfoItem";
import ProjectItem from "../../app/ProjectItem";
import { getTestTitleById, resultFromTest, TestDefinition } from "../tests/TestDefinition";
import { getWorldTemplates } from "../../app/ProjectItemUtilities";
import { AllowedExtensionsByType, BlockedFilesByType, PackageType } from "./data/ForbiddenFiles";
import StorageUtilities from "../../storage/StorageUtilities";
import ProjectInfoUtilities from "../ProjectInfoUtilities";

enum ForbiddenTest {
  FailedToReadFile = "FailedToReadFile",
  ExtNotInAllowList = "ExtNotInAllowList",
  InvalidFileName = "InvalidFileName",
  ContainsInvalidCharacter = "ContainsInvalidCharacter",
}

const ForbiddenTests: Record<ForbiddenTest, TestDefinition> = {
  FailedToReadFile: { id: 101, title: "Failed To Read File" },
  ExtNotInAllowList: { id: 102, title: "File Does Not Have Allowed Extension" },
  InvalidFileName: { id: 103, title: "File Name Is Blocked" },
  ContainsInvalidCharacter: { id: 104, title: "File Name Contains Invalid Character" },
} as const;

export default class CheckForbiddenFilesGenerator implements IProjectInfoGenerator {
  id: string = "FORBFILE";
  title: string = "Check Forbidden Files Generator";
  canAlwaysProcess = true;

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const packs = project.packs.map((pack) => [pack.getPackItems(), pack.type] as const);
    const templates = getWorldTemplates(project.items).map((template) => [template.items, "WorldTemplate"] as const);

    const packages = [...packs, ...templates];

    const results = await Promise.all(packages.map(([items, type]) => this.validateItemPackage(items, type)));

    return results.flat();
  }

  private async validateItemPackage(items: ProjectItem[], type: PackageType): Promise<ProjectInfoItem[]> {
    // I'm avoiding reading ("ensuring") the whole file, we just need the path, we do need to extract the extension though
    const files = items.map((item) => [item, "." + StorageUtilities.getTypeFromName(item.name)] as const);
    const fileResults = files.flatMap(([item, ext]) => this.resultsForFile(type, item, ext));

    return fileResults;
  }

  private resultsForFile(type: PackageType, item: ProjectItem, ext: string) {
    const results = [];

    const allowedExts = AllowedExtensionsByType[type];
    const isFolder = item.projectPath?.endsWith("/");
    if (!isFolder && allowedExts !== "*" && !allowedExts.has(ext)) {
      results.push(resultFromTest(ForbiddenTests.ExtNotInAllowList, { id: this.id, item, data: ext }));
    }

    if (BlockedFilesByType[type].has(item.name)) {
      results.push(resultFromTest(ForbiddenTests.InvalidFileName, { id: this.id, item }));
    }

    if (item.projectPath?.includes("$")) {
      results.push(resultFromTest(ForbiddenTests.ContainsInvalidCharacter, { id: this.id, item }));
    }

    return results;
  }

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    const title = ProjectInfoUtilities.getGeneralTopicTitle(topicId) || getTestTitleById(ForbiddenTests, topicId);
    return { title };
  }
  summarize() {}
}
