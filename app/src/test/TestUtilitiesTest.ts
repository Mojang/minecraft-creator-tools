// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests compareReportWithScenario, the comparison ensureReportJsonMatchesScenario makes between a
 * validation report and its scenario.
 *
 * The serve report scenarios for the world sample record the sizes of the source maps it packages.
 * Those maps embed the sample's TypeScript, which samplecontent/world/.gitattributes checks out with
 * LF everywhere, so the sizes are the same on every OS and are compared like any other size. These
 * tests check that a different source map size, such as one built from a CRLF checkout, fails the
 * comparison wherever a report records it.
 */

import { assert } from "chai";
// Loads the app's modules in an order that resolves their circular imports, as other tests do.
import "../app/Project";
import { compareReportWithScenario } from "./TestUtilities";

interface ISizeSpectrum {
  average: number;
  instanceCount: number;
  max: number;
  min: number;
  total: number;
}

interface IReportItem {
  gId: string;
  gIx: number;
  iTp: number;
  d?: number;
  fs?: { size: ISizeSpectrum };
}

interface IInfoSetData {
  info: { contentSize: number; overallSize: number; featureSets: { [name: string]: ISizeSpectrum } };
  items: IReportItem[];
}

interface IReport extends IInfoSetData {
  subsetReports: { infoSetData: IInfoSetData }[];
}

/** The world sample's two source maps, built from its LF TypeScript. */
const LF_SOURCE_MAPS: ISizeSpectrum = { average: 4642, instanceCount: 2, max: 5933, min: 3350, total: 9283 };

const JAVASCRIPT: ISizeSpectrum = { average: 1620, instanceCount: 2, max: 2217, min: 1022, total: 3239 };
const CONTENT_SIZE = 2199471;
const OVERALL_SIZE = 9337292;

/** Where createReport puts the LINESIZE item for source maps, and the PACKSIZE items for the totals. */
const SOURCE_MAP_ITEM = 1;
const OVERALL_SIZE_ITEM = 2;
const CONTENT_SIZE_ITEM = 3;

/** Report data shaped like what /api/validate returns for the world sample, with a subset report. */
function createInfoSetData(): IInfoSetData {
  return {
    info: {
      contentSize: CONTENT_SIZE,
      featureSets: {
        "javaScript.size": { ...JAVASCRIPT },
        "javaScriptMap.lines": { average: 1, instanceCount: 2, max: 1, min: 1, total: 2 },
        "javaScriptMap.size": { ...LF_SOURCE_MAPS },
      },
      overallSize: OVERALL_SIZE,
    },
    // LineSizeInfoGenerator reports each item type under gIx 100 + the type: JavaScript is 2, source maps 163.
    items: [
      { gId: "LINESIZE", gIx: 102, iTp: 7, fs: { size: { ...JAVASCRIPT } } },
      { gId: "LINESIZE", gIx: 263, iTp: 7, fs: { size: { ...LF_SOURCE_MAPS } } },
      { gId: "PACKSIZE", gIx: 101, iTp: 7, d: OVERALL_SIZE },
      { gId: "PACKSIZE", gIx: 104, iTp: 7, d: CONTENT_SIZE },
    ],
  };
}

function createReport(): IReport {
  return { ...createInfoSetData(), subsetReports: [{ infoSetData: createInfoSetData() }] };
}

/** The places a report records the source map sizes. */
const SOURCE_MAP_SIZE_LOCATIONS: { name: string; set: (report: IReport, size: ISizeSpectrum) => void }[] = [
  {
    name: "the feature sets",
    set: (report, size) => (report.info.featureSets["javaScriptMap.size"] = size),
  },
  {
    name: "the LINESIZE item",
    set: (report, size) => (report.items[SOURCE_MAP_ITEM].fs = { size }),
  },
  {
    name: "a subset report's feature sets",
    set: (report, size) => (report.subsetReports[0].infoSetData.info.featureSets["javaScriptMap.size"] = size),
  },
  {
    name: "a subset report's LINESIZE item",
    set: (report, size) => (report.subsetReports[0].infoSetData.items[SOURCE_MAP_ITEM].fs = { size }),
  },
];

/** Source map sizes that are positive and ordered, like real ones, but aren't the scenario's. */
const DIFFERENT_SOURCE_MAP_SIZES: { name: string; size: ISizeSpectrum }[] = [
  {
    // What the world sample reported when its TypeScript was checked out with CRLF.
    name: "built from a CRLF checkout",
    size: { average: 4804, instanceCount: 2, max: 6145, min: 3462, total: 9607 },
  },
  {
    name: "ten times larger",
    size: { average: 46420, instanceCount: 2, max: 59330, min: 33500, total: 92830 },
  },
];

describe("compareReportWithScenario", () => {
  it("matches an identical report", () => {
    assert.deepEqual(compareReportWithScenario(createReport(), createReport()), { isEqual: true, diffDetail: "" });
  });

  it("matches the pack totals of a Windows checkout, which are 1 byte larger", () => {
    // The world template's LevelDB CURRENT file gets a CR there, and validation counts it as binary.
    const result = createReport();
    result.info.contentSize = CONTENT_SIZE + 1;
    result.info.overallSize = OVERALL_SIZE + 1;
    result.items[OVERALL_SIZE_ITEM].d = OVERALL_SIZE + 1;
    result.items[CONTENT_SIZE_ITEM].d = CONTENT_SIZE + 1;

    assert.isTrue(compareReportWithScenario(createReport(), result).isEqual);
  });

  for (const location of SOURCE_MAP_SIZE_LOCATIONS) {
    for (const difference of DIFFERENT_SOURCE_MAP_SIZES) {
      it(`fails when the source maps in ${location.name} are ${difference.name}`, () => {
        const result = createReport();
        location.set(result, { ...difference.size });

        const comparison = compareReportWithScenario(createReport(), result);

        assert.isFalse(comparison.isEqual);
        assert.include(comparison.diffDetail, String(difference.size.total));
      });
    }
  }

  it("doesn't change the reports it compares", () => {
    const scenario = createReport();
    const result = createReport();
    SOURCE_MAP_SIZE_LOCATIONS[0].set(result, { ...DIFFERENT_SOURCE_MAP_SIZES[0].size });

    compareReportWithScenario(scenario, result);

    assert.deepEqual(scenario, createReport());
    assert.deepEqual(result.info.featureSets["javaScriptMap.size"], DIFFERENT_SOURCE_MAP_SIZES[0].size);
  });
});
