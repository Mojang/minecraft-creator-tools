import Catalog from "./ICatalog";
import axios from "axios";
import BlockType from "./BlockType";
import BlockBaseType from "./BlockBaseType";
import MinecraftUtilities from "./MinecraftUtilities";
import IJavaBlockTypeData from "./IJavaBlockTypeData";
import IBlockTypeData from "./IBlockTypeData";
import IUXCatalog from "./IUXCatalog";
import Log from "./../core/Log";
import HttpStorage from "../storage/HttpStorage";
import IFolder from "../storage/IFolder";
import IFormField from "../dataform/IFormField";
import ILocalUtilities from "../local/ILocalUtilities";
import ITypeDefCatalog from "./ITypeDefCatalog";
import CartoApp from "./../app/CartoApp";
import Utilities from "../core/Utilities";
import NpmModule from "../devproject/NpmModule";
import IMainInfoVersions from "./IMainInfoVersions";

export default class Database {
  static isLoaded = false;
  static isScriptTypesLoaded = false;
  static catalog: Catalog | null = null;
  static uxCatalog: IUXCatalog | null = null;
  static betaTypeDefs: ITypeDefCatalog | null = null;
  static stableTypeDefs: ITypeDefCatalog | null = null;
  static contentFolder: IFolder | null = null;
  static snippetsFolder: IFolder | null = null;
  static defaultBehaviorPackFolder: IFolder | null = null;
  static defaultResourcePackFolder: IFolder | null = null;
  static local: ILocalUtilities | null = null;

  static latestVersion: string | undefined = undefined;
  static latestPreviewVersion: string | undefined = undefined;

  static dataPath: string = "res/latest/van/";

  static minecraftModuleNames = [
    "@minecraft/server-gametest",
    "@minecraft/server",
    "@minecraft/server-ui",
    "@minecraft/server-net",
    "@minecraft/server-admin",
  ];

  static maxMinecraftPatchVersions = {
    "1.19": "80",
    "1.20": "80",
  };

  static moduleDescriptors: { [id: string]: NpmModule } = {};

  static blockTypes: { [id: string]: BlockType } = {};
  static schemaContents: { [id: string]: object } = {};
  static blockBaseTypes: { [id: string]: BlockBaseType } = {};
  static _blockTypesByLegacyId: BlockType[] | undefined;

  static javaBlockTypeData: { [id: string]: IJavaBlockTypeData } = {};

  static _defaultBlockBaseType?: BlockBaseType;

  static get defaultBlockBaseType() {
    if (Database._defaultBlockBaseType === undefined) {
      Database._defaultBlockBaseType = Database.ensureBlockBaseType("block");
    }

    return Database._defaultBlockBaseType;
  }

  static getBlockType(name: string) {
    name = MinecraftUtilities.canonicalizeName(name);

    const blockType = Database.blockTypes[name];

    return blockType;
  }

  static populateBlockTypesByLegacyId() {
    this._blockTypesByLegacyId = [];

    for (const blockTypeName in this.blockTypes) {
      const blockType = this.blockTypes[blockTypeName];

      if (blockType.numericId !== undefined) {
        Log.assert(
          this._blockTypesByLegacyId[blockType.numericId] === undefined,
          "Multiple block types registered for the same ID:" + blockType.id
        );
        this._blockTypesByLegacyId[blockType.numericId] = blockType;
      }
    }
  }

  static async getModuleDescriptor(moduleId: string) {
    if (Database.moduleDescriptors[moduleId]) {
      return Database.moduleDescriptors[moduleId];
    }

    try {
      const response = await axios.get("https://registry.npmjs.org/" + moduleId);

      Database.moduleDescriptors[moduleId] = new NpmModule(response.data);
    } catch {
      Log.fail("Could not load registry for '" + moduleId + "'");
    }

    return Database.moduleDescriptors[moduleId];
  }

  static async getLatestMinecraftRetailVersion() {
    const moduleDescriptor = await this.getModuleDescriptor("@minecraft/server");

    if (!moduleDescriptor || !moduleDescriptor.latestRetailVersion) {
      return "1.20.10";
    }

    return moduleDescriptor.latestRetailVersion;
  }

