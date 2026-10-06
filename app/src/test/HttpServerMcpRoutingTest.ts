// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Tests how HttpServer routes requests for the MCP endpoint (/mcp), on a real server listening on
 * localhost:
 *
 * - A server that doesn't opt in, which is how view, edit, and the render commands set up their
 *   servers, returns 404 for every method, including OPTIONS, before checking any passcode.
 * - On a server that opts in, as `mct serve` does, a foreign Host (DNS rebinding) or Origin
 *   (cross-site request) gets 403 for every method, including OPTIONS, whether it sends a valid
 *   passcode, an invalid one, or none. The request never reaches the MCP handler, which is
 *   what creates the MCP server and runs tools.
 * - Requests from a CORS origin, rather than the server's own, must send a passcode even over
 *   loopback. Local clients without an Origin don't need one.
 *
 * The MCP handler is replaced with a probe, so these tests check routing without starting MCP.
 * McpHttpIntegrationTest connects a real MCP client to `mct serve`. LocalEnvironment uses a
 * temporary MCTOOLS_DATA_DIR, so these tests don't touch the user's profile.
 */

import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";
import * as path from "path";
// Load CreatorToolsHost first. It loads the storage modules in an order that avoids a circular
// import failing ("Class extends value undefined") when this file runs on its own.
import "../app/CreatorToolsHost";
import CreatorTools from "../app/CreatorTools";
import HttpServer from "../local/HttpServer";
import LocalEnvironment from "../local/LocalEnvironment";
import LocalUtilities from "../local/LocalUtilities";
import ServerManager, { ServerManagerFeatures } from "../local/ServerManager";

const DATA_DIR_ENV = "MCTOOLS_DATA_DIR";
const PASSCODE = "mcproute";
const WRONG_PASSCODE = "wrongpc1";
/** A configured CORS origin, written the way a user might: mixed case, trailing slash. */
const CONFIGURED_CORS_ORIGIN_SETTING = "https://Studio.Example/";
/** The same origin as a browser sends it. */
const CONFIGURED_CORS_ORIGIN = "https://studio.example";
/** Every request header a Streamable HTTP client sends after initializing. */
const MCP_REQUEST_HEADERS = ["content-type", "mctpc", "mcp-session-id", "mcp-protocol-version", "last-event-id"];
/** Methods that reach the MCP handler when allowed. */
const MCP_METHODS = ["POST", "GET", "DELETE"];
/** Every method the checks must cover, including CORS preflights. */
const ALL_METHODS = [...MCP_METHODS, "OPTIONS"];

const INITIALIZE_REQUEST = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "routing-test", version: "1.0.0" } },
});

interface IMcpResponse {
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}

/** Headers an MCP client, or a browser's CORS preflight, sends with each method. */
function defaultHeaders(method: string): http.OutgoingHttpHeaders {
  switch (method) {
    case "POST":
      return { accept: "application/json, text/event-stream", "content-type": "application/json" };
    case "OPTIONS":
      return { "access-control-request-method": "POST", "access-control-request-headers": "content-type" };
    default:
      return { accept: "text/event-stream" };
  }
}

/** Sends a request to /mcp with an initialize body for POST, as an MCP client would. */
function requestMcp(port: number, method: string, headers: http.OutgoingHttpHeaders): Promise<IMcpResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/mcp",
        method,
        agent: false,
        headers: { ...defaultHeaders(method), ...headers },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body, headers: res.headers }));
      }
    );

    req.on("error", reject);

    if (method === "POST") {
      req.write(INITIALIZE_REQUEST);
    }

    req.end();
  });
}

/**
 * Routes a request that arrives over a non-loopback connection. Tests can't open one on every
 * machine, so this passes a stand-in request straight to processRequest.
 */
