// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import DifferenceSet from "../storage/DifferenceSet";
import Utilities from "../core/Utilities";
import Log from "../core/Log";

export default class MinecraftUtilities {
  static isReloadableSetOfChanges(differenceSet: DifferenceSet) {
    return differenceSet.hasFileOnlyOfExtension("js", "ts", "map") && !differenceSet.getHasDeletions();
  }

  static getAfterPackPath(path: string) {
    const hashIndex = path.indexOf("#");

    if (hashIndex >= 0) {
      path = path.substring(hashIndex + 1);
    }

    return path;
  }

  static pathLooksLikeSkinPackContainerName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");
    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    if (
      pathCanon.indexOf("skin_packs") >= 0 ||
      pathCanon.indexOf("_sps") >= 0 ||
      pathCanon.indexOf("/sps_") >= 0 ||
      pathCanon.endsWith("sps/") ||
      pathCanon === "/sps/" ||
      pathCanon === "/sp/"
    ) {
      return true;
    }

    return false;
  }

  static pathLooksLikeBehaviorPackContainerName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");
    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    if (
      pathCanon.indexOf("behavior_packs") >= 0 ||
      pathCanon.indexOf("_bps") >= 0 ||
      pathCanon.indexOf("/bps_") >= 0 ||
      pathCanon.endsWith("bps/") ||
      pathCanon === "/bps/" ||
      pathCanon === "/bp/"
    ) {
      return true;
    }

    return false;
  }

  static pathLooksLikeResourcePackContainerName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");

    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    if (
      pathCanon.indexOf("resource_packs") >= 0 ||
      pathCanon.indexOf("_rps") >= 0 ||
      pathCanon.indexOf("/rps_") >= 0 ||
      pathCanon.endsWith("rps/") ||
      pathCanon === "/rps/" ||
      pathCanon === "/rp/"
    ) {
      return true;
    }

    return false;
  }

  static pathLooksLikePackContainerName(path: string) {
    return (
      this.pathLooksLikeBehaviorPackContainerName(path) ||
      this.pathLooksLikeResourcePackContainerName(path) ||
      this.pathLooksLikeSkinPackContainerName(path)
    );
  }

  static pathLooksLikeBehaviorPackName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");
    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    if (
      pathCanon.indexOf("/behavior") >= 0 ||
      pathCanon.indexOf("behavior_pack") >= 0 ||
      pathCanon.indexOf("_bp") >= 0 || // bp is uncommon as the start of a word
      pathCanon.indexOf("/bp_") >= 0 ||
      pathCanon.indexOf("/bp/") >= 0
    ) {
      return true;
    }

    return false;
  }

  static pathLooksLikeResourcePackName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");
    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    if (
      pathCanon.indexOf("/resource") >= 0 ||
      pathCanon.indexOf("resource_pack") >= 0 ||
      pathCanon.indexOf("_rp") >= 0 || // rp is uncommon as the start of a word
      pathCanon.indexOf("/rp_") >= 0 ||
      pathCanon.indexOf("/rp/") >= 0
    ) {
      return true;
    }

    return false;
  }

  static pathLooksLikeSkinPackName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");
    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    // because sp might common in english as an abbreviation, be less tolerant
    // compared to behavior/resource packs in assuming "sp" means skin pack
    if (pathCanon.indexOf("/skin") >= 0 || pathCanon.indexOf("skin_pack") >= 0) {
      return true;
    }

    return false;
  }

  static pathLooksLikeWorldFolderName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");
    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    if (pathCanon.indexOf("/world") >= 0) {
      return true;
    }

    return false;
  }

  static pathLooksLikeSubPacksFolderName(path: string) {
    let pathCanon = path.toLowerCase();

    pathCanon = pathCanon.replace(/\\/gi, "/");
    pathCanon = pathCanon.replace(/ /gi, "_");
    pathCanon = Utilities.ensureEndsWithSlash(Utilities.ensureStartsWithSlash(pathCanon));

    if (pathCanon.indexOf("/subpacks") >= 0) {
      return true;
    }

    return false;
  }
  static pathLooksLikePackName(path: string) {
    return (
      this.pathLooksLikeBehaviorPackName(path) ||
      this.pathLooksLikeResourcePackName(path) ||
      this.pathLooksLikeSkinPackName(path)
    );
  }

  static replaceMinecraftPathTokens(tokenizePath: string) {
    if (tokenizePath.startsWith("<RPME>")) {
      tokenizePath += ".geo.json";
    } else if (
      tokenizePath.startsWith("<BPE>") ||
      tokenizePath.startsWith("<BPLE>") ||
      tokenizePath.startsWith("<BPSR>")
    ) {
      tokenizePath += ".json";
    } else if (tokenizePath.startsWith("<RPE>")) {
      tokenizePath += ".entity.json";
    } else if (tokenizePath.startsWith("<RPAC>")) {
      tokenizePath += ".animation_controllers.json";
    } else if (tokenizePath.startsWith("<RPRC>")) {
      tokenizePath += ".render_controllers.json";
    } else if (tokenizePath.startsWith("<RPA>")) {
      tokenizePath += ".animation.json";
    } else if (tokenizePath.startsWith("<RPTE>")) {
      if (tokenizePath.indexOf(".") < 0) {
        tokenizePath += ".png";
      }
    }
    tokenizePath = tokenizePath.replace(/<RPTE>/gi, "/resource_pack/textures/entity/");
    tokenizePath = tokenizePath.replace(/<RPME>/gi, "/resource_pack/models/entity/");
    tokenizePath = tokenizePath.replace(/<RPAC>/gi, "/resource_pack/animation_controllers/");
    tokenizePath = tokenizePath.replace(/<RPRC>/gi, "/resource_pack/render_controllers/");
    tokenizePath = tokenizePath.replace(/<RPA>/gi, "/resource_pack/animations/");
    tokenizePath = tokenizePath.replace(/<RPE>/gi, "/resource_pack/entity/");
    tokenizePath = tokenizePath.replace(/<BPE>/gi, "/behavior_pack/entities/");
    tokenizePath = tokenizePath.replace(/<BPLE>/gi, "/behavior_pack/loot_tables/entities/");
    tokenizePath = tokenizePath.replace(/<BPSR>/gi, "/behavior_pack/spawn_rules/");

    return tokenizePath;
  }

  static makeNameScriptSafe(tokenName: string) {
    tokenName = tokenName.replace(/[^a-z0-9]/gi, "-").replace(/\s+/g, "-");

    while (tokenName.length > 1 && !Utilities.isAlpha(tokenName.substring(0, 1))) {
      tokenName = tokenName.substring(1);
    }

    if (!Utilities.isAlpha(tokenName.substring(0, 1))) {
      tokenName = "a" + tokenName;
    }

    return tokenName;
  }

  static makeNameFolderSafe(tokenName: string) {
    tokenName = Utilities.replaceAll(tokenName, " ", "-").toLowerCase();

    if (tokenName.length > 16) {
      tokenName = tokenName.substring(0, 16);
    }

    return tokenName;
  }

  static getVersionArrayFrom(ver: string | number | number[] | undefined) {
    if (typeof ver === "number") {
      return [ver];
    }

    if (typeof ver === "string") {
      let fvArr = ver.split(".");

      let fvArrInt: number[] = [];
      for (let i = 0; i < fvArr.length; i++) {
        try {
          const num = parseInt(fvArr[i]);

          if (isNaN(num)) {
            return undefined;
          }

          fvArrInt.push(num);
        } catch (e) {}
      }

      return fvArrInt;
    }

    return ver;
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