  static async getLatestVersionInfo(preview: boolean, force?: boolean) {
    if (preview && Database.latestPreviewVersion && !force) {
      return Database.latestPreviewVersion;
    }

    if (!preview && Database.latestVersion && !force) {
      return Database.latestVersion;
    }

    let minecraftInfoResponse: any = undefined;

    let versionUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/version.json";

    if (preview) {
      versionUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/preview/version.json";
    }

    // Log.message("Retrieving " + (preview ? "preview" : "retail") + " version data.");

    /*Log.verbose(
      "Getting latest version info from '" +
        versionUrl +
        "' " +
        this.#usePreview +
        "|" +
        (this.carto && this.carto.processHostedMinecraftTrack === MinecraftTrack.preview)
    );*/

    try {
      minecraftInfoResponse = await axios.get(versionUrl);
    } catch (e: any) {
      console.log("Could not access Bedrock Dedicated Server details." + e);
      throw new Error(e.toString());
    }

    let latestVersionIndex = 0;
    let latestVerStr = "";
    try {
      if (minecraftInfoResponse === undefined || minecraftInfoResponse.data === undefined) {
        throw new Error("Unexpected empty response.");
      }

      const responseJson: IMainInfoVersions = JSON.parse(JSON.stringify(minecraftInfoResponse.data));

      if (!responseJson) {
        throw new Error("Improperly formatted response (source: " + minecraftInfoResponse.data + ")");
      }

      for (const verId in responseJson) {
        const ver = responseJson[verId].version;

        if (ver) {
          const isPreview = Database.getVersionIsPreview(ver); // version ends with .20 or higher

          const versionIndex = Database.getVersionIndexFromVersionStr(ver);

          if (versionIndex > 0 && versionIndex > latestVersionIndex && isPreview === preview) {
            latestVersionIndex = versionIndex;

            // re-constitute the version number ourselves
            const verNums = ver.split(".");

            latestVerStr =
              verNums[0] + "." + verNums[1] + "." + verNums[2] + "." + Utilities.frontPadToLength(verNums[3], 2, "0");
          }
        }
      }
    } catch (e: any) {
      Log.error("Could not access Bedrock Dedicated Server details." + e);
      throw new Error(e.toString());
    }

    if (latestVerStr && latestVerStr.length > 0) {
      if (preview) {
        Database.latestPreviewVersion = latestVerStr;
      } else {
        Database.latestVersion = latestVerStr;
      }
    }

    return latestVerStr;
  }

  static getVersionIsPreview(ver: string) {
    const verNums = ver.split(".");

    if (verNums.length !== 4) {
      return false;
    }

    for (let j = 0; j < verNums.length; j++) {
      if (!Utilities.isNumeric(verNums[j])) {
        return false;
      }
    }

    return parseInt(verNums[3]) > 19;
  }

  static getVersionIndexFromVersionStr(ver: string) {
    const verNums = ver.split(".");

    if (verNums.length !== 4) {
      return -1;
    }

    for (let j = 0; j < verNums.length; j++) {
      if (!Utilities.isNumeric(verNums[j])) {
        return -1;
      }
    }

    const versionIndex =
      parseInt(verNums[0]) * 16777216 +
      parseInt(verNums[1]) * 65536 +
      parseInt(verNums[2]) * 256 +
      parseInt(verNums[3]);

    return versionIndex;
  }

  static getBlockTypeByLegacyId(id: number) {
    if (!this._blockTypesByLegacyId) {
      this._blockTypesByLegacyId = [];
      this.populateBlockTypesByLegacyId();
    }

    const result = this._blockTypesByLegacyId[id];

    // Log.assert(result !== undefined);

    return result;
  }

