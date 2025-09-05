import Project from "../../app/Project";
import SemanticVersion from "../../core/versioning/SemanticVersion";
import IFile from "../../storage/IFile";
import StorageUtilities from "../../storage/StorageUtilities";
import IProjectInfoGenerator from "../IProjectInfoGenerator";
import { IProjectInfoTopicData } from "../IProjectInfoGeneratorBase";
import ProjectInfoItem from "../ProjectInfoItem";
import { InfoItemType } from "../IInfoItemData";
import ProjectInfoUtilities from "../ProjectInfoUtilities";
import { ProjectItemType } from "../../app/IProjectItemData";
import ProjectItem from "../../app/ProjectItem";

/* Older versions do not require a check */
const MinVersionForCheck = new SemanticVersion(1, 20, 60);
/* Used to validate that particle identifier correctly contains a namespace. */
const NamespaceRegexPattern = /^\\w{2,}:\\w+/;

enum CheckParticleIdentifier {
  FailedToReadFile = 101,
  FailedToReadVersion = 102,
  InvalidParticleIdentifier = 103,
}

/*
 * Generator for validating Particle Identifier
 *
 * Will ensure particle json files have a particle identifier with a namespace if above version 1.2.6.
 */
export default class CheckParticleIdentifierGenerator implements IProjectInfoGenerator {
  id: string = "CPARTI";
  title: string = "Check Particle Identifier Generator";
  canAlwaysProcess = true;

  private severity = InfoItemType.error;

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const results: ProjectInfoItem[] = [];

    const particleItems = project.getItemsByType(ProjectItemType.particleJson);

    for (const particleItem of particleItems) {
      if (!particleItem.isContentLoaded) {
        await particleItem.loadContent();
      }

      if (particleItem.primaryFile) {
        const packResults = await this.getResultsForFile(particleItem.primaryFile, particleItem);
        results.push(...packResults);
      }
    }

    return results;
  }

  async getResultsForFile(file: IFile, particleItem: ProjectItem): Promise<ProjectInfoItem[]> {
    const json = await StorageUtilities.getJsonObject(file);

    if (!json) {
      const message = `Failed to read file: ${file.name}`;
      return [this.createResult(CheckParticleIdentifier.FailedToReadFile, message, particleItem)];
    }

    const version = SemanticVersion.parse(json.format_version);

    if (!version) {
      const message = `'format_version' expected in json in file: ${file.name}`;
      return [this.createResult(CheckParticleIdentifier.FailedToReadVersion, message, particleItem)];
    }

    const checkNeeded = version.compareTo(MinVersionForCheck) >= 0;

    if (!checkNeeded) {
      return [];
    }

    const indentifier: string | undefined = json.particle_effect?.description?.identifier;

    if (!isValidParticleIdentifier(indentifier)) {
      const message = "Invalid Particle Identifier. Particle identifier requires a namespace.";
      return [this.createResult(CheckParticleIdentifier.InvalidParticleIdentifier, message, particleItem)];
    }

    return [];
  }

  private createResult(test: CheckParticleIdentifier, message: string, particleItem: ProjectItem) {
    return new ProjectInfoItem(this.severity, this.id, test, message, particleItem);
  }

  getTopicData(topicId: number): IProjectInfoTopicData | undefined {
    return {
      title: ProjectInfoUtilities.getTitleFromEnum(CheckParticleIdentifier, topicId),
    };
  }
  summarize(): void {}
}

function isValidParticleIdentifier(identifier?: string) {
  return identifier && NamespaceRegexPattern.test(identifier);
}
