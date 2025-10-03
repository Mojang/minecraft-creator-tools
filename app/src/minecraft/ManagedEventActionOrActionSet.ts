// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import IEntityAction from "./IEventAction";
import IEntityActionSet from "./IEventActionSet";
import { MinecraftFilterClauseSet } from "./jsoncommon/MinecraftFilterClauseSet";
import ManagedFilterClauseOrFilterClauseSet from "./ManagedFilterClauseOrFilterClauseSet";

export interface IPotentialAction {
  conditionDescription: string;
  action: ManagedEventActionOrActionSet;
}

export default class ManagedEventActionOrActionSet {
  _data?: IEntityAction | IEntityActionSet;

  get data() {
    return this._data;
  }

  get addGroups() {
    if (!this._data) {
      return undefined;
    }

    const addGroups = (this._data as IEntityAction).add;

    if (!addGroups) {
      return undefined;
    }

    return addGroups.component_groups;
  }

  get removeGroups() {
    if (!this._data) {
      return undefined;
    }

    const removeGroups = (this._data as IEntityAction).remove;

    if (!removeGroups) {
      return undefined;
    }

    return removeGroups.component_groups;
  }

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
    if (!this._data) {
      return undefined;
    }

    return (this._data as IEntityAction).filters;
  }

  public set filters(newFilters: MinecraftFilterClauseSet | undefined) {
    if (this._data) {
      (this._data as IEntityAction).filters = newFilters;
    }
  }

  public removeAddRemove() {
    if (!this._data) {
      return;
    }

    if ((this._data as IEntityAction).add) {
      (this._data as IEntityAction).add = undefined;
    }

    if ((this._data as IEntityAction).remove) {
      (this._data as IEntityAction).remove = undefined;
    }
  }

  public removeCommand() {
    if (!this._data) {
      return;
    }

    if ((this._data as IEntityAction).queue_command) {
      (this._data as IEntityAction).queue_command = undefined;
    }
  }

  public removeSound() {
    if (!this._data) {
      return;
    }

    if ((this._data as IEntityAction).play_sound) {
      (this._data as IEntityAction).play_sound = undefined;
    }
  }

  public removeVibration() {
    if (!this._data) {
      return;
    }

    if ((this._data as IEntityAction).emit_vibration) {
      (this._data as IEntityAction).emit_vibration = undefined;
    }
  }

  public removeParticle() {
    if (!this._data) {
      return;
    }

    if ((this._data as IEntityAction).emit_particle) {
      (this._data as IEntityAction).emit_particle = undefined;
    }
  }

  public removeTrigger() {
    if (!this._data) {
      return;
    }

    if ((this._data as IEntityAction).trigger) {
      (this._data as IEntityAction).trigger = undefined;
    }
  }

  public get hasAddRemove() {
    return this.addGroups || this.removeGroups;
  }

  public get hasCommand() {
    return this.command !== undefined;
  }

  public get sound(): string | undefined {
    if (!this._data) {
      return undefined;
    }

    const playSound = (this._data as IEntityAction).play_sound;

    if (!playSound) {
      return undefined;
    }

    return playSound.sound;
  }

  public get hasSound() {
    return this.sound !== undefined;
  }

  public get vibration() {
    if (!this._data) {
      return undefined;
    }

    const emitVibration = (this._data as IEntityAction).emit_vibration;

    if (!emitVibration) {
      return undefined;
    }

    return emitVibration.vibration;
  }

  public get hasVibration() {
    return this.vibration !== undefined;
  }

  public get particle() {
    if (!this._data) {
      return undefined;
    }

    const emitParticle = (this._data as IEntityAction).emit_particle;

    if (!emitParticle) {
      return undefined;
    }

    return emitParticle.particle;
  }

  public get hasParticle() {
    return this.particle !== undefined;
  }

  public get trigger() {
    if (!this._data) {
      return undefined;
    }

    return (this._data as IEntityAction).trigger;
  }

  public get hasTrigger() {
    return this.trigger !== undefined;
  }

  public get command() {
    if (!this._data) {
      return "";
    }

    const queueCommand = (this._data as IEntityAction).queue_command;
    if (!queueCommand) {
      return "";
    }

    if (!queueCommand.command) {
      return "";
    }

    return queueCommand.command;
  }

  public ensureCommand(commandStr?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    let queueCommand = (this._data as IEntityAction).queue_command;

    if (!queueCommand) {
      queueCommand = {
        command: "",
      };
      (this._data as IEntityAction).queue_command = queueCommand;
    }

    if (!queueCommand.command || commandStr) {
      queueCommand.command = commandStr ? commandStr : "";
    }

    return queueCommand;
  }

  public ensureSound(newSound?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    let playSound = (this._data as IEntityAction).play_sound;

    if (!playSound) {
      playSound = {
        sound: "",
      };
      (this._data as IEntityAction).play_sound = playSound;
    }

    if (!playSound.sound || newSound) {
      playSound.sound = newSound ? newSound : "";
    }

    return playSound;
  }

  public ensureVibration(newVibration?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    let emitVibration = (this._data as IEntityAction).emit_vibration;

    if (!emitVibration) {
      emitVibration = {
        vibration: "",
      };

      (this._data as IEntityAction).emit_vibration = emitVibration;
    }

    if (!emitVibration.vibration || newVibration) {
      emitVibration.vibration = newVibration ? newVibration : "";
    }

    return emitVibration;
  }

  public get randomize() {
    if (!this._data) {
      return undefined;
    }

    const randomize = (this._data as IEntityActionSet).randomize;

    if (!randomize || !Array.isArray(randomize)) {
      return undefined;
    }

    const managedRandomizeNodes: ManagedEventActionOrActionSet[] = [];

    for (const node of randomize) {
      managedRandomizeNodes.push(new ManagedEventActionOrActionSet(node));
    }

    return managedRandomizeNodes;
  }

  public get weight() {
    if (!this._data) {
      return undefined;
    }

    return (this._data as IEntityAction).weight;
  }

  public get sequence() {
    if (!this._data) {
      return undefined;
    }

    const sequence = (this._data as IEntityActionSet).sequence;

    if (!sequence || !Array.isArray(sequence)) {
      return undefined;
    }

    const managedSequenceNodes: ManagedEventActionOrActionSet[] = [];

    for (const node of sequence) {
      managedSequenceNodes.push(new ManagedEventActionOrActionSet(node));
    }

    return managedSequenceNodes;
  }

  public ensureTrigger(newTrigger?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    if (!(this._data as IEntityAction).trigger) {
      (this._data as IEntityAction).trigger = newTrigger ? newTrigger : "";
    }

    return (this._data as IEntityAction).trigger;
  }

  public getPotentialActions(conditionSeed?: string): IPotentialAction[] {
    if (!this._data) {
      return [];
    }

    if (!conditionSeed) {
      conditionSeed = "";
    }

    const randomize = this.randomize;
    const sequence = this.sequence;

    if (randomize && Array.isArray(randomize)) {
      const actions: IPotentialAction[] = [];

      for (const randomNode of randomize) {
        if (randomNode.filters) {
          const managedFilter = new ManagedFilterClauseOrFilterClauseSet(randomNode.filters);

          conditionSeed += managedFilter.getHumanSummary();
        }
        if (randomNode.weight) {
          conditionSeed += "randomly chosen with a weight of " + randomNode.weight;
        } else {
          conditionSeed += "randomly chosen ";
        }

        actions.push(...randomNode.getPotentialActions(conditionSeed));
      }
    } else if (sequence && Array.isArray(sequence)) {
      const actions: IPotentialAction[] = [];

      for (const sequenceNode of sequence) {
        if (sequenceNode.filters) {
          const managedFilter = new ManagedFilterClauseOrFilterClauseSet(sequenceNode.filters);

          conditionSeed += managedFilter.getHumanSummary();
        }

        conditionSeed += "runs ";

        actions.push(...sequenceNode.getPotentialActions(conditionSeed));
      }
    }

    return [
      {
        conditionDescription: conditionSeed + " fires",
        action: this,
      },
    ];
  }

  public ensureParticle(newParticle?: string) {
    if (!this._data) {
      this.ensureData();
    }

    if (!this._data) {
      return;
    }

    let emitParticle = (this._data as IEntityAction).emit_particle;

    if (!emitParticle) {
      emitParticle = {
        particle: "",
      };

      (this._data as IEntityAction).emit_particle = emitParticle;
    }

    if (!emitParticle.particle || newParticle) {
      emitParticle.particle = newParticle ? newParticle : "";
    }

    return emitParticle;
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

    if (!action.remove) {
      action.remove = { component_groups: [] };
    }

    if (!action.remove.component_groups) {
      action.remove.component_groups = [];
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

    if (!action.add || !action.add.component_groups || !Array.isArray(action.add.component_groups)) {
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
    if (!this._data) {
      return false;
    }

    const remove = (this._data as IEntityAction).remove;

    if (!remove || !remove.component_groups || !Array.isArray(remove.component_groups)) {
      return false;
    }

    if (remove.component_groups.includes(id)) {
      const newarr = [];

      for (const elt of remove.component_groups) {
        if (elt !== id) {
          newarr.push(elt);
        }
      }

      remove.component_groups = newarr;

      return true;
    }

    return false;
  }
}
