// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import DifferenceSet from "../storage/DifferenceSet";
import Utilities from "../core/Utilities";
import Log from "../core/Log";

export default class MinecraftUtilities {
  static isReloadableSetOfChanges(differenceSet: DifferenceSet) {
    return differenceSet.hasFileOnlyOfExtension("js", "ts", "map") && !differenceSet.getHasDeletions();
  }

  static makeNameFolderSafe(tokenName: string) {
    tokenName = Utilities.replaceAll(tokenName, " ", "-").toLowerCase();

    if (tokenName.length > 16) {
      tokenName = tokenName.substring(0, 16);
    }

    return tokenName;
  }

  static cleanUpScriptDescription(scriptDescription: string) {
    scriptDescription = Utilities.replaceAll(scriptDescription, "/*", "");
    scriptDescription = Utilities.replaceAll(scriptDescription, "*/\n", "");
    scriptDescription = Utilities.replaceAll(scriptDescription, "*\n", "");
    scriptDescription = Utilities.replaceAll(scriptDescription, "*/", "");
    scriptDescription = Utilities.replaceAll(scriptDescription, "*", "");
    scriptDescription = Utilities.replaceAll(scriptDescription, "@beta", "");

    scriptDescription = scriptDescription.trim();

    return scriptDescription;
  }

  static getIdsAndVersions(packStr: string): { uuid: string; version: number[] }[] {
    const refs: { uuid: string; version: number[] }[] = [];

    const packRefStrs = packStr.split(",");

    for (const packRefStr of packRefStrs) {
      const packRefStrParts = packRefStr.split("@");
      let wasAdded = false;

      if (packRefStrParts.length === 2) {
        const versionNumberParts = packRefStrParts[1].split(".");

        if (versionNumberParts.length === 3) {
          const verNumber: number[] = [];

          for (let i = 0; i < versionNumberParts.length; i++) {
            let num = undefined;

            try {
              num = parseInt(versionNumberParts[i]);
            } catch (e) {}

            if (num !== undefined) {
              verNumber.push(num);
            }
          }

          if (verNumber.length === 3 && this.isValidUuid(packRefStrParts[0])) {
            refs.push({
              uuid: packRefStrParts[0],
              version: verNumber,
            });
            wasAdded = true;
          }
        }
      }

      if (!wasAdded) {
        Log.fail("UUID/version is not in a good form (uuid@x.y.z) - is '" + packRefStr + "'");
      }
    }

    return refs;
  }

  static isValidUuid(uuid: string) {
    // sample uuid: 414a42cd-98d4-4e0d-8e3f-e34ab8a0c05e
    //              xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx

    if (uuid.length === 36) {
      const parts = uuid.split("-");

      if (
        parts.length === 5 &&
        parts[0].length === 8 &&
        parts[1].length === 4 &&
        parts[2].length === 4 &&
        parts[3].length === 4 &&
        parts[4].length === 12
      ) {
        for (let i = 0; i < parts.length; i++) {
          for (let j = 0; j < parts[i].length; j++) {
            if (!Utilities.isAlphaNumeric(parts[i][j])) {
              return false;
            }
          }
        }
      }
    }

    return false;
  }

  static fixupJson(json: string) {
    json = json.replace(/([, ;}\]])0b([, ;}\]])/gi, "$1false$2");
    json = json.replace(/([, ;}\]])1b([, ;}\]])/gi, "$1true$2");

    json = json.replace(/(\d)b([, ;\]])/gi, "$1$2");
    json = json.replace(/(\d)d([, ;\]])/gi, "$1$2");
    json = json.replace(/(\d)f([, ;\]])/gi, "$1$2");
    json = json.replace(/(\d)s([, ;\]])/gi, "$1$2");

    json = json.replace(/\[I;/gi, "[");

    json = json.replace(/…/gi, "");
    /*      
        json = json.replace(/([, ;\]])none([, ;\]])/gi, "$1\"none\"$2");
        json = json.replace(/([, ;\]])south([, ;\]])/gi, "$1\"south\"$2");
        json = json.replace(/([, ;\]])north([, ;\]])/gi, "$1\"north\"$2");
        json = json.replace(/([, ;\]])east([, ;\]])/gi, "$1\"east\"$2");
        json = json.replace(/([, ;\]])west([, ;\]])/gi, "$1\"west\"$2");
        json = json.replace(/([, ;\]])side([, ;\]])/gi, "$1\"side\"$2");
*/

    return json;
  }

  static canonicalizeName(id: string) {
    let canonId = id.toLowerCase().trim();

    if (canonId.startsWith("minecraft:")) {
      canonId = canonId.substring(10, canonId.length);
    }

    return canonId;
  }

  static canonicalizeFullName(id: string) {
    let canonId = id.toLowerCase().trim();

    if (canonId.indexOf(":") < 0) {
      canonId = "minecraft:" + canonId;
    }

    return canonId;
  }
}
