import EntityTypeDefinition from "../minecraft/EntityTypeDefinition";
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
      if (item.itemType === ProjectItemType.entityTypeBehaviorJson) {
        await item.ensureStorage();

        if (item.file) {
          const entityTypeBehavior = await EntityTypeDefinition.ensureOnFile(item.file);

          if (entityTypeBehavior) {
            entityTypeBehavior.addChildItems(project, item);
          }
        }
      }
    }
  }
}
