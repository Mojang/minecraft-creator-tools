// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockActor from "./BlockActor";
import { InventoryItem } from "../Items";

export default class CauldronBlockActor extends BlockActor {
  potionId?: number;
  potionType?: number;

  items: InventoryItem[] = [];

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("PotionId");
    if (tag) {
      this.potionId = tag.valueAsInt;
    }

    tag = this.rootTag.find("PotionType");
    if (tag) {
      this.potionType = tag.valueAsInt;
    }

    tag = this.rootTag.find("Items");
    if (tag !== null) {
      const children = tag.getTagChildren();
      this.items = [];

      for (let i = 0; i < children.length; i++) {
        const childTag = children[i];

        const countTag = childTag.find("Count");
        const damageTag = childTag.find("Damage");
        const nameTag = childTag.find("Name");
        const slotTag = childTag.find("Slot");
        const wasPickedUpTag = childTag.find("WasPickedUp");

        if (countTag && damageTag && nameTag && slotTag && wasPickedUpTag) {
          this.items.push({
            count: countTag.valueAsInt,
            damage: damageTag.valueAsInt,
            name: nameTag.valueAsString,
            slot: slotTag.valueAsInt,
            wasPickedUp: wasPickedUpTag.valueAsBoolean,
          });
        }
      }
    }
  }
}
