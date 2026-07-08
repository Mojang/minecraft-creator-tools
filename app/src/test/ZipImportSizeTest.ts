// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ZipImportSizeTest.ts
 *
 * Tests for the content-scoped zip-import size handling:
 *  - The 500 MiB limit applies only to files under the top-level "Content/" folder.
 *  - Non-Content/ files do not count toward the 500 MiB content limit.
 *  - The lower-level unzip safety ceiling is 2 GiB.
 *  - Specific, structured ZipImportErrors are raised for the content-over-limit and
 *    package-over-safety-ceiling cases (instead of a generic failure).
 *
 * The size-budget logic is verified through the pure SecurityUtilities helpers using
 * synthetic sizes (no multi-GB buffers), and the real throw path is verified end-to-end
 * through ZipStorage.loadFromUint8Array on small zips.
 */

// NOTE: import CreatorTools first to prime the module-load order. The storage module graph
// has a circular dependency (FileBase <-> StorageUtilities <-> ... <-> GitHubFile) that only
// resolves cleanly when a higher-level module is evaluated first; importing ZipStorage in
// isolation triggers "Class extends value undefined". Other standalone tests do the same.
import "../app/CreatorTools";
import { expect } from "chai";
import JSZip from "jszip";
import SecurityUtilities from "../core/SecurityUtilities";
import ZipStorage from "../storage/ZipStorage";
import ZipImportError, { ZipImportErrorCode } from "../storage/ZipImportError";

const MB = 1024 * 1024;

