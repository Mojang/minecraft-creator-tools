// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * MCP HTTP Integration Tests
 *
 * These tests start an `mct serve` instance and connect to the MCP endpoint
 * at http://localhost:<port>/mcp using the Streamable HTTP transport.
 *
 * The tests validate:
 * - MCP server initialization over HTTP (Streamable HTTP transport)
 * - Tool listing
 * - Session management (create, reuse, cleanup)
 * - Auth bypass on localhost (default behavior)
 * - Host and Origin checks: requests with a foreign Host (DNS rebinding) or Origin
 *   (cross-site request) get 403 and never reach MCP, requests from a CORS origin must send a
 *   passcode, and local clients still connect without one
 * - `mct view` and `mct edit` don't serve /mcp (404)
 *
 * Each spawned command uses a temporary MCTOOLS_DATA_DIR, so these tests don't touch the
 * user's profile.
 *
 * NOTE: These tests are in test-extra/ because they:
 * - Require a built CLI tool (npm run jsnbuild)
 * - Start a real HTTP server and BDS preparation
 * - May take significant time to run
 *
 * To run these tests:
 *   npm run test-mcp-http
 */

import { expect } from "chai";
import "mocha";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import { ChildProcess, spawn } from "child_process";

// Path to the CLI tool (use path.resolve from CWD since __dirname is unavailable in ESM)
const CLI_PATH = path.resolve("toolbuild/jsn/cli/index.mjs");

// Port for the test server (use a non-standard port to avoid conflicts)
const TEST_PORT = 16126;
const MCP_URL = `http://localhost:${TEST_PORT}/mcp`;
const ADMIN_PASSCODE = "testmcp1";

const FOREIGN_ORIGIN = "https://attacker.example";
const FOREIGN_HOST = `rebind.attacker.example:${TEST_PORT}`;

const INITIALIZE_REQUEST = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "raw-client", version: "1.0.0" } },
};

interface IRawResponse {
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}

/**
 * Sends a request to /mcp the way an MCP client would, with any headers overridden, such as a
 * foreign Host or Origin. POST requests send the given JSON-RPC message.
 */
function requestMcp(
  port: number,
  method: string,
  headers: http.OutgoingHttpHeaders = {},
  message?: object
): Promise<IRawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/mcp",
        method,
        agent: false,
        headers: {
          host: `localhost:${port}`,
          accept: method === "POST" ? "application/json, text/event-stream" : "text/event-stream",
          ...(method === "POST" ? { "content-type": "application/json" } : {}),
          ...headers,
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      }
    );

    req.on("error", reject);

    if (message) {
      req.write(JSON.stringify(message));
    }

    req.end();
  });
}

/** Creates a temporary MCTOOLS_DATA_DIR for a spawned command. */
function createDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mct-mcp-http-test-"));
}

/** Stops a spawned command, forcing it if it doesn't exit within two seconds. */
async function stopProcess(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGTERM");

  const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
  await exited;
  clearTimeout(timer);
}

/**
 * Wait for the HTTP server to be ready by polling.
 */
async function waitForServer(port: number, timeoutMs: number = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
          res.resume(); // consume response
          resolve(true);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(2000, () => {
          req.destroy();
          resolve(false);
        });
      });
      if (result) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

