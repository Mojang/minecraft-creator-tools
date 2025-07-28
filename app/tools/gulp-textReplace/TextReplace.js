// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const Vinyl = require("vinyl");
const fs = require("fs");

class TextReplace {
  _fromRegx;
  _toStr;
  _targetFilePath;

  constructor(targetFilePath, fromRegEx, toStr) {
    this._fromRegEx = fromRegEx;
    this._toStr = toStr;
    this._targetFilePath = targetFilePath;
  }

  static create(targetFilePath, from, to) {
    return new TextReplace(targetFilePath, from, to);
  }

  resolve(filePath, content) {
    if (Array.isArray(this._fromRegEx) && Array.isArray(this._toStr) && this._fromRegEx.length === this._toStr.length) {
      for (let i = 0; i < this._fromRegEx.length; i++) {
        content = content.replace(this._fromRegEx[i], this._toStr[i]);
      }
    } else {
      content = content.replace(this._fromRegEx, this._toStr);
    }

    this.writeFile(this._targetFilePath, content);

    return content;
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

module.exports = TextReplace;
