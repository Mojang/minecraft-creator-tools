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
export const defaultValidationReportExcludedTestIds = ["CDWORLDDATA2", "TEXTURELIST2"];

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
 * Tolerance for byte-size fields in scenario comparisons. Sizes drift in small
 * ways across runs (an edit adds a character, a sample changes by a byte). We
 * accept differences up to max(SIZE_TOLERANCE_BYTES, SIZE_TOLERANCE_PERCENT *
 * expected) to absorb these without losing meaningful regression detection.
 */
const SIZE_TOLERANCE_BYTES = 2;
const SIZE_TOLERANCE_PERCENT = 0.005; // 0.5%

/**
 * Top-level numeric byte-size fields that benefit from tolerance comparison.
 */
const TOLERANT_SIZE_TOP_FIELDS = new Set(["contentSize", "overallSize"]);

/**
 * Within `info.featureSets`, sub-objects whose key ends in one of these suffixes
 * have their numeric size fields ({average, max, min, total}) compared with
 * tolerance instead of exact match.
 */
const TOLERANT_FEATURESET_SUFFIXES = [".size"];

/**
 * Within report items, items whose `gId` is in this set have their numeric
 * size payload (`d` field) compared with tolerance.
 */
const TOLERANT_SIZE_ITEM_GIDS = new Set(["PACKSIZE"]);

function isWithinSizeTolerance(scenarioVal: number, resultVal: number): boolean {
  const diff = Math.abs(scenarioVal - resultVal);
  const tolerance = Math.max(SIZE_TOLERANCE_BYTES, Math.round(scenarioVal * SIZE_TOLERANCE_PERCENT));
  return diff <= tolerance;
}

/**
 * Tolerance for "vanilla game texture coverage" — the fraction of vanilla game
 * textures a pack overrides. Coverage is a ratio whose DENOMINATOR is the number
 * of vanilla game textures shipped by the current Minecraft version; that count
 * grows version-over-version as Mojang adds blocks/items/entities. The NUMERATOR
 * (how many vanilla textures THIS pack overrides) is deterministic and is
 * asserted exactly elsewhere (`vanillaGameTextureCount` / featureSet
 * `overrideCount`), and the raw denominator is already stripped as a volatile
 * attribute (`Vanilla Texture Count` / `vanillaTextureCount`).
 *
 * We deliberately do NOT strip the ratio outright: a collapse — e.g. the vanilla
 * index failing to load and dropping the count from ~2500 to ~100 — should still
 * fail the test. So we snap the result ratio to the scenario ratio only when it
 * is within COVERAGE_TOLERANCE_PERCENT relative drift. Because the numerator is
 * fixed, relative drift in the ratio tracks relative drift in the vanilla texture
 * count: routine version-over-version growth is absorbed, while order-of-magnitude
 * changes still surface.
 */
const COVERAGE_TOLERANCE_PERCENT = 0.2; // 20% relative drift in the underlying vanilla texture count

/**
 * TEXTUREIMAGE generator indices whose `d` payload is a vanilla-coverage ratio
 * (override percent). These drift with the vanilla texture count denominator.
 * See TextureImageInfoData.ts: 460 texturePackDoesntOverrideVanillaGameTexture,
 * 461 texturePackDoesntOverrideMostTextures, 462 mashupPackDoesntOverrideMostTextures.
 */
const COVERAGE_ITEM_GIXES = new Set([460, 461, 462]);

function isWithinCoverageTolerance(scenarioVal: number, resultVal: number): boolean {
  if (scenarioVal === 0) {
    return resultVal === 0;
  }
  const relativeDrift = Math.abs(scenarioVal - resultVal) / Math.abs(scenarioVal);
  return relativeDrift <= COVERAGE_TOLERANCE_PERCENT;
}

/**
 * Normalizes byte-size fields in the result object by snapping them to the
 * scenario's value when within tolerance. This preserves the protection (any
 * out-of-tolerance drift will still fail the comparison) while absorbing tiny
 * 1-2 byte drifts from trivial content edits.
 *
 * Returns a new object — does not mutate the input.
 */
