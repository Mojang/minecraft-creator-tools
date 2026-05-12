// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE: Shared Test Path Constants & Environment Factory
 *
 * This module centralizes all path resolution and test boilerplate that was previously
 * duplicated across CreatorToolsTest.ts, CommandLineTest.ts, ComprehensiveContentTest.ts,
 * DeployTest.ts, PlatformVersionValidationTest.ts, and other test files.
 *
 * ## Path Layout (relative to this file at app/src/test/TestPaths.ts):
 *   __dirname = app/src/test/
 *   appRoot   = app/                          (__dirname + "/../../")
 *   repoRoot  = <repo root>                   (__dirname + "/../../../")
 *   testRoot  = app/test/                     (appRoot + "test/")
 *   publicRoot = app/public/                  (appRoot + "public/")
 *   contentDataRoot = app/public/data/content/ (publicRoot + "data/content/")
 *   sampleContentRoot = samplecontent/        (repoRoot + "samplecontent/")
 *
 * ## Usage:
 *   import TestPaths from "./TestPaths";
 *
 *   // Use path constants directly
 *   const project = new Project(ct, name, null);
 *   project.localFolderPath = TestPaths.sampleContentPath("comprehensive");
 *
 *   // Or use the full environment factory
 *   const env = await TestPaths.createTestEnvironment();
 *   // env.creatorTools, env.scenariosFolder, env.resultsFolder, etc.
 */

import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";
import CreatorTools from "../app/CreatorTools";
import ImageCodecNode from "../local/ImageCodecNode";
import NodeStorage from "../local/NodeStorage";
import Database from "../minecraft/Database";
import LocalEnvironment from "../local/LocalEnvironment";
import LocalUtilities from "../local/LocalUtilities";
import IFolder from "../storage/IFolder";
import { applyTestVersionPin } from "./TestVersionPin";

// Pin the "current Minecraft version" used by validators so test baselines
// are insulated from upstream version drift. See TestVersionPin.ts.
applyTestVersionPin();

// ---------------------------------------------------------------------------
// Path Constants
// ---------------------------------------------------------------------------

/** Absolute path to the app/ folder (with trailing delimiter). */
const appRoot = NodeStorage.ensureEndsWithDelimiter(__dirname) + "../../";

/** Absolute path to the repo root (with trailing delimiter). */
const repoRoot = NodeStorage.ensureEndsWithDelimiter(__dirname) + "../../../";

/** Absolute path to app/test/ (scenarios & results live here). */
const testRoot = appRoot + "test/";

/** Absolute path to app/public/ (static web assets). */
const publicRoot = appRoot + "public/";

/** Absolute path to app/public/data/content/ (Database content folder). */
const contentDataRoot = publicRoot + "data/content/";

/** Absolute path to samplecontent/ at the repo root. */
const sampleContentRoot = repoRoot + "samplecontent/";

/**
 * The basePathAdjust value for LocalUtilities so that Database.local.createStorage()
 * can resolve data/forms/ and data/schemas/ relative to the app/ cwd.
 */
const basePathAdjust = "./public/";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/** Returns the absolute path to a named sample content folder, with trailing slash. */
function sampleContentPath(name: string): string {
  return sampleContentRoot + name + "/";
}

/** Standard _ensureLocalFolder callback for CreatorToolsHost. */
function ensureLocalFolder(path: string): IFolder {
  const ls = new NodeStorage(path, "");
  return ls.rootFolder;
}

/** Standard _localFolderExists callback for CreatorToolsHost. */
async function localFolderExists(path: string): Promise<boolean> {
  const ls = new NodeStorage(path, "");
  return await ls.rootFolder.exists();
}

// ---------------------------------------------------------------------------
// Test Environment Factory
// ---------------------------------------------------------------------------

/**
 * Return type of {@link createTestEnvironment}. Provides all the objects
 * that test files typically declare as module-level `let` variables.
 */
export interface ITestEnvironment {
  creatorTools: CreatorTools;
  localEnv: LocalEnvironment;
  scenariosFolder: IFolder;
  resultsFolder: IFolder;
  sampleFolder: IFolder;
}

/**
 * Options for {@link createTestEnvironment}.
 */
export interface ITestEnvironmentOptions {
  /**
   * Set `CreatorToolsHost.isLocalNode = true`. Required by DeployTest for
   * ZipStorage to use nodebuffer instead of blob.
   * @default false
   */
  isLocalNode?: boolean;

  /**
   * Set `CreatorToolsHost.contentWebRoot`. Defaults to "https://mctools.dev/".
   */
  contentWebRoot?: string;
}

