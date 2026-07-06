import { assert } from "chai";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import * as net from "net";
import Utilities from "../core/Utilities";
import IFile from "../storage/IFile";
import axios, { AxiosResponse } from "axios";
import {
  defaultValidationReportExcludedTestIds,
  ensureReportJsonMatchesScenario,
  folderMatches,
  volatileFileExtensions,
} from "./TestUtilities";
import {
  sampleFolder,
  scenariosFolder,
  resultsFolder,
  removeResultFolder,
  collectLines,
} from "./CommandLineTestHelpers";

const SERVER_STARTUP_TIMEOUT_MS = 15000;
const SERVER_HOST = "127.0.0.1";

async function canConnectToServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: SERVER_HOST, port }, () => {
      socket.end();
      resolve(true);
    });

    socket.setTimeout(250);
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * POSTs `body` to `url` with the given headers, retrying briefly on transient
 * connection errors (ECONNREFUSED / ECONNRESET / EAI_AGAIN and the
 * AggregateErrors that wrap them). The serve command logs its "Web UI
 * available at:" line just before — or in CI, sometimes microseconds before —
 * the underlying socket transitions to listening, so a single early POST can
 * race the listen() callback and fail. This helper papers over that race
 * without masking real validation failures (non-network errors are rethrown
 * immediately).
 */
async function postWithRetry(
  url: string,
  body: Uint8Array | Buffer | string,
  headers: Record<string, string>,
  maxAttempts: number = 8,
  initialDelayMs: number = 100
): Promise<AxiosResponse> {
  let lastError: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios.post(url, body, { headers, method: "POST" });
    } catch (err) {
      lastError = err;
      if (!isTransientConnectError(err) || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs = Math.min(delayMs * 2, 1000);
    }
  }

  throw lastError;
}

function isTransientConnectError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  const transientCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EAI_AGAIN",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EPIPE",
  ]);

  const e = err as { code?: unknown; errors?: unknown };
  if (typeof e.code === "string" && transientCodes.has(e.code)) {
    return true;
  }

  if (Array.isArray(e.errors)) {
    return e.errors.some((inner) => isTransientConnectError(inner));
  }

  return false;
}

async function waitForServerStartup(
  stdoutLines: string[],
  stderrLines: string[],
  serverProcess: ChildProcessWithoutNullStreams,
  port: number,
  timeoutMs: number = SERVER_STARTUP_TIMEOUT_MS
): Promise<void> {
  const start = Date.now();
  const expectedHostPort = `localhost:${port}`;

  while (Date.now() - start < timeoutMs) {
    const hasStartupSignal = stdoutLines.some(
      (line) => line.includes("Web UI available at:") && line.includes(expectedHostPort)
    );

    if (hasStartupSignal) {
      if (await canConnectToServer(port)) {
        return;
      }
    }

    if (serverProcess.exitCode !== null || serverProcess.killed) {
      throw new Error(
        `Server exited before startup signal. exitCode=${serverProcess.exitCode}; stdout=${stdoutLines.slice(-10).join(" | ")}; stderr=${stderrLines.slice(-10).join(" | ")}`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Timed out waiting for startup signal on ${expectedHostPort}. stdout=${stdoutLines.slice(-10).join(" | ")}; stderr=${stderrLines.slice(-10).join(" | ")}`
  );
}

/**
 * Creates a standard serve command validation test suite.
 * Reduces duplication across the 5 serveCommand* test suites.
 */
function createServeValidationTest(
  suiteName: string,
  samplePath: string,
  port: number,
  extraHeaders?: Record<string, string>
) {
  describe(suiteName, () => {
    let exitCode: number | null = null;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    let serverProcess: ChildProcessWithoutNullStreams | null = null;

    before(async function () {
      this.timeout(40000);

      removeResultFolder(suiteName);
      const passcode = Utilities.createUuid().substring(0, 8);

      if (!sampleFolder) {
        throw new Error("Sample folder does not exist.");
      }

      const sampleFile: IFile = await sampleFolder.ensureFileFromRelativePath(samplePath);

      serverProcess = spawn("node", [
        "./toolbuild/jsn/cli/index.mjs",
        "serve",
        "basicwebservices",
        "--port",
        String(port),
        "--verbose",
        "--once",
        "--updatepc",
        passcode,
      ]);

      collectLines(serverProcess.stdout, stdoutLines);
      collectLines(serverProcess.stderr, stderrLines);

      await sampleFile.loadContent();
      const content = sampleFile.content;
      if (content === null) {
        throw new Error(`Sample file '${samplePath}' loaded with null content.`);
      }

      await waitForServerStartup(stdoutLines, stderrLines, serverProcess, port);

      const headers: Record<string, string> = {
        mctpc: passcode,
        "content-type": "application/zip",
        ...extraHeaders,
      };

      const response: AxiosResponse = await postWithRetry(
        `http://${SERVER_HOST}:${port}/api/validate/`,
        content,
        headers
      );

      await ensureReportJsonMatchesScenario(
        scenariosFolder,
        resultsFolder,
        response.data,
        suiteName,
        defaultValidationReportExcludedTestIds
      );

      await new Promise<void>((resolve) => {
        if (serverProcess) {
          serverProcess.on("exit", (code) => {
            exitCode = code;
            serverProcess = null;
            resolve();
          });
        } else {
          resolve();
        }
      });
    });

    it("should have no stderr lines", async () => {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
      assert.equal(stderrLines.length, 0, "Error: " + stderrLines.join("\n") + "|");
    }).timeout(10000);

    it("exit code should be zero", async () => {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
      assert.equal(exitCode, 0);
    }).timeout(10000);

    it("output matches", async () => {
      await folderMatches(scenariosFolder, resultsFolder, suiteName, [...volatileFileExtensions, "report.json"]);
    });

    after(function () {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
    });
  });
}

