import Database from "../minecraft/Database";
import { MaxVariantCounts, ProjectItemVariantType } from "./IProjectItemVariant";
import IProjectItemVariantSeed from "./IProjectItemVariantSeed";
import Project from "./Project";
import ProjectItem from "./ProjectItem";

export default class ProjectItemVariantCreateManager {
  static getPredominatingVariantType(project: Project) {
    let variantStyle = ProjectItemVariantType.versionSliceAlt;
    const variantCounts: number[] = [];
    const items = project.getItemsCopy();

    for (const item of items) {
      const variants = item.getVariantList();

      for (const pv of variants) {
        variantCounts[pv.variantType] = (variantCounts[pv.variantType] || 0) + 1;
      }
    }

    let winningVote = 0;

    for (let i = 0; i < MaxVariantCounts; i++) {
      if (variantCounts[i] > winningVote) {
        winningVote = variantCounts[i];
        variantStyle = i;
      }
    }

    return variantStyle;
  }

  static async createVariant(projectItem: ProjectItem, itemSeed: IProjectItemVariantSeed) {
    let content: Uint8Array | string | undefined;

    let variantStyle = this.getPredominatingVariantType(projectItem.project);

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
        if (!contentFile.isContentLoaded) {
          await contentFile.loadContent();
        }

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
    } else if (variantStyle === ProjectItemVariantType.versionSliceAlt) {
      const staticAssets = projectPathLower.indexOf("/static-assets/");

      if (staticAssets) {
        let packFolderName = projectPath.substring(1, staticAssets);

        const lastUnderscore = packFolderName.lastIndexOf("_");
        if (lastUnderscore > 0) {
          packFolderName = packFolderName.substring(lastUnderscore);
        }

        return "/" + packFolderName + "_" + variantLabel + projectPath.substring(staticAssets);
      }
    }
    return undefined;
  }
}