describe("Zip import size handling", function () {
  // The end-to-end cases build/compress buffers at the real 500 MiB limit, so allow ample time.
  this.timeout(120000);

  describe("SecurityUtilities.isContentPath", () => {
    it("recognizes top-level Content/ files", () => {
      expect(SecurityUtilities.isContentPath("Content/world_template/level.dat")).to.equal(true);
      expect(SecurityUtilities.isContentPath("Content/")).to.equal(true);
    });

    it("normalizes leading slashes and backslashes", () => {
      expect(SecurityUtilities.isContentPath("/Content/foo.json")).to.equal(true);
      expect(SecurityUtilities.isContentPath("Content\\foo.json")).to.equal(true);
    });

    it("rejects non-Content paths", () => {
      expect(SecurityUtilities.isContentPath("docs/readme.md")).to.equal(false);
      expect(SecurityUtilities.isContentPath("ContentExtra/foo.json")).to.equal(false);
      expect(SecurityUtilities.isContentPath("worlds/Content/foo.json")).to.equal(false);
      expect(SecurityUtilities.isContentPath("")).to.equal(false);
    });
  });

  describe("SecurityUtilities.checkDecompressedSizeLimits", () => {
    it("keeps the compressed upload limit aligned with the total decompressed safety ceiling", () => {
      expect(SecurityUtilities.MAX_UPLOAD_SIZE).to.equal(SecurityUtilities.MAX_DECOMPRESSED_SIZE);
    });

    it("does not flag when only non-Content files push total over the content limit", () => {
      // Content/ stays under 500 MiB; non-Content build artifacts push the total well over it,
      // but stay under the 2 GiB safety ceiling -> no violation.
      const entries = [
        { path: "Content/world_template/level.dat", uncompressedSize: 100 * MB },
        { path: "build/artifact.bin", uncompressedSize: 600 * MB },
      ];

      const result = SecurityUtilities.checkDecompressedSizeLimits(entries);

      expect(result.contentSize).to.equal(100 * MB);
      expect(result.totalSize).to.equal(700 * MB);
      expect(result.violation).to.equal(undefined);
    });

    it("flags a content violation when Content/ exceeds 500 MiB", () => {
      const entries = [
        { path: "Content/world_template/big.dat", uncompressedSize: 501 * MB },
        { path: "docs/readme.md", uncompressedSize: 1 * MB },
      ];

      const result = SecurityUtilities.checkDecompressedSizeLimits(entries);

      expect(result.contentSize).to.equal(501 * MB);
      expect(result.violation).to.equal("content");
    });

    it("flags a total violation when the package exceeds the 2 GiB safety ceiling", () => {
      // Non-Content files alone push the total past 2 GiB; total/safety takes precedence.
      const entries = [
        { path: "Content/world_template/level.dat", uncompressedSize: 10 * MB },
        { path: "huge/blob.bin", uncompressedSize: 2100 * MB },
      ];

      const result = SecurityUtilities.checkDecompressedSizeLimits(entries);

      expect(result.totalSize).to.equal(2110 * MB);
      expect(result.violation).to.equal("total");
    });

    it("honors custom (small) limits for deterministic testing", () => {
      const entries = [
        { path: "Content/a.json", uncompressedSize: 150 },
        { path: "other/b.json", uncompressedSize: 400 },
      ];

      // maxContent=100, maxTotal=10000 -> content violation (150 > 100).
      expect(SecurityUtilities.checkDecompressedSizeLimits(entries, 100, 10000).violation).to.equal("content");

      // maxContent=10000, maxTotal=500 -> total violation (550 > 500), takes precedence.
      expect(SecurityUtilities.checkDecompressedSizeLimits(entries, 10000, 500).violation).to.equal("total");

      // Generous limits -> no violation.
      expect(SecurityUtilities.checkDecompressedSizeLimits(entries, 10000, 10000).violation).to.equal(undefined);
    });
  });

  describe("ZipImportError", () => {
    it("carries a stable code and status code, and is recognized by its type guard", () => {
      const err = new ZipImportError(ZipImportErrorCode.contentSizeExceeded, "too big", 413);

      expect(err.code).to.equal("CONTENT_SIZE_EXCEEDED");
      expect(err.statusCode).to.equal(413);
      expect(err.message).to.equal("too big");
      expect(err instanceof Error).to.equal(true);
      expect(ZipImportError.is(err)).to.equal(true);
      expect(ZipImportError.is(new Error("plain"))).to.equal(false);
    });
  });

  describe("ZipStorage.loadFromUint8Array (end-to-end small zips)", () => {
    async function buildZip(files: { path: string; size: number }[]): Promise<Uint8Array> {
      const jsz = new JSZip();

      for (const f of files) {
        // Use zero-filled buffers; uncompressedSize metadata reflects the real (large)
        // size while DEFLATE keeps the compressed payload tiny.
        jsz.file(f.path, new Uint8Array(f.size));
      }

      return await jsz.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    }

    it("imports a small package with a Content/ file", async () => {
      const data = await buildZip([
        { path: "Content/world_template/manifest.json", size: 64 },
        { path: "README.md", size: 16 },
      ]);

      const zs = new ZipStorage();
      await zs.loadFromUint8Array(data, "small.zip");

      const contentFolder = zs.rootFolder.ensureFolder("Content");
      expect(await contentFolder.exists()).to.equal(true);
    });

    it("throws a content-size error when Content/ exceeds the content limit", async () => {
      // Build a zip whose Content/ uncompressedSize exceeds 500 MiB using a highly
      // compressible (zero-filled) buffer so the test stays fast and low-memory on disk.
      const data = await buildZip([{ path: "Content/big.bin", size: SecurityUtilities.MAX_CONTENT_DECOMPRESSED_SIZE + 1 }]);

      const zs = new ZipStorage();
      let caught: unknown;

      try {
        await zs.loadFromUint8Array(data, "overcontent.zip");
      } catch (e) {
        caught = e;
      }

      expect(ZipImportError.is(caught)).to.equal(true);
      expect((caught as ZipImportError).code).to.equal(ZipImportErrorCode.contentSizeExceeded);
    });

    it("imports past size checks when only non-Content files are large", async () => {
      // Non-Content file just over the 500 MiB content limit, but under the 2 GiB ceiling:
      // this must NOT raise a content-size error (acceptance criterion 1, end to end).
      const data = await buildZip([
        { path: "Content/small.json", size: 32 },
        { path: "artifacts/blob.bin", size: SecurityUtilities.MAX_CONTENT_DECOMPRESSED_SIZE + 1 },
      ]);

      const zs = new ZipStorage();

      await zs.loadFromUint8Array(data, "noncontent.zip");

      const contentFolder = zs.rootFolder.ensureFolder("Content");
      expect(await contentFolder.exists()).to.equal(true);
    });
  });
});
