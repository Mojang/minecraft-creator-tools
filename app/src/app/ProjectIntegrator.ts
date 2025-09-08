import { IErrorMessage, IErrorable } from "../core/IErrorable";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import LevelDb from "../minecraft/LevelDb";
import MCWorld from "../minecraft/MCWorld";
import WorldLevelDat from "../minecraft/WorldLevelDat";
import IFile from "../storage/IFile";
import IFolder from "../storage/IFolder";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import Carto from "./Carto";
import { ProjectFocus, ProjectScriptLanguage } from "./IProjectData";
import { ProjectItemType } from "./IProjectItemData";
import Project from "./Project";

const minecraftIndicatorFolderNames = [
  "development_behavior_packs",
  "development_resource_packs",
  "development_resource_packs",
  "behavior_packs",
  "resource_packs",
  "behavior_pack",
  "resource_pack",
  "world_templates",
  "com.mojang",
  "minecraftworlds",
  "worlds",
  "world",
];

export interface IProjectIntegratorWorld {
  currentFile?: IFile;
  currentManifest?: string;
  levelDatFile?: IProjectIntegratorCandidateFile;
  manifestFiles: IProjectIntegratorCandidateFile[];
  ldbFiles: IProjectIntegratorCandidateFile[];
  logFiles: IProjectIntegratorCandidateFile[];
  seedFromLevelDb?: string | undefined;
}

export interface IProjectIntegratorCandidateFile {
  isUsed?: boolean;
  file: IFile;
  index?: number;
  type: ProjectItemType;
  levelDbSubset?: LevelDb;
  levelDat?: WorldLevelDat;
  mcworld?: MCWorld;
}

