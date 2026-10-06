// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Host and Origin checks for the MCP endpoint that `mct serve` offers at /mcp.
 *
 * Checking that a connection comes from 127.0.0.1 doesn't keep web pages away from a local
 * server, because the user's own browser connects from 127.0.0.1 too:
 *
 * - DNS rebinding: a page's host name can be made to resolve to 127.0.0.1. The browser then
 *   treats requests to the local server as same-origin, but they still carry the page's host
 *   name in the Host header.
 * - Cross-site requests: a page on another origin can send requests to http://localhost:<port>.
 *   The browser adds an Origin header naming that page.
 *
 * The MCP Streamable HTTP transport spec requires servers to validate Origin for this reason.
 * HttpServer runs check() on every /mcp request, for every method including OPTIONS, before it
 * answers preflights, checks passcodes, reads the body, or starts the MCP server:
 *
 * - Host must be localhost, 127.0.0.1, [::1], or the configured host name, with a port the
 *   server is listening on. The port can be left out when it's the protocol's default.
 *   Exception: when the server is bound to every interface (0.0.0.0 or ::, as in the Docker
 *   images), it can't know the names remote clients use to reach it, such as LAN addresses,
 *   DNS names, or mapped ports. Requests over non-loopback connections must authenticate
 *   anyway, so there only loopback connections, which can skip authentication, need a known
 *   Host.
 * - Origin, when present, must be one of the server's own origins or an additional allowed
 *   origin (HttpServer passes its CORS origins). Requests without an Origin header, which is
 *   how MCP clients that aren't browsers connect, are allowed.
 * - check() also reports when the Origin is an additional one. HttpServer makes those requests
 *   authenticate even over a loopback connection: a browser connects from 127.0.0.1 wherever
 *   its page came from, so only clients that aren't browsers and the server's own pages get the
 *   loopback exemption.
 *
 * Header values are compared case-insensitively. Everything else must match exactly.
 */

/** The request headers the checks read. Node's http.IncomingHttpHeaders has this shape. */
export interface IMcpRequestHeaders {
  host?: string;
  origin?: string;
}

/** A protocol and port that a server is listening on. */
export interface IListeningEndpoint {
  protocol: "http" | "https";
  port: number;
}

export interface IMcpRequestGuardOptions {
  /** The host the server was configured to bind to, such as the `--domain` name. */
  configuredHost?: string;
  /** Protocols and ports the server is listening on. */
  endpoints: IListeningEndpoint[];
  /** Origins to allow in addition to the server's own, such as configured CORS origins. */
  additionalOrigins?: string[];
  /** True when the request didn't arrive over a loopback connection, so it must authenticate. */
  remoteConnection?: boolean;
}

export interface IMcpRequestCheckResult {
  /** Why the request must be rejected, or undefined when its Host and Origin are allowed. */
  rejection?: string;
  /**
   * True when the Origin is one of the additional origins rather than the server's own, so the
   * request must authenticate even over a loopback connection.
   */
  fromAdditionalOrigin: boolean;
}

const DEFAULT_PORTS: { [protocol: string]: number } = { http: 80, https: 443 };

/** Host names that always refer to the local machine. */
const LOOPBACK_HOST_NAMES = ["localhost", "127.0.0.1", "[::1]"];

/** Bind addresses that mean "every interface". Clients don't send these as a host name. */
const WILDCARD_HOST_NAMES = ["0.0.0.0", "[::]"];

export default class McpRequestGuard {
  /** Checks a request to /mcp: whether to reject it, and whether it must authenticate. */
  static check(headers: IMcpRequestHeaders, options: IMcpRequestGuardOptions): IMcpRequestCheckResult {
    const hostNames = McpRequestGuard.getHostNames(options.configuredHost);
    const checksHost = !(options.remoteConnection && McpRequestGuard.isWildcardHost(options.configuredHost));

    const host = headers.host?.trim().toLowerCase();
    if (checksHost && (!host || !McpRequestGuard.getAllowedHosts(hostNames, options.endpoints).has(host))) {
      return { rejection: "Forbidden: the Host header doesn't name this server.", fromAdditionalOrigin: false };
    }

    // An empty value is treated like a missing header. Browsers never send one: they send a
    // serialized origin, or "null" for opaque origins such as sandboxed frames, which is rejected.
    const origin = headers.origin?.trim().toLowerCase();
    if (!origin || McpRequestGuard.getOwnOrigins(hostNames, options.endpoints).has(origin)) {
      return { fromAdditionalOrigin: false };
    }

    if (McpRequestGuard.getAdditionalOrigins(options.additionalOrigins).has(origin)) {
      return { fromAdditionalOrigin: true };
    }

    return { rejection: "Forbidden: requests from this Origin aren't allowed.", fromAdditionalOrigin: false };
  }

  /** Whether the configured host binds every interface (0.0.0.0 or ::) rather than naming a host. */
  static isWildcardHost(configuredHost?: string): boolean {
    const hostName = McpRequestGuard._normalizeHostName(configuredHost);

    return hostName !== undefined && WILDCARD_HOST_NAMES.includes(hostName);
  }

  /**
   * Host names a client can use to reach the server: the loopback names, plus the configured
   * host when it names a specific host rather than every interface.
   */
  static getHostNames(configuredHost?: string): string[] {
    const hostNames = [...LOOPBACK_HOST_NAMES];
    const configured = McpRequestGuard._normalizeHostName(configuredHost);

    if (configured && !hostNames.includes(configured) && !WILDCARD_HOST_NAMES.includes(configured)) {
      hostNames.push(configured);
    }

    return hostNames;
  }

  /** Lowercases a host name and puts an IPv6 address in brackets, as Host headers and URLs do. */
  private static _normalizeHostName(hostName?: string): string | undefined {
    let normalized = hostName?.trim().toLowerCase();

    if (normalized && normalized.includes(":") && !normalized.startsWith("[")) {
      normalized = "[" + normalized + "]";
    }

    return normalized || undefined;
  }

  /** Host header values that name one of the host names on one of the endpoints. */
  static getAllowedHosts(hostNames: string[], endpoints: IListeningEndpoint[]): Set<string> {
    const hosts = new Set<string>();

    for (const endpoint of endpoints) {
      for (const hostName of hostNames) {
        hosts.add(hostName + ":" + endpoint.port);

        if (endpoint.port === DEFAULT_PORTS[endpoint.protocol]) {
          hosts.add(hostName);
        }
      }
    }

    return hosts;
  }

  /** The server's own origins: each host name on each endpoint. */
  static getOwnOrigins(hostNames: string[], endpoints: IListeningEndpoint[]): Set<string> {
    const origins = new Set<string>();

    for (const endpoint of endpoints) {
      const portSuffix = endpoint.port === DEFAULT_PORTS[endpoint.protocol] ? "" : ":" + endpoint.port;

      for (const hostName of hostNames) {
        origins.add(endpoint.protocol + "://" + hostName + portSuffix);
      }
    }

    return origins;
  }

  /** The additional origins, normalized. "null" is never allowed. */
  static getAdditionalOrigins(additionalOrigins: string[] = []): Set<string> {
    const origins = new Set<string>();

    for (const additionalOrigin of additionalOrigins) {
      const origin = additionalOrigin.trim().toLowerCase().replace(/\/+$/, "");

      if (origin && origin !== "null") {
        origins.add(origin);
      }
    }

    return origins;
  }
}
