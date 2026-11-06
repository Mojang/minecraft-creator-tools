// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { spawn } from "child_process";
import * as fs from "fs";
import * as http from "http";
import { AddressInfo, Socket } from "net";
import * as path from "path";
import TestPaths from "./TestPaths";
import { cliEnv, setEnvironmentVariable } from "./TestDataDir";
import { copyFixture, diffTrees, snapshotTree, STRIPPED_ENV_VARS } from "./CliTranscriptHarness";
import Database from "../minecraft/Database";
import { METADATA_REQUEST_TIMEOUT_MS } from "../core/MetadataRequest";

const CHILD_LIMIT_MS = METADATA_REQUEST_TIMEOUT_MS + 10000;
const CLI = path.join(TestPaths.appRoot, "toolbuild/jsn/cli/index.mjs");
const TRACE = path.join(TestPaths.appRoot, "src/test/fixtures/metadataConnectionTrace.cjs");

describe("CLI metadata request completion", function () {
  this.timeout(CHILD_LIMIT_MS + 5000);

  for (const mode of [
    "drop",
    "stall",
    "refuse",
    "cached",
    "registry-drop",
    "registry-unsafe-human",
    "registry-unsafe-json",
    "registry-safe-human",
    "registry-safe-json",
  ] as const) {
    const diagnosticCase = mode.includes("-human") || mode.includes("-json");
    const registryCase = mode.startsWith("registry-");
    const moduleName = mode.includes("-unsafe-") ? "bad\u001b[2J\r\u0085\u009b31m\u0000name" : "@minecraft/server";
    const escapedModuleName = mode.includes("-unsafe-")
      ? "bad\\u001b[2J\\u000d\\u0085\\u009b31m\\u0000name"
      : moduleName;
    for (const command of diagnosticCase
      ? ["validate"]
      : registryCase
        ? ["info", "validate"]
        : ["fix", "info", "validate"]) {
      it(`${command} completes with ${mode} metadata connections`, async () => {
        const resultsRoot = path.join(TestPaths.testRoot, "results");
        fs.mkdirSync(resultsRoot, { recursive: true });
        const root = fs.mkdtempSync(path.join(resultsRoot, "metadata-"));
        const sockets = new Set<Socket>();
        const requests: string[] = [];
        const server = http.createServer((_req, res) => {
          res.writeHead(503).end();
        });
        server.on("connection", (socket) => {
          sockets.add(socket);
          socket.once("close", () => sockets.delete(socket));
        });
        server.on("connect", (req, socket) => {
          requests.push(req.url || "");
          socket.on("end", () => socket.end());
          socket.resume();
          if (mode === "drop" || mode === "registry-drop") socket.destroy();
          if (mode === "refuse" || diagnosticCase)
            socket.end("HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n");
        });

        try {
          await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
          const port = (server.address() as AddressInfo).port;
          const project = path.join(root, "project");
          copyFixture(TestPaths.sampleContentPath("simple"), project);
          if (registryCase) {
            const manifestPath = path.join(project, "behavior_packs/StarterTestsTutorial/manifest.json");
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
            manifest.dependencies = [{ module_name: moduleName, version: "2.0.0" }];
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
          }
          const before = snapshotTree(project);
          const home = path.join(root, "home");
          fs.mkdirSync(home);
          const trace = path.join(root, "connections.jsonl");
          const env = cliEnv({ dataDir: path.join(root, "data") });
          for (const name of STRIPPED_ENV_VARS) {
            if (name !== "MCTOOLS_DATA_DIR") {
              setEnvironmentVariable(env, name, undefined);
            }
          }
          for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"]) {
            setEnvironmentVariable(env, name, `http://127.0.0.1:${port}`);
          }
          Object.assign(env, {
            HOME: home,
            USERPROFILE: home,
            MCT_TEST_PROXY_PORT: String(port),
            MCT_TEST_CONNECTION_TRACE: trace,
          });
          if (mode === "cached" || registryCase) {
            env.MCT_TEST_PINNED_MC_VERSION = "1.26.20";
          }
          if (diagnosticCase) env.NO_COLOR = "1";

          const args = [command];
          if (command === "fix") args.push("setnewestminengineversion");
          args.push("-i", project, "--offline");
          if (!mode.endsWith("-human")) args.push("--json");
          if (command === "validate") args.push("--threads", "1", "--force", "--ot", "noreports");

          const start = Date.now();
          const child = spawn(process.execPath, ["--unhandled-rejections=strict", "--require", TRACE, CLI, ...args], {
            cwd: root,
            env,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let stdout = "";
          let stderr = "";
          let timedOut = false;
          child.stdout.on("data", (data) => (stdout += data));
          child.stderr.on("data", (data) => (stderr += data));
          const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, CHILD_LIMIT_MS);
          const code = await new Promise<number | null>((resolve, reject) => {
            child.once("error", reject);
            child.once("close", resolve);
          }).finally(() => clearTimeout(timer));
          const duration = Date.now() - start;
          const origins = fs.existsSync(trace)
            ? fs
                .readFileSync(trace, "utf8")
                .trim()
                .split("\n")
                .map((line) => JSON.parse(line))
            : [];
          const evidence = JSON.stringify({ code, timedOut, duration, requests, origins, stdout, stderr });
          if (mode === "cached") {
            assert.deepEqual(requests, [], evidence);
            assert.deepEqual(origins, [], evidence);
            assert.strictEqual(stderr, "", evidence);
          } else {
            assert.deepEqual(
              requests,
              [registryCase ? "registry.npmjs.org:443" : "raw.githubusercontent.com:443"],
              evidence
            );
            assert.isTrue(
              origins.every((origin) => origin.isMainThread === (command !== "validate")),
              evidence
            );
            assert.isNotEmpty(origins, evidence);
            assert.include(
              stderr,
              registryCase ? "Latest script package checks are unavailable" : "Using bundled retail Minecraft version",
              evidence
            );
          }
          assert.isFalse(timedOut, evidence);
          assert.strictEqual(code, mode.includes("-unsafe-") ? 4 : 0, evidence);
          assert.notInclude(stderr, "MaxListenersExceededWarning", evidence);
          assert.notInclude(stderr, "Unhandled", evidence);
          if (diagnosticCase) {
            const diagnostic =
              `Could not load registry for '${escapedModuleName}': Request failed with status code 503 ` +
              "Latest script package checks are unavailable; existing dependencies are unchanged.";
            // Match the complete payload AND trusted wrapper, without stripping any original bytes.
            // eslint-disable-next-line no-control-regex
            const prefix = /^(\x1b\[33m)?\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[WARN +\] /m.exec(stderr);
            assert.isNotNull(prefix, evidence);
            const warning = prefix![0] + diagnostic + (prefix![1] ? "\x1b[0m\n" : "\n");
            assert.strictEqual(stderr.slice(prefix!.index, prefix!.index + warning.length), warning, evidence);
            if (mode.endsWith("-json")) assert.strictEqual(stderr, warning, evidence);
            // Human-mode CHKMANIF diagnostics are a separate pre-existing rendering path.
            assert.deepEqual(diffTrees(before, snapshotTree(project)), []);
          }
          // The peer must observe closure; natural-exit transport tests separately rule out leaked handles.
          assert.strictEqual(sockets.size, 0, evidence);
          if (mode === "drop" || mode === "stall" || mode === "registry-drop") {
            assert.isAtLeast(duration, METADATA_REQUEST_TIMEOUT_MS, evidence);
            assert.isBelow(duration, METADATA_REQUEST_TIMEOUT_MS + 5000, evidence);
            assert.include(stderr, `timed out after ${METADATA_REQUEST_TIMEOUT_MS} ms`, evidence);
          } else {
            assert.isBelow(duration, METADATA_REQUEST_TIMEOUT_MS, evidence);
          }
          if (mode.endsWith("-human")) {
            assert.include(stdout, "Validat", evidence);
            return;
          }
          const result = JSON.parse(stdout);
          assert.isObject(result, evidence);
          if (command === "fix") {
            const manifest = JSON.parse(
              fs.readFileSync(path.join(project, "behavior_packs/StarterTestsTutorial/manifest.json"), "utf8")
            );
            const version = mode === "cached" ? "1.26.20" : Database.fallbackMinecraftVersion;
            assert.deepEqual(manifest.header.min_engine_version, version.split(".").map(Number), evidence);
            assert.strictEqual(result.projectCount, 1, evidence);
            assert.lengthOf(result.fixes, 1, evidence);
            assert.strictEqual(result.fixes[0].updatedCount, 1, evidence);
            assert.deepEqual(diffTrees(before, snapshotTree(project)), [
              { kind: "changed", path: "behavior_packs/StarterTestsTutorial/manifest.json" },
            ]);
          } else {
            assert.deepEqual(diffTrees(before, snapshotTree(project)), []);
            assert.strictEqual(result.schemaVersion, "1.0.0", evidence);
            assert.strictEqual(result.command, command, evidence);
            if (command === "validate") {
              assert.lengthOf(result.projects, 1, evidence);
              assert.isAbove(result.projects[0].items.length, 0, evidence);
              assert.isTrue(
                result.projects[0].items.some((item: { generatorId: string }) => item.generatorId === "MINENGINEVER"),
                evidence
              );
              assert.strictEqual(result.errors, mode.includes("-unsafe-") ? 2 : 0, evidence);
              assert.strictEqual(result.recommendations, 1, evidence);
              if (diagnosticCase) {
                assert.isTrue(
                  result.projects[0].items.some(
                    (item: { generatorId: string; message: string }) =>
                      item.generatorId === "SCRIPTMODULE" && item.message.includes(moduleName)
                  ),
                  evidence
                );
              }
            } else {
              assert.strictEqual(result.itemCount, 6, evidence);
              assert.lengthOf(result.items, 6, evidence);
              assert.strictEqual(result.counts.recommendations, 1, evidence);
            }
          }
        } finally {
          for (const socket of sockets) socket.destroy();
          await new Promise<void>((resolve) => server.close(() => resolve()));
          fs.rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});
