// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocCommandAlias from "./IDocCommandAlias";
import IDocCommandOverload from "./IDocCommandOverload";

export default interface IDocCommand {
  aliases: IDocCommandAlias[];
  description: string;
  name: string;
  overloads: IDocCommandOverload[];
  permission_level: string;
  requires_cheats: boolean;
}
