// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const fs = require("fs");
const { version } = require("os");
const Vinyl = require("vinyl");
const path = require("path");

class UpdateVersions {
  _updateFiles;

  constructor(updateFiles) {
    this._updateFiles = updateFiles;
  }

  resolve(filePath, content, callback) {
    const moduleName = filePath.toLowerCase();

    if (moduleName.toLowerCase().endsWith(".json")) {
      let jsonObj = undefined;

      try {
        jsonObj = JSON.parse(content);
      } catch (e) {}

      if (jsonObj && jsonObj.version) {
        const versionStr = jsonObj.version;
        console.log("Updated version is: " + versionStr);

        for (const file of this._updateFiles) {
          let fileContents = this.readFile(file);

          if (fileContents && fileContents.length > 10) {
            let rewriteFile = false;

            const quoteVersionTagStart = fileContents.indexOf('"version":');

            if (quoteVersionTagStart >= 0) {
              const nextQuote = fileContents.indexOf('"', quoteVersionTagStart + 10);

              if (nextQuote > quoteVersionTagStart) {
                const followingQuote = fileContents.indexOf('"', nextQuote + 1);

                if (followingQuote > 0) {
                  const fileToken = fileContents.substring(nextQuote + 1, followingQuote);

                  if (fileToken != versionStr && fileToken.length > 3 && fileToken.indexOf(".") >= 0) {
                    fileContents =
                      fileContents.substring(0, nextQuote + 1) + versionStr + fileContents.substring(followingQuote);
                    rewriteFile = true;
                  }
                }
              }
            }

            const versionTagStart = fileContents.indexOf("version:");

            if (versionTagStart >= 0) {
              const nextQuote = fileContents.indexOf('"', versionTagStart + 8);

              if (nextQuote > versionTagStart) {
                const followingQuote = fileContents.indexOf('"', nextQuote + 1);

                if (followingQuote > 0) {
                  const fileToken = fileContents.substring(nextQuote + 1, followingQuote);

                  if (fileToken != versionStr && fileToken.length > 3 && fileToken.indexOf(".") >= 0) {
                    fileContents =
                      fileContents.substring(0, nextQuote + 1) + versionStr + fileContents.substring(followingQuote);
                    rewriteFile = true;
                  }
                }
              }
            }

            if (rewriteFile) {
              console.log("Parsing file '" + file + "'");

              this.writeFile(file, fileContents);
            }
          }
        }
      } else {
        console.log("Version could not be determined from '" + moduleName + "'");
      }
    }

    callback(null, null);

    return content;
  }

  readFile(relativePath) {
    return fs.readFileSync(relativePath, { encoding: "utf8" });
  }

  writeFile(relativePath, contents) {
    // use gulp's vinyl file descriptor for path canonicalization
    const file = new Vinyl({
      path: relativePath,
      contents: Buffer.from(contents),
    });

    if (!fs.existsSync(file.dirname)) {
      fs.mkdirSync(file.dirname, { recursive: true });
    }

    fs.writeFileSync(file.path, file.contents);
  }
}

module.exports = UpdateVersions;
