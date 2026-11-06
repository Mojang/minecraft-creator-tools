// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Real loopback listeners cover occupied ports, readiness, cleanup, and retry.
 * Controlled listen errors cover permissions without privileged ports. CLI children
 * have disposable profiles and cannot open browsers or start Minecraft/BDS.
 * View/edit success controls probe IPv4, matching the HTTP listener rather than OS localhost resolution.
 */
import { strict as assert } from "assert";
import { spawn } from "child_process";
import { once } from "events";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import { performance } from "perf_hooks";
import WebSocket from "ws";
import "../app/CreatorToolsHost";
import { RenderBatchCommand } from "../cli/commands/render/RenderBatchCommand";
import { resolveRenderPresentationOptions } from "../cli/commands/render/RenderPresentationOptions";
import { CommandContextFactory } from "../cli/core/CommandContextFactory";
import { ErrorCodes } from "../cli/core/ICommandContext";
import { BufferedLogger } from "../cli/core/Logger";
import Log from "../core/Log";
import HttpServer, { HttpServerListenError } from "../local/HttpServer";
import LocalEnvironment from "../local/LocalEnvironment";
import PlaywrightPageRenderer from "../local/PlaywrightPageRenderer";
import ServerManager from "../local/ServerManager";
import TestPaths, { ITestEnvironment } from "./TestPaths";
import { cliEnv, createTestDataDir, setEnvironmentVariable } from "./TestDataDir";

const CLI_PATH = path.resolve(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
const STACK_OR_UNCAUGHT = /(?:^|\n)\s+at\s|Uncaught exception:/;
const RUN_TIMEOUT_MS = 15000;

async function listenOnLoopback(server: http.Server, port = 0): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned listener did not become ready.")), 5000);
    server.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.listen(port, "127.0.0.1", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  return address.port;
}

async function closeListener(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: NodeJS.ErrnoException) => {
      if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
        reject(error);
      } else {
        resolve();
      }
    });
    server.closeAllConnections();
  });
}

function request(
  port: number,
  requestPath: string,
  passcode?: string,
  method = "GET"
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: requestPath,
        method,
        agent: false,
        headers: passcode ? { mctpc: passcode } : {},
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
        res.on("error", reject);
      }
    );
    req.setTimeout(5000, () => req.destroy(new Error("Owned HTTP request timed out.")));
    req.on("error", reject);
    req.end();
  });
}

function rejectedResult(result: PromiseSettledResult<unknown>): unknown {
  assert.equal(result.status, "rejected", "Startup must not report success.");
  return result.reason;
}

