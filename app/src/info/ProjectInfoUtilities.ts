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
