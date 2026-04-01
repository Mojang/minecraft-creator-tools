import * as http from "http";
import * as crypto from "crypto";
import { ServerPermissionLevel } from "./IAuthenticationToken";

export default class HttpUtilities {
  /**
   * Creates a short, human-readable request description for logging.
   * Format: [HH:MM:SS] [usr:AABBCC] METHOD /path:
   * Or with token: [HH:MM:SS] [usr:AABBCCDDEE] METHOD /path:
   * @param req The HTTP request
   * @param clientIp The client IP address (used to generate user thumbprint)
   * @param tokenThumb Optional 4-char token thumbprint to append for authenticated users
   */
  static getShortReqDescription(req: http.IncomingMessage, clientIp?: string, tokenThumb?: string) {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    let userPart = "";
    if (clientIp) {
      const ipThumb = this.getThumbprint(clientIp);
      if (this.isLocalIp(clientIp)) {
        // For local connections, show "local" instead of IP thumbprint
        userPart = tokenThumb ? `[usr:local-${tokenThumb}]` : `[usr:local]`;
      } else {
        userPart = tokenThumb ? `[usr:${ipThumb}-${tokenThumb}]` : `[usr:${ipThumb}]`;
      }
      return `[${time}] ${userPart} ${req.method} ${req.url}: `;
    }

    return `[${time}] ${req.method} ${req.url}: `;
  }

  /**
   * Creates a 6-character thumbprint from an IP address or token for session identification.
   *
   * NOTE: This is NOT password hashing - it creates a short visual identifier for display/logging.
   * SHA-256 is appropriate here as we only need a collision-resistant fingerprint.
   */
  static getThumbprint(value: string): string {
    // Not password hashing; this is only a short display thumbprint.
    const hash = crypto.createHash("sha256").update(value).digest("hex");
    return hash.substring(0, 6).toUpperCase();
  }

  /**
   * Creates a 4-character thumbprint from an identifier for appending to user identification in logs.
   *
   * NOTE: This is NOT password hashing - it creates a short visual identifier for display/logging.
   * SHA-256 is appropriate here as we only need a collision-resistant fingerprint, not a secure
   * password hash. Actual authentication uses AES-GCM encryption, not this thumbprint.
   *
   * @param identifier A unique session identifier (NOT a password) to create a thumbprint from
   */
  static getTokenThumbprint(identifier: string): string {
    // Not password hashing; this is only a short display thumbprint.
    const hash = crypto.createHash("sha256").update(identifier).digest("hex");
    return hash.substring(0, 4).toUpperCase();
  }

  /**
   * Checks if an IP address is a local/loopback address.
   */
  static isLocalIp(clientIp: string): boolean {
    return clientIp === "127.0.0.1" || clientIp === "::1" || clientIp === "::ffff:127.0.0.1";
  }

  /**
   * Formats a client IP address for display, with friendly names for local addresses.
   */
  static formatClientIp(clientIp: string): string {
    if (this.isLocalIp(clientIp)) {
      return "(local)";
    }
    return clientIp;
  }

  /**
   * Returns a human-readable name for a server permission level.
   */
  static getPermissionLevelName(level: ServerPermissionLevel): string {
    switch (level) {
      case ServerPermissionLevel.none:
        return "none";
      case ServerPermissionLevel.displayReadOnly:
        return "display-read-only";
      case ServerPermissionLevel.fullReadOnly:
        return "full-read-only";
      case ServerPermissionLevel.updateState:
        return "update-state";
      case ServerPermissionLevel.admin:
        return "admin";
      default:
        return `unknown(${level})`;
    }
  }
}
