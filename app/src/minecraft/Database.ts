// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Catalog from "./ICatalog";
import axios from "axios";
import BlockType from "./BlockType";
import BlockBaseType from "./BlockBaseType";
import MinecraftUtilities from "./MinecraftUtilities";
import IJavaBlockTypeData from "./IJavaBlockTypeData";
import IBlockTypeData from "./IBlockTypeData";
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
import IFormDefinition from "../dataform/IFormDefinition";
import ContentIndex, { AnnotationCategory } from "../core/ContentIndex";
import IProjectInfoData from "../info/IProjectInfoData";
import Project, { FolderContext } from "../app/Project";
import { ProjectItemCreationType, ProjectItemStorageType, ProjectItemType } from "../app/IProjectItemData";
import StorageUtilities from "../storage/StorageUtilities";
import ISnippet from "../app/ISnippet";
import IGalleryItem from "../app/IGalleryItem";
import { MinecraftTrack } from "../app/ICartoData";
import IBiomesMetadata from "./IBiomesMetadata";
import IBlocksMetadata from "./IBlocksMetadata";
import ILegacyDocumentationNode from "./docs/ILegacyDocumentation";
import BlocksCatalogDefinition from "./BlocksCatalogDefinition";
import TerrainTextureCatalogDefinition from "./TerrainTextureCatalogDefinition";
import IEntitiesMetadata from "./IEntitiesMetadata";
import IItemsMetadata from "./IItemsMetadata";
import SoundDefinitionCatalogDefinition from "./SoundDefinitionCatalogDefinition";
import ItemTextureCatalogDefinition from "./ItemTextureCatalogDefinition";
import ZipStorage from "../storage/ZipStorage";

export default class Database {
  static isLoaded = false;
  static isScriptTypesLoaded = false;
  static catalog: Catalog | null = null;
  static loadedFormCount = 0;
  static _creatorToolsIngameProject: Project | null = null;
  static uxCatalog: { [formName: string]: IFormDefinition } = {};
  static formsFolders: { [folderName: string]: IFolder } = {};
  static betaTypeDefs: ITypeDefCatalog | null = null;
  static libs: ITypeDefCatalog | null = null;
  static stableTypeDefs: ITypeDefCatalog | null = null;
  static contentFolder: IFolder | null = null;
  static snippetsFolder: IFolder | null = null;
  static previewMetadataFolder: IFolder | null = null;
  static releaseMetadataFolder: IFolder | null = null;
  static previewVanillaFolder: IFolder | null = null;
  static releaseVanillaFolder: IFolder | null = null;
  static samplesFolder: IFolder | null = null;
  static releaseVanillaBehaviorPackFolder: IFolder | null = null;
  static releaseVanillaResourcePackFolder: IFolder | null = null;
  static local: ILocalUtilities | null = null;
  static vanillaInfoData: IProjectInfoData | null = null;
  static vanillaContentIndex: ContentIndex | null = null;
  static previewVanillaInfoData: IProjectInfoData | null = null;
  static previewVanillaContentIndex: ContentIndex | null = null;
  static samplesInfoData: IProjectInfoData | null = null;
  static samplesContentIndex: ContentIndex | null = null;
  static addonsDocs: ILegacyDocumentationNode | null = null;
  static biomesMetadata: IBiomesMetadata | null = null;
  static blocksMetadata: IBlocksMetadata | null = null;
  static entitiesMetadata: IEntitiesMetadata | null = null;
  static itemsMetadata: IItemsMetadata | null = null;
  static blocksCatalog: BlocksCatalogDefinition | null = null;
  static itemTextureCatalog: ItemTextureCatalogDefinition | null = null;
  static terrainTextureCatalog: TerrainTextureCatalogDefinition | null = null;
  static soundDefinitionCatalog: SoundDefinitionCatalogDefinition | null = null;

  static latestVersion: string | undefined;
  static latestPreviewVersion: string | undefined;

