import Database from "../minecraft/Database";
import { ProjectItemVariantType } from "./IProjectItemVariant";
import IProjectItemVariantSeed from "./IProjectItemVariantSeed";
import ProjectItem from "./ProjectItem";

export default class ProjectItemVariantCreateManager {
  static async createVariant(projectItem: ProjectItem, itemSeed: IProjectItemVariantSeed) {
    let content: Uint8Array | string | undefined;
    let variantStyle = ProjectItemVariantType.versionSlice;

    if (!projectItem.primaryFile || !projectItem.projectPath) {
      return;
    }

    let label = itemSeed.label;

    if (!label) {
      label = await Database.getNextMinecraftPreviewVersion();
    }

    if (!label) {
      return;
    }

    const path = await ProjectItemVariantCreateManager.getTargetFolderPath(projectItem, variantStyle, label);

    if (!path) {
      return;
    }

    if (itemSeed.basedOn) {
      const contentFile = projectItem.getFile(itemSeed.basedOn);

      if (contentFile) {
        await contentFile.loadContent();

        if (contentFile.content) {
          content = contentFile.content;
        }
      }
    }

    if (projectItem.project.projectFolder) {
      const variantFile = await projectItem.project.projectFolder.ensureFileFromRelativePath(path);

      if (content !== undefined) {
        variantFile.setContent(content);

        const newVariant = projectItem.ensureVariant(label);

        newVariant.variantType = variantStyle;
        newVariant.projectPath = projectItem.projectPath;

        newVariant.setFile(variantFile);
      }
    }
  }

  static async getTargetFolderPath(
    projectItem: ProjectItem,
    variantStyle: ProjectItemVariantType,
    variantLabel: string
  ) {
    const projectPath = projectItem.projectPath;

    if (!projectPath) {
      return undefined;
    }

    const projectPathLower = projectPath.toLowerCase();

    if (variantStyle === ProjectItemVariantType.versionSlice) {
      const packsRoot = projectPathLower.indexOf("_packs/");
      if (packsRoot >= 0) {
        const packFolderNameEnd = projectPathLower.indexOf("/", packsRoot + 7);

        if (packFolderNameEnd > 0) {
          let packFolderName = projectPath.substring(packsRoot + 7, packFolderNameEnd);

          const lastUnderscore = packFolderName.lastIndexOf("_");
          if (lastUnderscore > 0) {
            packFolderName = packFolderName.substring(lastUnderscore);
          }

          return (
            projectPath.substring(0, packsRoot + 7) +
            packFolderName +
            "_" +
            variantLabel +
            projectPath.substring(packFolderNameEnd)
          );
        }
      }
    }

    return undefined;
  }
}
