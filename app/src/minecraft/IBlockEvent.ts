// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IBlockComponentList } from "./IBlockComponentList";

export default interface IBlockEvent {
  sequence: IBlockComponentList[] | undefined;
}
