// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import axios from "axios";

import HttpStorage from "../storage/HttpStorage";

/**
 * Regression coverage for the "missing files after save-to-disk" bug.
 *
 * Before the fix, `HttpFile.loadContent` silently swallowed transient axios
 * errors (binary branch: `} catch (e) {}`; text branch: `Log.verbose`) and
 * left `_content === null`. Callers like `StorageUtilities.syncFileTo` then
 * skipped copying the file to the target folder, producing project saves
 * that were missing a random subset of files on every run.
 *
 * Additionally, `_isLoading` was checked but never set, so the in-flight
 * dedupe path was dead code.
 */

type AxiosGet = typeof axios.get;

describe("HttpFile.loadContent", () => {
  let originalGet: AxiosGet;

  beforeEach(() => {
    originalGet = axios.get.bind(axios);
    HttpStorage.clearCache();
  });

  afterEach(() => {
    (axios as { get: AxiosGet }).get = originalGet;
    HttpStorage.clearCache();
  });

  function installAxiosMock(impl: (url: string, config?: unknown) => Promise<unknown>) {
    (axios as { get: AxiosGet }).get = ((url: string, config?: unknown) =>
      impl(url, config)) as unknown as AxiosGet;
  }

  it("retries transient network failures and ultimately populates content (text)", async () => {
    let attempts = 0;
    installAxiosMock(async () => {
      attempts++;
      if (attempts < 3) {
        throw Object.assign(new Error("ECONNRESET"), { code: "ECONNRESET" });
      }
      return { data: "hello world", status: 200 };
    });

    const storage = new HttpStorage("https://example.test/sample/");
    const file = storage.rootFolder.ensureFile("greeting.txt");

    await file.loadContent(true);

    expect(attempts).to.equal(3);
    expect(file.content).to.equal("hello world");
  });

  it("retries transient network failures for binary content", async () => {
    let attempts = 0;
    installAxiosMock(async () => {
      attempts++;
      if (attempts < 2) {
        throw Object.assign(new Error("network blip"), { response: { status: 503 } });
      }
      return { data: new Uint8Array([1, 2, 3, 4]), status: 200 };
    });

    const storage = new HttpStorage("https://example.test/sample/");
    const file = storage.rootFolder.ensureFile("blob.png");

    await file.loadContent(true);

    expect(attempts).to.equal(2);
    expect(file.content).to.not.equal(null);
    const content = file.content as Uint8Array;
    expect(content.length).to.equal(4);
    expect(content[0]).to.equal(1);
    expect(content[3]).to.equal(4);
  });

  it("does not retry on non-retryable client errors (404)", async () => {
    let attempts = 0;
    installAxiosMock(async () => {
      attempts++;
      throw Object.assign(new Error("not found"), { response: { status: 404 } });
    });

    const storage = new HttpStorage("https://example.test/sample/");
    const file = storage.rootFolder.ensureFile("missing.txt");

    await file.loadContent(true);

    expect(attempts).to.equal(1);
    expect(file.content).to.equal(null);
  });

  it("dedupes concurrent loadContent calls for the same file", async () => {
    let attempts = 0;
    installAxiosMock(async () => {
      attempts++;
      // Yield so both callers can observe the in-flight load.
      await new Promise((r) => setTimeout(r, 5));
      return { data: "shared", status: 200 };
    });

    const storage = new HttpStorage("https://example.test/sample/");
    const file = storage.rootFolder.ensureFile("shared.txt");

    await Promise.all([file.loadContent(true), file.loadContent(true), file.loadContent(true)]);

    expect(attempts).to.equal(1);
    expect(file.content).to.equal("shared");
  });
});
