// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class InventorySlot {
  name?: string;
  count?: number;
  slot: number;
  wasPickedUp?: boolean;
  damage?: number;

  constructor(slotIndex: number) {
    this.slot = slotIndex;
  }
}
