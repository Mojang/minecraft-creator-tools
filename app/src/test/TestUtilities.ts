import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import { expect, assert } from "chai";

const volatileLineTokens = ['"uuid":', '"pack_id":', '"version":', "generator_version", "generatorVersion", "version:"];

export async function ensureReportJsonMatchesScenario(
  scenariosFolder: IFolder | undefined,
  resultsFolder: IFolder | undefined,
  obj: object,
  scenarioName: string
) {
  if (!scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const dataObjectStr = JSON.stringify(obj, null, 2);
  const resultsOutFolder = resultsFolder.ensureFolder(scenarioName);
  await resultsOutFolder.ensureExists();

  const outFile = resultsOutFolder.ensureFile("report.json");
  outFile.setContent(dataObjectStr);
  await outFile.saveContent();

  const scenarioFile = scenariosFolder.ensureFolder(scenarioName).ensureFile("report.json");
  const exists = await scenarioFile.exists();

  assert(exists, "report.json file for scenario '" + scenarioName + "' does not exist.");

  const isEqual = await StorageUtilities.fileContentsEqual(scenarioFile, outFile, true, volatileLineTokens);
  assert(
    isEqual,
    "report.json file '" + scenarioFile.fullPath + "' does not match for scenario '" + scenarioName + "'"
  );
}

export async function folderMatches(
  scenariosFolder: IFolder | undefined,
  resultsFolder: IFolder | undefined,
  scenarioName: string,
  excludeList?: string[]
) {
  if (!scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  const resultOutFolder = resultsFolder.ensureFolder(scenarioName);
  await resultOutFolder.ensureExists();

  const scenarioCompareFolder = scenariosFolder.ensureFolder(scenarioName);

  const isEqual = await StorageUtilities.folderContentsEqual(
    scenarioCompareFolder,
    resultOutFolder,
    excludeList,
    true,
    volatileLineTokens
  );

  assert(
    isEqual.result,
    "Folder '" +
      scenarioCompareFolder.fullPath +
      "' does not match for scenario '" +
      scenarioName +
      "'. " +
      isEqual.reason
  );
}
