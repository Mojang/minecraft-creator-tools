import IWorldTestArea from "./IWorldTestArea";
import WorldTest from "./WorldTest.js";
import BlockLocation from "./../minecraft/BlockLocation";
import ActionSet from "../actions/ActionSet";
import { EventDispatcher } from "ste-events";
import ActionSetScriptGenerator from "../script/ActionSetScriptGenerator";
import { ActionSetTarget } from "../actions/IActionSetData";

export default class WorldTestArea {
  private _test: WorldTest;
  data: IWorldTestArea;
  public scripts: ActionSet[];
  private _location: BlockLocation | undefined;
  private _onPropertyChanged = new EventDispatcher<WorldTestArea, string>();

  getProperty(id: string): any {
    switch (id) {
      case "location":
        return this.location.toArray();
    }
  }

  setProperty(id: string, value: any): void {
    switch (id) {
      case "location":
        this.location = BlockLocation.from(value);
    }
  }

  getBaseValue(): any {
    return this.data;
  }

  setBaseValue(value: any): void {
    this.data = value;
  }

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  get location(): BlockLocation {
    if (!this._location) {
      let x = 0;
      let y = 0;
      let z = 0;

      if (this.data.location && this.data.location.length && this.data.location.length === 3) {
        x = this.data.location[0];
        y = this.data.location[1];
        z = this.data.location[2];
      }
      this._location = new BlockLocation(x, y, z);
    }

    return this._location;
  }

  set location(location: BlockLocation) {
    if (
      (!this._location && location) ||
      (this._location &&
        (this._location.x !== location.x || this._location.y !== location.y || this._location.z !== location.z))
    ) {
      this._location = location;

      for (let i = 0; i < this.scripts.length; i++) {
        this.scripts[i].locationRoot = this._location.toLocation();
      }

      this._onPropertyChanged.dispatch(this, "location");
    }
  }

  get title(): string {
    const loc = this.location;

    return "test" + loc.title;
  }

  constructor(test: WorldTest, data: IWorldTestArea) {
    this.scripts = [];
    this.data = data;
    this._test = test;
  }

  generateGameTestJavaScript(groupName: string) {
    const scripts: string[] = [];

    for (let i = 0; i < this.scripts.length; i++) {
      const script = this.scripts[i];

      let scriptName = groupName;
      if (this.scripts.length > 1) {
        scriptName += (i + 1).toString();
      }
      scripts.push(
        ActionSetScriptGenerator.generateGameTestJavaScript(script, scriptName, (i + 1).toString(), this._test.name)
      );
    }

    return scripts.join("\r\n");
  }

  createScript(type: string) {
    const as = new ActionSet({
      name: "Area Script",
      targetType: ActionSetTarget.worldTest,
      actions: [],
    });

    if (as) {
      if (this._location) {
        as.locationRoot = this._location.toLocation();
      }

      this.scripts.push(as);

      if (!this.data.scripts) {
        this.data.scripts = [];
      }

      this.data.scripts.push(as.actionSetData);
    }
  }
}
