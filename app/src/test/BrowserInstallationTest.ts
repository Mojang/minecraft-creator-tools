// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import fs from "fs";
import { mock } from "node:test";
import os from "os";
import path from "path";
import { chromium, type Browser, type LaunchOptions } from "playwright";
import { loadBrowserRegistry } from "../local/BrowserInstallation";
import PlaywrightPageRenderer from "../local/PlaywrightPageRenderer";

describe("Starting a renderer when a browser isn't installed", () => {
  it("skips browsers that aren't installed and leaves no Playwright temporary folders", async () => {
    // The browser registry that launch() and the renderer both use to find a browser.
    const registry = loadBrowserRegistry();
    if (!registry) assert.fail("Playwright's browser registry didn't load.");
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mct-browser-installation-"));
    const candidates = [
      { name: "System Chrome", launchOptions: { channel: "chrome", headless: true } },
      { name: "Missing executable", launchOptions: { executablePath: path.join(temp, "missing"), headless: true } },
      { name: "Playwright Bundled Chromium", launchOptions: { headless: true } },
      { name: "Installed browser", launchOptions: { executablePath: process.execPath, headless: true } },
    ];
    const installed = { isConnected: () => true, close: async () => {} } as unknown as Browser;
    const launch = chromium.launch.bind(chromium);
    const findExecutable = registry.findExecutable.bind(registry);
    // Playwright creates its temporary folders in os.tmpdir() before it looks for the browser.
    mock.method(os, "tmpdir", () => temp);
    // Neither Chrome nor Playwright's own browser is installed, as far as the registry can tell.
    mock.method(registry, "findExecutable", (name: string) => ({
      ...findExecutable(name),
      executablePath: () => undefined,
      executablePathOrDie: () => {
        throw new Error(`${name} isn't installed.`);
      },
    }));
    mock.method(
      PlaywrightPageRenderer.prototype as unknown as { _getBrowserConfigs: () => typeof candidates },
      "_getBrowserConfigs",
      () => candidates
    );
    // The missing browsers get a real launch, so trying one would leave its folders in `temp`.
    mock.method(chromium, "launch", async (options: LaunchOptions) =>
      options.executablePath === process.execPath ? installed : launch(options)
    );
    const renderer = new PlaywrightPageRenderer(undefined, { useHardwareGpu: false });
    try {
      assert.isTrue(await renderer.initialize());
      assert.equal(renderer.getBrowserInfo(), "Installed browser");
      assert.deepEqual(fs.readdirSync(temp), []);
    } finally {
      await renderer.close();
      mock.restoreAll();
      fs.rmSync(temp, { recursive: true, force: true });
    }
  });

  it("reads the registry of the playwright-core that playwright itself loads", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mct-playwright-copies-"));
    const playwright = path.join(root, "node_modules", "playwright");
    // npm nests the playwright-core that playwright needs under it when a different version sits next to it.
    for (const [core, copy] of [
      [path.join(root, "node_modules", "playwright-core"), "outer"],
      [path.join(playwright, "node_modules", "playwright-core"), "nested"],
    ]) {
      fs.mkdirSync(path.join(core, "lib", "server", "registry"), { recursive: true });
      fs.writeFileSync(
        path.join(core, "lib", "server", "registry", "index.js"),
        `exports.registry = { copy: "${copy}", findExecutable() {} };`
      );
    }
    try {
      const registry = loadBrowserRegistry(path.join(playwright, "index.js")) as unknown as { copy: string };
      assert.equal(registry.copy, "nested");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
