import Utilities from "../core/Utilities";
import EntityTypeComponentSetUtilities, { TriggerDescription } from "./EntityTypeComponentSetUtilities";
import EntityTypeDefinition from "./EntityTypeDefinition";
import IEntityTypeState, { IEntityStateConnection } from "./IEntityTypeState";
import IManagedComponentSetItem from "./IManagedComponentSetItem";
import ManagedComponentGroup from "./ManagedComponentGroup";
import ManagedEventActionOrActionSet from "./ManagedEventActionOrActionSet";

export const MaxStatesToProcess = 1024;

class EntityTypeStateBuilderContext {
  entityType: EntityTypeDefinition;

  baseTriggers: TriggerDescription[] = [];
  eventsById: { [eventId: string]: ManagedEventActionOrActionSet } = {};

  states: Map<string, IEntityTypeState> = new Map();

  constructor(entityTypeParent: EntityTypeDefinition) {
    this.entityType = entityTypeParent;
  }
}

export class EntityTypeStateBuilder {
  static async getStates(entityType: EntityTypeDefinition) {
    const context = new EntityTypeStateBuilderContext(entityType);

    context.baseTriggers = await EntityTypeComponentSetUtilities.getTriggers(entityType, true);
    const events = context.entityType.getEvents();

    for (const ev of events) {
      if (ev.event && ev.id) {
        const mea = new ManagedEventActionOrActionSet(ev.event);
        context.eventsById[ev.id] = mea;
      }
    }

    await EntityTypeStateBuilder.considerState(context, entityType, []);

    const stateKeys = context.states.keys();

    for (const stateId of stateKeys) {
      const state = context.states.get(stateId);

      if (state && !state.isLikely) {
        for (const conn of state.outboundConnections) {
          conn.isLikely = false;
        }
      }
    }

    for (const stateId of stateKeys) {
      const state = context.states.get(stateId);
      if (state && state.isLikely) {
        let foundALikely = false;

        for (const conn of state.outboundConnections) {
          if (conn.isLikely) {
            foundALikely = true;
          }
        }
        for (const conn of state.inboundConnections) {
          if (conn.isLikely) {
            foundALikely = true;
          }
        }

        if (!foundALikely) {
          state.isLikely = false;
        }
      }
    }

    return context.states;
  }

  static removeGroupInArray(arr: string[], groupId: string) {
    const newArr: string[] = [];

    for (const str of arr) {
      if (str.substring(1) !== groupId) {
        newArr.push(str);
      }
    }

    return newArr;
  }

  static async considerState(
    context: EntityTypeStateBuilderContext,
    componentSet: IManagedComponentSetItem,
    cgAddsRemoveList: string[],
    inboundConnection?: IEntityStateConnection
  ) {
    let stateId = "";

    if (componentSet !== context.entityType) {
      stateId = componentSet.id;
    }

    stateId += "|" + cgAddsRemoveList.join("|");

    const targetState = context.states.get(stateId);

    if (targetState) {
      if (inboundConnection && inboundConnection.source !== targetState) {
        inboundConnection.target = targetState;
        if (inboundConnection.isLikely) {
          targetState.isLikely = true;
        }
        targetState.inboundConnections.push(inboundConnection);
      }

      return;
    }

    const effectiveComponents = context.entityType.getEffectiveComponents(cgAddsRemoveList);
    const triggers = await EntityTypeComponentSetUtilities.getTriggers(
      effectiveComponents,
      cgAddsRemoveList.length === 0
    );
    const triggersByTarget: { [name: string]: TriggerDescription } = {};

    for (const trigger of triggers) {
      if (trigger.referenceId) {
        triggersByTarget[trigger.referenceId] = trigger;
      }
    }

    let stateTitle = "";
    const etTitle = Utilities.humanifyMinecraftNameRemoveNamespaces(context.entityType.id);
    const managedComponentGroups: ManagedComponentGroup[] = [];

    for (const cgId of cgAddsRemoveList) {
      const cg = context.entityType.getComponentGroup(cgId.substring(1));

      let idTitle = "";

      if (cg) {
        idTitle = Utilities.humanifyMinecraftNameRemoveNamespaces(cg.id.substring(1));
      } else {
        idTitle = Utilities.humanifyMinecraftNameRemoveNamespaces(cgId.substring(1)) + " (missing!)";
      }

      if (cgId[0] === "+") {
        stateTitle += " +" + idTitle;
      } else if (cgId[0] === "-") {
        stateTitle += " -" + idTitle;
      }
    }

    stateTitle = etTitle + ": " + stateTitle;

    stateTitle = stateTitle.trim();

    const state: IEntityTypeState = {
      id: stateId,
      title: stateTitle,
      isLikely: false,
      componentGroupAddRemoves: cgAddsRemoveList,
      componentGroups: managedComponentGroups,
      inboundConnections: [],
      outboundConnections: [],
    };

    context.states.set(stateId, state);

    if (inboundConnection) {
      inboundConnection.target = state;
      if (inboundConnection.isLikely) {
        state.isLikely = true;
      }
      state.inboundConnections.push(inboundConnection);
    }

    if (context.states.size >= MaxStatesToProcess) {
      return;
    }

    for (const evId in context.eventsById) {
      const ev = context.eventsById[evId];

      if (ev) {
        let isLikely = false;

        if (triggersByTarget[evId]) {
          isLikely = true;
        }

        const actions = ev.getPotentialActions();

        for (const action of actions) {
          // is this an event that changes group state? if not, ignore
          if (
            (action.action.addGroups && action.action.addGroups.length > 0) ||
            (action.action.removeGroups && action.action.removeGroups.length > 0)
          ) {
            let newComponentGroupAddRemoves = cgAddsRemoveList.slice();

            if (ev.removeGroups) {
              for (const cg of ev.removeGroups) {
                newComponentGroupAddRemoves = EntityTypeStateBuilder.removeGroupInArray(
                  newComponentGroupAddRemoves,
                  cg
                );

                newComponentGroupAddRemoves.push("-" + cg);
              }
            }

            if (ev.addGroups) {
              for (const cg of ev.addGroups) {
                newComponentGroupAddRemoves = EntityTypeStateBuilder.removeGroupInArray(
                  newComponentGroupAddRemoves,
                  cg
                );

                newComponentGroupAddRemoves.push("+" + cg);
              }
            }

            if (newComponentGroupAddRemoves.join("|") !== cgAddsRemoveList.join("|")) {
              const connection: IEntityStateConnection = {
                source: state,
                triggerEventId: evId,
                isLikely: isLikely,
                title: Utilities.humanifyMinecraftName(evId),
                description: action.conditionDescription,
              };

              state.outboundConnections.push(connection);

              if (context.states.size < MaxStatesToProcess) {
                await this.considerState(context, context.entityType, newComponentGroupAddRemoves, connection);
              }
            }
          }
        }
      }
    }
  }
}