describe("MCP HTTP Integration Tests", function () {
  // Longer timeout for server startup
  this.timeout(120000);

  let serverProcess: ChildProcess | undefined;
  let client: Client | undefined;
  let transport: StreamableHTTPClientTransport | undefined;
  let serverAvailable = false;
  let dataDir: string | undefined;

  before(async function () {
    // Check if the CLI tool exists
    const cliExists = fs.existsSync(CLI_PATH + ".js") || fs.existsSync(CLI_PATH) || fs.existsSync(CLI_PATH + ".mjs");
    if (!cliExists) {
      console.log(`CLI tool not found at ${CLI_PATH} - skipping MCP HTTP integration tests`);
      console.log("Run 'npm run jsnbuild' to build the CLI tool first");
      this.skip();
      return;
    }

    try {
      // Start the serve command as a subprocess
      console.log(`Starting mct serve on port ${TEST_PORT}...`);
      dataDir = createDataDir();
      serverProcess = spawn("node", [CLI_PATH, "serve", "--port", String(TEST_PORT), "--adminpc", ADMIN_PASSCODE], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, MCTOOLS_DATA_DIR: dataDir },
      });

      // Log server output for debugging
      serverProcess.stdout?.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          console.log(`[serve stdout] ${msg}`);
        }
      });

      serverProcess.stderr?.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          console.log(`[serve stderr] ${msg}`);
        }
      });

      serverProcess.on("exit", (code) => {
        console.log(`serve process exited with code ${code}`);
      });

      // Wait for the HTTP server to become available
      console.log("Waiting for HTTP server to be ready...");
      const ready = await waitForServer(TEST_PORT, 30000);
      if (!ready) {
        console.log("HTTP server did not start in time - skipping tests");
        this.skip();
        return;
      }
      console.log("HTTP server is ready.");

      serverAvailable = true;
    } catch (e) {
      console.log("Failed to start serve process:", e);
      this.skip();
    }
  });

  after(async function () {
    // Close MCP transport
    if (transport) {
      try {
        await transport.close();
      } catch {
        // ignore
      }
      transport = undefined;
    }

    // Kill serve process
    if (serverProcess) {
      try {
        await stopProcess(serverProcess);
      } catch {
        // ignore
      }
      serverProcess = undefined;
    }

    if (dataDir) {
      fs.rmSync(dataDir, { recursive: true, force: true });
      dataDir = undefined;
    }
  });

  // These run before any client connects. The server has a single MCP session, so if a rejected
  // initialize had reached MCP, the local client below couldn't initialize afterward.
  describe("Host and Origin checks before a client connects", function () {
    const rejectedCases: { name: string; method: string; headers: http.OutgoingHttpHeaders }[] = [
      { name: "initialize with a foreign Origin", method: "POST", headers: { origin: FOREIGN_ORIGIN } },
      { name: "initialize with the null Origin", method: "POST", headers: { origin: "null" } },
      { name: "initialize with a foreign Host", method: "POST", headers: { host: FOREIGN_HOST } },
      { name: "GET with a foreign Host", method: "GET", headers: { host: FOREIGN_HOST } },
      { name: "DELETE with a foreign Host", method: "DELETE", headers: { host: FOREIGN_HOST } },
      {
        name: "a preflight from a foreign Origin",
        method: "OPTIONS",
        headers: { origin: FOREIGN_ORIGIN, "access-control-request-method": "POST" },
      },
      {
        name: "initialize with a foreign Origin and a valid passcode",
        method: "POST",
        headers: { origin: FOREIGN_ORIGIN, mctpc: ADMIN_PASSCODE },
      },
      {
        name: "initialize with a foreign Host and an invalid passcode",
        method: "POST",
        headers: { host: FOREIGN_HOST, mctpc: "wrongpc1" },
      },
    ];

    for (const rejectedCase of rejectedCases) {
      it(`rejects ${rejectedCase.name}`, async function () {
        if (!serverAvailable) {
          this.skip();
          return;
        }

        const response = await requestMcp(
          TEST_PORT,
          rejectedCase.method,
          rejectedCase.headers,
          rejectedCase.method === "POST" ? INITIALIZE_REQUEST : undefined
        );

        expect(response.status).to.equal(403);
        expect(response.body).to.match(/^Forbidden/);
      });
    }
  });

  describe("MCP Streamable HTTP Connection", function () {
    it("should initialize MCP session over HTTP without auth from localhost", async function () {
      if (!serverAvailable) {
        this.skip();
        return;
      }

      // Create a Streamable HTTP transport targeting the /mcp endpoint. The SDK client sends
      // Host: localhost:<port> and no Origin, like other MCP clients that aren't browsers.
      transport = new StreamableHTTPClientTransport(new URL(MCP_URL));

      client = new Client(
        {
          name: "mcp-http-test-client",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      // This should succeed without any auth headers (localhost bypass)
      await client.connect(transport);
      console.log("MCP HTTP client connected successfully");
    });

    it("should list available tools", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const toolsResult = await client.listTools();
      expect(toolsResult).to.have.property("tools");
      expect(toolsResult.tools).to.be.an("array");
      expect(toolsResult.tools.length).to.be.greaterThan(0);

      // Check for some expected tools
      const toolNames = toolsResult.tools.map((t: any) => t.name);
      console.log(`Found ${toolNames.length} tools: ${toolNames.slice(0, 10).join(", ")}...`);

      expect(toolNames).to.include("createProject");
      expect(toolNames).to.include("validateContent");
      expect(toolNames).to.include("designModel");
      expect(toolNames).to.include("getModelTemplates");
    });

    it("should list available prompts", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const promptsResult = await client.listPrompts();
      expect(promptsResult).to.have.property("prompts");
      expect(promptsResult.prompts).to.be.an("array");

      const promptNames = promptsResult.prompts.map((p: any) => p.name);
      console.log(`Found ${promptNames.length} prompts: ${promptNames.join(", ")}`);

      expect(promptNames).to.include("working-folder");
    });

    it("should list available resources", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const resourcesResult = await client.listResources();
      expect(resourcesResult).to.have.property("resources");
      expect(resourcesResult.resources).to.be.an("array");

      console.log(`Found ${resourcesResult.resources.length} resources`);
    });

    it("should call getModelTemplates tool", async function () {
      if (!serverAvailable || !client) {
        this.skip();
        return;
      }

      const result = await client.callTool({
        name: "getModelTemplates",
        arguments: { templateType: "slime" },
      });

      expect(result).to.have.property("content");
      expect(result.content).to.be.an("array");
      expect(result.content.length).to.be.greaterThan(0);
      console.log("getModelTemplates call succeeded");
    });
  });

  // A connected session's ID doesn't let a web page through: the Host and Origin checks run
  // first on every request.
  describe("Host and Origin checks on a connected session", function () {
    function callToolHeaders(extraHeaders: http.OutgoingHttpHeaders): http.OutgoingHttpHeaders {
      return {
        "mcp-session-id": transport!.sessionId!,
        ...(transport!.protocolVersion ? { "mcp-protocol-version": transport!.protocolVersion } : {}),
        ...extraHeaders,
      };
    }

    const callTool = {
      jsonrpc: "2.0",
      id: 101,
      method: "tools/call",
      params: { name: "getModelTemplates", arguments: { templateType: "slime" } },
    };

    it("rejects a tool call with a foreign Origin", async function () {
      if (!serverAvailable || !transport?.sessionId) {
        this.skip();
        return;
      }

      const response = await requestMcp(TEST_PORT, "POST", callToolHeaders({ origin: FOREIGN_ORIGIN }), callTool);

      expect(response.status).to.equal(403);
      expect(response.body).to.not.contain('"result"');
    });

    it("rejects a tool call with a foreign Host", async function () {
      if (!serverAvailable || !transport?.sessionId) {
        this.skip();
        return;
      }

      const response = await requestMcp(TEST_PORT, "POST", callToolHeaders({ host: FOREIGN_HOST }), callTool);

      expect(response.status).to.equal(403);
      expect(response.body).to.not.contain('"result"');
    });

    it("runs a tool call from the server's own origin", async function () {
      if (!serverAvailable || !transport?.sessionId) {
        this.skip();
        return;
      }

      const response = await requestMcp(
        TEST_PORT,
        "POST",
        callToolHeaders({ origin: `http://localhost:${TEST_PORT}` }),
        callTool
      );

      expect(response.status).to.equal(200);
      expect(response.body).to.contain('"result"');
    });

    // serve runs on TEST_PORT, so the default CORS origin (localhost:6126) is another local
    // page. A page from a CORS origin connects over loopback too, so it must send a passcode.
    it("asks a tool call from a CORS origin for a passcode", async function () {
      if (!serverAvailable || !transport?.sessionId) {
        this.skip();
        return;
      }

      const response = await requestMcp(
        TEST_PORT,
        "POST",
        callToolHeaders({ origin: "http://localhost:6126" }),
        callTool
      );

      expect(response.status).to.equal(401);
      expect(response.body).to.not.contain('"result"');
    });

    it("runs a tool call from a CORS origin with a passcode", async function () {
      if (!serverAvailable || !transport?.sessionId) {
        this.skip();
        return;
      }

      const response = await requestMcp(
        TEST_PORT,
        "POST",
        callToolHeaders({ origin: "http://localhost:6126", mctpc: ADMIN_PASSCODE }),
        callTool
      );

      expect(response.status).to.equal(200);
      expect(response.body).to.contain('"result"');
    });
  });

  describe("Multiple Sessions", function () {
    it("should reject a second session since the server uses a single transport", async function () {
      if (!serverAvailable) {
        this.skip();
        return;
      }

      // The MCP server uses a single StreamableHTTPServerTransport instance,
      // so a second client attempting to initialize should be rejected.
      const transport2 = new StreamableHTTPClientTransport(new URL(MCP_URL));
      const client2 = new Client(
        {
          name: "mcp-http-test-client-2",
          version: "1.0.0",
        },
        {
          capabilities: {},
        }
      );

      let connectionFailed = false;
      try {
        await client2.connect(transport2);
      } catch {
        connectionFailed = true;
      }

      expect(connectionFailed).to.equal(true, "Second session should be rejected by single-transport server");
      console.log("Second session correctly rejected by single-transport server");
    });
  });
});

