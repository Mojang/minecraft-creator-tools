import Log from "../core/Log";
import Block from "./Block";
import NbtBinary from "./NbtBinary";

export default class BlockPalette {
  blocks: Block[] = [];

  parseFromBytes(bytes: Uint8Array, index: number, paletteCount: number) {
    for (let i = 0; i < paletteCount; i++) {
      const nbt = new NbtBinary();

      index += nbt.fromBinary(bytes, true, false, index, true);

      Log.assert(index <= bytes.length, "Unexpected expansion of bytes processed.");

      if (nbt.root === null) {
        return index;
      }

      const children = nbt.root.getTagChildren();

      let block = null;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (child.name === "name") {
          block = new Block();
          block.typeName = child.valueAsString;

          this.blocks.push(block);
        } else if (child.name === "type") {
        }
      }
    }

    return index;
  }
}
