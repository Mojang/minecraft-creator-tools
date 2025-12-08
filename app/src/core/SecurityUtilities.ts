// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Security utilities for input validation and sanitization
 */
export default class SecurityUtilities {
  // Maximum upload size: 700MB
  public static readonly MAX_UPLOAD_SIZE = 700 * 1024 * 1024;

  // Maximum number of files in a ZIP
  public static readonly MAX_ZIP_FILES = 50000;

  // Maximum decompressed size: 500MB
  public static readonly MAX_DECOMPRESSED_SIZE = 500 * 1024 * 1024;

  // Rate limiting: max attempts per IP
  private static readonly authAttempts: Map<string, { count: number; resetTime: number }> = new Map();
  private static readonly MAX_AUTH_ATTEMPTS = 5;
  private static readonly AUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Validates that a path doesn't contain directory traversal sequences
   */
  public static validatePath(path: string): boolean {
    if (!path) {
      return false;
    }

    // Normalize the path
    const normalized = path.replace(/\\/g, "/");

    // Check for directory traversal patterns
    if (
      normalized.includes("../") ||
      normalized.includes("/..") ||
      normalized.startsWith("..") ||
      normalized.includes("/../") ||
      normalized.match(/[/\\]\.\./) ||
      normalized.includes("\0") // null byte
    ) {
      return false;
    }

    // Check for absolute paths
    if (
      normalized.startsWith("/") ||
      normalized.match(/^[a-zA-Z]:/) // Windows drive letter
    ) {
      return false;
    }

    return true;
  }

  /**
   * Sanitizes a path by removing dangerous characters and sequences
   */
  public static sanitizePath(path: string): string {
    if (!path) {
      return "";
    }

    // Remove null bytes
    path = path.replace(/\0/g, "");

    // Normalize slashes
    path = path.replace(/\\/g, "/");

    // Remove leading slashes and drive letters
    path = path.replace(/^[a-zA-Z]:/, "");
    path = path.replace(/^\/+/, "");

    // Split into segments and validate each
    const segments = path.split("/").filter((segment) => {
      return segment && segment !== "." && segment !== "..";
    });

    return segments.join("/");
  }

  /**
   * Validates that a file size is within acceptable limits
   */
  public static validateFileSize(size: number, maxSize: number = SecurityUtilities.MAX_UPLOAD_SIZE): boolean {
    return size > 0 && size <= maxSize;
  }

  /**
   * Validates Minecraft command input to prevent injection
   */
  public static sanitizeCommand(command: string): string {
    if (!command) {
      return "";
    }

    // Remove control characters (including newlines, carriage returns, etc.)
    command = command.replace(/[\x00-\x1F\x7F]/g, "");

    // Trim whitespace
    command = command.trim();

    // Remove leading slash if present (will be added by server)
    if (command.startsWith("/")) {
      command = command.substring(1);
    }

    return command;
  }

  /**
   * Validates that a command is safe to execute
   */
  public static isCommandSafe(command: string): boolean {
    if (!command) {
      return false;
    }

    // Check for command separators or multiple commands
    if (command.includes("\n") || command.includes("\r") || command.includes(";")) {
      return false;
    }

    // Check for excessive length
    if (command.length > 1000) {
      return false;
    }

    return true;
  }

  /**
   * Rate limiting for authentication attempts
   */
  public static checkAuthRateLimit(identifier: string): boolean {
    const now = Date.now();
    const attempt = SecurityUtilities.authAttempts.get(identifier);

    if (!attempt) {
      SecurityUtilities.authAttempts.set(identifier, { count: 1, resetTime: now + SecurityUtilities.AUTH_WINDOW_MS });
      return true;
    }

    // Reset if window has passed
    if (now > attempt.resetTime) {
      SecurityUtilities.authAttempts.set(identifier, { count: 1, resetTime: now + SecurityUtilities.AUTH_WINDOW_MS });
      return true;
    }

    // Check if under limit
    if (attempt.count < SecurityUtilities.MAX_AUTH_ATTEMPTS) {
      attempt.count++;
      return true;
    }

    return false;
  }

  /**
   * Reset rate limit for an identifier (on successful auth)
   */
  public static resetAuthRateLimit(identifier: string): void {
    SecurityUtilities.authAttempts.delete(identifier);
  }

  /**
   * Validates JSON object doesn't contain prototype pollution
   */
  public static sanitizeJsonObject(obj: any): any {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // Remove dangerous properties
    const dangerous = ["__proto__", "constructor", "prototype"];
    for (const key of dangerous) {
      if (key in obj) {
        delete obj[key];
      }
    }

    // Recursively sanitize nested objects
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        obj[key] = SecurityUtilities.sanitizeJsonObject(obj[key]);
      }
    }

    return obj;
  }

  /**
   * Generates a secure fingerprint for token binding
   */
  public static generateFingerprint(userAgent?: string, ipAddress?: string): string {
    const parts = [userAgent || "unknown", ipAddress || "unknown"];
    return parts.join("|");
  }

  /**
   * Validates that a token fingerprint matches current request
   */
  public static validateFingerprint(storedFingerprint: string, currentFingerprint: string): boolean {
    return storedFingerprint === currentFingerprint;
  }

  /**
   * Validates that a string contains only safe characters for player names
   */
  public static sanitizePlayerName(name: string): string {
    if (!name) {
      return "";
    }

    // Only allow alphanumeric, spaces, underscores, and hyphens
    return name.replace(/[^a-zA-Z0-9 _-]/g, "");
  }
}
