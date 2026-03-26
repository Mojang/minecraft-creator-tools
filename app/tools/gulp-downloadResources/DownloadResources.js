// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const fs = require("fs");
const { execSync } = require("child_process");
const os = require("os");
const JSZip = require("jszip");
const path = require("path");

/**
 * Synchronously sleep for a given number of milliseconds.
 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Validate that a buffer contains a valid (non-truncated) zip file.
 * Checks for the zip magic bytes at the start and the end-of-central-directory
 * signature near the end of the file.
 */
function validateZipBuffer(buffer) {
  if (buffer.length < 22) {
    throw new Error("File too small to be a valid zip (" + buffer.length + " bytes)");
  }

  // Check zip magic bytes: PK\x03\x04
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
    throw new Error("Not a valid zip file (first bytes: 0x" + buffer.slice(0, 4).toString("hex") + ")");
  }

  // Check for end-of-central-directory signature: PK\x05\x06
  // EOCD can have a comment up to 65535 bytes, so search the last 65557 bytes.
  const searchStart = Math.max(0, buffer.length - 65557);
  let foundEOCD = false;
  for (let i = buffer.length - 4; i >= searchStart; i--) {
    if (buffer[i] === 0x50 && buffer[i + 1] === 0x4b && buffer[i + 2] === 0x05 && buffer[i + 3] === 0x06) {
      foundEOCD = true;
      break;
    }
  }

  if (!foundEOCD) {
    throw new Error(
      "Zip appears truncated (" +
        (buffer.length / (1024 * 1024)).toFixed(1) +
        " MB) - missing end-of-central-directory record"
    );
  }
}

/**
 * Download a URL to a Buffer using curl, with validation and retry.
 *
 * Node.js http/https modules truncate large chunked responses from GitHub's
 * codeload CDN (e.g., 25 MB received out of ~150 MB). This affects both
 * node-fetch and the built-in fetch/https.get. curl handles these transfers
 * more reliably, but can still produce truncated files on very large archives.
 *
 * To guard against this, the downloaded file is validated as a well-formed zip
 * (magic bytes + end-of-central-directory record) and retried if corrupt.
 */
function downloadToBuffer(url) {
  const MAX_ATTEMPTS = 3;
  const tmpFile = path.join(
    os.tmpdir(),
    "gulp-download-" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".zip"
  );

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // -L: follow redirects
      // -f: fail fast on HTTP errors (returns exit code 22)
      // --retry 3: retry up to 3 times on transient curl errors
      // --retry-delay 5: wait 5 seconds between curl-level retries
      // -sS: silent but show errors
      // --compressed: handle content-encoding (gzip/deflate) properly
      // -o: output to temp file
      execSync(
        'curl -L -f --retry 3 --retry-delay 5 -sS --compressed -o "' + tmpFile + '" "' + url + '"',
        { stdio: "inherit", timeout: 600000 } // 10 minute timeout
      );

      const buffer = fs.readFileSync(tmpFile);
      validateZipBuffer(buffer);

      console.log("Downloaded " + (buffer.length / (1024 * 1024)).toFixed(1) + " MB from " + url);
      return buffer;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        const delaySec = attempt * 10;
        console.log(
          "Download attempt " +
            attempt +
            "/" +
            MAX_ATTEMPTS +
            " failed: " +
            err.message +
            ". Retrying in " +
            delaySec +
            "s..."
        );
        sleepSync(delaySec * 1000);
      }
    } finally {
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  throw new Error("Failed to download " + url + " after " + MAX_ATTEMPTS + " attempts: " + lastError.message);
}
class DownloadResources {
  _targetFilePath;
  _excludeIfContents;

  _typedefs = [];

  // Maximum relative path length (from deployment root) before warning/skipping.
  // Git and some filesystems may fail with paths at or beyond 260 characters total.
  // A deployed path typically has a ~70-char prefix (e.g., /home/runner/work/repo/repo/app/public/),
  // so 160 for the relative portion keeps total paths safely under 255.
  static MAX_RELATIVE_PATH_LENGTH = 160;

  // as an additional security defense, enforce an explicit allow list of file extensions (never extract .exes, say.)
  // note that LICENSE (no extension) is also allowed through special case code.
  fileExtensionAllowList = ["json", "js", "ts", "png", "tga", "jpg", "lang"];
  pathDisallowList = ["./", "/.", "just.config.ts"];

  constructor(targetFilePath, excludeIfContents) {
    this._targetFilePath = targetFilePath;

    if (!excludeIfContents) {
      this._excludeIfContents = [];
    } else {
      this._excludeIfContents = excludeIfContents;
    }
  }

