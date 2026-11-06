// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests that a render whose page never loads fails with its timeout error instead of hanging.
 * While a navigation is stalled, Playwright's page.evaluate() never settles, so
 * PlaywrightPageRenderer stops waiting for the page to release its presentation scene, and then
 * closes the page's context. The browser test uses only a local server, never the internet.
 */

import { assert } from "chai";
import http from "http";
import { AddressInfo } from "net";
import { mock } from "node:test";
import { chromium, type Browser, type BrowserContextOptions, type LaunchOptions, type Page } from "playwright";
import PlaywrightPageRenderer from "../local/PlaywrightPageRenderer";
import { resolveRenderPresentationOptions } from "../cli/commands/render/RenderPresentationOptions";

/** A page that answers the release with `evaluate`. */
function fakePage(evaluate: () => Promise<unknown>): Page {
  return { isClosed: () => false, evaluate } as unknown as Page;
}

/** The number of timers keeping the process alive. */
function activeTimers(): number {
  return process.getActiveResourcesInfo().filter((resource) => resource === "Timeout").length;
}

describe("Releasing a render page's presentation scene", () => {
  it("stops waiting for a page that never answers, and clears its timer", async () => {
    const renderer = new PlaywrightPageRenderer();
    const neverAnswers = fakePage(() => new Promise(() => {}));
    const started = Date.now();
    await renderer["releasePresentation"](neverAnswers, 5);
    assert.isBelow(Date.now() - started, 1000, "Kept waiting for a page that never answers");

    // A page that answers at once settles the release without a turn of the event loop, so no
    // other timer can start or finish in between.
    const timers = activeTimers();
    await renderer["releasePresentation"](fakePage(async () => undefined));
    assert.equal(activeTimers(), timers, "Left its release timer running");
  });
});

describe("Rendering a page the server never returns", function () {
  // Launching the browser takes a few seconds.
  this.timeout(30000);
  const navigationTimeoutMs = 500;
  const server = http.createServer(() => {}); // Never answers a request.
  let renderer: PlaywrightPageRenderer | undefined;
  let browser: Browser | undefined;

  before(async function () {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const launch = chromium.launch.bind(chromium);
    mock.method(chromium, "launch", async (options?: LaunchOptions) => {
      const launched = await launch(options);
      const newContext = launched.newContext.bind(launched);
      // renderModel navigates with Playwright's default timeout, 30 seconds.
      launched.newContext = async (contextOptions?: BrowserContextOptions) => {
        const context = await newContext(contextOptions);
        context.setDefaultNavigationTimeout(navigationTimeoutMs);
        return context;
      };
      browser = launched;
      return launched;
    });
    renderer = new PlaywrightPageRenderer(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    if (!(await renderer.initialize())) {
      this.skip();
    }
  });

  after(async () => {
    await renderer?.close();
    mock.restoreAll();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it("fails with the timeout error, then closes the page and the browser", async () => {
    const started = Date.now();
    const result = await renderer!.renderModel("/?mode=modelviewer", {
      presentation: resolveRenderPresentationOptions({}),
      width: 2,
      height: 2,
    });

    // After the navigation times out, the page gets a second to report its viewer error and a
    // second to release its scene.
    assert.isBelow(Date.now() - started, navigationTimeoutMs + 5000);
    assert.isUndefined(result.imageData);
    assert.match(result.error ?? "", /^Rendering failed: page\.goto: Timeout 500ms exceeded\./);
    assert.isEmpty(browser!.contexts(), "Left the page's context open");
    await renderer!.close();
    assert.isFalse(browser!.isConnected(), "Left the browser running");
  });
});
