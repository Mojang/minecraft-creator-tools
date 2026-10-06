// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Unit tests for McpRequestGuard, the Host and Origin checks that HttpServer runs on every
 * request to the MCP endpoint (/mcp) before it authenticates the request or starts MCP.
 */

import { expect } from "chai";
import "mocha";
import McpRequestGuard, { IMcpRequestGuardOptions, IMcpRequestHeaders } from "../local/McpRequestGuard";

/** A server on localhost:6200 with the default CORS origins, like `mct serve --port 6200`. */
const LOCAL_SERVER: IMcpRequestGuardOptions = {
  configuredHost: "localhost",
  endpoints: [{ protocol: "http", port: 6200 }],
  additionalOrigins: ["http://localhost:6126", "http://127.0.0.1:6126"],
};

/** A server bound to a domain on the default ports, with HTTPS and a configured CORS origin. */
const DOMAIN_SERVER: IMcpRequestGuardOptions = {
  configuredHost: "Tools.Example.com",
  endpoints: [
    { protocol: "http", port: 80 },
    { protocol: "https", port: 443 },
  ],
  additionalOrigins: ["https://Editor.Example.com/"],
};

/** A server bound to every interface, as in the Docker images. */
const WILDCARD_SERVER: IMcpRequestGuardOptions = {
  configuredHost: "0.0.0.0",
  endpoints: [{ protocol: "http", port: 6126 }],
};

/** The same server, for a request over a non-loopback connection, which must authenticate. */
const WILDCARD_REMOTE: IMcpRequestGuardOptions = { ...WILDCARD_SERVER, remoteConnection: true };