describe("HTTP startup lifecycle", function () {
  this.timeout(10000);

  let environment: ITestEnvironment;
  let localEnv: LocalEnvironment;
  let manager: ServerManager;
  let server: HttpServer;
  let owned: http.Server[];
  let restoreSignals: () => void;
  const originalListen = http.Server.prototype.listen;
  const originalHttpsListen = https.Server.prototype.listen;
  const originalHttpsOptions = HttpServer.prototype["buildHttpsOptions"];
  const originalInitializeRenderer = PlaywrightPageRenderer.prototype.initialize;

  before(async function () {
    environment = await TestPaths.createTestEnvironment({ contentWebRoot: "", isLocalNode: true });
  });

  beforeEach(function () {
    const signals = ["SIGINT", "SIGTERM", "SIGBREAK"] as const;
    const priorListeners = signals.map((signal) => new Set(process.listeners(signal)));
    const priorExceptions = new Set(process.listeners("uncaughtException"));
    localEnv = new LocalEnvironment(false);
    localEnv.serverHostPort = 0;
    manager = new ServerManager(localEnv, environment.creatorTools);
    restoreSignals = () => {
      signals.forEach((signal, index) => {
        for (const listener of process.listeners(signal)) {
          if (!priorListeners[index].has(listener)) {
            process.removeListener(signal, listener);
          }
        }
      });
      for (const listener of process.listeners("uncaughtException")) {
        if (!priorExceptions.has(listener)) {
          process.removeListener("uncaughtException", listener);
        }
      }
    };
    server = new HttpServer(localEnv, manager);
    server.port = 0;
    owned = [];
  });

  afterEach(async function () {
    http.Server.prototype.listen = originalListen;
    https.Server.prototype.listen = originalHttpsListen;
    HttpServer.prototype["buildHttpsOptions"] = originalHttpsOptions;
    PlaywrightPageRenderer.prototype.initialize = originalInitializeRenderer;
    try {
      await server.stop();
      await manager.stopWebServer();
      await Promise.all(owned.map(closeListener));
    } finally {
      restoreSignals();
    }
  });

  it("coalesces startup, serves immediately, releases the port, and starts a new cached instance", async function () {
    const first = manager.ensureHttpServer(0);
    assert.equal(manager.ensureHttpServer(0), first);
    const running = await first;
    assert(running.isListening);
    assert(running.port > 0);
    await running.waitForReady(1000);
    assert.equal(await manager.ensureHttpServer(), running);
    assert.equal((await request(running.port, "/mcp")).status, 404);

    await manager.stopWebServer();
    assert.equal(running.isListening, false);
    await assert.rejects(running.waitForReady(), /stopped/);
    const probe = http.createServer();
    owned.push(probe);
    await listenOnLoopback(probe, running.port);
    await closeListener(probe);

    const restarted = await manager.ensureHttpServer(0);
    assert.notEqual(restarted, running);
    assert(restarted.isListening);
  });

  for (const unresponsive of [false, true]) {
    it(`bounds shutdown with an authenticated ${unresponsive ? "unresponsive" : "responsive"} WebSocket`, async function () {
      this.timeout(20000);
      const passcode = "wsclose1";
      localEnv.setAdminPasscodeAndRandomizeComplement(passcode);
      const running = await manager.ensureHttpServer(0);
      const response = await request(running.port, "/api/auth", passcode, "POST");
      assert.equal(response.status, 200, response.body);
      const auth: { token: string; iv: string; authTag: string } = JSON.parse(response.body);
      const token = encodeURIComponent(`${auth.token}|${auth.iv}|${auth.authTag}`);
      const client = new WebSocket(`ws://127.0.0.1:${running.port}/ws/notifications?token=${token}`, {
        handshakeTimeout: 5000,
      });
      const messages: string[] = [];
      const clientErrors: Error[] = [];
      client.on("message", (data) => messages.push(data.toString()));
      client.on("error", (error) => clientErrors.push(error));
      const clientClosed = new Promise<void>((resolve) => client.once("close", () => resolve()));
      let upgraded: WebSocket[] = [];
      let lateClient: WebSocket | undefined;
      let lateClientClosed = Promise.resolve();
      let shutdown: Promise<void> | undefined;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        await once(client, "open");
        const wsServer = running["_wsServer"];
        assert(wsServer);
        upgraded = Array.from(wsServer.clients);
        assert.equal(upgraded.length, 1);
        let forcedTermination = false;
        const terminate = upgraded[0].terminate;
        upgraded[0].terminate = function () {
          forcedTermination = true;
          terminate.call(this);
        };
        if (unresponsive) {
          // Stop reading before shutdown, so the peer cannot acknowledge the close frame.
          client.pause();
        }
        const completed: string[] = [];
        manager.stopAllDedicatedServers = async () => {
          completed.push("owned-resource cleanup");
          return false;
        };
        manager.onShutdown.subscribe((_sender, reason) => completed.push(reason));

        const started = performance.now();
        shutdown = manager.shutdown("shutdown observed");
        let refused = Promise.resolve();
        if (unresponsive) {
          const late = new WebSocket(`ws://127.0.0.1:${running.port}/ws/notifications?token=${token}`, {
            handshakeTimeout: 5000,
          });
          lateClient = late;
          lateClientClosed = new Promise<void>((resolve) => late.once("close", () => resolve()));
          refused = new Promise<NodeJS.ErrnoException>((resolve, reject) => {
            late.on("error", resolve);
            late.once("open", () => reject(new Error("A late WebSocket upgrade was accepted during shutdown.")));
          }).then((error) => {
            // The listener may have fully closed before a slow runner schedules the late connection.
            if (error.code !== "ECONNREFUSED" && error.code !== "ECONNRESET") {
              assert.equal(error.message, "Unexpected server response: 503");
            }
          });
        }
        await Promise.race([
          Promise.all([shutdown, refused]),
          new Promise<never>((_resolve, reject) => {
            deadline = setTimeout(() => reject(new Error("WebSocket shutdown exceeded 10000ms.")), 10000);
          }),
        ]);
        const duration = performance.now() - started;
        Log.message(`WebSocket shutdown (${unresponsive ? "paused reader" : "responsive"}): ${Math.round(duration)}ms`);
        assert(duration < 10000, "Downstream cleanup must finish well before the ws 30-second close timeout.");
        assert.equal(forcedTermination, unresponsive);
        assert.deepEqual(completed, ["owned-resource cleanup", "shutdown observed"]);
        assert(upgraded.every((socket) => socket.readyState === WebSocket.CLOSED));
        assert.equal(running.isListening, false);
        assert.deepEqual(clientErrors, []);
        if (!unresponsive) {
          assert(messages.some((message) => JSON.parse(message).body?.eventName === "serverShutdown"));
        }
        const probe = http.createServer();
        owned.push(probe);
        await listenOnLoopback(probe, running.port);
      } finally {
        clearTimeout(deadline);
        for (const socket of upgraded) {
          socket.terminate();
        }
        lateClient?.terminate();
        client.terminate();
        await lateClientClosed;
        await clientClosed;
        await shutdown;
      }
    });
  }

  for (const scenario of [
    { name: "WebSocket", wsFails: true, httpFails: false },
    { name: "WebSocket and HTTP", wsFails: true, httpFails: true },
    { name: "HTTP", wsFails: false, httpFails: true },
  ]) {
    it(`releases the listener and preserves the first ${scenario.name} close error`, async function () {
      const running = await manager.ensureHttpServer(0);
      const wsServer = running["_wsServer"];
      const listener = running["_httpServer"];
      assert(wsServer);
      assert(listener);
      const wsError = new Error("Controlled WebSocket close callback failure");
      const httpError = new Error("Controlled HTTP close callback failure");
      const closeWs = wsServer.close;
      const closeHttp = listener.close;
      if (scenario.wsFails) {
        wsServer.close = (callback) => closeWs.call(wsServer, () => callback?.(wsError));
      }
      if (scenario.httpFails) {
        listener.close = (callback) => closeHttp.call(listener, () => callback?.(httpError));
      }
      const logStart = Log.items.length;
      try {
        await assert.rejects(running.stop(), (error: unknown) => error === (scenario.wsFails ? wsError : httpError));
        assert.equal(listener.listening, false);
        assert.equal(running.isListening, false);
        const probe = http.createServer();
        owned.push(probe);
        await listenOnLoopback(probe, running.port);
        const additional = Log.items
          .slice(logStart)
          .filter((item) => item.message.startsWith("Additional error closing HTTP servers: "))
          .map((item) => item.message);
        assert.deepEqual(
          additional,
          scenario.wsFails && scenario.httpFails ? [`Additional error closing HTTP servers: ${httpError.message}`] : []
        );
      } finally {
        wsServer.close = closeWs;
        listener.close = closeHttp;
        await closeListener(listener);
      }
    });
  }

  it("rejects current and late readiness waiters with the occupied-port error", async function () {
    const occupant = http.createServer((_req, res) => res.end("owned"));
    owned.push(occupant);
    localEnv.serverHostPort = await listenOnLoopback(occupant);
    assert.equal((await request(localEnv.serverHostPort, "/")).body, "owned");

    const start = server.init();
    const results = await Promise.allSettled([start, server.waitForReady(1000)]);
    const error = rejectedResult(results[0]);
    assert(error instanceof HttpServerListenError);
    assert.equal(error.code, "EADDRINUSE");
    assert.equal(error.port, localEnv.serverHostPort);
    assert.equal(rejectedResult(results[1]), error);
    await assert.rejects(server.waitForReady(1000), (lateError: unknown) => lateError === error);
    assert.equal(server.isListening, false);
    assert.equal(server["_httpServer"], undefined);
    assert.equal(server["_wsServer"], undefined);
  });

  it("does not cache a failed shared startup and retries after the owned port is released", async function () {
    const occupant = http.createServer();
    owned.push(occupant);
    localEnv.serverHostPort = await listenOnLoopback(occupant);
    const first = manager.ensureHttpServer();
    const second = manager.ensureHttpServer();
    assert.equal(first, second);
    const results = await Promise.allSettled([first, second]);
    assert.equal(rejectedResult(results[0]), rejectedResult(results[1]));

    await closeListener(occupant);
    const retry = await manager.ensureHttpServer();
    assert(retry.isListening);
    assert.equal(retry.port, localEnv.serverHostPort);
    assert.equal((await request(retry.port, "/mcp")).status, 404);
  });

  for (const code of ["EADDRINUSE", "EACCES", "EIO"]) {
    it(`cleans up a controlled asynchronous ${code} error and allows init to retry`, async function () {
      const cause = Object.assign(new Error(`Controlled ${code} listen failure`), { code });
      const nativeListeningHandlers = http.createServer().listenerCount("listening");
      http.Server.prototype.listen = function () {
        process.nextTick(() => this.emit("error", cause));
        return this;
      };

      const start = server.init();
      const listener = server["_httpServer"];
      const ws = server["_wsServer"];
      assert(listener);
      assert(ws);
      let webSocketClosed = false;
      ws.once("close", () => (webSocketClosed = true));
      const results = await Promise.allSettled([start, server.waitForReady(1000)]);
      const error = rejectedResult(results[0]);
      assert.equal(rejectedResult(results[1]), error);
      if (code === "EIO") {
        assert.equal(error, cause, "Unrelated errors must propagate unchanged.");
      } else {
        assert(error instanceof HttpServerListenError);
        assert.equal(error.code, code);
        assert.equal(error.cause, cause);
        assert.equal(error.address, "127.0.0.1");
        if (code === "EACCES") {
          assert.match(error.message, /Permission denied/);
          assert.doesNotMatch(error.message, /already in use|Stop the process/);
        }
      }
      assert.equal(listener.listening, false);
      assert.equal(listener.listenerCount("listening"), nativeListeningHandlers);
      assert.equal(listener.listenerCount("error"), 0);
      assert(webSocketClosed);

      http.Server.prototype.listen = originalListen;
      await server.init();
      await server.waitForReady(1000);
      assert(server.isListening);
    });
  }

  it("preserves synchronous listen exceptions rather than recategorizing them", async function () {
    const cause = new RangeError("Controlled invalid listen arguments");
    http.Server.prototype.listen = function () {
      throw cause;
    };
    await assert.rejects(server.init(), (error: unknown) => error === cause);
    await assert.rejects(server.waitForReady(), (error: unknown) => error === cause);
    assert.equal(server["_httpServer"], undefined);
    assert.equal(server["_wsServer"], undefined);
  });

  for (const code of ["EADDRINUSE", "EACCES"] as const) {
    it(`preserves the controlled HTTPS ${code} endpoint and never starts HTTP`, async function () {
      const cause = Object.assign(new Error(`Controlled HTTPS ${code}`), { code });
      HttpServer.prototype["buildHttpsOptions"] = () => ({});
      server.sslConfig = { port: 6129 };
      https.Server.prototype.listen = function () {
        process.nextTick(() => this.emit("error", cause));
        return this;
      };
      const start = server.init();
      assert.equal(server["_httpServer"], undefined);
      await assert.rejects(start, (error: unknown) => {
        assert(error instanceof HttpServerListenError);
        assert.equal(error.code, code);
        assert.equal(error.protocol, "HTTPS");
        assert.equal(error.port, 6129);
        assert.equal(error.cause, cause);
        return true;
      });
      assert.equal(server["_httpsServer"], undefined);
      assert.equal(server.isListening, false);
    });

    it(`reports controlled ${code} through the batch renderer without launching a browser`, async function () {
      const cause = Object.assign(new Error(`Controlled renderer ${code}`), { code });
      http.Server.prototype.listen = function () {
        process.nextTick(() => this.emit("error", cause));
        return this;
      };
      let rendererStarted = false;
      PlaywrightPageRenderer.prototype.initialize = async function () {
        rendererStarted = true;
        throw new Error("A failed HTTP listener must not launch a browser.");
      };
      const folder = createTestDataDir("http-startup-render");
      try {
        const command = new RenderBatchCommand();
        const context = await CommandContextFactory.create(
          environment.creatorTools,
          localEnv,
          command.metadata.taskType,
          { inputFolder: folder, outputFolder: folder, isolated: true, commandOptions: { gpu: false } }
        );
        const logger = new BufferedLogger();
        context.log = logger;
        const session = await command["startRenderSession"](context, {
          presentation: resolveRenderPresentationOptions({}),
          port: 6129,
          width: 32,
          height: 32,
          canvasTimeoutMs: 1000,
          vanilla: false,
        });
        assert.equal(session, undefined);
        assert.equal(context.exitCode, ErrorCodes.INIT_ERROR);
        assert.equal(rendererStarted, false);
        assert.equal(logger.getErrors().length, 1);
        assert.match(
          logger.getErrors()[0],
          /Could not initialize batch renderer: Cannot start HTTP server at 127\.0\.0\.1:6129/
        );
        assert.doesNotMatch(logger.getErrors()[0], /did not become ready/);
      } finally {
        fs.rmSync(folder, { recursive: true, force: true });
      }
    });
  }

  it("requires both listeners before readiness with controlled certificate options", async function () {
    // No TLS handshake is made: empty options isolate listener lifecycle from certificate validation.
    HttpServer.prototype["buildHttpsOptions"] = () => ({});
    server.sslConfig = { port: 0 };
    let releaseHttp: (() => void) | undefined;
    http.Server.prototype.listen = function (...args: unknown[]) {
      releaseHttp = () => Reflect.apply(originalListen, this, args);
      return this;
    };
    let ready = false;
    const start = server.init().then(() => (ready = true));
    const httpsServer = server["_httpsServer"];
    assert(httpsServer);
    try {
      await once(httpsServer, "listening");
      assert(httpsServer.listening);
      assert.equal(server.isListening, false);
      assert.equal(ready, false);
      assert(releaseHttp);
      releaseHttp();
      releaseHttp = undefined;
      await start;
      await server.waitForReady(1000);
      assert(server.isListening);
    } finally {
      releaseHttp?.();
      await start;
    }
  });

  it("closes a partial HTTPS listener when HTTP fails, using controlled certificate options", async function () {
    HttpServer.prototype["buildHttpsOptions"] = () => ({});
    server.sslConfig = { port: 0 };
    const occupant = http.createServer();
    owned.push(occupant);
    localEnv.serverHostPort = await listenOnLoopback(occupant);
    const start = server.init();
    const httpsServer = server["_httpsServer"];
    assert(httpsServer);
    let httpsPort = 0;
    httpsServer.once("listening", () => {
      const address = httpsServer.address();
      assert(address && typeof address !== "string");
      httpsPort = address.port;
    });
    await assert.rejects(start, (error: unknown) => {
      assert(error instanceof HttpServerListenError);
      assert.equal(error.protocol, "HTTP");
      assert.equal(error.port, localEnv.serverHostPort);
      return true;
    });
    assert(httpsPort > 0);
    assert.equal(httpsServer.listening, false);
    assert.equal(server.isListening, false);
    assert.equal(server["_httpsServer"], undefined);
    const probe = http.createServer();
    owned.push(probe);
    await listenOnLoopback(probe, httpsPort);
  });

  it("starts and stops HTTPS-only with controlled certificate options", async function () {
    HttpServer.prototype["buildHttpsOptions"] = () => ({});
    server.sslConfig = { port: 0, httpsOnly: true };
    await server.init();
    await server.waitForReady(1000);
    assert(server.isListening);
    assert.equal(server["_httpServer"], undefined);
    const httpsServer = server["_httpsServer"];
    assert(httpsServer?.listening);
    await server.stop();
    assert.equal(httpsServer.listening, false);
    await assert.rejects(server.waitForReady(), /stopped/);
  });

  it("finishes a pending shared startup before stopping its listener", async function () {
    let release: (() => void) | undefined;
    http.Server.prototype.listen = function (...args: unknown[]) {
      release = () => Reflect.apply(originalListen, this, args);
      return this;
    };
    const start = manager.ensureHttpServer(0);
    const stop = manager.stopWebServer();
    assert(release);
    release();
    const running = await start;
    await stop;
    assert.equal(running.isListening, false);
    http.Server.prototype.listen = originalListen;
    assert((await manager.ensureHttpServer(0)).isListening);
  });

  it("completes other shutdown work when a pending HTTP startup fails", async function () {
    const cause = Object.assign(new Error("Controlled shutdown-overlap listen failure"), { code: "EACCES" });
    http.Server.prototype.listen = function () {
      process.nextTick(() => this.emit("error", cause));
      return this;
    };
    const shutdownWork: string[] = [];
    manager.stopAllDedicatedServers = async () => {
      shutdownWork.push("other resources stopped");
      return true;
    };
    manager.onShutdown.subscribe((_sender, reason) => shutdownWork.push(reason));

    const start = manager.ensureHttpServer(0);
    const shutdown = manager.shutdown("shutdown observed");
    const results = await Promise.allSettled([start, shutdown]);
    const error = rejectedResult(results[0]);
    assert(error instanceof HttpServerListenError);
    assert.equal(error.cause, cause);
    assert.equal(rejectedResult(results[1]), error, "Shutdown must not silence the startup failure.");
    assert.deepEqual(shutdownWork, ["other resources stopped", "shutdown observed"]);
  });

  describe("shutdown failure ordering", function () {
    for (const scenario of [
      { name: "startup and cleanup fail", startFails: true, cleanupFails: true, notificationFails: false },
      { name: "only cleanup fails", startFails: false, cleanupFails: true, notificationFails: false },
      { name: "all steps fail", startFails: true, cleanupFails: true, notificationFails: true },
      { name: "only notification fails", startFails: false, cleanupFails: false, notificationFails: true },
      { name: "cleanup and notification fail", startFails: false, cleanupFails: true, notificationFails: true },
    ]) {
      it(`attempts every step and retains the first error when ${scenario.name}`, async function () {
        const cause = Object.assign(new Error("Controlled shutdown listen failure"), { code: "EACCES" });
        const cleanupError = new Error("Controlled owned-resource cleanup failure");
        const notificationError = new Error("Controlled shutdown notification failure");
        if (scenario.startFails) {
          http.Server.prototype.listen = function () {
            process.nextTick(() => this.emit("error", cause));
            return this;
          };
        }
        const attempted: string[] = [];
        manager.stopAllDedicatedServers = async () => {
          attempted.push("cleanup");
          if (scenario.cleanupFails) {
            throw cleanupError;
          }
          return false;
        };
        manager.onShutdown.subscribe((_sender, reason) => {
          assert.equal(reason, "controlled shutdown");
          attempted.push("notification");
          if (scenario.notificationFails) {
            throw notificationError;
          }
        });

        const logStart = Log.items.length;
        const start = manager.ensureHttpServer(0);
        const shutdown = manager.shutdown("controlled shutdown");
        const results = await Promise.allSettled([start, shutdown]);
        const errors: Error[] = [];
        if (scenario.startFails) {
          const error = rejectedResult(results[0]);
          assert(error instanceof HttpServerListenError);
          assert.equal(error.cause, cause);
          errors.push(error);
        } else {
          assert.equal(results[0].status, "fulfilled");
          assert.equal(results[0].value.isListening, false);
        }
        if (scenario.cleanupFails) {
          errors.push(cleanupError);
        }
        if (scenario.notificationFails) {
          errors.push(notificationError);
        }

        assert.equal(rejectedResult(results[1]), errors[0]);
        assert.deepEqual(attempted, ["cleanup", "notification"]);
        const additionalErrors = Log.items
          .slice(logStart)
          .filter((item) => item.message.startsWith("Additional error during shutdown: "))
          .map((item) => item.message);
        assert.deepEqual(
          additionalErrors,
          errors.slice(1).map((error) => `Additional error during shutdown: ${error.message}`)
        );
      });
    }
  });
});

