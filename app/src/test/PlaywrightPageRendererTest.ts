// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { spawn } from "child_process";
import fs from "fs";
import { mock } from "node:test";
import os from "os";
import path from "path";
import { chromium, type LaunchOptions } from "playwright";
import Log from "../core/Log";
import * as BrowserInstallation from "../local/BrowserInstallation";
import { releasePipesAfterExit } from "../local/BrowserProcessPipes";
import PlaywrightPageRenderer, { decodePresentationPng } from "../local/PlaywrightPageRenderer";
import { PNG } from "pngjs";
import { resolveRenderPresentationOptions } from "../cli/commands/render/RenderPresentationOptions";
import TestPaths from "./TestPaths";

const HARDWARE = "ANGLE (Intel, Intel(R) UHD Graphics, OpenGL)";
const SOFTWARE = "ANGLE (Google, Vulkan (SwiftShader Device), SwiftShader driver)";

describe("Render presentation capture failure boundaries", () => {
  const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
  for (const data of [
    "data:,",
    "data:image/png;base64,",
    "data:image/png;base64,AAAA",
    "data:image/png;base64," + png.subarray(0, 30).toString("base64"),
  ]) {
    it(`rejects empty or corrupt output ${data.slice(0, 40)}`, () => {
      assert.throws(() => decodePresentationPng(data, 2, 2), /PNG/);
    });
  }
  it("verifies decoded dimensions before returning image bytes", () => {
    const data = "data:image/png;base64," + png.toString("base64");
    assert.deepEqual(decodePresentationPng(data, 2, 2), png);
    assert.throws(() => decodePresentationPng(data, 4, 2), /expected 4x2/);
  });
  it("waits for an initially absent presentation canvas within the configured readiness timeout", async () => {
    let ready = false;
    const page = {
      on: () => {},
      goto: async () => {},
      waitForTimeout: async () => {},
      waitForFunction: async () => {},
      isClosed: () => false,
      locator: (selector: string) => {
        const locator = {
          textContent: async () => null,
          count: async () => (selector === "canvas" ? Number(ready) : 1),
          first: () => locator,
          waitFor: async () => {
            ready = true;
          },
        };
        return locator;
      },
      evaluate: async (_fn: unknown, args?: object) =>
        args ? "data:image/png;base64," + png.toString("base64") : undefined,
    };
    const context = { newPage: async () => page, close: async () => {} };
    const browser = {
      newContext: async () => context,
      contexts: () => [context],
      isConnected: () => true,
      close: async () => {},
    };
    // The browser is fake, so every browser counts as installed.
    mock.method(BrowserInstallation, "isBrowserInstalled", async () => true);
    mock.method(chromium, "launch", async () => browser);
    const renderer = new PlaywrightPageRenderer();
    try {
      const result = await renderer.renderModel("/?mode=modelviewer", {
        presentation: resolveRenderPresentationOptions({}),
        width: 2,
        height: 2,
        canvasTimeout: 100,
      });
      assert.isUndefined(result.error);
      assert.deepEqual(Buffer.from(result.imageData!), png);
    } finally {
      await renderer.close();
      mock.restoreAll();
    }
  });
  for (const releaseFails of [false, true]) {
    it(`releases a failed presentation capture before closing its context (release failure: ${releaseFails})`, async () => {
      const events: string[] = [];
      const locator = {
        textContent: async () => null,
        count: async () => 1,
        first: () => locator,
        waitFor: async () => {},
      };
      const page = {
        on: () => {},
        goto: async () => {},
        waitForTimeout: async () => {},
        locator: () => locator,
        waitForFunction: async () => {},
        isClosed: () => false,
        evaluate: async (fn: unknown, args?: object) => {
          if (args) return "data:,";
          if (String(fn).includes("release")) {
            events.push("release");
            if (releaseFails) throw new Error("Controlled release failure");
          }
          return undefined;
        },
      };
      const context = {
        newPage: async () => page,
        close: async () => {
          events.push("context-close");
        },
      };
      const browser = {
        newContext: async () => context,
        contexts: () => [context],
        isConnected: () => true,
        close: async () => {
          events.push("browser-close");
        },
      };
      mock.method(BrowserInstallation, "isBrowserInstalled", async () => true);
      mock.method(chromium, "launch", async () => browser);
      const renderer = new PlaywrightPageRenderer();
      try {
        const result = await renderer.renderModel("/?mode=modelviewer", {
          presentation: resolveRenderPresentationOptions({}),
          width: 2,
          height: 2,
        });
        assert.isUndefined(result.imageData, "A caller must not be able to write corrupt output");
        assert.include(result.error, "did not produce a PNG");
        assert.notInclude(result.error, "Controlled release failure", "Keep the original capture failure");
        assert.isBelow(events.indexOf("release"), events.indexOf("context-close"));
      } finally {
        await renderer.close();
        mock.restoreAll();
      }
      assert.include(events, "browser-close");
    });
  }
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** The launch mock implements only the browser operations used during initialization. */
class ProbeBrowser {
  connected = true;
  closes = 0;
  contextCloses = 0;
  probes = 0;
  started = deferred<void>();
  result = deferred<{ renderer: string | null } | null>();

  constructor(renderer: string | null = HARDWARE, pending = false) {
    if (!pending) this.result.resolve({ renderer });
  }

  isConnected() {
    return this.connected;
  }

  async newContext() {
    return {
      newPage: async () => ({
        evaluate: async () => {
          this.probes++;
          this.started.resolve();
          return this.result.promise;
        },
      }),
      close: async () => {
        this.contextCloses++;
      },
    };
  }

  async close() {
    this.closes++;
    this.connected = false;
    this.result.reject(new Error("Browser closed"));
  }
}

describe("Playwright rendering backend selection", function () {
  this.timeout(10000);
  let renderer: PlaywrightPageRenderer;
  let launched: ProbeBrowser[];
  let launches: LaunchOptions[];

  beforeEach(() => {
    renderer = new PlaywrightPageRenderer(undefined, { useHardwareGpu: "auto" });
    launched = [];
    launches = [];
  });

  afterEach(async () => {
    await renderer.close();
    mock.restoreAll();
    assert.isTrue(
      launched.every((browser) => !browser.connected),
      "all owned browsers must close"
    );
  });

  function launchWith(factory: (options: LaunchOptions) => ProbeBrowser | Promise<ProbeBrowser>) {
    // These tests choose which browsers launch, so every browser counts as installed.
    mock.method(BrowserInstallation, "isBrowserInstalled", async () => true);
    mock.method(chromium, "launch", async (options: LaunchOptions) => {
      launches.push(options);
      if (options.timeout !== undefined) {
        assert.isAbove(options.timeout, 0);
        assert.isAtMost(options.timeout, 5000);
      }
      const browser = await factory(options);
      launched.push(browser);
      return browser;
    });
  }

  function isSoftware(options: LaunchOptions) {
    return options.args?.includes("--use-angle=swiftshader") === true;
  }

  it("reuses verified hardware and closes its probe context before it is ready", async () => {
    const hardware = new ProbeBrowser();
    launchWith(() => hardware);
    assert.isTrue(await renderer.initialize());
    assert.isTrue(renderer.isBrowserReady());
    assert.lengthOf(launches, 1);
    assert.isFalse(isSoftware(launches[0]));
    assert.equal(hardware.probes, 1);
    assert.equal(hardware.contextCloses, 1);
    assert.equal(hardware.closes, 0);
    assert.isTrue(await renderer.initialize());
    assert.lengthOf(launches, 1);
  });

  for (const backend of [
    SOFTWARE,
    "llvmpipe (LLVM 15.0.7, 256 bits)",
    "AMD softpipe",
    "Intel OpenSWR",
    "Microsoft Basic Render Driver",
    "Apple Software Renderer",
    "ANGLE (NVIDIA, VMware virtual adapter)",
    "unidentified renderer",
    null,
  ]) {
    it(`uses software for an unverified hardware backend: ${backend}`, async () => {
      const software = new ProbeBrowser(SOFTWARE);
      launchWith((options) => (isSoftware(options) ? software : new ProbeBrowser(backend)));
      assert.isTrue(await renderer.initialize());
      assert.isAbove(launched.length, 2);
      assert.isTrue(launches.slice(0, -1).every((options) => !isSoftware(options)));
      assert.isTrue(isSoftware(launches[launches.length - 1]));
      for (const rejected of launched.slice(0, -1)) {
        assert.equal(rejected.contextCloses, 1);
        assert.equal(rejected.closes, 1);
      }
      assert.equal(software.contextCloses, 1);
    });
  }

  for (const failure of ["missing context", "probe failure", "probe timeout"]) {
    it(`falls back and closes the candidate on ${failure}`, async () => {
      const hardware = new ProbeBrowser(HARDWARE, true);
      const software = new ProbeBrowser(SOFTWARE);
      launchWith((options) => {
        if (isSoftware(options)) return software;
        return options.channel === "chrome" ? hardware : new ProbeBrowser(null);
      });
      const initializing = renderer.initialize();
      await hardware.started.promise;
      if (failure === "missing context") hardware.result.resolve(null);
      if (failure === "probe failure") hardware.result.reject(new Error("GPU process failed"));
      assert.isTrue(await initializing);
      for (const rejected of launched.slice(0, -1)) {
        assert.equal(rejected.contextCloses, 1);
        assert.equal(rejected.closes, 1);
      }
      assert.isTrue(isSoftware(launches[launches.length - 1]));
    });
  }

  it("tries software when hardware browser launches fail", async () => {
    launchWith((options) => {
      if (!isSoftware(options)) throw new Error("Hardware launch failed");
      return new ProbeBrowser(SOFTWARE);
    });
    assert.isTrue(await renderer.initialize());
    assert.isTrue(isSoftware(launches[launches.length - 1]));
    assert.lengthOf(launched, 1);
  });

  it("retains the browser resolution order when a browser is not installed", async () => {
    launchWith((options) => {
      if (options.channel === "chrome") throw new Error("Not installed");
      return new ProbeBrowser();
    });
    assert.isTrue(await renderer.initialize());
    assert.equal(launches[0].channel, "chrome");
    assert.equal(launches[1].channel, "msedge");
    assert.lengthOf(launches, 2);
    assert.lengthOf(launched, 1);
    assert.equal(renderer.getBrowserInfo(), "System Edge");
  });

  it("continues the hardware search after a launched browser exposes only software WebGL", async () => {
    launchWith((options) => {
      if (options.channel === "chrome") return new ProbeBrowser(SOFTWARE);
      if (options.channel === "msedge") return new ProbeBrowser(HARDWARE);
      throw new Error("Not installed");
    });
    assert.isTrue(await renderer.initialize());
    assert.equal(renderer.getBrowserInfo(), "System Edge");
    assert.deepEqual(
      launches.map((options) => ({ channel: options.channel, software: isSoftware(options) })),
      [
        { channel: "chrome", software: false },
        { channel: "msedge", software: false },
      ]
    );
    assert.equal(launched[0].contextCloses, 1);
    assert.equal(launched[0].closes, 1);
    assert.equal(launched[1].contextCloses, 1);
    assert.equal(launched[1].closes, 0);
  });

  it("continues the software search after a launched browser has unusable WebGL", async () => {
    const errors: string[] = [];
    mock.method(Log, "fail", (message: string) => errors.push(message));
    launchWith((options) => {
      if (options.channel === "chrome") {
        const browser = new ProbeBrowser(HARDWARE, true);
        browser.result.resolve(null);
        return browser;
      }
      if (options.channel === "msedge" && isSoftware(options)) return new ProbeBrowser(SOFTWARE);
      throw new Error("Unavailable");
    });
    assert.isTrue(await renderer.initialize(), errors.join("\n"));
    assert.equal(renderer.getBrowserInfo(), "System Edge");
    assert.deepEqual(
      launches.filter(isSoftware).map((options) => options.channel),
      ["chrome", "msedge"]
    );
    assert.lengthOf(launched, 3);
    for (const rejected of launched.slice(0, -1)) {
      assert.equal(rejected.contextCloses, 1);
      assert.equal(rejected.closes, 1);
    }
    assert.equal(launched[2].contextCloses, 1);
    assert.equal(launched[2].closes, 0);
  });

  for (const softwareSearch of [false, true]) {
    for (const expiration of ["none", "launch", "probe"]) {
      it(`keeps the ${softwareSearch ? "software" : "hardware"} search budget with ${expiration} expiry`, async () => {
        let now = 0;
        mock.method(Date, "now", () => now);
        const probeTimeouts: number[] = [];
        const schedule = global.setTimeout;
        mock.method(global, "setTimeout", (callback: () => void, delay: number) => {
          probeTimeouts.push(delay);
          return schedule(callback, delay);
        });
        const errors: string[] = [];
        mock.method(Log, "fail", (message: string) => errors.push(message));
        const rejected = new ProbeBrowser(HARDWARE, true);
        rejected.result.resolve(null);
        const close = rejected.close.bind(rejected);
        mock.method(rejected, "close", async () => {
          await close();
          now += (softwareSearch ? 30000 : 10000) - 100;
        });
        const next = new ProbeBrowser(softwareSearch ? SOFTWARE : HARDWARE);
        if (expiration === "probe") {
          const newContext = next.newContext.bind(next);
          mock.method(next, "newContext", async () => {
            now += 100;
            return newContext();
          });
        }
        launchWith((options) => {
          if (isSoftware(options) !== softwareSearch) {
            if (softwareSearch) throw new Error("Hardware unavailable");
            return new ProbeBrowser(SOFTWARE);
          }
          if (options.channel === "chrome") return rejected;
          if (options.channel === "msedge") {
            if (expiration === "launch") now += 100;
            return next;
          }
          throw new Error("Not installed");
        });

        assert.equal(await renderer.initialize(), !softwareSearch || expiration === "none");
        assert.deepEqual(
          launches.filter((options) => isSoftware(options) === softwareSearch).map((options) => options.timeout),
          [5000, 100]
        );
        assert.equal(rejected.contextCloses, 1);
        assert.equal(rejected.closes, 1);
        assert.equal(next.probes, expiration === "launch" ? 0 : 1);
        assert.equal(next.contextCloses, expiration === "launch" ? 0 : 1);
        assert.equal(next.closes, expiration === "none" ? 0 : 1);
        if (expiration !== "launch") assert.deepEqual(probeTimeouts.slice(0, 2), [3000, 100]);
        if (expiration === "none") assert.equal(renderer.getBrowserInfo(), "System Edge");
        if (softwareSearch && expiration !== "none") assert.include(errors.join("\n"), "No browser available");
      });
    }
  }

  for (const failure of ["launch", "WebGL"]) {
    it(`reports initialization failure when both backends fail ${failure}`, async () => {
      const errors: string[] = [];
      mock.method(Log, "fail", (message: string) => errors.push(message));
      launchWith(() => {
        if (failure === "launch") throw new Error("No browser");
        const browser = new ProbeBrowser(HARDWARE, true);
        browser.result.resolve(null);
        return browser;
      });
      assert.isFalse(await renderer.initialize());
      assert.isFalse(renderer.isBrowserReady());
      assert.include(errors.join("\n"), "npx playwright install chromium");
    });
  }

  for (const preference of [undefined, false, true]) {
    it(`preserves the non-auto API preference ${preference} without a probe`, async () => {
      renderer = new PlaywrightPageRenderer(undefined, { useHardwareGpu: preference });
      const browser = new ProbeBrowser();
      launchWith(() => browser);
      assert.isTrue(await renderer.initialize());
      assert.equal(isSoftware(launches[0]), preference !== true);
      assert.isUndefined(launches[0].timeout, "explicit preferences retain Playwright's existing launch timeout");
      assert.equal(browser.probes, 0);
    });
  }

  it("coalesces concurrent initialization without reporting early readiness", async () => {
    const hardware = new ProbeBrowser(HARDWARE, true);
    launchWith(() => hardware);
    const first = renderer.initialize();
    const second = renderer.initialize();
    await hardware.started.promise;
    assert.isFalse(renderer.isBrowserReady());
    assert.equal(renderer.getBrowserInfo(), "Not initialized");
    assert.lengthOf(launches, 1);
    hardware.result.resolve({ renderer: HARDWARE });
    assert.deepEqual(await Promise.all([first, second]), [true, true]);
    assert.equal(hardware.probes, 1);
  });

  it("cancels a pending probe and does not start software after close", async () => {
    const hardware = new ProbeBrowser(HARDWARE, true);
    launchWith(() => hardware);
    const initializing = renderer.initialize();
    await hardware.started.promise;
    await renderer.close();
    assert.isFalse(await initializing);
    assert.lengthOf(launches, 1);
    assert.equal(hardware.closes, 1);
    assert.equal(hardware.contextCloses, 1);
  });

  it("closes a browser that finishes launching after cancellation", async () => {
    const launch = deferred<ProbeBrowser>();
    const started = deferred<void>();
    launchWith(() => {
      started.resolve();
      return launch.promise;
    });
    const initializing = renderer.initialize();
    await started.promise;
    const closing = renderer.close();
    const hardware = new ProbeBrowser();
    launch.resolve(hardware);
    await closing;
    assert.isFalse(await initializing);
    assert.lengthOf(launches, 1);
    assert.equal(hardware.probes, 0);
    assert.equal(hardware.closes, 1);
  });

  it("can cancel initialization immediately and coalesces close calls", async () => {
    launchWith(() => new ProbeBrowser());
    const initializing = renderer.initialize();
    await Promise.all([renderer.close(), renderer.close()]);
    assert.isFalse(await initializing);
    assert.lengthOf(launches, 0);
  });
});

const BROWSER_WITH_CHILD = path.join(TestPaths.appRoot, "src/test/fixtures/browserWithChildProcess.cjs");
/** Longer than the 20-second cleanup guard in `mct render batch`. */
const CHILD_LIFETIME_MS = 60000;
/** Well under that guard. Releasing the pipes adds about 250 ms after the browser exits. */
const CLOSE_BOUND_MS = 5000;

function isRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => (timer = setTimeout(() => resolve(false), ms))),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe("Closing a browser whose child process holds its output", function () {
  this.timeout(30000);
  let root: string;
  let children: number[];
  let renderers: PlaywrightPageRenderer[];

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "mct-browser-pipes-"));
    children = [];
    renderers = [];
  });

  afterEach(async () => {
    mock.restoreAll();
    for (const pid of children.filter(isRunning)) {
      process.kill(pid);
    }
    // With the children gone, closing can't wait on their pipes.
    await Promise.all(renderers.map((renderer) => renderer.close()));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("closes the renderer once the browser exits, without stopping its child or skipping profile cleanup", async () => {
    const infoPath = path.join(root, "processes.json");
    const temp = path.join(root, "temp");
    fs.mkdirSync(temp);
    const launch = chromium.launch.bind(chromium);
    // Every browser launches this fake one, so every browser counts as installed.
    mock.method(BrowserInstallation, "isBrowserInstalled", async () => true);
    mock.method(chromium, "launch", async () => {
      // Playwright creates the browser's temporary profile in os.tmpdir().
      const tmpdir = mock.method(os, "tmpdir", () => temp);
      try {
        return await launch({
          executablePath: process.execPath,
          ignoreDefaultArgs: true,
          args: [BROWSER_WITH_CHILD, infoPath, String(CHILD_LIFETIME_MS)],
          timeout: 15000,
        });
      } finally {
        tmpdir.mock.restore();
      }
    });
    const renderer = new PlaywrightPageRenderer(undefined, { useHardwareGpu: false });
    renderers.push(renderer);
    assert.isTrue(await renderer.initialize());
    children.push(JSON.parse(fs.readFileSync(infoPath, "utf8")).child);
    assert.isNotEmpty(fs.readdirSync(temp), "Playwright creates a temporary profile");

    assert.isTrue(
      await settlesWithin(renderer.close(), CLOSE_BOUND_MS),
      `Closing the renderer must not wait for the browser's child process (limit ${CLOSE_BOUND_MS} ms)`
    );
    const processes = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    assert.isTrue(processes.closedOnRequest, "The browser exits because Playwright asks it to close");
    assert.isFalse(isRunning(processes.browser), "No browser process is left running");
    assert.isTrue(isRunning(processes.child), "Closing doesn't stop the browser's child process");
    assert.isEmpty(fs.readdirSync(temp), "Playwright still removes the temporary profile");
  });

  it("reads a process's last output before closing the pipes its child holds", async () => {
    const script = `
      const child = require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, ${CHILD_LIFETIME_MS})"], {
        detached: true,
        stdio: ["ignore", "inherit", "inherit"],
        windowsHide: true,
      });
      process.stdout.write(child.pid + "\\n", () => process.stderr.write("last line\\n", () => process.exit(0)));
    `;
    const parent = spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] });
    releasePipesAfterExit(parent);
    let stdout = "";
    let stderr = "";
    parent.stdout.on("data", (data) => (stdout += data));
    parent.stderr.on("data", (data) => (stderr += data));
    const closed = new Promise((resolve) => parent.once("close", resolve));
    await new Promise((resolve) => parent.once("exit", resolve));

    const closedPromptly = await settlesWithin(closed, CLOSE_BOUND_MS);
    const child = Number(stdout.trim());
    children.push(child);
    assert.isTrue(closedPromptly, "The pipes close after the process exits");
    assert.equal(stderr, "last line\n");
    assert.isTrue(isRunning(child), "Closing the pipes doesn't stop the child");
  });
});