  static getMatchingBlocks(searchTerm: string) {
    searchTerm = searchTerm.toLowerCase().trim();
    searchTerm = searchTerm.replace(/_/gi, " ");

    const searchTerms = searchTerm.split(" ");

    let exactMatch = undefined;

    let matches = [];

    for (const name in this.blockTypes) {
      const bt = this.blockTypes[name];

      const titleCanon = bt.title.toLowerCase();

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
      const newMatches = [exactMatch];

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
      const storage = await Database.local.createStorage("data/content/");

      if (storage) {
        await storage.rootFolder.load(false);

        Database.contentFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "data/content/");

      await storage.rootFolder.load(false);

      Database.contentFolder = storage.rootFolder;
    }
  }

  static async loadSnippets() {
    if (Database.snippetsFolder !== null) {
      return;
    }

    let folder: IFolder | undefined = undefined;

    if (Database.local) {
      const storage = await Database.local.createStorage("data/snippets/");

      if (storage) {
        folder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "data/snippets/");

      folder = storage.rootFolder;
    }

    if (folder === undefined) {
      return;
    }

    await folder.load(false);

    for (const fileName in folder.files) {
      const file = folder.files[fileName];

      if (file) {
        await file.loadContent();
      }
    }

    Database.snippetsFolder = folder;
  }

  static async loadDefaultBehaviorPack() {
    if (Database.defaultBehaviorPackFolder !== null) {
      return Database.defaultBehaviorPackFolder;
    }

    if (Database.local) {
      const storage = await Database.local.createStorage("res/latest/van/behavior_pack/");

      if (storage) {
        Database.defaultBehaviorPackFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/behavior_pack/");

      Database.defaultBehaviorPackFolder = storage.rootFolder;
    }

    if (Database.defaultBehaviorPackFolder) {
      await Database.defaultBehaviorPackFolder.load(false);
    }

    return Database.defaultBehaviorPackFolder;
  }

  static async loadDefaultResourcePack() {
    if (Database.defaultResourcePackFolder !== null) {
      return Database.defaultResourcePackFolder;
    }

    if (Database.local) {
      const storage = await Database.local.createStorage("res/latest/van/resource_pack/");

      if (storage) {
        Database.defaultResourcePackFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/resource_pack/");

      Database.defaultResourcePackFolder = storage.rootFolder;
    }

    if (Database.defaultResourcePackFolder) {
      await Database.defaultResourcePackFolder.load(false);
    }

    return Database.defaultResourcePackFolder;
  }

  static async loadUx() {
    if (Database.uxCatalog !== null) {
      return;
    }

    try {
      const response = await axios.get(CartoApp.contentRoot + "data/uxcat.json");

      Database.uxCatalog = response.data;

      if (Database.uxCatalog !== null) {
        const componentForms = Database.uxCatalog.componentForms;

        for (const formName in componentForms) {
          const form = componentForms[formName];

          if (form === undefined) {
            break;
          }

          componentForms[formName].id = formName;
        }
      } else {
        Log.debugAlert("Could not load UX catalog (undef).");
      }
    } catch {
      Log.fail("Could not load UX catalog.");
    }
  }

  static getComponentFormField(propertyName: string): IFormField | undefined {
    if (Database.uxCatalog === undefined || Database.uxCatalog === null) {
      Log.unexpectedNull();

      return undefined;
    }

    const componentForms = Database.uxCatalog.componentForms;

    for (const formName in componentForms) {
      const form = componentForms[formName];

      if (form === undefined) {
        break;
      }

      for (let i = 0; i < form.fields.length; i++) {
        const field = form.fields[i];

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

    const schemaPath = "/" + Database.dataPath + "schemas/" + path;

    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        const response = await axios.get(
          Utilities.ensureEndsWithSlash(CartoApp.contentRoot) + Utilities.ensureNotStartsWithSlash(schemaPath)
        );

        Database.schemaContents[path] = response.data as object;

        if (!Database.schemaContents[path]) {
          Log.fail("Could not load schema '" + schemaPath + "'");
        }
        return Database.schemaContents[path];
      } else if (Database.local) {
        const result = await Database.local.readJsonFile(schemaPath);

        if (result !== null) {
          Database.schemaContents[path] = result as object;
          return Database.schemaContents[path];
        } else {
          Log.fail("Could not load schema '" + schemaPath + "'");
          return undefined;
        }
      } else {
        Log.fail("Unexpected database config (no database available) when trying to load schema for:" + path);
        return undefined;
      }
    } catch (e: any) {
      Log.fail(
        "Could not load Minecraft schema catalog: " + CartoApp.contentRoot + "|" + schemaPath + " " + e.toString()
      );
      return undefined;
    }
  }

  static async loadBetaScriptTypes() {
    if (Database.betaTypeDefs) {
      return;
    }

    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        const response = await axios.get(CartoApp.contentRoot + "data/typedefs.beta.json");

        Database.betaTypeDefs = response.data;
      } else if (Database.local) {
        const result = await Database.local.readJsonFile("data/typedefs.beta.json");
        if (result !== null) {
          Database.betaTypeDefs = result as ITypeDefCatalog;
        }
      }
    } catch {
      Log.fail("Could not load beta Minecraft types catalog.");
    }
  }

