// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import Utilities from "../core/Utilities";
import Anchor from "./Anchor";
import IAnchorData from "./IAnchorData";
import IVector3 from "./IVector3";

export default class AnchorSet {
  data: { [name: string]: IAnchorData | undefined } = {};
  anchors: { [name: string]: Anchor | undefined } = {};

  clear(anchorName: string) {
    const exists = this.data[anchorName] !== undefined || this.anchors[anchorName] !== undefined;

    if (Utilities.isUsableAsObjectKey(anchorName)) {
      this.data[anchorName] = undefined;
      this.anchors[anchorName] = undefined;
    }

    return exists;
  }

  clearAll() {
    this.data = {};
    this.anchors = {};
  }

  getLength() {
    let count = 0;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const strKey in this.data) {
      count++;
    }

    return count;
  }

  getKeys() {
    const keyArr = [];

    for (const strKey in this.data) {
      keyArr.push(strKey);
    }

    return keyArr;
  }

  get(name: string) {
    if (!Utilities.isUsableAsObjectKey(name)) {
      throw new Error();
    }

    if (this.anchors[name]) {
      return this.anchors[name];
    }

    if (this.data[name]) {
      this.anchors[name] = new Anchor(this.data[name]);

      return this.anchors[name];
    }

    return undefined;
  }

  ensure(name: string, from: IVector3, to?: IVector3) {
    let anchor: Anchor | undefined;
    if (!Utilities.isUsableAsObjectKey(name)) {
      throw new Error();
    }

    if (this.anchors[name]) {
      anchor = this.anchors[name];
    }

    if (!anchor && this.data[name]) {
      this.anchors[name] = new Anchor(this.data[name]);

      anchor = this.anchors[name];
    }

    if (!anchor) {
      this.data[name] = {
        from: from,
        to: to,
        name: name,
      };

      this.anchors[name] = new Anchor(this.data[name]);

      anchor = this.anchors[name];
    }

    if (anchor) {
      anchor.from = from;
      anchor.to = to;
      anchor.name = name;
    }

    return anchor;
  }

  getAsString() {
    return JSON.stringify(this.data);
  }

  fromString(incomingStr: string) {
    try {
      this.data = JSON.parse(incomingStr);
    } catch (e) {}
  }
}
