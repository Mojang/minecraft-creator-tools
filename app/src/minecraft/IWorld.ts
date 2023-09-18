import Block from "./Block";
import BlockLocation from "./BlockLocation";
import Entity from "./Entity";
import EntityQueryOptions from "./EntityQueryOptions";
import IDimension from "./IDimension";

export default interface IWorld {
  /**
   * @remarks
   * Returns a property value.
   * @param key
   * Identifier of the property to remove.
   * @param isShared
   * @returns
   * Returns the value for the property, or undefined if the
   * property has not been set.
   */
  getCustomProperty(key: string, isShared?: boolean): number[] | boolean | number | string;

  /**
   * @param dimensionName
   * The name of the Dimension
   * @returns
   * The requested dimension
   * @throws
   * Throws if the given dimension name is invalid
   */
  getDimension(dimensionName: "overworld" | "nether" | "the end"): IDimension;

  /**
   * @remarks
   * Returns all players currently in the world.
   * @param options
   * @returns
   * All players currently in the world.
   * @throws This function can throw errors.
   */
  getPlayers(options?: EntityQueryOptions): Iterable<Entity>;

  /**
   * @remarks
   * Removes a specified property.
   * @param key
   * Identifier of the property to remove.
   * @param isShared
   */
  removeCustomProperty(key: string, isShared?: boolean): void;
  /**
   * @remarks
   * Sets a specified property to a value.
   * @param key
   * Identifier of the property to set.
   * @param value
   * Data value of the property to set.
   * @param isShared
   */
  setCustomProperty(key: string, value: number[] | boolean | number | string, isShared?: boolean): void;
}