  static async loadStableScriptTypes() {
    if (Database.stableTypeDefs) {
      return;
    }

    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        const response = await axios.get(CartoApp.contentRoot + "data/typedefs.stable.json");

        Database.stableTypeDefs = response.data;
      } else if (Database.local) {
        const result = await Database.local.readJsonFile("data/typedefs.stable.json");
        if (result !== null) {
          Database.stableTypeDefs = result as ITypeDefCatalog;
        }
      }
    } catch {
      Log.fail("Could not load stable Minecraft types catalog.");
    }
  }

  static async load() {
    if (Database.isLoaded) {
      return;
    }

    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        const response = await axios.get(CartoApp.contentRoot + "data/mccat.json");

        Database.catalog = response.data;
      } else if (Database.local) {
        const result = await Database.local.readJsonFile("data/mccat.json");
        if (result !== null) {
          Database.catalog = result as Catalog;
          // Log.debugAlert("Loaded catalog: " + Database.catalog.blockBaseTypes.length);
        }
      }

      if (Database.catalog !== null) {
        for (let i = 0; i < Database.catalog.blockBaseTypes.length; i++) {
          const blockBaseTypeData = Database.catalog.blockBaseTypes[i];

          const baseTypeName = MinecraftUtilities.canonicalizeName(blockBaseTypeData.name);

          const blockBaseType = new BlockBaseType(baseTypeName);
          blockBaseType.data = blockBaseTypeData;

          if (blockBaseTypeData.abstract === undefined || blockBaseTypeData.abstract === false) {
            const newBlockType: IBlockTypeData = {
              name: blockBaseTypeData.name,
              id: blockBaseTypeData.id,
              icon: blockBaseTypeData.icon,
              mapColor: blockBaseTypeData.mapColor,
              shortId: blockBaseTypeData.shortId,
              altShortId: blockBaseTypeData.altShortId,
            };

            const blockType = this.ensureBlockType(baseTypeName);
            blockType.data = newBlockType;
            blockType.baseType = blockBaseType;
          }

          if (blockBaseTypeData.variants !== undefined) {
            for (let j = 0; j < blockBaseTypeData.variants.length; j++) {
              const variantBlockTypeData = blockBaseTypeData.variants[j];

              const blockType = this.ensureBlockType(variantBlockTypeData.name);

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

              if (!variantBlockTypeData.mapColor && blockBaseTypeData.mapColor) {
                variantBlockTypeData.mapColor = blockBaseTypeData.mapColor;
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
        const response = await axios.get(CartoApp.contentRoot + "data/javacat.json");

        Database.javaBlockTypeData = response.data;
      } else if (Database.local) {
        const result = await Database.local.readJsonFile("data/javacat.json");
        if (result !== null) {
          Database.javaBlockTypeData = result as { [id: string]: IJavaBlockTypeData };
        }
      }

      if (Database.javaBlockTypeData) {
        for (const blockName in Database.javaBlockTypeData) {
          const jtnBlock = Database.javaBlockTypeData[blockName];
          jtnBlock.source = blockName;

          this.ensureBlockType(blockName).javaData = jtnBlock;
        }
      }

      Database.isLoaded = true;
    } catch {
      Log.fail("Could not load java catalog.");
    }
  }
}
