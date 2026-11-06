// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests what render readiness timeouts report (RenderPageDiagnostics.ts): first the text on its
 * own, then PlaywrightPageRenderer with fake pages for the 30-second navigation waits, then real
 * pages from a local server with short canvas timeouts. No test uses the network.
 */

import { assert } from "chai";
import http from "http";
import { AddressInfo } from "net";
import { mock } from "node:test";
import { chromium, type Page } from "playwright";
import { PNG } from "pngjs";
import * as BrowserInstallation from "../local/BrowserInstallation";
import PlaywrightPageRenderer, { RenderOptions } from "../local/PlaywrightPageRenderer";
import RenderPageDiagnostics, {
  describeUrl,
  MAX_LISTED,
  MAX_MESSAGE_LENGTH,
  MAX_URL_LENGTH,
} from "../local/RenderPageDiagnostics";
import { resolveRenderPresentationOptions } from "../cli/commands/render/RenderPresentationOptions";

const HEADING = "At the timeout, the render page had:";
const NOTHING = "At the timeout, the render page had no pending or failed requests and no errors.";
/** C0 and C1 control characters, except the line breaks between lines. */
const CONTROL_CHARACTERS = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g;

/** Fails with the code point and position of each control character in `text`, except line breaks. */
function assertNoControlCharacters(text: string) {
  const found = [...text.matchAll(CONTROL_CHARACTERS)].map(
    (match) => `U+${match[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")} at ${match.index}`
  );
  assert.isEmpty(found, `Control characters in ${JSON.stringify(text)}`);
}

function timeoutError(message: string): Error {
  const error = new Error(message);
  error.name = "TimeoutError";
  return error;
}

/** `text` with each elapsed time at the end of a line, such as " (1.5s)", replaced by " (Ns)". */
function withoutElapsedTimes(text: string): string {
  return text.replace(/ \(\d+\.\ds\)$/gm, " (Ns)");
}

/** A page that keeps its event handlers, so a test can send events, and answers evaluate() with `answer`. */
function fakePage(answer: () => Promise<unknown>, closed = false) {
  const handlers: Array<[string, (value: unknown) => void]> = [];
  const page = {
    on: (event: string, handler: (value: unknown) => void) => handlers.push([event, handler]),
    isClosed: () => closed,
    evaluate: answer,
  };
  return {
    page: page as unknown as Page,
    emit(event: string, value: unknown) {
      for (const [name, handler] of handlers) {
        if (name === event) handler(value);
      }
    },
  };
}

/** A request, as page events pass it, that fails with `errorText` if it fails. */
function fakeRequest(url: string, errorText = "net::ERR_FAILED") {
  return { url: () => url, failure: () => ({ errorText }) };
}

