import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import { assert } from "chai";

export const volatileAttributes = [
  "uuid",
  "pack_id",
  "version",
  "generator_version",
  "generatorVersion",
  "index",
  "Vanilla Texture Count",
];
export const volatileFileExtensions = [".report.html"];

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

  const isEqual = await StorageUtilities.fileContentsEqual(scenarioFile, outFile, true, volatileAttributes);
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
    volatileAttributes
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
