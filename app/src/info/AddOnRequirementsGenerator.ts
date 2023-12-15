import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectInfoSet from "./ProjectInfoSet";
import BehaviorManifestJson from "../minecraft/BehaviorManifestJson";
import { ProjectItemType } from "../app/IProjectItemData";
import ProjectItem from "../app/ProjectItem";
import Utilities from "../core/Utilities";
import ResourceManifestJson from "../minecraft/ResourceManifestJson";

const UniqueRegEx = new RegExp(/[a-zA-Z0-9]{2,}_[a-zA-Z0-9]{2,}:[\w]+/);

const GenericTermList = [
  "abilities",
  "actions",
  "adventure",
  "animals",
  "anims",
  "armor",
  "assets",
  "attachables",
  "banners",
  "base",
  "blocks",
  "book",
  "boss",
  "bosses",
  "bridge",
  "camping",
  "cars",
  "characters",
  "chests",
  "cinema",
  "cinematics",
  "cloud",
  "collectables",
  "collectibles",
  "custom_ui",
  "cut_scene",
  "cutscene",
  "deco",
  "decor",
  "dev",
  "dialogue",
  "dinos",
  "dinosaurs",
  "doors",
  "dragon",
  "dragons",
  "dummy",
  "effects",
  "enemies",
  "enemy",
  "entities",
  "entity",
  "env",
  "equipment",
  "events",
  "food",
  "furniture",
  "furnitures",
  "fx",
  "game_menu",
  "gameplay",
  "general",
  "glow",
  "guide",
  "guidebook",
  "inanimate",
  "interface",
  "internal",
  "intro",
  "item",
  "items",
  "launchers",
  "machines",
  "magic",
  "markers",
  "market",
  "marketing_banners",
  "mastermind",
  "mechanics",
  "menu",
  "menus",
  "minigames",
  "misc",
  "miscellaneous",
  "mob",
  "mobs",
  "monsters",
  "morphs",
  "mutant",
  "neutral",
  "npc",
  "npcs",
  "objectives",
  "particles",
  "passive",
  "passive_mobs",
  "pets",
  "platform",
  "player",
  "players",
  "portal",
  "portals",
  "preset",
  "projectile",
  "projectiles",
  "properties",
  "props",
  "recipe_models",
  "scanner",
  "script",
  "security",
  "sequences",
  "sfx",
  "shop",
  "skills",
  "sounds",
  "static_entity",
  "store",
  "structure",
  "structures",
  "systems",
  "tasks",
  "teams",
  "teleporter",
  "tnt",
  "tools",
  "towers",
  "trinkets",
  "tutorial",
  "ui",
  "user_interface",
  "util",
  "utilities",
  "vanilla",
  "vanilla_mob",
  "vehicle",
  "vehicles",
  "vr",
  "weapon",
  "weapons",
  "wrench",
];

export default class AddOnRequirementsGenerator implements IProjectInfoGenerator {
  id = "ADDONREQ";
  title = "AddOn Requirements";

  getTopicData(topicId: number) {
    return { title: topicId.toString() };
  }

