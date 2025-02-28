// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IEntityAction from "./IEventAction";

export default interface IEntityActionSet {
  sequence?: (IEntityActionSet | IEntityAction)[] | undefined;
  randomize?: (IEntityActionSet | IEntityAction)[] | undefined;
  weight?: number;
}
