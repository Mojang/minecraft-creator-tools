// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IDocCommandOverloadParam from "./IDocCommandOverloadParam";

export default interface IDocCommandOverload {
  params: IDocCommandOverloadParam[];
  version: boolean;
  name: string;
}
