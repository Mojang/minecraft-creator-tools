// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import ProjectInfoItem from "../../ProjectInfoItem";
import { ProjectItemType } from "../../../app/IProjectItemData";
import { InfoItemType } from "../../IInfoItemData";
import IProjectInfoGenerator from "../../IProjectInfoGenerator";
import Project from "../../../app/Project";
import Pack from "../../../minecraft/Pack";
import ContentIndex from "../../../core/ContentIndex";
import ProjectItemUtilities from "../../../app/ProjectItemUtilities";
import ProjectItem from "../../../app/ProjectItem";
import TextureDefinition from "../../../minecraft/TextureDefinition";
import StorageUtilities from "../../../storage/StorageUtilities";
import { CheckTextureListGeneratorTest, TextureListValidationRules } from "./CheckTextureListData";
import { IValidationRuleProvider, ValidationRuleDefinition } from "../../tests/ValidationRuleDefinition";

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
export default class CheckTextureListGenerator implements IProjectInfoGenerator, IValidationRuleProvider {
  id = "TEXTURELIST";
  title = "Texture List Validation";

  readonly validationRules: readonly ValidationRuleDefinition[] = TextureListValidationRules;

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

  /**
   * Finds the pack a texture belongs to and its path within that pack. A texture that exists only
   * in subpacks has no default file, so its pack and path come from a variant file, with the
   * `subpacks/<name>/` prefix removed (the path it overrides in the pack). Items rebuilt from saved
   * project data can name files that were since deleted, so only available files (see
   * StorageUtilities.isFileAvailable) give a location.
   */
  static async getTextureLocation(
    project: Project,
    projectItem: ProjectItem
  ): Promise<{ pack: Pack; path: string } | undefined> {
    const pack = await projectItem.getPack();
    const packRelativePath = pack ? await projectItem.getPackRelativePath() : undefined;
    const defaultFile = projectItem.defaultFile;

    if (pack && packRelativePath && (!defaultFile || (await StorageUtilities.isFileAvailable(defaultFile)))) {
      return { pack, path: packRelativePath };
    }

    await project.ensurePacks();

    for (const file of await projectItem.ensureAllFiles()) {
      if (!(await StorageUtilities.isFileAvailable(file))) {
        continue;
      }

      for (const candidatePack of project.packs) {
        const path = StorageUtilities.getBaseRelativePath(file, candidatePack.folder);

        if (path && file.getFolderRelativePath(candidatePack.folder) !== undefined) {
          return { pack: candidatePack, path };
        }
      }
    }

    return undefined;
  }

  async generate(project: Project, _contentIndex: ContentIndex): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    const textureListItems = project.getItemsByType(ProjectItemType.textureListJson);

    // Only run when a texture_list.json is supplied; otherwise skip silently.
    if (textureListItems.length === 0) {
      return items;
    }

    // texture_list.json only describes the pack it ships in, so entries are tracked per pack
    // and only textures in a pack that has a texture_list.json are checked. Without this,
    // a list in one resource pack flags every image in other packs (including skin packs).
    const referencedPathsByPack = new Map<Pack, Set<string>>();

    for (const textureListItem of textureListItems) {
      if (!textureListItem.isContentLoaded) {
        await textureListItem.loadContent();
      }

      const pack = await textureListItem.getPack();

      if (!pack) {
        continue;
      }

      let packPaths = referencedPathsByPack.get(pack);

      if (!packPaths) {
        packPaths = new Set<string>();
        referencedPathsByPack.set(pack, packPaths);
      }

      const json = await textureListItem.getJsonObject();

      if (Array.isArray(json)) {
        for (const entry of json) {
          if (typeof entry === "string") {
            packPaths.add(CheckTextureListGenerator.normalizeTexturePath(entry));
          }
        }
      }
    }

    const textureItems = project.getItemsByType(ProjectItemType.texture);

    // Paths of images that belong to a texture_set.json — these must NOT appear in texture_list.json.
    const textureSetImagePathsByPack = new Map<Pack, Set<string>>();

    for (const projectItem of textureItems) {
      if (!projectItem.isContentLoaded) {
        await projectItem.loadContent();
      }

      const location = await CheckTextureListGenerator.getTextureLocation(project, projectItem);
      const pack = location?.pack;
      const referencedPaths = pack ? referencedPathsByPack.get(pack) : undefined;

      if (!location || !pack || !referencedPaths) {
        continue;
      }

      const normalizedPath = CheckTextureListGenerator.normalizeTexturePath(location.path);

      // Images that are part of a texture_set.json are tracked for rule #3 below and are
      // not subject to the "must be listed" rule.
      if (ProjectItemUtilities.isTextureSetTexture(projectItem)) {
        let packSetPaths = textureSetImagePathsByPack.get(pack);

        if (!packSetPaths) {
          packSetPaths = new Set<string>();
          textureSetImagePathsByPack.set(pack, packSetPaths);
        }

        packSetPaths.add(normalizedPath);
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
    for (const [pack, referencedPaths] of referencedPathsByPack) {
      const textureSetImagePaths = textureSetImagePathsByPack.get(pack);

      if (!textureSetImagePaths) {
        continue;
      }

      for (const referencedPath of referencedPaths) {
        if (!textureSetImagePaths.has(referencedPath)) {
          continue;
        }

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