  resolve(filePath, content, callback) {
    const moduleName = filePath.toLowerCase();

    const me = this;
    if (moduleName.toLowerCase().endsWith(".resources.json")) {
      let jsonObj = undefined;

      try {
        jsonObj = JSON.parse(content);
      } catch (e) {}

      if (jsonObj && jsonObj.url) {
        console.log("Downloading '" + jsonObj.url + "' contents to '" + this._targetFilePath + "'");

        let subFolder = jsonObj.subFolder;

        if (!subFolder) {
          subFolder = "";
        }

        const ignoreSubFolder = jsonObj.ignoreSubFolder;
        const ignoreFirstFolder = jsonObj.ignoreFirstFolder;
        const replaceFirstFolderWith = jsonObj.replaceFirstFolderWith;

        let extraExcludeIfContents = jsonObj.exclude;

        if (!extraExcludeIfContents) {
          extraExcludeIfContents = [];
        }

        extraExcludeIfContents = me._excludeIfContents.concat(extraExcludeIfContents);

        let zipBuffer;

        // Check for local override first - if it exists, use it instead of downloading
        if (jsonObj.localOverrideZip) {
          const overridePath = path.join(__dirname, "../../override-libs", jsonObj.localOverrideZip);
          if (fs.existsSync(overridePath)) {
            console.log("Using local override instead of download: " + overridePath);
            try {
              zipBuffer = fs.readFileSync(overridePath);
              validateZipBuffer(zipBuffer);
              console.log("Loaded " + (zipBuffer.length / (1024 * 1024)).toFixed(1) + " MB from local override");
            } catch (overrideErr) {
              console.log("Error reading local override: " + overrideErr + ", falling back to download");
              zipBuffer = undefined;
            }
          }
        }

        // If no local override was loaded, try to download
        if (!zipBuffer) {
          try {
            zipBuffer = downloadToBuffer(jsonObj.url);
          } catch (err) {
            console.log("Error downloading file: " + err);
            callback(err);
            return content;
          }
        }

        let folderInfos = {};

        JSZip.loadAsync(zipBuffer)
          .then(function (zip) {
            const filePathsToProcess = [];
            const filePathsWritten = [];

            for (const filePath in zip.files) {
              let addFile = false;

              const filePathCanon = filePath.toLowerCase().replace(/\\/g, "/");

              const extension = me.getTypeFromName(filePathCanon);

              if (
                (extension === "" || extension === "md") &&
                (filePathCanon.endsWith("/notice") ||
                  filePathCanon.endsWith("/readme") ||
                  filePathCanon.endsWith("/readme.md") ||
                  filePathCanon.endsWith("/license") ||
                  filePathCanon.endsWith("/license.md") ||
                  filePathCanon.endsWith("/notice.md"))
              ) {
                addFile = true;
              }

              for (const allowedExtension of me.fileExtensionAllowList) {
                if (allowedExtension === extension) {
                  addFile = true;
                }
              }

              for (const exclude of me.pathDisallowList) {
                if (filePathCanon.indexOf(exclude) >= 0) {
                  addFile = false;
                }
              }

              if (addFile) {
                if (filePathCanon.indexOf("..") >= 0 || filePathCanon.indexOf("//") >= 0) {
                  addFile = false;
                }

                for (const exclusionPath of extraExcludeIfContents) {
                  if (filePathCanon.indexOf(exclusionPath.toLowerCase()) >= 0) {
                    addFile = false;
                  }
                }
              }

              if (addFile) {
                filePathsToProcess.push(filePath);
              }
            }

            for (const filename of filePathsToProcess) {
              let destFile = filename;

              if (ignoreSubFolder && destFile.toLowerCase().startsWith(ignoreSubFolder.toLowerCase())) {
                let nextSlash = destFile.indexOf("/", ignoreSubFolder.length);

                if (nextSlash < ignoreSubFolder.length) {
                  nextSlash = ignoreSubFolder.length;
                }

                destFile = destFile.substring(nextSlash);
              }

              if (ignoreFirstFolder) {
                let nextSlash = destFile.indexOf("/", 1);

                if (nextSlash > 1) {
                  destFile = destFile.substring(nextSlash);
                }
              }

              if (replaceFirstFolderWith) {
                let nextSlash = destFile.indexOf("/", 1);

                if (nextSlash > 1) {
                  destFile = path.join(replaceFirstFolderWith, destFile.substring(nextSlash));
                }
              }

              // Validate path length to prevent deployment failures.
              // Git and some filesystems error with "Filename too long" when the total
              // path exceeds limits (255 per component on Linux, 260 total on Windows).
              const relativePath = path.join(subFolder, destFile).replace(/\\/g, "/");
              if (relativePath.length > DownloadResources.MAX_RELATIVE_PATH_LENGTH) {
                console.warn(
                  "WARNING: Skipping file with path too long (" +
                    relativePath.length +
                    " chars, max " +
                    DownloadResources.MAX_RELATIVE_PATH_LENGTH +
                    "): " +
                    relativePath
                );
                filePathsWritten.push(filename);
                if (filePathsWritten.length >= filePathsToProcess.length) {
                  callback(null, null);
                  return;
                }
                continue;
              }

              const dest = path.join(me._targetFilePath, subFolder, destFile);
              const folderPath = me.getPath(dest);

              if (!folderInfos[folderPath]) {
                folderInfos[folderPath] = {
                  files: [],
                  folders: [],
                };
              }

              const content = zip.files[filename];

              let ancestorFolderPath = me.getPath(folderPath);
              const currentFolderName = me.getFileName(folderPath);

              if (!folderInfos[ancestorFolderPath]) {
                folderInfos[ancestorFolderPath] = {
                  files: [],
                  folders: [],
                };
              }

              // cache the parent folder name
              if (!folderInfos[ancestorFolderPath].folders.includes(currentFolderName)) {
                folderInfos[ancestorFolderPath].folders.push(currentFolderName);
              }

              const parentFolderName = me.getFileName(ancestorFolderPath);
              ancestorFolderPath = me.getPath(ancestorFolderPath);

              if (!folderInfos[ancestorFolderPath]) {
                folderInfos[ancestorFolderPath] = {
                  files: [],
                  folders: [],
                };
              }

              if (!folderInfos[ancestorFolderPath].folders.includes(parentFolderName)) {
                folderInfos[ancestorFolderPath].folders.push(parentFolderName);
              }

              if (content.dir) {
                filePathsWritten.push(filename);

                if (filePathsWritten.length >= filePathsToProcess.length) {
                  callback(null, null);
                  return;
                }
              } else {
                const fileDest = dest;
                const fileFolderPath = folderPath;

                content.async("uint8array").then((contentBytes) => {
                  const exists = fs.existsSync(fileFolderPath);

                  if (!exists) {
                    fs.mkdirSync(fileFolderPath, { recursive: true });
                  }

                  folderInfos[fileFolderPath].files.push(me.getFileName(fileDest));

                  fs.writeFileSync(fileDest, contentBytes);

                  filePathsWritten.push(filename);

                  if (filePathsWritten.length >= filePathsToProcess.length) {
                    console.log(
                      "Wrote " +
                        filePathsWritten.length +
                        " files and folders to '" +
                        path.join(me._targetFilePath, subFolder) +
                        "'"
                    );

                    for (const folderInfo in folderInfos) {
                      const folderInfoJson = JSON.stringify(folderInfos[folderInfo], null, 2);
                      fs.writeFileSync(folderInfo + "/index.json", folderInfoJson);
                    }

                    callback(null, null);
                    return;
                  }
                });
              }
            }

            if (filePathsWritten.length >= filePathsToProcess.length) {
              callback(null, null);
            }
          })
          .catch((err) => {
            console.log("Error opening up zip: " + err);

            callback(err);
          });
      }
    }

    return content;
  }

