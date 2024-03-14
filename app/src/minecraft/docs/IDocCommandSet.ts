// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocCommand from "./IDocCommand";
import IDocCommandEnum from "./IDocCommandEnum";

export default interface IDocCommandSet {
  commands: IDocCommand[];
  command_enums: IDocCommandEnum[];
  minecraft_version: string;
  module_type: string;
  name: string;
}
