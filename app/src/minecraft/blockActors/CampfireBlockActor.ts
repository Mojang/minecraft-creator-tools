import BlockActor from "./BlockActor";

export default class CampfireBlockActor extends BlockActor {
  itemTime1?: number;
  itemTime2?: number;
  itemTime3?: number;
  itemTime4?: number;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("itemTime1");
    if (tag) {
      this.itemTime1 = tag.valueAsInt;
    }

    tag = this.rootTag.find("itemTime2");
    if (tag) {
      this.itemTime2 = tag.valueAsInt;
    }

    tag = this.rootTag.find("itemTime3");
    if (tag) {
      this.itemTime3 = tag.valueAsInt;
    }

    tag = this.rootTag.find("itemTime4");
    if (tag) {
      this.itemTime4 = tag.valueAsInt;
    }
  }
}