/**
 * Waits for a spawned command to print a line matching `pattern`, and returns the pattern's first
 * capture group as a number (the port). Returns undefined if the command exits or times out first.
 */
function waitForPortInOutput(child: ChildProcess, pattern: RegExp, timeoutMs: number): Promise<number | undefined> {
  return new Promise((resolve) => {
    let output = "";

    const finish = (port: number | undefined) => {
      clearTimeout(timer);
      child.stdout?.off("data", onData);
      child.stderr?.off("data", onData);
      child.off("exit", onExit);
      if (port === undefined) {
        console.log(`Command output before it failed to start:\n${output}`);
      }
      resolve(port);
    };

    const onData = (data: Buffer) => {
      output += data.toString();
      const match = output.match(pattern);
      if (match) {
        finish(Number(match[1]));
      }
    };

    const onExit = () => finish(undefined);
    const timer = setTimeout(() => finish(undefined), timeoutMs);

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", onExit);
  });
}

/**
 * Checks a response the way a browser's CORS check would, for a credentialed request from
 * `origin` that sends `requestHeaders`.
 */
function expectCorsAllows(response: IRawResponse, origin: string, requestHeaders: string[] = []) {
  expect(response.headers["access-control-allow-origin"]).to.equal(origin);
  expect(response.headers["access-control-allow-credentials"]).to.equal("true");

  const allowedHeaders = String(response.headers["access-control-allow-headers"])
    .split(",")
    .map((header) => header.trim().toLowerCase());
  expect(allowedHeaders).to.include.members(requestHeaders);
}

