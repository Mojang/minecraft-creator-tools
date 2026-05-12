import IFolder from "../storage/IFolder";
import StorageUtilities from "../storage/StorageUtilities";
import Utilities from "../core/Utilities";
import { assert } from "chai";

export const volatileAttributes = [
  "uuid",
  "pack_id",
  "version",
  "generator_version",
  "generatorVersion",
  "mctoolsVersion",
  "infoGenerationTime",
  "endToEndGenerationTime",
  "index",
  "Vanilla Texture Count",
  "vanillaTextureCount",
  "defaultIcon",
];
export const volatileFileExtensions = [".report.html", "deleted"];

/**
 * Regex patterns that match volatile content within strings.
 * These are used to normalize dynamic content (like current Minecraft versions)
 * before comparing test results against expected scenarios.
 *
 * Each pattern should capture the volatile part as a group that will be replaced
 * with a placeholder like "[CURRENT_VERSION]".
 */
export const volatilePatterns: Array<{ pattern: RegExp; replacement: string }> = [
  // Matches "compared to current version (X.Y.Z)" or just "compared to current version" and normalizes
  {
    pattern: /compared to current version(?: \(\d+\.\d+\.\d+\))?/g,
    replacement: "compared to current version ([CURRENT_VERSION])",
  },
  // Matches "compared to the current version or the previous current minor version (X.Y.Z)" or without version
  {
    pattern: /compared to the current version or the previous current minor version(?: \(\d+\.\d+\.\d+\))?/g,
    replacement: "compared to the current version or the previous current minor version ([CURRENT_VERSION])",
  },
  // Matches script module beta version messages like
  // "using an out of date beta version 2.7.0-beta compared to the current version: 2.7.0-beta"
  // Normalizes both the manifest version and the current version.
  {
    pattern:
      /using an out of date beta version \d+\.\d+\.\d+-beta compared to the current version(?::\s*\d+\.\d+\.\d+-beta)?/g,
    replacement: "using an out of date beta version [BETA_VERSION] compared to the current version: [CURRENT_VERSION]",
  },
  // Matches "Behavior pack dependency on X.Y.Z-beta at @minecraft/..." messages
  {
    pattern: /(?:Behavior|Resource) pack dependency on \d+\.\d+\.\d+-beta at @minecraft\/\S+/g,
    replacement: "Behavior pack dependency on [BETA_VERSION] at @minecraft/[MODULE]",
  },
  // Matches standalone beta version strings like "2.7.0-beta" (entire string, used for data values)
  {
    pattern: /^\d+\.\d+\.\d+-beta$/g,
    replacement: "[BETA_VERSION]",
  },
  // Matches "compared to the expected version (X.Y.Z)" used by MinEngineVersionManager and FormatVersionManager
  {
    pattern: /compared to the expected version \(\d+\.\d+\.\d+\)/g,
    replacement: "compared to the expected version ([CURRENT_VERSION])",
  },
];

/**
 * Attributes that become volatile when test items are excluded from comparison.
 * These are all derived from the items array (counts, summaries, per-generator results),
 * so removing items invalidates them.
 */
const excludeDerivedAttributes = [
  "errorCount",
  "testSuccessCount",
  "testFailCount",
  "testNotApplicableCount",
  "errorSummary",
  "testFailSummary",
  "summary",
  "customDimensionErrors",
  "nameIdTableMissing",
  "unclaimedMappings",
];

/**
 * Removes specific test items from a report data object by test ID.
 *
 * Test IDs are strings like "SCRIPTMODULE114" combining the generator ID (gId)
 * and the generator index (gIx). Items whose gId + gIx matches an excluded ID
 * are filtered out of the items array.
 *
 * When items are excluded, derived fields (error counts, summaries, per-generator
 * test results) are also removed since they'd differ between the two sides.
 *
 * @param obj The parsed report data object (IProjectInfoData shape)
 * @param excludeTestIds Array of test IDs to exclude, e.g. ["SCRIPTMODULE114"]
 * @returns A new object with matching items and derived summary fields removed
 */
export function removeExcludedTestItems(obj: any, excludeTestIds: string[]): any {
  if (!obj || !excludeTestIds || excludeTestIds.length === 0) {
    return obj;
  }

  const result = { ...obj };

  // Filter the items array
  if (Array.isArray(result.items)) {
    result.items = result.items.filter((item: any) => {
      if (item && typeof item.gId === "string" && typeof item.gIx === "number") {
        const testId = item.gId + item.gIx;
        return !excludeTestIds.includes(testId);
      }
      return true;
    });
  }

  // Strip derived summary fields since they depend on the full item set
  if (result.info && typeof result.info === "object") {
    const cleanedInfo = { ...result.info };
    for (const attr of excludeDerivedAttributes) {
      delete cleanedInfo[attr];
    }
    result.info = cleanedInfo;
  }

  return result;
}

