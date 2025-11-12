// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import CreatorTools from "./CreatorTools";
import IMinecraft from "./IMinecraft";
import Project from "./Project";

export default interface IContext {
  creatorTools: CreatorTools;
  project?: Project;
  minecraft?: IMinecraft;
  host?: any;
}
