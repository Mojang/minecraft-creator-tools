import Project from "../../app/Project";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import ProjectInfoItem from "../ProjectInfoItem";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import { getTestTitleById, resultFromTest, TestDefinition } from "../tests/TestDefinition";

const MaxOrphanFileResults = 5;

enum CheckIntegrityTest {
  OrphanedFile = "OrphanedFile",
  UnexpectedManifest = "UnexpectedManifest",
}

const CheckIntegrityTests: Record<CheckIntegrityTest, TestDefinition> = {
  OrphanedFile: {
    id: 101,
    title: "Extraneous Files Or Folder",
    defaultMessage: "Project contains extraneous file or folder",
  },
  UnexpectedManifest: {
    id: 102,
    title: "Unexpected Manifest Structure",
    defaultMessage: "Pack has an unexpected structure, multiple manifests detected. Nested manifests are not allowed.",
  },
};

export default class CheckProjectIntegrityGenerator implements IProjectInfoGenerator {
  id: string = "PRJINT";
  title: string = "Check Project Integrity Generator";
  canAlwaysProcess = true;

  generate(project: Project): Promise<ProjectInfoItem[]> {
    const orphanResults = this.checkOrphanedFiles(project);
    const manifestResults = this.checkNestedManifests(project);

    const results = [...orphanResults, ...manifestResults];
    return Promise.resolve(results);
  }

  private checkOrphanedFiles(project: Project) {
    //limit items to avoid spam, then get results
    const results = project.unknownFiles
      .slice(0, MaxOrphanFileResults)
      .map((file) => resultFromTest(CheckIntegrityTests.OrphanedFile, { id: this.id, data: file.extendedPath }));

    return results;
  }

  private checkNestedManifests(project: Project): ProjectInfoItem[] {
    const results = project.packs
      // get all manifests within each pack
      .map((pack) => [pack, pack.getPackItems().filter((item) => item.name === "manifest.json")] as const)
      // more than one manifest indicates an issue
      .filter(([_pack, manifests]) => manifests.length > 1)
      // get results
      .map(([pack]) => resultFromTest(CheckIntegrityTests.UnexpectedManifest, { id: this.id, data: pack.name }));

    return results;
  }

  getTopicData(topicId: number) {
    const title = ProjectInfoUtilities.getGeneralTopicTitle(topicId) || getTestTitleById(CheckIntegrityTests, topicId);
    return { title };
  }

  summarize() {}
}
