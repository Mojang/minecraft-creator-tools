import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
import EntityTypeResourceDefinition from "../minecraft/EntityTypeResourceDefinition";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";

export default class ProjectItemRelations {
  static async calculate(project: Project) {
    const items = project.getItemsCopy();

    // clear all existing relations
    for (const item of items) {
      item.childItems = undefined;
      item.parentItems = undefined;
    }

    for (const item of items) {
      if (item.itemType === ProjectItemType.entityTypeBehavior) {
        await item.ensureStorage();

        if (item.file) {
          const entityTypeBehavior = await EntityTypeDefinition.ensureOnFile(item.file);

          if (entityTypeBehavior) {
            entityTypeBehavior.addChildItems(project, item);
          }
        }
      } else if (item.itemType === ProjectItemType.entityTypeResource) {
        await item.ensureStorage();

        if (item.file) {
          const entityTypeResource = await EntityTypeResourceDefinition.ensureOnFile(item.file);

          if (entityTypeResource) {
            entityTypeResource.addChildItems(project, item);
          }
        }
      }
    }
  }
}
