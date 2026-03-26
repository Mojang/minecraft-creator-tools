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
import { ChildProcess, spawn } from "child_process";

// Path to the CLI tool (use path.resolve from CWD since __dirname is unavailable in ESM)
const CLI_PATH = path.resolve("toolbuild/jsn/cli/index.mjs");

// Port for the test server (use a non-standard port to avoid conflicts)
const TEST_PORT = 16126;
const MCP_URL = `http://localhost:${TEST_PORT}/mcp`;
const ADMIN_PASSCODE = "testmcp1";

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
      serverProcess = spawn("node", [CLI_PATH, "serve", "--port", String(TEST_PORT), "--adminpc", ADMIN_PASSCODE], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
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
        serverProcess.kill("SIGTERM");
        // Give it a moment to clean up
        await new Promise((r) => setTimeout(r, 2000));
        if (!serverProcess.killed) {
          serverProcess.kill("SIGKILL");
        }
      } catch {
        // ignore
      }
      serverProcess = undefined;
    }
  });

  describe("MCP Streamable HTTP Connection", function () {
    it("should initialize MCP session over HTTP without auth from localhost", async function () {
      if (!serverAvailable) {
        this.skip();
        return;
      }

      // Create a Streamable HTTP transport targeting the /mcp endpoint
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
