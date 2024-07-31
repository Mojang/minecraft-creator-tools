// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Project from "./Project";
import ProjectItem from "./ProjectItem";
import MCWorld from "./../minecraft/MCWorld";
import StorageUtilities from "./../storage/StorageUtilities";
import Utilities from "../core/Utilities";
import Database from "./../minecraft/Database";
import IFolder from "./../storage/IFolder";
import Log from "../core/Log";
import Carto from "./Carto";
import GitHubStorage from "./../github/GitHubStorage";
import AppServiceProxy, { AppServiceProxyCommands } from "./../core/AppServiceProxy";
import IGitHubInfo from "./IGitHubInfo";
import ZipStorage from "../storage/ZipStorage";
import { ProjectFocus } from "../app/IProjectData";
import { IWorldSettings } from "../minecraft/IWorldSettings";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import ProjectUpdateRunner from "../updates/ProjectUpdateRunner";
import CartoApp from "./CartoApp";
import HttpStorage from "../storage/HttpStorage";
import ProjectBuild from "./ProjectBuild";
import { Generator } from "../minecraft/WorldLevelDat";
import IConversionSettings from "../core/IConversionSettings";

export default class ProjectExporter {
  static async generateFlatBetaApisWorldWithPacksZipBytes(carto: Carto, project: Project, name: string) {
    await Database.loadContent();

    if (Database.contentFolder === null) {
      Log.unexpectedNull();
      return undefined;
    }

    const mcworld = await this.generateBetaApisWorldWithPacks(project, name, undefined, {
      generator: Generator.flat,
    });

    if (!mcworld) {
      return undefined;
    }

    const newBytes = await mcworld.getBytes();

    return newBytes;
  }