export function normalizeSizeValues(scenario: any, result: any): any {
  if (!scenario || !result || typeof scenario !== "object" || typeof result !== "object") {
    return result;
  }

  const out: any = Array.isArray(result) ? [...result] : { ...result };

  // Top-level size fields under `info`
  if (scenario.info && out.info && typeof out.info === "object") {
    const info = { ...out.info };
    for (const key of TOLERANT_SIZE_TOP_FIELDS) {
      if (typeof info[key] === "number" && typeof scenario.info[key] === "number") {
        if (isWithinSizeTolerance(scenario.info[key], info[key])) {
          info[key] = scenario.info[key];
        }
      }
    }

    // featureSets sub-objects with size suffix
    if (info.featureSets && typeof info.featureSets === "object" && scenario.info.featureSets) {
      const featureSets: Record<string, any> = { ...info.featureSets };
      for (const fsKey of Object.keys(featureSets)) {
        const isSizeKey = TOLERANT_FEATURESET_SUFFIXES.some((suffix) => fsKey.endsWith(suffix));
        const scenarioFs = scenario.info.featureSets[fsKey];
        if (isSizeKey && featureSets[fsKey] && typeof featureSets[fsKey] === "object" && scenarioFs) {
          const normalized = { ...featureSets[fsKey] };
          for (const subKey of ["average", "max", "min", "total"]) {
            if (typeof normalized[subKey] === "number" && typeof scenarioFs[subKey] === "number") {
              if (isWithinSizeTolerance(scenarioFs[subKey], normalized[subKey])) {
                normalized[subKey] = scenarioFs[subKey];
              }
            }
          }
          featureSets[fsKey] = normalized;
        }
      }
      info.featureSets = featureSets;
    }

    out.info = info;
  }

  // PACKSIZE items have a `d` (data) field with the raw byte count
  if (Array.isArray(out.items) && Array.isArray(scenario.items)) {
    out.items = out.items.map((item: any, idx: number) => {
      const scenarioItem = scenario.items[idx];
      if (!item || typeof item !== "object" || !scenarioItem || typeof scenarioItem !== "object") {
        return item;
      }

      let normalized = item;

      // PACKSIZE: tolerant byte count in `d`
      if (
        typeof item.gId === "string" &&
        TOLERANT_SIZE_ITEM_GIDS.has(item.gId) &&
        typeof item.d === "number" &&
        typeof scenarioItem.d === "number" &&
        scenarioItem.gId === item.gId &&
        scenarioItem.gIx === item.gIx &&
        isWithinSizeTolerance(scenarioItem.d, item.d)
      ) {
        normalized = { ...normalized, d: scenarioItem.d };
      }

      // Any item with a `fs.size.*` nested feature set (e.g. LINESIZE items):
      // snap size sub-values within tolerance to the scenario value.
      if (
        normalized.fs &&
        typeof normalized.fs === "object" &&
        normalized.fs.size &&
        typeof normalized.fs.size === "object" &&
        scenarioItem.fs &&
        typeof scenarioItem.fs === "object" &&
        scenarioItem.fs.size &&
        typeof scenarioItem.fs.size === "object"
      ) {
        const sceSize = scenarioItem.fs.size;
        const resSize = { ...normalized.fs.size };
        let changed = false;
        for (const subKey of ["average", "max", "min", "total"]) {
          if (typeof resSize[subKey] === "number" && typeof sceSize[subKey] === "number") {
            if (isWithinSizeTolerance(sceSize[subKey], resSize[subKey])) {
              if (resSize[subKey] !== sceSize[subKey]) {
                resSize[subKey] = sceSize[subKey];
                changed = true;
              }
            }
          }
        }
        if (changed) {
          normalized = { ...normalized, fs: { ...normalized.fs, size: resSize } };
        }
      }

      return normalized;
    });
  }

  return out;
}

/**
 * Normalizes vanilla game-texture COVERAGE ratios in the result object by
 * snapping them to the scenario's value when within COVERAGE_TOLERANCE_PERCENT
 * relative drift. This absorbs the version-over-version growth of the vanilla
 * texture count (the ratio's denominator) without losing protection against
 * order-of-magnitude changes (e.g. the vanilla index failing to load).
 *
 * Mirrors normalizeSizeValues. Touches three places the coverage ratio surfaces:
 *  1. `info.vanillaGameTextureCoverage`
 *  2. `info.featureSets["*.vanillaGameTextureCoverage"].percent`
 *  3. items[] with gId "TEXTUREIMAGE" and a coverage gIx (460/461/462), in `d`
 *
 * Returns a new object — does not mutate the input.
 */
