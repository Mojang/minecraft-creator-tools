import Catalog from "./ICatalog";
import BlockType from "./BlockType";
import BlockBaseType from "./BlockBaseType";
import MinecraftUtilities from "./MinecraftUtilities";
import IUXCatalog from "./IUXCatalog";
import Log from "./../core/Log";
import IFolder from "../storage/IFolder";
import IFormField from "../dataform/IFormField";
import ILocalUtilities from "../local/ILocalUtilities";
import ITypeDefCatalog from "./ITypeDefCatalog";

export default class Database {
  static isLoaded = false;
  static isScriptTypesLoaded = false;
  static catalog: Catalog | null = null;
  static uxCatalog: IUXCatalog | null = null;
  static betaTypeDefs: ITypeDefCatalog | null = null;
  static stableTypeDefs: ITypeDefCatalog | null = null;
  static contentFolder: IFolder | null = null;
  static defaultBehaviorPackFolder: IFolder | null = null;
  static local: ILocalUtilities | null = null;
  static formsFolders: { [folderName: string]: IFolder } = {};

  static dataPath: string = "res/latest/van/";

  static minecraftModuleNames = [
    "@minecraft/server-gametest",
    "@minecraft/server",
    "@minecraft/server-ui",
    "@minecraft/server-net",
    "@minecraft/server-admin",
  ];

  static async isRecentVersionFromVersionArray(version: number[] | undefined) {
    if (version === undefined || version.length !== 3) {
      return false;
    }

    const verArr = [1, 21, 20];

    const majorVersion = verArr[0];
    const minorVersion = verArr[1];

    if (version[0] < majorVersion) {
      return false;
    }

    if (majorVersion === version[0] && minorVersion - version[1] > 1) {
      return false;
    }

    return true;
  }

  static blockTypes: { [id: string]: BlockType } = {};
  static schemaContents: { [id: string]: object } = {};
  static blockBaseTypes: { [id: string]: BlockBaseType } = {};
  static _blockTypesByLegacyId: BlockType[] | undefined;

  static _defaultBlockBaseType?: BlockBaseType;

  static get defaultBlockBaseType() {
    if (Database._defaultBlockBaseType === undefined) {
      Database._defaultBlockBaseType = Database.ensureBlockBaseType("block");
    }

    return Database._defaultBlockBaseType;
  }

  static async getFormsFolder(subFolder: string) {
    if (this.formsFolders[subFolder]) {
      return this.formsFolders[subFolder];
    }

    return this.formsFolders[subFolder];
  }

  static getBlockType(name: string) {
    name = MinecraftUtilities.canonicalizeName(name);

    let blockType = Database.blockTypes[name];

    return blockType;
  }

  static populateBlockTypesByLegacyId() {
    this._blockTypesByLegacyId = [];

    for (let blockTypeName in this.blockTypes) {
      let blockType = this.blockTypes[blockTypeName];

      if (blockType.numericId) {
        Log.assert(
          this._blockTypesByLegacyId[blockType.numericId] === undefined,
          "Multiple block types registered for the same ID:" + blockType.id
        );
        this._blockTypesByLegacyId[blockType.numericId] = blockType;
      }
    }
  }
  /*

  static async getModuleDescriptor(moduleId: string) {
    if (Database.moduleDescriptors[moduleId]) {
      return Database.moduleDescriptors[moduleId];
    }
    try {
      let response = await axios.get("https://registry.npmjs.org/" + moduleId);

      Database.moduleDescriptors[moduleId] = new NpmModule(response.data);
    } catch {
      Log.fail("Could not load registry for '" + moduleId + "'");
    }

    return Database.moduleDescriptors[moduleId];
  }*/

  static getBlockTypeByLegacyId(id: number) {
    if (!this._blockTypesByLegacyId) {
      this._blockTypesByLegacyId = [];
      this.populateBlockTypesByLegacyId();
    }

    let result = this._blockTypesByLegacyId[id];

    // Log.assert(result !== undefined);

    return result;
  }

  static getMatchingBlocks(searchTerm: string) {
    searchTerm = searchTerm.toLowerCase().trim();
    searchTerm = searchTerm.replace(/_/gi, " ");

    let searchTerms = searchTerm.split(" ");

    let exactMatch = undefined;

    let matches = [];

    for (let name in this.blockTypes) {
      let bt = this.blockTypes[name];

      let titleCanon = bt.title.toLowerCase();

      if (titleCanon === searchTerm && exactMatch === undefined) {
        exactMatch = bt;
      } else {
        for (let i = 0; i < searchTerms.length; i++) {
          if (titleCanon.indexOf(searchTerms[i]) >= 0) {
            matches.push(bt);
            break;
          }
        }
      }
    }

    if (exactMatch !== undefined) {
      let newMatches = [exactMatch];

      for (let i = 0; i < matches.length; i++) {
        newMatches.push(matches[i]);
      }

      matches = newMatches;
    }

    return matches;
  }

