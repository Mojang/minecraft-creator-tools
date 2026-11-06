// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests for extracting Bedrock Dedicated Server zips into a server source folder.
 *
 * StorageUtilities.syncFolderTo normally skips "ignorable" folders (e.g., __brarchive, test, metadata),
 * but a server zip must be extracted verbatim: the server reads vanilla data from __brarchive folders
 * and hangs at startup without them. The .brarchive files inside are binary and must not be decoded
 * as UTF-8 text, or the server crashes while loading them.
 */

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import Storage from "../storage/Storage";
import StorageUtilities, { EncodingType } from "../storage/StorageUtilities";
import ServerManager, { ServerType } from "../local/ServerManager";
import TestPaths from "./TestPaths";

const IGNORABLE_FOLDER_PATHS = [
  "behavior_packs/vanilla/__brarchive",
  "behavior_packs/vanilla/test",
  "behavior_packs/vanilla/metadata",
];

async function createServerLikeSource() {
  const storage = new Storage();
  const root = storage.rootFolder;

  root.ensureFile("bedrock_server.exe").setContent("exe");
  root.ensureFolder("behavior_packs").ensureFolder("vanilla").ensureFile("manifest.json").setContent("{}");

  for (const folderPath of IGNORABLE_FOLDER_PATHS) {
    const folder = await root.ensureFolderFromRelativePath("/" + folderPath + "/");
    folder.ensureFile("data.brarchive").setContent("data");
  }

  return root;
}

