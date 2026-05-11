import { assert } from "chai";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import Utilities from "../core/Utilities";
import IFile from "../storage/IFile";
import axios, { AxiosResponse } from "axios";
import { volatileFileExtensions, ensureReportJsonMatchesScenario, folderMatches } from "./TestUtilities";
import {
  sampleFolder,
  scenariosFolder,
  resultsFolder,
  removeResultFolder,
  collectLines,
} from "./CommandLineTestHelpers";

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

    before(function (done) {
      this.timeout(40000);

      removeResultFolder(suiteName);
      const passcode = Utilities.createUuid().substring(0, 8);

      if (!sampleFolder) {
        throw new Error("Sample folder does not exist.");
      }

      sampleFolder.ensureFileFromRelativePath(samplePath).then((sampleFile: IFile) => {
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

        sampleFile.loadContent().then(() => {
          const content = sampleFile.content;

          Utilities.sleep(3000).then(() => {
            const headers: Record<string, string> = {
              mctpc: passcode,
              "content-type": "application/zip",
              ...extraHeaders,
            };

            axios
              .post(`http://localhost:${port}/api/validate/`, content, {
                headers,
                method: "POST",
              })
              .then((response: AxiosResponse) => {
                ensureReportJsonMatchesScenario(scenariosFolder, resultsFolder, response.data, suiteName, [
                  "CDWORLDDATA2",
                ]);

                if (response === undefined) {
                  throw new Error("Could not connect to server.");
                }

                if (serverProcess) {
                  serverProcess.on("exit", (code) => {
                    exitCode = code;
                    serverProcess = null;
                    done();
                  });
                }
              });
          });
        });
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
    this.timeout(15000);

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
    this.timeout(15000);

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
    this.timeout(15000);

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
