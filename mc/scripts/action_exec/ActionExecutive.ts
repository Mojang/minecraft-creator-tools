import ActionGroup from "../app/actions/ActionGroup";
import BlockSetAction from "../app/actions/BlockSetAction";
import TestIdleAction from "../app/actions/TestIdleAction";
import EntitySpawnAction from "../app/actions/EntitySpawnAction";
import { ActionExecutiveContext } from "./ActionExecutiveContext";
import Action from "../app/actions/Action";
import { Dimension, GameMode, Vector3 } from "@minecraft/server";
import ParticleSpawnAction from "../app/actions/ParticleSpawnAction";
import TestSimulatedPlayerInteractionAction from "../app/actions/TestSimulatedPlayerInteractionAction";
import TestSimulatedPlayerSpawnAction from "../app/actions/TestSimulatedPlayerSpawnAction";

import * as gameTest from "@minecraft/server-gametest";
import TestSimulatedPlayerMoveAction from "../app/actions/TestSimulatedPlayerMoveAction";

export class ActionExecutive {
  static run(location: Vector3, dimension: Dimension, actionGroup: ActionGroup) {
    const context = new ActionExecutiveContext(location, dimension);

    this.execute(context, actionGroup);
  }

  static execute(context: ActionExecutiveContext, actionGroup: ActionGroup) {
    for (const action of actionGroup.actions) {
      if (action instanceof ActionGroup) {
        this.execute(context, action);
      } else {
        switch (action.type) {
          case "test_idle":
            this.testIdle(context, action as TestIdleAction);
            break;

          case "block_set":
            this.blockSet(context, action as BlockSetAction);
            break;

          case "entity_spawn":
            this.entitySpawn(context, action as EntitySpawnAction);
            break;

          case "particle_spawn":
            this.particleSpawn(context, action as ParticleSpawnAction);
            break;

          case "test_simulated_player_interaction":
            this.testSimulatedPlayerInteraction(context, action as TestSimulatedPlayerInteractionAction);
            break;

          case "test_simulated_player_spawn":
            this.testSimulatedPlayerSpawn(context, action as TestSimulatedPlayerSpawnAction);
            break;

          case "test_simulated_player_move":
            this.testSimulatedPlayerMove(context, action as TestSimulatedPlayerMoveAction);
            break;
        }
      }
    }
  }

  static testIdle(context: ActionExecutiveContext, action: TestIdleAction) {}

  static blockSet(context: ActionExecutiveContext, action: BlockSetAction) {
    const loc = action.getArgumentAsLocation("location");
  }

  static entitySpawn(context: ActionExecutiveContext, action: EntitySpawnAction) {
    const loc = ActionExecutive.getArgumentAsVector3(action, "location");
    const entityType = action.entityType;

    if (!loc || !entityType) {
      return;
    }

    context.dimension.spawnEntity(entityType, context.getAbsoluteLocation(loc));
  }

  static particleSpawn(context: ActionExecutiveContext, action: ParticleSpawnAction) {
    const loc = ActionExecutive.getArgumentAsVector3(action, "location");
    const particle = action.particleName;

    if (!loc || !particle) {
      return;
    }

    context.dimension.spawnParticle(particle, context.getAbsoluteLocation(loc));
  }

  static testSimulatedPlayerSpawn(context: ActionExecutiveContext, action: TestSimulatedPlayerSpawnAction) {
    const loc = ActionExecutive.getArgumentAsVector3(action, "location");
    const name = action.name;
    if (!loc || !name) {
      return;
    }

    const absLoc = context.getAbsoluteLocation(loc);
    console.warn("Spawning at " + JSON.stringify(absLoc));
    gameTest.spawnSimulatedPlayer(
      { x: absLoc.x, y: absLoc.y, z: absLoc.z, dimension: context.dimension },
      name,
      GameMode.Survival
    );
  }

  static testSimulatedPlayerMove(context: ActionExecutiveContext, action: TestSimulatedPlayerMoveAction) {
    const loc = ActionExecutive.getArgumentAsVector3(action, "location");
    const name = action.name;
    if (!loc || !name) {
      return;
    }

    const simPlayers = action.getSimulatedPlayer();

    for (const simPlayer of simPlayers) {
      simPlayer.moveToLocation(loc);
    }
  }

  static testSimulatedPlayerInteract(context: ActionExecutiveContext, action: TestSimulatedPlayerInteractionAction) {
    const loc = ActionExecutive.getArgumentAsVector3(action, "location");
    const name = action.name;
    if (!loc || !name) {
      return;
    }

    const simPlayers = action.getSimulatedPlayer();

    for (const simPlayer of simPlayers) {
      simPlayer.interact();
    }
  }

  static testSimulatedPlayerInteraction(
    context: ActionExecutiveContext,
    action: TestSimulatedPlayerInteractionAction
  ) {}

  static getArgumentAsVector3(action: Action, name: string): Vector3 | undefined {
    const val = (action.data as any)[name];

    if (val instanceof Array && val.length >= 3) {
      const loc = { x: val[0], y: val[1], z: val[2] };

      return loc;
    }

    return undefined;
  }
}
