// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const mojangMinecraftTypeEquivs = [
  "World",
  "BlockLocation",
  "Location",
  "Block",
  "Dimension",
  "BlockType",
  "Entity",
  "EntityType",
];
const mojangGameTestTypeEquivs = ["SimulatedPlayer", "Test"];

class ImportTransform {
  root = "";
  aliases = {};
  rule = /(?:import)[^'"]*(?:'|")([^'"]*)(?:'|")/gi;

  constructor(root, aliases = {}) {
    this.root = root;
    this.aliases = aliases;
  }

  static create(root, aliases = {}) {
    return new ImportTransform(root, aliases);
  }

  resolve(filePath, content) {
    let lines = content.split("\n");

    const usedMojangMinecraftTypes = [];
    const usedMojangGameTestTypes = [];

    lines = lines.map((line) => this.parseLine(line, filePath, usedMojangMinecraftTypes, usedMojangGameTestTypes));

    let coreContents = lines.join("\n");

    if (usedMojangMinecraftTypes.length > 0) {
      let minecraftImport = "import { ";
      for (let i = 0; i < usedMojangMinecraftTypes.length; i++) {
        if (i > 0) {
          minecraftImport += ", ";
        }
        minecraftImport += usedMojangMinecraftTypes[i];
      }

      coreContents = minecraftImport + " } from 'mojang-minecraft';\n" + coreContents;
    }

    if (usedMojangGameTestTypes.length > 0) {
      let minecraftImport = "import { ";
      for (let i = 0; i < usedMojangGameTestTypes.length; i++) {
        if (i > 0) {
          minecraftImport += ", ";
        }
        minecraftImport += usedMojangGameTestTypes[i];
      }

      coreContents = minecraftImport + " } from 'mojang-gametest';\n" + coreContents;
    }

    return coreContents;
  }

  parseLine(line, filePath, usedMojangMinecraftTypes, usedMojangGameTestTypes) {
    if (line.startsWith("import ")) {
      const nextSpace = line.indexOf(" ", 8);

      if (nextSpace >= 0) {
        let token = line.substring(7, nextSpace);
        token = token.replace("{", "").replace("}", "").trim();

        if (mojangMinecraftTypeEquivs.includes(token)) {
          usedMojangMinecraftTypes.push(token);
          return "";
        } else if (mojangGameTestTypeEquivs.includes(token)) {
          usedMojangGameTestTypes.push(token);
          return "";
        }
      }
    }

    const transformedLine = line.replace(this.rule, (substr, moduleId) => {
      let relativeModule = moduleId;

      // strip off any path
      const lastPath = relativeModule.lastIndexOf("/");

      if (lastPath >= 0) {
        relativeModule = relativeModule.substring(lastPath + 1);
      }

      // strip off extensions as we'll add them back
      if (relativeModule.endsWith(".js")) {
        relativeModule = relativeModule.substring(0, relativeModule.length - 3);
      }

      relativeModule = "./" + relativeModule + ".js";

      return substr.replace(moduleId, relativeModule);
    });

    return transformedLine;
  }
}

module.exports = ImportTransform;
