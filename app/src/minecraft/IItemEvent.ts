// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { IItemComponentList } from "./IItemComponentList";

export default interface IItemEvent {
  sequence: IItemComponentList[] | undefined;
}
