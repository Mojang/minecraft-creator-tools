import Block from "../minecraft/Block";
import BlockLocation from "../minecraft/BlockLocation";
import BlockRaycastOptions from "../minecraft/BlockRaycastOptions";
import Effect from "../minecraft/Effect";
import EffectType from "../minecraft/EffectType";
import Entity from "../minecraft/Entity";
import EntityRaycastOptions from "../minecraft/EntityRaycastOptions";
import { GameMode } from "../minecraft/GameMode";
import IDimension from "../minecraft/IDimension";
import IEntityComponent from "../minecraft/IEntityComponent";
import ItemStack from "../minecraft/ItemStack";
import { NavigationResult } from "../minecraft/NavigationResult";
import PitchYawRotation from "../minecraft/PitchYawRotation";
import Player from "../minecraft/Player";
import Location from "../minecraft/Location";

/**
 * A simulated player can be used within GameTests to represent
 * how a player moves throughout the world and to support
 * testing of how entities and the environment will react to a
 * player. This type derives much of its structure and methods
 * from the {@link mojang-minecraft.Player} type.
 */
export default class SimulatedPlayer extends Player {
  /**
   * Rotation of the body in degrees. Range is between -180 and
   * 180 degrees.
   * @throws This property can throw when used.
   */
  readonly "bodyRotation": number;
  /**
   * Dimension that the simulated player is currently within.
   * @throws This property can throw when used.
   */
  readonly "dimension": IDimension;
  /**
   * Rotation of the head across pitch and yaw angles.
   * @throws This property can throw when used.
   */
  readonly "headRotation": PitchYawRotation;
  /**
   * True if the player is currently using a sneaking movement.
   */
  "isSneaking": boolean;
  /**
   * Current location of the player.
   * @throws This property can throw when used.
   */
  readonly "location": Location;
  /**
   * Name of the player.
   * @throws This property can throw when used.
   */
  readonly "name": string;
  /**
   * Optional name tag of the player.
   */
  "nameTag": string;
  /**
   * Manages the selected slot in the player's hotbar.
   */
  "selectedSlot": number;
  /**
   * Retrieves or sets an entity that is used as the target of
   * AI-related behaviors, like attacking.
   */
  "target": Entity;
  /**
   * Current speed of the player across X, Y, and Z dimensions.
   * @throws This property can throw when used.
   */
  readonly "velocity": Location;
  /**
   * @remarks
   * Adds an effect, like poison, to the entity.
   * @param effectType
   * Type of effect to add to the entity.
   * @param duration
   * Amount of time, in seconds, for the effect to apply.
   * @param amplifier
   * Optional amplification of the effect to apply.
   * @throws This function can throw errors.
   */
  addEffect(effectType: EffectType, duration: number, amplifier: number): void {}
  /**
   * @remarks
   * Adds a specified tag to a simulated player.
   * @param tag
   * Content of the tag to add.
   * @throws This function can throw errors.
   */
  addTag(tag: string): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to make an attack 'swipe'.
   * Returns true if the attack was performed - for example, the
   * player was not on cooldown and had a valid target. Target
   * selection is performed by raycasting from the player's head.
   * @throws This function can throw errors.
   */
  attack(): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to attack the provided target.
   * Returns true if the attack was performed - for example, the
   * player was not on cooldown and had a valid target. The
   * attack can be performed at any distance and does not require
   * line of sight to the target entity.
   * @param entity
   * @throws This function can throw errors.
   */
  attackEntity(entity: Entity): boolean {
    return false;
  }
  /**
   * @remarks
   * Destroys the block at blockLocation, respecting the rules of
   * the server player's game mode. The block will be hit until
   * broken, an item is used or stopBreakingBlock is called.
   * Returns true if the block at blockLocation is solid.
   * @param blockLocation
   * Location of the block to interact with.
   * @param direction
   * Direction to place the specified item within.
   * @throws This function can throw errors.
   */
  breakBlock(blockLocation: BlockLocation, direction?: number): boolean {
    return false;
  }
  /**
   * @remarks
   * Gets the first block that intersects with the vector of the
   * view of this entity.
   * @param options
   * Additional options for processing this raycast query.
   * @throws This function can throw errors.
   */
  getBlockFromViewVector(options?: BlockRaycastOptions): Block {
    return new Block();
  }
  /**
   * @remarks
   * Gets a component (that represents additional capabilities)
   * for an entity.
   * @param componentId
   * The identifier of the component (e.g., 'minecraft:rideable')
   * to retrieve. If no namespace prefix is specified,
   * 'minecraft:' is assumed. If the component is not present on
   * the entity, undefined is returned.
   */
  getComponent(componentId: string): IEntityComponent | undefined {
    return undefined;
  }
  /**
   * @remarks
   * Returns all components that are both present on this entity
   * and supported by the API.
   */
  getComponents(): IEntityComponent[] {
    return [];
  }
  /**
   * @remarks
   * Returns the effect for the specified EffectType on the
   * entity, or undefined if the effect is not present.
   * @param effectType
   * @returns
   * Effect object for the specified effect, or undefined if the
   * effect is not present.
   * @throws This function can throw errors.
   */
  getEffect(effectType: EffectType): Effect {
    return new Effect();
  }
  /**
   * @remarks
   * Gets the first entity that intersects with the vector of the
   * view of this entity.
   * @param options
   * Additional options for processing this raycast query.
   * @throws This function can throw errors.
   */
  getEntitiesFromViewVector(options?: EntityRaycastOptions): Entity[] {
    return [];
  }
  /**
   * @remarks
   * Gets the current item cooldown time for a particular
   * cooldown category.
   * @param itemCategory
   * Specifies the cooldown category to retrieve the current
   * cooldown for.
   * @throws This function can throw errors.
   */
  getItemCooldown(itemCategory: string): number {
    return 0;
  }
  /**
   * @remarks
   * Returns all tags associated with this simulated player.
   * @throws This function can throw errors.
   */
  getTags(): string[] {
    return [];
  }
  /**
   * @remarks
   * Gives the simulated player a particular item stack.
   * @param itemStack
   * Item to give.
   * @param selectSlot
   * Whether to set the selected slot once given.
   * @throws This function can throw errors.
   */
  giveItem(itemStack: ItemStack, selectSlot?: boolean): boolean {
    return false;
  }
  /**
   * @remarks
   * Returns true if the specified component is present on this
   * entity.
   * @param componentId
   * The identifier of the component (e.g., 'minecraft:rideable')
   * to retrieve. If no namespace prefix is specified,
   * 'minecraft:' is assumed.
   */
  hasComponent(componentId: string): boolean {
    return false;
  }
  /**
   * @remarks
   * Tests whether a simulated player has a particular tag.
   * @param tag
   * Identifier of the tag to test for.
   * @throws This function can throw errors.
   */
  hasTag(tag: string): boolean {
    return false;
  }
  /**
   * @remarks
   * Performs a raycast from the player’s head and interacts with
   * the first intersected block or entity. Returns true if the
   * interaction was successful. Maximum range is 6 blocks.
   * @throws This function can throw errors.
   */
  interact(): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to interact with a block. The
   * block at the specified block location must be solid. Returns
   * true if the interaction was performed.
   * @param blockLocation
   * Location of the block to interact with.
   * @param direction
   * Direction to place the specified item within.
   * @throws This function can throw errors.
   */
  interactWithBlock(blockLocation: BlockLocation, direction?: number): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to interact with a mob. Returns
   * true if the interaction was performed.
   * @param entity
   * Entity to interact with.
   * @throws This function can throw errors.
   */
  interactWithEntity(entity: Entity): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to jump.
   * @returns
   * True if a jump was performed.
   * @throws This function can throw errors.
   */
  jump(): boolean {
    return false;
  }
  /**
   * @remarks
   * Kills this entity. The entity will drop loot as normal.
   * @throws This function can throw errors.
   */
  kill(): void {}
  /**
   * @remarks
   * Rotates the simulated player's head/body to look at the
   * given block location.
   * @param blockLocation
   * @throws This function can throw errors.
   */
  lookAtBlock(blockLocation: BlockLocation): void {}
  /**
   * @remarks
   * Rotates the simulated player's head/body to look at the
   * given entity.
   * @param entity
   * @throws This function can throw errors.
   */
  lookAtEntity(entity: Entity): void {}
  /**
   * @remarks
   * Rotates the simulated player's head/body to look at the
   * given location.
   * @param location
   * @throws This function can throw errors.
   */
  lookAtLocation(location: Location): void {}
  /**
   * @remarks
   * Orders the simulated player to walk in the given direction
   * relative to the GameTest.
   * @param westEast
   * @param northSouth
   * @param speed
   * @throws This function can throw errors.
   */
  move(westEast: number, northSouth: number, speed?: number): void {}
  /**
   * @remarks
   * Orders the simulated player to walk in the given direction
   * relative to the player's current rotation.
   * @param leftRight
   * @param backwardForward
   * @param speed
   * @throws This function can throw errors.
   */
  moveRelative(leftRight: number, backwardForward: number, speed?: number): void {}
  /**
   * @remarks
   * Orders the simulated player to move to the given block
   * location in a straight line. If a move or navigation is
   * already playing, this will override the last
   * move/navigation.
   * @param blockLocation
   * @param speed
   * @throws This function can throw errors.
   */
  moveToBlock(blockLocation: BlockLocation, speed?: number): void {}
  /**
   * @remarks
   * Orders the simulated player to move to the given location in
   * a straight line. If a move or navigation is already playing,
   * this will override the last move/navigation.
   * @param location
   * @param speed
   * @throws This function can throw errors.
   */
  moveToLocation(location: Location, speed?: number): void {}
  /**
   * @remarks
   * Orders the simulated player to move to a specific block
   * location using navigation. If a move or navigation is
   * already playing, this will override the last move/walk. Note
   * that if the simulated player gets stuck, that simulated
   * player will stop. The player must be touching the ground in
   * order to start navigation.
   * @param blockLocation
   * @param speed
   * @throws This function can throw errors.
   */
  navigateToBlock(blockLocation: BlockLocation, speed?: number): NavigationResult {
    return new NavigationResult();
  }
  /**
   * @remarks
   * Will use navigation to follow the selected entity to within
   * a one block radius. If a move or navigation is already
   * playing, this will override the last move/navigation.
   * @param entity
   * @param speed
   * @throws This function can throw errors.
   */
  navigateToEntity(entity: Entity, speed?: number): NavigationResult {
    return new NavigationResult();
  }
  /**
   * @remarks
   * Orders the simulated player to move to a specific location
   * using navigation. If a move or navigation is already
   * playing, this will override the last move/walk. Note that if
   * the simulated player gets stuck, that simulated player will
   * stop. The player must be touching the ground in order to
   * start navigation.
   * @param location
   * @param speed
   * @throws This function can throw errors.
   */
  navigateToLocation(location: Location, speed?: number): NavigationResult {
    return new NavigationResult();
  }
  /**
   * @remarks
   * Use navigation to follow the route provided via the
   * locations parameter. If a move or navigation is already
   * playing, this will override the last move/navigation.
   * @param locations
   * A list of locations to use for routing.
   * @param speed
   * Net speed to use for doing the navigation.
   * @throws This function can throw errors.
   */
  navigateToLocations(locations: Location[], speed?: number): void {
    return;
  }
  /**
   * @remarks
   * Removes a specified tag from a simulated player.
   * @param tag
   * Content of the tag to remove.
   * @throws This function can throw errors.
   */
  removeTag(tag: string): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to turn by the provided angle,
   * relative to the player's current rotation.
   * @param angleInDegrees
   * @throws This function can throw errors.
   */
  rotateBody(angleInDegrees: number): void {}
  /**
   * @remarks
   * Runs a particular command from the context of this simulated
   * player.
   * @param commandString
   * Command to run. Note that command strings should not start
   * with slash.
   * @returns
   * For commands that return data, returns a JSON structure with
   * command response values.
   * @throws This function can throw errors.
   * @example commands.js
   * ```typescript
   *        player.runCommand("say You got a new high score!");
   *        player.runCommand("scoreboard players set @s score 10");
   *
   * ```
   */
  runCommand(commandString: string): any {
    return undefined;
  }
  /**
   * @remarks
   * Causes the simulated player to turn to face the provided
   * angle, relative to the GameTest.
   * @param angleInDegrees
   * @throws This function can throw errors.
   */
  setBodyRotation(angleInDegrees: number): void {}
  /**
   * @remarks
   * Sets the game mode that the simulated player is operating
   * under.
   * @param gameMode
   * Game mode to set.
   * @throws This function can throw errors.
   */
  setGameMode(gameMode: GameMode): void {}
  /**
   * @remarks
   * Sets a particular item for the simulated player.
   * @param itemStack
   * Item to set.
   * @param slot
   * Slot to place the given item in.
   * @param selectSlot
   * Whether to set the selected slot once set.
   * @throws This function can throw errors.
   */
  setItem(itemStack: ItemStack, slot: number, selectSlot?: boolean): boolean {
    return false;
  }
  /**
   * @remarks
   * Sets the item cooldown time for a particular cooldown
   * category.
   * @param itemCategory
   * Specifies the cooldown category to retrieve the current
   * cooldown for.
   * @param tickDuration
   * Duration in ticks of the item cooldown.
   * @throws This function can throw errors.
   */
  startItemCooldown(itemCategory: string, tickDuration: number): void {}
  /**
   * @remarks
   * Stops destroying the block that is currently being hit.
   * @throws This function can throw errors.
   */
  stopBreakingBlock(): void {}
  /**
   * @remarks
   * Stops interacting with entities or blocks.
   * @throws This function can throw errors.
   */
  stopInteracting(): void {}
  /**
   * @remarks
   * Stops moving/walking/following if the simulated player is
   * moving.
   * @throws This function can throw errors.
   */
  stopMoving(): void {}
  /**
   * @remarks
   * Stops using the currently active item.
   * @throws This function can throw errors.
   */
  stopUsingItem(): void {}
  /**
   * @remarks
   * Triggers an entity type event. For every entity, a number of
   * events are defined in an entities' definition for key entity
   * behaviors; for example, creepers have a
   * minecraft:start_exploding type event.
   * @param eventName
   * Name of the entity type event to trigger. If a namespace is
   * not specified, minecraft: is assumed.
   * @throws This function can throw errors.
   */
  triggerEvent(eventName: string): void {}
  /**
   * @remarks
   * Causes the simulated player to use an item. Does not consume
   * the item. Returns false if the item is on cooldown.
   * @param itemStack
   * Item to use.
   * @throws This function can throw errors.
   */
  useItem(itemStack: ItemStack): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to hold and use an item in their
   * inventory.
   * @param slot
   * Index of the inventory slot.
   * @throws This function can throw errors.
   */
  useItemInSlot(slot: number): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to use an item in their
   * inventory on a block. The block at the specified block
   * location must be solid. Returns true if the item was used.
   * @param slot
   * Index of the slot to use.
   * @param blockLocation
   * Location to use the item upon.
   * @param direction
   * Direction to place the specified item within.
   * @param faceLocationX
   * Block-face-relative X position where to place the item.
   * @param faceLocationY
   * Block-face-relative Y position where to place the item.
   * @throws This function can throw errors.
   */
  useItemInSlotOnBlock(
    slot: number,
    blockLocation: BlockLocation,
    direction?: number,
    faceLocationX?: number,
    faceLocationY?: number
  ): boolean {
    return false;
  }
  /**
   * @remarks
   * Causes the simulated player to use an item on a block. The
   * block at the specified block location must be solid. Returns
   * true if the item was used.
   * @param itemStack
   * Item to use.
   * @param blockLocation
   * Location to use the item upon.
   * @param direction
   * Direction to place the specified item within.
   * @param faceLocationX
   * Block-face-relative X position where to place the item.
   * @param faceLocationY
   * Block-face-relative Y position where to place the item.
   * @throws This function can throw errors.
   */
  useItemOnBlock(
    itemStack: ItemStack,
    blockLocation: BlockLocation,
    direction?: number,
    faceLocationX?: number,
    faceLocationY?: number
  ): boolean {
    return false;
  }
}
