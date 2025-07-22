// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

class NodeifyScript {
  constructor() {}

  static create(root, aliases = {}) {
    return new NodeifyScript(root, aliases);
  }

  resolve(filePath, content) {
    if (filePath.toLowerCase().indexOf("/cli/index") <= 0 && filePath.toLowerCase().indexOf("\\cli\\index") <= 0) {
      return content;
    }
    return "#!/usr/bin/env node\n" + content;
  }
}

module.exports = NodeifyScript;
