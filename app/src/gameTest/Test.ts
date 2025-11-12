import BlockType from "./../minecraft/BlockType";
import BlockLocation from "./../minecraft/BlockLocation";
import Block from "./../minecraft/Block";
import Entity from "./../minecraft/Entity";
import ItemStack from "./../minecraft/ItemStack";
import ItemTypeDefinition from "../minecraft/ItemTypeDefinition";
import IDimension from "./../minecraft/IDimension";
import BlockVolume from "../minecraft/BlockVolume";
import { FenceConnectivity } from "./FenceConnectivity";
import { Direction } from "../minecraft/Direction";
import Location from "../minecraft/Location";
import BlockPermutation from "../minecraft/BlockPermutation";
import SimulatedPlayer from "./SimulatedPlayer";
import { GameMode } from "../minecraft/GameMode";

export default class Test {
  /**
   * @remarks
   * Tests that the condition specified in _condition_ is true.
   * If not, an error with the specified _message_ is thrown.
   * @param condition
   * Expression of the condition to evaluate.
   * @param message
   * Message that is passed if the _condition_ does not evaluate
   * to true.
   * @throws This function can throw errors.
   */
  assert(condition: boolean, message: string): void {}
  /**
   * @remarks
   * Tests that a block of the specified type is present at the
   * specified location. If it is not, an exception is thrown.
   * @param blockType
   * Expected block type.
   * @param blockLocation
   * Location of the block to test at.
   * @param isPresent
   * If true, this function tests whether a block of the
   * specified type is at the location. If false, tests that a
   * block of the specified type is not present.
   * @throws This function can throw errors.
   */
  assertBlockPresent(blockType: BlockType, blockLocation: BlockLocation, isPresent?: boolean): void {}
  /**
   * @remarks
   * Tests that a block has a particular state value at the
   * specified location. If it does not have that state value, an
   * exception is thrown.
   * @param blockLocation
   * Location of the block to test at.
   * @param callback
   * Callback function that contains additional tests based on
   * the block at the specified location.
   * @throws This function can throw errors.
   * @example testIfButtonNotPressed.js
   * ```typescript
   *        test.assertBlockState(buttonPos, (block) => {
   *        return block.getBlockData().getProperty("button_pressed_bit") == 0;
   *        });
   * ```
   */
  assertBlockState(blockLocation: BlockLocation, callback: (arg: Block) => boolean): void {}
  /**
   * @remarks
   * Tests that an entity can reach a particular location.
   * Depending on the value of canReach, throws an exception if
   * the condition is not met.
   * @param mob
   * Entity that you wish to test the location against.
   * @param blockLocation
   * Structure-relative location to test whether the specified
   * mob can reach.
   * @param canReach
   * If true, tests whether the mob can reach the location. If
   * false, tests whether the mob is not able to reach the
   * location.
   * @throws This function can throw errors.
   */
  assertCanReachLocation(mob: Entity, blockLocation: BlockLocation, canReach?: boolean): void {}
  /**
   * @remarks
   * Tests that a container (e.g., a chest) at the specified
   * location contains a specified of item stack. If not, an
   * error is thrown.
   * @param itemStack
   * Represents the type of item to check for. The specified
   * container must contain at least 1 item matching the item
   * type defined in _itemStack_.
   * @param blockLocation
   * Location of the block with a container (for example, a
   * chest) to test the contents of.
   * @throws This function can throw errors.
   */
  assertContainerContains(itemStack: ItemStack, blockLocation: BlockLocation): void {}
  /**
   * @remarks
   * Tests that a container (e.g., a chest) at the specified
   * location is empty. If not, an error is thrown.
   * @param blockLocation
   * Location of the block with a container (for example, a
   * chest) to test is empty of contents.
   * @throws This function can throw errors.
   */
  assertContainerEmpty(blockLocation: BlockLocation): void {}
  /**
   * @remarks
   * Tests that an entity has a specific piece of armor equipped.
   * If not, an error is thrown.
   * @param entityTypeIdentifier
   * Identifier of the entity to match (e.g.,
   * 'minecraft:skeleton').
   * @param armorSlot
   * Container slot index to test.
   * @param armorName
   * Name of the armor to look for.
   * @param armorData
   * Data value integer to look for.
   * @param blockLocation
   * Location of the entity with armor to test for.
   * @param hasArmor
   * Whether or not the entity is expected to have the specified
   * armor equipped.
   * @throws This function can throw errors.
   * @example horseArmorTest.js
   * ```typescript
   *        test.assertEntityHasArmor("minecraft:horse", armorSlotTorso, "diamond_horse_armor", 0, horseLocation, true);
   *
   * ```
   */
  assertEntityHasArmor(
    entityTypeIdentifier: string,
    armorSlot: number,
    armorName: string,
    armorData: number,
    blockLocation: BlockLocation,
    hasArmor?: boolean
  ): void {}
  /**
   * @remarks
   * Tests that an entity has a particular component. If not, an
   * exception is thrown.
   * @param entityTypeIdentifier
   * Identifier of the specified entity (e.g.,
   * 'minecraft:skeleton'). If the namespace is not specified,
   * 'minecraft:' is assumed.
   * @param componentIdentifier
   * Identifier of the component to check for. If the namespace
   * is not specified, 'minecraft:' is assumed.
   * @param blockLocation
   * Location of the block with a container (for example, a
   * chest.)
   * @param hasComponent
   * Determines whether to test that the component exists, or
   * does not.
   * @throws This function can throw errors.
   * @example sheepShearedTest.js
   * ```typescript
   *        test.assertEntityHasComponent("minecraft:sheep", "minecraft:is_sheared", entityLoc, false);
   *
   * ```
   */
  assertEntityHasComponent(
    entityTypeIdentifier: string,
    componentIdentifier: string,
    blockLocation: BlockLocation,
    hasComponent?: boolean
  ): void {}
  /**
   * @remarks
   * Depending on the value for isPresent, tests that a
   * particular entity is present or not present at the specified
   * location. Depending on the value of isPresent, if the entity
   * is found or not found, an error is thrown.
   * @param entity
   * Specific entity to test for.
   * @param blockLocation
   * Location of the entity to test for.
   * @param isPresent
   * Whether to test that an entity is present or not present at
   * the specified location.
   * @throws This function can throw errors.
   */
  assertEntityInstancePresent(entity: Entity, blockLocation: BlockLocation, isPresent?: boolean): void {}
  /**
   * @remarks
   * Depending on the value of isPresent, tests for the presence
   * or non-presence of entity of a specified type at a
   * particular location. If the condition is not met, an
   * exception is thrown.
   * @param entityTypeIdentifier
   * Type of entity to test for (e.g., 'minecraft:skeleton'). If
   * an entity namespace is not specified, 'minecraft:' is
   * assumed.
   * @param blockLocation
   * Location of the entity to test for.
   * @param isPresent
   * If true, this function tests whether an entity of the
   * specified type is present. If false, tests that an entity of
   * the specified type is not present.
   * @throws This function can throw errors.
   */
  assertEntityPresent(entityTypeIdentifier: string, blockLocation: BlockLocation, isPresent?: boolean): void {}
  /**
   * @remarks
   * Tests that an entity of a specified type is present within
   * the GameTest area. If not, an exception is thrown.
   * @param entityTypeIdentifier
   * Type of entity to test for (e.g., 'minecraft:skeleton'). If
   * an entity namespace is not specified, 'minecraft:' is
   * assumed.
   * @param isPresent
   * If true, this function tests whether an entity of the
   * specified type is present in the GameTest area. If false,
   * tests that an entity of the specified type is not present.
   * @throws This function can throw errors.
   */
  assertEntityPresentInArea(entityTypeIdentifier: string, isPresent?: boolean): void {}
  /**
   * @remarks
   * Tests that an entity (e.g., a skeleton) at the specified
   * location has a particular piece of data. If not, an error is
   * thrown.
   * @param blockLocation
   * Location of the entity to look for.
   * @param entityTypeIdentifier
   * Identifier of the entity (e.g., 'minecraft:skeleton') to
   * look for. Note if no namespace is specified, 'minecraft:' is
   * assumed.
   * @param callback
   * Callback function where facets of the selected entity can be
   * tested for. If this callback function returns false or no
   * entity with the specified identifier is found, an exception
   * is thrown.
   * @throws This function can throw errors.
   * @example villagerEffectTest.js
   * ```typescript
   *        test.assertEntityState(
   *        villagerPos,
   *        "minecraft:villager_v2",
   *        (entity) => entity.getEffect(MinecraftEffectTypes.regeneration).duration > 120
   *        ); // At least 6 seconds remaining in the villagers' effect
   *
   * ```
   */
  assertEntityState(
    blockLocation: BlockLocation,
    entityTypeIdentifier: string,
    callback: (arg: Entity) => boolean
  ): void {}
  /**
   * @remarks
   * Depending on the value of isTouching, tests that an entity
   * of a specified type is touching or connected to another
   * entity. If the condition is not met, an exception is thrown.
   * @param entityTypeIdentifier
   * Type of entity to test for (e.g., 'minecraft:skeleton'). If
   * an entity namespace is not specified, 'minecraft:' is
   * assumed.
   * @param location
   * Location of the entity to test for.
   * @param isTouching
   * If true, this function tests whether the entity is touching
   * the specified location. If false, tests that an entity is
   * not testing the specified location.
   * @throws This function can throw errors.
   */
  assertEntityTouching(entityTypeIdentifier: string, location: Location, isTouching?: boolean): void {}
  /**
   * @remarks
   * Depending on the value of isWaterlogged, tests that a block
   * at a location contains water. If the condition is not met,
   * an error is thrown. Pure water blocks are not considered to
   * be waterlogged.
   * @param blockLocation
   * Location of the block to test for.
   * @param isWaterlogged
   * Whether to test that the block at _position_ is expected to
   * be waterlogged.
   * @throws This function can throw errors.
   */
  assertIsWaterlogged(blockLocation: BlockLocation, isWaterlogged?: boolean): void {}
  /**
   * @remarks
   * Tests that items of a particular type and count are present
   * within an area. If not, an error is thrown.
   * @param itemType
   * Type of item to look for.
   * @param blockLocation
   * Location to search around for the specified set of items.
   * @param searchDistance
   * Range, in blocks, to aggregate a count of items around. If
   * 0, will only search the particular block at _position_.
   * @param count
   * Number of items, at minimum, to look and test for.
   * @throws This function can throw errors.
   * @example findFeathers.js
   * ```typescript
   *        test.assertItemEntityCountIs(Items.feather, expectedFeatherLoc, 0, 1);
   *
   * ```
   */
  assertItemEntityCountIs(
    itemType: ItemTypeDefinition,
    blockLocation: BlockLocation,
    searchDistance: number,
    count: number
  ): void {}
  /**
   * @remarks
   * Depending on the value of isPresent, tests whether a
   * particular item entity is present or not at a particular
   * location. If the condition is not met, an exception is
   * thrown.
   * @param itemType
   * Type of item to test for.
   * @param blockLocation
   * Location of the item entity to test for.
   * @param searchDistance
   * Radius in blocks to look for the item entity.
   * @param isPresent
   * If true, this function tests whether an item entity of the
   * specified type is present. If false, tests that an item
   * entity of the specified type is not present.
   * @throws This function can throw errors.
   */
  assertItemEntityPresent(
    itemType: ItemTypeDefinition,
    blockLocation: BlockLocation,
    searchDistance: number,
    isPresent?: boolean
  ): void {}
  /**
   * @remarks
   * Tests that Redstone power at a particular location matches a
   * particular value. If not, an exception is thrown.
   * @param blockLocation
   * Location to test.
   * @param power
   * Expected power level.
   * @throws This function can throw errors.
   */
  assertRedstonePower(blockLocation: BlockLocation, power: number): void {}
  /**
   * @remarks
   * Marks the current test as a failure case.
   * @param errorMessage
   * Error message summarizing the failure condition.
   * @throws This function can throw errors.
   */
  fail(errorMessage: string): void {}
  /**
   * @remarks
   * Runs the given callback. If the callback does not throw an
   * exception, the test is marked as a failure.
   * @param callback
   * Callback function that runs. If the function runs
   * successfully, the test is marked as a failure. Typically,
   * this function will have .assertXyz method calls within it.
   * @throws This function can throw errors.
   */
  failIf(callback: () => void): void {}
  /**
   * @remarks
   * Gets a block at the specified block location.
   * @param blockLocation
   * Location of the block to retrieve.
   * @throws This function can throw errors.
   */
  getBlock(blockLocation: BlockLocation): Block {
    return new Block("air");
  }
  /**
   * @remarks
   * Gets the dimension of this test.
   * @throws This function can throw errors.
   */
  getDimension(): IDimension {
    return new BlockVolume();
  }
  /**
   * @remarks
   * If the block at the specified block location is a fence,
   * this returns a helper object with details on how a fence is
   * connected.
   * @param blockLocation
   * Location of the block to retrieve.
   * @throws This function can throw errors.
   */
  getFenceConnectivity(blockLocation: BlockLocation): FenceConnectivity {
    return new FenceConnectivity();
  }
  /**
   * @remarks
   * Returns the direction of the current test - see the
   * {@link mojang-minecraft}.Direction enum for more information on
   * potential values (north, east, south, west - values 2-5).
   */
  getTestDirection(): Direction {
    return Direction.north;
  }
  /**
   * @remarks
   * This asynchronous function will wait for the specified time
   * in ticks before continuing execution.
   * @param tickDelay
   * Amount of time to wait, in ticks.
   */
  idle(tickDelay: number): Promise<void> {
    return Promise.resolve();
  }
  /**
   * @remarks
   * Kills all entities within the GameTest structure.
   * @throws This function can throw errors.
   */
  killAllEntities(): void {}
  /**
   * @remarks
   * Presses a button at a block location.
   * @param blockLocation
   * Location to push the button at.
   * @throws
   * Will throw an error if a button is not present at the
   * specified position.
   */
  pressButton(blockLocation: BlockLocation): void {}
  /**
   * @remarks
   * Displays the specified message to all players.
   * @param text
   * Message to display.
   * @throws This function can throw errors.
   */
  print(text: string): void {}
  /**
   * @remarks
   * Pulls a lever at a block location.
   * @param blockLocation
   * Location to pull the lever at.
   * @throws
   * Will throw an error if a lever is not present at the
   * specified position.
   */
  pullLever(blockLocation: BlockLocation): void {}
  /**
   * @remarks
   * Sends a Redstone pulse at a particular location by creating
   * a temporary Redstone block.
   * @param blockLocation
   * Location to pulse Redstone at.
   * @param duration
   * Number of ticks to pulse Redstone.
   * @throws This function can throw errors.
   */
  pulseRedstone(blockLocation: BlockLocation, duration: number): void {}
  /**
   * @remarks
   * From a BlockLocation, returns a new BlockLocation with
   * coordinates relative to the current GameTest structure
   * block. For example, the relative coordinates for the block
   * above the structure block are (0, 1, 0). Rotation of the
   * GameTest structure is also taken into account.
   * @param worldBlockLocation
   * Absolute location in the world to convert to a relative
   * location.
   * @returns
   * A location relative to the GameTest command block.
   * @throws This function can throw errors.
   */
  relativeBlockLocation(worldBlockLocation: BlockLocation): BlockLocation {
    return new BlockLocation(0, 0, 0);
  }
  /**
   * @remarks
   * From a location, returns a new location with coordinates
   * relative to the current GameTest structure block. For
   * example, the relative coordinates for the block above the
   * structure block are (0, 1, 0). Rotation of the GameTest
   * structure is also taken into account.
   * @param worldLocation
   * Absolute location in the world to convert to a relative
   * location.
   * @returns
   * A location relative to the GameTest command block.
   * @throws This function can throw errors.
   */
  relativeLocation(worldLocation: Location): Location {
    return new Location(0, 0, 0);
  }
  /**
   * @remarks
   * Removes a simulated player from the world.
   * @param simulatedPlayer
   * Simulated player to remove.
   */
  removeSimulatedPlayer(simulatedPlayer: SimulatedPlayer): void {}
  /**
   * @remarks
   * Returns a relative direction given the current rotation of
   * the current test. Passing in Direction.south will return the
   * test direction; Passing in Direction.north will return the
   * opposite of the test direction, and so on.
   * @param direction
   * Direction to translate into a direction relative to the
   * GameTest facing. Passing in Direction.south will return the
   * test direction; Passing in Direction.north will return the
   * opposite of the test direction, and so on.
   * @throws This function can throw errors.
   */
  rotateDirection(direction: Direction): Direction {
    return Direction.down;
  }
  /**
   * @remarks
   * Runs a specific callback after a specified delay of ticks
   * @param delayTicks
   * Number of ticks to delay before running the specified
   * callback.
   * @param callback
   * Callback function to execute.
   * @throws This function can throw errors.
   */
  runAfterDelay(delayTicks: number, callback: () => void): void {}
  /**
   * @remarks
   * Runs the given callback after a delay of _tick_ ticks from
   * the start of the GameTest.
   * @param tick
   * Tick (after the start of the GameTest) to run the callback
   * at.
   * @param callback
   * Callback function to execute.
   * @throws This function can throw errors.
   */
  runAtTickTime(tick: number, callback: () => void): void {}
  /**
   * @remarks
   * Sets a block to a particular configuration (a
   * BlockPermutation) at the specified block location.
   * @param blockData
   * Permutation that contains the configuration data for a
   * block.
   * @param blockLocation
   * Location of the block to set.
   * @throws This function can throw errors.
   */
  setBlockPermutation(blockData: BlockPermutation, blockLocation: BlockLocation): void {}
  /**
   * @remarks
   * Sets a block to a particular type at the specified block
   * location.
   * @param blockType
   * Type of block to set.
   * @param blockLocation
   * Location of the block to set.
   * @throws This function can throw errors.
   */
  setBlockType(blockType: BlockType, blockLocation: BlockLocation): void {}
  /**
   * @remarks
   * For blocks that are fluid containers - like a cauldron -
   * changes the type of fluid within that container.
   * @param location
   * Location of the fluid container block.
   * @param type
   * Type of fluid to set. See {@link mojang-gametest}.FluidType for a
   * list of values.
   * @throws This function can throw errors.
   */
  setFluidContainer(location: BlockLocation, type: number): void {}
  /**
   * @remarks
   * Sets the fuse of an explodable entity.
   * @param entity
   * Entity that is explodable.
   * @param fuseLength
   * Length of time, in ticks, before the entity explodes.
   * @throws This function can throw errors.
   */
  setTntFuse(entity: Entity, fuseLength: number): void {}
  /**
   * @remarks
   * Spawns an entity at a location.
   * @param entityTypeIdentifier
   * Type of entity to create. If no namespace is provided,
   * 'minecraft:' is assumed. Note that an optional initial spawn
   * event can be specified between less than/greater than signs
   * (e.g., namespace:entityType<spawnEvent>).
   * @param blockLocation
   * @returns
   * The spawned entity. If the entity cannot be spawned, returns
   * undefined.
   * @throws This function can throw errors.
   * @example spawnAdultPig.js
   * ```typescript
   *        test.spawn("minecraft:pig<minecraft:ageable_grow_up>", new BlockLocation(1, 2, 1));
   *
   * ```
   */
  spawn(entityTypeIdentifier: string, blockLocation: BlockLocation): Entity {
    return new Entity();
  }
  /**
   * @remarks
   * Spawns an entity at a location.
   * @param entityTypeIdentifier
   * Type of entity to create. If no namespace is provided,
   * 'minecraft:' is assumed. Note that an optional initial spawn
   * event can be specified between less than/greater than signs
   * (e.g., namespace:entityType<spawnEvent>).
   * @param location
   * @returns
   * The spawned entity. If the entity cannot be spawned, returns
   * undefined.
   * @throws This function can throw errors.
   * @example spawnAdultPig.js
   * ```typescript
   *        test.spawn("minecraft:pig<minecraft:ageable_grow_up>", new Location(1.5, 2, 1.5));
   * ```
   */
  spawnAtLocation(entityTypeIdentifier: string, location: Location): Entity {
    return new Entity();
  }
  /**
   * @remarks
   * Spawns an item entity at a specified location.
   * @param itemStack
   * ItemStack that describes the item entity to create.
   * @param location
   * Location to create the item entity at.
   * @throws This function can throw errors.
   * @example spawnEmeralds.js
   * ```typescript
   *        const oneEmerald = new ItemStack(MinecraftItemTypes.emerald, 1, 0);
   *        const fiveEmeralds = new ItemStack(MinecraftItemTypes.emerald, 5, 0);
   *
   *        test.spawnItem(oneEmerald, new Location(3.5, 3, 1.5));
   *        test.spawnItem(fiveEmeralds, new Location(1.5, 3, 1.5));
   *
   * ```
   */
  spawnItem(itemStack: ItemStack, location: Location): Entity {
    return new Entity();
  }
  /**
   * @remarks
   * Creates a new simulated player within the world.
   * @param blockLocation
   * Location where to spawn the simulated player.
   * @param name
   * Name to give the new simulated player.
   * @param gameMode
   * @throws This function can throw errors.
   */
  spawnSimulatedPlayer(blockLocation: BlockLocation, name?: string, gameMode?: GameMode): SimulatedPlayer {
    return new SimulatedPlayer();
  }
  /**
   * @remarks
   * Spawns an entity at a location without any AI behaviors.
   * This method is frequently used in conjunction with methods
   * like .walkTo to create predictable mob actions.
   * @param entityTypeIdentifier
   * @param blockLocation
   * Location where the entity should be spawned.
   * @throws This function can throw errors.
   */
  spawnWithoutBehaviors(entityTypeIdentifier: string, blockLocation: BlockLocation): Entity {
    return new Entity();
  }
  /**
   * @remarks
   * Spawns an entity at a location without any AI behaviors.
   * This method is frequently used in conjunction with methods
   * like .walkTo to create predictable mob actions.
   * @param entityTypeIdentifier
   * @param location
   * Location where the entity should be spawned.
   * @throws This function can throw errors.
   */
  spawnWithoutBehaviorsAtLocation(entityTypeIdentifier: string, location: Location): Entity {
    return new Entity();
  }
  /**
   * @remarks
   * Tests that a particular item entity is present at a
   * particular location. If not, an exception is thrown.
   * @param blockLocation
   * BlockLocation containing a multiface block.
   * @param fromFace
   * Face to spread from. This face must already be set.
   * @param direction
   * Direction to spread. Use the Minecraft.Direction enum to
   * specify a direction.
   * @throws This function can throw errors.
   * @example spreadFromFaceTowardDirection.js
   * ```typescript
   *        test.spreadFromFaceTowardDirection(new BlockLocation(1, 2, 1), Direction.south, Direction.down);
   * ```
   */
  spreadFromFaceTowardDirection(blockLocation: BlockLocation, fromFace: Direction, direction: Direction): void {}