describe("Render readiness diagnostics", () => {
  let now: number;
  let diagnostics: RenderPageDiagnostics;

  beforeEach(() => {
    now = 0;
    diagnostics = new RenderPageDiagnostics("http://localhost:6201", () => now);
  });

  function fail(url: string, error: string) {
    const request = {};
    diagnostics.requestStarted(request, url);
    diagnostics.requestFailed(request, error);
  }

  /** A request that got `status`, then finished, or failed with `error`. */
  function finish(url: string, status: number, error?: string) {
    const request = {};
    diagnostics.requestStarted(request, url);
    diagnostics.responseReceived(request, status);
    if (error === undefined) {
      diagnostics.requestFinished(request);
    } else {
      diagnostics.requestFailed(request, error);
    }
  }

  it("lists pending requests, longest first, with how long each has waited", () => {
    for (const [started, url] of [
      [1000, "http://localhost:6201/app/web.js"],
      [0, "https://mctools.dev/res/latest/van/serve/resource_pack/textures/entity/sheep/sheep.png"],
      [2500, "http://localhost:6201/temp/geometry-0.json"],
    ] as const) {
      now = started;
      diagnostics.requestStarted({}, url);
    }
    now = 30000;

    assert.equal(
      diagnostics.describe(),
      [
        HEADING,
        "  Requests still pending (3):",
        "    - https://mctools.dev/res/latest/van/serve/resource_pack/textures/entity/sheep/sheep.png (30.0s)",
        "    - http://localhost:6201/app/web.js (29.0s)",
        "    - http://localhost:6201/temp/geometry-0.json (27.5s)",
        "Check your internet connection: requests to mctools.dev didn't finish.",
      ].join("\n")
    );
  });

  it("lists failed requests with their network error or HTTP status", () => {
    fail("https://mctools.dev/res/latest/van/serve/index.json", "net::ERR_TIMED_OUT");
    finish("http://localhost:6201/temp/texture-0.png", 404);
    finish("http://localhost:6201/temp/geometry-0.json", 200);
    // Chromium cancels a response body the page never reads, after the status arrives.
    finish("http://localhost:6201/temp/texture-1.png", 500, "net::ERR_ABORTED");
    finish("http://localhost:6201/temp/geometry-1.json", 200, "net::ERR_ABORTED");
    fail("http://localhost:6201/app/chunk.js", "net::ERR_ABORTED");
    diagnostics.requestFailed({}, "net::ERR_FAILED");

    assert.equal(
      diagnostics.describe(),
      [
        HEADING,
        "  Requests that failed (3):",
        "    - https://mctools.dev/res/latest/van/serve/index.json: net::ERR_TIMED_OUT",
        "    - http://localhost:6201/temp/texture-0.png: HTTP 404",
        "    - http://localhost:6201/temp/texture-1.png: HTTP 500",
        "Check your internet connection: requests to mctools.dev didn't finish.",
      ].join("\n")
    );
  });

  for (const settle of ["finishes", "is canceled"]) {
    it(`counts an HTTP error status whose body is still loading, once, after it ${settle}`, () => {
      const request = {};
      diagnostics.requestStarted(request, "https://mctools.dev/res/latest/van/serve/index.json");
      now = 500;
      diagnostics.responseReceived(request, 503);
      now = 2000;

      assert.equal(
        diagnostics.describe(),
        [
          HEADING,
          "  Requests that failed (1):",
          "    - https://mctools.dev/res/latest/van/serve/index.json: HTTP 503 (still loading after 2.0s)",
        ].join("\n"),
        "an HTTP error isn't a connection problem, so there's no hint"
      );

      if (settle === "finishes") {
        diagnostics.requestFinished(request);
      } else {
        diagnostics.requestFailed(request, "net::ERR_ABORTED");
      }
      assert.equal(
        diagnostics.describe(),
        [
          HEADING,
          "  Requests that failed (1):",
          "    - https://mctools.dev/res/latest/van/serve/index.json: HTTP 503",
        ].join("\n")
      );
    });
  }

  it("lists the first failures in the order they happened, with HTTP errors whose bodies still load", () => {
    const loading = {};
    diagnostics.requestStarted(loading, "http://localhost:6201/temp/texture-0.png");
    diagnostics.responseReceived(loading, 404);
    for (let i = 1; i <= MAX_LISTED; i++) {
      now = i * 100;
      fail(`http://localhost:6201/temp/geometry-${i}.json`, "net::ERR_FAILED");
    }

    assert.equal(
      diagnostics.describe(),
      [
        HEADING,
        "  Requests that failed (6, showing the first 5):",
        "    - http://localhost:6201/temp/texture-0.png: HTTP 404 (still loading after 0.5s)",
        ...[1, 2, 3, 4].map((i) => `    - http://localhost:6201/temp/geometry-${i}.json: net::ERR_FAILED`),
      ].join("\n")
    );
  });

  it("keeps the latest console errors and counts the earlier ones", () => {
    for (let i = 1; i <= MAX_LISTED + 2; i++) {
      diagnostics.pageError(`Error ${i}`);
    }

    assert.equal(
      diagnostics.describe(),
      [HEADING, "  Console errors (7, showing the last 5):", ...[3, 4, 5, 6, 7].map((i) => `    - Error ${i}`)].join(
        "\n"
      )
    );
  });

  it("includes the error the viewer reported", () => {
    assert.equal(
      diagnostics.describe({ error: "Could not build the scene." }),
      `${HEADING}\n  Viewer error: Could not build the scene.`
    );
  });

  it("says when the page had nothing pending and no errors", () => {
    finish("http://localhost:6201/app/web.js", 200);
    assert.equal(diagnostics.describe(), NOTHING);
  });

  it("describes each navigation on its own after a reset", () => {
    const before = {};
    diagnostics.requestStarted(before, "http://localhost:6201/first.png");
    diagnostics.pageError("The first page failed.");
    fail("http://localhost:6201/first.json", "net::ERR_FAILED");
    diagnostics.reset();
    diagnostics.requestFailed(before, "net::ERR_FAILED");
    diagnostics.requestStarted({}, "http://localhost:6201/second.png");

    assert.equal(
      diagnostics.describe(),
      `${HEADING}\n  Requests still pending (1):\n    - http://localhost:6201/second.png (0.0s)`
    );
  });

  it("caps each list and line, however much the page does", () => {
    const long = "x".repeat(10000);
    for (let i = 0; i < 50; i++) {
      fail(`https://mctools.dev/${long}/${i}.png`, `net::ERR_TIMED_OUT ${long}`);
      diagnostics.requestStarted({}, `https://example.com/${long}/${i}.png?token=${long}`);
      diagnostics.pageError(`Error ${i} ${long}`);
    }

    const lines = diagnostics.describe({ error: long }).split("\n");
    assert.lengthOf(lines, 1 + 3 * (1 + MAX_LISTED) + 2, "a heading, three lists, the viewer error, and a next step");
    assert.include(lines, "  Requests that failed (50, showing the first 5):");
    assert.include(lines, "  Requests still pending (50, showing the 5 longest):");
    assert.include(lines, "  Console errors (50, showing the last 5):");
    for (const line of lines) {
      assert.isAtMost(line.length, "    - ".length + MAX_URL_LENGTH + ": ".length + MAX_MESSAGE_LENGTH, line);
    }
  });

  /** Credentials in a URL, built here so that this file doesn't contain any. */
  const credentials = ["user", "SECRET"].join(":") + "@";
  for (const [name, url, expected] of [
    [
      "credentials, a query, and a fragment",
      `https://${credentials}mctools.dev/res/a.png?sig=SECRET#part`,
      "https://mctools.dev/res/a.png?...",
    ],
    ["a local URL", "http://127.0.0.1:6201/temp/geometry-0.json", "http://127.0.0.1:6201/temp/geometry-0.json"],
    ["a data: URL", "data:image/png;base64,SECRET", "data:..."],
    ["a blob: URL", "blob:http://localhost:6201/SECRET", "blob:..."],
    ["a URL that can't be parsed", `http://${credentials}[bad/x?token=SECRET`, "http://[bad/x?..."],
  ]) {
    it(`shows only the origin and path of ${name}`, () => {
      assert.equal(describeUrl(url), expected);
    });
  }

  it("shortens a long URL in the middle, keeping its host and file name", () => {
    const url = describeUrl(`https://mctools.dev/${"textures/".repeat(30)}sheep.png`);
    assert.lengthOf(url, MAX_URL_LENGTH);
    assert.match(url, /^https:\/\/mctools\.dev\/textures\/.*\.\.\..*\/sheep\.png$/);
  });

  it("puts page text on one line, escapes control characters, and drops URL queries and data", () => {
    diagnostics.pageError(
      "Load\u0007 failed\u001b[31m: https://cdn.example.test/geo.json?token=SECRET\r\n    at load (data:text/javascript;base64,SECRET:1:20)"
    );
    const text = diagnostics.describe();

    assert.include(
      text,
      "    - Load\\u0007 failed\\u001b[31m: https://cdn.example.test/geo.json?... at load (data:...)"
    );
    assert.notInclude(text, "SECRET");
    assertNoControlCharacters(text);
  });

  for (const [name, text, expected] of [
    ["a data: URL without a media type", "Inline data:,SECRET failed", "Inline data:... failed"],
    ["a base64 data: URL without a media type", "Inline data:;base64,SECRET failed", "Inline data:... failed"],
    [
      "a data: URL with a media type",
      "Inline data:text/plain;charset=utf-8,SECRET%20TEXT failed",
      "Inline data:... failed",
    ],
    ["an uppercase data: URL", "Inline DATA:,SECRET failed", "Inline data:... failed"],
    ["a blob: URL with an origin", "Loading blob:http://localhost/SECRET-ID failed", "Loading blob:... failed"],
    ["a blob: URL with an opaque origin", "Loading blob:null/SECRET-ID failed", "Loading blob:... failed"],
    ["a data: URL with control characters", "Inline data:,SEC\u0000\u001bRET failed", "Inline data:... failed"],
    ["a blob: URL in a stack trace", "at load (blob:null/SECRET-ID:1:20)", "at load (blob:...)"],
    ["a quoted URL before punctuation", 'Not allowed to load "data:,SECRET".', 'Not allowed to load "data:...".'],
    ["a URL before a comma", "Tried data:,SECRET, then gave up", "Tried data:..., then gave up"],
    ["the word data before a space", "Unexpected data: expected a number", "Unexpected data: expected a number"],
    ["a word that ends in data", "metadata:loaded", "metadata:loaded"],
  ]) {
    it(`shows only the scheme of ${name} in console and viewer errors`, () => {
      diagnostics.pageError(text);

      const lines = diagnostics.describe({ error: text }).split("\n");
      assert.deepEqual(lines.slice(1), ["  Console errors (1):", `    - ${expected}`, `  Viewer error: ${expected}`]);
      assert.notInclude(lines.join("\n"), "SECRET");
    });
  }

  for (const [name, record, suggests] of [
    [
      "a pending remote request",
      (d: RenderPageDiagnostics) => d.requestStarted({}, "https://mctools.dev/a.json"),
      true,
    ],
    [
      "a remote network failure",
      (d: RenderPageDiagnostics) => {
        const request = {};
        d.requestStarted(request, "https://mctools.dev/a.json");
        d.requestFailed(request, "net::ERR_NAME_NOT_RESOLVED");
      },
      true,
    ],
    [
      "a remote HTTP error",
      (d: RenderPageDiagnostics) => {
        const request = {};
        d.requestStarted(request, "https://mctools.dev/a.json");
        d.responseReceived(request, 503);
        d.requestFinished(request);
      },
      false,
    ],
    [
      "pending requests to this computer",
      (d: RenderPageDiagnostics) => {
        d.requestStarted({}, "http://127.0.0.1:9/a.png");
        d.requestStarted({}, "http://[::1]:9/b.png");
        d.requestStarted({}, "http://localhost:9/c.png");
      },
      false,
    ],
    [
      "a pending request to the render server",
      (d: RenderPageDiagnostics) => d.requestStarted({}, "http://render.example:6201/a.png"),
      false,
    ],
  ] as const) {
    it(`${suggests ? "suggests" : "doesn't suggest"} checking the connection for ${name}`, () => {
      const subject = new RenderPageDiagnostics("http://render.example:6201", () => now);
      record(subject);
      const hint = "Check your internet connection: requests to mctools.dev didn't finish.";
      assert.equal(subject.describe().endsWith(`\n${hint}`), suggests, subject.describe());
    });
  }

  it("suggests checking the connection for a remote failure after the listed ones, until a reset", () => {
    for (let i = 1; i <= 3; i++) {
      finish(`http://localhost:6201/temp/texture-${i}.png`, 404);
    }
    fail("http://localhost:6201/temp/geometry-4.json", "net::ERR_FAILED");
    fail("http://localhost:6201/temp/geometry-5.json", "net::ERR_FAILED");
    fail("https://mctools.dev/res/latest/van/serve/index.json", "net::ERR_NAME_NOT_RESOLVED");

    assert.equal(
      diagnostics.describe(),
      [
        HEADING,
        "  Requests that failed (6, showing the first 5):",
        ...[1, 2, 3].map((i) => `    - http://localhost:6201/temp/texture-${i}.png: HTTP 404`),
        ...[4, 5].map((i) => `    - http://localhost:6201/temp/geometry-${i}.json: net::ERR_FAILED`),
        "Check your internet connection: requests to mctools.dev didn't finish.",
      ].join("\n")
    );

    diagnostics.reset();
    fail("http://localhost:6201/app/web.js", "net::ERR_FAILED");
    assert.equal(
      diagnostics.describe(),
      [HEADING, "  Requests that failed (1):", "    - http://localhost:6201/app/web.js: net::ERR_FAILED"].join("\n")
    );
  });

  it("names at most three hosts when suggesting a connection check", () => {
    for (const host of ["a.example", "b.example", "c.example", "d.example"]) {
      fail(`https://${host}/x.json`, "net::ERR_CONNECTION_RESET");
    }
    diagnostics.requestStarted({}, "https://e.example/y.json");

    assert.isTrue(
      diagnostics
        .describe()
        .endsWith("\nCheck your internet connection: requests to e.example, a.example, b.example didn't finish."),
      diagnostics.describe()
    );
  });

  it("explains only timeouts, keeping the original message first", async () => {
    diagnostics.requestStarted({}, "http://localhost:6201/stall.png");
    const timeout = "locator.waitFor: Timeout 5ms exceeded.\nCall log:\n  - waiting for locator('canvas')\n";

    assert.equal(await RenderPageDiagnostics.explain(diagnostics, "Failed: boom", new Error("boom")), "Failed: boom");
    assert.equal(
      await RenderPageDiagnostics.explain(undefined, `Failed: ${timeout}`, timeoutError(timeout)),
      `Failed: ${timeout}`
    );
    assert.equal(
      await RenderPageDiagnostics.explain(diagnostics, `Failed: ${timeout}`, timeoutError(timeout)),
      `Failed: ${timeout.trimEnd()}\n${HEADING}\n  Requests still pending (1):\n    - http://localhost:6201/stall.png (0.0s)`
    );
  });

  it("removes Playwright's color codes from the message and escapes its other control characters", async () => {
    // Playwright dims its call log like this on Windows and in color terminals, even in a pipe.
    const message =
      "locator.waitFor: Timeout 5ms exceeded.\r\nCall log:\r\n\u001b[2m  - waiting for locator('canvas')\u001b[22m\r\n" +
      "  - the page said \u0007\tdone\r\u009b2J\n";

    const explained = await RenderPageDiagnostics.explain(diagnostics, `Failed: ${message}`, timeoutError(message));

    assert.equal(
      explained,
      [
        "Failed: locator.waitFor: Timeout 5ms exceeded.",
        "Call log:",
        "  - waiting for locator('canvas')",
        "  - the page said \\u0007\\u0009done\\u000d\\u009b2J",
        NOTHING,
      ].join("\n")
    );
    assertNoControlCharacters(explained);
  });

  it("describes the page as it was at the timeout, not after asking for the viewer error", async () => {
    let answer!: (value: unknown) => void;
    const { page, emit } = fakePage(() => new Promise((resolve) => (answer = resolve)));
    const watched = RenderPageDiagnostics.watch(page, "http://localhost:6201", () => now);
    const remote = fakeRequest("https://mctools.dev/res/latest/van/serve/index.json");
    emit("request", remote);
    now = 1000;
    const local = fakeRequest("http://localhost:6201/temp/geometry-0.json");
    emit("request", local);
    now = 30000;

    const explaining = RenderPageDiagnostics.explain(watched, "Timed out.", timeoutError("Timed out."));
    // While the viewer error is read, both requests settle, and another request and an error arrive.
    now = 30900;
    emit("requestfinished", remote);
    emit("requestfailed", local);
    emit("request", fakeRequest("https://late.example/late.json"));
    emit("console", { type: () => "error", text: () => "An error after the timeout" });
    answer(undefined);

    assert.equal(
      await explaining,
      [
        "Timed out.",
        HEADING,
        "  Requests still pending (2):",
        "    - https://mctools.dev/res/latest/van/serve/index.json (30.0s)",
        "    - http://localhost:6201/temp/geometry-0.json (29.0s)",
        "Check your internet connection: requests to mctools.dev didn't finish.",
      ].join("\n")
    );
  });

  for (const [name, closed, answer, expected] of [
    [
      "reported an error",
      false,
      async () => "Could not build the scene.",
      "  Viewer error: Could not build the scene.",
    ],
    ["reported no error", false, async () => undefined, ""],
    ["reported an empty error", false, async () => "", ""],
    ["couldn't run script", false, async () => Promise.reject(new Error("Execution context was destroyed")), "unknown"],
    ["was closed", true, async () => "Never asked", "unknown"],
  ] as const) {
    it(`reports the viewer error when the page ${name}`, async () => {
      const { page, emit } = fakePage(answer, closed);
      const watched = RenderPageDiagnostics.watch(page, "http://localhost:6201", () => now);
      emit("request", fakeRequest("http://localhost:6201/stall.png"));

      const lines = (await RenderPageDiagnostics.explain(watched, "Timed out.", timeoutError("Timed out."))).split(
        "\n"
      );

      const viewerLine =
        expected === "unknown" ? "  Viewer error: unknown, because the page didn't respond in time." : expected;
      const pendingLines = ["  Requests still pending (1):", "    - http://localhost:6201/stall.png (0.0s)"];
      assert.deepEqual(lines, ["Timed out.", HEADING, ...pendingLines, ...(viewerLine ? [viewerLine] : [])]);
    });
  }

  it("doesn't report no errors when the page doesn't answer", async function () {
    this.timeout(5000);
    const { page } = fakePage(() => new Promise(() => {}));
    const watched = RenderPageDiagnostics.watch(page, "http://localhost:6201", () => now);
    const started = Date.now();

    const explained = await RenderPageDiagnostics.explain(watched, "Timed out.", timeoutError("Timed out."));

    assert.equal(
      explained,
      "Timed out.\nAt the timeout, the render page had no pending or failed requests and no console errors, " +
        "but it didn't respond when asked for its viewer error."
    );
    assert.isBelow(Date.now() - started, 3000, "stops waiting for the page after a second");
  });
});