export default class ProjectIntegrator implements IErrorable {
  candidateFiles: { [storagePath: string]: IProjectIntegratorCandidateFile } = {};
  worlds: IProjectIntegratorWorld[] = [];
  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];

  private _pushError(message: string, contextIn?: string) {
    this.isInErrorState = true;

    if (this.errorMessages === undefined) {
      this.errorMessages = [];
    }

    message = message + contextIn ? " " + contextIn : "";

    Log.error(message);

    this.errorMessages.push({
      message: message,
      context: contextIn,
    });

    return message;
  }

  static async createProjectFromFolder(
    carto: Carto,
    newProjectName: string,
    folder: IFolder,
    operationDescriptor?: string,
    log?: (message: string) => Promise<void>
  ): Promise<Project | undefined> {
    let newProject = await carto.createNewProject(
      newProjectName,
      undefined,
      undefined,
      undefined,
      ProjectFocus.general,
      true,
      ProjectScriptLanguage.typeScript
    );

    await this.extendProjectFromCollectionFolder(carto, newProject, folder, operationDescriptor, log);

    await carto.save();

    return newProject;
  }

  static async extendProjectFromCollectionFolder(
    carto: Carto,
    project: Project,
    folder: IFolder,
    operationDescriptor?: string,
    log?: (message: string) => Promise<void>
  ) {
    // assume everything else is "loose files" that need to be reconstructed

    const pi = new ProjectIntegrator();

    await pi.addFromFolder(project, folder, true, log);

    await pi.processResults(project, operationDescriptor, log);

    await project.inferProjectItemsFromFiles(true);
  }

  async attachWorldDataToWorlds() {
    for (const world of this.worlds) {
      if (world.currentManifest) {
        if (world.manifestFiles.length > 0) {
          await this.addToWorldByFileIds(world);
        }
      }
    }

    for (const world of this.worlds) {
      if (world.currentManifest) {
        if (world.manifestFiles.length > 0) {
          await this.findLevelDat(world);
        }
      }
    }
  }

  async processResults(project: Project, operationDescriptor?: string, log?: (message: string) => Promise<void>) {
    for (const world of this.worlds) {
      // find our MANIFEST
      if (world.currentManifest) {
        for (const fileName in this.candidateFiles) {
          const tokenToLookFor = world.currentManifest.substring(2).trim();
          const file = this.candidateFiles[fileName];

          if (
            file &&
            !file.isUsed &&
            file.type === ProjectItemType.levelDbManifest &&
            fileName.indexOf(tokenToLookFor) >= 0
          ) {
            file.isUsed = true;

            world.manifestFiles.push(file);
            break;
          }
        }

        if (world.manifestFiles.length > 0) {
          await this.addToWorldByManifestData(world);
        }
      }
    }

    await this.attachWorldDataToWorlds();

    // now that we've attached as many LDBs/LOGs to the "good" manifests connected to CURRENTs,
    // let's see if we can make more worlds out of 'leftover' MANIFEST files (those without CURRENTs)
    // in some cases their CURRENT might be missing, or in other cases they are older versions of "good" manifests
    for (const fileName in this.candidateFiles) {
      const file = this.candidateFiles[fileName];

      if (file && !file.isUsed && file.type === ProjectItemType.levelDbManifest) {
        file.isUsed = true;

        const world: IProjectIntegratorWorld = {
          manifestFiles: [file],
          ldbFiles: [],
          logFiles: [],
        };

        if (world.manifestFiles.length > 0) {
          await this.addToWorldByManifestData(world);
        }

        this.worlds.push(world);
      }
    }

    await this.attachWorldDataToWorlds();

    const leftoverWorld: IProjectIntegratorWorld = {
      manifestFiles: [],
      ldbFiles: [],
      logFiles: [],
    };

    for (const fileName in this.candidateFiles) {
      const file = this.candidateFiles[fileName];

      if (file && !file.isUsed && file.type === ProjectItemType.levelDbLdb) {
        file.isUsed = true;
        leftoverWorld.ldbFiles.push(file);
      }

      if (file && !file.isUsed && file.type === ProjectItemType.levelDbLog) {
        file.isUsed = true;
        leftoverWorld.logFiles.push(file);
      }

      if (file && !file.isUsed && file.type === ProjectItemType.levelDat && leftoverWorld.levelDatFile === undefined) {
        file.isUsed = true;
        leftoverWorld.levelDatFile = file;
      }
    }

    if (leftoverWorld.ldbFiles.length > 0 || leftoverWorld.logFiles.length > 0) {
      this.worlds.push(leftoverWorld);
    }

    await project.ensureLoadedProjectFolder();

    if (project.projectFolder) {
      let worldsFolder = await project.ensureWorldContainer();

      if (worldsFolder) {
        let index = 0;
        for (const world of this.worlds) {
          await this.copyFilesToWorld(world, project, worldsFolder, index);
          index++;
        }
      }
    }

    project.appendErrors(this, operationDescriptor);
  }

  async addToWorldByManifestData(world: IProjectIntegratorWorld) {
    let keySets: { smallest: string; largest: string }[] = [];
    let logIndices: number[] = [];
    let ldbIndices: number[] = [];

    for (const manifestFile of world.manifestFiles) {
      if (
        manifestFile.levelDbSubset &&
        manifestFile.levelDbSubset.newFileNumber &&
        manifestFile.levelDbSubset.newFileSmallest &&
        manifestFile.levelDbSubset.newFileLargest
      ) {
        for (let i = 0; i < manifestFile.levelDbSubset.newFileSmallest.length; i++) {
          const smallest = manifestFile.levelDbSubset.newFileSmallest[i];
          const largest = manifestFile.levelDbSubset.newFileLargest[i];

          if (smallest && largest) {
            keySets.push({ smallest: smallest, largest: largest });
          }
        }

        for (let i = 0; i < manifestFile.levelDbSubset.newFileNumber.length; i++) {
          const index = manifestFile.levelDbSubset.newFileNumber[i];

          if (
            !manifestFile.levelDbSubset.deletedFileNumber ||
            !manifestFile.levelDbSubset.deletedFileNumber.includes(index)
          ) {
            ldbIndices.push(index);
          }
        }

        if (manifestFile.levelDbSubset.logNumber !== undefined) {
          logIndices.push(manifestFile.levelDbSubset.logNumber);
        }
      }
    }

    for (const fileName in this.candidateFiles) {
      const file = this.candidateFiles[fileName];

      if (
        !file.isUsed &&
        (file.type === ProjectItemType.levelDbLdb || file.type === ProjectItemType.levelDbLog) &&
        file.levelDbSubset
      ) {
        for (const keySet of keySets) {
          if (
            file.levelDbSubset.keys[keySet.largest] !== undefined &&
            file.levelDbSubset.keys[keySet.smallest] !== undefined
          ) {
            if (file.type === ProjectItemType.levelDbLog) {
              file.isUsed = true;
              world.logFiles.push(file);
              break;
            } else if (file.type === ProjectItemType.levelDbLdb) {
              file.isUsed = true;
              world.ldbFiles.push(file);
              break;
            }
          }
        }
      }
    }
  }

  async addToWorldByFileIds(world: IProjectIntegratorWorld) {
    let logIndices: number[] = [];
    let ldbIndices: number[] = [];

    for (const manifestFile of world.manifestFiles) {
      if (manifestFile.levelDbSubset && manifestFile.levelDbSubset.newFileNumber) {
        for (let i = 0; i < manifestFile.levelDbSubset.newFileNumber.length; i++) {
          const index = manifestFile.levelDbSubset.newFileNumber[i];

          if (
            !manifestFile.levelDbSubset.deletedFileNumber ||
            !manifestFile.levelDbSubset.deletedFileNumber.includes(index)
          ) {
            ldbIndices.push(index);
          }
        }

        if (manifestFile.levelDbSubset.logNumber !== undefined) {
          logIndices.push(manifestFile.levelDbSubset.logNumber);
        }
      }
    }

    for (const fileName in this.candidateFiles) {
      const file = this.candidateFiles[fileName];

      if (
        !file.isUsed &&
        file.type === ProjectItemType.levelDbLdb &&
        file.levelDbSubset &&
        file.index !== undefined &&
        ldbIndices.includes(file.index)
      ) {
        file.isUsed = true;
        world.ldbFiles.push(file);
      } else if (
        !file.isUsed &&
        file.type === ProjectItemType.levelDbLog &&
        file.levelDbSubset &&
        file.index !== undefined &&
        logIndices.includes(file.index)
      ) {
        file.isUsed = true;
        world.logFiles.push(file);
      }
    }
  }

  async findLevelDat(world: IProjectIntegratorWorld) {
    if ((world.ldbFiles.length > 0 || world.logFiles.length > 0) && world.manifestFiles.length > 0) {
      for (const file of world.ldbFiles) {
        if (file && file.levelDbSubset) {
          const mcworld = new MCWorld();
          await mcworld.loadFromLevelDb(file.levelDbSubset);

          if (mcworld.generationSeed) {
            world.seedFromLevelDb = mcworld.generationSeed;
            break;
          }
        }
      }

      if (!world.seedFromLevelDb) {
        for (const file of world.logFiles) {
          if (file && file.levelDbSubset) {
            const mcworld = new MCWorld();
            await mcworld.loadFromLevelDb(file.levelDbSubset);

            if (mcworld.generationSeed) {
              world.seedFromLevelDb = mcworld.generationSeed;
              break;
            }
          }
        }
      }

      if (world.seedFromLevelDb) {
        for (const fileName in this.candidateFiles) {
          const file = this.candidateFiles[fileName];

          if (
            !file.isUsed &&
            file.type === ProjectItemType.levelDat &&
            file.levelDat &&
            file.levelDat.randomSeed === world.seedFromLevelDb
          ) {
            file.isUsed = true;
            world.levelDatFile = file;
          }
        }
      }
    }
  }

  async copyFilesToWorld(world: IProjectIntegratorWorld, project: Project, worldsFolder: IFolder, index: number) {
    if (world.ldbFiles.length > 0 || world.logFiles.length > 0) {
      // && world.manifestFiles.length > 0) {
      let name = "world" + index;

      if (world.levelDatFile && world.levelDatFile.levelDat?.levelName) {
        name = world.levelDatFile.levelDat?.levelName;

        let worldIndex = 0;

        // ensure folder name is unique
        while (worldsFolder.folders[name] !== undefined) {
          worldIndex++;
          name = world.levelDatFile.levelDat?.levelName + " " + worldIndex;
        }
      }
      const worldFolder = worldsFolder.ensureFolder(name);

      const newLevelDataFile = worldFolder.ensureFile("level.dat");
      const newLevelDat = new WorldLevelDat();

      newLevelDat.ensureDefaults();

      newLevelDat.levelName = name;

      if (
        world.levelDatFile &&
        world.levelDatFile.file.content &&
        world.levelDatFile.file.content instanceof Uint8Array
      ) {
        // we could probably just newLevelDat = world.levelDatFile.levelDat
        // but we're going to modify it so use the new copy.
        newLevelDat.loadFromNbtBytes(world.levelDatFile.file.content);
      }

      // note that we are re-writing level.dat rather than just copying it.
      // add experiments flag
      newLevelDat.experimentsEverUsed = true;
      newLevelDat.savedWithToggledExperiments = true;

      newLevelDat.persist();

      const levelDatBytes = newLevelDat.getBytes();

      if (levelDatBytes !== undefined) {
        newLevelDataFile.setContent(levelDatBytes);
      } else if (
        world.levelDatFile &&
        world.levelDatFile.file.content &&
        world.levelDatFile.file.content instanceof Uint8Array
      ) {
        newLevelDataFile.setContent(world.levelDatFile.file.content);
      }

      const levelNameFile = worldFolder.ensureFile("levelname.txt");
      levelNameFile.setContent(name);

      let dbFolder = worldFolder.ensureFolder("db");

      for (const file of world.ldbFiles) {
        if (file && file.index && file.file.content) {
          const newFileName = Utilities.frontPadToLength(file.index, 6, "0");
          const newLdbFile = dbFolder.ensureFile(newFileName + ".ldb");

          newLdbFile.setContent(file.file.content);
        }
      }

      for (const file of world.logFiles) {
        if (file && file.index && file.file.content) {
          const newFileName = Utilities.frontPadToLength(file.index, 6, "0");
          const newLogFile = dbFolder.ensureFile(newFileName + ".log");

          newLogFile.setContent(file.file.content);
        }
      }
      let manifestFileName = world.currentManifest;

      for (const file of world.manifestFiles) {
        if (file && file.index && file.file.content) {
          const newFileName = "MANIFEST-" + Utilities.frontPadToLength(file.index, 6, "0");
          if (!manifestFileName) {
            manifestFileName = newFileName;
          }

          const newManifestFile = dbFolder.ensureFile(newFileName);

          newManifestFile.setContent(file.file.content);
        }
      }

      const currentFile = dbFolder.ensureFile("CURRENT");
      currentFile.setContent(manifestFileName + "\n");
    }
  }

  async addFromFolder(
    project: Project,
    sourceFolder: IFolder,
    processSubFolders: boolean,
    log?: (message: string) => Promise<void>
  ) {
    await sourceFolder.load();

    const files: IFile[] = [];

    for (const filePath in sourceFolder.files) {
      const file = sourceFolder.files[filePath];

      if (file) {
        files.push(file);
      }
    }

    await this.addLooseFiles(project, files, log);

    if (processSubFolders) {
      // first pass: see if the root folder contains any structured 'known' Minecraft Folders
      for (const folderName in sourceFolder.folders) {
        const folderNameToLower = folderName.toLowerCase().trim();
        const childFolder = sourceFolder.folders[folderName];

        if (childFolder) {
          if (minecraftIndicatorFolderNames.includes(folderNameToLower)) {
            // handle what looks like special minecraft folders in some way
          }
        }
      }

      for (const folderName in sourceFolder.folders) {
        const folderNameToLower = folderName.toLowerCase().trim();
        const childFolder = sourceFolder.folders[folderName];

        if (childFolder) {
          if (!minecraftIndicatorFolderNames.includes(folderNameToLower)) {
            // treat non-Minecraft indicated folders as loose files
            if (childFolder) {
              await this.addFromFolder(project, childFolder, true);
            }
          }
        }
      }
    }
  }

  async addLooseFiles(project: Project, files: IFile[], log?: (message: string) => Promise<void>) {
    for (const file of files) {
      const extension = StorageUtilities.getTypeFromName(file.name);

      if (file.name.indexOf("evel") >= 0 && extension === "dat") {
        if (!file.isContentLoaded) {
          await file.loadContent();
        }

        if (file.content && file.content instanceof Uint8Array) {
          const levelDat = new WorldLevelDat();

          try {
            levelDat.loadFromNbtBytes(file.content);

            if (!levelDat.isInErrorState) {
              this.candidateFiles[file.storageRelativePath] = {
                file: file,
                levelDat: levelDat,
                type: ProjectItemType.levelDat,
              };
            }
          } catch (e: any) {
            if (log) {
              log("Error processing " + file.name + " (" + e.toString() + ")");
            }
          }
        }
      } else if (file.name.indexOf("RRENT") >= 0) {
        await this.considerCURRENTFile(file, log);
      } else if (file.name.indexOf("NIFEST") >= 0) {
        await this.considerMANIFESTFile(file, log);
      } else {
        switch (extension) {
          case "ldb":
            if (!file.isContentLoaded) {
              await file.loadContent();
            }

            if (file.isBinary) {
              const levelDb = new LevelDb([file], [], [], file.name);

              try {
                await levelDb.init(log);

                Utilities.appendErrors(this, levelDb);

                if (!levelDb.isInErrorState) {
                  this.candidateFiles[file.storageRelativePath] = {
                    file: file,
                    index: ProjectIntegrator.getIndexFromString(file.name),
                    levelDbSubset: levelDb,
                    type: ProjectItemType.levelDbLdb,
                  };
                }
              } catch (e: any) {
                const error = this._pushError("Error processing ldb file " + file.name + " (" + e.toString() + ")");

                if (log) {
                  log(error);
                }
              }
            }
            break;
          case "log":
            await file.loadContent(false, EncodingType.ByteBuffer);

            if (file.isBinary) {
              const levelDb = new LevelDb([], [file], [], file.name);

              try {
                await levelDb.init(log);

                Utilities.appendErrors(this, levelDb);

                if (!levelDb.isInErrorState) {
                  this.candidateFiles[file.storageRelativePath] = {
                    file: file,
                    index: ProjectIntegrator.getIndexFromString(file.name),
                    levelDbSubset: levelDb,
                    type: ProjectItemType.levelDbLog,
                  };
                }
              } catch (e: any) {
                const error = this._pushError("Error processing log file " + file.name + " (" + e.toString() + ")");

                if (log) {
                  log(error);
                }
              }
            }
            break;
        }
      }
    }
  }

  async considerCURRENTFile(file: IFile, log?: (message: string) => Promise<void>) {
    await file.loadContent(false, EncodingType.Utf8String);

    if (file.content && typeof file.content === "string") {
      if (file.content.startsWith("MANIFEST")) {
        this.worlds.push({
          currentFile: file,
          currentManifest: file.content.trim(),
          manifestFiles: [],
          ldbFiles: [],
          logFiles: [],
        });
      }
    }
  }

  static getIndexFromString(fileName: string) {
    fileName = StorageUtilities.getBaseFromName(fileName.trim());

    const lastDash = fileName.lastIndexOf("-");

    if (lastDash >= 0) {
      fileName = fileName.substring(lastDash + 1);
    }

    let zeroStart = -1;

    let adjustStr = "";
    let index = 0;
    for (const char of fileName) {
      if (char >= "1" && char <= "9") {
        if (zeroStart >= 0) {
          adjustStr += char;
        }
      } else if (char === "0") {
        zeroStart = index;
        adjustStr += char;
      } else if (zeroStart >= 0) {
        break;
      }

      index++;
    }

    if (adjustStr.length > 4) {
      fileName = adjustStr;
    }

    try {
      const num = parseInt(fileName);

      if (isNaN(num)) {
        return undefined;
      }
      return num;
    } catch (e) {}

    return undefined;
  }

  async considerMANIFESTFile(file: IFile, log?: (message: string) => Promise<void>) {
    await file.loadContent(false, EncodingType.ByteBuffer);

    if (file.isBinary) {
      const levelDb = new LevelDb([], [], [file], file.name);

      try {
        await levelDb.init(log);

        Utilities.appendErrors(this, levelDb);

        if (!levelDb.isInErrorState) {
          this.candidateFiles[file.storageRelativePath] = {
            file: file,
            index: ProjectIntegrator.getIndexFromString(file.name),
            levelDbSubset: levelDb,
            type: ProjectItemType.levelDbManifest,
          };
        }
      } catch (e: any) {
        const error = this._pushError("Error processing MANIFEST file " + file.name + " (" + e.toString() + ")");

        if (log) {
          log(error);
        }
      }
    }
  }
}
