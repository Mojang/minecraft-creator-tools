import { world } from "@minecraft/server";
import AnchorSet from "../app/minecraft/AnchorSet";

export default class AnchorManager {
  anchors: AnchorSet;

  constructor() {
    this.anchors = new AnchorSet();
  }

  save() {
    let anchorState = this.anchors.getAsString();

    world.setDynamicProperty("anchors", anchorState);
  }

  load() {
    let anchorState = world.getDynamicProperty("anchors");

    if (anchorState && typeof anchorState === "string") {
      this.anchors.fromString(anchorState);
    }
  }

  init() {
    this.load();
  }
}
