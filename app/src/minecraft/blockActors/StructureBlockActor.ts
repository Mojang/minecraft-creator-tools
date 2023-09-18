import BlockActor from "./BlockActor";

export default class StructureBlockActor extends BlockActor {
  animationMode?: boolean;
  animationSeconds?: number;
  data?: number;
  dataField?: string;
  ignoreEntities?: boolean;
  includePlayers?: boolean;
  integrity?: number;
  isPowered?: boolean;
  mirror?: boolean;
  redstoneSaveMode?: number;
  removeBlocks?: boolean;
  rotation?: boolean;
  seed?: BigInt;
  showBoundingBox?: boolean;
  structureName?: string;
  xStructureOffset?: number;
  xStructureSize?: number;
  yStructureOffset?: number;
  yStructureSize?: number;
  zStructureOffset?: number;
  zStructureSize?: number;

  public override load() {
    if (!this.rootTag) {
      return;
    }

    let tag = this.rootTag.find("animationMode");
    if (tag) {
      this.animationMode = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("animationSeconds");
    if (tag) {
      this.animationSeconds = tag.valueAsFloat;
    }

    tag = this.rootTag.find("data");
    if (tag) {
      this.data = tag.valueAsInt;
    }

    tag = this.rootTag.find("dataField");
    if (tag) {
      this.dataField = tag.valueAsString;
    }

    tag = this.rootTag.find("ignoreEntities");
    if (tag) {
      this.ignoreEntities = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("includePlayers");
    if (tag) {
      this.includePlayers = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("integrity");
    if (tag) {
      this.integrity = tag.valueAsFloat;
    }

    tag = this.rootTag.find("isPowered");
    if (tag) {
      this.isMovable = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("mirror");
    if (tag) {
      this.mirror = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("redstoneSaveMode");
    if (tag) {
      this.redstoneSaveMode = tag.valueAsInt;
    }

    tag = this.rootTag.find("removeBlocks");
    if (tag) {
      this.removeBlocks = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("rotation");
    if (tag) {
      this.rotation = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("seed");
    if (tag) {
      this.seed = tag.valueAsBigInt;
    }

    tag = this.rootTag.find("showBoundingBox");
    if (tag) {
      this.showBoundingBox = tag.valueAsBoolean;
    }

    tag = this.rootTag.find("structureName");
    if (tag) {
      this.structureName = tag.valueAsString;
    }

    tag = this.rootTag.find("xStructureOffset");
    if (tag) {
      this.xStructureOffset = tag.valueAsInt;
    }

    tag = this.rootTag.find("xStructureSize");
    if (tag) {
      this.xStructureSize = tag.valueAsInt;
    }

    tag = this.rootTag.find("yStructureOffset");
    if (tag) {
      this.yStructureOffset = tag.valueAsInt;
    }

    tag = this.rootTag.find("yStructureSize");
    if (tag) {
      this.yStructureSize = tag.valueAsInt;
    }

    tag = this.rootTag.find("zStructureOffset");
    if (tag) {
      this.zStructureOffset = tag.valueAsInt;
    }

    tag = this.rootTag.find("zStructureSize");
    if (tag) {
      this.zStructureSize = tag.valueAsInt;
    }
  }
}
