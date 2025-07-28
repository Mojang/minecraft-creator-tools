// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "../core/Utilities";

export default class ScriptGen {
  static getClassName(name: string) {
    if (name.length < 2) {
      return "untitled";
    }

    name = name[0].toUpperCase() + name.substring(1, name.length);

    name = name.replace(/:/gi, "");

    return name;
  }

  static getInstanceName(name: string) {
    if (name.length < 2) {
      return "untitled";
    }

    name = Utilities.lowerCaseStartOfString(name);

    return name;
  }
}
