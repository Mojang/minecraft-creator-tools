// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocCommandInfoArgument from "./IDocCommandInfoArgument";
import IDocCommandOverload from "./IDocCommandOverload";

export default interface IDocCommandInfo {
  arguments: IDocCommandInfoArgument[];
  description: string;
  overloads: IDocCommandOverload[];
}
