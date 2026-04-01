// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IAnchorData from "./IAnchorData";
import IVector3 from "./IVector3";

export default class Anchor {
  data: IAnchorData;

  get from() {
    return this.data.from;
  }

  set from(newFrom: IVector3) {
    this.data.from = newFrom;
  }

  get to() {
    return this.data.to;
  }

  set to(newTo: IVector3 | undefined) {
    this.data.to = newTo;
  }

  get name() {
    return this.data.name;
  }

  set name(newName: string) {
    this.data.name = newName;
  }

  constructor(data?: IAnchorData) {
    if (data) {
      this.data = data;
    } else {
      this.data = {
        from: { x: 0, y: 0, z: 0 },
        to: { x: 0, y: 0, z: 0 },
        name: "",
      };
    }
  }
}
