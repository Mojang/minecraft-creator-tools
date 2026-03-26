// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * WebCompletionBridge — Bridges langcore completion interfaces with web platform
 *
 * Provides concrete implementations of IContentIndexProvider and IVanillaDataProvider
 * that wrap ContentIndex (from Project.indevInfoSet) and Database.*Metadata() calls
 * for use in the Monaco-based JSON editor.
 *
 * RELATED FILES:
 * - langcore/json/CrossReferenceCompletionSource.ts — The shared completion logic
 * - MinecraftCompletionProvider.ts — Uses this bridge to provide completions
 * - ContentIndex.ts — The trie data structure being queried
 * - Database.ts — Source of vanilla metadata
 *
 * Last updated: February 2026
 */

import Project from "../../app/Project";
import Database from "../../minecraft/Database";
import {
  IContentIndexProvider,
  IVanillaDataProvider,
  CrossReferenceCompletionSource,
  ICrossReferenceCompletionSource,
} from "../../langcore/json/CrossReferenceCompletionSource";
import { AnnotationCategory } from "../../core/ContentIndex";
import Log from "../../core/Log";

/**
 * Provides indexed content from a Project's ContentIndex.
 */
class WebContentIndexProvider implements IContentIndexProvider {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  getAllWithAnnotation(annotationChars: string[]): { [key: string]: string[] } {
    const result: { [key: string]: string[] } = {};

    const infoSet = this.project.indevInfoSet;
    if (!infoSet || !infoSet.completedGeneration) {
      return result;
    }

    // Convert string chars to AnnotationCategory enum values
    const annotations: AnnotationCategory[] = [];
    for (const char of annotationChars) {
      // Find the matching AnnotationCategory by value
      for (const key in AnnotationCategory) {
        if ((AnnotationCategory as any)[key] === char) {
          annotations.push(char as AnnotationCategory);
          break;
        }
      }
    }

    if (annotations.length === 0) {
      return result;
    }

    const indexed = infoSet.contentIndex.getAll(annotations);

    for (const key in indexed) {
      const values = indexed[key];
      if (values) {
        result[key] = values.map((v) => v.value || "");
      }
    }

    return result;
  }

  isReady(): boolean {
    return this.project.indevInfoSet?.completedGeneration === true;
  }
}

/**
 * Provides vanilla Minecraft content identifiers from Database metadata.
 */
class WebVanillaDataProvider implements IVanillaDataProvider {
  async getVanillaEntities(): Promise<string[]> {
    try {
      const metadata = await Database.getEntitiesMetadata();
      if (metadata && metadata.data_items) {
        return metadata.data_items.map((item: any) => item.name);
      }
    } catch (e) {
      Log.debug(`Failed to load vanilla entities metadata: ${e}`);
    }
    return [];
  }

  async getVanillaBlocks(): Promise<string[]> {
    try {
      const metadata = await Database.getBlocksMetadata();
      if (metadata && metadata.data_items) {
        return metadata.data_items.map((item: any) => item.name);
      }
    } catch (e) {
      Log.debug(`Failed to load vanilla blocks metadata: ${e}`);
    }
    return [];
  }

  async getVanillaItems(): Promise<string[]> {
    try {
      const metadata = await Database.getItemsMetadata();
      if (metadata && metadata.data_items) {
        return metadata.data_items.map((item: any) => item.name);
      }
    } catch (e) {
      Log.debug(`Failed to load vanilla items metadata: ${e}`);
    }
    return [];
  }

  async getVanillaBiomes(): Promise<string[]> {
    try {
      const metadata = await Database.getBiomesMetadata();
      if (metadata && (metadata as any).data_items) {
        return (metadata as any).data_items.map((item: any) => item.name);
      }
    } catch (e) {
      Log.debug(`Failed to load vanilla biomes metadata: ${e}`);
    }
    return [];
  }
}

// Singleton vanilla provider (vanilla data is global)
let vanillaProvider: WebVanillaDataProvider | undefined;

/**
 * Creates a CrossReferenceCompletionSource for a given project.
 * Reuses the singleton vanilla provider.
 */
export function createWebCompletionSource(project: Project): ICrossReferenceCompletionSource {
  if (!vanillaProvider) {
    vanillaProvider = new WebVanillaDataProvider();
  }

  const contentProvider = new WebContentIndexProvider(project);
  return new CrossReferenceCompletionSource(contentProvider, vanillaProvider);
}
