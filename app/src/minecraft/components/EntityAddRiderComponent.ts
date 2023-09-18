import ComponentBase from "../ComponentBase";
import IEntityComponent from "../IEntityComponent";

/**
 * When added, this component makes the entity spawn with a
 * rider of the specified entityType.
 */
export class EntityAddRiderComponent extends ComponentBase implements IEntityComponent {
  /**
   * The type of entity that is added as a rider for this entity
   * when spawned under certain conditions.
   * @throws This property can throw when used.
   */
  readonly "entityType": string;

  /**
   * Optional spawn event to trigger on the rider when that rider
   * is spawned for this entity.
   * @throws This property can throw when used.
   */
  readonly "spawnEvent": string;
}