describe("Render readiness timeouts in a reused page", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  /** A browser whose single page runs `goto` when navigated, which can emit page events. */
  function launchFakeBrowser(goto: (emit: (event: string, value: unknown) => void) => Promise<void>) {
    const handlers: Array<[string, (value: unknown) => void]> = [];
    const emit = (event: string, value: unknown) => {
      for (const [name, handler] of handlers) {
        if (name === event) handler(value);
      }
    };
    const page = {
      on: (event: string, handler: (value: unknown) => void) => handlers.push([event, handler]),
      goto: () => goto(emit),
      isClosed: () => false,
      evaluate: async () => undefined,
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
  }

  async function renderFast() {
    const renderer = new PlaywrightPageRenderer();
    try {
      return await renderer.renderModelFast("/?mode=modelviewer", { width: 2, height: 2 });
    } finally {
      await renderer.close();
    }
  }

  it("explains a navigation timeout, suggesting a connection check for remote requests", async () => {
    launchFakeBrowser(async (emit) => {
      emit("request", { url: () => "https://mctools.dev/res/latest/van/serve/index.json?sig=SECRET" });
      // Colored, as Playwright reports it on Windows.
      throw timeoutError(
        'page.goto: Timeout 30000ms exceeded.\nCall log:\n\u001b[2m  - navigating to "http://localhost:6126/"\u001b[22m\n'
      );
    });

    const result = await renderFast();

    assert.isUndefined(result.imageData);
    assertNoControlCharacters(result.error ?? "");
    assert.equal(
      withoutElapsedTimes(result.error ?? ""),
      [
        "Page navigation failed: page.goto: Timeout 30000ms exceeded.",
        "Call log:",
        '  - navigating to "http://localhost:6126/"',
        HEADING,
        "  Requests still pending (1):",
        "    - https://mctools.dev/res/latest/van/serve/index.json?... (Ns)",
        "Check your internet connection: requests to mctools.dev didn't finish.",
      ].join("\n")
    );
  });

  it("leaves other navigation failures as they were", async () => {
    launchFakeBrowser(async (emit) => {
      emit("request", { url: () => "http://localhost:6126/" });
      throw new Error("page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:6126/");
    });

    const result = await renderFast();

    assert.equal(
      result.error,
      "Page navigation failed: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:6126/"
    );
  });
});

