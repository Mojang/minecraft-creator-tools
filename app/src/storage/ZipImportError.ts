// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ZipImportError.ts
 *
 * Structured error type thrown while importing/inflating a zip package (see
 * ZipStorage.loadFromUint8Array). Carrying an explicit, stable `code` (plus an
 * appropriate HTTP `statusCode`) lets callers — notably the /api/validate HTTP
 * handler and, through it, Auger — distinguish specific failure modes (content
 * over the 500 MiB Marketplace limit, package over the 2 GiB unzip safety
 * ceiling, etc.) instead of collapsing everything into a single generic
 * "Error processing passed-in validation package." message.
 */

export enum ZipImportErrorCode {
  /** Files under the top-level "Content/" folder exceed the 500 MiB Marketplace content limit. */
  contentSizeExceeded = "CONTENT_SIZE_EXCEEDED",

  /** Total decompressed size exceeds the lower-level 2 GiB unzip safety ceiling. */
  packageSizeExceeded = "PACKAGE_SIZE_EXCEEDED",

  /** The uploaded (compressed) zip itself exceeds the maximum upload size. */
  uploadTooLarge = "ZIP_UPLOAD_TOO_LARGE",

  /** The zip contains more entries than allowed. */
  tooManyFiles = "ZIP_TOO_MANY_FILES",

  /** The zip contains an unsafe path (e.g. directory traversal). */
  invalidPath = "ZIP_INVALID_PATH",
}

export default class ZipImportError extends Error {
  /** Stable, machine-readable error code for callers to switch on. */
  public readonly code: ZipImportErrorCode;

  /** Suggested HTTP status code for handlers surfacing this error over HTTP. */
  public readonly statusCode: number;

  constructor(code: ZipImportErrorCode, message: string, statusCode: number = 400) {
    super(message);

    this.name = "ZipImportError";
    this.code = code;
    this.statusCode = statusCode;

    // Restore the prototype chain so `instanceof ZipImportError` works after the
    // Error superclass call (required when targeting ES5/ES2015 with TypeScript).
    Object.setPrototypeOf(this, ZipImportError.prototype);
  }

  /** Convenience type guard for catch blocks that receive `unknown`/`any`. */
  public static is(e: unknown): e is ZipImportError {
    return e instanceof ZipImportError;
  }
}
