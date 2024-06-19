// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const Vinyl = require("vinyl");
const fs = require("fs");

class TypeDef {
  name;
  content;
}

class JsonTypeDefsBuilder {
  _targetFilePath;
  _typedefs = [];
  _wrapDeclare;

  constructor(targetFilePath, wrapDeclare) {
    this._targetFilePath = targetFilePath;
    this._wrapDeclare = wrapDeclare;
  }

  static create(targetFilePath, wrapDeclare) {
    return new JsonTypeDefsBuilder(targetFilePath, wrapDeclare);
  }

  resolve(filePath, content) {
    let moduleName = filePath.toLowerCase();

    if (moduleName.endsWith(".ts") || moduleName.endsWith(".js")) {
      let dirToFileSlash = moduleName.lastIndexOf("/");
      dirToFileSlash = Math.max(dirToFileSlash, moduleName.lastIndexOf("\\"));

      if (dirToFileSlash >= 0) {
        let firstFolderSlash = moduleName.lastIndexOf("/", dirToFileSlash - 1);
        firstFolderSlash = Math.max(firstFolderSlash, moduleName.lastIndexOf("\\", dirToFileSlash - 1));

        if (firstFolderSlash >= 0) {
          let secondFolderSlash = moduleName.lastIndexOf("/", firstFolderSlash - 1);
          secondFolderSlash = Math.max(secondFolderSlash, moduleName.lastIndexOf("\\", firstFolderSlash - 1));

          if (secondFolderSlash >= 0) {
            moduleName = moduleName.substring(secondFolderSlash + 1, dirToFileSlash);
            moduleName = moduleName.replace(/\\/g, "/");

            const typeDef = new TypeDef();
            typeDef.name = moduleName;
            typeDef.content = content;
            this._typedefs.push(typeDef);

            this.outputTypeDefFile();
          }
        }
      }
    }

    return content;
  }

  outputTypeDefFile() {
    let content = '{ "typeDefs": [';

    for (let i = 0; i < this._typedefs.length; i++) {
      const td = this._typedefs[i];

      if (i > 0) {
        content += ",";
      }

      let modcontent = td.content;

      if (this._wrapDeclare) {
        modcontent = modcontent.replace(/declare /gi, "");
      }

      content += "{";
      content += '"name":"' + td.name + '",';
      content += '"content":["' + this.getQuoteSafeContent(modcontent) + '"]';
      content += "}";
    }

    content += "]}";

    this.writeFile(this._targetFilePath, content);
  }

  getQuoteSafeContent(content) {
    var newContent = "";

    for (const chr of content) {
      if (chr === "\\") {
        newContent += "/";
      } else if (chr === '"') {
        newContent += "'";
      } else {
        newContent += chr;
      }
    }

    // eslint-disable-next-line no-control-regex
    content = newContent.replace(/[\r\n\x0B\x0C\u0085\u2028\u2029]+/g, '",\n"');
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

module.exports = JsonTypeDefsBuilder;
