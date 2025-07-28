import IManagedComponentSetItem from "./IManagedComponentSetItem";

export default interface IEntityTypeState {
  id: string;
  title: string;
  componentGroupAddRemoves: string[];
  isLikely: boolean;
  /* The concept of "likely" is fuzzy, but the idea is that although theoretically events can be triggered at any time -e.g., via a command - IF an event 
      is used in the context of a trigger or sensor, then we consider any usage outside of that context as "unlikely" (i.e., we're betting certain events
      are only designed for "internal" usage in the CG state machine) and we prune the tree of possible "likely in play" connections and states based on 
      this signal. This simplifies the graph by a lot.  If a state only has "unlikely" inbound connections, then we consider the state
      "unlikely" as well. At some point there will probably be a UX flag to show Unlikely states, and the concept of unlikely will probably grow
      more sophisticated than a boolean. I was expecting I'd need something more than a boolean by the first checkin, but here we are. */
  componentGroups: IManagedComponentSetItem[];
  inboundConnections: IEntityStateConnection[];
  outboundConnections: IEntityStateConnection[];
}

export interface IEntityStateConnection {
  source: IEntityTypeState;
  target?: IEntityTypeState;
  title: string;
  isLikely: boolean;
  triggerEventId: string;
  description?: string;
}