  static ensureBlockType(name: string) {
    name = MinecraftUtilities.canonicalizeName(name);

    let blockType = Database.blockTypes[name];

    if (blockType == null && Database.catalog != null) {
      blockType = new BlockType(name);

      Database.blockTypes[name] = blockType;

      blockType.data = {
        name: name,
      };
    }

    return blockType;
  }

  static ensureBlockBaseType(name: string) {
    name = MinecraftUtilities.canonicalizeName(name);

    let blockBaseType = Database.blockBaseTypes[name];

    if (blockBaseType == null) {
      blockBaseType = new BlockBaseType(name);

      Database.blockBaseTypes[name] = blockBaseType;
    }

    return blockBaseType;
  }

  static async loadContent() {
    if (Database.contentFolder !== null) {
      return;
    }

    if (Database.local) {
      let storage = await Database.local.createStorage("data/content/");

      if (storage) {
        await storage.rootFolder.load(false);

        Database.contentFolder = storage.rootFolder;
      }
    } else {
      /*  let storage = new HttpStorage(CartoApp.contentRoot + "data/content/");

      await storage.rootFolder.load(false);

      Database.contentFolder = storage.rootFolder;*/
    }
  }

  static async loadDefaultBehaviorPack() {
    if (Database.defaultBehaviorPackFolder !== null) {
      return;
    }

    if (Database.local) {
      let storage = await Database.local.createStorage("res/latest/van/behavior_pack/");

      if (storage) {
        Database.defaultBehaviorPackFolder = storage.rootFolder;
      }
    } else {
      /*      let storage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/behavior_pack/");

      Database.defaultBehaviorPackFolder = storage.rootFolder;*/
    }

    if (Database.defaultBehaviorPackFolder) {
      await Database.defaultBehaviorPackFolder.load(false);
    }
  }

  static async loadUx() {
    if (Database.uxCatalog !== null) {
      return;
    }
    /*
    try {
      let response = await axios.get(CartoApp.contentRoot + "data/uxcat.json");

      Database.uxCatalog = response.data;

      if (Database.uxCatalog !== null) {
        let componentForms = Database.uxCatalog.componentForms;

        for (let formName in componentForms) {
          let form = componentForms[formName];

          if (form === undefined) {
            break;
          }

          componentForms[formName].id = formName;
        }
      }
    } catch {
      Log.fail("Could not load UX catalog.");
    }*/
  }

  static getComponentFormField(propertyName: string): IFormField | undefined {
    if (Database.uxCatalog === undefined || Database.uxCatalog === null) {
      Log.unexpectedNull();

      return undefined;
    }

    let componentForms = Database.uxCatalog.componentForms;

    for (let formName in componentForms) {
      let form = componentForms[formName];

      if (form === undefined) {
        break;
      }

      for (let i = 0; i < form.fields.length; i++) {
        let field = form.fields[i];

        if (field.id === propertyName || field.altId === propertyName) {
          return {
            form: form,
            field: field,
          };
        }
      }
    }

    return undefined;
  }

  static async getSchema(path: string) {
    path = path.toLowerCase();

    if (Database.schemaContents[path]) {
      return Database.schemaContents[path];
    }

    let schemaPath = "/" + Database.dataPath + "schemas/" + path;
    /*
    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        let response = await axios.get(
          Utilities.ensureEndsWithSlash(CartoApp.contentRoot) + Utilities.ensureNotStartsWithSlash(schemaPath)
        );

        Database.schemaContents[path] = response.data as object;

        if (!Database.schemaContents[path]) {
          Log.fail("Could not load schema '" + schemaPath + "'");
        }
        return Database.schemaContents[path];
      } else if (Database.local) {
        let result = await Database.local.readJsonFile(schemaPath);

        if (result !== null) {
          Database.schemaContents[path] = result as object;
          return Database.schemaContents[path];
        } else {
          Log.fail("Could not load schema '" + schemaPath + "'");
          return undefined;
        }
      } else {
        Log.fail("Unexpected database config for path:" + path);
        return undefined;
      }
    } catch (e: any) {
      Log.fail(
        "Could not load Minecraft schema catalog: " + CartoApp.contentRoot + "|" + schemaPath + " " + e.toString()
      );
      return undefined;
    }*/
  }

