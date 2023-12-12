import ProjectInfoItem from "./ProjectInfoItem";
import Project from "../app/Project";
import IProjectInfoGenerator from "./IProjectInfoGenerator";
import { InfoItemType } from "./IInfoItemData";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import ProjectInfoSet from "./ProjectInfoSet";

const UniqueRegEx = new RegExp(/[a-zA-Z0-9]{2,}_[a-zA-Z0-9]{2,}:[\w]+/);

const CommonList = [
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
  "common",
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
            100,
            `Found feature or feature_rules in an add-on, which is not supported`,
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
            100,
            `Found ui elements in an add-on, which is not supported`,
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
          folderNameCanon !== "render_controllers" &&
          folderNameCanon !== "animation_controllers" &&
          folderNameCanon !== "animations"
        ) {
          await this.generateFromFirstLevelFolderCreatorNameGameName(project, childFolder, items);
        }
      }
    }
  }

  static isNameCommon(name: string) {
    name = StorageUtilities.canonicalizeName(name);

    return CommonList.includes(name);
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
      if (AddOnRequirementsGenerator.isNameCommon(folderNameCanon)) {
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
      folderCount++;
      if (AddOnRequirementsGenerator.isNameCommon(folderNameCanon)) {
        items.push(
          new ProjectInfoItem(
            InfoItemType.testCompleteFail,
            this.id,
            107,
            `Found an add-on-blocked folder '${childFolderName}' in pack\\${parentFolderName}\\${folder.name}. Should be 'mygamename' and not a common term`,
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
          `Secondary folder '${folder.name}' in ${parentFolderName} has more than one subfolder, which is not supported. There should only be one folder in pack\\${parentFolderName}\\${folder.name}\\<mygamename>`,
          undefined,
          folder.name
        )
      );
    }
  }
}
