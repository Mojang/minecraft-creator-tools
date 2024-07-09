// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const Vinyl = require("vinyl");
const fs = require("fs");

class TextReplaceStream {
  _fromRegx;
  _targetFilePath;

  constructor(targetFilePath, fromRegEx) {
    this._targetFilePath = targetFilePath;
    this._fromRegEx = fromRegEx;
  }

  static create(targetFilePath, fromRegEx) {
    return new TextReplaceStream(targetFilePath, fromRegEx);
  }

  resolve(filePath, content) {
    let targetContent = this.readFile(this._targetFilePath);
    console.log("PTH" + filePath + "EWF" + targetContent + "TGT" + this._targetFilePath);

    if (targetContent) {
      targetContent = targetContent.replace(this._fromRegEx, content);

      this.writeFile(this._targetFilePath, targetContent);
    }

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

module.exports = TextReplaceStream;
