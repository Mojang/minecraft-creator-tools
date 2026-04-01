/**
 * CommandLineTestHelpers - Shared utilities for CLI integration tests
 *
 * Provides environment setup and helper functions used across all
 * split CommandLineTest files. Each test file imports from here
 * instead of duplicating boilerplate.
 */

import CreatorTools from "../app/CreatorTools";
import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import { Readable } from "stream";
import * as fs from "fs";
import { chunksToLinesAsync } from "@rauschma/stringio";
import Log from "../core/Log";
import TestPaths, { ITestEnvironment } from "./TestPaths";

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
      let lineUp = line.replace(/\\n/g, "");
      lineUp = lineUp.replace(/\\r/g, "");

      if (!lineUp.includes("ebugger")) {
        data.push(lineUp);
      }
    }
  }
}
