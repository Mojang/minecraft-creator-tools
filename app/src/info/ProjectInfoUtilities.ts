import Project from "../app/Project";
import ProjectUtilities from "../app/ProjectUtilities";
import Utilities from "../core/Utilities";
import { ProjectInfoSuite } from "./IProjectInfoData";
import IProjectMetaState from "./IProjectMetaState";
import ProjectInfoSet from "./ProjectInfoSet";

export default class ProjectInfoUtilities {
  private static _generalTopicsById: Record<number, string> = {
    0: "Test Failure",
    1: "Test Success",
    2: "Test Not Applicable",
  };
  static getTitleFromEnum(categoryEnum: { [name: number]: string }, topicId: number) {
    if (categoryEnum[topicId]) {
      return Utilities.humanifyJsName(categoryEnum[topicId]);
    }

    const generalTitle = this._generalTopicsById[topicId];
    if (!!generalTitle) {
      return generalTitle;
    }

    return "General Item " + topicId;
  }

  static getGeneralTopicTitle(topicId: number) {
    return this._generalTopicsById[topicId];
  }

  static async getDerivedStates(project: Project, pisData: ProjectInfoSet) {
    const isAddon = await ProjectUtilities.getIsAddon(project);
    const derivedStates: IProjectMetaState[] = [];

    if (isAddon) {
      const pisAddon = new ProjectInfoSet(project, ProjectInfoSuite.cooperativeAddOn);

      await pisAddon.generateForProject();

      const projectSet = {
        projectContainerName: project.containerName,
        projectPath: project.projectFolder?.storageRelativePath,
        projectName: project.name,
        projectTitle: project.title,
        infoSetData: pisAddon.getDataObject(),
        suite: ProjectInfoSuite.cooperativeAddOn,
      };

      derivedStates.push(projectSet);
    }

    const pisSharing = new ProjectInfoSet(project, ProjectInfoSuite.sharing);

    await pisSharing.generateForProject();

    const sharing = {
      projectContainerName: project.containerName,
      projectPath: project.projectFolder?.storageRelativePath,
      projectName: project.name,
      projectTitle: project.title,
      infoSetData: pisSharing.getDataObject(),
      suite: ProjectInfoSuite.cooperativeAddOn,
    };

    derivedStates.push(sharing);

    const shouldRunPlatformVersion = (pisData.info as any)["CWave"] !== undefined;

    if (shouldRunPlatformVersion) {
      const pisPlatforMVersion = new ProjectInfoSet(project, ProjectInfoSuite.currentPlatformVersions);

      await pisPlatforMVersion.generateForProject();

      const projectSet = {
        projectContainerName: project.containerName,
        projectPath: project.projectFolder?.storageRelativePath,
        projectName: project.name,
        projectTitle: project.title,
        infoSetData: pisPlatforMVersion.getDataObject(),
        suite: ProjectInfoSuite.currentPlatformVersions,
      };

      derivedStates.push(projectSet);
    }

    return derivedStates;
  }
}
