// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Database from "../minecraft/Database";
import IFormDefinition from "../dataform/IFormDefinition";
import { IProjectInfoTopicData, IProjectUpdaterReference } from "./IProjectInfoGeneratorBase";
import Utilities from "../core/Utilities";

/**
 * Utility class for managing info generator topic data from form.json files.
 * Topic metadata (titles, descriptions, updaters) is stored in form.json files
 * in the public/data/forms/mctoolsval/ folder, with each generator having its own form file.
 */
export default class InfoGeneratorTopicUtilities {
  private static _topicFormsByGeneratorId: { [generatorId: string]: IFormDefinition | null | undefined } = {};
  private static _loadingPromises: { [generatorId: string]: Promise<IFormDefinition | null> } = {};

  /**
   * Gets topic data for a specific generator and topic ID from form.json files.
   * Returns undefined if no form file exists for the generator or if the topic is not found.
   * @param generatorId The ID of the generator (e.g., "CADDONREQ", "MCFUNCTION")
   * @param topicId The numeric topic ID (typically from an enum like 101, 102, etc.)
   * @returns The topic data including title and optional updaters, or undefined if not found
   */
  static async getTopicData(generatorId: string, topicId: number): Promise<IProjectInfoTopicData | undefined> {
    const form = await this.ensureFormLoaded(generatorId);

    if (!form) {
      return undefined;
    }

    return this.getTopicDataFromForm(form, topicId);
  }

  /**
   * Gets topic data synchronously from already-loaded form data.
   * Returns undefined if the form hasn't been loaded yet or if the topic is not found.
   * @param generatorId The ID of the generator
   * @param topicId The numeric topic ID
   * @returns The topic data or undefined
   */
  static getTopicDataSync(generatorId: string, topicId: number): IProjectInfoTopicData | undefined {
    const normalizedId = generatorId.toLowerCase();
    const form = this._topicFormsByGeneratorId[normalizedId];

    if (!form || form === null) {
      return undefined;
    }

    return this.getTopicDataFromForm(form, topicId);
  }

  /**
   * Extracts topic data from a form definition for a given topic ID.
   * For summary items (topicId 0 or 1), returns the form's root title/description if no specific field is found.
   */
  private static getTopicDataFromForm(form: IFormDefinition, topicId: number): IProjectInfoTopicData | undefined {
    if (!form.fields) {
      // If no fields but we have form-level title, return it for summary items
      if ((topicId === 0 || topicId === 1) && form.title) {
        return {
          title: form.title,
          description: form.description,
        };
      }
      return undefined;
    }

    const topicIdStr = topicId.toString();

    for (const field of form.fields) {
      if (field.id === topicIdStr) {
        const result: IProjectInfoTopicData = {
          title: field.title || Utilities.humanifyJsName(field.id || ""),
        };

        // Extract description, howToUse, and technicalDescription if present
        if (field.description) {
          result.description = field.description;
        }
        if (field.howToUse) {
          result.howToUse = field.howToUse;
        }
        if (field.technicalDescription) {
          result.technicalDescription = field.technicalDescription;
        }
        // Extract suggestedLineToken for diagnostic line location hints
        if (field.suggestedLineToken) {
          result.suggestedLineToken = field.suggestedLineToken;
        }
        // Extract suggestedLineShouldHaveData for data-based line matching
        if (field.suggestedLineShouldHaveData) {
          result.suggestedLineShouldHaveData = field.suggestedLineShouldHaveData;
        }

        // Extract updaters from field metadata if present
        if (field.matchedValues && Array.isArray(field.matchedValues)) {
          const updaters: IProjectUpdaterReference[] = [];
          for (const val of field.matchedValues) {
            if (val && typeof val === "object" && "updaterId" in val) {
              updaters.push(val as IProjectUpdaterReference);
            }
          }
          if (updaters.length > 0) {
            result.updaters = updaters;
          }
        }

        return result;
      }
    }

    // For summary items (topicId 0 or 1 - fail/success), return the form's root title if available
    if ((topicId === 0 || topicId === 1) && form.title) {
      return {
        title: form.title,
        description: form.description,
      };
    }

    return undefined;
  }

  /**
   * Ensures that the form.json file for a generator is loaded.
   * @param generatorId The ID of the generator
   * @returns The form definition or undefined if not found
   */
  static async ensureFormLoaded(generatorId: string): Promise<IFormDefinition | undefined> {
    const normalizedId = generatorId.toLowerCase();

    // Check if already loaded (null means "checked and not found")
    if (normalizedId in this._topicFormsByGeneratorId) {
      return this._topicFormsByGeneratorId[normalizedId] ?? undefined;
    }

    // Check if currently loading
    const loadingPromise = this._loadingPromises[normalizedId];
    if (loadingPromise) {
      const result = await loadingPromise;
      return result ?? undefined;
    }

    // Start loading
    this._loadingPromises[normalizedId] = this.loadForm(normalizedId);

    const form = await this._loadingPromises[normalizedId];
    // Cache result: store null for missing forms to avoid re-fetching
    this._topicFormsByGeneratorId[normalizedId] = form ?? null;

    delete this._loadingPromises[normalizedId];

    return form ?? undefined;
  }

  /**
   * Loads a form.json file for a generator.
   */
  private static async loadForm(generatorId: string): Promise<IFormDefinition | null> {
    try {
      const form = await Database.ensureFormLoaded("mctoolsval", generatorId);
      return form ?? null;
    } catch {
      // Form file doesn't exist for this generator - that's OK
      return null;
    }
  }

  /**
   * Checks if a form is loaded for a generator.
   */
  static isFormLoaded(generatorId: string): boolean {
    return this._topicFormsByGeneratorId[generatorId.toLowerCase()] !== undefined;
  }

  /**
   * Preloads forms for all known generators.
   * This can be called at startup to ensure all forms are available synchronously later.
   */
  static async preloadAllForms(generatorIds: string[]): Promise<void> {
    const loadPromises = generatorIds.map((id) => this.ensureFormLoaded(id));
    await Promise.all(loadPromises);
  }

  /**
   * Clears all cached forms. Useful for testing or hot-reloading.
   */
  static clearCache(): void {
    this._topicFormsByGeneratorId = {};
    this._loadingPromises = {};
  }
}
