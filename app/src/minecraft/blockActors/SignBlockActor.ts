import BlockActor from "./BlockActor";

export default class SignBlockActor extends BlockActor {
  textIgnoreLegacyBugResolved?: boolean;
  ignoreLighting?: boolean;
  persistFormatting?: boolean;
  signTextColor?: number;
  text?: string;
  textOwner?: string;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("IgnoreLighting");
    if (tag) {
      this.ignoreLighting = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("PersistFormatting");
    if (tag) {
      this.persistFormatting = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("SignTextColor");
    if (tag) {
      this.signTextColor = tag.valueAsInt;
    }

    tag = this.rootTag.find("Text");
    if (tag) {
      this.text = tag.valueAsString;
    }

    tag = this.rootTag.find("TextOwner");
    if (tag) {
      this.textOwner = tag.valueAsString;
    }

    tag = this.rootTag.find("TextIgnoreLegacyBugResolved");
    if (tag) {
      this.textIgnoreLegacyBugResolved = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("IsMovable");
    if (tag) {
      this.isMovable = tag.valueAsBoolean;
    }
  }
}
