// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ContentWriter - Writes IGeneratedContent files to a Minecraft project's packs.
 *
 * Shared utility used by both the web Content Wizard (ProjectAddButton) and the
 * CLI "add" command. Extracts the file-writing logic so it doesn't live in a
 * React component.
 *
 * Key behavior:
 * - Writes behavior pack files (entities, blocks, items, loot tables, recipes, spawn rules)
 * - Writes resource pack files (entity resources, geometries, textures, render controllers)
 * - Deep-merges singleton JSON files (terrain_texture.json, item_texture.json, blocks.json,
 *   sound_definitions.json, music_definitions.json) so that multiple generation passes
 *   accumulate entries rather than overwriting previous content
 * - Skips regular files that already exist (prevents accidental overwrites)
 *
 * @see ContentGenerator.ts for generating IGeneratedContent
 * @see ProjectAddButton.tsx for web UI integration
 * @see AddCommand.ts for CLI integration
 */

import type IFolder from "../storage/IFolder";
import type { IGeneratedContent, IGeneratedFile } from "./ContentGenerator";
import type Project from "../app/Project";
import StorageUtilities from "../storage/StorageUtilities";
import Log from "../core/Log";

/**
 * Extract the filename from a relative path like "entities/orc.json" → "orc.json".
 */
function getFilename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1];
}

/**
 * Serialize a generated file's content to a string or Uint8Array suitable for writing.
 */
function serializeContent(generatedFile: IGeneratedFile): string | Uint8Array {
  if (generatedFile.content instanceof Uint8Array) {
    return generatedFile.content;
  }
  if (typeof generatedFile.content === "string") {
    return generatedFile.content;
  }
  return JSON.stringify(generatedFile.content, null, 2);
}

/**
 * Write a list of generated files to a specific subfolder within a pack folder.
 */
function writeFilesToSubfolder(packFolder: IFolder, subfolderName: string, files: IGeneratedFile[]): void {
  if (files.length === 0) return;
  const subfolder = packFolder.ensureFolder(subfolderName);
  for (const file of files) {
    StorageUtilities.writeFileIfNew(subfolder, getFilename(file.path), serializeContent(file));
  }
}

/**
 * Write a singleton JSON file (terrain_texture.json, item_texture.json, blocks.json, etc.)
 * by deep-merging with any existing content so that previously-added entries are preserved.
 */
function writeSingletonJsonMerging(folder: IFolder, fileName: string, newContent: object): void {
  const file = folder.ensureFile(fileName);

  if (file.isContentLoaded || folder.fileExists(fileName)) {
    const existing = StorageUtilities.getJsonObject(file);
    if (existing && typeof existing === "object") {
      const merged = StorageUtilities.deepMergeJsonObjects(existing, newContent);
      file.setContent(JSON.stringify(merged, null, 2));
      return;
    }
  }

  file.setContent(JSON.stringify(newContent, null, 2));
}

export class ContentWriter {
  /**
   * Write all generated content files to a project's behavior pack and resource pack folders.
   *
   * @param project The project to write content into.
   * @param content The generated content from ContentGenerator.generate().
   */
  static async writeGeneratedContent(project: Project, content: IGeneratedContent): Promise<void> {
    const bpFolder = await project.ensureDefaultBehaviorPackFolder();
    const rpFolder = await project.ensureDefaultResourcePackFolder();

    // === Behavior Pack ===
    if (bpFolder) {
      writeFilesToSubfolder(bpFolder, "entities", content.entityBehaviors);
      writeFilesToSubfolder(bpFolder, "blocks", content.blockBehaviors);
      writeFilesToSubfolder(bpFolder, "items", content.itemBehaviors);
      writeFilesToSubfolder(bpFolder, "loot_tables", content.lootTables);
      writeFilesToSubfolder(bpFolder, "recipes", content.recipes);
      writeFilesToSubfolder(bpFolder, "spawn_rules", content.spawnRules);
    }

    // === Resource Pack ===
    if (rpFolder) {
      writeFilesToSubfolder(rpFolder, "entity", content.entityResources);

      // Render controllers
      writeFilesToSubfolder(rpFolder, "render_controllers", content.renderControllers);

      // Geometries — determine subfolder from path (e.g., "models/blocks/slab.geo.json" → "blocks")
      for (const geometryFile of content.geometries) {
        const pathParts = geometryFile.path.split("/");
        const subfolderName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : "entity";
        const modelsFolder = rpFolder.ensureFolder("models");
        const subFolder = modelsFolder.ensureFolder(subfolderName);
        StorageUtilities.writeFileIfNew(subFolder, getFilename(geometryFile.path), serializeContent(geometryFile));
      }

      // Textures — determine subfolder from path and handle binary content
      for (const textureFile of content.textures) {
        const pathParts = textureFile.path.split("/");
        const subfolderName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : "entity";

        const texturesFolder = rpFolder.ensureFolder("textures");
        const subFolder = texturesFolder.ensureFolder(subfolderName);
        const fileName = getFilename(textureFile.path);

        if (subFolder.fileExists(fileName)) {
          Log.debug(`Skipping texture "${fileName}" — file already exists`);
          continue;
        }

        const file = subFolder.ensureFile(fileName);
        if (textureFile.content instanceof Uint8Array) {
          file.setContent(textureFile.content);
        } else if (Array.isArray(textureFile.content)) {
          file.setContent(new Uint8Array(textureFile.content as number[]));
        } else if (typeof textureFile.content === "string") {
          file.setContent(textureFile.content);
        } else {
          Log.debug(`WARNING: Texture content is object, will serialize as JSON`);
          file.setContent(JSON.stringify(textureFile.content, null, 2));
        }
      }

      // terrain_texture.json — block texture atlas (merge with existing)
      if (content.terrainTextures) {
        const texturesFolder = rpFolder.ensureFolder("textures");
        writeSingletonJsonMerging(texturesFolder, "terrain_texture.json", content.terrainTextures.content as object);
      }

      // item_texture.json — item texture atlas (merge with existing)
      if (content.itemTextures) {
        const texturesFolder = rpFolder.ensureFolder("textures");
        writeSingletonJsonMerging(texturesFolder, "item_texture.json", content.itemTextures.content as object);
      }

      // blocks.json — block resource catalog (merge with existing)
      if (content.blocksCatalog) {
        writeSingletonJsonMerging(
          rpFolder,
          getFilename(content.blocksCatalog.path),
          content.blocksCatalog.content as object
        );
      }

      // sound_definitions.json (merge with existing)
      if (content.soundDefinitions) {
        writeSingletonJsonMerging(
          rpFolder,
          getFilename(content.soundDefinitions.path),
          content.soundDefinitions.content as object
        );
      }

      // music_definitions.json (merge with existing)
      if (content.musicDefinitions) {
        writeSingletonJsonMerging(
          rpFolder,
          getFilename(content.musicDefinitions.path),
          content.musicDefinitions.content as object
        );
      }

      // Additional sounds (singleton files that should be merged)
      for (const soundFile of content.sounds) {
        const pathParts = soundFile.path.split("/");
        const targetFolder = pathParts.length >= 2 ? rpFolder.ensureFolder(pathParts.slice(0, -1).join("/")) : rpFolder;
        writeSingletonJsonMerging(targetFolder, getFilename(soundFile.path), soundFile.content as object);
      }
    }

    await project.save();
  }
}
