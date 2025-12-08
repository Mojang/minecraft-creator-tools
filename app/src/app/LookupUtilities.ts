import { IAnnotatedValue } from "../core/AnnotatedValue";
import { AnnotationCategory } from "../core/ContentIndex";
import ISimpleReference from "../dataform/ISimpleReference";
import Utilities from "../core/Utilities";
import VanillaProjectManager from "../minecraft/VanillaProjectManager";
import Database from "../minecraft/Database";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

export default class LookupUtilities {
  static blockTypeRefs: ISimpleReference[] | undefined = undefined;
  static entityTypeRefs: ISimpleReference[] | undefined = undefined;
  static itemTypeRefs: ISimpleReference[] | undefined = undefined;
  static soundDefRefs: ISimpleReference[] | undefined = undefined;
  static terrainTextureRefs: ISimpleReference[] | undefined = undefined;
  static itemTextureRefs: ISimpleReference[] | undefined = undefined;

  static async getLookup(lookupId: string): Promise<ISimpleReference[] | undefined> {
    switch (lookupId) {
      case "blockType":
        return await this.getBlockTypeReferences();

      case "entityType":
        return await this.getEntityTypeReferences();

      case "itemType":
        return await this.getItemTypeReferences();

      case "soundDefinition":
        return await this.getSoundDefinitionReferences();

      case "terrainTexture":
        return await this.getTerrainTextureReferences();

      case "entityTypeEvents":
        break;

      case "difficulty":
        break;

      case "damageCause":
        break;

      case "lootTable":
        break;

      case "entityTypePlusVariants":
        break;
    }

    return undefined;
  }

  static async getSoundDefinitionReferences() {
    if (this.soundDefRefs) {
      return this.soundDefRefs;
    }

    const soundData = await VanillaProjectManager.getSoundDefinitionCatalog();

    const refs: ISimpleReference[] = [];

    if (soundData) {
      const soundSets = soundData.getSoundDefinitionSetNameList();

      if (soundSets) {
        for (const soundSet of soundSets) {
          refs.push({
            id: soundSet,
            title: Utilities.humanifyMinecraftName(soundSet),
          });
        }
      }
    }

    LookupUtilities.sortReferences(refs);

    this.soundDefRefs = refs;

    return this.soundDefRefs;
  }

  static async getItemTextureReferences() {
    if (this.itemTextureRefs) {
      return this.itemTextureRefs;
    }

    const itemData = await VanillaProjectManager.getItemTexturesCatalog();

    const refs: ISimpleReference[] = [];

    if (itemData) {
      const textureRefs = itemData.getTextureReferences();

      if (textureRefs) {
        for (const textureRef of textureRefs) {
          refs.push({
            id: textureRef,
            title: Utilities.humanifyMinecraftName(textureRef),
          });
        }
      }
    }

    LookupUtilities.sortReferences(refs);

    this.itemTextureRefs = refs;

    return this.itemTextureRefs;
  }

  static async getTerrainTextureReferences() {
    if (this.terrainTextureRefs) {
      return this.terrainTextureRefs;
    }

    const terrainData = await VanillaProjectManager.getTerrainTexturesCatalog();

    const refs: ISimpleReference[] = [];

    if (terrainData) {
      const textureRefs = terrainData.getTextureReferences();

      if (textureRefs) {
        for (const textureRef of textureRefs) {
          refs.push({
            id: textureRef,
            title: Utilities.humanifyMinecraftName(textureRef),
          });
        }
      }
    }

    LookupUtilities.sortReferences(refs);

    this.terrainTextureRefs = refs;

    return this.terrainTextureRefs;
  }

