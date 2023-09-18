import Block from "./Block";
import BlockLocation from "./BlockLocation";
import Entity from "./Entity";

export default interface IDimension {
  getBlock(location: BlockLocation): Block;
  spawnEntity(entityTypeId: string, location: BlockLocation): Entity;
}