function routeRemoteRequest(
  server: HttpServer,
  remoteAddress: string,
  method: string,
  headers: http.IncomingHttpHeaders
): Promise<IMcpResponse> {
  return new Promise((resolve) => {
    let status = 0;
    const responseHeaders: http.IncomingHttpHeaders = {};
    const setHeaders = (values: http.OutgoingHttpHeaders = {}) => {
      for (const [name, value] of Object.entries(values)) {
        responseHeaders[name.toLowerCase()] = String(value);
      }
    };

    const req = { url: "/mcp", method, headers, socket: { remoteAddress } } as unknown as http.IncomingMessage;
    const res = {
      headersSent: false,
      setHeader: (name: string, value: string) => setHeaders({ [name]: value }),
      writeHead: (code: number, values?: http.OutgoingHttpHeaders) => {
        status = code;
        setHeaders(values);
        res.headersSent = true;
        return res;
      },
      end: (body?: string) => resolve({ status, body: body ?? "", headers: responseHeaders }),
    };

    server.processRequest(req, res as unknown as http.ServerResponse);
  });
}

/**
 * Checks a response the way a browser's CORS check would for a credentialed request from
 * `origin` that sends every MCP request header.
 */
function expectCorsAllows(response: IMcpResponse, origin: string) {
  expect(response.headers["access-control-allow-origin"]).to.equal(origin);
  expect(response.headers["access-control-allow-credentials"]).to.equal("true");

  const allowedHeaders = String(response.headers["access-control-allow-headers"])
    .split(",")
    .map((header) => header.trim().toLowerCase());
  expect(allowedHeaders).to.include.members(MCP_REQUEST_HEADERS);
}