createServeValidationTest(
  "serveCommandValidate",
  "/addon/build/packages/aop_moremobs_animationmanifesterrors.zip",
  16127
);

createServeValidationTest(
  "serveCommandValidateAddon",
  "/addon/build/packages/aop_moremobs_animationmanifesterrors.zip",
  16128,
  { mctsuite: "addon" }
);

createServeValidationTest("serveCommandValidateWorld", "/world/build/packages/aop_moremobs_linkerrors.zip", 16129);

createServeValidationTest("serveCommandValidateMashup", "/world/build/packages/aop_moremobs_mashup.zip", 16130);

createServeValidationTest("serveCommandValidateAdvanced", "/addon/build/packages/aop_moremobs_advanced.zip", 16131, {
  mctsuite: "all",
});

describe("serveCommandTimeout", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

    serverProcess = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "serve",
      "basicwebservices",
      "--port",
      "16199",
      "--timeout",
      "2",
      "--updatepc",
      "testpc1a",
    ]);

    collectLines(serverProcess.stdout, stdoutLines);
    collectLines(serverProcess.stderr, stderrLines);

    serverProcess.on("exit", (code) => {
      exitCode = code;
    });

    // Give the server time to start up and produce output, then signal done
    setTimeout(() => {
      done();
    }, 5000);
  });

  after(function () {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it("should have started the web server", () => {
    const hasWebUI = stdoutLines.some(
      (line) => line.includes("Web UI") || line.includes("localhost") || line.includes("16199")
    );
    assert(hasWebUI, "Should mention web UI URL in output. Got: " + stdoutLines.slice(0, 5).join(" | "));
  }).timeout(10000);
});

describe("serveCommandVersion", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

    serverProcess = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "serve",
      "basicwebservices",
      "--port",
      "16198",
      "--timeout",
      "2",
      "--updatepc",
      "testpc2b",
    ]);

    collectLines(serverProcess.stdout, stdoutLines);
    collectLines(serverProcess.stderr, stderrLines);

    serverProcess.on("exit", (code) => {
      exitCode = code;
    });

    setTimeout(() => {
      done();
    }, 5000);
  });

  after(function () {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it("should display server startup info", () => {
    const hasServerInfo = stdoutLines.some(
      (line) => line.includes("Web UI") || line.includes("MCP endpoint") || line.includes("auto-exit")
    );
    assert(hasServerInfo, "Should show server startup info. Got: " + stdoutLines.slice(0, 5).join(" | "));
  }).timeout(10000);
});

