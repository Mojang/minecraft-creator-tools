// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { spawn } from "child_process";
import { buildSync } from "esbuild";
import * as fs from "fs";
import * as http from "http";
import { AddressInfo, Socket } from "net";
import * as path from "path";
import TestPaths from "./TestPaths";
import { cliEnv, setEnvironmentVariable } from "./TestDataDir";
import { STRIPPED_ENV_VARS } from "./CliTranscriptHarness";
import { METADATA_REQUEST_TIMEOUT_MS } from "../core/MetadataRequest";

/**
 * These children deliberately have no process.exit: a leaked handshake/socket/timer prevents
 * natural completion. The endpoint/proxy is loopback-only and never forwards traffic.
 * Consumer controls route URLs to that endpoint, retaining real axios and production parsing.
 */
describe("Metadata request ownership and consumers", function () {
  this.timeout(METADATA_REQUEST_TIMEOUT_MS + 10000);
  let bundle: string;
  let root: string;
  let port: number;
  let server: http.Server;
  let respond: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  let connectMode: "drop" | "stall" | "refuse";
  const sockets = new Set<Socket>();
  const requests: string[] = [];
  const intervals = new Set<ReturnType<typeof setInterval>>();

  before(() => {
    bundle = buildSync({
      stdin: {
        contents: `
          import "./src/app/Project";
          export { requestMetadata, METADATA_REQUEST_TIMEOUT_MS } from "./src/core/MetadataRequest";
          export { default as LocalUtilities } from "./src/local/LocalUtilities";
          export { default as Database } from "./src/minecraft/Database";
          export { default as Log } from "./src/core/Log";
          export { default as ServerManager, ServerType } from "./src/local/ServerManager";
          export { default as LocalEnvironment } from "./src/local/LocalEnvironment";
          export { default as CreatorTools } from "./src/app/CreatorTools";
          export { default as NodeStorage } from "./src/local/NodeStorage";
          export { MinecraftTrack } from "./src/app/ICreatorToolsData";
        `,
        resolveDir: TestPaths.appRoot,
      },
      bundle: true,
      platform: "node",
      packages: "external",
      format: "cjs",
      write: false,
      logLevel: "silent",
    }).outputFiles[0].text;
  });

  beforeEach(async () => {
    const results = path.join(TestPaths.testRoot, "results");
    fs.mkdirSync(results, { recursive: true });
    root = fs.mkdtempSync(path.join(results, "metadata-consumer-"));
    requests.length = 0;
    connectMode = "refuse";
    respond = (_req, res) => res.end(JSON.stringify({ value: "metadata" }));
    server = http.createServer((req, res) => {
      requests.push(req.url || "");
      respond(req, res);
    });
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    });
    server.on("connect", (req, socket) => {
      requests.push(req.url || "");
      socket.on("end", () => socket.end());
      socket.resume();
      if (connectMode === "drop") socket.destroy();
      if (connectMode === "refuse") socket.end("HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const interval of intervals) clearInterval(interval);
    intervals.clear();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function run(script: string) {
    const env = cliEnv({ dataDir: path.join(root, "data") });
    for (const name of STRIPPED_ENV_VARS) {
      if (name !== "MCTOOLS_DATA_DIR") setEnvironmentVariable(env, name, undefined);
    }
    for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"]) {
      setEnvironmentVariable(env, name, `http://127.0.0.1:${port}`);
    }
    env.NO_PROXY = "127.0.0.1";
    env.HOME = root;
    env.USERPROFILE = root;
    env.MCT_TEST_PROXY_PORT = String(port);
    env.MCT_TEST_CONNECTION_TRACE = path.join(root, "connections.jsonl");
    const child = spawn(
      process.execPath,
      [
        "--unhandled-rejections=strict",
        "--require",
        path.join(TestPaths.appRoot, "src/test/fixtures/metadataConnectionTrace.cjs"),
        "-",
      ],
      { cwd: TestPaths.appRoot, env, stdio: ["pipe", "pipe", "pipe"] }
    );
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (data) => (stdout += data));
    child.stderr.on("data", (data) => (stderr += data));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, METADATA_REQUEST_TIMEOUT_MS + 7000);
    const start = Date.now();
    const closed = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    child.stdin.end(`${bundle}
      const assert = require("node:assert/strict");
      const { getEventListeners } = require("node:events");
      const api = module.exports;
      const base = "http://127.0.0.1:${port}";
      class EndpointUtilities extends api.LocalUtilities {
        getMetadataJson(url) { return super.getMetadataJson(base + new URL(url).pathname); }
      }
      (async () => {
        ${script}
        await new Promise(resolve => setTimeout(resolve, 100));
        process.stdout.write(JSON.stringify({ complete: true }));
      })().catch(error => { process.stderr.write(error.stack); process.exitCode = 1; });
    `);
    const code = await closed.finally(() => clearTimeout(timer));
    const duration = Date.now() - start;
    const evidence = JSON.stringify({ code, timedOut, duration, requests, stdout, stderr });
    assert.isFalse(timedOut, evidence);
    assert.strictEqual(code, 0, evidence);
    assert.deepEqual(JSON.parse(stdout), { complete: true }, evidence);
    assert.strictEqual(stderr, "", evidence);
    assert.strictEqual(sockets.size, 0, evidence);
    return duration;
  }

  for (const mode of ["drop", "stall"] as const) {
    it(`settles repeated ${mode} proxy handshakes and exits naturally without late rejections`, async () => {
      connectMode = mode;
      const duration = await run(`
        const local = new api.LocalUtilities();
        const results = await Promise.allSettled(Array.from({ length: 12 }, () =>
          local.getMetadataJson("https://raw.githubusercontent.com/controlled-metadata")));
        for (const result of results) {
          assert.equal(result.status, "rejected");
          assert.match(result.reason.message, /timed out after 10000 ms/);
        }
      `);
      assert.lengthOf(requests, 12);
      assert.isAtLeast(duration, METADATA_REQUEST_TIMEOUT_MS);
      assert.isBelow(duration, METADATA_REQUEST_TIMEOUT_MS + 5000);
    });
  }

  it("releases request timers and abort listeners after successful responses", async () => {
    const duration = await run(`
      for (let i = 0; i < 12; i++) {
        const controller = new AbortController();
        const result = await api.requestMetadata(base, { proxy: false }, controller);
        assert.deepEqual(result, { value: "metadata" });
        assert.equal(getEventListeners(controller.signal, "abort").length, 0);
      }
      assert.deepEqual(await new api.LocalUtilities().getMetadataJson(base), { value: "metadata" });
    `);
    assert.lengthOf(requests, 13);
    assert.isBelow(duration, METADATA_REQUEST_TIMEOUT_MS);
  });

  it("cancels an active response and removes its abort listener", async () => {
    respond = (_req, res) => {
      res.writeHead(200);
      res.write('{"value":');
    };
    await run(`
      const controller = new AbortController();
      const reason = new Error("Caller cancelled metadata");
      const promise = api.requestMetadata(base, { proxy: false }, controller);
      setTimeout(() => controller.abort(reason), 100);
      await assert.rejects(promise, error => error === reason);
      assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    `);
    assert.lengthOf(requests, 1);
  });

  it("bounds the whole response even when bytes keep arriving", async () => {
    respond = (_req, res) => {
      res.writeHead(200);
      res.write('{"value":"');
      const interval = setInterval(() => res.write("x"), 100);
      intervals.add(interval);
      res.once("close", () => {
        clearInterval(interval);
        intervals.delete(interval);
      });
    };
    const duration = await run(`
      await assert.rejects(new api.LocalUtilities().getMetadataJson(base), /timed out after 10000 ms/);
    `);
    assert.lengthOf(requests, 1);
    assert.isAtLeast(duration, METADATA_REQUEST_TIMEOUT_MS);
    assert.isBelow(duration, METADATA_REQUEST_TIMEOUT_MS + 5000);
    assert.strictEqual(intervals.size, 0);
  });

  it("preserves retail/preview selection, force refresh, education and known-missing cache behavior", async () => {
    respond = (_req, res) =>
      res.end(
        JSON.stringify({
          older: { version: "1.26.0.1" },
          retail: { version: "1.26.20.2" },
          preview: { version: "1.26.30.27" },
        })
      );
    await run(`
      const { Database: db, MinecraftTrack: track } = api;
      db.local = new EndpointUtilities();
      assert.equal(await db.getLatestVersionInfo(track.main), "1.26.20.02");
      assert.equal(await db.getLatestVersionInfo(track.main), "1.26.20.02");
      assert.equal(await db.getLatestVersionInfo(track.preview), "1.26.30.27");
      assert.equal(await db.getLatestVersionInfo(track.preview), "1.26.30.27");
      assert.equal(await db.getLatestVersionInfo(track.main, true), "1.26.20.02");
      assert.equal(await db.getLatestVersionInfo(track.edu), db.minecraftEduVersion);
      assert.equal(await db.getLatestVersionInfo(track.eduPreview), db.minecraftEduPreviewVersion);
      db.moduleDescriptors["known-missing"] = undefined;
      assert.equal(await db.getModuleDescriptor("known-missing"), undefined);
      assert.equal(api.Log.items.length, 0);
    `);
    assert.deepEqual(requests, [
      "/Mojang/bedrock-samples/main/version.json",
      "/Mojang/bedrock-samples/preview/version.json",
      "/Mojang/bedrock-samples/main/version.json",
    ]);
  });

  for (const body of [
    "",
    "not json",
    "null",
    "{}",
    "[]",
    '{"bad":{"version":12}}',
    '{"bad":{"version":"not-a-version"}}',
  ]) {
    it(`uses a diagnosed bundled fallback rather than accepting malformed version metadata: ${body || "(empty)"}`, async () => {
      respond = (_req, res) => res.end(body);
      await run(`
        const { Database: db, MinecraftTrack: track } = api;
        db.local = new EndpointUtilities();
        for (const [kind, fallback] of [[track.main, db.fallbackMinecraftVersion], [track.preview, db.fallbackMinecraftPreviewVersion]]) {
          assert.equal(await db.getLatestVersionInfo(kind), fallback);
          assert.equal(await db.getLatestVersionInfo(kind), fallback);
        }
        assert.equal(api.Log.items.length, 2);
        assert.ok(api.Log.items.every(item => item.message.includes("Using bundled") && item.message.includes("may not be the latest")));
      `);
      assert.lengthOf(requests, 2);
    });
  }

  it("returns and caches real registry metadata without an empty successful module", async () => {
    respond = (_req, res) =>
      res.end(
        JSON.stringify({
          "dist-tags": { latest: "2.0.0" },
          versions: { "2.0.0": { version: "2.0.0" } },
        })
      );
    await run(`
      api.Database.local = new EndpointUtilities();
      const first = await api.Database.getModuleDescriptor("@minecraft/server");
      assert.equal(first.latest, "2.0.0");
      assert.equal(await api.Database.getModuleDescriptor("@minecraft/server"), first);
      assert.equal(api.Log.items.length, 0);
    `);
    assert.deepEqual(requests, ["/@minecraft/server"]);
  });

  for (const body of ["", "{}", '{"dist-tags":{"latest":"2.0.0"},"versions":{}}']) {
    it(`diagnoses unusable registry metadata without caching a successful module: ${body || "(empty)"}`, async () => {
      respond = (_req, res) => res.end(body);
      await run(`
        api.Database.local = new EndpointUtilities();
        assert.equal(await api.Database.getModuleDescriptor("@minecraft/server"), undefined);
        assert.equal("@minecraft/server" in api.Database.moduleDescriptors, false);
        assert.equal(api.Log.items.length, 1);
        assert.match(api.Log.items[0].message, /Latest script package checks are unavailable/);
      `);
      assert.lengthOf(requests, 1);
    });
  }

  const createEnvironment = `
    const env = new api.LocalEnvironment(false);
    env.utilities = new EndpointUtilities();
    const storage = new api.NodeStorage(process.env.MCTOOLS_DATA_DIR, "");
    const tools = new api.CreatorTools(storage, storage, [], null, null, null, null);
  `;
  const createManager = `${createEnvironment}
    const manager = new api.ServerManager(env, tools);
  `;

  it("preserves successful server discovery, platform cache and forced refresh", async () => {
    respond = (_req, res) =>
      res.end(
        JSON.stringify({
          result: {
            links: [
              {
                downloadType: "serverBedrockWindows",
                downloadUrl: "https://www.minecraft.net/bedrock-server-1.26.20.2.zip",
              },
              {
                downloadType: "serverBedrockLinux",
                downloadUrl: "https://www.minecraft.net/bedrock-server-1.26.20.2.zip",
              },
            ],
          },
        })
      );
    await run(`${createEnvironment}
      class WindowsEndpointUtilities extends EndpointUtilities { get platform() { return 0; } }
      env.utilities = new WindowsEndpointUtilities();
      const manager = new api.ServerManager(env, tools);
      assert.equal(await manager.getLatestVersionInfo(false), true);
      assert.equal(await manager.getLatestVersionInfo(false), true);
      assert.equal(await manager.getLatestVersionInfo(true), true);
      assert.equal(manager.serverVersions[api.ServerType.bedrockWindows].version, "1.26.20.2");
      assert.equal(api.Log.items.length, 0);
    `);
    assert.deepEqual(requests, ["/api/v1.0/download/links", "/api/v1.0/download/links"]);
  });

  it("uses server version metadata fallback for empty link lists, without provisioning", async () => {
    respond = (req, res) =>
      res.end(
        JSON.stringify(req.url?.endsWith("/links") ? { result: { links: [] } } : { latest: { version: "1.26.20.2" } })
      );
    await run(`${createManager}
      assert.equal(await manager.getLatestVersionInfo(true), true);
      assert.equal(manager.serverVersions[api.ServerType.bedrockWindows].version, "1.26.20.2");
      assert.equal(manager.serverVersions[api.ServerType.bedrockLinux].version, "1.26.20.2");
    `);
    assert.lengthOf(requests, 2);
  });

  it("reports failure when server metadata and its supported fallback are empty", async () => {
    respond = (_req, res) => res.end("{}");
    await run(`${createManager}
      assert.equal(await manager.getLatestVersionInfo(true), false);
      assert.ok(api.Log.items.some(item => item.message.includes("Could not access Bedrock Dedicated Server details")));
    `);
    assert.lengthOf(requests, 2);
  });

  for (const scenario of [
    { name: "preview with retail only", platform: 2, preview: true, link: "serverBedrockLinux", other: "bedrockLinux" },
    { name: "Windows with Linux only", platform: 0, preview: false, link: "serverBedrockLinux", other: "bedrockLinux" },
    {
      name: "Linux with Windows only",
      platform: 2,
      preview: false,
      link: "serverBedrockWindows",
      other: "bedrockWindows",
    },
    { name: "Java link only", platform: 0, preview: false, link: "serverJar", other: "java" },
    { name: "unversioned jar only", platform: 0, preview: false, link: "serverJar", other: "java", jarFile: true },
    {
      name: "active target present",
      platform: 0,
      preview: false,
      link: "serverBedrockWindows",
      other: "bedrockWindows",
    },
  ]) {
    for (const cached of [false, true]) {
      it(`discovers the active server target from the current response: ${scenario.name}, cached=${cached}`, async () => {
        const primaryVersion = "1.26.10.2";
        const fallbackVersion = scenario.preview ? "1.26.30.27" : "1.26.20.2";
        const activePresent = scenario.name === "active target present";
        respond = (req, res) =>
          res.end(
            JSON.stringify(
              req.url?.endsWith("/links")
                ? {
                    result: {
                      links: [
                        {
                          downloadType: scenario.link,
                          downloadUrl: scenario.jarFile
                            ? "https://example.invalid/server.jar"
                            : `https://example.invalid/server-${primaryVersion}.zip`,
                        },
                      ],
                    },
                  }
                : { latest: { version: fallbackVersion } }
            )
          );
        await run(`${createEnvironment}
          class PlatformEndpointUtilities extends EndpointUtilities { get platform() { return ${scenario.platform}; } }
          env.utilities = new PlatformEndpointUtilities();
          const manager = new api.ServerManager(env, tools);
          manager.usePreview = ${scenario.preview};
          const activeType = ${scenario.platform} === 2
            ? (${scenario.preview} ? api.ServerType.bedrockLinuxPreview : api.ServerType.bedrockLinux)
            : (${scenario.preview} ? api.ServerType.bedrockWindowsPreview : api.ServerType.bedrockWindows);
          if (${cached}) {
            manager.serverVersions[activeType].version = "1.25.0.1";
            assert.equal(await manager.getLatestVersionInfo(false), true);
            assert.equal(manager.serverVersions[activeType].version, "1.25.0.1");
          }
          assert.equal(await manager.getLatestVersionInfo(true), true);
          assert.equal(manager.serverVersions[activeType].version, ${JSON.stringify(activePresent ? primaryVersion : fallbackVersion)});
          assert.equal(manager.serverVersions[api.ServerType[${JSON.stringify(scenario.other)}]].version, ${scenario.jarFile ? "undefined" : JSON.stringify(primaryVersion)});
        `);
        assert.deepEqual(
          requests,
          activePresent
            ? ["/api/v1.0/download/links"]
            : [
                "/api/v1.0/download/links",
                `/Mojang/bedrock-samples/${scenario.preview ? "preview" : "main"}/version.json`,
              ]
        );
      });
    }
  }

  it("escapes registry diagnostic identifiers and error text without changing request or cache keys", async () => {
    let calls = 0;
    respond = (_req, res) => {
      if (calls++ === 0) res.writeHead(503).end();
      else res.end(JSON.stringify({ "dist-tags": { latest: "2.0.0" }, versions: { "2.0.0": { version: "2.0.0" } } }));
    };
    await run(`
      const name = "test" + String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i), ...Array.from({ length: 33 }, (_, i) => i + 127)) + "module";
      const escapedName = name.replace(/[\\x00-\\x1f\\x7f-\\x9f]/g, c => "\\\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
      const urls = [];
      class DiagnosticEndpointUtilities extends EndpointUtilities {
        async getMetadataJson(url) {
          urls.push(url);
          try { return await super.getMetadataJson(url); }
          catch (error) { throw new Error("Failed metadata for " + name); }
        }
      }
      const db = api.Database;
      db.local = new DiagnosticEndpointUtilities();
      assert.equal(await db.getModuleDescriptor(name), undefined);
      const warning = api.Log.items[0].message;
      assert.equal(api.Log.items.length, 1);
      assert.ok(!/[\\x00-\\x1f\\x7f-\\x9f]/.test(warning), JSON.stringify(warning));
      assert.equal(warning, "Could not load registry for '" + escapedName + "': Failed metadata for " + escapedName +
        " Latest script package checks are unavailable; existing dependencies are unchanged.");
      const result = await db.getModuleDescriptor(name);
      assert.equal(result.latest, "2.0.0");
      assert.equal(await db.getModuleDescriptor(name), result);
      assert.equal(db.moduleDescriptors[name], result);
      assert.equal(escapedName in db.moduleDescriptors, false);
      assert.deepEqual(urls, Array(2).fill("https://registry.npmjs.org/" + name));
    `);
    assert.lengthOf(requests, 2);
  });

  for (const mode of ["drop", "stall"] as const) {
    it(`bounds real registry and server discovery ${mode} requests without provisioning or false discovery`, async () => {
      connectMode = mode;
      await run(`${createEnvironment}
        env.utilities = new api.LocalUtilities();
        const networkManager = new api.ServerManager(env, tools);
        api.Database.local = env.utilities;
        const [descriptor, discovered] = await Promise.all([
          api.Database.getModuleDescriptor("@minecraft/server"),
          networkManager.getLatestVersionInfo(true)
        ]);
        assert.equal(descriptor, undefined);
        assert.equal(discovered, false);
        assert.equal("@minecraft/server" in api.Database.moduleDescriptors, false);
        assert.ok(api.Log.items.some(item => item.message.includes("Latest script package checks are unavailable")));
        assert.ok(api.Log.items.some(item => item.message.includes("Could not access Bedrock Dedicated Server details")));
      `);
      assert.deepEqual(requests.sort(), ["net-secondary.web.minecraft-services.net:443", "registry.npmjs.org:443"]);
    });
  }
});
