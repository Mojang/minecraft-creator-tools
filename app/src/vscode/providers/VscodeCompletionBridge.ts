// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * VscodeCompletionBridge — Bridges langcore completion interfaces with VS Code platform
 *
 * Provides concrete implementations of IContentIndexProvider and IVanillaDataProvider
 * that wrap ContentIndex (from Project.indevInfoSet) and Database.*Metadata() calls
 * for use in the VS Code JSON completion provider.
 *
 * NOTE: In VS Code, info generation is not always pre-triggered. The IContentIndexProvider
 * implementation will lazily trigger info generation when first queried and report
 * isReady()=false until it completes. The CrossReferenceCompletionSource handles
 * this by returning project items only when the index is ready, while vanilla items
 * are always available.
 *
 * RELATED FILES:
 * - langcore/json/CrossReferenceCompletionSource.ts — The shared completion logic
 * - McCompletionProvider.ts — Uses this bridge to provide completions
 * - ContentIndex.ts — The trie data structure being queried
 * - Database.ts — Source of vanilla metadata
 * - UX/JsonEditorEnhanced/WebCompletionBridge.ts — Equivalent for Monaco/web
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
 * Provides indexed content from a Project's ContentIndex in VS Code context.
 *
 * On first query, triggers info generation if not already running.
 * Subsequent queries return results once generation completes.
 */
class VscodeContentIndexProvider implements IContentIndexProvider {
  private project: Project;
  private generationTriggered = false;

  constructor(project: Project) {
    this.project = project;
  }

  getAllWithAnnotation(annotationChars: string[]): { [key: string]: string[] } {
    const result: { [key: string]: string[] } = {};

    const infoSet = this.project.indevInfoSet;
    if (!infoSet || !infoSet.completedGeneration) {
      // Trigger info generation lazily on first access
      if (!this.generationTriggered) {
        this.generationTriggered = true;
        Log.debug("[VscodeCompletionBridge] Triggering info generation for cross-reference index...");
        infoSet.generateForProject().catch((e) => {
          Log.debug(`[VscodeCompletionBridge] Info generation failed: ${e}`);
        });
      }
      return result;
    }

    // Convert string chars to AnnotationCategory enum values
    const annotations: AnnotationCategory[] = [];
    for (const char of annotationChars) {
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
 * Same implementation as WebVanillaDataProvider — Database access is identical
 * in both web and VS Code environments.
 */
class VscodeVanillaDataProvider implements IVanillaDataProvider {
  async getVanillaEntities(): Promise<string[]> {
    try {
      const metadata = await Database.getEntitiesMetadata();
      if (metadata && metadata.data_items) {
        return metadata.data_items.map((item: any) => item.name);
      }
    } catch (e) {
      Log.debug(`[VscodeCompletionBridge] Failed to load vanilla entities metadata: ${e}`);
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
      Log.debug(`[VscodeCompletionBridge] Failed to load vanilla blocks metadata: ${e}`);
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
      Log.debug(`[VscodeCompletionBridge] Failed to load vanilla items metadata: ${e}`);
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
      Log.debug(`[VscodeCompletionBridge] Failed to load vanilla biomes metadata: ${e}`);
    }
    return [];
  }
}

// Singleton vanilla provider (vanilla data is global)
let vanillaProvider: VscodeVanillaDataProvider | undefined;

/**
 * Creates a CrossReferenceCompletionSource for a given project in VS Code context.
 * Lazily triggers info generation when the content index is first queried.
 * Reuses the singleton vanilla provider.
 */
export function createVscodeCompletionSource(project: Project): ICrossReferenceCompletionSource {
  if (!vanillaProvider) {
    vanillaProvider = new VscodeVanillaDataProvider();
  }

  const contentProvider = new VscodeContentIndexProvider(project);
  return new CrossReferenceCompletionSource(contentProvider, vanillaProvider);
}
