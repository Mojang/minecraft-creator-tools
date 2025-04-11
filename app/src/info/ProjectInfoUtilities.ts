import Project from "../app/Project";
import ProjectUtilities from "../app/ProjectUtilities";
import Utilities from "../core/Utilities";
import { ProjectInfoSuite } from "./IProjectInfoData";
import IProjectMetaState from "./IProjectMetaState";
import ProjectInfoSet from "./ProjectInfoSet";

export default class ProjectInfoUtilities {
  static getTitleFromEnum(categoryEnum: { [name: number]: string }, topicId: number) {
    if (categoryEnum[topicId]) {
      return Utilities.humanifyJsName(categoryEnum[topicId]);
    }

    if (topicId === 0) {
      return "Test Failure";
    } else if (topicId === 1) {
      return "Test Success";
    } else if (topicId === 2) {
      return "Test Not Applicable";
    }

    return "General Item " + topicId;
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
