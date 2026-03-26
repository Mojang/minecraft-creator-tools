/**
 * Electron utility functions for path validation and manipulation.
 *
 * This module provides common utility functions used across the Electron main process
 * for validating and manipulating file paths.
 */

export class Utilities {
  static validateFolderPath(path: string): void {
    // banned character combos
    if (path.indexOf("..") >= 0 || path.indexOf("\\\\") >= 0 || path.indexOf("//") >= 0) {
      throw new Error("Unsupported path combinations: " + path);
    }

    if (path.lastIndexOf(":") >= 2) {
      throw new Error("Unsupported drive location: " + path);
    }

    const count = Utilities.countChar(path, "\\") + Utilities.countChar(path, "/");

    if (count < 3) {
      throw new Error("Unsupported base path: " + path);
    }
  }

  static countChar(source: string, find: string): number {
    let count = 0;

    let index = source.indexOf(find);

    while (index >= 0) {
      count++;

      index = source.indexOf(find, index + find.length);
    }

    return count;
  }

  static ensureStartsWithSlash(pathSegment: string): string {
    if (!pathSegment.startsWith("/")) {
      pathSegment = "/" + pathSegment;
    }

    return pathSegment;
  }

  static ensureEndsWithSlash(pathSegment: string): string {
    if (!pathSegment.endsWith("/")) {
      pathSegment += "/";
    }

    return pathSegment;
  }

  static ensureStartsWithBackSlash(pathSegment: string): string {
    if (!pathSegment.startsWith("\\")) {
      pathSegment = "\\" + pathSegment;
    }

    return pathSegment;
  }

  static ensureEndsWithBackSlash(pathSegment: string): string {
    if (!pathSegment.endsWith("\\")) {
      pathSegment += "\\";
    }

    return pathSegment;
  }
}

export default Utilities;
