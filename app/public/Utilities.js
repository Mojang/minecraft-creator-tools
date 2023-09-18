class Utilities {
  static validateFolderPath(path) {
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

  static countChar(source, find) {
    let count = 0;

    let index = source.indexOf(find);

    while (index >= 0) {
      count++;

      index = source.indexOf(find, index + find.length);
    }

    return count;
  }

  static ensureStartsWithSlash(pathSegment) {
    if (!pathSegment.startsWith("/")) {
      pathSegment = "/" + pathSegment;
    }

    return pathSegment;
  }

  static ensureEndsWithSlash(pathSegment) {
    if (!pathSegment.endsWith("/")) {
      pathSegment += "/";
    }

    return pathSegment;
  }

  static ensureStartsWithBackSlash(pathSegment) {
    if (!pathSegment.startsWith("\\")) {
      pathSegment = "\\" + pathSegment;
    }

    return pathSegment;
  }

  static ensureEndsWithBackSlash(pathSegment) {
    if (!pathSegment.endsWith("\\")) {
      pathSegment += "\\";
    }

    return pathSegment;
  }
}
module.exports = Utilities;