export function normalizeVanillaCoverageValues(scenario: any, result: any): any {
  if (!scenario || !result || typeof scenario !== "object" || typeof result !== "object") {
    return result;
  }

  const out: any = Array.isArray(result) ? [...result] : { ...result };

  if (scenario.info && out.info && typeof out.info === "object") {
    const info = { ...out.info };

    // 1. Top-level coverage ratio
    if (
      typeof info.vanillaGameTextureCoverage === "number" &&
      typeof scenario.info.vanillaGameTextureCoverage === "number" &&
      isWithinCoverageTolerance(scenario.info.vanillaGameTextureCoverage, info.vanillaGameTextureCoverage)
    ) {
      info.vanillaGameTextureCoverage = scenario.info.vanillaGameTextureCoverage;
    }

    // 2. featureSets["*.vanillaGameTextureCoverage"].percent — leave the
    // deterministic `overrideCount` numerator alone, only soften the ratio.
    if (info.featureSets && typeof info.featureSets === "object" && scenario.info.featureSets) {
      const featureSets: Record<string, any> = { ...info.featureSets };
      for (const fsKey of Object.keys(featureSets)) {
        if (!fsKey.endsWith(".vanillaGameTextureCoverage")) {
          continue;
        }
        const scenarioFs = scenario.info.featureSets[fsKey];
        const resultFs = featureSets[fsKey];
        if (
          resultFs &&
          typeof resultFs === "object" &&
          scenarioFs &&
          typeof scenarioFs === "object" &&
          typeof resultFs.percent === "number" &&
          typeof scenarioFs.percent === "number" &&
          isWithinCoverageTolerance(scenarioFs.percent, resultFs.percent)
        ) {
          featureSets[fsKey] = { ...resultFs, percent: scenarioFs.percent };
        }
      }
      info.featureSets = featureSets;
    }

    out.info = info;
  }

  // 3. TEXTUREIMAGE coverage items carry the override ratio in `d`.
  if (Array.isArray(out.items) && Array.isArray(scenario.items)) {
    out.items = out.items.map((item: any, idx: number) => {
      const scenarioItem = scenario.items[idx];
      if (
        item &&
        typeof item === "object" &&
        scenarioItem &&
        typeof scenarioItem === "object" &&
        item.gId === "TEXTUREIMAGE" &&
        scenarioItem.gId === item.gId &&
        scenarioItem.gIx === item.gIx &&
        COVERAGE_ITEM_GIXES.has(item.gIx) &&
        typeof item.d === "number" &&
        typeof scenarioItem.d === "number" &&
        isWithinCoverageTolerance(scenarioItem.d, item.d)
      ) {
        return { ...item, d: scenarioItem.d };
      }
      return item;
    });
  }

  return out;
}

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

  // Always parse and normalize both sides before comparing — this is more
  // resilient than raw file comparison and handles all volatile cases uniformly
  // (volatile attributes, regex patterns, size bucketing, optional test exclusions).
  await scenarioFile.loadContent(false);
  const scenarioContent = scenarioFile.content;
  assert(typeof scenarioContent === "string", "Scenario file content is not a string");

  let scenarioObj = JSON.parse(scenarioContent as string);
  let resultObj = JSON.parse(dataObjectStr);

  scenarioObj = StorageUtilities.removeAttributesFromObject(scenarioObj, volatileAttributes);
  resultObj = StorageUtilities.removeAttributesFromObject(resultObj, volatileAttributes);

  scenarioObj = StorageUtilities.applyVolatilePatternsToObject(scenarioObj, volatilePatterns);
  resultObj = StorageUtilities.applyVolatilePatternsToObject(resultObj, volatilePatterns);

  // Snap result size values to scenario values when within tolerance, so trivial
  // 1-2 byte drifts (a character changed somewhere) don't fail the test while
  // larger drifts (meaningful content regressions) still surface.
  resultObj = normalizeSizeValues(scenarioObj, resultObj);

  // Snap vanilla game-texture coverage ratios within tolerance, so the ratio's
  // denominator (the vanilla texture count, which grows version-over-version)
  // doesn't fail the test on small drift while order-of-magnitude changes do.
  resultObj = normalizeVanillaCoverageValues(scenarioObj, resultObj);

  if (excludeTestIds && excludeTestIds.length > 0) {
    scenarioObj = removeExcludedTestItems(scenarioObj, excludeTestIds);
    resultObj = removeExcludedTestItems(resultObj, excludeTestIds);
  }

  const scenarioStr = Utilities.consistentStringifyTrimmed(scenarioObj);
  const resultStr = Utilities.consistentStringifyTrimmed(resultObj);

  const isEqual = scenarioStr === resultStr;
  const diffDetail = isEqual ? "" : getDiffDetail(scenarioStr, resultStr);

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
