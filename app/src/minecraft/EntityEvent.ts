import IEntityEvent from "./IEntityEvent";

export default class EntityEvent {
  #data: IEntityEvent;

  constructor(entityEvent: IEntityEvent) {
    this.#data = entityEvent;
  }
}