/** A local server for test pages. It never answers requests under /stall/. */
interface ITestServer {
  url: string;
  close(): Promise<void>;
}

async function startPageServer(pages: Record<string, string>): Promise<ITestServer> {
  const stalled = new Set<http.ServerResponse>();
  const server = http.createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1");
    if (pathname.startsWith("/stall/")) {
      stalled.add(response);
    } else if (pages[pathname] !== undefined) {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(pages[pathname]);
    } else {
      response.writeHead(pathname === "/favicon.ico" ? 204 : 404);
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => {
      for (const response of stalled) {
        response.destroy();
      }
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe("Render readiness timeouts in a browser", function () {
  this.timeout(60000);
  const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
  const canvas = '<canvas width="2" height="2" style="display:block;width:2px;height:2px"></canvas>';
  const script = (code: string) =>
    `<!doctype html><html><body>${code.startsWith("<") ? code : `<script>${code}</script>`}</body></html>`;
  const pages: Record<string, string> = {
    "/pending": script('fetch("/stall/request.png?token=SECRET");'),
    "/console": script(
      'console.error("Model failed to load\\u001b[31m: https://cdn.example.test/geo.json?token=SECRET");' +
        "setTimeout(() => { throw new TypeError(\"Cannot read properties of undefined (reading 'bones')\"); });"
    ),
    "/viewer-error": script('window.mctPresentationError = "Could not build the presentation scene.";'),
    "/opaque-urls": script(
      'console.error("Inline data:,SECRET and data:;base64,SECRET failed");' +
        'window.mctPresentationError = "Scene from blob:http://127.0.0.1/SECRET-ID and blob:null/SECRET-ID failed";'
    ),
    "/busy": script(
      'for (let i = 0; i < 20; i++) fetch("/stall/busy-" + i + ".png");' +
        'for (let i = 0; i < 30; i++) console.error("Error " + i + " " + "x".repeat(5000));'
    ),
    "/missing": script('fetch("/missing.json"); fetch("/stall/after-missing.png");'),
    "/switch": script('fetch("/stall/" + new URLSearchParams(location.search).get("cameraX") + ".png");'),
    "/no-bridge": script(canvas),
    "/ready": script(
      canvas +
        "<script>window.mctPresentation = {" +
        `capture: () => "data:image/png;base64,${png.toString("base64")}",` +
        "describe: () => ({ min: [0, 0, 0], max: [0, 0, 0], camera: [0, 0, 0], orthoTop: null })," +
        "release() {} };</script>"
    ),
  };
  const fast: RenderOptions = { width: 2, height: 2, renderWaitTime: 10, canvasTimeout: 1500 };
  const presentation: RenderOptions = { ...fast, presentation: resolveRenderPresentationOptions({}) };
  let server: ITestServer;
  let renderer: PlaywrightPageRenderer;

  before(async function () {
    server = await startPageServer(pages);
    renderer = new PlaywrightPageRenderer(server.url);
    if (!(await renderer.initialize())) {
      this.skip();
    }
  });

  after(async () => {
    await renderer?.close();
    await server?.close();
  });

  function assertSafe(error: string) {
    assert.notInclude(error, "SECRET");
    assertNoControlCharacters(error);
  }

  it("names a stalled request when the canvas never appears", async () => {
    const result = await renderer.renderModel("/pending?mode=test", presentation);

    const error = result.error ?? "";
    assert.isUndefined(result.imageData);
    assert.match(error, /^Rendering failed: locator\.waitFor: Timeout 1500ms exceeded\.\n/);
    assert.equal(
      withoutElapsedTimes(error.substring(error.indexOf(HEADING))),
      [HEADING, "  Requests still pending (1):", `    - ${server.url}/stall/request.png?... (Ns)`].join("\n")
    );
    assertSafe(error);
  });

  it("includes console errors and uncaught exceptions, escaped and without URL queries", async () => {
    const result = await renderer.renderModel("/console?mode=test", presentation);

    const error = result.error ?? "";
    assert.include(
      error,
      [
        "  Console errors (2):",
        "    - Model failed to load\\u001b[31m: https://cdn.example.test/geo.json?...",
        "    - Uncaught TypeError: Cannot read properties of undefined (reading 'bones')",
      ].join("\n")
    );
    assertSafe(error);
  });

  it("includes the error the viewer reported", async () => {
    const result = await renderer.renderModel("/viewer-error?mode=test", presentation);

    assert.match(result.error ?? "", /\n {2}Viewer error: Could not build the presentation scene\.$/);
  });

  it("shows only the scheme of data: and blob: URLs that the page reports", async () => {
    const result = await renderer.renderModel("/opaque-urls?mode=test", presentation);

    const error = result.error ?? "";
    assert.equal(
      error.substring(error.indexOf(HEADING)),
      [
        HEADING,
        "  Console errors (1):",
        "    - Inline data:... and data:... failed",
        "  Viewer error: Scene from blob:... and blob:... failed",
      ].join("\n")
    );
    assertSafe(error);
  });

  it("caps what a busy page reports", async () => {
    const result = await renderer.renderModel("/busy?mode=test", presentation);

    const error = result.error ?? "";
    const details = error.substring(error.indexOf(HEADING)).split("\n");
    assert.include(details, "  Console errors (30, showing the last 5):");
    assert.match(error, /\n {2}Requests still pending \(\d+, showing the 5 longest\):\n/);
    assert.isAtMost(details.length, 1 + 2 * (1 + MAX_LISTED));
    assert.isBelow(error.length, 2500);
  });

  it("explains a canvas timeout in a reused page, with failed and pending requests", async () => {
    const result = await renderer.renderModelFast("/missing?mode=test", fast);

    const error = result.error ?? "";
    assert.match(
      error,
      /^Canvas not found within 1500ms timeout\. Structure may be too large or page failed to load\.\n/
    );
    assert.include(error, `  Requests that failed (1):\n    - ${server.url}/missing.json: HTTP 404\n`);
    assert.include(error, `  Requests still pending (1):\n    - ${server.url}/stall/after-missing.png (`);
  });

  it("describes only the latest navigation of a reused page", async () => {
    const first = await renderer.renderModelFast("/switch?mode=test&cameraX=first", { ...fast, forceReload: true });
    const second = await renderer.renderModelFast("/switch?mode=test&cameraX=second", { ...fast, forceReload: true });

    assert.include(first.error ?? "", "/stall/first.png");
    assert.include(second.error ?? "", `  Requests still pending (1):\n    - ${server.url}/stall/second.png (`);
    assert.notInclude(second.error ?? "", "first");
  });

  it("explains a presentation capture timeout when nothing was pending", async () => {
    const result = await renderer.renderModelFast("/no-bridge?mode=test", presentation);

    const error = result.error ?? "";
    assert.match(error, /^Screenshot capture failed: page\.waitForFunction: Timeout 1500ms exceeded\./);
    assert.isTrue(error.endsWith(`\n${NOTHING}`), error);
  });

  it("returns successful renders unchanged", async () => {
    const results = [
      await renderer.renderModel("/ready?mode=test", presentation),
      await renderer.renderModelFast("/ready?mode=fast", presentation),
    ];

    for (const result of results) {
      assert.isUndefined(result.error);
      assert.deepEqual(Buffer.from(result.imageData!), png);
    }
  });
});
