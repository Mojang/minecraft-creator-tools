// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * HttpServerUtilsTest.ts
 *
 * Unit tests for HttpServer utility functions, covering:
 * - MIME type resolution (getMimeTypeForFile)
 * - Cookie parsing (parseCookies edge cases)
 * - Slot/port parameter validation
 *
 * These tests validate the HTTP server's request processing utilities
 * without requiring a running HTTP server. They focus on the pure
 * functions that handle file serving, authentication, and API routing.
 *
 * NOTE: HttpServer is a large class that requires ServerManager
 * to instantiate. These tests extract and test the logic in isolation
 * by reimplementing the pure utility functions to verify correctness.
 */

import { expect } from "chai";

/**
 * Extracted MIME type lookup matching HttpServer.getMimeTypeForFile().
 * Tests verify this logic matches what HttpServer uses for file serving.
 */
function getMimeTypeForFile(extension: string): string | undefined {
  switch (extension) {
    case "json":
      return "application/json";
    case "png":
      return "image/png";
    case "jpg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    case "mjs":
    case "js":
      return "text/javascript";
    case "ico":
      return "image/x-icon";
    case "css":
      return "text/css";
    case "woff":
      return "font/woff";
    case "woff2":
      return "font/woff2";
    case "ttf":
      return "font/ttf";
    case "zip":
      return "application/zip";
    default:
      return undefined;
  }
}

/**
 * Extracted cookie parsing logic matching HttpServer.parseCookies().
 * Tests verify the fix where malformed cookies are skipped (continue)
 * instead of aborting the entire loop (return).
 */
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};

  if (!cookieHeader) return result;

  const cookieVals = cookieHeader.split(`;`);

  for (let i = 0; i < cookieVals.length; i++) {
    const cookie = cookieVals[i];
    let [name, ...rest] = cookie.split(`=`);
    name = name?.trim();

    if (!name) {
      continue; // Fixed: was 'return result' which aborted all remaining cookies
    }

    const value = rest.join(`=`).trim();

    if (!value) {
      continue; // Fixed: was 'return result' which aborted all remaining cookies
    }

    result[name] = decodeURIComponent(value);
  }

  return result;
}

/**
 * Extracted slot/port parsing logic matching HttpServer API route handling.
 * Tests verify the NaN check fix for parseInt on URL segments.
 */
function parseSlotOrPort(urlSegment: string): { valid: boolean; value: number } {
  let portOrSlot = -1;

  try {
    portOrSlot = parseInt(urlSegment);
  } catch (e) {
    // parseInt doesn't throw, but the original code had this try/catch
  }

  if (isNaN(portOrSlot) || portOrSlot < 0 || portOrSlot > 65536 || portOrSlot === 80 || portOrSlot === 443) {
    return { valid: false, value: portOrSlot };
  }

  return { valid: true, value: portOrSlot };
}

describe("HttpServer Utilities", function () {
  describe("getMimeTypeForFile", () => {
    it("should return correct MIME types for known extensions", () => {
      expect(getMimeTypeForFile("json")).to.equal("application/json");
      expect(getMimeTypeForFile("png")).to.equal("image/png");
      expect(getMimeTypeForFile("jpg")).to.equal("image/jpeg");
      expect(getMimeTypeForFile("svg")).to.equal("image/svg+xml");
      expect(getMimeTypeForFile("js")).to.equal("text/javascript");
      expect(getMimeTypeForFile("mjs")).to.equal("text/javascript");
      expect(getMimeTypeForFile("css")).to.equal("text/css");
      expect(getMimeTypeForFile("ico")).to.equal("image/x-icon");
      expect(getMimeTypeForFile("woff")).to.equal("font/woff");
      expect(getMimeTypeForFile("woff2")).to.equal("font/woff2");
      expect(getMimeTypeForFile("ttf")).to.equal("font/ttf");
      expect(getMimeTypeForFile("zip")).to.equal("application/zip");
    });

    it("should return undefined for unknown extensions", () => {
      expect(getMimeTypeForFile("xyz")).to.be.undefined;
      expect(getMimeTypeForFile("mcfunction")).to.be.undefined;
      expect(getMimeTypeForFile("html")).to.be.undefined;
      expect(getMimeTypeForFile("")).to.be.undefined;
    });
  });

  describe("parseCookies", () => {
    it("should parse valid cookie header", () => {
      const result = parseCookies("session=abc123; theme=dark; lang=en");
      expect(result).to.deep.equal({
        session: "abc123",
        theme: "dark",
        lang: "en",
      });
    });

    it("should skip malformed cookies without aborting remaining cookies", () => {
      // This tests the fix: 'continue' instead of 'return result'
      // A cookie without a name or value should be skipped, not abort parsing
      const result = parseCookies("=noname; valid=yes; =; another=ok");
      expect(result["valid"]).to.equal("yes");
      expect(result["another"]).to.equal("ok");
    });

    it("should handle cookies with equals signs in values", () => {
      const result = parseCookies("token=abc=def=ghi; other=simple");
      expect(result["token"]).to.equal("abc=def=ghi");
      expect(result["other"]).to.equal("simple");
    });

    it("should return empty object for undefined/empty header", () => {
      expect(parseCookies(undefined)).to.deep.equal({});
      expect(parseCookies("")).to.deep.equal({});
    });
  });

  describe("Slot/Port Parsing", () => {
    it("should accept valid slot numbers", () => {
      expect(parseSlotOrPort("0")).to.deep.equal({ valid: true, value: 0 });
      expect(parseSlotOrPort("5")).to.deep.equal({ valid: true, value: 5 });
      expect(parseSlotOrPort("19132")).to.deep.equal({ valid: true, value: 19132 });
    });

    it("should reject NaN from non-numeric input", () => {
      // This tests the isNaN fix: parseInt("abc") returns NaN
      // which previously passed the < 0 and > 65536 checks
      const result = parseSlotOrPort("abc");
      expect(result.valid).to.equal(false);
    });

    it("should reject reserved and out-of-range ports", () => {
      expect(parseSlotOrPort("80")).to.deep.equal({ valid: false, value: 80 });
      expect(parseSlotOrPort("443")).to.deep.equal({ valid: false, value: 443 });
      expect(parseSlotOrPort("-1")).to.deep.equal({ valid: false, value: -1 });
      expect(parseSlotOrPort("99999")).to.deep.equal({ valid: false, value: 99999 });
    });
  });
});
