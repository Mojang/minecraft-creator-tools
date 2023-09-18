import { IEntityTrigger } from "./IEntityTrigger";
import { IFilter } from "./IFilter";

export default interface IEntityEvent {
  sequence: IEntityEvent[] | undefined;
  add: { component_groups: string[] } | undefined;
  remove: { component_groups: string[] } | undefined;
  randomize: IEntityEvent[] | undefined;
  weight: number;
  filters: IFilter | undefined;
  trigger: IEntityTrigger | undefined;
}
