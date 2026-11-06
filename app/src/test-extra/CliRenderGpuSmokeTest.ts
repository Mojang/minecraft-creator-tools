// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Real, headless CLI renders. Requires jsnbuild and the downloaded add-on starter.
 * These checks report actual backend availability, not relative rendering speed.
 */
import { assert } from "chai";
import { spawn } from "child_process";
import { mock } from "node:test";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";
import { PNG } from "pngjs";
import { chromium, type Browser, type LaunchOptions } from "playwright";
import PlaywrightPageRenderer from "../local/PlaywrightPageRenderer";
import TestPaths from "../test/TestPaths";
import { cliEnv, createTestDataDir } from "../test/TestDataDir";

describe("CLI GPU rendering smoke", function () {
  this.timeout(120000);
  const cli = path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
  const project = path.resolve(TestPaths.appRoot, "public/res/samples/microsoft/samples/addon_starter/complete");
  const results = path.resolve(TestPaths.testRoot, "results/gpuRendering");
  const scratch = createTestDataDir("gpu-render-manifests");
  const evidence: { run: string; backend: string[]; images: { width: number; height: number; colors: number }[] }[] =
    [];

  before(() => {
    assert.isTrue(fs.existsSync(project), "Run gulp dlres and npm run jsnbuild first");
    fs.mkdirSync(results, { recursive: true });
  });

  after(() => {
    fs.writeFileSync(path.join(results, "evidence.json"), JSON.stringify(evidence, null, 2));
  });

  async function run(args: string[], input?: string, failLaunch = false) {
    const portServer = net.createServer();
    await new Promise<void>((resolve, reject) => {
      portServer.once("error", reject);
      portServer.listen(0, "127.0.0.1", resolve);
    });
    const address = portServer.address();
    await new Promise<void>((resolve, reject) => portServer.close((error) => (error ? reject(error) : resolve())));
    if (!address || typeof address === "string") throw new Error("No test port was assigned");
    const guard = `
      require(${JSON.stringify(require.resolve("playwright"))}).chromium.launch = async () => {
        throw new Error("Controlled browser launch failure");
      };
      import(require("node:url").pathToFileURL(process.argv[1]).href);
    `;
    return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          ...(failLaunch ? ["-e", guard] : []),
          cli,
          ...args,
          "-i",
          project,
          "--offline",
          "--no-vanilla",
          "--port",
          String(address.port),
          "--width",
          "256",
          "--height",
          "192",
          "--render-wait-ms",
          "2000",
          "--verbose",
        ],
        {
          cwd: TestPaths.appRoot,
          // CI is deliberately set: only an explicit --no-gpu should select software.
          env: { ...cliEnv({ dataDir: createTestDataDir("gpu-render-profile") }), CI: "true" },
          timeout: 90000,
        }
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
      child.once("error", reject);
      child.once("close", (code) => resolve({ code, stdout, stderr }));
      child.stdin.end(input);
    });
  }

  function image(fileName: string) {
    const png = PNG.sync.read(fs.readFileSync(path.join(results, fileName)));
    const colors = new Set<number>();
    let missingTexturePixels = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      colors.add((png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]);
      if (png.data[i] > 230 && png.data[i + 1] < 50 && png.data[i + 2] > 220) missingTexturePixels++;
    }
    assert.isAbove(colors.size, 32, "The textured model must not be a blank image");
    assert.isBelow(
      missingTexturePixels,
      png.width * png.height * 0.01,
      "The texture must not be the missing-texture color"
    );
    return { width: png.width, height: png.height, colors: colors.size };
  }

  function record(name: string, stdout: string, files: string[]) {
    evidence.push({
      run: name,
      backend: stdout
        .split("\n")
        .filter((line) => line.includes("WebGL renderer:") || line.includes("HeadlessRenderer: Using")),
      images: files.map(image),
    });
  }

  function manifest(name: string, outputs: string[], geometryPath = "biceson.geo.json") {
    const file = path.join(scratch, name + ".json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        renders: outputs.map((output) => ({ geometryPath, outputPath: path.join(results, output), vanilla: false })),
      })
    );
    return file;
  }

  it("renders a textured model with automatic detection and an explicit software control", async () => {
    for (const mode of ["auto", "software", "auto-quiet"]) {
      const file = `model-${mode}.png`;
      const result = await run([
        "rendermodel",
        "biceson.geo.json",
        path.join(results, file),
        ...(mode === "software" ? ["--no-gpu"] : []),
        ...(mode === "auto-quiet" ? ["--json", "--quiet"] : []),
      ]);
      assert.equal(result.code, 0, result.stderr + result.stdout);
      if (mode === "auto-quiet") assert.equal(result.stdout, "");
      else assert.include(result.stdout, "Found related texture:");
      assert.equal(result.stdout.includes("hardware verified:"), mode === "auto");
      const rendered = image(file);
      assert.equal(rendered.width, 256);
      assert.equal(rendered.height, 192);
      record(`model-${mode}`, result.stdout, [file]);
    }
  });

  it("preserves stream framing, readiness, dimensions and browser reuse", async () => {
    const invalid = manifest("invalid", ["must-not-exist.png"], "missing.geo.json");
    const first = manifest("valid-first", ["batch-first.png", "batch-second.png"]);
    const second = manifest("valid-next", ["batch-third.png"]);
    const result = await run(["renderbatch", invalid, "--stdin"], first + "\n" + second + "\n");
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.deepEqual(result.stdout.match(/^RENDER_(?:DONE|ERROR)$/gm), ["RENDER_ERROR", "RENDER_DONE", "RENDER_DONE"]);
    assert.equal((result.stdout.match(/HeadlessRenderer: Using/g) ?? []).length, 1);
    assert.isBelow(result.stdout.indexOf("RENDER_ERROR"), result.stdout.indexOf("Trying browser:"));
    record("stdin-auto", result.stdout, ["batch-first.png", "batch-second.png", "batch-third.png"]);

    const empty = manifest("ready", []);
    const valid = manifest("software", ["batch-software.png"]);
    const softwareRun = await run(["renderbatch", empty, "--stdin", "--no-gpu"], valid + "\n");
    assert.equal(softwareRun.code, 0, softwareRun.stderr + softwareRun.stdout);
    assert.deepEqual(softwareRun.stdout.match(/^RENDER_(?:DONE|ERROR)$/gm), ["RENDER_DONE", "RENDER_DONE"]);
    assert.equal((softwareRun.stdout.match(/HeadlessRenderer: Using/g) ?? []).length, 1);
    assert.isBelow(softwareRun.stdout.indexOf("HeadlessRenderer: Using"), softwareRun.stdout.indexOf("RENDER_DONE"));
    assert.notInclude(softwareRun.stdout, "hardware verified:");
    const automatic = image("batch-first.png");
    const software = image("batch-software.png");
    assert.equal(automatic.width, software.width);
    assert.equal(automatic.height, software.height);
    record("stdin-software", softwareRun.stdout, ["batch-software.png"]);
  });

  it("ends the stream with one error frame if browser initialization fails", async () => {
    const valid = manifest("failed-launch", ["must-not-render.png"]);
    const result = await run(["renderbatch", valid, "--stdin"], valid + "\n", true);
    assert.equal(result.code, 0, result.stderr + result.stdout);
    assert.deepEqual(result.stdout.match(/^RENDER_(?:DONE|ERROR)$/gm), ["RENDER_ERROR"]);
    assert.include(result.stderr, "Could not initialize headless renderer");
  });

  it("rejects actual SwiftShader candidates and closes all owned browsers", async () => {
    const launch = chromium.launch.bind(chromium);
    const browsers: Browser[] = [];
    const renderer = new PlaywrightPageRenderer(undefined, { useHardwareGpu: "auto" });
    mock.method(chromium, "launch", async (options: LaunchOptions) => {
      // Force a software candidate to exercise fallback on hosts that have hardware.
      const browser = await launch({
        ...options,
        args: [
          ...(options.args ?? []).filter((arg) => arg !== "--enable-gpu"),
          "--use-angle=swiftshader",
          "--enable-unsafe-swiftshader",
        ],
      });
      browsers.push(browser);
      return browser;
    });
    try {
      assert.isTrue(await renderer.initialize());
      assert.isAtLeast(browsers.length, 2);
      assert.isTrue(browsers.slice(0, -1).every((browser) => !browser.isConnected()));
      const selected = browsers[browsers.length - 1];
      const page = await selected.newPage();
      try {
        const backend = await page.evaluate(() => {
          const gl = document.createElement("canvas").getContext("webgl2");
          if (!gl || !("getExtension" in gl)) return null;
          const info = gl.getExtension("WEBGL_debug_renderer_info");
          return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
        });
        assert.isString(backend);
        assert.match(backend!, /swiftshader/i);
        evidence.push({ run: "controlled-software-fallback", backend: [selected.version(), backend!], images: [] });
      } finally {
        await page.close();
      }
    } finally {
      try {
        await renderer.close();
        assert.isTrue(browsers.every((browser) => !browser.isConnected()));
      } finally {
        mock.restoreAll();
      }
    }
  });
});