  static async loadBetaScriptTypes() {
    if (Database.betaTypeDefs) {
      return;
    }
    /*
    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        let response = await axios.get(CartoApp.contentRoot + "data/typedefs.beta.json");

        Database.betaTypeDefs = response.data;
      } else if (Database.local) {
        let result = await Database.local.readJsonFile("data/typedefs.beta.json");
        if (result !== null) {
          Database.betaTypeDefs = result as ITypeDefCatalog;
        }
      }
    } catch {
      Log.fail("Could not load beta Minecraft types catalog.");
    }*/
  }

  static async loadStableScriptTypes() {
    if (Database.stableTypeDefs) {
      return;
    }
    /*
    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        let response = await axios.get(CartoApp.contentRoot + "data/typedefs.stable.json");

        Database.stableTypeDefs = response.data;
      } else if (Database.local) {
        let result = await Database.local.readJsonFile("data/typedefs.stable.json");
        if (result !== null) {
          Database.stableTypeDefs = result as ITypeDefCatalog;
        }
      }
    } catch {
      Log.fail("Could not load stable Minecraft types catalog.");
    }*/
  }

  static async load() {
    if (Database.isLoaded) {
      return;
    }
    /*
    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        let response = await axios.get(CartoApp.contentRoot + "data/mccat.json");

        Database.catalog = response.data;
      } else if (Database.local) {
        let result = await Database.local.readJsonFile("data/mccat.json");
        if (result !== null) {
          Database.catalog = result as Catalog;
          // Log.debugAlert("Loaded catalog: " + Database.catalog.blockBaseTypes.length);
        }
      }

      if (Database.catalog !== null) {
        for (let i = 0; i < Database.catalog.blockBaseTypes.length; i++) {
          let blockBaseTypeData = Database.catalog.blockBaseTypes[i];

          let baseTypeName = MinecraftUtilities.canonicalizeName(blockBaseTypeData.name);

          let blockBaseType = new BlockBaseType(baseTypeName);
          blockBaseType.data = blockBaseTypeData;

          if (blockBaseTypeData.abstract === undefined || blockBaseTypeData.abstract === false) {
            let newBlockType: IBlockTypeData = {
              name: blockBaseTypeData.name,
              id: blockBaseTypeData.id,
              icon: blockBaseTypeData.icon,
              shortId: blockBaseTypeData.shortId,
              altShortId: blockBaseTypeData.altShortId,
            };

            let blockType = this.ensureBlockType(baseTypeName);
            blockType.data = newBlockType;
            blockType.baseType = blockBaseType;
          }

          if (blockBaseTypeData.variants !== undefined) {
            for (let j = 0; j < blockBaseTypeData.variants.length; j++) {
              let variantBlockTypeData = blockBaseTypeData.variants[j];

              let blockType = this.ensureBlockType(variantBlockTypeData.name);

              if (!variantBlockTypeData.id && blockBaseTypeData.id) {
                variantBlockTypeData.id = blockBaseTypeData.id;
              }

              if (!variantBlockTypeData.icon && blockBaseTypeData.icon) {
                variantBlockTypeData.icon = blockBaseTypeData.icon;
              }

              if (!variantBlockTypeData.shortId && blockBaseTypeData.shortId) {
                variantBlockTypeData.shortId = blockBaseTypeData.shortId;
              }

              if (!variantBlockTypeData.altShortId && blockBaseTypeData.altShortId) {
                variantBlockTypeData.altShortId = blockBaseTypeData.altShortId;
              }

              blockType.data = variantBlockTypeData;
              blockType.baseType = blockBaseType;
            }
          }
        }
      }
    } catch {
      Log.fail("Could not load Minecraft types catalog.");
    }

    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        let response = await axios.get(CartoApp.contentRoot + "data/javacat.json");

        Database.javaBlockTypeData = response.data;
      } else if (Database.local) {
        let result = await Database.local.readJsonFile("data/javacat.json");
        if (result !== null) {
          Database.javaBlockTypeData = result as { [id: string]: IJavaBlockTypeData };
        }
      }

      if (Database.javaBlockTypeData) {
        for (let blockName in Database.javaBlockTypeData) {
          let jtnBlock = Database.javaBlockTypeData[blockName];
          jtnBlock.source = blockName;

          this.ensureBlockType(blockName).javaData = jtnBlock;
        }
      }

      Database.isLoaded = true;
    } catch {
      Log.fail("Could not load java catalog.");
    }*/
  }
}
