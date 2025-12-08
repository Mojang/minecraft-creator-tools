import IProjectItemSeed, { ProjectItemSeedAction } from "../app/IProjectItemSeed";
import { FolderContext } from "../app/Project";
import ProjectUtilities from "../app/ProjectUtilities";
import { Project } from "../index.lib";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import ProjectEditorUtilities from "./ProjectEditorUtilities";

export default class ProjectWebUtilities {
  static async processItemSeed(project: Project, itemSeed: IProjectItemSeed): Promise<boolean> {
    const fileSource = itemSeed.fileSource;

    if (fileSource) {
      let content = undefined;

      if (StorageUtilities.getEncodingByFileName(fileSource.name) === EncodingType.Utf8String) {
        content = await fileSource.text();
      } else {
        content = new Uint8Array(await fileSource.arrayBuffer());
      }

      if (itemSeed.action === ProjectItemSeedAction.defaultAction) {
        ProjectEditorUtilities.integrateBrowserFileDefaultAction(project, "/" + fileSource.name, fileSource);
      } else if (itemSeed.action === ProjectItemSeedAction.overwriteFile) {
        let path = itemSeed.replacePath;

        if (path) {
          path = StorageUtilities.getFolderPath(path);

          if (path.startsWith("/resource_pack/")) {
            // standard for vanilla bedrock_samples to start with resource_pack or behavior_pack
            let subPath = path.substring("/resource_pack".length);

            const defaultResourcePack = await project.ensureDefaultResourcePackFolder();
            const itemType = ProjectUtilities.inferJsonProjectItemTypeFromPath(
              StorageUtilities.ensureEndsWithDelimiter(path) + fileSource.name
            );
            const folder = defaultResourcePack.ensureFolder(subPath);

            const file = folder.ensureFile(fileSource.name);

            file.setContentIfSemanticallyDifferent(content);

            project.ensureItemFromFile(file, itemType, FolderContext.resourcePack);
          } else if (path.startsWith("/behavior_pack")) {
            let subPath = path.substring("/behavior_pack/".length);

            const defaultBehaviorPack = await project.ensureDefaultBehaviorPackFolder();
            const itemType = ProjectUtilities.inferJsonProjectItemTypeFromPath(
              StorageUtilities.ensureEndsWithDelimiter(path) + fileSource.name
            );
            const folder = defaultBehaviorPack.ensureFolder(subPath);

            const file = folder.ensureFile(fileSource.name);

            file.setContentIfSemanticallyDifferent(content);

            project.ensureItemFromFile(file, itemType, FolderContext.behaviorPack);
          }
        }
      } else if (itemSeed.action === ProjectItemSeedAction.overrwriteVanillaPath) {
        const item = itemSeed.targetedItem;

        if (item && item.primaryFile) {
          item.primaryFile.setContentIfSemanticallyDifferent(content);
        }
        return true;
      } else if (itemSeed.action === ProjectItemSeedAction.fileOrFolder) {
        const folder = itemSeed.folder;
        let name = itemSeed.name;

        if (name === undefined) {
          name = itemSeed.fileSource?.name;
        }

        if (folder && name) {
          const file = folder.ensureFile(name);
          let content = undefined;

          if (StorageUtilities.getEncodingByFileName(fileSource.name) === EncodingType.Utf8String) {
            content = await fileSource.text();
          } else {
            content = new Uint8Array(await fileSource.arrayBuffer());
          }

          file.setContentIfSemanticallyDifferent(content);

          await project.inferProjectItemsFromFiles();
        }

        return true;
      }
    }
    return false;
  }
}