  /**
   * @remarks
   * Marks the current test as a success case.
   * @throws This function can throw errors.
   */
  succeed(): void {}
  /**
   * @remarks
   * Runs the given callback. If the callback does not throw an
   * exception, the test is marked as a success.
   * @param callback
   * Callback function that runs. If the function runs
   * successfully, the test is marked as a success. Typically,
   * this function will have .assertXyz method calls within it.
   * @throws This function can throw errors.
   */
  succeedIf(callback: () => void): void {}
  /**
   * @remarks
   * Marks the test as a success at the specified tick.
   * @param tick
   * Tick after the start of the GameTest to mark the test as
   * successful.
   * @throws This function can throw errors.
   */
  succeedOnTick(tick: number): void {}
  /**
   * @remarks
   * Runs the given callback at _tick_ ticks after the start of
   * the test. If the callback does not throw an exception, the
   * test is marked as a failure.
   * @param tick
   * Tick after the start of the GameTest to run the testing
   * callback at.
   * @param callback
   * Callback function that runs. If the function runs
   * successfully, the test is marked as a success.
   * @throws This function can throw errors.
   */
  succeedOnTickWhen(tick: number, callback: () => void): void {}
  /**
   * @remarks
   * Runs the given callback every tick. When the callback
   * successfully executes, the test is marked as a success.
   * Specifically, the test will succeed when the callback does
   * not throw an exception.
   * @param callback
   * Testing callback function that runs. If the function runs
   * successfully, the test is marked as a success.
   * @throws This function can throw errors.
   */
  succeedWhen(callback: () => void): void {}
  /**
   * @remarks
   * Depending on the condition of isPresent, tests for the
   * presence of a block of a particular type on every tick. When
   * the specified block of a type is found or not found
   * (depending on isPresent), the test is marked as a success.
   * @param blockType
   * Type of block to test for.
   * @param blockLocation
   * Location of the block to test at.
   * @param isPresent
   * If true, this function tests whether a block of the
   * specified type is present. If false, tests that a block of
   * the specified type is not present.
   * @throws This function can throw errors.
   */
  succeedWhenBlockPresent(blockType: BlockType, blockLocation: BlockLocation, isPresent?: boolean): void {}
  /**
   * @remarks
   * Tests for the presence of a component on every tick.
   * Depending on the value of hasComponent, when the specified
   * component is found, the test is marked as a success.
   * @param entityTypeIdentifier
   * Type of entity to look for. If no namespace is specified,
   * 'minecraft:' is assumed.
   * @param componentIdentifier
   * Type of component to test for the presence of. If no
   * namespace is specified, 'minecraft:' is assumed.
   * @param blockLocation
   * Block location of the entity to test.
   * @param hasComponent
   * If true, this function tests for the presence of a
   * component. If false, this function tests for the lack of a
   * component.
   * @throws This function can throw errors.
   */
  succeedWhenEntityHasComponent(
    entityTypeIdentifier: string,
    componentIdentifier: string,
    blockLocation: BlockLocation,
    hasComponent: boolean
  ): void {}
  /**
   * @remarks
   * Depending on the value of isPresent, tests for the presence
   * of an entity on every tick. When an entity of the specified
   * type is found or not found (depending on isPresent), the
   * test is marked as a success.
   * @param entityTypeIdentifier
   * Type of entity to test for (e.g., 'minecraft:skeleton'). If
   * an entity namespace is not specified, 'minecraft:' is
   * assumed.
   * @param blockLocation
   * Location of the entity to test for.
   * @param isPresent
   * If true, this function tests whether an entity of the
   * specified type is present. If false, tests that an entity of
   * the specified type is not present.
   * @throws This function can throw errors.
   */
  succeedWhenEntityPresent(entityTypeIdentifier: string, blockLocation: BlockLocation, isPresent?: boolean): void {}
  /**
   * @remarks
   * Triggers a block event from a fixed list of available block
   * events.
   * @param blockLocation
   * @param event
   * Event to trigger. Valid values include minecraft:drip,
   * minecraft:grow_stalagtite, minecraft:grow_stalagmite,
   * minecraft:grow_up, minecraft:grow_down and
   * minecraft:grow_sideways.
   * @param eventParameters
   * @throws This function can throw errors.
   */
  triggerInternalBlockEvent(blockLocation: BlockLocation, event: string, eventParameters?: number[]): void {}
  /**
   * @remarks
   * This asynchronous function will wait until the code in the
   * specified callback successfully completes. until can be used
   * in conjunction with .assert functions to evaluate that a
   * condition is true.
   * @param callback
   * Function with code to evaluate.
   */
  until(callback: () => void): Promise<void> {
    return Promise.resolve();
  }
  /**
   * @remarks
   * Forces a mob to walk to a particular location. Usually used
   * in conjunction with methods like .spawnWithoutBehaviors to
   * have more predictable mob behaviors. Mobs will stop
   * navigation as soon as they intersect the target location.
   * @param mob
   * Mob entity to give orders to.
   * @param blockLocation
   * Location where the entity should be walk to.
   * @param speedModifier
   * Adjustable modifier to the mob's walking speed.
   * @throws This function can throw errors.
   */
  walkTo(mob: Entity, blockLocation: BlockLocation, speedModifier: number): void {}
  /**
   * @remarks
   * Forces a mob to walk to a particular location. Usually used
   * in conjunction with methods like .spawnWithoutBehaviors to
   * have more predictable mob behaviors. Mobs will stop
   * navigation as soon as they intersect the target location.
   * @param mob
   * Mob entity to give orders to.
   * @param location
   * Location where the entity should be walk to.
   * @param speedModifier
   * Adjustable modifier to the mob's walking speed.
   * @throws This function can throw errors.
   */
  walkToLocation(mob: Entity, location: Location, speedModifier: number): void {}
  /**
   * @remarks
   * From a BlockLocation with coordinates relative to the
   * GameTest structure block, returns a new BlockLocation with
   * coordinates relative to world. Rotation of the GameTest
   * structure is also taken into account.
   * @param relativeBlockLocation
   * Location relative to the GameTest command block.
   * @returns
   * An absolute location relative to the GameTest command block.
   * @throws This function can throw errors.
   */
  worldBlockLocation(relativeBlockLocation: BlockLocation): BlockLocation {
    return new BlockLocation(1, 1, 1);
  }
  /**
   * @remarks
   * From a location with coordinates relative to the GameTest
   * structure block, returns a new location with coordinates
   * relative to world. Rotation of the GameTest structure is
   * also taken into account.
   * @param relativeLocation
   * Location relative to the GameTest command block.
   * @returns
   * An absolute location relative to the GameTest command block.
   * @throws This function can throw errors.
   */
  worldLocation(relativeLocation: Location): Location {
    return new Location(1, 1, 1);
  }
}
