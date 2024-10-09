// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IEntityEvent from "./IEntityEvent";
import IManagedComponent from "./IManagedComponent";

export default class ManagedEvent {
  _data?: IEntityEvent;
  _managed?: { [id: string]: IManagedComponent | undefined };

  id: string;

  public constructor(data: IEntityEvent, id: string) {
    this._data = data;

    this._managed = {};

    this.id = id;
  }

  public toString() {
    if (this._data === undefined) {
      return "undefined";
    }

    return JSON.stringify(this._data);
  }

  public hasAddComponentGroup(id: string) {
    if (!this._data || !this._data.add || !this._data.add.component_groups) {
      return false;
    }

    if (this._data.add.component_groups.includes(id)) {
      return true;
    }

    return false;
  }

  public ensureData() {
    if (this._data === undefined) {
      this._data = {};
    }
  }

  public ensureAddComponentGroup(id: string) {
    if (this.hasAddComponentGroup(id)) {
      return;
    }

    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!this._data.add) {
      this._data.add = { component_groups: [] };
    }

    if (!this._data.add.component_groups) {
      this._data.add.component_groups = [];
    }

    if (this._data.add.component_groups.includes(id)) {
      return;
    }

    this._data.add.component_groups.push(id);
  }

  public removeAddComponentGroup(id: string) {
    if (!this._data || !this._data.add || !this._data.add.component_groups) {
      return false;
    }

    if (this._data.add.component_groups.includes(id)) {
      const newarr = [];

      for (const elt of this._data.add.component_groups) {
        if (elt !== id) {
          newarr.push(elt);
        }
      }

      this._data.add.component_groups = newarr;
      return true;
    }

    return false;
  }

  public hasRemoveComponentGroup(id: string) {
    if (!this._data || !this._data.remove || !this._data.remove.component_groups) {
      return false;
    }

    if (this._data.remove.component_groups.includes(id)) {
      return true;
    }

    return false;
  }

  public ensureRemoveComponentGroup(id: string) {
    if (this.hasRemoveComponentGroup(id)) {
      return;
    }

    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!this._data.remove) {
      this._data.remove = { component_groups: [] };
    }

    if (!this._data.remove.component_groups) {
      this._data.remove.component_groups = [];
    }

    if (this._data.remove.component_groups.includes(id)) {
      return;
    }

    this._data.remove.component_groups.push(id);
  }

  public removeRemoveComponentGroup(id: string) {
    if (!this._data || !this._data.remove || !this._data.remove.component_groups) {
      return false;
    }

    if (this._data.remove.component_groups.includes(id)) {
      const newarr = [];

      for (const elt of this._data.remove.component_groups) {
        if (elt !== id) {
          newarr.push(elt);
        }
      }

      this._data.remove.component_groups = newarr;

      return true;
    }

    return false;
  }
}