describe("server-source-extraction", () => {
  const encodingCases = [
    { fileName: "entities.brarchive", expected: EncodingType.ByteBuffer },
    { fileName: "bedrock_server.exe", expected: EncodingType.ByteBuffer },
    { fileName: "manifest.json", expected: EncodingType.Utf8String },
  ];

  for (const encodingCase of encodingCases) {
    it(`treats ${encodingCase.fileName} with the correct encoding`, () => {
      expect(StorageUtilities.getEncodingByFileName(encodingCase.fileName)).to.equal(encodingCase.expected);
    });
  }

  const cases = [
    { name: "skips ignorable folders by default", includeIgnorableFolders: undefined, expectCopied: false },
    { name: "copies ignorable folders when requested", includeIgnorableFolders: true, expectCopied: true },
  ];

  for (const testCase of cases) {
    it(testCase.name, async () => {
      const source = await createServerLikeSource();
      const target = new Storage().rootFolder;

      await StorageUtilities.syncFolderTo(
        source,
        target,
        false,
        false,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        false,
        testCase.includeIgnorableFolders
      );

      expect(target.files["bedrock_server.exe"], "root file").to.not.be.undefined;
      expect(target.folders["behavior_packs"]?.folders["vanilla"]?.files["manifest.json"], "manifest").to.not.be
        .undefined;

      for (const folderPath of IGNORABLE_FOLDER_PATHS) {
        const folder = await target.getFolderFromRelativePath("/" + folderPath + "/");
        const file = folder?.files["data.brarchive"];

        if (testCase.expectCopied) {
          expect(file, folderPath).to.not.be.undefined;
        } else {
          expect(file, folderPath).to.be.undefined;
        }
      }
    });
  }

  describe("isIncompleteSourceServerFolder", () => {
    const tempRoot = path.join(TestPaths.appRoot, "debugoutput", "server-source-extraction-test");

    const folderCases = [
      {
        name: "1.26 source with the completion marker is complete",
        version: "1.26.52.3",
        brarchiveFiles: ["entities.brarchive"],
        marker: true,
        incomplete: false,
      },
      {
        name: "1.26 source with __brarchive but no completion marker is incomplete",
        version: "1.26.52.3",
        brarchiveFiles: ["entities.brarchive"],
        marker: false,
        incomplete: true,
      },
      {
        name: "1.26 source with an empty __brarchive and no completion marker is incomplete",
        version: "1.26.52.3",
        brarchiveFiles: [],
        marker: false,
        incomplete: true,
      },
      {
        name: "pre-1.26 source without a completion marker is complete",
        version: "1.21.132.1",
        brarchiveFiles: undefined,
        marker: false,
        incomplete: false,
      },
    ];

    after(() => {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    folderCases.forEach((folderCase, index) => {
      it(folderCase.name, () => {
        const serverPath = path.join(tempRoot, "case" + index);
        fs.rmSync(serverPath, { recursive: true, force: true });

        const vanillaPath = path.join(serverPath, "behavior_packs", "vanilla");
        fs.mkdirSync(vanillaPath, { recursive: true });

        if (folderCase.brarchiveFiles) {
          fs.mkdirSync(path.join(vanillaPath, "__brarchive"), { recursive: true });

          for (const fileName of folderCase.brarchiveFiles) {
            fs.writeFileSync(path.join(vanillaPath, "__brarchive", fileName), "data");
          }
        }

        if (folderCase.marker) {
          fs.writeFileSync(path.join(serverPath, ServerManager.extractionCompleteMarkerName), "");
        }

        expect(ServerManager.isIncompleteSourceServerFolder(serverPath, folderCase.version)).to.equal(
          folderCase.incomplete
        );
      });
    });
  });

  describe("findLatestDownloadedSources", () => {
    const tempRoot = path.join(TestPaths.appRoot, "debugoutput", "server-source-selection-test");

    const selectionCases = [
      {
        name: "keeps a pre-1.26 source without a marker as the fallback",
        sources: [{ folder: "bwv1.21.132.1", complete: false }],
        expected: "bwv1.21.132.1",
      },
      {
        name: "skips a 1.26 source without a completion marker so it gets re-downloaded",
        sources: [
          { folder: "bwv1.21.132.1", complete: false },
          { folder: "bwv1.26.52.3", complete: false },
        ],
        expected: "bwv1.21.132.1",
      },
      {
        name: "selects a completed 1.26 source",
        sources: [
          { folder: "bwv1.21.132.1", complete: false },
          { folder: "bwv1.26.52.3", complete: true },
        ],
        expected: "bwv1.26.52.3",
      },
      {
        name: "finds no source when the only 1.26 source is incomplete",
        sources: [{ folder: "bwv1.26.52.3", complete: false }],
        expected: undefined,
      },
      {
        name: "ignores and removes a leftover staging folder",
        sources: [
          { folder: "bwv1.21.132.1", complete: false },
          { folder: ServerManager.stagingSourceFolderPrefix + "bwv1.26.52.3_1700000000000", complete: true },
        ],
        expected: "bwv1.21.132.1",
      },
      {
        name: "ignores but keeps a staging folder that may still be in use",
        sources: [
          { folder: "bwv1.21.132.1", complete: false },
          { folder: ServerManager.stagingSourceFolderPrefix + "bwv1.26.52.3_" + Date.now(), complete: true },
        ],
        expected: "bwv1.21.132.1",
        keepsStaging: true,
      },
    ];

    after(() => {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    selectionCases.forEach((selectionCase, index) => {
      it(selectionCase.name, () => {
        const sourcesPath = path.join(tempRoot, "case" + index);
        fs.rmSync(sourcesPath, { recursive: true, force: true });

        for (const source of selectionCase.sources) {
          fs.mkdirSync(path.join(sourcesPath, source.folder, "behavior_packs", "vanilla", "__brarchive"), {
            recursive: true,
          });

          if (source.complete) {
            fs.writeFileSync(path.join(sourcesPath, source.folder, ServerManager.extractionCompleteMarkerName), "");
          }
        }

        const latest = ServerManager.findLatestDownloadedSources(sourcesPath)[ServerType.bedrockWindows];

        if (selectionCase.expected === undefined) {
          expect(latest).to.be.undefined;
        } else {
          expect(latest?.path).to.equal(path.join(sourcesPath, selectionCase.expected) + path.sep);
        }

        const remainingStaging = fs
          .readdirSync(sourcesPath)
          .filter((folder) => folder.startsWith(ServerManager.stagingSourceFolderPrefix));

        expect(remainingStaging.length).to.equal(selectionCase.keepsStaging ? 1 : 0);
      });
    });
  });

  describe("extractServerSource", () => {
    const tempRoot = path.join(TestPaths.appRoot, "debugoutput", "server-source-publish-test");
    const version = "bwv1.26.52.3";

    function selectLatest(sourcesPath: string) {
      return ServerManager.findLatestDownloadedSources(sourcesPath)[ServerType.bedrockWindows]?.path;
    }

    function createFallbackSource(sourcesPath: string) {
      fs.mkdirSync(path.join(sourcesPath, "bwv1.21.132.1", "behavior_packs", "vanilla"), { recursive: true });
    }

    beforeEach(() => {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      fs.mkdirSync(tempRoot, { recursive: true });
    });

    after(() => {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    });

    it("publishes a full extraction that is then selected", async () => {
      const finalPath = path.join(tempRoot, version);

      await ServerManager.extractServerSource(await createServerLikeSource(), finalPath);

      expect(fs.existsSync(path.join(finalPath, ServerManager.extractionCompleteMarkerName))).to.be.true;

      for (const folderPath of IGNORABLE_FOLDER_PATHS) {
        expect(fs.existsSync(path.join(finalPath, folderPath, "data.brarchive")), folderPath).to.be.true;
      }

      expect(fs.readdirSync(tempRoot)).to.deep.equal([version]);
      expect(selectLatest(tempRoot)).to.equal(finalPath + path.sep);
    });

    it("replaces a previously incomplete source", async () => {
      const finalPath = path.join(tempRoot, version);
      fs.mkdirSync(path.join(finalPath, "behavior_packs", "vanilla", "__brarchive"), { recursive: true });
      fs.writeFileSync(path.join(finalPath, "stale.txt"), "stale");

      expect(selectLatest(tempRoot)).to.be.undefined;

      await ServerManager.extractServerSource(await createServerLikeSource(), finalPath);

      expect(fs.existsSync(path.join(finalPath, "stale.txt"))).to.be.false;
      expect(selectLatest(tempRoot)).to.equal(finalPath + path.sep);
    });

    it("does not publish a failed extraction, so the next attempt re-extracts", async () => {
      const finalPath = path.join(tempRoot, version);
      createFallbackSource(tempRoot);

      // A file with no content is never written, so the extraction comes up one file short.
      const brokenSource = await createServerLikeSource();
      brokenSource.ensureFolder("behavior_packs").ensureFolder("vanilla").ensureFile("unreadable.json");

      let error: unknown;

      try {
        await ServerManager.extractServerSource(brokenSource, finalPath);
      } catch (e) {
        error = e;
      }

      expect(error, "extraction error").to.not.be.undefined;
      expect(fs.existsSync(finalPath), "final folder").to.be.false;
      expect(fs.readdirSync(tempRoot)).to.deep.equal(["bwv1.21.132.1"]);
      expect(selectLatest(tempRoot)).to.equal(path.join(tempRoot, "bwv1.21.132.1") + path.sep);

      await ServerManager.extractServerSource(await createServerLikeSource(), finalPath);

      expect(selectLatest(tempRoot)).to.equal(finalPath + path.sep);
    });
  });
});
