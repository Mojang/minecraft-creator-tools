import IComponent from "../IComponent";
import InventorySlot from "../InventorySlot";
import NbtBinaryTag from "../NbtBinaryTag";
import Log from "../../core/Log";
import ComponentBase from "../ComponentBase";

export default class EntityInventoryComponent extends ComponentBase implements IComponent {
  slots: { [slotIndex: number]: InventorySlot };

  constructor() {
    super();

    this.slots = {};
  }

  ensureSlot(slotIndex: number) {
    let slot = this.slots[slotIndex];

    if (slot === undefined) {
      slot = new InventorySlot(slotIndex);

      this.slots[slotIndex] = slot;
    }

    return slot;
  }

  loadFromNbtTag(tag: NbtBinaryTag) {
    const childSlotTags = tag.getTagChildren();

    for (let k = 0; k < childSlotTags.length; k++) {
      const childSlotTag = childSlotTags[k];
      const slotIndexTag = childSlotTag.find("Slot");
      const nameTag = childSlotTag.find("Name");
      const countTag = childSlotTag.find("Count");
      const wasPickedUpTag = childSlotTag.find("WasPickedUp");
      const damageTag = childSlotTag.find("Damage");

      if (
        nameTag !== null &&
        nameTag.value !== null &&
        countTag !== null &&
        countTag !== null &&
        damageTag !== null &&
        damageTag.value !== null &&
        wasPickedUpTag !== null &&
        wasPickedUpTag.value !== null
      ) {
        let slotIndex = k;

        if (slotIndexTag !== null) {
          slotIndex = slotIndexTag.valueAsInt;
        }

        const slot = this.ensureSlot(slotIndex);

        slot.name = nameTag.valueAsString;
        slot.count = countTag.valueAsInt;
        slot.wasPickedUp = wasPickedUpTag.valueAsBoolean;
        slot.damage = damageTag.valueAsInt;
      } else {
        Log.fail("Unexpected inventory item in structure.");
      }
    }
  }
}
