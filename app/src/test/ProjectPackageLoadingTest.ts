// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Explicit package loading must not select saved project storage on failure, even on a retry.
 * These checks exercise shared Project loading independently of CLI preflight; CliDryRunTest
 * covers actual command exits, diagnostics, physical writes, and supported package formats.
 */

import { strict as assert } from "assert";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import Project, { ProjectAutoDeploymentMode, ProjectErrorState } from "../app/Project";
import { ProjectItemType } from "../app/IProjectItemData";
import ClUtils from "../cli/ClUtils";
import { DRY_RUN_READ_ONLY_REASON } from "../cli/core/DryRunGuard";
import NodeStorage from "../local/NodeStorage";
import FileBase from "../storage/FileBase";
import FolderBase from "../storage/FolderBase";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";
import { createTestDataDir } from "./TestDataDir";
import TestPaths, { ITestEnvironment } from "./TestPaths";

describe("explicit project package loading", function () {
  this.timeout(10000);

  let env: ITestEnvironment;
  let root: string;
  let savedStorageAccesses: number;
  let restore: () => void;

  before(async () => {
    env = await TestPaths.createTestEnvironment({ contentWebRoot: "" });
  });

  beforeEach(() => {
    root = createTestDataDir("project-package-loading");
    const { creatorTools } = env;
    const previousStorage = creatorTools.projectsStorage;
    const previousFileExists = creatorTools.localFileExists;
    const savedStorage = new NodeStorage(path.join(root, "projects"), "");
    const ensureFolder = savedStorage.rootFolder.ensureFolder.bind(savedStorage.rootFolder);

    savedStorageAccesses = 0;
    savedStorage.rootFolder.ensureFolder = (name: string) => {
      savedStorageAccesses++;
      return ensureFolder(name);
    };
    creatorTools.projectsStorage = savedStorage;
    creatorTools.localFileExists = ClUtils.localFileExists;
    restore = () => {
      creatorTools.projectsStorage = previousStorage;
      creatorTools.localFileExists = previousFileExists;
    };
  });

  afterEach(() => restore());

  function createProject(name = "input.mcaddon"): Project {
    fs.cpSync(TestPaths.sampleContentPath("simple"), path.join(root, "projects", name), { recursive: true });
    const project = new Project(env.creatorTools, name, null);
    project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
    return project;
  }

  async function writePackage(filePath: string) {
    fs.writeFileSync(
      filePath,
      await new JSZip().file("content.txt", "from the requested package").generateAsync({ type: "nodebuffer" })
    );
  }

  const invalidInputs = [
    {
      name: "a missing file",
      fileName: "input.mcaddon",
      content: undefined,
      errorState: ProjectErrorState.projectFolderOrFileDoesNotExist,
      cause: "The file does not exist.",
    },
    {
      name: "a malformed archive",
      fileName: "input.mcaddon",
      content: "not a zip file",
      errorState: ProjectErrorState.cabinetFileCouldNotBeProcessed,
      cause: "Can't find end of central directory",
    },
    {
      name: "a non-package file",
      fileName: "input.txt",
      content: "{}",
      errorState: ProjectErrorState.cabinetFileCouldNotBeProcessed,
      cause: "The file could not be read as a package.",
    },
  ];

  for (const input of invalidInputs) {
    for (const dryRun of [false, true]) {
      it(`rejects ${input.name} without accessing saved storage, dryRun=${dryRun}`, async () => {
        const project = createProject(input.fileName);
        const filePath = path.join(root, input.fileName);
        project.localFilePath = filePath;
        if (dryRun) {
          project.readOnlyReason = DRY_RUN_READ_ONLY_REASON;
          project.readOnlySafety = true;
        }
        if (input.content !== undefined) {
          fs.writeFileSync(filePath, input.content);
        }

        await assert.rejects(project.inferProjectItemsFromFiles(), (error: Error) => {
          expect(error.message).to.include(`Can't open package '${filePath}'`);
          expect(error.message).to.include(input.cause);
          expect(error.message).not.to.include(DRY_RUN_READ_ONLY_REASON);
          return true;
        });
        await assert.rejects(project.ensureProjectFolder(), /Can't open package/);

        expect(project.errorState).to.equal(input.errorState);
        expect(project.errorMessage).to.include(input.cause);
        expect(project.projectFolder).to.equal(null);
        expect(project.items).to.be.empty;
        expect(savedStorageAccesses, "no saved folder should even be selected").to.equal(0);
      });
    }
  }

  it("does not fall back when local package access is unavailable", async () => {
    const project = createProject();
    project.localFilePath = path.join(root, project.name);
    await writePackage(project.localFilePath);
    env.creatorTools.localFileExists = undefined;

    await assert.rejects(project.ensureProjectFolder(), /Local package access is not available/);
    expect(project.projectFolder).to.equal(null);
    expect(savedStorageAccesses).to.equal(0);
  });

  it("loads the corrected package on retry and clears its earlier error", async () => {
    const project = createProject();
    project.localFilePath = path.join(root, project.name);
    fs.writeFileSync(project.localFilePath, "not a zip file");

    await assert.rejects(project.ensureProjectFolder(), /Can't open package/);
    await writePackage(project.localFilePath);
    const folder = await project.ensureProjectFolder();
    const content = folder.ensureFile("content.txt");
    await content.loadContent();

    expect(content.content).to.equal("from the requested package");
    expect(folder.storage).to.be.instanceOf(ZipStorage);
    expect(project.errorState).to.equal(ProjectErrorState.noError);
    expect(project.errorMessage).to.equal(undefined);
    expect(savedStorageAccesses).to.equal(0);
  });

  for (const missing of [false, true]) {
    it(`clears a previously loaded folder when reloading a ${missing ? "missing" : "malformed"} package`, async () => {
      const project = createProject();
      project.localFilePath = path.join(root, project.name);
      await writePackage(project.localFilePath);
      await project.ensureProjectFolder();

      if (missing) {
        fs.unlinkSync(project.localFilePath);
      } else {
        fs.writeFileSync(project.localFilePath, "not a zip file");
      }

      await assert.rejects(project.ensureProjectFolder(true), /Can't open package/);
      await assert.rejects(project.ensureProjectFolder(), /Can't open package/);
      expect(project.projectFolder).to.equal(null);
      expect(savedStorageAccesses).to.equal(0);
    });
  }

  describe("persistent package file caches", () => {
    let storage: NodeStorage;
    let restoreLocalFolder: () => void;

    beforeEach(() => {
      storage = new NodeStorage(root, "");
      const ensureLocalFolder = env.creatorTools.ensureLocalFolder;
      env.creatorTools.ensureLocalFolder = (folderPath) => {
        expect(path.resolve(folderPath)).to.equal(path.resolve(root));
        return storage.rootFolder;
      };
      restoreLocalFolder = () => {
        env.creatorTools.ensureLocalFolder = ensureLocalFolder;
      };
    });

    afterEach(() => restoreLocalFolder());

    it("rejects an unchanged malformed package on every attempt with the same file instance", async () => {
      const project = createProject();
      project.localFilePath = path.join(root, project.name);
      fs.writeFileSync(project.localFilePath, "not a zip file");
      const file = storage.rootFolder.ensureFile(project.name);

      await assert.rejects(ZipStorage.loadFromFile(file), /end of central directory/);
      expect(file.fileContainerStorage, "a failed first parse never installs a container").to.equal(null);

      for (let attempt = 0; attempt < 2; attempt++) {
        await assert.rejects(project.ensureProjectFolder(), /Can't open package/);
        expect(storage.rootFolder.ensureFile(project.name)).to.equal(file);
        expect(project.projectFolder).to.equal(null);
      }
      expect(savedStorageAccesses).to.equal(0);
    });

    it("rereads corrected bytes from disk after rejecting a persistent file", async () => {
      const project = createProject();
      project.localFilePath = path.join(root, project.name);
      fs.writeFileSync(project.localFilePath, "not a zip file");
      const file = storage.rootFolder.ensureFile(project.name);

      await assert.rejects(project.ensureProjectFolder(), /Can't open package/);
      await writePackage(project.localFilePath);
      const folder = await project.ensureProjectFolder();
      const content = folder.ensureFile("content.txt");
      await content.loadContent();

      expect(storage.rootFolder.ensureFile(project.name)).to.equal(file);
      expect(content.content).to.equal("from the requested package");
      expect(project.errorState).to.equal(ProjectErrorState.noError);
      expect(project.errorMessage).to.equal(undefined);
      expect(file.isDisposed).to.equal(false);
      expect(savedStorageAccesses).to.equal(0);
    });

    it("accepts corrected content supplied through the same persistent file after a rejection", async () => {
      const project = createProject();
      project.localFilePath = path.join(root, project.name);
      fs.writeFileSync(project.localFilePath, "not a zip file");
      const file = storage.rootFolder.ensureFile(project.name);

      await assert.rejects(project.ensureProjectFolder(), /Can't open package/);
      file.setContent(await new JSZip().file("repaired.txt", "repaired content").generateAsync({ type: "uint8array" }));
      const folder = await project.ensureProjectFolder();
      const content = folder.ensureFile("repaired.txt");
      await content.loadContent();

      expect(content.content).to.equal("repaired content");
      expect(project.errorState).to.equal(ProjectErrorState.noError);
      expect(savedStorageAccesses).to.equal(0);
    });

    it("does not return stale valid contents when a persistent file is force-reloaded after corruption", async () => {
      const project = createProject();
      project.localFilePath = path.join(root, project.name);
      await writePackage(project.localFilePath);
      await project.ensureProjectFolder();
      const file = storage.rootFolder.ensureFile(project.name);
      expect(file.fileContainerStorage).to.be.instanceOf(ZipStorage);
      fs.writeFileSync(project.localFilePath, "not a zip file");

      await assert.rejects(project.ensureProjectFolder(true), /Can't open package/);
      await assert.rejects(project.ensureProjectFolder(), /Can't open package/);
      expect(project.projectFolder).to.equal(null);
      expect(file.fileContainerStorage).to.equal(null);
      expect(file.isContentLoaded).to.equal(false);
      expect(project.projectCabinetFile).to.equal(null);
      expect(savedStorageAccesses).to.equal(0);
    });

    it("rejects a cached container after its loader fails to reload changed bytes", async () => {
      const project = createProject();
      project.localFilePath = path.join(root, project.name);
      await writePackage(project.localFilePath);
      const file = storage.rootFolder.ensureFile(project.name);
      await StorageUtilities.getFileStorageFolder(file);
      const cachedStorage = file.fileContainerStorage;
      assert(cachedStorage instanceof ZipStorage);
      const invalidBytes = Buffer.from("not a zip file");
      file.setContent(invalidBytes);
      await file.saveContent();
      await assert.rejects(cachedStorage.loadFromUint8Array(invalidBytes, file.name), /end of central directory/);
      expect(file.fileContainerStorage).to.equal(cachedStorage);

      await assert.rejects(project.ensureProjectFolder(), /Can't open package/);
      expect(project.projectFolder).to.equal(null);
      expect(file.fileContainerStorage).to.equal(null);
      expect(file.isContentLoaded).to.equal(false);
      expect(savedStorageAccesses).to.equal(0);

      await writePackage(project.localFilePath);
      const folder = await project.ensureProjectFolder();
      expect(folder.storage).not.to.equal(cachedStorage);
      expect(project.errorState).to.equal(ProjectErrorState.noError);
    });

    it("retains unsaved contents of a valid package during an ordinary ensure", async () => {
      const project = createProject();
      project.localFilePath = path.join(root, project.name);
      await writePackage(project.localFilePath);
      const folder = await project.ensureProjectFolder();
      const content = folder.ensureFile("content.txt");
      content.setContent("unsaved package edit");

      expect(await project.ensureProjectFolder()).to.equal(folder);
      expect(content.content).to.equal("unsaved package edit");
      expect(savedStorageAccesses).to.equal(0);
    });

    async function writePackPackage(filePath: string, marker: string, includePreferences = false) {
      const zip = new JSZip()
        .file(
          "behavior_packs/pack/manifest.json",
          JSON.stringify({
            format_version: 2,
            header: {
              name: marker,
              description: marker,
              uuid: "fa9eb4f9-460d-4a5b-a97b-82006d8b3232",
              version: [1, 0, 0],
              min_engine_version: [1, 21, 0],
            },
            modules: [{ type: "data", uuid: "b11b1ef5-0039-4d96-908f-95ea594db8d4", version: [1, 0, 0] }],
          })
        )
        .file(
          `behavior_packs/pack/entities/${marker}.json`,
          JSON.stringify({
            format_version: "1.21.0",
            "minecraft:entity": {
              description: { identifier: `test:${marker}`, is_spawnable: true, is_summonable: true },
              components: {},
            },
          })
        );
      if (includePreferences) {
        zip.file(".mct/prefs.mctp.json", "{}");
      }
      fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
    }

    async function writeResourcePackage(filePath: string, subpacks: string[]) {
      const zip = new JSZip().file(
        "resource_packs/pack/manifest.json",
        JSON.stringify({
          format_version: 2,
          header: {
            name: "Resource package",
            description: "Resource package",
            uuid: "29632f7c-a6be-4854-9a31-93a2a7b38ae7",
            version: [1, 0, 0],
            min_engine_version: [1, 21, 0],
          },
          modules: [{ type: "resources", uuid: "8f2ec1eb-9759-4b6a-abfe-8c8e7ef99cb2", version: [1, 0, 0] }],
          subpacks: subpacks.map((label, index) => ({
            folder_name: label,
            name: `${label} from package`,
            memory_tier: index + 1,
          })),
        })
      );
      fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));
    }

    for (const repair of [false, true]) {
      for (const behaviorOnly of [false, true]) {
        it(`drops discarded manifest variants after ${repair ? "repair" : "forced reload"}, behaviorOnly=${behaviorOnly}`, async () => {
          const project = createProject();
          project.localFilePath = path.join(root, project.name);
          await writeResourcePackage(project.localFilePath, ["low"]);
          await project.inferProjectItemsFromFiles();
          expect(project.variants.low?.memoryTier).to.equal(1);

          if (repair) {
            fs.writeFileSync(project.localFilePath, "not a zip file");
            await assert.rejects(project.ensureProjectFolder(true), /Can't open package/);
          }
          if (behaviorOnly) {
            await writePackPackage(project.localFilePath, "replacement");
          } else {
            await writeResourcePackage(project.localFilePath, []);
          }
          await project.ensureProjectFolder(!repair);
          await project.inferProjectItemsFromFiles();
          expect(Object.keys(project.variants)).not.to.include("low");

          const item = project.getItemsByType(
            behaviorOnly ? ProjectItemType.behaviorPackManifestJson : ProjectItemType.resourcePackManifestJson
          )[0];
          assert(item);
          const variant = item.ensureVariant("low").projectVariant;
          expect(variant.memoryTier, "a newly authored variant must not inherit discarded manifest data").to.equal(
            undefined
          );
          expect(variant.title).to.equal(undefined);
          expect(savedStorageAccesses).to.equal(0);
        });
      }

      it(`preserves external configured variants, including a subpack label, after ${repair ? "repair" : "forced reload"}`, async () => {
        const filePath = path.join(root, "input.mcaddon");
        await writeResourcePackage(filePath, ["low", "transient"]);
        const preferences = storage.rootFolder.ensureFile("external.mctp.json");
        const seed = new Project(env.creatorTools, "input.mcaddon", preferences);
        seed.localFilePath = filePath;
        seed.ensureVariant("configured").title = "External configuration";
        const configuredLow = seed.ensureVariant("low");
        configuredLow.title = "Configured low";
        configuredLow.memoryTier = 8;
        await seed.saveToFile();
        const preferencesBefore = fs.readFileSync(preferences.fullPath);

        const project = new Project(env.creatorTools, "input.mcaddon", preferences);
        project.autoDeploymentMode = ProjectAutoDeploymentMode.noAutoDeployment;
        await project.loadPreferencesAndFolder();
        await project.inferProjectItemsFromFiles();
        expect(project.variants.low?.memoryTier).to.equal(1);
        expect(project.variants.transient).not.to.equal(undefined);
        project.variants.low.title = "Unsaved current edit";
        await project.ensureProjectFolder();
        expect(project.variants.low.title).to.equal("Unsaved current edit");

        if (repair) {
          fs.writeFileSync(filePath, "not a zip file");
          await assert.rejects(project.ensureProjectFolder(true), /Can't open package/);
        }
        await writeResourcePackage(filePath, []);
        await project.ensureProjectFolder(!repair);
        await project.inferProjectItemsFromFiles();
        expect(Object.keys(project.variants)).not.to.include("transient");
        expect(project.variants.configured?.title).to.equal("External configuration");
        const manifest = project.getItemsByType(ProjectItemType.resourcePackManifestJson)[0];
        assert(manifest);
        const restored = manifest.ensureVariant("low").projectVariant;
        expect(restored.title).to.equal("Configured low");
        expect(restored.memoryTier).to.equal(8);
        expect(project.preferencesFile).to.equal(preferences);
        expect(fs.readFileSync(preferences.fullPath)).to.deep.equal(preferencesBefore);
        expect(savedStorageAccesses).to.equal(0);
      });
    }

    for (const repair of [false, true]) {
      for (const withAccessory of [false, true]) {
        it(`rebuilds inferred package state after ${repair ? "a rejected reload and repair" : "a valid forced reload"}, accessories=${withAccessory}`, async () => {
          const project = createProject();
          await project.ensureInflated();
          project.localFilePath = path.join(root, project.name);
          await writePackPackage(project.localFilePath, "original");
          const externalMetadata = { title: "Accessory metadata", marker: "external" };
          const externalFile = storage.rootFolder.ensureFile("input.data.json");
          if (withAccessory) {
            fs.writeFileSync(externalFile.fullPath, JSON.stringify(externalMetadata));
            project.accessoryFilePaths = ["input.data.json"];
          }

          const assertExternalAccessory = async () => {
            const accessories = project
              .getItemsByType(ProjectItemType.projectSummaryMetadata)
              .filter((item) => item.name === externalFile.name);
            expect(accessories).to.have.lengthOf(1);
            expect(await accessories[0].getJsonObject(), "read the external metadata, not a package decoy").to.deep.equal(
              externalMetadata
            );
            expect(accessories[0].primaryFile, "retain the exact external IFile binding").to.equal(externalFile);
          };

          await project.inferProjectItemsFromFiles();
          if (withAccessory) {
            await assertExternalAccessory();
          }
          const originalFolder = await project.getDefaultBehaviorPackFolder();
          const originalWorld = await project.ensureWorldContainer();
          const originalItems = project.getItemsByType(ProjectItemType.entityTypeBehavior);
          const originalRoot = project.projectFolder!;
          const originalStorage = originalRoot.storage;
          const outerFile = project.projectCabinetFile;
          const originalInfo = project.indevInfoSet;
          const originalLoc = project.loc;
          expect(originalItems).to.have.lengthOf(1);
          const originalPath = originalItems[0].projectPath!;
          expect(originalFolder?.storage).to.equal(originalStorage);
          expect(originalWorld?.storage).to.equal(originalStorage);
          expect(project.packs).not.to.be.empty;
          expect(await project.ensureProjectFolder()).to.equal(originalRoot);
          expect(project.getItemsByType(ProjectItemType.entityTypeBehavior)).to.equal(originalItems);
          if (repair) {
            fs.writeFileSync(project.localFilePath, "not a zip file");
            await assert.rejects(project.ensureProjectFolder(true), /Can't open package/);
            expect(project.items, "rejected packages expose no stale items").to.be.empty;
            expect(project.defaultBehaviorPackFolder).to.equal(null);
            expect(project.worldContainer).to.equal(null);
          }

          await writePackPackage(project.localFilePath, "replacement");
          if (withAccessory) {
            const replacementZip = await JSZip.loadAsync(fs.readFileSync(project.localFilePath));
            replacementZip.file("input.data.json", JSON.stringify({ title: "Package decoy", marker: "inside" }));
            fs.writeFileSync(project.localFilePath, await replacementZip.generateAsync({ type: "nodebuffer" }));
          }
          const replacementRoot = await project.ensureProjectFolder(!repair);
          expect(project.projectCabinetFile).to.equal(outerFile);
          expect(project.hasInferredFiles, "replacement packages need inference").to.equal(false);
          expect(project.getItemByProjectPath(originalPath)).to.equal(undefined);
          expect(project.preferencesFile).to.equal(null);
          expect(project.indevInfoSet).not.to.equal(originalInfo);
          expect(project.loc).not.to.equal(originalLoc);
          await project.inferProjectItemsFromFiles();
          if (withAccessory) {
            await assertExternalAccessory();
          }
          await project.ensureInflated();
          if (withAccessory) {
            await assertExternalAccessory();
          }

          const replacementItems = project.getItemsByType(ProjectItemType.entityTypeBehavior);
          expect(replacementItems).to.have.lengthOf(1);
          expect(replacementItems[0].projectPath).to.include("replacement.json");
          await replacementItems[0].loadFileContent();
          const entityContent = replacementItems[0].primaryFile?.content;
          assert(typeof entityContent === "string");
          expect(JSON.parse(entityContent)["minecraft:entity"].description.identifier).to.equal("test:replacement");
          expect(project.getItemByProjectPath(originalPath)).to.equal(undefined);
          const replacementFolder = await project.getDefaultBehaviorPackFolder();
          expect(replacementFolder?.storage).to.equal(replacementRoot.storage);
          expect(replacementFolder).not.to.equal(originalFolder);
          expect(await project.ensureWorldContainer()).to.equal(replacementRoot);
          for (const pack of project.packs) {
            expect(pack.folder?.storage).to.equal(replacementRoot.storage);
            assert(pack.folder instanceof FolderBase);
            expect(pack.folder.isDisposed).to.equal(false);
          }
          for (const item of project.items) {
            await item.loadFileContent();
            expect(item.primaryFile?.parentFolder.storage).not.to.equal(originalStorage);
            expect(item.defaultFolder?.storage).not.to.equal(originalStorage);
            if (item.primaryFile) {
              assert(item.primaryFile instanceof FileBase);
              expect(item.primaryFile.isDisposed).to.equal(false);
            }
            if (item.defaultFolder) {
              assert(item.defaultFolder instanceof FolderBase);
              expect(item.defaultFolder.isDisposed).to.equal(false);
            }
          }

          if (withAccessory) {
            const itemCount = project.items.length;
            expect(project.accessoryFoldersForFilePaths).to.have.lengthOf(1);
            await project.ensureProjectFolder(true);
            await project.inferProjectItemsFromFiles();
            await project.ensureInflated();
            await assertExternalAccessory();
            expect(project.items).to.have.lengthOf(itemCount);
            expect(project.accessoryFoldersForFilePaths).to.have.lengthOf(1);
            expect(project.items.filter((item) => item.primaryFile?.name === "input.data.json")).to.have.lengthOf(1);
          }
          expect(new Set(project.items.map((item) => item.projectPath)).size).to.equal(project.items.length);
          expect(savedStorageAccesses).to.equal(0);
        });
      }
    }

    it("keeps preferences stored outside a reloaded package", async () => {
      const preferences = storage.rootFolder.ensureFile("external.mctp.json");
      preferences.setContent("{}");
      await preferences.saveContent();
      const project = new Project(env.creatorTools, "input.mcaddon", preferences);
      project.localFilePath = path.join(root, project.name);
      await writePackPackage(project.localFilePath, "original");
      await project.ensureProjectFolder();
      await writePackPackage(project.localFilePath, "replacement");
      await project.ensureProjectFolder(true);

      expect(project.preferencesFile).to.equal(preferences);
      expect(preferences.isDisposed).to.equal(false);
      expect(savedStorageAccesses).to.equal(0);
    });

    it("drops a preferences-file reference owned by a discarded package", async () => {
      const filePath = path.join(root, "input.mcaddon");
      await writePackPackage(filePath, "original", true);
      const folder = await StorageUtilities.getFileStorageFolder(storage.rootFolder.ensureFile("input.mcaddon"));
      assert(folder && typeof folder !== "string");
      const preferences = await folder.getFileFromRelativePath("/.mct/prefs.mctp.json");
      assert(preferences);
      const project = new Project(env.creatorTools, "input.mcaddon", preferences);
      project.localFilePath = filePath;
      await project.ensureProjectFolder();

      await writePackPackage(filePath, "replacement");
      await project.ensureProjectFolder(true);

      expect(project.preferencesFile).to.equal(null);
      expect(savedStorageAccesses).to.equal(0);
    });
  });

  for (const byName of [false, true]) {
    it(`still loads an intentional saved project without a package input, byName=${byName}`, async () => {
      const project = createProject("saved");
      project.useProjectNameInRootProjectStorage = byName;
      const folder = await project.ensureProjectFolder();
      await project.inferProjectItemsFromFiles();

      expect(path.resolve(folder.fullPath)).to.equal(path.join(root, "projects", "saved"));
      expect(project.items).not.to.be.empty;
      expect(savedStorageAccesses).to.be.greaterThan(0);
    });

    it(`still creates an intentional new project without a package input, byName=${byName}`, async () => {
      const project = new Project(env.creatorTools, "new", null);
      project.useProjectNameInRootProjectStorage = byName;
      const folder = await project.ensureProjectFolder();

      expect(path.resolve(folder.fullPath)).to.equal(path.join(root, "projects", "new"));
      expect(fs.existsSync(folder.fullPath)).to.equal(true);
    });
  }

  it("still loads the requested ordinary folder without accessing a same-name saved project", async () => {
    const project = createProject("folder");
    project.localFolderPath = path.join(root, "input");
    fs.cpSync(TestPaths.sampleContentPath("simple"), project.localFolderPath, { recursive: true });
    const folder = await project.ensureProjectFolder();
    await project.inferProjectItemsFromFiles();

    expect(path.resolve(folder.fullPath)).to.equal(project.localFolderPath);
    expect(project.items).not.to.be.empty;
    expect(savedStorageAccesses).to.equal(0);
  });

  it("keeps an unreadable embedded container reportable to file-level validators", async () => {
    const filePath = path.join(root, "embedded.mcaddon");
    fs.writeFileSync(filePath, "not a zip file");
    const file = new NodeStorage(root, "").rootFolder.ensureFile("embedded.mcaddon");
    const result = await StorageUtilities.getFileStorageFolder(file);

    expect(result).to.be.a("string").and.include("Can't find end of central directory");
    expect(file.errorStateMessage).to.equal(result);
    expect(savedStorageAccesses).to.equal(0);
  });

  it("keeps a cached unprocessable container reportable on every file-level validation", async () => {
    const file = new NodeStorage(root, "").rootFolder.ensureFile("embedded.mcaddon");
    await writePackage(file.fullPath);
    await StorageUtilities.getFileStorageFolder(file);
    const cachedStorage = file.fileContainerStorage;
    assert(cachedStorage instanceof ZipStorage);
    const invalidBytes = Buffer.from("not a zip file");
    file.setContent(invalidBytes);
    await file.saveContent();
    await assert.rejects(cachedStorage.loadFromUint8Array(invalidBytes, file.name), /end of central directory/);
    expect(file.fileContainerStorage).to.equal(cachedStorage);

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await StorageUtilities.getFileStorageFolder(file);
      expect(result).to.be.a("string").and.include("Can't find end of central directory");
      expect(file.errorStateMessage).to.equal(result);
    }
    expect(savedStorageAccesses).to.equal(0);
  });
});
