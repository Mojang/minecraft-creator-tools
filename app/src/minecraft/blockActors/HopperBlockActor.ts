import BlockActor from "./BlockActor";

export default class HopperBlockActor extends BlockActor {
  customName?: string;
  transferCooldown?: number;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("CustomName");
    if (tag) {
      this.customName = tag.valueAsString;
    }

    tag = this.rootTag.find("TransferCooldown");
    if (tag) {
      this.transferCooldown = tag.valueAsInt;
    }
  }
}