describe("serveCommandInvalidPort", () => {
  let serverProcess: ChildProcessWithoutNullStreams | null = null;
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(30000);

    serverProcess = spawn("node", [
      "./toolbuild/jsn/cli/index.mjs",
      "serve",
      "basicwebservices",
      "--port",
      "99999",
      "--timeout",
      "2",
      "--updatepc",
      "testpc3c",
    ]);

    collectLines(serverProcess.stdout, stdoutLines);
    collectLines(serverProcess.stderr, stderrLines);

    serverProcess.on("exit", (code) => {
      exitCode = code;
    });

    setTimeout(() => {
      done();
    }, 5000);
  });

  after(function () {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
  });

  it("should fall back to default port for invalid port number", () => {
    // Port 99999 is out of range (1-65535) - server falls back to default port
    const hasInvalidPortMsg = stdoutLines.some((line) => line.includes("Invalid port") || line.includes("default"));
    assert(hasInvalidPortMsg, "Should mention invalid port fallback. Got: " + stdoutLines.slice(0, 5).join(" | "));
  }).timeout(10000);
});

describe("passcodesCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "passcodes"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should display passcode labels", () => {
    const allOutput = stdoutLines.join("\n").toLowerCase();
    const hasPasscodes = allOutput.includes("admin") || allOutput.includes("passcode") || allOutput.includes("display");
    assert(hasPasscodes, "Should show passcode info. Got: " + stdoutLines.slice(0, 10).join(" | "));
  }).timeout(10000);
});

describe("passcodesCommandJson", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "passcodes", "--json"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should output valid JSON with passcodes", () => {
    const jsonLine = stdoutLines.find((line) => line.startsWith("{"));
    assert(jsonLine, "Should contain a JSON line. Got: " + stdoutLines.slice(0, 5).join(" | "));
    const parsed = JSON.parse(jsonLine!);
    assert(
      parsed.passcodes || parsed.admin || parsed.displayReadOnly,
      "JSON should have passcode fields. Got: " + JSON.stringify(parsed).substring(0, 100)
    );
  }).timeout(10000);
});

describe("setServerPropsCommand", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    const process = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "setserverprops"]);

    collectLines(process.stdout, stdoutLines);
    collectLines(process.stderr, stderrLines);

    process.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should display server properties", () => {
    const allOutput = stdoutLines.join("\n").toLowerCase();
    const hasProps = allOutput.includes("port") || allOutput.includes("server") || allOutput.includes("domain");
    assert(hasProps, "Should show server properties. Got: " + stdoutLines.slice(0, 10).join(" | "));
  }).timeout(10000);
});

describe("eulaCommandDisplay", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Run with the env var set to skip interactive prompt
    const env = { ...process.env, MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA: "true" };

    const process2 = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "eula"], { env });

    collectLines(process2.stdout, stdoutLines);
    collectLines(process2.stderr, stderrLines);

    process2.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should have no stderr lines", async () => {
    assert.equal(stderrLines.length, 0, "Error: |" + stderrLines.join("\n") + "|");
  }).timeout(10000);

  it("exit code should be zero", async () => {
    assert.equal(exitCode, 0);
  }).timeout(10000);

  it("should mention EULA", () => {
    const allOutput = stdoutLines.join("\n").toLowerCase();
    const hasEula = allOutput.includes("eula") || allOutput.includes("license") || allOutput.includes("accept");
    assert(hasEula, "Should mention EULA. Got: " + stdoutLines.slice(0, 10).join(" | "));
  }).timeout(10000);
});

describe("dedicatedServeCommandMissingEula", async () => {
  let exitCode: number | null = null;
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];

  before(function (done) {
    this.timeout(15000);

    // Run dedicated serve without EULA — should fail
    const env = { ...process.env, MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA: "" };

    const process2 = spawn("node", ["./toolbuild/jsn/cli/index.mjs", "dedicatedserve", "--timeout", "1"], { env });

    collectLines(process2.stdout, stdoutLines);
    collectLines(process2.stderr, stderrLines);

    process2.on("exit", (code) => {
      exitCode = code;
      done();
    });
  });

  it("should complete without hanging", async () => {
    assert.notEqual(exitCode, null, "Process should exit");
  }).timeout(10000);
});