  getTypeFromName(name) {
    const nameW = name.trim().toLowerCase();

    const lastPeriod = nameW.lastIndexOf(".");

    if (lastPeriod < 0) {
      return "";
    }

    return nameW.substring(lastPeriod + 1, nameW.length);
  }

  getPath(path) {
    if (path.endsWith("/")) {
      path = path.substring(0, path.length - 1);
    }

    if (path.endsWith("\\")) {
      path = path.substring(0, path.length - 1);
    }

    let lastSlash = path.lastIndexOf("/", path.length - 1);

    if (lastSlash >= 0 && lastSlash < path.length - 1) {
      path = path.substring(0, lastSlash + 1);
    } else {
      lastSlash = path.lastIndexOf("\\", path.length - 1);

      if (lastSlash >= 0 && lastSlash < path.length - 1) {
        path = path.substring(0, lastSlash + 1);
      }
    }

    return path;
  }

  getFileName(path) {
    if (path.endsWith("/")) {
      path = path.substring(0, path.length - 1);
    }

    if (path.endsWith("\\")) {
      path = path.substring(0, path.length - 1);
    }

    let lastSlash = path.lastIndexOf("/", path.length - 1);

    if (lastSlash >= 0 && lastSlash < path.length - 1) {
      path = path.substring(lastSlash + 1);
    } else {
      lastSlash = path.lastIndexOf("\\", path.length - 1);

      if (lastSlash >= 0 && lastSlash < path.length - 1) {
        path = path.substring(lastSlash + 1);
      }
    }

    return path;
  }
}

module.exports = DownloadResources;
