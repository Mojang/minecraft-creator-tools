import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import Project from "./Project";

export default class ProjectDeploySync {
  private project: Project;
  private folder: IFolder;
  public constructor(project: Project, folder: IFolder) {
    this.project = project;
    this.folder = folder;
  }

  async fullIngestIntoProject() {
    if (!this.project.projectFolder) {
      return;
    }

    await StorageUtilities.syncFolderTo(this.folder, this.project.projectFolder, true, true, false);
  }
}