/**
 * Creates and initialises a full test environment, replicating the ~55-line
 * async IIFE that was duplicated in every test file.
 *
 * Typical usage (at the top of a test file, before `describe` blocks):
 *
 * ```ts
 * import TestPaths, { ITestEnvironment } from "./TestPaths";
 *
 * let env: ITestEnvironment;
 *
 * (async () => {
 *   env = await TestPaths.createTestEnvironment();
 * })();
 * ```
 */
async function createTestEnvironment(options?: ITestEnvironmentOptions): Promise<ITestEnvironment> {
  const opts = {
    isLocalNode: false,
    contentWebRoot: "https://mctools.dev/",
    ...options,
  };

  // --- Host configuration ---------------------------------------------------
  CreatorToolsHost.hostType = HostType.testLocal;
  CreatorToolsHost.contentWebRoot = opts.contentWebRoot;

  if (opts.isLocalNode) {
    CreatorToolsHost.isLocalNode = true;
  }

  // Node.js-specific image codec functions
  CreatorToolsHost.decodePng = ImageCodecNode.decodePng;
  CreatorToolsHost.encodeToPng = ImageCodecNode.encodeToPng;

  // Folder callbacks
  CreatorToolsHost.localFolderExists = localFolderExists;
  CreatorToolsHost.ensureLocalFolder = ensureLocalFolder;

  // --- Local environment ----------------------------------------------------
  const localEnv = new LocalEnvironment(false);

  // --- Storage paths --------------------------------------------------------
  const scenariosStorage = new NodeStorage(testRoot, "scenarios");
  const scenariosFolder = scenariosStorage.rootFolder;
  await scenariosFolder.ensureExists();

  const resultsStorage = new NodeStorage(testRoot, "results");
  const resultsFolder = resultsStorage.rootFolder;
  await resultsFolder.ensureExists();

  const sampleContentStorage = new NodeStorage(repoRoot, "samplecontent");
  const sampleFolder = sampleContentStorage.rootFolder;
  await sampleFolder.ensureExists();

  // Host storage (prefs, projects, packs, worlds, working)
  const d = NodeStorage.platformFolderDelimiter;
  const twp = localEnv.utilities.testWorkingPath;

  CreatorToolsHost.prefsStorage = new NodeStorage(twp + "prefs" + d, "");
  CreatorToolsHost.projectsStorage = new NodeStorage(twp + "projects" + d, "");
  CreatorToolsHost.packStorage = new NodeStorage(twp + "packs" + d, "");
  CreatorToolsHost.worldStorage = new NodeStorage(twp + "worlds" + d, "");
  CreatorToolsHost.workingStorage = new NodeStorage(twp + "working" + d, "");

  // --- Database content folder ----------------------------------------------
  const coreStorage = new NodeStorage(contentDataRoot, "");
  Database.contentFolder = coreStorage.rootFolder;

  // --- Database.local for schema / form resolution --------------------------
  (localEnv.utilities as LocalUtilities).basePathAdjust = basePathAdjust;
  Database.local = localEnv.utilities;

  // --- Init host & CreatorTools ---------------------------------------------
  await CreatorToolsHost.init();

  const creatorTools = CreatorToolsHost.getCreatorTools();
  if (!creatorTools) {
    throw new Error("TestPaths.createTestEnvironment: CreatorToolsHost.getCreatorTools() returned undefined");
  }

  creatorTools.local = localEnv.utilities;
  await creatorTools.load();

  return {
    creatorTools,
    localEnv,
    scenariosFolder,
    resultsFolder,
    sampleFolder,
  };
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const TestPaths = {
  /** Absolute path to app/ (with trailing delimiter). */
  appRoot,
  /** Absolute path to the repo root (with trailing delimiter). */
  repoRoot,
  /** Absolute path to app/test/. */
  testRoot,
  /** Absolute path to app/public/. */
  publicRoot,
  /** Absolute path to app/public/data/content/. */
  contentDataRoot,
  /** Absolute path to samplecontent/ at the repo root. */
  sampleContentRoot,
  /** basePathAdjust value for LocalUtilities ("./public/"). */
  basePathAdjust,
  /** Returns the absolute path to a named sample content folder. */
  sampleContentPath,
  /** Standard _ensureLocalFolder callback. */
  ensureLocalFolder,
  /** Standard _localFolderExists callback. */
  localFolderExists,
  /** Creates a fully initialised test environment. */
  createTestEnvironment,
} as const;

export default TestPaths;
