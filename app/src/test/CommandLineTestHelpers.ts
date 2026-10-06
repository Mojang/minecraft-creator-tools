/**
 * CommandLineTestHelpers - Shared utilities for CLI integration tests
 *
 * Provides environment setup and helper functions used across all
 * split CommandLineTest files. Each test file imports from here
 * instead of duplicating boilerplate.
 *
 * Importing this file gives the whole test process a temporary Creator Tools
 * data folder (MCTOOLS_DATA_DIR) and no Minecraft EULA acceptance. Spawned CLI
 * processes inherit both. To spawn a command that needs the EULA accepted, pass
 * `env: cliEnv({ acceptEula: true })` from TestDataDir.ts.
 */

import CreatorTools from "../app/CreatorTools";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import { Readable } from "stream";
import * as fs from "fs";
import { chunksToLinesAsync } from "@rauschma/stringio";
import Log from "../core/Log";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import { applyTestVersionPin } from "./TestVersionPin";
import { applyTestDataDir } from "./TestDataDir";

// Pin the "current Minecraft version" before any spawned CLI subprocess starts,
// so its environment inherits the pin and validators emit deterministic
// version-bearing messages. See TestVersionPin.ts for rationale.
applyTestVersionPin();

// Keep saved state, such as EULA acceptance, out of the developer's real profile,
// and start every test as a user who hasn't accepted the EULA. This runs before
// createTestEnvironment() below and before any suite spawns the CLI, so both use
// the temporary folder. See TestDataDir.ts.
applyTestDataDir();

export let creatorTools: CreatorTools | undefined = undefined;
export let scenariosFolder: IFolder | undefined = undefined;
export let resultsFolder: IFolder | undefined = undefined;
export let sampleFolder: IFolder | undefined = undefined;

(async () => {
  const env: ITestEnvironment = await TestPaths.createTestEnvironment();
  creatorTools = env.creatorTools;
  scenariosFolder = env.scenariosFolder;
  resultsFolder = env.resultsFolder;
  sampleFolder = env.sampleFolder;
})();

export function removeResultFolder(scenarioName: string) {
  if (resultsFolder) {
    const path =
      StorageUtilities.ensureEndsWithDelimiter(resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName);

    const exists = fs.existsSync(path);

    if (exists && !StorageUtilities.isPathRiskyForDelete(path))
      try {
        fs.rmSync(path, {
          recursive: true,
        });
      } catch (e) {
        Log.debug("Error occurred during rmSync on '" + path + "'");

        throw e;
      }
  }
}

export function ensureResultFolder(scenarioName: string) {
  if (resultsFolder) {
    const path =
      StorageUtilities.ensureEndsWithDelimiter(resultsFolder.fullPath) +
      StorageUtilities.ensureEndsWithDelimiter(scenarioName);
    if (!fs.existsSync(path))
      // @ts-ignore
      fs.mkdirSync(path, {
        recursive: true,
      });
  }
}

export async function collectLines(readable: Readable, data: string[]) {
  for await (const line of chunksToLinesAsync(readable)) {
    if (line !== undefined && line.length >= 0) {
      // Strip real newlines and carriage returns (e.g. trailing \r from \r\n line splits on Windows).
      // NOTE: Do NOT use /\\n/ or /\\r/ here — those regexes match a literal backslash followed by n/r,
      // which corrupts JSON output containing escaped Windows paths like "C:\\node_modules\\..." and
      // produces "Bad Unicode escape" errors when the result is JSON.parse'd downstream.
      let lineUp = line.replace(/\n/g, "");
      lineUp = lineUp.replace(/\r/g, "");

      if (!lineUp.includes("ebugger")) {
        data.push(lineUp);
      }
    }
  }
}