function getDiffDetail(scenarioStr: string, resultStr: string): string {
  const scenarioLines = scenarioStr.split("\n");
  const resultLines = resultStr.split("\n");
  const diffs: string[] = [];
  const maxLines = Math.max(scenarioLines.length, resultLines.length);

  for (let i = 0; i < maxLines && diffs.length < 5; i++) {
    if (scenarioLines[i] !== resultLines[i]) {
      diffs.push(
        `Line ${i + 1}: scenario=${JSON.stringify(scenarioLines[i] ?? "<missing>")} result=${JSON.stringify(resultLines[i] ?? "<missing>")}`
      );
    }
  }

  if (diffs.length === 0) {
    return "";
  }

  return (
    "\nFirst differences (after volatile stripping):\n" +
    diffs.join("\n") +
    `\nScenario lines: ${scenarioLines.length}, Result lines: ${resultLines.length}`
  );
}

export async function ensureReportJsonMatchesScenario(
  scenariosFolder: IFolder | undefined,
  resultsFolder: IFolder | undefined,
  obj: object,
  scenarioName: string,
  excludeTestIds?: string[]
) {
  if (!scenariosFolder || !resultsFolder) {
    assert.fail("Not properly initialized");
  }

  // Remove volatile attributes (like 'index') from the object before writing
  // This ensures platform-agnostic results that don't include platform-specific
  // content index data
  const cleanedObj = StorageUtilities.removeAttributesFromObject(obj, volatileAttributes);
  const dataObjectStr = JSON.stringify(cleanedObj, null, 2);
  const resultsOutFolder = resultsFolder.ensureFolder(scenarioName);
  await resultsOutFolder.ensureExists();

  const outFile = resultsOutFolder.ensureFile("report.json");
  outFile.setContent(dataObjectStr);
  await outFile.saveContent();

  const scenarioFile = scenariosFolder.ensureFolder(scenarioName).ensureFile("report.json");
  const exists = await scenarioFile.exists();

  assert(exists, "report.json file for scenario '" + scenarioName + "' does not exist.");

  let isEqual: boolean;
  let diffDetail = "";

  if (excludeTestIds && excludeTestIds.length > 0) {
    // When excluding test IDs, we need to parse both sides, filter items,
    // strip derived summary fields, then compare the processed objects.
    await scenarioFile.loadContent(false);

    const scenarioContent = scenarioFile.content;
    assert(typeof scenarioContent === "string", "Scenario file content is not a string");

    let scenarioObj = JSON.parse(scenarioContent as string);
    let resultObj = JSON.parse(dataObjectStr);

    // Apply standard volatile attribute removal
    scenarioObj = StorageUtilities.removeAttributesFromObject(scenarioObj, volatileAttributes);
    resultObj = StorageUtilities.removeAttributesFromObject(resultObj, volatileAttributes);

    // Apply volatile pattern normalization
    scenarioObj = StorageUtilities.applyVolatilePatternsToObject(scenarioObj, volatilePatterns);
    resultObj = StorageUtilities.applyVolatilePatternsToObject(resultObj, volatilePatterns);

    // Filter out excluded test items and their derived summary fields
    scenarioObj = removeExcludedTestItems(scenarioObj, excludeTestIds);
    resultObj = removeExcludedTestItems(resultObj, excludeTestIds);

    const scenarioStr = Utilities.consistentStringifyTrimmed(scenarioObj);
    const resultStr = Utilities.consistentStringifyTrimmed(resultObj);

    isEqual = scenarioStr === resultStr;

    if (!isEqual) {
      diffDetail = getDiffDetail(scenarioStr, resultStr);
    }
  } else {
    isEqual = await StorageUtilities.fileContentsEqual(
      scenarioFile,
      outFile,
      true,
      volatileAttributes,
      volatilePatterns
    );

    if (!isEqual) {
      // Generate diff detail for non-excludeTestIds path
      await scenarioFile.loadContent(false);
      const scenarioContent = scenarioFile.content;
      if (typeof scenarioContent === "string") {
        let scenarioObj = JSON.parse(scenarioContent);
        let resultObj = JSON.parse(dataObjectStr);
        scenarioObj = StorageUtilities.removeAttributesFromObject(scenarioObj, volatileAttributes);
        resultObj = StorageUtilities.removeAttributesFromObject(resultObj, volatileAttributes);
        if (volatilePatterns) {
          scenarioObj = StorageUtilities.applyVolatilePatternsToObject(scenarioObj, volatilePatterns);
          resultObj = StorageUtilities.applyVolatilePatternsToObject(resultObj, volatilePatterns);
        }
        const scenarioStr = Utilities.consistentStringifyTrimmed(scenarioObj);
        const resultStr = Utilities.consistentStringifyTrimmed(resultObj);
        diffDetail = getDiffDetail(scenarioStr, resultStr);
      }
    }
  }

  assert(
    isEqual,
    "report.json file '" + scenarioFile.fullPath + "' does not match for scenario '" + scenarioName + "'" + diffDetail
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

  if (!excludeList) {
    excludeList = [];
  }
  excludeList.push("deleted");

  const resultOutFolder = resultsFolder.ensureFolder(scenarioName);
  await resultOutFolder.ensureExists();

  const scenarioCompareFolder = scenariosFolder.ensureFolder(scenarioName);

  const isEqual = await StorageUtilities.folderContentsEqual(
    scenarioCompareFolder,
    resultOutFolder,
    excludeList,
    true,
    volatileAttributes,
    volatilePatterns
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
