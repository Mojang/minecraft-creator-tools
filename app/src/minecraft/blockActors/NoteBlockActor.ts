import BlockActor from "./BlockActor";

export default class NoteBlockActor extends BlockActor {
  note?: boolean;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("note");
    if (tag) {
      this.note = tag.valueAsBoolean;
    }
  }
}