interface ICliRun {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

describe("CLI HTTP startup errors", function () {
  this.timeout(20000);
  let root: string;
  let input: string;
  let home: string;
  let env: NodeJS.ProcessEnv;
  let occupant: http.Server;
  let port: number;

  beforeEach(async function () {
    root = createTestDataDir("http-startup");
    input = path.join(root, "input");
    home = path.join(root, "home");
    fs.mkdirSync(input);
    fs.mkdirSync(home);
    fs.writeFileSync(path.join(input, "example.json"), '{"owned":true}');
    env = cliEnv({ dataDir: path.join(root, "profile") });
    for (const [name, value] of Object.entries({
      HOME: home,
      USERPROFILE: home,
      MCT_NO_OPEN_BROWSER: "1",
      NO_COLOR: "1",
      FORCE_COLOR: undefined,
      MCT_DEBUG: undefined,
      NODE_OPTIONS: undefined,
    })) {
      setEnvironmentVariable(env, name, value);
    }
    occupant = http.createServer((_req, res) => res.end("owned occupied port"));
    port = await listenOnLoopback(occupant);
    assert.equal((await request(port, "/")).body, "owned occupied port");
  });

  afterEach(async function () {
    await closeListener(occupant);
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function runCli(
    args: string[],
    options: {
      controlledError?: string;
      ipv4Probes?: boolean;
      onReady?: (output: string) => Promise<void>;
    } = {}
  ): Promise<ICliRun> {
    const nodeArgs: string[] = [];
    let preloadSource = "";
    if (options.ipv4Probes) {
      preloadSource += `const net = require("net");
const originalListen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  if (args[1] === "localhost") args[1] = "127.0.0.1";
  return Reflect.apply(originalListen, this, args);
};
`;
    }
    if (options.controlledError) {
      preloadSource += `const http = require("http");
http.Server.prototype.listen = function (port, address) {
  const error = Object.assign(new Error("Controlled listen failure"), {
    code: ${JSON.stringify(options.controlledError)}, port, address, syscall: "listen"
  });
  process.nextTick(() => this.emit("error", error));
  return this;
};
`;
    }
    if (preloadSource) {
      const preload = path.join(root, "controlled-listen.cjs");
      fs.writeFileSync(preload, preloadSource);
      nodeArgs.push("--require", preload);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [...nodeArgs, CLI_PATH, ...args, "--isolated", "-i", input],
        { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] }
      );
      let stdout = "";
      let stderr = "";
      let didBecomeReady = false;
      let failure: unknown;
      let readyWork: Promise<void> = Promise.resolve();
      const timer = setTimeout(() => {
        failure = new Error("CLI did not settle within the test deadline.");
        child.kill("SIGKILL");
      }, RUN_TIMEOUT_MS);

      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (
          options.onReady &&
          !didBecomeReady &&
          /(?:Web UI available at:|Opening browser to:)[^\r\n]+\r?\n/.test(stdout)
        ) {
          didBecomeReady = true;
          readyWork = options.onReady(stdout).then(
            () => {
              child.kill("SIGTERM");
            },
            (error: unknown) => {
              failure = error;
              child.kill("SIGKILL");
            }
          );
        }
      });
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("close", async (exitCode, signal) => {
        clearTimeout(timer);
        await readyWork;
        const result = { exitCode, signal, stdout, stderr };
        if (failure || (options.onReady && !didBecomeReady)) {
          reject(new Error(`CLI readiness/cleanup failed: ${String(failure)}\n${JSON.stringify(result)}`));
        } else {
          resolve(result);
        }
      });
    });
  }

  function assertStartupFailure(run: ICliRun, json = false): void {
    assert.equal(run.exitCode, 1, JSON.stringify(run));
    assert.equal(run.signal, null, "A timeout or signal is not an exit-code regression oracle.");
    assert.doesNotMatch(run.stdout + run.stderr, STACK_OR_UNCAUGHT);
    assert.doesNotMatch(run.stdout + run.stderr, /Web UI available at:|Opening browser to:/);
    assert.match(run.stderr, /Cannot start HTTP server at 127\.0\.0\.1:\d+/);
    if (json) {
      assert.equal(run.stdout, "", "A startup failure must not corrupt machine-readable stdout.");
    }
  }

  for (const flags of [[], ["--quiet"], ["--json"], ["--json", "--quiet"]]) {
    it(`reports an owned occupied port with exit 1 and no stack (${flags.join(" ") || "default"})`, async function () {
      const run = await runCli(["serve", "--port", String(port), "--once", ...flags]);
      assertStartupFailure(run, flags.includes("--json"));
      assert(run.stderr.includes(`127.0.0.1:${port}`), run.stderr);
      assert.match(run.stderr, /already in use/);
      assert.match(run.stderr, /--port <number>/);
      assert.equal(run.stderr.trim().split("\n").length, 1, run.stderr);
      assert.equal((await request(port, "/")).body, "owned occupied port");
    });
  }

  for (const command of ["serve", "view", "edit"]) {
    for (const code of ["EADDRINUSE", "EACCES"]) {
      for (const flags of [[], ["--json", "--quiet"]]) {
        it(`reports controlled ${code} for ${command} (${flags.join(" ") || "default"})`, async function () {
          const args = command === "serve" ? [command, "--port", String(port), "--once"] : [command];
          const run = await runCli([...args, ...flags], { controlledError: code });
          assertStartupFailure(run, flags.includes("--json"));
          if (code === "EACCES") {
            assert.match(run.stderr, /Permission denied/);
            assert.match(run.stderr, /permissions/);
            assert.doesNotMatch(run.stderr, /already in use|Stop the process/);
          } else {
            assert.match(run.stderr, /already in use/);
          }
          if (command === "serve") {
            assert(run.stderr.includes(`127.0.0.1:${port}`));
            assert.match(run.stderr, /--port <number>/);
          } else {
            assert.doesNotMatch(run.stderr, /--port/, "view/edit do not accept a --port option.");
          }
        });
      }
    }
  }

  for (const debugMode of ["--debug", "MCT_DEBUG=1"]) {
    it(`retains the native diagnostic only when requested with ${debugMode}`, async function () {
      const flags = debugMode === "--debug" ? ["--debug"] : [];
      if (debugMode === "MCT_DEBUG=1") {
        env.MCT_DEBUG = "1";
      }
      const run = await runCli(["serve", "--port", String(port), "--once", "--json", ...flags]);
      assert.equal(run.exitCode, 1, JSON.stringify(run));
      assert.equal(run.signal, null);
      assert.equal(run.stdout, "");
      assert.match(run.stderr, /EADDRINUSE/);
      assert.match(run.stderr, /at Server\.setupListenHandle/);
      assert.match(run.stderr, /--port <number>/);
      assert.doesNotMatch(run.stderr, /Uncaught exception:/);
    });
  }

  it("propagates an unrelated controlled listen error as an ordinary command failure", async function () {
    const run = await runCli(["serve", "--port", String(port), "--once", "--json"], {
      controlledError: "EIO",
    });
    assert.equal(run.exitCode, 1, JSON.stringify(run));
    assert.equal(run.signal, null);
    assert.equal(run.stdout, "");
    assert.match(run.stderr, /Error executing serve: Controlled listen failure/);
    assert.doesNotMatch(run.stderr, /already in use|Permission denied|--port|Uncaught exception:/);
  });

  for (const command of ["serve", "view", "edit"]) {
    const probeControl = command === "serve" ? "" : " with controlled IPv4 availability probes";
    it(`announces ${command} only after listening and releases its port after owned-child termination${probeControl}`, async function () {
      await closeListener(occupant);
      const args = command === "serve" ? [command, "--port", String(port)] : [command];
      let servingPort = 0;
      const run = await runCli(args, {
        ipv4Probes: command !== "serve",
        onReady: async (output) => {
          const match = /http:\/\/localhost:(\d+)(?:\/\S*#tempPasscode=(\S+))?/.exec(output);
          assert(match, output);
          servingPort = Number(match[1]);
          if (command === "serve") {
            assert.equal(servingPort, port);
            const response = await request(servingPort, "/api/eulaStatus", match[2]);
            assert.equal(response.status, 200, response.body);
            assert.equal(JSON.parse(response.body).eulaAccepted, false, response.body);
          } else {
            const passcodeMatch = /Opening browser to: \S*#tempPasscode=(\S+)/.exec(output);
            assert(passcodeMatch, output);
            const response = await request(servingPort, "/api/content/example.json", passcodeMatch[1]);
            assert.equal(response.status, 200, response.body);
            assert.deepEqual(JSON.parse(response.body), { owned: true });
            assert.equal((await request(servingPort, "/mcp")).status, 404);
          }
        },
      });
      // child.kill("SIGTERM") is abrupt on Windows; direct lifecycle tests cover graceful cleanup.
      const expectedTermination =
        process.platform === "win32" ? { exitCode: null, signal: "SIGTERM" } : { exitCode: 0, signal: null };
      assert.deepEqual({ exitCode: run.exitCode, signal: run.signal }, expectedTermination, JSON.stringify(run));
      assert.doesNotMatch(run.stdout + run.stderr, STACK_OR_UNCAUGHT);
      assert(servingPort > 0);
      await listenOnLoopback(occupant, servingPort);
      assert.equal(fs.readFileSync(path.join(input, "example.json"), "utf8"), '{"owned":true}');
    });
  }
});