describe("HttpServer MCP endpoint routing", function () {
  this.timeout(30000);

  let previousDataDir: string | undefined;
  let dataDir: string;
  let serverManager: ServerManager | undefined;
  let httpServer: HttpServer;
  let port: number;
  let local: string;
  let handledMethods: string[] = [];

  before(async function () {
    previousDataDir = process.env[DATA_DIR_ENV];
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "mct-mcp-routing-"));
    process.env[DATA_DIR_ENV] = dataDir;

    const foundPort = await LocalUtilities.findAvailablePort(16400, 16499, "localhost");
    if (!foundPort) {
      throw new Error("No free port in 16400-16499 for the MCP routing tests.");
    }
    port = foundPort;
    local = "localhost:" + port;

    const localEnv = new LocalEnvironment(false);
    localEnv.setAdminPasscodeAndRandomizeComplement(PASSCODE);
    localEnv.serverHostPort = port;
    localEnv.allowedCorsOrigins = [CONFIGURED_CORS_ORIGIN_SETTING];

    // Set up the way view, edit, and the render commands set up their servers. HttpServer only
    // uses CreatorTools once a request reaches the MCP handler, which these tests replace.
    serverManager = new ServerManager(localEnv, {} as CreatorTools);
    serverManager.features = ServerManagerFeatures.all;
    httpServer = serverManager.ensureHttpServer();
    await httpServer.waitForReady(10000);

    // Like the real handler, the probe applies the CORS headers routing passes to it.
    (httpServer as any)._handleMcpRequest = async (
      req: http.IncomingMessage,
      res: http.ServerResponse,
      corsHeaders: { [key: string]: string }
    ) => {
      handledMethods.push(req.method || "");
      res.writeHead(200, { ...corsHeaders, "Content-Type": "text/plain" });
      res.end("handled");
    };
  });

  after(async function () {
    if (serverManager) {
      await serverManager.stopWebServer("MCP routing tests complete");
    }

    if (previousDataDir === undefined) {
      delete process.env[DATA_DIR_ENV];
    } else {
      process.env[DATA_DIR_ENV] = previousDataDir;
    }

    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(function () {
    handledMethods = [];
  });

  describe("on a server that doesn't offer MCP", function () {
    it("doesn't offer MCP by default", function () {
      expect(httpServer.isMcpEnabled()).to.equal(false);
    });

    for (const method of ALL_METHODS) {
      it(`returns 404 for ${method} /mcp`, async function () {
        const response = await requestMcp(port, method, { host: local });

        expect(response.status).to.equal(404);
        expect(handledMethods).to.deep.equal([]);
      });
    }

    it("returns 404 for /mcp before checking a passcode", async function () {
      const response = await requestMcp(port, "POST", { host: local, mctpc: WRONG_PASSCODE });

      expect(response.status).to.equal(404);
      expect(handledMethods).to.deep.equal([]);
    });
  });

  describe("on a server that offers MCP", function () {
    before(function () {
      httpServer.setMcpEnabled(true);
    });

    afterEach(function () {
      httpServer.setMcpRequireAuth(false);
    });

    for (const method of MCP_METHODS) {
      it(`hands ${method} from a local client without an Origin to MCP`, async function () {
        const response = await requestMcp(port, method, { host: local });

        expect(response.status).to.equal(200);
        expect(handledMethods).to.deep.equal([method]);
      });
    }

    it("answers a preflight from a configured CORS origin with every MCP request header allowed", async function () {
      const response = await requestMcp(port, "OPTIONS", {
        host: local,
        origin: CONFIGURED_CORS_ORIGIN,
        "access-control-request-headers": MCP_REQUEST_HEADERS.join(", "),
      });

      expect(response.status).to.equal(204);
      expectCorsAllows(response, CONFIGURED_CORS_ORIGIN);
      expect(String(response.headers["access-control-allow-methods"])).to.contain("POST");
      expect(handledMethods).to.deep.equal([]);
    });

    const allowedCases: { name: string; headers: () => http.OutgoingHttpHeaders }[] = [
      { name: "the 127.0.0.1 host", headers: () => ({ host: "127.0.0.1:" + port }) },
      { name: "the server's own origin", headers: () => ({ host: local, origin: "http://" + local }) },
    ];

    for (const allowedCase of allowedCases) {
      it(`hands a request with ${allowedCase.name} to MCP`, async function () {
        const response = await requestMcp(port, "POST", allowedCase.headers());

        expect(response.status).to.equal(200);
        expect(handledMethods).to.deep.equal(["POST"]);
      });
    }

    // A page from a CORS origin connects over loopback too, so CORS origins don't get the
    // loopback exemption. That includes the default localhost:6126 origins on another port.
    const corsOrigins = [
      { name: "a configured CORS origin", origin: CONFIGURED_CORS_ORIGIN },
      { name: "a default CORS origin on another port", origin: "http://localhost:6126" },
    ];

    for (const corsOrigin of corsOrigins) {
      for (const method of MCP_METHODS) {
        it(`asks ${method} from ${corsOrigin.name} for a passcode`, async function () {
          const response = await requestMcp(port, method, { host: local, origin: corsOrigin.origin });

          expect(response.status).to.equal(401);
          expectCorsAllows(response, corsOrigin.origin);
          expect(handledMethods).to.deep.equal([]);
        });
      }

      it(`hands a request from ${corsOrigin.name} with a passcode to MCP`, async function () {
        const response = await requestMcp(port, "POST", { host: local, origin: corsOrigin.origin, mctpc: PASSCODE });

        expect(response.status).to.equal(200);
        expectCorsAllows(response, corsOrigin.origin);
        expect(handledMethods).to.deep.equal(["POST"]);
      });
    }

    // The passcode cases check that a disallowed host or origin gets the same 403 whether its
    // passcode is valid or not, so a web page can't use /mcp to test passcodes.
    const rejectedCases: { name: string; headers: () => http.OutgoingHttpHeaders }[] = [
      { name: "a foreign Host", headers: () => ({ host: "rebind.attacker.example:" + port }) },
      { name: "a foreign Origin", headers: () => ({ host: local, origin: "https://attacker.example" }) },
      { name: "the null Origin", headers: () => ({ host: local, origin: "null" }) },
      { name: "another local port's Origin", headers: () => ({ host: local, origin: "http://localhost:3000" }) },
      {
        name: "a foreign Host and a valid passcode",
        headers: () => ({ host: "rebind.attacker.example:" + port, mctpc: PASSCODE }),
      },
      {
        name: "a foreign Host and an invalid passcode",
        headers: () => ({ host: "rebind.attacker.example:" + port, mctpc: WRONG_PASSCODE }),
      },
      {
        name: "a foreign Origin and a valid passcode",
        headers: () => ({ host: local, origin: "https://attacker.example", mctpc: PASSCODE }),
      },
      {
        name: "a foreign Origin and an invalid passcode",
        headers: () => ({ host: local, origin: "https://attacker.example", mctpc: WRONG_PASSCODE }),
      },
    ];

    for (const rejectedCase of rejectedCases) {
      for (const method of ALL_METHODS) {
        it(`rejects ${method} with ${rejectedCase.name}`, async function () {
          const response = await requestMcp(port, method, rejectedCase.headers());

          expect(response.status).to.equal(403);
          expect(response.body).to.match(/^Forbidden/);
          expect(handledMethods).to.deep.equal([]);
        });
      }
    }

    it("rejects a local client with an invalid passcode", async function () {
      const response = await requestMcp(port, "POST", { host: local, mctpc: WRONG_PASSCODE });

      expect(response.status).to.equal(401);
      expect(handledMethods).to.deep.equal([]);
    });

    it("rejects a foreign Origin before asking for a passcode when --mcp-require-auth is set", async function () {
      httpServer.setMcpRequireAuth(true);

      const response = await requestMcp(port, "POST", { host: local, origin: "https://attacker.example" });

      expect(response.status).to.equal(403);
      expect(handledMethods).to.deep.equal([]);
    });

    it("asks a local client for a passcode when --mcp-require-auth is set", async function () {
      httpServer.setMcpRequireAuth(true);

      const response = await requestMcp(port, "POST", { host: local });

      expect(response.status).to.equal(401);
      expect(handledMethods).to.deep.equal([]);
    });

    it("hands a local client with a passcode to MCP when --mcp-require-auth is set", async function () {
      httpServer.setMcpRequireAuth(true);

      const response = await requestMcp(port, "POST", { host: local, mctpc: PASSCODE });

      expect(response.status).to.equal(200);
      expect(handledMethods).to.deep.equal(["POST"]);
    });

    describe("over a remote connection", function () {
      const remoteAddress = "192.168.1.50";

      afterEach(function () {
        httpServer.host = "localhost";
      });

      it("asks for a passcode", async function () {
        const response = await routeRemoteRequest(httpServer, remoteAddress, "POST", { host: local });

        expect(response.status).to.equal(401);
        expect(handledMethods).to.deep.equal([]);
      });

      it("rejects a host that doesn't name a server bound to a specific host, even with a passcode", async function () {
        const response = await routeRemoteRequest(httpServer, remoteAddress, "POST", {
          host: "my-server.example:" + port,
          mctpc: PASSCODE,
        });

        expect(response.status).to.equal(403);
        expect(handledMethods).to.deep.equal([]);
      });

      // A server bound to every interface can't know the names remote clients use, such as a DNS
      // name or a mapped port, so a remote client only needs its passcode.
      it("hands any host with a passcode to MCP when bound to 0.0.0.0", async function () {
        httpServer.host = "0.0.0.0";

        const response = await routeRemoteRequest(httpServer, remoteAddress, "POST", {
          host: "my-server.example:8080",
          mctpc: PASSCODE,
        });

        expect(response.status).to.equal(200);
        expect(handledMethods).to.deep.equal(["POST"]);
      });

      it("still asks for a passcode when bound to 0.0.0.0", async function () {
        httpServer.host = "0.0.0.0";

        const response = await routeRemoteRequest(httpServer, remoteAddress, "POST", {
          host: "my-server.example:8080",
        });

        expect(response.status).to.equal(401);
        expect(handledMethods).to.deep.equal([]);
      });

      it("still rejects a foreign Origin when bound to 0.0.0.0", async function () {
        httpServer.host = "0.0.0.0";

        const response = await routeRemoteRequest(httpServer, remoteAddress, "POST", {
          host: "my-server.example:8080",
          origin: "https://attacker.example",
          mctpc: PASSCODE,
        });

        expect(response.status).to.equal(403);
        expect(handledMethods).to.deep.equal([]);
      });

      it("still rejects a foreign Host over loopback when bound to 0.0.0.0", async function () {
        httpServer.host = "0.0.0.0";

        const response = await requestMcp(port, "POST", { host: "rebind.attacker.example:" + port });

        expect(response.status).to.equal(403);
        expect(handledMethods).to.deep.equal([]);
      });
    });
  });
});
