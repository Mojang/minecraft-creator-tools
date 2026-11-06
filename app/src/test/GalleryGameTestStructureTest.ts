// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Regression tests for GameTest gallery projects that register tests against a structure
 * (public issue #59: the Starter GameTest shipped without the mediumglass structure its script
 * names, so the test failed in game with "structure not found").
 *
 * The samples are bundled from GitHub by tools/gulp-downloadResources, which only extracts an
 * allow list of file extensions. `.mcstructure` was not on it, so no GameTest sample carried its
 * structures into the bundled copies the CLI, Electron, VS Code, and the web site serve from.
 * These tests create the gallery projects from the bundled samples the way the app does and
 * check that every structure a script registers is in the project and in the exported pack.
 */

import { assert, expect } from "chai";
import * as fs from "fs";
// TestPaths loads the host first, which keeps the storage and project modules out of an import cycle.
import TestPaths, { ITestEnvironment } from "./TestPaths";
import CreatorTools from "../app/CreatorTools";
import Project from "../app/Project";
import ProjectExporter, { FolderDeploy } from "../app/ProjectExporter";
import IFolder from "../storage/IFolder";
import IFile from "../storage/IFile";
import StorageUtilities from "../storage/StorageUtilities";
import ZipStorage from "../storage/ZipStorage";

let creatorTools: CreatorTools | undefined = undefined;

const downloaderPath = TestPaths.appRoot + "tools/gulp-downloadResources/DownloadResources.js";
const starterStructurePath =
  TestPaths.publicRoot +
  "res/samples/microsoft/gametests/starterTestsTutorial/behavior_packs/starterTestsTutorial/structures/startertests/mediumglass.mcstructure";

(async () => {
  const env: ITestEnvironment = await TestPaths.createTestEnvironment();
  creatorTools = env.creatorTools;
})();

function must<T>(value: T | undefined | null, message: string): T {
  if (value === undefined || value === null) {
    assert.fail(message);
  }

  return value;
}

async function collectFiles(folder: IFolder, into: IFile[] = []) {
  await folder.load();

  for (const fileName in folder.files) {
    const file = folder.files[fileName];

    if (file) {
      into.push(file);
    }
  }

  for (const folderName in folder.folders) {
    const childFolder = folder.folders[folderName];

    if (childFolder) {
      await collectFiles(childFolder, into);
    }
  }

  return into;
}

/** The "namespace:name" structures that the scripts in a folder register tests against. */
async function getRegisteredStructures(folder: IFolder) {
  const structures = new Set<string>();

  for (const file of await collectFiles(folder)) {
    if (file.name.endsWith(".js") || file.name.endsWith(".ts")) {
      if (!file.isContentLoaded) {
        await file.loadContent();
      }

      const content = file.content;

      if (typeof content === "string") {
        for (const match of content.matchAll(/\.structureName\(\s*["']([^"']+)["']\s*\)/g)) {
          structures.add(match[1]);
        }
      }
    }
  }

  return structures;
}

function structureFilePath(registeredName: string) {
  const [namespace, name] = registeredName.split(":");

  return "structures/" + namespace + "/" + name + ".mcstructure";
}

async function createGalleryProject(gitHubFolder: string, name: string): Promise<Project> {
  const tools = must(creatorTools, "creatorTools");

  // Node hosts use the bundled copy under public/res/samples, as the CLI, Electron, and VS Code do.
  const project = await ProjectExporter.syncProjectFromGitHub(
    true,
    tools,
    "minecraft-gametests",
    "microsoft",
    undefined,
    gitHubFolder,
    name,
    undefined,
    undefined
  );

  return must(project, `the '${gitHubFolder}' gallery project should be created`);
}

async function assertStructuresExported(gitHubFolder: string, name: string, expectedStructures: string[]) {
  const project = await createGalleryProject(gitHubFolder, name);
  const bpFolder = must(await project.getDefaultBehaviorPackFolder(), "behavior pack");

  const registered = await getRegisteredStructures(bpFolder);
  expect(Array.from(registered)).to.have.members(expectedStructures);

  for (const structure of registered) {
    const relativePath = structureFilePath(structure);
    const file = await bpFolder.getFileFromRelativePath("/" + relativePath);

    expect(file, `'${relativePath}' should be in the project's behavior pack`).to.not.equal(undefined);
  }

  // The mcaddon export is what "Download" and the run options hand to the game.
  const projectBuild = must(await ProjectExporter.prepareProject(project), "project build");
  const zipStorage = new ZipStorage();

  await ProjectExporter.deployProjectPacks(
    project,
    projectBuild,
    zipStorage.rootFolder,
    undefined,
    FolderDeploy.noFolders
  );

  const exportedPaths = (await collectFiles(zipStorage.rootFolder)).map((file) =>
    StorageUtilities.ensureNotStartsWithDelimiter(file.storageRelativePath).replace(/\\/g, "/")
  );

  for (const structure of registered) {
    const relativePath = structureFilePath(structure);

    expect(
      exportedPaths.some((exportedPath) => exportedPath.endsWith(relativePath)),
      `the exported pack should contain '${relativePath}' (got ${exportedPaths.join(", ")})`
    ).to.equal(true);
  }
}

describe("GameTest gallery structures", () => {
  it("bundles .mcstructure files with the samples", () => {
    const downloader = fs.readFileSync(downloaderPath, "utf8");
    const allowList = must(
      downloader.match(/fileExtensionAllowList\s*=\s*\[([^\]]*)\]/),
      "DownloadResources should declare its extension allow list"
    )[1];

    expect(allowList).to.include('"mcstructure"');
    expect(fs.existsSync(starterStructurePath), "run preparedevenv to refresh the bundled samples").to.equal(true);
  });

  it("creates the Starter GameTest with the structure its script registers", async () => {
    await assertStructuresExported("/starterTestsTutorial", "starterGameTestStructures", ["startertests:mediumglass"]);
  }).timeout(30000);

  it("creates the Basic GameTest with every structure its scripts register", async () => {
    await assertStructuresExported("/js-gametests", "basicGameTestStructures", [
      "gametests:mediumglass",
      "gametests:minibiomes",
      "gametests:glass_cells",
      "gametests:glass_pit",
      "gametests:collapsing_space",
      "gametests:clone_command",
      "gametests:LlamaCommands",
    ]);
  }).timeout(30000);
});
