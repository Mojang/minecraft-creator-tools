// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocClass from "./IDocClass";
import IDocScriptEnum from "./IDocScriptEnum";

export default interface IDocModule {
  classes: IDocClass[];
  errors: IDocClass[];
  constants: [];
  dependencies: [];
  enums: IDocScriptEnum[];
  functions: [];
  interfaces: IDocClass[];
  minecraft_version: string;
  module_type: string;
  name: string;
  objects: [];
  uuid: string;
  version: string;
}
