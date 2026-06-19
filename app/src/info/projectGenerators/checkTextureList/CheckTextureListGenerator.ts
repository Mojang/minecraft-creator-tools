// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../../ProjectInfoItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import Project from "../../../app/Project";
import ContentIndex from "../../../core/ContentIndex";
import ProjectItemUtilities from "../../../app/ProjectItemUtilities";
import TextureDefinition from "../../../minecraft/TextureDefinition";
import StorageUtilities from "../../../storage/StorageUtilities";
import { CheckTextureListGeneratorTest } from "./CheckTextureListData";

export { CheckTextureListGeneratorTest };

/**
 * Validates texture_list.json against the textures actually present in a resource pack.
 *
 * texture_list.json is an optional file that enumerates every texture used by a pack.
 * When it is present, two rules apply:
 *  - Every non-Vibrant Visuals texture image in the pack must be listed (rule #2).
 *  - Images that belong to a texture_set.json (the PBR companion images such as
 *    _mer/_mers/heightmap/normal) must NOT be listed (rule #3).
 *
 * When no texture_list.json item is present, the generator skips silently.
 *
 * Path comparisons are normalized to be resilient to path separators, casing, and the
 * presence/absence of file extensions, consistent with how textures are referenced
 * elsewhere in the info generators.
 *
 * @see {@link ../../../../public/data/forms/mctoolsval/texturelist.form.json} for topic definitions
 */
export default class CheckTextureListGenerator implements IProjectInfoGenerator {
  id = "TEXTURELIST";
  title = "Texture List Validation";

  performAddOnValidations = false;

  summarize(): void {}

  /**
   * Normalizes a texture path for comparison: forward slashes, no leading delimiter,
   * lowercased, and with any known file extension removed.
   */
  static normalizeTexturePath(path: string): string {
    const forwardSlashed = StorageUtilities.ensureNotStartsWithDelimiter(path.replace(/\\/g, "/").trim());

    return TextureDefinition.canonicalizeTexturePath(forwardSlashed) ?? forwardSlashed.toLowerCase();
  }

  async generate(project: Project, _contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const textureListItems = project.getItemsByType(ProjectItemType.textureListJson);

    // Only run when a texture_list.json is supplied; otherwise skip silently.
    if (textureListItems.length === 0) {
      return items;
    }

    // Collect every texture path referenced across all texture_list.json files.
    const referencedPaths = new Set<string>();

    for (const textureListItem of textureListItems) {
      if (!textureListItem.isContentLoaded) {
        await textureListItem.loadContent();
      }

      const json = await textureListItem.getJsonObject();

      if (Array.isArray(json)) {
        for (const entry of json) {
          if (typeof entry === "string") {
            referencedPaths.add(CheckTextureListGenerator.normalizeTexturePath(entry));
          }
        }
      }
    }

    const textureItems = project.getItemsByType(ProjectItemType.texture);

    // Paths of images that belong to a texture_set.json — these must NOT appear in texture_list.json.
    const textureSetImagePaths = new Set<string>();

    for (const projectItem of textureItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      const packRelativePath = await projectItem.getPackRelativePath();

      if (!packRelativePath) {
        continue;
      }

      const normalizedPath = CheckTextureListGenerator.normalizeTexturePath(packRelativePath);

      // Images that are part of a texture_set.json are tracked for rule #3 below and are
      // not subject to the "must be listed" rule.
      if (ProjectItemUtilities.isTextureSetTexture(projectItem)) {
        textureSetImagePaths.add(normalizedPath);
        continue;
      }

      // Vibrant Visuals textures (e.g. _mer/_mers companions) are excluded from the
      // "must be listed" requirement.
      if (ProjectItemUtilities.isVibrantVisualsRelated(projectItem)) {
        continue;
      }

      // Rule #2: every non-Vibrant Visuals pack image must be referenced in texture_list.json.
      if (!referencedPaths.has(normalizedPath)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckTextureListGeneratorTest.textureNotInTextureList,
            `Texture image is not referenced in texture_list.json; all non-Vibrant Visuals pack textures must be listed. Texture`,
            projectItem,
            normalizedPath
          )
        );
      }
    }

    // Rule #3: images that belong to a texture_set.json must not be referenced in texture_list.json.
    for (const referencedPath of referencedPaths) {
      if (textureSetImagePaths.has(referencedPath)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.error,
            this.id,
            CheckTextureListGeneratorTest.textureSetImageInTextureList,
            `Texture set image must not be referenced in texture_list.json. Entry`,
            undefined,
            referencedPath
          )
        );
      }
    }

    return items;
  }
}