// A browser page from a CORS origin calls MCP with a passcode. The checks follow the browser's
// CORS rules: each request with non-safelisted headers needs a preflight that allows them, and
// each response must name the page's origin.
describe("MCP from a browser page on a CORS origin", function () {
  this.timeout(120000);

  const port = 16226;
  // serve always allows its default CORS origins, and this port makes them another page's.
  const corsOrigin = "http://localhost:6126";

  let serverProcess: ChildProcess | undefined;
  let dataDir: string | undefined;
  let sessionId: string | undefined;
  let protocolVersion: string | undefined;

  function pageHeaders(extraHeaders: http.OutgoingHttpHeaders = {}): http.OutgoingHttpHeaders {
    return {
      host: `localhost:${port}`,
      origin: corsOrigin,
      mctpc: ADMIN_PASSCODE,
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      ...(protocolVersion ? { "mcp-protocol-version": protocolVersion } : {}),
      ...extraHeaders,
    };
  }

  function preflight(requestHeaders: string[]): Promise<IRawResponse> {
    return requestMcp(port, "OPTIONS", {
      host: `localhost:${port}`,
      origin: corsOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": requestHeaders.join(", "),
    });
  }

  before(async function () {
    if (!fs.existsSync(CLI_PATH)) {
      console.log(`CLI tool not found at ${CLI_PATH} - skipping browser CORS tests`);
      this.skip();
      return;
    }

    dataDir = createDataDir();
    serverProcess = spawn("node", [CLI_PATH, "serve", "--port", String(port), "--adminpc", ADMIN_PASSCODE], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, MCTOOLS_DATA_DIR: dataDir },
    });

    if (!(await waitForServer(port, 30000))) {
      throw new Error("mct serve didn't start its web server.");
    }
  });

  after(async function () {
    await stopProcess(serverProcess);

    if (dataDir) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it("initializes after a preflight", async function () {
    const preflightResponse = await preflight(["content-type", "mctpc"]);
    expect(preflightResponse.status).to.equal(204);
    expectCorsAllows(preflightResponse, corsOrigin, ["content-type", "mctpc"]);

    const response = await requestMcp(port, "POST", pageHeaders(), INITIALIZE_REQUEST);
    expect(response.status).to.equal(200);
    expectCorsAllows(response, corsOrigin);
    expect(String(response.headers["access-control-expose-headers"])).to.contain("mcp-session-id");

    sessionId = response.headers["mcp-session-id"] as string;
    protocolVersion = response.body.match(/"protocolVersion":"([^"]+)"/)?.[1];
    expect(sessionId).to.be.a("string");
    expect(protocolVersion).to.be.a("string");
  });

  it("calls a tool on the session after a preflight", async function () {
    if (!sessionId) {
      this.skip();
      return;
    }

    const requestHeaders = ["content-type", "mctpc", "mcp-session-id", "mcp-protocol-version"];
    const preflightResponse = await preflight(requestHeaders);
    expect(preflightResponse.status).to.equal(204);
    expectCorsAllows(preflightResponse, corsOrigin, requestHeaders);

    const initialized = await requestMcp(port, "POST", pageHeaders(), {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(initialized.status).to.equal(202);
    expectCorsAllows(initialized, corsOrigin);

    const response = await requestMcp(port, "POST", pageHeaders(), {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "getModelTemplates", arguments: { templateType: "slime" } },
    });
    expect(response.status).to.equal(200);
    expectCorsAllows(response, corsOrigin);
    expect(response.body).to.contain('"result"');
  });

  it("asks the page for a passcode, in a response it can read", async function () {
    const headers = pageHeaders();
    delete headers.mctpc;

    const response = await requestMcp(port, "POST", headers, INITIALIZE_REQUEST);

    expect(response.status).to.equal(401);
    expectCorsAllows(response, corsOrigin);
  });

  it("still rejects a page from a foreign origin with the passcode", async function () {
    const response = await requestMcp(port, "POST", pageHeaders({ origin: FOREIGN_ORIGIN }), INITIALIZE_REQUEST);

    expect(response.status).to.equal(403);
  });
});

