// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AnnotationCategory } from "../core/ContentIndex";
import ISimpleReference from "../dataform/ISimpleReference";
import FeatureDefinition from "../minecraft/FeatureDefinition";
import { ProjectItemType } from "./IProjectItemData";
import LookupUtilities from "./LookupUtilities";
import Project from "./Project";

export default class ProjectLookupUtilities {
  static referenceCache: { [key: string]: ISimpleReference[] | undefined } = {};
  static cacheIteration: number = 0;

  static async getLookup(project: Project, lookupId: string): Promise<ISimpleReference[] | undefined> {
    switch (lookupId.toLowerCase()) {
      case "blocktype":
        return await this.getBlockTypeReferences(project);

      case "entitytype":
        return await this.getEntityTypeReferences(project);

      case "itemtype":
        return await this.getItemTypeReferences(project);

      case "entitytypeevents":
        break;

      case "difficulty":
        break;

      case "damagecause":
        break;

      case "loottable":
        break;

      case "sounddefinition":
        return await this.getSoundDefinitionReferences(project);

      case "itemtexture":
        return await this.getItemTextureReferences(project);

      case "terraintexture":
        return await this.getTerrainTextureReferences(project);

      case "feature":
        return await this.getFeatureReferences(project);

      case "entitytypeplusvariants":
        break;
    }

    return undefined;
  }

  static async getBlockTypeReferences(project: Project): Promise<ISimpleReference[] | undefined> {
    if (project.indevInfoSet.contentIndex.iteration !== ProjectLookupUtilities.cacheIteration) {
      ProjectLookupUtilities.cacheIteration = project.indevInfoSet.contentIndex.iteration;
      ProjectLookupUtilities.referenceCache = {};
    }

    if (ProjectLookupUtilities.referenceCache["blockType"]) {
      return ProjectLookupUtilities.referenceCache["blockType"];
    }

    await project.ensureIndevInfoSetGenerated();

    let simpleRefs: ISimpleReference[] = [];

    const refs = LookupUtilities.getReferencesFromAnnotatedValues(
      project.indevInfoSet.contentIndex.getAll([AnnotationCategory.blockTypeSource]),
      AnnotationCategory.blockTypeSource,
      "{0} block type from " + project.name
    );

    if (refs) {
      LookupUtilities.sortReferences(refs);

      simpleRefs = refs;
    }

    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup("blockType"));

    ProjectLookupUtilities.referenceCache["blockType"] = simpleRefs;