  private static _isLoadingSnippets: boolean = false;
  private static _pendingLoadSnippetsRequests: ((value: unknown) => void)[] = [];
  private static _isLoadingVanilla: boolean = false;
  private static _pendingLoadVanillaRequests: ((value: unknown) => void)[] = [];
  private static _isLoadingPreviewVanilla: boolean = false;
  private static _pendingLoadPreviewVanillaRequests: ((value: unknown) => void)[] = [];
  private static _isLoadingSamples: boolean = false;
  private static _pendingLoadSamplesRequests: ((value: unknown) => void)[] = [];

  static dataPath: string = "res/latest/";

  static minecraftEduVersion = "1.21.0";
  static minecraftEduPreviewVersion = "1.21.0";

  static minecraftModuleNames = [
    "@minecraft/server-gametest",
    "@minecraft/server",
    "@minecraft/server-ui",
    "@minecraft/server-net",
    "@minecraft/server-admin",
    "@minecraft/server-editor",
  ];

  static maxMinecraftPatchVersions = {
    "1.19": "80",
    "1.20": "80",
    "1.21": "50",
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

  static async ensureFormLoadedByPath(path: string): Promise<IFormDefinition | undefined> {
    const lastSlash = path.lastIndexOf("/");

    if (lastSlash >= 0) {
      return await Database.ensureFormLoaded(path.substring(0, lastSlash), path.substring(lastSlash + 1));
    }

    return undefined;
  }

  static async ensureFormLoaded(subFolder: string, name: string): Promise<IFormDefinition | undefined> {
    name = name.toLowerCase();

    if (Database.uxCatalog[name] !== undefined) {
      return Database.uxCatalog[name];
    }

    let path = CartoApp.contentRoot + "data/forms/";

    if (subFolder) {
      path += subFolder + "/";
    }

    if (Database.local) {
      const storage = await Database.local.createStorage(path);

      if (storage) {
        await storage.rootFolder.load();

        const file = storage.rootFolder.files[name + ".form.json"];
        if (file) {
          await file.loadContent();

          return StorageUtilities.getJsonObject(file) as IFormDefinition;
        }

        Log.fail("Could not load file locally for '" + (subFolder ? subFolder + "/" : "") + name + "'.");
        return undefined;
      }
    } else {
      try {
        const response = await axios.get(path + name + ".form.json");

        Database.uxCatalog[(subFolder ? subFolder + "." : "") + name] = response.data;
        Database.loadedFormCount++;

        return response.data as IFormDefinition;
      } catch {
        Log.fail("Could not load UX file for '" + (subFolder ? subFolder + "/" : "") + name + "'.");
      }
    }

    return undefined;
  }

  static async getFormsFolder(subFolder: string) {
    if (this.formsFolders[subFolder]) {
      return this.formsFolders[subFolder];
    }

    const folderPath = "data/forms/" + subFolder + "/";

    if (Database.local) {
      const storage = await Database.local.createStorage(folderPath);

      if (storage) {
        await storage.rootFolder.load();

        this.formsFolders[subFolder] = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + folderPath);

      await storage.rootFolder.load();

      this.formsFolders[subFolder] = storage.rootFolder;
    }

    return this.formsFolders[subFolder];
  }

  static getFormByPath(path: string): IFormDefinition | undefined {
    const lastSlash = path.lastIndexOf("/");

    if (lastSlash >= 0) {
      return Database.getForm(path.substring(0, lastSlash), path.substring(lastSlash + 1));
    }

    return undefined;
  }

  static getForm(subFolder: string, name: string) {
    name = name.toLowerCase();

    return Database.uxCatalog[(subFolder ? subFolder + "." : "") + name];
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

  static async getNextMinecraftPreviewVersion() {
    const latestMinecraftPreviewVersion = await Database.getLatestMinecraftPreviewVersion();

    if (!latestMinecraftPreviewVersion) {
      return undefined;
    }

    const ver = latestMinecraftPreviewVersion.split(".");

    if (!ver || !ver.length || ver.length < 3) {
      return undefined;
    }

    let triplet = undefined;

    try {
      triplet = [parseInt(ver[0]), parseInt(ver[1]), parseInt(ver[2]) + 10];
    } catch (e) {
      return undefined;
    }

    return triplet.join(".");
  }

  static async getLatestMinecraftPreviewVersion() {
    const moduleDescriptor = await this.getModuleDescriptor("@minecraft/server");

    if (!moduleDescriptor || !moduleDescriptor.latestPreviewVersion) {
      return "1.21.0";
    }

    return moduleDescriptor.latestPreviewVersion;
  }

  static async getLatestMinecraftRetailVersion() {
    const moduleDescriptor = await this.getModuleDescriptor("@minecraft/server");

    if (!moduleDescriptor || !moduleDescriptor.latestRetailVersion) {
      return "1.21.0";
    }

    return moduleDescriptor.latestRetailVersion;
  }

  static async isRecentVersionFromVersionArray(version: number[] | undefined) {
    if (version === undefined || version.length !== 3) {
      return false;
    }

    const ver = await this.getLatestVersionInfo(MinecraftTrack.main);

    if (!ver) {
      return false;
    }

    const verArr = MinecraftUtilities.getVersionArrayFrom(ver);
    if (!verArr || verArr.length < 3) {
      return false;
    }

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

  static async ensureCreatorToolsIngameProject() {
    if (Database._creatorToolsIngameProject) {
      return Database._creatorToolsIngameProject;
    }

    await Database.loadContent();

    if (Database.contentFolder === null || !CartoApp.carto) {
      Log.unexpectedContentState();
      return undefined;
    }

    const file = Database.contentFolder.ensureFile("creator_tools_ingame.mcaddon");

    await file.loadContent();

    if (file.content instanceof Uint8Array) {
      Database._creatorToolsIngameProject = new Project(CartoApp.carto, "Creator Tools", null);

      const projectFolder = await Database._creatorToolsIngameProject.ensureProjectFolder();

      const folder = projectFolder.ensureFolder("addons");

      const contentFile = folder.ensureFile(file.name);

      contentFile.setContent(file.content);

      contentFile.saveContent();

      const relPath = contentFile.getFolderRelativePath(Database._creatorToolsIngameProject.projectFolder as IFolder);

      if (relPath !== undefined) {
        Database._creatorToolsIngameProject.ensureItemByProjectPath(
          relPath,
          ProjectItemStorageType.singleFile,
          file.name,
          ProjectItemType.MCAddon,
          FolderContext.unknown,
          undefined,
          ProjectItemCreationType.normal
        );

        await Database._creatorToolsIngameProject.inferProjectItemsFromZipFile(relPath, contentFile, false);
      }

      return Database._creatorToolsIngameProject;
    }

    return undefined;
  }

  static async getLatestVersionInfo(track: MinecraftTrack, force?: boolean) {
    if (track === MinecraftTrack.edu) {
      return Database.minecraftEduVersion;
    }

    if (track === MinecraftTrack.eduPreview) {
      return Database.minecraftEduPreviewVersion;
    }

    if (track === MinecraftTrack.preview && Database.latestPreviewVersion && !force) {
      return Database.latestPreviewVersion;
    }

    if (track === MinecraftTrack.main && Database.latestVersion && !force) {
      return Database.latestVersion;
    }

    let minecraftInfoResponse: any = undefined;

    let versionUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/version.json";

    if (track === MinecraftTrack.preview) {
      versionUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/preview/version.json";
    }

    try {
      minecraftInfoResponse = await axios.get(versionUrl);
    } catch (e: any) {
      console.log("Could not access Minecraft version details." + e);
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

          if (
            versionIndex > 0 &&
            versionIndex > latestVersionIndex &&
            ((isPreview && track === MinecraftTrack.preview) || (!isPreview && track === MinecraftTrack.main))
          ) {
            latestVersionIndex = versionIndex;

            // re-constitute the version number ourselves
            const verNums = ver.split(".");

            latestVerStr =
              verNums[0] + "." + verNums[1] + "." + verNums[2] + "." + Utilities.frontPadToLength(verNums[3], 2, "0");
          }
        }
      }
    } catch (e: any) {
      Log.error("Could not process Minecraft version details." + e);
      throw new Error(e.toString());
    }

    if (latestVerStr && latestVerStr.length > 0) {
      if (track === MinecraftTrack.preview) {
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

    if (verNums.length !== 4 && verNums.length !== 3) {
      return -1;
    }

    for (let j = 0; j < verNums.length; j++) {
      if (!Utilities.isNumeric(verNums[j])) {
        return -1;
      }
    }

    let versionIndex = parseInt(verNums[0]) * 16777216 + parseInt(verNums[1]) * 65536 + parseInt(verNums[2]) * 256;

    if (verNums.length === 4) {
      versionIndex += parseInt(verNums[3]);
    }

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
        await storage.rootFolder.load();

        Database.contentFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "data/content/");

      await storage.rootFolder.load();

      Database.contentFolder = storage.rootFolder;
    }
  }

  static async initSnippetsFolder(): Promise<void> {
    if (Database.snippetsFolder !== null) {
      return;
    }

    if (this._isLoadingSnippets) {
      const pendingLoad = this._pendingLoadSnippetsRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingLoad.push(resolve);
      };

      await new Promise(prom);

      return;
    } else {
      this._isLoadingSnippets = true;

      let folder: IFolder | undefined;

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

      await folder.load();

      for (const fileName in folder.files) {
        const file = folder.files[fileName];

        if (file) {
          await file.loadContent();
        }
      }

      Database.snippetsFolder = folder;

      this._isLoadingSnippets = false;

      const pendingLoad = this._pendingLoadSnippetsRequests;
      this._pendingLoadSnippetsRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  public static itemMatchesSearch(item: IGalleryItem, searchString?: string) {
    if (!searchString || searchString.length < 3) {
      return true;
    }

    const searchKey = searchString.toLowerCase();

    if (
      (item.title && item.title.toLowerCase().indexOf(searchKey) >= 0) ||
      (item.description && item.description.toLowerCase().indexOf(searchKey) >= 0)
    ) {
      return true;
    }

    if (item.topics) {
      for (const topic of item.topics) {
        if (topic.toLowerCase().indexOf(searchKey) >= 0) {
          return true;
        }
      }
    }

    return false;
  }

  static async getSnippet(sampleSet: string, snippetId: string) {
    if (!Database.snippetsFolder) {
      await Database.initSnippetsFolder();
    }

    if (!Database.snippetsFolder) {
      return undefined;
    }

    if (Database.snippetsFolder !== null && Database.snippetsFolder.files) {
      const file = Database.snippetsFolder.files[sampleSet + ".json"];

      if (file) {
        const snipSet = StorageUtilities.getJsonObject(file) as { [snippetName: string]: ISnippet };

        if (snipSet && snipSet[snippetId]) {
          return snipSet[snippetId];
        }
      }
    }

    return undefined;
  }

  static async getAddonsDocs() {
    if (!Database.addonsDocs) {
      Database.addonsDocs = await Database.getMetadataObject("/doc_modules/addons.json");
    }

    return Database.addonsDocs;
  }

  static async getBiomesMetadata() {
    if (!Database.biomesMetadata) {
      Database.biomesMetadata = await Database.getMetadataObject("/vanilladata_modules/mojang-biomes.json");
    }

    return Database.biomesMetadata;
  }

  static getVanillaBlocksCatalogDirect() {
    return this.blocksCatalog;
  }

  static async getVanillaBlocksCatalog() {
    if (!Database.blocksCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/blocks.json");

      if (file) {
        const blockCat = new BlocksCatalogDefinition();
        blockCat.file = file;

        await blockCat.load();

        this.blocksCatalog = blockCat;
      }
    }

    return this.blocksCatalog;
  }

  static getVanillaTerrainTexturesCatalogDirect() {
    return this.terrainTextureCatalog;
  }

  static async getVanillaTerrainTexturesCatalog() {
    if (!Database.terrainTextureCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/textures/terrain_texture.json");

      if (file) {
        const terrainCat = new TerrainTextureCatalogDefinition();
        terrainCat.file = file;

        await terrainCat.load();

        Database.terrainTextureCatalog = terrainCat;
      }
    }

    return Database.terrainTextureCatalog;
  }

  static async getVanillaItemTexturesCatalog() {
    if (!Database.itemTextureCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/textures/item_texture.json");

      if (file) {
        const itemCat = new ItemTextureCatalogDefinition();
        itemCat.file = file;

        await itemCat.load();

        Database.itemTextureCatalog = itemCat;
      }
    }

    return Database.itemTextureCatalog;
  }

  static async getVanillaSoundDefinitionCatalog() {
    if (!Database.soundDefinitionCatalog) {
      const file = await Database.getPreviewVanillaFile("/resource_pack/sounds/sound_definitions.json");

      if (file) {
        const soundDefinitionCat = new SoundDefinitionCatalogDefinition();
        soundDefinitionCat.file = file;

        await soundDefinitionCat.load();

        Database.soundDefinitionCatalog = soundDefinitionCat;
      }
    }

    return Database.soundDefinitionCatalog;
  }

  static async getBlocksMetadata() {
    if (!Database.blocksMetadata) {
      Database.blocksMetadata = await Database.getMetadataObject("/vanilladata_modules/mojang-blocks.json");
    }

    return Database.blocksMetadata;
  }

  static async getEntitiesMetadata() {
    if (!Database.entitiesMetadata) {
      Database.entitiesMetadata = await Database.getMetadataObject("/vanilladata_modules/mojang-entities.json");
    }

    return Database.entitiesMetadata;
  }

  static async getItemsMetadata() {
    if (!Database.itemsMetadata) {
      Database.itemsMetadata = await Database.getMetadataObject("/vanilladata_modules/mojang-items.json");
    }

    return Database.itemsMetadata;
  }

  static async getMetadataObject(metaPath: string) {
    await Database.loadPreviewMetadataFolder();

    if (!Database.previewMetadataFolder) {
      return null;
    }

    const jsonFile = await Database.previewMetadataFolder.getFileFromRelativePath(metaPath);

    if (!jsonFile) {
      Log.unexpectedUndefined();
      return null;
    }

    await jsonFile.loadContent();

    const jsonObj = StorageUtilities.getJsonObject(jsonFile);

    if (!jsonObj) {
      Log.unexpectedUndefined();
      return null;
    }

    return jsonObj;
  }

  static async getPreviewVanillaFile(filePath: string) {
    const vanillaFolder = await Database.getPreviewVanillaFolder();

    if (!vanillaFolder) {
      return null;
    }

    const jsonFile = await vanillaFolder.getFileFromRelativePath(filePath);

    if (!jsonFile) {
      Log.unexpectedUndefined();
      return null;
    }

    await jsonFile.loadContent();

    return jsonFile;
  }

  static async getPreviewVanillaObject(filePath: string) {
    const jsonFile = await Database.getPreviewVanillaFile(filePath);

    if (!jsonFile) {
      Log.unexpectedUndefined();
      return null;
    }

    const jsonObj = StorageUtilities.getJsonObject(jsonFile);

    if (!jsonObj) {
      Log.unexpectedUndefined();
      return null;
    }

    return jsonObj;
  }

  static async loadPreviewMetadataFolder() {
    if (!this.previewMetadataFolder) {
      if (Database.local) {
        const storage = await Database.local.createStorage("res/latest/van/preview/metadata/");

        if (storage) {
          this.previewMetadataFolder = storage.rootFolder;
        }
      } else {
        const metadataStorage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/preview/metadata/");

        await metadataStorage.rootFolder.load();

        this.previewMetadataFolder = metadataStorage.rootFolder;
      }
    }

    return this.previewMetadataFolder;
  }

  static async loadReleaseMetadataFolder() {
    if (!this.releaseMetadataFolder) {
      if (Database.local) {
        const storage = await Database.local.createStorage("res/latest/van/release/metadata/");

        if (storage) {
          this.releaseMetadataFolder = storage.rootFolder;
        }
      } else {
        const metadataStorage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/release/metadata/");

        await metadataStorage.rootFolder.load();

        this.releaseMetadataFolder = metadataStorage.rootFolder;
      }
    }

    return this.releaseMetadataFolder;
  }

  static async getReleaseVanillaFolder() {
    if (Database.releaseVanillaFolder !== null) {
      return Database.releaseVanillaFolder;
    }

    if (Database.local) {
      const storage = await Database.local.createStorage("res/latest/van/release/");

      if (storage) {
        Database.releaseVanillaFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/release/");

      Database.releaseVanillaFolder = storage.rootFolder;
    }

    if (Database.releaseVanillaFolder) {
      await Database.releaseVanillaFolder.load();
    }

    return Database.releaseVanillaFolder;
  }

  static async getPreviewVanillaFolder() {
    if (Database.previewVanillaFolder !== null) {
      return Database.previewVanillaFolder;
    }

    if (Database.local) {
      const storage = await Database.local.createStorage("res/latest/van/preview/");

      if (storage) {
        Database.previewVanillaFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/preview/");

      Database.previewVanillaFolder = storage.rootFolder;
    }

    if (Database.previewVanillaFolder) {
      await Database.previewVanillaFolder.load();
    }

    return Database.previewVanillaFolder;
  }

  static async getSamplesFolder() {
    if (Database.samplesFolder !== null) {
      return Database.samplesFolder;
    }

    if (Database.local) {
      const storage = await Database.local.createStorage("res/samples/microsoft/minecraft-samples-main/");

      if (storage) {
        Database.samplesFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "res/samples/microsoft/minecraft-samples-main/");

      Database.samplesFolder = storage.rootFolder;
    }

    if (Database.samplesFolder) {
      await Database.samplesFolder.load();
    }

    return Database.samplesFolder;
  }

  static async getReleaseVanillaBehaviorPackFolder() {
    if (Database.releaseVanillaBehaviorPackFolder !== null) {
      return Database.releaseVanillaBehaviorPackFolder;
    }

    if (Database.local) {
      const storage = await Database.local.createStorage("res/latest/van/release/behavior_pack/");

      if (storage) {
        Database.releaseVanillaBehaviorPackFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/release/behavior_pack/");

      Database.releaseVanillaBehaviorPackFolder = storage.rootFolder;
    }

    if (Database.releaseVanillaBehaviorPackFolder) {
      await Database.releaseVanillaBehaviorPackFolder.load();
    }

    return Database.releaseVanillaBehaviorPackFolder;
  }

  static async getReleaseVanillaResourcePackFolder() {
    if (Database.releaseVanillaResourcePackFolder !== null) {
      return Database.releaseVanillaResourcePackFolder;
    }

    if (Database.local) {
      const storage = await Database.local.createStorage("res/latest/van/release/resource_pack/");

      if (storage) {
        Database.releaseVanillaResourcePackFolder = storage.rootFolder;
      }
    } else {
      const storage = new HttpStorage(CartoApp.contentRoot + "res/latest/van/release/resource_pack/");

      Database.releaseVanillaResourcePackFolder = storage.rootFolder;
    }

    if (Database.releaseVanillaResourcePackFolder) {
      await Database.releaseVanillaResourcePackFolder.load();
    }

    return Database.releaseVanillaResourcePackFolder;
  }

  static async loadUx() {}

  static getComponentFormField(propertyName: string): IFormField | undefined {
    if (Database.uxCatalog === undefined || Database.uxCatalog === null) {
      Log.unexpectedNull();

      return undefined;
    }
    throw new Error("Not implemented.");
    /*
    const componentForms = Database.uxCatalog.forms;

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
*/
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
        "Could not load Minecraft schema catalog: " + CartoApp.contentRoot + " - " + schemaPath + " " + e.toString()
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

  static async getLibs() {
    if (Database.libs) {
      return Database.libs;
    }

    try {
      // @ts-ignore
      if (typeof window !== "undefined") {
        const response = await axios.get(CartoApp.contentRoot + "data/libs.json");

        Database.libs = response.data;
      } else if (Database.local) {
        const result = await Database.local.readJsonFile("data/libs.json");
        if (result !== null) {
          Database.libs = result as ITypeDefCatalog;
        }
      }
    } catch {
      Log.fail("Could not load libraries catalog.");
    }

    return Database.libs;
  }

  static async matchesVanillaPath(path: string) {
    const rpFolder = await Database.getReleaseVanillaResourcePackFolder();

    if (rpFolder && rpFolder.folderCount > 0) {
      path = Utilities.ensureStartsWithSlash(path);

      const folder = await rpFolder.getFolderFromRelativePath(StorageUtilities.getFolderPath(path));

      if (!folder) {
        return false;
      }

      const exists = await folder.exists();

      if (!exists) {
        return false;
      }

      const itemName = StorageUtilities.getBaseFromName(StorageUtilities.getLeafName(path)).toLowerCase();

      await folder.load();

      for (let fileName in folder.files) {
        if (fileName && StorageUtilities.getBaseFromName(fileName).toLowerCase() === itemName) {
          return true;
        }
      }
    } else {
      let res = await Database.matchesVanillaPathFromIndex(path);

      return res;
    }

    return false;
  }

  static async matchesVanillaPathFromIndex(path: string) {
    if (!Database.vanillaContentIndex) {
      await this.loadVanillaInfoData();
    }

    if (!Database.vanillaContentIndex) {
      return false;
    }

    let result = Database.vanillaContentIndex.hasPathMatches(path);

    if (!result) {
      result = await Database.isVanillaToken(path);
    }

    if (!result) {
      if (!path.startsWith("/resource_pack/") && path.startsWith("/")) {
        result = Database.vanillaContentIndex.hasPathMatches("/resource_pack" + path);

        if (!result) {
          result = await Database.isVanillaToken("/resource_pack" + path);

          if (!result) {
            if (!path.startsWith("/behavior_pack/")) {
              result = Database.vanillaContentIndex.hasPathMatches("/behavior_pack" + path);

              if (!result) {
                result = await Database.isVanillaToken("/behavior_pack" + path);
              }
            }
          }
        }
      }
    }

    return result;
  }

  static async isVanillaToken(path: string) {
    const matches = await Database.getVanillaMatches(path, true);

    if (matches && matches.length > 0) {
      return true;
    }

    return false;
  }

  static async getVanillaAll(withAnnotation?: AnnotationCategory[]) {
    if (!Database.vanillaContentIndex) {
      await this.loadVanillaInfoData();
    }

    if (!Database.vanillaContentIndex) {
      return undefined;
    }

    return Database.vanillaContentIndex.getAll(withAnnotation);
  }

  static async getVanillaMatches(path: string, wholeTermSearch?: boolean, withAnnotation?: AnnotationCategory[]) {
    if (!Database.vanillaContentIndex) {
      await this.loadVanillaInfoData();
    }

    if (!Database.vanillaContentIndex) {
      return undefined;
    }

    return await Database.vanillaContentIndex.getMatches(path, wholeTermSearch, withAnnotation);
  }

  static async getPreviewVanillaMatches(
    path: string,
    wholeTermSearch?: boolean,
    withAnnotation?: AnnotationCategory[]
  ) {
    if (!Database.previewVanillaContentIndex) {
      await this.loadPreviewVanillaInfoData();
    }

    if (!Database.previewVanillaContentIndex) {
      return undefined;
    }

    return await Database.previewVanillaContentIndex.getMatches(path, wholeTermSearch, withAnnotation);
  }

  static async getSamplesMatches(path: string, wholeTermSearch?: boolean, withAnnotation?: AnnotationCategory[]) {
    if (!Database.samplesContentIndex) {
      await this.loadSampleInfoData();
    }

    if (!Database.samplesContentIndex) {
      return undefined;
    }

    return await Database.samplesContentIndex.getMatches(path, wholeTermSearch, withAnnotation);
  }

  static async loadVanillaInfoData() {
    if (Database.vanillaInfoData) {
      return;
    }

    if (this._isLoadingVanilla) {
      const pendingLoad = this._pendingLoadVanillaRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingLoad.push(resolve);
      };

      await new Promise(prom);
    } else {
      this._isLoadingVanilla = true;

      try {
        // @ts-ignore
        if (typeof window !== "undefined") {
          const response = await axios.get(CartoApp.contentRoot + "data/mci/release.mci.json.zip", {
            responseType: "arraybuffer",
            headers: {
              Accept: "application/octet-stream, application/json, text/plain, */*",
            },
          });

          if (response) {
            Database.vanillaInfoData = await ZipStorage.fromZipBytesToJsonObject(response.data);
          }
        } else if (Database.local) {
          const result = await Database.local.readJsonFile("data/mci/release.mci.json");
          if (result !== null) {
            Database.vanillaInfoData = result as IProjectInfoData;
          }
        }

        if (Database.vanillaInfoData && Database.vanillaInfoData.index && !Database.vanillaContentIndex) {
          Database.vanillaContentIndex = new ContentIndex();
          Database.vanillaContentIndex.loadFromData(Database.vanillaInfoData.index);
        }
      } catch {
        // Log.fail("Could not load vanilla metadata.");
      }

      this._isLoadingVanilla = false;

      const pendingLoad = this._pendingLoadVanillaRequests;
      this._pendingLoadVanillaRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  static async loadPreviewVanillaInfoData() {
    if (Database.previewVanillaContentIndex) {
      return;
    }

    if (this._isLoadingPreviewVanilla) {
      const pendingLoad = this._pendingLoadPreviewVanillaRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingLoad.push(resolve);
      };

      await new Promise(prom);
    } else {
      this._isLoadingPreviewVanilla = true;

      try {
        // @ts-ignore
        if (typeof window !== "undefined") {
          const response = await axios.get(CartoApp.contentRoot + "data/mci/preview.mci.json.zip", {
            responseType: "arraybuffer",
            headers: {
              Accept: "application/octet-stream, application/json, text/plain, */*",
            },
          });

          if (response) {
            Database.previewVanillaInfoData = await ZipStorage.fromZipBytesToJsonObject(response.data);
          }
        } else if (Database.local) {
          const result = await Database.local.readJsonFile("data/mci/preview.mci.json");
          if (result !== null) {
            Database.previewVanillaInfoData = result as IProjectInfoData;
          }
        }

        if (
          Database.previewVanillaInfoData &&
          Database.previewVanillaInfoData.index &&
          !Database.previewVanillaContentIndex
        ) {
          Database.previewVanillaContentIndex = new ContentIndex();
          Database.previewVanillaContentIndex.loadFromData(Database.previewVanillaInfoData.index);
        }
      } catch {
        // Log.fail("Could not load preview vanilla metadata.");
      }

      this._isLoadingVanilla = false;

      const pendingLoad = this._pendingLoadPreviewVanillaRequests;
      this._pendingLoadPreviewVanillaRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }
    }
  }

  static async loadSampleInfoData() {
    if (Database.samplesContentIndex) {
      return;
    }

    if (this._isLoadingSamples) {
      const pendingLoad = this._pendingLoadSamplesRequests;

      const prom = (resolve: (value: unknown) => void, reject: (reason?: any) => void) => {
        pendingLoad.push(resolve);
      };

      await new Promise(prom);
    } else {
      this._isLoadingSamples = true;

      try {
        // @ts-ignore
        if (typeof window !== "undefined") {
          const response = await axios.get(CartoApp.contentRoot + "data/mci/minecraft-samples-main.mci.json");

          Database.samplesInfoData = response.data;
        } else if (Database.local) {
          const result = await Database.local.readJsonFile("data/mci/minecraft-samples-main.mci.json");

          if (result !== null) {
            Database.samplesInfoData = result as IProjectInfoData;
          }
        }

        if (Database.samplesInfoData && Database.samplesInfoData.index && !Database.samplesContentIndex) {
          Database.samplesContentIndex = new ContentIndex();
          Database.samplesContentIndex.loadFromData(Database.samplesInfoData.index);
        }
      } catch {
        // Log.fail("Could not load preview vanilla metadata.");
      }

      this._isLoadingSamples = false;

      const pendingLoad = this._pendingLoadSamplesRequests;
      this._pendingLoadSamplesRequests = [];

      for (const prom of pendingLoad) {
        prom(undefined);
      }
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
    /*
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
    }*/
  }
}
