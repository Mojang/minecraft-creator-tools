// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IEntityAction from "./IEventAction";
import { MinecraftFilterClauseSet } from "./jsoncommon/MinecraftFilterClauseSet";

export default class ManagedEventAction {
  _data?: IEntityAction;

  public constructor(data: IEntityAction) {
    this._data = data;
  }

  public toString() {
    if (this._data === undefined) {
      return "undefined";
    }

    return JSON.stringify(this._data);
  }

  public get filters() {
    return this._data?.filters;
  }

  public set filters(newFilters: MinecraftFilterClauseSet | undefined) {
    if (this._data) {
      this._data.filters = newFilters;
    }
  }

  public removeAddRemove() {
    if (!this._data) {
      return;
    }

    if (this._data.add) {
      this._data.add = undefined;
    }

    if (this._data.remove) {
      this._data.remove = undefined;
    }
  }

  public removeCommand() {
    if (!this._data) {
      return;
    }

    if (this._data.queue_command) {
      this._data.queue_command = undefined;
    }
  }

  public removeSound() {
    if (!this._data) {
      return;
    }

    if (this._data.play_sound) {
      this._data.play_sound = undefined;
    }
  }

  public removeVibration() {
    if (!this._data) {
      return;
    }

    if (this._data.emit_vibration) {
      this._data.emit_vibration = undefined;
    }
  }

  public removeParticle() {
    if (!this._data) {
      return;
    }

    if (this._data.emit_particle) {
      this._data.emit_particle = undefined;
    }
  }

  public removeTrigger() {
    if (!this._data) {
      return;
    }

    if (this._data.trigger) {
      this._data.trigger = undefined;
    }
  }

  public get hasAddRemove() {
    if (this._data && this._data.add && this._data.add.component_groups) {
      return true;
    }

    if (this._data && this._data.remove && this._data.remove.component_groups) {
      return true;
    }

    return false;
  }

  public get hasCommand() {
    if (this._data && this._data.queue_command && this._data.queue_command.command !== undefined) {
      return true;
    }

    return false;
  }

  public get hasSound() {
    if (this._data && this._data.play_sound && this._data.play_sound.sound !== undefined) {
      return true;
    }

    return false;
  }

  public get hasVibration() {
    if (this._data && this._data.emit_vibration && this._data.emit_vibration.vibration !== undefined) {
      return true;
    }

    return false;
  }

  public get hasParticle() {
    if (this._data && this._data.emit_particle && this._data.emit_particle.particle !== undefined) {
      return true;
    }

    return false;
  }

  public get hasTrigger() {
    if (this._data && this._data.trigger !== undefined) {
      return true;
    }

    return false;
  }

  public get command() {
    if (!this._data) {
      return "";
    }

    if (!this._data.queue_command) {
      return "";
    }

    if (!this._data.queue_command.command) {
      return "";
    }

    return this._data.queue_command.command;
  }

  public ensureCommand(commandStr?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!this._data.queue_command) {
      this._data.queue_command = {
        command: "",
      };
    }

    if (!this._data.queue_command?.command || commandStr) {
      this._data.queue_command.command = commandStr ? commandStr : "";
    }

    return this._data.queue_command;
  }

  public ensureSound(newSound?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!this._data.play_sound) {
      this._data.play_sound = {
        sound: "",
      };
    }

    if (!this._data.play_sound?.sound || newSound) {
      this._data.play_sound.sound = newSound ? newSound : "";
    }

    return this._data.play_sound;
  }

  public ensureVibration(newVibration?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!this._data.emit_vibration) {
      this._data.emit_vibration = {
        vibration: "",
      };
    }

    if (!this._data.emit_vibration?.vibration || newVibration) {
      this._data.emit_vibration.vibration = newVibration ? newVibration : "";
    }

    return this._data.emit_vibration;
  }

  public ensureTrigger(newTrigger?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!this._data.trigger) {
      this._data.trigger = newTrigger ? newTrigger : "";
    }

    return this._data.trigger;
  }

  public ensureParticle(newParticle?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!this._data.emit_particle) {
      this._data.emit_particle = {
        particle: "",
      };
    }

    if (!this._data.emit_particle?.particle || newParticle) {
      this._data.emit_particle.particle = newParticle ? newParticle : "";
    }

    return this._data.emit_particle;
  }

  public ensureAddRemove() {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    const action = this._data as IEntityAction;

    if (!action.add) {
      action.add = { component_groups: [] };
    }

    if (!action.add.component_groups) {
      action.add.component_groups = [];
    }

    if (!this._data.remove) {
      this._data.remove = { component_groups: [] };
    }

    if (!this._data.remove.component_groups) {
      this._data.remove.component_groups = [];
    }
  }

  public hasAddComponentGroup(id: string) {
    if (!this._data) {
      return false;
    }

    const action = this._data as IEntityAction;

    if (!action.add || !action.add.component_groups) {
      return false;
    }

    return action.add.component_groups.includes(id);
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

    this.ensureAddRemove();

    if (!this._data) {
      return;
    }

    const action = this._data as IEntityAction;

    if (!action.add || !action.add.component_groups) {
      return;
    }

    if (action.add.component_groups.includes(id)) {
      return;
    }

    action.add.component_groups.push(id);
  }

  public removeAddComponentGroup(id: string) {
    if (!this._data) {
      return false;
    }

    const action = this._data as IEntityAction;

    if (!action.add || !action.add.component_groups) {
      return false;
    }

    if (action.add.component_groups.includes(id)) {
      const newarr = [];

      for (const elt of action.add.component_groups) {
        if (elt !== id) {
          newarr.push(elt);
        }
      }

      action.add.component_groups = newarr;
      return true;
    }

    return false;
  }

  public hasRemoveComponentGroup(id: string) {
    if (!this._data) {
      return false;
    }

    const action = this._data as IEntityAction;

    if (!action.remove || !action.remove.component_groups) {
      return false;
    }

    return action.remove.component_groups.includes(id);
  }

  public ensureRemoveComponentGroup(id: string) {
    if (this.hasRemoveComponentGroup(id)) {
      return;
    }

    this.ensureAddRemove();

    if (!this._data) {
      return;
    }

    const action = this._data as IEntityAction;

    if (!action.remove || !action.remove.component_groups) {
      return;
    }

    if (action.remove.component_groups.includes(id)) {
      return;
    }

    action.remove.component_groups.push(id);
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
