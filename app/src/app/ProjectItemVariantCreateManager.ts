// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Log from "../core/Log";
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
      Log.debug(
        `[VariantCreate] Aborting: primaryFile=${!!projectItem.primaryFile}, projectPath=${projectItem.projectPath}`
      );
      return;
    }

    let label = itemSeed.label;

    if (!label) {
      label = await Database.getNextMinecraftPreviewVersion();
    }

    if (!label) {
      Log.debug("[VariantCreate] Aborting: no label");
      return;
    }

    Log.debug(
      `[VariantCreate] Creating variant '${label}' for '${projectItem.projectPath}', style=${variantStyle}, basedOn='${itemSeed.basedOn}'`
    );

    const path = await ProjectItemVariantCreateManager.getTargetFolderPath(projectItem, variantStyle, label);

    if (!path) {
      Log.debug(
        `[VariantCreate] Aborting: getTargetFolderPath returned undefined for style=${variantStyle}, label='${label}', projectPath='${projectItem.projectPath}'`
      );
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

    // If no content found from basedOn variant, fall back to the primary file
    if (content === undefined && projectItem.primaryFile) {
      if (!projectItem.primaryFile.isContentLoaded) {
        await projectItem.primaryFile.loadContent();
      }

      if (projectItem.primaryFile.content) {
        content = projectItem.primaryFile.content;
      }
    }

    if (projectItem.project.projectFolder) {
      const variantFile = await projectItem.project.projectFolder.ensureFileFromRelativePath(path);

      if (content !== undefined) {
        variantFile.setContent(content);
        await variantFile.saveContent();

        const newVariant = projectItem.ensureVariant(label);

        newVariant.variantType = variantStyle;
        newVariant.projectPath = path;

        newVariant.setFile(variantFile);

        Log.debug(
          `[VariantCreate] Created variant '${label}' at '${path}', ` +
            `file=${variantFile ? "yes" : "no"}, content=${content ? typeof content : "none"}, ` +
            `variant.file=${newVariant.file ? "yes" : "no"}, ` +
            `variant.projectPath=${newVariant.projectPath}`
        );

        // Ensure the file content is marked as loaded so the editor can display it immediately
        if (!variantFile.isContentLoaded) {
          await variantFile.loadContent();
        }
      } else {
        Log.debug(`[VariantCreate] No content available to create variant '${label}'`);
      }
    }
  }

  /**
   * Tries to build a variant path from a base-packs layout.
   * E.g., /base-packs/vanilla/behavior/entities/donkey.json
   *     → /base-packs/vanilla_1.26.20/behavior/entities/donkey.json
   */
  private static _tryBasePacksPath(
    projectPath: string,
    projectPathLower: string,
    variantLabel: string
  ): string | undefined {
    const basePacks = projectPathLower.indexOf("/base-packs/");
    if (basePacks >= 0) {
      const basePackNameStart = basePacks + 12; // after "/base-packs/"
      const basePackNameEnd = projectPathLower.indexOf("/", basePackNameStart);

      if (basePackNameEnd > 0) {
        const basePackName = projectPath.substring(basePackNameStart, basePackNameEnd);

        return (
          projectPath.substring(0, basePackNameStart) +
          basePackName +
          "_" +
          variantLabel +
          projectPath.substring(basePackNameEnd)
        );
      }
    }
    return undefined;
  }

  /**
   * Tries to build a variant path from a standard _packs/ layout.
   * E.g., /behavior_packs/mypack_bp/entities/donkey.json
   *     → /behavior_packs/_bp_1.26.20/entities/donkey.json
   */
  private static _tryPacksRootPath(
    projectPath: string,
    projectPathLower: string,
    variantLabel: string
  ): string | undefined {
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
    return undefined;
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
      const packsResult = ProjectItemVariantCreateManager._tryPacksRootPath(
        projectPath,
        projectPathLower,
        variantLabel
      );
      if (packsResult) return packsResult;

      const baseResult = ProjectItemVariantCreateManager._tryBasePacksPath(projectPath, projectPathLower, variantLabel);
      if (baseResult) return baseResult;
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

    // Fallback for 'general' style or when style-specific logic didn't match
    const baseResult = ProjectItemVariantCreateManager._tryBasePacksPath(projectPath, projectPathLower, variantLabel);
    if (baseResult) return baseResult;

    const packsResult = ProjectItemVariantCreateManager._tryPacksRootPath(projectPath, projectPathLower, variantLabel);
    if (packsResult) return packsResult;

    return undefined;
  }
}