describe("McpRequestGuard", () => {
  describe("check", () => {
    const cases: {
      name: string;
      server: IMcpRequestGuardOptions;
      headers: IMcpRequestHeaders;
      rejected?: "Host" | "Origin";
      /** Allowed, but from an additional origin, so the request must authenticate. */
      additionalOrigin?: boolean;
    }[] = [
      // Local MCP clients that aren't browsers send Host and no Origin.
      { name: "allows localhost with no Origin", server: LOCAL_SERVER, headers: { host: "localhost:6200" } },
      { name: "allows 127.0.0.1", server: LOCAL_SERVER, headers: { host: "127.0.0.1:6200" } },
      { name: "allows [::1]", server: LOCAL_SERVER, headers: { host: "[::1]:6200" } },
      { name: "compares Host case-insensitively", server: LOCAL_SERVER, headers: { host: "LocalHost:6200" } },
      {
        name: "treats an empty Origin as missing",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "" },
      },
      {
        name: "allows the server's own origin",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "http://localhost:6200" },
      },
      {
        name: "allows the server's own origin through 127.0.0.1",
        server: LOCAL_SERVER,
        headers: { host: "127.0.0.1:6200", origin: "http://127.0.0.1:6200" },
      },
      {
        name: "allows a CORS origin as an additional origin",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "http://localhost:6126" },
        additionalOrigin: true,
      },
      {
        name: "treats a CORS origin that is also the server's own as its own",
        server: { ...LOCAL_SERVER, endpoints: [{ protocol: "http", port: 6126 }] },
        headers: { host: "localhost:6126", origin: "http://localhost:6126" },
      },

      // DNS rebinding: the request reaches 127.0.0.1, but Host names the page's own host.
      {
        name: "rejects a foreign host",
        server: LOCAL_SERVER,
        headers: { host: "attacker.example:6200" },
        rejected: "Host",
      },
      {
        name: "rejects a foreign host even with a local Origin",
        server: LOCAL_SERVER,
        headers: { host: "attacker.example:6200", origin: "http://localhost:6200" },
        rejected: "Host",
      },
      { name: "rejects a missing Host", server: LOCAL_SERVER, headers: {}, rejected: "Host" },
      {
        name: "rejects a host on another port",
        server: LOCAL_SERVER,
        headers: { host: "localhost:9999" },
        rejected: "Host",
      },
      {
        name: "rejects a host without the port",
        server: LOCAL_SERVER,
        headers: { host: "localhost" },
        rejected: "Host",
      },
      {
        name: "rejects a trailing-dot host",
        server: LOCAL_SERVER,
        headers: { host: "localhost.:6200" },
        rejected: "Host",
      },
      {
        name: "rejects a host that only starts with an allowed one",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200.attacker.example" },
        rejected: "Host",
      },

      // Cross-site requests: the browser names the page's origin.
      {
        name: "rejects a foreign Origin",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "https://attacker.example" },
        rejected: "Origin",
      },
      {
        name: "rejects the opaque null Origin",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "null" },
        rejected: "Origin",
      },
      {
        name: "rejects another local port's Origin",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "http://localhost:3000" },
        rejected: "Origin",
      },
      {
        name: "rejects the server's host over another scheme",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "https://localhost:6200" },
        rejected: "Origin",
      },
      {
        name: "rejects a list of origins",
        server: LOCAL_SERVER,
        headers: { host: "localhost:6200", origin: "http://localhost:6200, https://attacker.example" },
        rejected: "Origin",
      },

      // A server bound to a domain on the default ports.
      {
        name: "allows the domain without a default port",
        server: DOMAIN_SERVER,
        headers: { host: "tools.example.com" },
      },
      {
        name: "allows the domain with the HTTPS port",
        server: DOMAIN_SERVER,
        headers: { host: "tools.example.com:443" },
      },
      {
        name: "allows the domain's HTTPS origin",
        server: DOMAIN_SERVER,
        headers: { host: "tools.example.com", origin: "https://tools.example.com" },
      },
      {
        name: "allows a configured CORS origin, normalized, as an additional origin",
        server: DOMAIN_SERVER,
        headers: { host: "tools.example.com", origin: "https://editor.example.com" },
        additionalOrigin: true,
      },
      { name: "still allows localhost", server: DOMAIN_SERVER, headers: { host: "localhost" } },
      { name: "rejects another domain", server: DOMAIN_SERVER, headers: { host: "example.com" }, rejected: "Host" },

      // A wildcard bind address isn't a host name clients use.
      { name: "allows localhost when bound to 0.0.0.0", server: WILDCARD_SERVER, headers: { host: "localhost:6126" } },
      {
        name: "rejects 0.0.0.0 as a host name",
        server: WILDCARD_SERVER,
        headers: { host: "0.0.0.0:6126" },
        rejected: "Host",
      },

      // A server bound to every interface can't know the names remote clients use, and those
      // clients must authenticate, so only loopback connections need a known Host there.
      {
        name: "allows a DNS name over a remote connection to 0.0.0.0",
        server: WILDCARD_REMOTE,
        headers: { host: "my-server.example:6126" },
      },
      {
        name: "allows a mapped port over a remote connection to 0.0.0.0",
        server: WILDCARD_REMOTE,
        headers: { host: "localhost:8080" },
      },
      {
        name: "allows a DNS name over a remote connection to ::",
        server: { configuredHost: "::", endpoints: [{ protocol: "http", port: 6126 }], remoteConnection: true },
        headers: { host: "my-server.example:6126" },
      },
      {
        name: "still checks Origin over a remote connection to 0.0.0.0",
        server: WILDCARD_REMOTE,
        headers: { host: "my-server.example:6126", origin: "https://attacker.example" },
        rejected: "Origin",
      },
      {
        name: "still checks Host over a loopback connection to 0.0.0.0",
        server: WILDCARD_SERVER,
        headers: { host: "rebind.attacker.example:6126" },
        rejected: "Host",
      },
      {
        name: "still checks Host over a remote connection to a named host",
        server: { ...DOMAIN_SERVER, remoteConnection: true },
        headers: { host: "rebind.attacker.example" },
        rejected: "Host",
      },
      {
        name: "still checks Host over a loopback connection to ::",
        server: { configuredHost: "::", endpoints: [{ protocol: "http", port: 6126 }] },
        headers: { host: "rebind.attacker.example:6126" },
        rejected: "Host",
      },
    ];

    for (const testCase of cases) {
      it(testCase.name, () => {
        const result = McpRequestGuard.check(testCase.headers, testCase.server);

        if (testCase.rejected) {
          expect(result.rejection).to.be.a("string");
          expect(result.rejection).to.contain(testCase.rejected);
        } else {
          expect(result.rejection).to.equal(undefined);
          expect(result.fromAdditionalOrigin).to.equal(testCase.additionalOrigin === true);
        }
      });
    }

    it("rejects every request when the server isn't listening yet", () => {
      expect(McpRequestGuard.check({ host: "localhost:6200" }, { endpoints: [] }).rejection).to.contain("Host");
    });
  });

  describe("getHostNames", () => {
    const cases: { configuredHost: string | undefined; expected: string[] }[] = [
      { configuredHost: undefined, expected: ["localhost", "127.0.0.1", "[::1]"] },
      { configuredHost: "localhost", expected: ["localhost", "127.0.0.1", "[::1]"] },
      { configuredHost: " Tools.Example.com ", expected: ["localhost", "127.0.0.1", "[::1]", "tools.example.com"] },
      { configuredHost: "192.168.1.20", expected: ["localhost", "127.0.0.1", "[::1]", "192.168.1.20"] },
      { configuredHost: "::1", expected: ["localhost", "127.0.0.1", "[::1]"] },
      { configuredHost: "fe80::1", expected: ["localhost", "127.0.0.1", "[::1]", "[fe80::1]"] },
      { configuredHost: "0.0.0.0", expected: ["localhost", "127.0.0.1", "[::1]"] },
      { configuredHost: "::", expected: ["localhost", "127.0.0.1", "[::1]"] },
    ];

    for (const testCase of cases) {
      it(`returns the host names for ${JSON.stringify(testCase.configuredHost)}`, () => {
        expect(McpRequestGuard.getHostNames(testCase.configuredHost)).to.deep.equal(testCase.expected);
      });
    }
  });
});
