import IComponent from "../IComponent";
import NbtBinaryTag from "../NbtBinaryTag";

export default class AttributeComponent implements IComponent {
  id?: string;
  base?: number;
  current?: number;
  minimum?: number;
  maximum?: number;
  defaultMinimum?: number;
  defaultMaximum?: number;
  [propertyId: string]: string | number | number[] | bigint | bigint[] | boolean | object | undefined;

  loadFromNbtTag(tag: NbtBinaryTag) {
    const minTag = tag.find("Min");

    if (minTag !== null) {
      this.minimum = minTag.valueAsInt;
    }

    let maxTag = tag.find("Max");

    if (maxTag !== null) {
      this.maximum = maxTag.valueAsInt;
    }

    const dminTag = tag.find("DefaultMin");

    if (dminTag !== null) {
      this.defaultMinimum = dminTag.valueAsInt;
    }

    const dmaxTag = tag.find("DefaultMax");

    if (dmaxTag !== null) {
      this.defaultMaximum = dmaxTag.valueAsInt;
    }

    const baseTag = tag.find("Base");

    if (baseTag !== null) {
      this.base = baseTag.valueAsInt;
    }

    const currentTag = tag.find("Current");

    if (currentTag !== null) {
      this.current = currentTag.valueAsInt;
    }
  }
}
