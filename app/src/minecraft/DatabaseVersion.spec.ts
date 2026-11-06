import { expect } from "chai";
import Database from "./Database";

describe("Database version helpers", () => {
  const previewHeuristicCases: { ver: string; expected: boolean }[] = [
    { ver: "1.26.50.4", expected: false },
    { ver: "1.26.50.04", expected: false },
    { ver: "1.26.60.28", expected: true },
    { ver: "1.26.60.20", expected: true },
    { ver: "1.26.60.19", expected: false },
    { ver: "1.26.50", expected: false },
    { ver: "1.26.x.28", expected: false },
  ];

  for (const c of previewHeuristicCases) {
    it(`getVersionIsPreview('${c.ver}') is ${c.expected}`, () => {
      expect(Database.getVersionIsPreview(c.ver)).to.equal(c.expected);
    });
  }

  const entryCases: { name: string; entry: { version?: string; type?: string } | undefined; expected: boolean }[] = [
    { name: "explicit preview type", entry: { version: "1.26.60.28", type: "preview" }, expected: true },
    {
      name: "explicit preview type wins over low patch",
      entry: { version: "1.26.60.2", type: "preview" },
      expected: true,
    },
    {
      name: "explicit release type wins over high patch",
      entry: { version: "1.26.60.28", type: "release" },
      expected: false,
    },
    { name: "case-insensitive type", entry: { version: "1.26.60.28", type: "Preview" }, expected: true },
    { name: "missing type falls back to heuristic (retail)", entry: { version: "1.26.50.4" }, expected: false },
    { name: "missing type falls back to heuristic (preview)", entry: { version: "1.26.60.28" }, expected: true },
    { name: "empty type falls back to heuristic", entry: { version: "1.26.60.28", type: "" }, expected: true },
    { name: "undefined entry", entry: undefined, expected: false },
  ];

  for (const c of entryCases) {
    it(`getVersionEntryIsPreview: ${c.name}`, () => {
      expect(Database.getVersionEntryIsPreview(c.entry)).to.equal(c.expected);
    });
  }

  it("fallback versions are classified on the expected track", () => {
    expect(Database.getVersionIsPreview(Database.fallbackMinecraftVersion)).to.equal(false);
    expect(Database.getVersionIsPreview(Database.fallbackMinecraftPreviewVersion)).to.equal(true);
  });

  it("orders 1.26.50 retail after earlier 1.26 releases", () => {
    expect(Database.getVersionIndexFromVersionStr("1.26.50.4")).to.be.greaterThan(
      Database.getVersionIndexFromVersionStr("1.26.30.5")
    );
    expect(Database.getVersionIndexFromVersionStr("1.26.60.28")).to.be.greaterThan(
      Database.getVersionIndexFromVersionStr("1.26.50.4")
    );
  });
});