  static async syncProjectFromGitHub(
    isNewProject: boolean,
    carto: Carto,
    gitHubRepoName: string,
    gitHubOwner: string,
    gitHubBranch: string | undefined,
    gitHubFolder: string | undefined,
    projName: string | undefined,
    project: Project | undefined,
    fileList: string[] | undefined,
    messageUpdater?: (message: string) => Promise<void>
  ) {
    let gh = undefined;

    if (CartoApp.isWeb) {
      gh = new HttpStorage(
        CartoApp.contentRoot +
          "res/samples/" +
          gitHubOwner +
          "/" +
          gitHubRepoName +
          "-" +
          (gitHubBranch ? gitHubBranch : "main") +
          "/" +
          gitHubFolder
      );
    } else {
      gh = new GitHubStorage(carto.anonGitHub, gitHubRepoName, gitHubOwner, gitHubBranch, gitHubFolder);
    }

    if (!projName) {
      projName = "local " + gitHubOwner + " " + gitHubRepoName;

      if (gitHubFolder !== undefined) {
        projName += " " + gitHubFolder.replace(/\//gi, " ");
        projName = projName.replace(" behavior_packs", "");
      }
    }

    const newProjectName = await carto.getNewProjectName(projName);

    if (!project) {
      project = await carto.createNewProject(newProjectName, undefined, ProjectFocus.gameTests, false);
    }

    /*if (fileList) {
      await gh.rootFolder.setStructureFromFileList(fileList);
    } else {*/
    await gh.rootFolder.load();
    //}

    const rootFolder = await project.ensureProjectFolder();

    await StorageUtilities.syncFolderTo(
      gh.rootFolder,
      rootFolder,
      false,
      false,
      false,
      ["build", "node_modules", "dist", "lib", "/.git", "out"],
      undefined,
      messageUpdater
    );

    await rootFolder.saveAll();

    if (isNewProject) {
      await this.renameDefaultFolders(project, projName);

      project.originalGitHubOwner = gitHubOwner;
      project.originalGitHubRepoName = gitHubRepoName;
      project.originalGitHubBranch = gitHubBranch;
      project.originalGitHubFolder = gitHubFolder;
      project.originalFileList = fileList;
    }

    await project.inferProjectItemsFromFiles(true);

    const pur = new ProjectUpdateRunner(project);

    await pur.updateProject();

    await project.save(true);

    await carto.save();

    return project;
  }

  static async renameDefaultFolders(project: Project, newTokenName: string) {
    const bpFolder = await project.getDefaultBehaviorPackFolder(true);
    const rpFolder = await project.getDefaultResourcePackFolder(true);

    newTokenName = MinecraftUtilities.makeNameFolderSafe(newTokenName);

    if (bpFolder) {
      try {
        await bpFolder.rename(newTokenName);
      } catch (e) {
        // perhaps folder could not be renamed because a folder exists; continue in this case.
      }
    }

    if (rpFolder) {
      try {
        await rpFolder.rename(newTokenName);
      } catch (e) {
        // perhaps folder could not be renamed because a folder exists; continue in this case.
      }
    }
  }

  static async addGitHubReference(
    carto: Carto,
    project: Project,
    gitHubOwner: string,
    gitHubRepoName: string,
    gitHubBranch?: string,
    gitHubFolder?: string,
    commit?: string,
    title?: string
  ) {
    const gh = new GitHubStorage(carto.anonGitHub, gitHubRepoName, gitHubOwner, gitHubBranch, gitHubFolder);

    await gh.rootFolder.load();

    const info: IGitHubInfo = {
      owner: gitHubOwner,
      repoName: gitHubRepoName,
      branch: gitHubBranch,
      folder: gitHubFolder,
      commit: commit,
      title: title,
    };

    const sig = ProjectItem.getGitHubSignature(info);
    let foundReference = false;

    for (let i = 0; i < project.gitHubReferences.length; i++) {
      const ghr = project.gitHubReferences[i];

      const sigCandidate = ProjectItem.getGitHubSignature(ghr);

      if (sigCandidate === sig) {
        foundReference = true;

        project.gitHubReferences[i] = info;
      }
    }

    if (!foundReference) {
      project.gitHubReferences.push(info);
    }

    const bpFolder = await project.ensureDefaultBehaviorPackFolder();

    // run infer project items before we add the project items just to catch up on anything that might be out there.
    await project.inferProjectItemsFromFiles();

    const existingProjects: string[] = [];

    for (let i = 0; i < project.items.length; i++) {
      const spath = project.items[i].projectPath;

      if (spath !== undefined && spath !== null) {
        existingProjects.push(spath);
      }
    }

    let ghFolder: IFolder = gh.rootFolder;

    const bpGhFolder = await ProjectExporter.getPackFolder(ghFolder, false);

    if (bpGhFolder !== undefined) {
      ghFolder = bpGhFolder;
    }

    await StorageUtilities.syncFolderTo(ghFolder, bpFolder, false, false, false, ["/.git"]);

    await bpFolder.saveAll();

    await project.inferProjectItemsFromFiles(true);

    for (let i = 0; i < project.items.length; i++) {
      const item = project.items[i];

      const spath = item.projectPath;

      if (spath !== undefined && spath !== null && !existingProjects.includes(spath)) {
        item.gitHubReference = info;
      }
    }

    await project.save();
  }

  static async getPackFolder(folder: IFolder, seekingResource: boolean) {
    await folder.load();

    const manifest = folder.files["manifest.json"];

    if (manifest !== undefined) {
      const parentFolder = folder.parentFolder;

      let isResource = false;

      if (parentFolder !== null) {
        const name = StorageUtilities.canonicalizeName(parentFolder.name);

        if (name.indexOf("resource") >= 0) {
          isResource = true;
        }
      }

      if (seekingResource && isResource) {
        return folder;
      } else if (!seekingResource) {
        return folder;
      }
    } else {
      for (const folderName in folder.folders) {
        const childFolder = folder.folders[folderName];

        if (childFolder !== undefined && !childFolder.errorStatus) {
          const result = (await ProjectExporter.getPackFolder(childFolder, seekingResource)) as IFolder | undefined;

          if (result !== undefined) {
            return result;
          }
        }
      }
    }

    return undefined;
  }

  static async ensureWorldsFolder(rootMinecraftFolder: IFolder) {
    let worldsFolder = await rootMinecraftFolder.getFolderFromRelativePath("/minecraftWorlds/");

    if (!worldsFolder) {
      worldsFolder = await rootMinecraftFolder.getFolderFromRelativePath("/worlds/");
    }

    if (!worldsFolder) {
      worldsFolder = await rootMinecraftFolder.ensureFolderFromRelativePath("/minecraftWorlds/");
    }

    if (!worldsFolder) {
      Log.unexpectedUndefined("EWF");
      return undefined;
    }

    await worldsFolder.ensureExists();

    return worldsFolder;
  }

  static async ensureMinecraftWorldsFolder(carto: Carto) {
    if (carto.deploymentStorage === null) {
      Log.unexpectedUndefined("EMWF");
      return undefined;
    }

    return await this.ensureWorldsFolder(carto.deploymentStorage.rootFolder);
  }

  static async deployAsWorldAndTestAssets(
    carto: Carto,
    project: Project,
    worldProjectItem: ProjectItem,
    returnZipBytes: boolean,
    deployFolder?: IFolder
  ) {
    let mcworld: MCWorld | undefined;
    const operId = await carto.notifyOperationStarted(
      "Deploying world '" + worldProjectItem.name + "' and test assets."
    );
    await worldProjectItem.load();

    if (!worldProjectItem.file && !worldProjectItem.folder) {
      Log.unexpectedUndefined("DAWATA");
      return;
    }

    if (worldProjectItem.folder) {
      mcworld = await MCWorld.ensureMCWorldOnFolder(worldProjectItem.folder, project);
    } else if (worldProjectItem.file) {
      mcworld = await MCWorld.ensureOnFile(worldProjectItem.file, project);
    }

    if (!mcworld) {
      Log.debugAlert("Could not find respective world.");
      return;
    }

    await ProjectExporter.updateProjects(project);

    await project.save();

    const projectBuild = new ProjectBuild(project);

    await projectBuild.build();

    if (projectBuild.isInErrorState) {
      project.appendErrors(projectBuild);
      await carto.notifyOperationEnded(operId, "Packaging the world not be completed.", undefined, true);
      return;
    }

    const dateNow = new Date();

    const title = mcworld.name + " - " + Utilities.getFriendlySummary(dateNow);

    let targetFolder: IFolder | undefined;
    let zipStorage: ZipStorage | undefined;

    if (deployFolder) {
      const worldsFolder = await ProjectExporter.ensureWorldsFolder(deployFolder);

      if (!worldsFolder) {
        Log.unexpectedUndefined("DAWATAB");
        return;
      }

      targetFolder = worldsFolder.ensureFolder(title);

      await targetFolder.ensureExists();
    } else if (returnZipBytes) {
      zipStorage = new ZipStorage();

      targetFolder = zipStorage.rootFolder;
    } else {
      const worldsFolder = await ProjectExporter.ensureMinecraftWorldsFolder(carto);

      if (!worldsFolder) {
        Log.unexpectedUndefined("DAWATAC");
        return;
      }

      targetFolder = worldsFolder.ensureFolder(title);

      await targetFolder.ensureExists();
    }

    await mcworld.syncFolderTo(targetFolder);

    const bpGroupFolder = targetFolder.ensureFolder("behavior_packs");

    await bpGroupFolder.ensureExists();

    const bpFolder = await project.getDefaultBehaviorPackFolder();

    if (bpFolder) {
      const bpTargetFolder = bpGroupFolder.ensureFolder(bpFolder.name);

      await bpTargetFolder.ensureExists();

      await StorageUtilities.syncFolderTo(bpFolder, bpTargetFolder, true, true, false, [
        "mcworlds",
        "db",
        "level.dat",
        "level.dat_old",
        "levelname.txt",
        "behavior_packs",
        "resource_packs",
      ]);

      await projectBuild.syncToBehaviorPack(bpTargetFolder);
    }

    await targetFolder.saveAll();

    const newMcWorld = await MCWorld.ensureMCWorldOnFolder(targetFolder);

    if (!newMcWorld) {
      Log.debugAlert("Could not build new world.");
      return;
    }

    if (bpFolder) {
      newMcWorld.ensureBehaviorPack(
        project.defaultBehaviorPackUniqueId,
        project.defaultBehaviorPackVersion,
        bpFolder.name
      );
    }

    newMcWorld.betaApisExperiment = true;

    await targetFolder.saveAll();

    await newMcWorld.save();

    await carto.notifyOperationEnded(operId, "World + local assets deploy completed.");

    if (zipStorage) {
      const zipBytes = await zipStorage.generateUint8ArrayAsync();

      return zipBytes;
    }

    return undefined;
  }

  static async deployAsWorld(
    carto: Carto,
    project: Project,
    worldProjectItem: ProjectItem,
    returnZipBytes: boolean,
    deployFolder?: IFolder
  ) {
    let mcworld: MCWorld | undefined;
    const operId = await carto.notifyOperationStarted("Deploying world '" + worldProjectItem.name + "'");
    await worldProjectItem.load();

    if (!worldProjectItem.file && !worldProjectItem.folder) {
      Log.unexpectedUndefined("DAWATA");
      return;
    }

    if (worldProjectItem.folder) {
      mcworld = await MCWorld.ensureMCWorldOnFolder(worldProjectItem.folder, project);
    } else if (worldProjectItem.file) {
      mcworld = await MCWorld.ensureOnFile(worldProjectItem.file, project);
    }

    if (!mcworld) {
      Log.debugAlert("Could not find respective world.");
      return;
    }

    await ProjectExporter.updateProjects(project);

    await project.save();

    const projectBuild = new ProjectBuild(project);

    await projectBuild.build();

    if (projectBuild.isInErrorState) {
      project.appendErrors(projectBuild);
      await carto.notifyOperationEnded(operId, "World could not be packaged.", undefined, true);
      return;
    }

    const dateNow = new Date();

    const title = mcworld.name + " - " + Utilities.getFriendlySummary(dateNow);

    let targetFolder: IFolder | undefined;
    let zipStorage: ZipStorage | undefined;

    if (deployFolder) {
      const worldsFolder = await ProjectExporter.ensureWorldsFolder(deployFolder);

      if (!worldsFolder) {
        Log.unexpectedUndefined("DAWATAB");
        return;
      }

      targetFolder = worldsFolder.ensureFolder(title);

      await targetFolder.ensureExists();
    } else if (returnZipBytes) {
      zipStorage = new ZipStorage();

      targetFolder = zipStorage.rootFolder;
    } else {
      const worldsFolder = await ProjectExporter.ensureMinecraftWorldsFolder(carto);

      if (!worldsFolder) {
        Log.unexpectedUndefined("DAWATAC");
        return;
      }

      targetFolder = worldsFolder.ensureFolder(title);

      await targetFolder.ensureExists();
    }

    await mcworld.syncFolderTo(targetFolder);

    await targetFolder.saveAll();

    await carto.notifyOperationEnded(operId, "World + local assets deploy completed.");

    if (zipStorage) {
      const zipBytes = await zipStorage.generateUint8ArrayAsync();

      return zipBytes;
    }

    return undefined;
  }
  static async updateProjects(project: Project) {
    const pur = new ProjectUpdateRunner(project);

    await pur.updateProject(["SCRIPTMODULE"]);
  }

  static async generateWorldWithPacks(
    carto: Carto,
    project: Project,
    worldSettings: IWorldSettings,
    targetFolder?: IFolder
  ) {
    const operId = await carto.notifyOperationStarted("Generating world and packs for '" + project.name + "'.");

    await ProjectExporter.updateProjects(project);

    await project.save();

    const projectBuild = new ProjectBuild(project);

    await projectBuild.build();

    if (projectBuild.isInErrorState) {
      project.appendErrors(projectBuild);
      await carto.notifyOperationEnded(operId, "Packaging the world could not be completed.", undefined, true);
      return;
    }

    let mcworld = undefined;

    if (targetFolder === undefined) {
      mcworld = new MCWorld();

      mcworld.ensureZipStorage();

      targetFolder = mcworld.effectiveRootFolder;

      if (targetFolder === undefined) {
        Log.throwUnexpectedUndefined("PEPW");
        return;
      }
    } else {
      mcworld = await MCWorld.ensureMCWorldOnFolder(targetFolder);
    }

    if (!mcworld) {
      Log.debugAlert("Could not find respective world.");
      return;
    }

    await mcworld.load(false);

    await mcworld.applyWorldSettings(worldSettings);

    const behaviorPackFolder = await project.getDefaultBehaviorPackFolder();
    const scriptsFolder = await project.getMainScriptsFolder();

    if (behaviorPackFolder) {
      const bpGroupFolder = targetFolder.ensureFolder("behavior_packs");

      await bpGroupFolder.ensureExists();

      const bpTargetFolder = bpGroupFolder.ensureFolder(behaviorPackFolder.name);

      await bpTargetFolder.ensureExists();

      await StorageUtilities.syncFolderTo(behaviorPackFolder, bpTargetFolder, true, true, false, [
        "mcworlds",
        "db",
        "level.dat",
        "level.dat_old",
        "levelname.txt",
        "behavior_packs",
        "resource_packs",
      ]);

      await projectBuild.syncToBehaviorPack(bpTargetFolder);

      if (scriptsFolder && scriptsFolder.parentFolder !== behaviorPackFolder) {
        const scriptsTargetFolder = bpTargetFolder.ensureFolder("scripts");

        await scriptsTargetFolder.ensureExists();

        await StorageUtilities.syncFolderTo(scriptsFolder, scriptsTargetFolder, true, true, false, ["*.ts"]);
      }

      mcworld.ensureBehaviorPack(
        project.defaultBehaviorPackUniqueId,
        project.defaultBehaviorPackVersion,
        behaviorPackFolder.name
      );
    }

    const resourcePackFolder = await project.getDefaultResourcePackFolder();

    if (resourcePackFolder) {
      const rpGroupFolder = targetFolder.ensureFolder("resource_packs");

      await rpGroupFolder.ensureExists();

      const rpTargetFolder = rpGroupFolder.ensureFolder(resourcePackFolder.name);

      await rpTargetFolder.ensureExists();

      await StorageUtilities.syncFolderTo(resourcePackFolder, rpTargetFolder, true, true, false, [
        "mcworlds",
        "db",
        "level.dat",
        "level.dat_old",
        "levelname.txt",
        "behavior_packs",
        "resource_packs",
      ]);

      mcworld.ensureResourcePack(
        project.defaultResourcePackUniqueId,
        project.defaultResourcePackVersion,
        resourcePackFolder.name
      );
    }

    mcworld.betaApisExperiment = true;
    mcworld.name = project.name;

    await targetFolder.saveAll();

    await mcworld.save();

    await carto.notifyOperationEnded(
      operId,
      "World + local assets generation for '" + targetFolder.fullPath + "' completed."
    );

    return mcworld;
  }

  static async deployProjectAndGeneratedWorldTo(
    carto: Carto,
    project: Project,
    worldSettings: IWorldSettings,
    deployFolder: IFolder
  ) {
    const operId = await carto.notifyOperationStarted(
      "Deploying project '" + project.name + "' plus world and test assets."
    );

    await project.ensureLoadedProjectFolder();

    const title = project.name + " Test World";

    let targetFolder: IFolder | undefined;

    if (deployFolder) {
      const worldsFolder = await ProjectExporter.ensureWorldsFolder(deployFolder);

      if (!worldsFolder) {
        Log.unexpectedUndefined("DPWATAD");
        return;
      }

      targetFolder = worldsFolder.ensureFolder(title);

      await targetFolder.ensureExists();
    } else {
      const worldsFolder = await ProjectExporter.ensureMinecraftWorldsFolder(carto);

      if (!worldsFolder) {
        Log.unexpectedUndefined("DPWATAE");
        return;
      }

      targetFolder = worldsFolder.ensureFolder(title);

      await targetFolder.ensureExists();
    }

    const mcworld = await ProjectExporter.generateWorldWithPacks(carto, project, worldSettings, targetFolder);

    if (mcworld) {
      await targetFolder.saveAll();

      await mcworld.save();
    }

    await carto.notifyOperationEnded(
      operId,
      "World + local assets deploy to '" + targetFolder.fullPath + "' completed."
    );

    return title;
  }

  static async deployAsFlatPackRefWorld(carto: Carto, project: Project) {
    carto.notifyStatusUpdate("Saving...");
    await ProjectExporter.updateProjects(project);

    await project.save();
    carto.notifyStatusUpdate("Saved");

    // only do an explicit deploy here autodeployment is not turned on; otherwise, deployment should happen in the save() above.
    if (
      //  project.autoDeploymentMode !== ProjectAutoDeploymentMode.deployOnSave &&
      carto.deploymentStorage !== null &&
      carto.deployBehaviorPacksFolder !== null &&
      carto.activeMinecraft
    ) {
      carto.notifyStatusUpdate("Deploying pack add-ons");
      carto.activeMinecraft.syncWithDeployment();
      carto.notifyStatusUpdate("Deployed");
    }

    const hash = project.defaultBehaviorPackUniqueId + "|";

    if (
      (project.lastMapDeployedHash === undefined || project.lastMapDeployedHash !== hash) &&
      carto.workingStorage !== null
    ) {
      ProjectExporter.generateAndInvokeFlatPackRefMCWorld(carto, project);

      project.lastMapDeployedHash = hash;
      project.lastMapDeployedDate = new Date();
    }
  }

  static async convertWorld(carto: Carto, project: Project, settings: IConversionSettings, world?: MCWorld) {
    if (!world) {
      return;
    }

    if (carto.workingStorage === null) {
      Log.fail("Did not find expected working storage.");
      return;
    }
    const dtNow = new Date();
    const tempWorkingPathName = "WorldConvert" + Utilities.getDateStr(dtNow);

    const workingFolder = carto.workingStorage.rootFolder.ensureFolder(tempWorkingPathName);

    if (world) {
      const inputFolder = workingFolder.ensureFolder("source-" + settings.name);

      await world.copyAsFolderTo(inputFolder);
    }

    const jsonContent = JSON.stringify(settings);

    await AppServiceProxy.sendAsync(AppServiceProxyCommands.convertFile, jsonContent, true);

    await workingFolder.load(true);

    if (workingFolder.folderExists(settings.name)) {
      const outputFolder = workingFolder.ensureFolder(settings.name);

      const zs = new ZipStorage();

      await StorageUtilities.syncFolderTo(outputFolder, zs.rootFolder, false, false, false);

      const resultBytes = zs.generateCompressedUint8ArrayAsync();

      return resultBytes;
    }

    return undefined;
  }

  static async syncFlatPackRefWorldTo(carto: Carto, project: Project, worldFolder: IFolder, name: string) {
    if (carto.workingStorage === null) {
      Log.fail("Did not find expected working storage.");
      return;
    }

    const mcworld = await ProjectExporter.generateFlatGameTestWorldWithPackRefs(project, name);

    if (mcworld !== undefined) {
      // Log.debugAlert("Synchronizing '" + worldFolder.name + "' with '" + worldFolder.files.length + "' files");

      await mcworld.syncFolderTo(worldFolder);
    } else {
      Log.fail("Could not retrieve flat game test world");
    }
  }

  static async generateAndInvokeFlatPackRefMCWorld(carto: Carto, project: Project) {
    if (carto.workingStorage === null) {
      Log.fail("Did not find expected working storage.");
      return;
    }

    const fileName = project.name + " flatpack.mcworld";
    const name = project.name + " Flat GameTest";

    const mcworld = await ProjectExporter.generateFlatGameTestWorldWithPackRefs(project, name);

    if (mcworld !== undefined) {
      const newBytes = await mcworld.getBytes();

      if (newBytes !== undefined) {
        const file = carto.workingStorage.rootFolder.ensureFile(fileName);

        file.setContent(newBytes);

        await file.saveContent();

        if (AppServiceProxy.hasAppService) {
          await AppServiceProxy.sendAsync(AppServiceProxyCommands.shellOpenPath, file.fullPath);
        }
      }
    }
  }

  static async generateFlatGameTestWorldWithPackRefs(project: Project, worldName: string) {
    await Database.loadContent();

    if (Database.contentFolder === null) {
      Log.unexpectedContentState();
      return undefined;
    }

    const file = Database.contentFolder.ensureFile("flatcreativegt.mcworld");

    await file.loadContent();

    if (file.content instanceof Uint8Array) {
      const mcworld = await this.generateBetaApisWorldWithPackRefs(project, worldName, file.content);

      return mcworld;
    }

    Log.fail("Unexpectedly could not find default content.");

    return undefined;
  }

  static async generatePackAsZip(carto: Carto, project: Project, returnAsBlob: boolean): Promise<Blob | Uint8Array> {
    const operId = await carto.notifyOperationStarted("Exporting '" + project.name + "' as MCPack");

    const zipStorage = new ZipStorage();

    const bpFolder = await project.getDefaultBehaviorPackFolder();

    if (bpFolder) {
      const childFolder = zipStorage.rootFolder.ensureFolder(bpFolder.name);

      await StorageUtilities.syncFolderTo(bpFolder, childFolder, true, true, false, [
        "/mcworlds",
        "/minecraftWorlds",
        "*.ts",
      ]);

      const scriptsFolder = await project.ensureDefaultScriptsFolder();

      if (
        !scriptsFolder.storageRelativePath.startsWith(bpFolder.storageRelativePath) &&
        scriptsFolder.storageRelativePath !== "/"
      ) {
        await StorageUtilities.syncFolderTo(scriptsFolder, childFolder.ensureFolder("scripts"), true, false, false, [
          ".ts",
        ]);
      }
    }

    const rpFolder = await project.getDefaultResourcePackFolder();

    if (rpFolder) {
      let rpFolderName = rpFolder.name;

      if (bpFolder && bpFolder.name === rpFolderName) {
        rpFolderName += "rp";
      }

      const childFolder = zipStorage.rootFolder.ensureFolder(rpFolderName);

      await StorageUtilities.syncFolderTo(rpFolder, childFolder, true, true, false, ["/mcworlds", "/minecraftWorlds"]);
    }

    await zipStorage.rootFolder.saveAll();

    if (returnAsBlob) {
      const zipBinary = await zipStorage.generateBlobAsync();

      await carto.notifyOperationEnded(operId, "Export MCPack of '" + project.name + "' created; downloading...");

      return zipBinary;
    } else {
      const zipBytes = await zipStorage.generateUint8ArrayAsync();

      return zipBytes;
    }
  }

  static async generateBetaApisWorldWithPacks(
    project: Project,
    worldName: string,
    worldContent?: Uint8Array,
    worldSettings?: IWorldSettings
  ): Promise<MCWorld | undefined> {
    await project.ensureLoadedProjectFolder();

    const mcworld = new MCWorld();

    if (worldContent) {
      mcworld.loadFromBytes(worldContent);
    } else if (!worldSettings) {
      const levelDat = mcworld.ensureLevelData();
      levelDat.ensureDefaults();
    }

    if (worldSettings) {
      mcworld.applyWorldSettings(worldSettings);
    }

    mcworld.project = project;

    await ProjectExporter.updateProjects(project);

    await project.save();

    const projectBuild = new ProjectBuild(project);

    await projectBuild.build();

    if (projectBuild.isInErrorState) {
      project.appendErrors(projectBuild);
      return undefined;
    }

    mcworld.betaApisExperiment = true;
    mcworld.name = worldName;

    const rootFolder = mcworld.storage.rootFolder;

    const sourceBpf = await project.ensureDefaultBehaviorPackFolder();

    const bp = rootFolder.ensureFolder("behavior_packs");

    const bpf = bp.ensureFolder(project.name);

    if (sourceBpf !== null) {
      await bpf.ensureExists();
      mcworld.ensureBehaviorPack(project.defaultBehaviorPackUniqueId, project.defaultBehaviorPackVersion, project.name);

      await StorageUtilities.syncFolderTo(sourceBpf, bpf, true, false, false, ["/mcworlds", "/minecraftWorlds", ".ts"]);

      const scriptsFolder = await project.ensureDefaultScriptsFolder();

      if (
        !scriptsFolder.storageRelativePath.startsWith(sourceBpf.storageRelativePath) &&
        scriptsFolder.storageRelativePath !== "/"
      ) {
        await StorageUtilities.syncFolderTo(scriptsFolder, bpf.ensureFolder("scripts"), true, false, false, [".ts"]);
      }

      await projectBuild.syncToBehaviorPack(bpf);

      await bpf.saveAll();
    }

    const sourceRpf = await project.ensureDefaultResourcePackFolder();

    const rp = rootFolder.ensureFolder("resource_packs");

    const rpf = rp.ensureFolder(project.name);

    if (sourceRpf !== null) {
      await rpf.ensureExists();
      mcworld.ensureResourcePack(project.defaultResourcePackUniqueId, project.defaultResourcePackVersion, project.name);

      await StorageUtilities.syncFolderTo(sourceRpf, rpf, true, false, false, ["/mcworlds", "/minecraftWorlds", ".ts"]);

      await rpf.saveAll();
    }

    return mcworld;
  }

  static async generateBetaApisWorldWithPackRefs(
    project: Project,
    worldName: string,
    worldContent: Uint8Array
  ): Promise<MCWorld> {
    const mcworld = new MCWorld();
    mcworld.project = project;

    await mcworld.loadFromBytes(worldContent);

    const behaviorPackFolder = await project.getDefaultBehaviorPackFolder();

    if (behaviorPackFolder !== null) {
      mcworld.ensureBehaviorPack(project.defaultBehaviorPackUniqueId, project.defaultBehaviorPackVersion, project.name);
    }

    const resourcePackFolder = await project.getDefaultResourcePackFolder();
    if (resourcePackFolder !== null) {
      mcworld.ensureResourcePack(project.defaultResourcePackUniqueId, project.defaultResourcePackVersion, project.name);
    }

    mcworld.betaApisExperiment = true;
    mcworld.name = worldName;

    return mcworld;
  }
}