  async generate(project: Project): Promise<ProjectInfoItem[]> {
    const items: ProjectInfoItem[] = [];

    let behaviorPackManifest: undefined | BehaviorManifestJson = undefined;
    let behaviorPackItem: undefined | ProjectItem = undefined;
    let resourcePackManifest: undefined | ResourceManifestJson = undefined;
    let resourcePackItem: undefined | ProjectItem = undefined;

    for (const projectItem of project.items) {
      if (projectItem.file) {
        if (projectItem.itemType === ProjectItemType.behaviorPackManifestJson) {
          if (behaviorPackManifest) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.testCompleteFail,
                this.id,
                160,
                `Found more than one behavior pack manifest, which is not supported`,
                projectItem
              )
            );
          }

          behaviorPackManifest = await BehaviorManifestJson.ensureOnFile(projectItem.file);
          behaviorPackItem = projectItem;

          await behaviorPackManifest?.load();
        } else if (projectItem.itemType === ProjectItemType.resourcePackManifestJson) {
          if (resourcePackManifest) {
            items.push(
              new ProjectInfoItem(
                InfoItemType.testCompleteFail,
                this.id,
                161,
                `Found more than one resource pack manifest, which is not supported`,
                projectItem
              )
            );
          }

          resourcePackManifest = await ResourceManifestJson.ensureOnFile(projectItem.file);
          resourcePackItem = projectItem;

          await resourcePackManifest?.load();
        }
      }
    }

    if (!behaviorPackManifest || !behaviorPackManifest.definition) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          163,
          `Did not find a valid behavior pack manifest.`,
          undefined
        )
      );
    }

    if (!resourcePackManifest || !resourcePackManifest.definition) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          164,
          `Did not find a valid resource pack manifest.`,
          undefined
        )
      );
    }

    if (
      behaviorPackManifest &&
      resourcePackManifest &&
      behaviorPackManifest.definition &&
      resourcePackManifest.definition
    ) {
      if (!behaviorPackManifest.definition.dependencies || behaviorPackManifest.getNonInternalDependencyCount() !== 1) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            165,
            `Did not find exactly one dependency on the corresponding resource pack in the behavior pack manifest.`,
            behaviorPackItem,
            behaviorPackManifest.getNonInternalDependencyCount()
          )
        );
      } else if (
        !behaviorPackManifest.definition.dependencies[0].uuid ||
        !Utilities.uuidEqual(
          behaviorPackManifest.definition.dependencies[0].uuid,
          resourcePackManifest.definition.header.uuid
        )
      ) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            167,
            `Behavior pack manifest does not have a proper dependency on the resource pack identifier.`,
            behaviorPackItem
          )
        );
      }

      if (!resourcePackManifest.definition.dependencies || resourcePackManifest.definition.dependencies.length !== 1) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            168,
            `Did not find exactly one dependency on the corresponding behavior pack in the resource pack manifest.`,
            resourcePackItem
          )
        );
      } else if (
        !resourcePackManifest.definition.dependencies[0].uuid ||
        !Utilities.uuidEqual(
          resourcePackManifest.definition.dependencies[0].uuid,
          behaviorPackManifest.definition.header.uuid
        )
      ) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            169,
            `Resource pack manifest does not have a proper dependency on the behavior pack identifier.`,
            behaviorPackItem
          )
        );
      }
    }

    const bpFolder = await project.getDefaultBehaviorPackFolder();

    if (bpFolder) {
      await this.generateFromBehaviorPackFolder(project, bpFolder, items);
    }

    const rpFolder = await project.getDefaultResourcePackFolder();

    if (rpFolder) {
      await this.generateFromResourcePackFolder(project, rpFolder, items);
    }

    return items;
  }

  summarize(info: any, infoSet: ProjectInfoSet) {}

  async generateFromBehaviorPackFolder(project: Project, folder: IFolder, items: ProjectInfoItem[]) {
    await folder.load(false);

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      const folderNameCanon = StorageUtilities.canonicalizeName(folderName);

      if (folderNameCanon === "feature" || folderNameCanon === "feature_rules") {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            130,
            `Found feature or feature_rules in an add-on, which is not supported`,
            undefined
          )
        );
      }

      if (folderNameCanon === "dimensions") {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            131,
            `Found dimensions in an add-on, which is not supported`,
            undefined
          )
        );
      }

      if (childFolder && !folder.errorStatus) {
        if (folderNameCanon === "structures") {
          await this.generateFromFirstLevelFolderCreator_Game(project, childFolder, items);
        } else if (
          folderNameCanon !== "texts" &&
          folderNameCanon !== "entities" &&
          folderNameCanon !== "particles" &&
          folderNameCanon !== "items" &&
          folderNameCanon !== "scripts" &&
          folderNameCanon !== "loot_tables" &&
          folderNameCanon !== "trading" &&
          folderNameCanon !== "recipes" &&
          folderNameCanon !== "spawn_rules" &&
          folderNameCanon !== "animations" &&
          folderNameCanon !== "animation_controllers" &&
          folderNameCanon !== "render_controllers" &&
          folderNameCanon !== "blocks"
        ) {
          await this.generateFromFirstLevelFolderCreatorNameGameName(project, childFolder, items);
        }
      }
    }
  }
  async generateFromResourcePackFolder(project: Project, folder: IFolder, items: ProjectInfoItem[]) {
    await folder.load(false);

    for (const folderName in folder.folders) {
      const childFolder = folder.folders[folderName];

      const folderNameCanon = StorageUtilities.canonicalizeName(folderName);

      if (folderNameCanon === "ui") {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            133,
            `Found ui elements in an add-on, which is not supported`,
            undefined
          )
        );
      }

      if (folderNameCanon === "fogs") {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            132,
            `Found fogs in an add-on, which is not supported`,
            undefined
          )
        );
      }

      if (childFolder && !folder.errorStatus) {
        if (
          folderNameCanon !== "texts" &&
          folderNameCanon !== "entity" &&
          folderNameCanon !== "items" &&
          folderNameCanon !== "particles" &&
          folderNameCanon !== "materials" &&
          folderNameCanon !== "blocks" &&
          folderNameCanon !== "models" &&
          folderNameCanon !== "attachables" &&
          folderNameCanon !== "render_controllers" &&
          folderNameCanon !== "animation_controllers" &&
          folderNameCanon !== "animations"
        ) {
          await this.generateFromFirstLevelFolderCreatorNameGameName(project, childFolder, items);
        }
      }
    }
  }

  static isNameGenericTerm(name: string) {
    name = StorageUtilities.canonicalizeName(name);

    return GenericTermList.includes(name);
  }

  static isNamespacedString(name: string) {
    let tokens = name.split("_");

    if (tokens.length < 2) {
      return false;
    }

    return tokens[0].length > 2 && tokens[1].length > 2;
  }

  static isUniqueNamespaceOrShortName(name: string) {
    name = StorageUtilities.canonicalizeName(name);

    if (name.length < 3) {
      return false;
    }

    return UniqueRegEx.test(name);
  }
  async generateFromFirstLevelFolderCreator_Game(project: Project, folder: IFolder, items: ProjectInfoItem[]) {
    await folder.load(false);

    for (const fileName in folder.files) {
      const fileNameCanon = StorageUtilities.canonicalizeName(fileName);

      if (
        (folder.name !== "functions" || fileNameCanon !== "tick.json") &&
        (folder.name !== "textures" ||
          (fileNameCanon !== "flipbook_textures.json" &&
            fileNameCanon !== "item_texture.json" &&
            fileNameCanon !== "terrain_texture.json")) &&
        (folder.name !== "sounds" || fileNameCanon !== "sound_definitions.json")
      ) {
        const file = folder.files[fileName];

        const projectItem = file?.extendedPath ? project.getItemByExtendedOrStoragePath(file?.extendedPath) : undefined;

        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            111,
            `Found a loose file in the ${folder.name} folder. Should only see files in the folder ${folder.name}\\creatorshortname_gamename\\`,
            projectItem,
            fileName
          )
        );
      }
    }

    let folderCount = 0;
    for (const folderName in folder.folders) {
      const folderNameCanon = StorageUtilities.canonicalizeName(folderName);
      folderCount++;
      if (AddOnRequirementsGenerator.isUniqueNamespaceOrShortName(folderNameCanon)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            109,
            `Found an add-on-blocked folder '${folderName}' in a parent folder pack\\${folder.name}. Should be named 'creatorshortname' and not a common term`,
            undefined,
            folderName
          )
        );
      }
    }

    if (folderCount > 1) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          110,
          `Folder '${folder.name}' has more than one subfolder, which is not supported. There should only be one folder in pack\\${folder.name}\\<studioname>_<mygamename>`,
          undefined,
          folder.name
        )
      );
    }
  }

  async generateFromFirstLevelFolderCreatorNameGameName(project: Project, folder: IFolder, items: ProjectInfoItem[]) {
    await folder.load(false);

    for (const fileName in folder.files) {
      const fileNameCanon = StorageUtilities.canonicalizeName(fileName);

      if (
        (folder.name !== "functions" || fileNameCanon !== "tick.json") &&
        (folder.name !== "textures" ||
          (fileNameCanon !== "flipbook_textures.json" &&
            fileNameCanon !== "item_texture.json" &&
            fileNameCanon !== "terrain_texture.json")) &&
        (folder.name !== "sounds" || fileNameCanon !== "sound_definitions.json")
      ) {
        const file = folder.files[fileName];

        const projectItem = file?.extendedPath ? project.getItemByExtendedOrStoragePath(file?.extendedPath) : undefined;

        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            101,
            `Found a loose file in the ${folder.name} folder. Should only see files in the folder ${folder.name}\\creatorshortname\\gamename\\`,
            projectItem,
            fileName
          )
        );
      }
    }

    for (const folderName in folder.folders) {
      const folderNameCanon = StorageUtilities.canonicalizeName(folderName);
      if (AddOnRequirementsGenerator.isNameGenericTerm(folderNameCanon)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            102,
            `Found an add-on-blocked folder '${folderName}' in a parent folder pack\\${folder.name}. Should be named 'creatorshortname' and not a common term`,
            undefined,
            folderName
          )
        );
      }

      const childFolder = folder.folders[folderName];

      if (childFolder) {
        await this.generateFromSecondLevelFolderGameName(project, folder.name, childFolder, items);
      }
    }
  }

  async generateFromSecondLevelFolderGameName(
    project: Project,
    parentFolderName: string,
    folder: IFolder,
    items: ProjectInfoItem[]
  ) {
    await folder.load(false);

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      const projectItem = file?.extendedPath ? project.getItemByExtendedOrStoragePath(file.extendedPath) : undefined;

      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          104,
          `Found a loose file '${fileName}' in ${parentFolderName}\\${folder.name}. Files should only be in the folder ${parentFolderName}\\${folder.name}\\<mygamename>`,
          projectItem,
          fileName
        )
      );
    }

    let folderCount = 0;

    for (const childFolderName in folder.folders) {
      const folderNameCanon = StorageUtilities.canonicalizeName(childFolderName);

      if (folderNameCanon !== "common") {
        folderCount++;
      }

      if (AddOnRequirementsGenerator.isNameGenericTerm(folderNameCanon)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            107,
            `Found an add-on-blocked folder '${childFolderName}' in pack\\${parentFolderName}\\${folder.name}. Should be 'mygamename' and not a general term`,
            undefined,
            childFolderName
          )
        );
      }
    }

    if (folderCount > 1) {
      items.push(
        new ProjectInfoItem(
          InfoItemType.testCompleteFail,
          this.id,
          108,
          `Secondary folder '${folder.name}' in ${parentFolderName} has more than one subfolder (besides 'common'), which is not supported. There should only be one folder (plus optionally 'common') in pack\\${parentFolderName}\\${folder.name}\\<mygamename>`,
          undefined,
          folder.name
        )
      );
    }
  }
}
