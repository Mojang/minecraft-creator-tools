import Project from "../../../app/Project";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import ProjectInfoItem from "../../ProjectInfoItem";
import { resultFromTest } from "../../tests/TestDefinition";
import { CheckIntegrityTest, CheckIntegrityTests } from "./CheckProjectIntegrityData";

const MaxOrphanFileResults = 5;

/**
 * Validates project structure integrity including orphaned files and nested manifests.
 *
 * @see {@link ../../../../public/data/forms/mctoolsval/prjint.form.json} for topic definitions
 */
export default class CheckProjectIntegrityGenerator implements IProjectInfoGenerator {
  id: string = "PRJINT";
  title: string = "Project Integrity";
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

  summarize() {}
}

// Re-export for use by tests and other consumers
export { CheckIntegrityTest };
