import IWorldTestDefinition from "./IWorldTestDefinition";
import WorldTestArea from "./WorldTestArea";

export default class WorldTest {
  public data: IWorldTestDefinition;
  public areas: WorldTestArea[];

  #isLoaded: boolean;

  constructor(data: IWorldTestDefinition) {
    this.#isLoaded = false;
    this.areas = [];
    this.data = data;
  }

  public ensureLoaded() {
    if (this.data.areas) {
      for (const area of this.data.areas) {
        const areaWrap = new WorldTestArea(this, area);
        this.areas.push(areaWrap);
      }
    }

    this.#isLoaded = true;
  }

  public get isLoaded() {
    return this.#isLoaded;
  }

  public get worldId() {
    return this.data.worldId;
  }

  public set worldId(newWorldId: string | undefined) {
    this.data.worldId = newWorldId;
  }

  public get name() {
    if (this.data === undefined) {
      return "";
    }

    return this.data.name;
  }

  public set name(newName: string) {
    if (this.data === undefined) {
      return;
    }

    this.data.name = newName;
  }

  generateJavaScript() {
    return "";
  }

  generateGameTestJavaScript(name: string) {
    const scripts: string[] = [];

    scripts.push('import { register, registerAsync, Test, SimulatedPlayer } from "@minecraft/server-gametest";');
    scripts.push('import { BlockLocation, Location, world } from "@minecraft/server";');

    for (let i = 0; i < this.areas.length; i++) {
      const area = this.areas[i];

      scripts.push(area.generateGameTestJavaScript(area.title));
    }

    return scripts.join("\n");
  }

  generateCommandLine() {
    return "";
  }

  createArea(type: string) {
    const area = new WorldTestArea(this, { location: [], scripts: [] });

    if (area) {
      this.areas.push(area);

      if (!this.data.areas) {
        this.data.areas = [];
      }

      this.data.areas.push(area.data);
    }
  }
}