  static async getBlockTypeReferences() {
    if (this.blockTypeRefs) {
      return this.blockTypeRefs;
    }

    const blockData = await Database.getBlocksMetadata();

    const refs: ISimpleReference[] = [];

    if (blockData && blockData.data_items) {
      for (const dataItem of blockData.data_items) {
        if (dataItem.name && MinecraftUtilities.isBedrockItem(dataItem.name)) {
          const iconImage = MinecraftUtilities.getBlockDefaultTexturePath(dataItem.name);

          refs.push({
            id: dataItem.name,
            title: Utilities.humanifyMinecraftName(dataItem.name),
            iconImage: iconImage ? "/res/latest/van/serve/resource_pack/" + iconImage + ".png" : undefined,
          });
        }
      }
    }

    LookupUtilities.sortReferences(refs);

    this.blockTypeRefs = refs;

    return this.blockTypeRefs;
  }

  static async getEntityTypeReferences() {
    if (this.entityTypeRefs) {
      return this.entityTypeRefs;
    }

    const entitiesData = await Database.getEntitiesMetadata();

    const refs: ISimpleReference[] = [];

    if (entitiesData && entitiesData.data_items) {
      for (const dataItem of entitiesData.data_items) {
        if (dataItem.name && MinecraftUtilities.isBedrockItem(dataItem.name)) {
          refs.push({
            id: dataItem.name,
            title: Utilities.humanifyMinecraftName(dataItem.name),
          });
        }
      }
    }

    LookupUtilities.sortReferences(refs);

    LookupUtilities.entityTypeRefs = refs;

    return LookupUtilities.entityTypeRefs;
  }

  static async getItemTypeReferences() {
    if (this.itemTypeRefs) {
      return this.itemTypeRefs;
    }

    const itemsData = await Database.getItemsMetadata();

    const refs: ISimpleReference[] = [];

    if (itemsData && itemsData.data_items) {
      for (const dataItem of itemsData.data_items) {
        if (dataItem.name && MinecraftUtilities.isBedrockItem(dataItem.name)) {
          refs.push({
            id: dataItem.name,
            title: Utilities.humanifyMinecraftName(dataItem.name),
          });
        }
      }
    }

    LookupUtilities.sortReferences(refs);

    LookupUtilities.itemTypeRefs = refs;

    return LookupUtilities.itemTypeRefs;
  }

  static appendReferences(core: ISimpleReference[], references: ISimpleReference[] | undefined) {
    if (references === undefined) {
      return;
    }

    for (const ref of references) {
      let foundRef = false;

      for (const targetRef of core) {
        if (targetRef.id === ref.id) {
          foundRef = true;
        }
      }

      if (!foundRef) {
        core.push(ref);
      }
    }
  }

  static sortReferences(references: ISimpleReference[]) {
    references.sort((a: ISimpleReference, b: ISimpleReference) => {
      if (a.title && b.title) {
        return a.title.localeCompare(b.title);
      }

      if (a.id && b.id) {
        return Utilities.staticCompare(a.id.toString(), b.id.toString());
      }

      return 0;
    });
  }

  static getReferencesFromAnnotatedValues(
    paths: { [name: string]: IAnnotatedValue[] } | undefined,
    annotationCategory?: AnnotationCategory,
    description?: string,
    startsWithFilter?: string
  ) {
    if (!paths) {
      return undefined;
    }

    let simpleRefs: ISimpleReference[] = [];

    for (let path in paths) {
      const val = paths[path];

      if (path && val && (!startsWithFilter || path.startsWith(startsWithFilter))) {
        if (startsWithFilter) {
          path = path.substring(startsWithFilter.length);
        }

        for (const annotatedVal of val) {
          if (annotatedVal.annotation === annotationCategory) {
            simpleRefs.push({
              id: path,
              title: Utilities.humanifyMinecraftName(path),
              description: description
                ? Utilities.stringFormat(description, Utilities.humanifyMinecraftName(path))
                : undefined,
            });
            continue;
          }
        }
      }
    }

    if (simpleRefs && simpleRefs.length === 0) {
      return undefined;
    }

    return simpleRefs;
  }
}
