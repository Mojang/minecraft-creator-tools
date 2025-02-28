// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IEntityActionSet from "./IEventActionSet";

export default class EntityEvent {
  #data: IEntityActionSet;

  constructor(entityEvent: IEntityActionSet) {
    this.#data = entityEvent;
  }
}
