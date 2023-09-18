import BlockActor from "./BlockActor";
import { InventoryItem } from "../Items";

export default class ChestBlockActor extends BlockActor {
  findable?: boolean;

  items: InventoryItem[] = [];

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("Findable");
    if (tag) {
      this.findable = tag.valueAsBoolean;
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