    return simpleRefs;
  }

  static async getEntityTypeReferences(project: Project): Promise<ISimpleReference[] | undefined> {
    if (project.indevInfoSet.contentIndex.iteration !== ProjectLookupUtilities.cacheIteration) {
      ProjectLookupUtilities.cacheIteration = project.indevInfoSet.contentIndex.iteration;
      ProjectLookupUtilities.referenceCache = {};
    }

    if (ProjectLookupUtilities.referenceCache["entityType"]) {
      return ProjectLookupUtilities.referenceCache["entityType"];
    }

    await project.ensureIndevInfoSetGenerated();

    let simpleRefs: ISimpleReference[] = [];

    const refs = LookupUtilities.getReferencesFromAnnotatedValues(
      project.indevInfoSet.contentIndex.getAll([AnnotationCategory.blockTypeSource]),
      AnnotationCategory.entityTypeSource,
      "{0} entity type from " + project.name
    );

    if (refs) {
      LookupUtilities.sortReferences(refs);

      simpleRefs = refs;
    }

    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup("entityType"));

    ProjectLookupUtilities.referenceCache["entityType"] = simpleRefs;

    return simpleRefs;
  }

  static async getItemTypeReferences(project: Project): Promise<ISimpleReference[] | undefined> {
    if (project.indevInfoSet.contentIndex.iteration !== ProjectLookupUtilities.cacheIteration) {
      ProjectLookupUtilities.cacheIteration = project.indevInfoSet.contentIndex.iteration;
      ProjectLookupUtilities.referenceCache = {};
    }

    if (ProjectLookupUtilities.referenceCache["itemType"]) {
      return ProjectLookupUtilities.referenceCache["itemType"];
    }

    await project.ensureIndevInfoSetGenerated();

    let simpleRefs: ISimpleReference[] = [];

    const refs = LookupUtilities.getReferencesFromAnnotatedValues(
      project.indevInfoSet.contentIndex.getAll([AnnotationCategory.blockTypeSource]),
      AnnotationCategory.itemTypeSource,
      "{0} item type from " + project.name
    );

    if (refs) {
      LookupUtilities.sortReferences(refs);

      simpleRefs = refs;
    }

    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup("itemType"));

    ProjectLookupUtilities.referenceCache["itemType"] = simpleRefs;

    return simpleRefs;
  }

  static async getSoundDefinitionReferences(project: Project): Promise<ISimpleReference[] | undefined> {
    if (project.indevInfoSet.contentIndex.iteration !== ProjectLookupUtilities.cacheIteration) {
      ProjectLookupUtilities.cacheIteration = project.indevInfoSet.contentIndex.iteration;
      ProjectLookupUtilities.referenceCache = {};
    }

    if (ProjectLookupUtilities.referenceCache["soundDefinition"]) {
      return ProjectLookupUtilities.referenceCache["soundDefinition"];
    }

    await project.ensureIndevInfoSetGenerated();

    let simpleRefs: ISimpleReference[] = [];

    const refs = LookupUtilities.getReferencesFromAnnotatedValues(
      project.indevInfoSet.contentIndex.getAll([AnnotationCategory.blockTypeSource]),
      AnnotationCategory.blockTypeSource,
      "{0} sound from " + project.name
    );

    if (refs) {
      LookupUtilities.sortReferences(refs);

      simpleRefs = refs;
    }

    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup("soundDefinition"));

    ProjectLookupUtilities.referenceCache["soundDefinition"] = simpleRefs;

    return simpleRefs;
  }

  static async getTerrainTextureReferences(project: Project): Promise<ISimpleReference[] | undefined> {
    if (project.indevInfoSet.contentIndex.iteration !== ProjectLookupUtilities.cacheIteration) {
      ProjectLookupUtilities.cacheIteration = project.indevInfoSet.contentIndex.iteration;
      ProjectLookupUtilities.referenceCache = {};
    }

    if (ProjectLookupUtilities.referenceCache["terrainTexture"]) {
      return ProjectLookupUtilities.referenceCache["terrainTexture"];
    }

    await project.ensureIndevInfoSetGenerated();

    let simpleRefs: ISimpleReference[] = [];

    const refs = LookupUtilities.getReferencesFromAnnotatedValues(
      project.indevInfoSet.contentIndex.getAll([AnnotationCategory.terrainTextureSource]),
      AnnotationCategory.terrainTextureSource,
      "{0} terrain texture from " + project.name
    );

    if (refs) {
      LookupUtilities.sortReferences(refs);

      simpleRefs = refs;
    }

    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup("terrainTexture"));

    ProjectLookupUtilities.referenceCache["terrainTexture"] = simpleRefs;

    return simpleRefs;
  }

  static async getItemTextureReferences(project: Project): Promise<ISimpleReference[] | undefined> {
    if (project.indevInfoSet.contentIndex.iteration !== ProjectLookupUtilities.cacheIteration) {
      ProjectLookupUtilities.cacheIteration = project.indevInfoSet.contentIndex.iteration;
      ProjectLookupUtilities.referenceCache = {};
    }

    if (ProjectLookupUtilities.referenceCache["itemTexture"]) {
      return ProjectLookupUtilities.referenceCache["itemTexture"];
    }

    await project.ensureIndevInfoSetGenerated();

    let simpleRefs: ISimpleReference[] = [];

    const refs = LookupUtilities.getReferencesFromAnnotatedValues(
      project.indevInfoSet.contentIndex.getAll([AnnotationCategory.itemTextureSource]),
      AnnotationCategory.itemTextureSource,
      "{0} item texture from " + project.name
    );

    if (refs) {
      LookupUtilities.sortReferences(refs);

      simpleRefs = refs;
    }

    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup("itemTexture"));

    ProjectLookupUtilities.referenceCache["itemTexture"] = simpleRefs;

    return simpleRefs;
  }

  static async getFeatureReferences(project: Project): Promise<ISimpleReference[] | undefined> {
    if (ProjectLookupUtilities.referenceCache["feature"]) {
      return ProjectLookupUtilities.referenceCache["feature"];
    }

    let simpleRefs: ISimpleReference[] = [];

    // Get features directly from project items
    const itemsCopy = project.getItemsCopy();

    for (const item of itemsCopy) {
      if (item.itemType === ProjectItemType.featureBehavior) {
        if (!item.isContentLoaded) {
          await item.loadContent();
        }

        if (item.primaryFile) {
          const featureDef = await FeatureDefinition.ensureOnFile(item.primaryFile);

          if (featureDef && featureDef.id) {
            simpleRefs.push({
              id: featureDef.id,
              description: featureDef.id + " feature from " + project.name,
            });
          }
        }
      }
    }

    LookupUtilities.sortReferences(simpleRefs);

    // Also append vanilla feature references
    LookupUtilities.appendReferences(simpleRefs, await LookupUtilities.getLookup("feature"));

    ProjectLookupUtilities.referenceCache["feature"] = simpleRefs;

    return simpleRefs;
  }
}
