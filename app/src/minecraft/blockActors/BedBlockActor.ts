import BlockActor from "./BlockActor";

export default class BedBlockActor extends BlockActor {
  color?: boolean;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("color");
    if (tag) {
      this.color = tag.valueAsBoolean;
    }
  }
}
