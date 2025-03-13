import { IAnnotatedValue } from "../core/AnnotatedValue";
import { AnnotationCategory } from "../core/ContentIndex";
import ISimpleReference from "../core/ISimpleReference";
import Utilities from "../core/Utilities";
import Database from "../minecraft/Database";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";

export default class LookupUtilities {
  static blockTypeRefs: ISimpleReference[] | undefined = undefined;
  static entityTypeRefs: ISimpleReference[] | undefined = undefined;
  static itemTypeRefs: ISimpleReference[] | undefined = undefined;

  static async getLookup(lookupId: string): Promise<ISimpleReference[] | undefined> {
    switch (lookupId) {
      case "blockType":
        return await this.getBlockTypeReferences();

      case "entityType":
        return await this.getEntityTypeReferences();

      case "itemType":
        return await this.getItemTypeReferences();

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
            iconImage: iconImage ? "/res/latest/van/preview/resource_pack/" + iconImage + ".png" : undefined,
          });
        }
      }
    }

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

  static getReferencesFromAnnotatedValues(
    paths: { [name: string]: IAnnotatedValue[] } | undefined,
    annotationCategory?: AnnotationCategory,
    description?: string
  ) {
    if (!paths) {
      return undefined;
    }

    let simpleRefs: ISimpleReference[] = [];

    for (const path in paths) {
      const val = paths[path];

      if (path && val) {
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