// view and edit start their own web servers. Their web UI doesn't use MCP, so they don't serve /mcp.
describe("MCP endpoint on view and edit", function () {
  this.timeout(120000);

  const commands = [
    { name: "view", readyPattern: /Starting content viewer server on http:\/\/localhost:(\d+)/ },
    { name: "edit", readyPattern: /Starting content editor server on http:\/\/localhost:(\d+)/ },
  ];

  for (const command of commands) {
    describe(`mct ${command.name}`, function () {
      let child: ChildProcess | undefined;
      let dataDir: string | undefined;
      let contentDir: string | undefined;
      let port: number | undefined;

      before(async function () {
        if (!fs.existsSync(CLI_PATH)) {
          console.log(`CLI tool not found at ${CLI_PATH} - skipping mct ${command.name} tests`);
          this.skip();
          return;
        }

        dataDir = createDataDir();
        contentDir = fs.mkdtempSync(path.join(os.tmpdir(), "mct-mcp-http-content-"));

        child = spawn("node", [CLI_PATH, command.name, "-i", contentDir], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, MCTOOLS_DATA_DIR: dataDir, MCT_NO_OPEN_BROWSER: "1" },
        });

        port = await waitForPortInOutput(child, command.readyPattern, 60000);
        if (port === undefined || !(await waitForServer(port, 30000))) {
          throw new Error(`mct ${command.name} didn't start its web server.`);
        }
      });

      after(async function () {
        await stopProcess(child);

        for (const folder of [dataDir, contentDir]) {
          if (folder) {
            fs.rmSync(folder, { recursive: true, force: true });
          }
        }
      });

      for (const method of ["POST", "GET", "DELETE", "OPTIONS"]) {
        it(`returns 404 for ${method} /mcp`, async function () {
          const response = await requestMcp(port!, method, {}, method === "POST" ? INITIALIZE_REQUEST : undefined);

          expect(response.status).to.equal(404);
        });
      }
    });
  }
});
