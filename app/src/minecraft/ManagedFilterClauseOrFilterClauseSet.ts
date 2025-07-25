import Utilities from "../core/Utilities";
import { MinecraftFilterClause } from "./jsoncommon/MinecraftFilterClause";
import { MinecraftFilterClauseSet } from "./jsoncommon/MinecraftFilterClauseSet";

export default class ManagedFilterClauseOrFilterClauseSet {
  private _data: MinecraftFilterClause | MinecraftFilterClauseSet;

  constructor(data: MinecraftFilterClause | MinecraftFilterClauseSet) {
    this._data = data;
  }

  get test() {
    if (!this._data) {
      return undefined;
    }

    return (this._data as MinecraftFilterClause).test;
  }

  get operator() {
    if (!this._data) {
      return undefined;
    }

    return (this._data as MinecraftFilterClause).operator;
  }

  get subject() {
    if (!this._data) {
      return undefined;
    }

    return (this._data as MinecraftFilterClause).subject;
  }

  get value() {
    if (!this._data) {
      return undefined;
    }

    return (this._data as MinecraftFilterClause).value;
  }

  get anyOf() {
    if (!this._data) {
      return undefined;
    }

    const anyOfData = (this._data as MinecraftFilterClauseSet).any_of;

    if (!anyOfData) {
      return undefined;
    }

    let anyOfs: ManagedFilterClauseOrFilterClauseSet[] = [];

    for (const dataNode of anyOfData) {
      anyOfs.push(new ManagedFilterClauseOrFilterClauseSet(dataNode));
    }

    return anyOfs;
  }

  get allOf() {
    if (!this._data) {
      return undefined;
    }

    const allOfData = (this._data as MinecraftFilterClauseSet).all_of;

    if (!allOfData) {
      return undefined;
    }

    let allOfs: ManagedFilterClauseOrFilterClauseSet[] = [];

    for (const dataNode of allOfData) {
      allOfs.push(new ManagedFilterClauseOrFilterClauseSet(dataNode));
    }

    return allOfs;
  }

  getHumanSummary() {
    let results = "";

    if (this.anyOf) {
      results += "Any condition must match:";

      for (const anyOfNode of this.anyOf) {
        results += anyOfNode.getHumanSummary();
      }
    } else if (this.allOf) {
      results += "All conditions must match:";

      for (const allOfNode of this.allOf) {
        results += allOfNode.getHumanSummary();
      }
    } else if (this.test) {
      results += Utilities.humanifyMinecraftName(this.test);

      if (this.operator) {
        results += " " + this.operator;
      }

      if (this.value) {
        results += " " + this.value;
      }
    }

    return results;
  }
}
