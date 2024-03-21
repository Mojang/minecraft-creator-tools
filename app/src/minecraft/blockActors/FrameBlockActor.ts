// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Item } from "../Items";
import BlockActor from "./BlockActor";

export default class FrameBlockActor extends BlockActor {
  itemDropChance?: number;
  itemRotation?: number;
  item?: Item;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("ItemDropChance");
    if (tag) {
      this.itemDropChance = tag.valueAsFloat;
    }

    tag = this.rootTag.find("ItemRotation");
    if (tag) {
      this.itemRotation = tag.valueAsFloat;
    }

    tag = this.rootTag.find("Item");
    if (tag !== null) {
      const children = tag.getTagChildren();

      for (let i = 0; i < children.length; i++) {
        const childTag = children[i];

        const countTag = childTag.find("Count");
        const damageTag = childTag.find("Damage");
        const nameTag = childTag.find("Name");
        const wasPickedUpTag = childTag.find("WasPickedUp");

        if (countTag && damageTag && nameTag && wasPickedUpTag) {
          this.item = {
            count: countTag.valueAsInt,
            damage: damageTag.valueAsInt,
            name: nameTag.valueAsString,
            wasPickedUp: wasPickedUpTag.valueAsBoolean,
          };
        }
      }
    }

    // add Item parsing here.
  }
}
