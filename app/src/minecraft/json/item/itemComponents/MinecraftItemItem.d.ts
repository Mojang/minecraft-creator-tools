// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Type definitions for working with Minecraft Bedrock Edition pack JSON schemas.
// Project: https://learn.microsoft.com/minecraft/creator/

/**
 * @packageDocumentation
 * Contains types for working with various Minecraft Bedrock Edition JSON schemas.
 * 
 * Items Documentation - minecraft:item
 */

import * as jsoncommon from './../../../jsoncommon';

/**
 * Minecraft Item Item
 * Item definition includes the "description" and "components" 
 * sections.
 */
export default interface MinecraftItemItem {

  /**
   * @remarks
   * List of all components used in this item.
   */
  components: MinecraftItemItemComponents;

  /**
   * @remarks
   * Contains the required identifier for the item. May contain optional
   * fields like menu_category.
   */
  description: MinecraftItemItemDescription;

}


/**
 * Components
 * List of all components used in this item.
 */
export interface MinecraftItemItemComponents {

  /**
   * @remarks
   * The allow_off_hand component determines whether the item can be
   * placed in the off hand slot of the inventory.
   */
  "minecraft:allow_off_hand": boolean;

  /**
   * @remarks
   * Items with the block_placer component will place a block when
   * used. 
This component can also be used instead of the
   * "minecraft:icon" component to render the referenced block as
   * the item icon.
   */
  "minecraft:block_placer": MinecraftItemItemComponentsMinecraftBlockPlacer;

  /**
   * @remarks
   * [EXPERIMENTAL] Adds bundle-specific interactions and tooltip to
   * the item. Requires a "minecraft:storage_item" component.
   */
  "minecraft:bundle_interaction": MinecraftItemItemComponentsMinecraftBundleInteraction;

  /**
   * @remarks
   * The can_destroy_in_creative component determines if the item can
   * be used by a player to break blocks when in creative mode.
   */
  "minecraft:can_destroy_in_creative": boolean;

  /**
   * @remarks
   * Specifies that an item is compostable and provides the chance of
   * creating a composting layer in the composter
   */
  "minecraft:compostable": MinecraftItemItemComponentsMinecraftCompostable;

  /**
   * @remarks
   * After you use an item, all items specified with the same `cool
   * down category` setting becomes unusable for the duration specified by
   * the 'cool down time' setting in this component.
   */
  "minecraft:cooldown": MinecraftItemItemComponentsMinecraftCooldown;

  /**
   * @remarks
   * Specifies an array of custom components defined in a script that
   * should be added to this item.
   */
  "minecraft:custom_components": MinecraftItemItemComponentsMinecraftCustomComponents;

  /**
   * @remarks
   * The damage component determines how much extra damage the item
   * does on attack.
   */
  "minecraft:damage": number;

  /**
   * @remarks
   * It allows an item to absorb damage that would otherwise be
   * dealt to its wearer. For this to happen, the item needs to be
   * equipped in an armor slot. The absorbed damage reduces the
   * item's durability, with any excess damage being ignored. Because of
   * this, the item also needs a `minecraft:durability` 
   * component.
   */
  "minecraft:damage_absorption": MinecraftItemItemComponentsMinecraftDamageAbsorption;

  /**
   * @remarks
   * Digger item component specifies how quickly this item can dig
   * specific blocks.
   */
  "minecraft:digger": MinecraftItemItemComponentsMinecraftDigger;

  /**
   * @remarks
   * The display_name item component specifies the text shown whenever an
   * item's name is displayed, like in hover text.
   */
  "minecraft:display_name": MinecraftItemItemComponentsMinecraftDisplayName;

  /**
   * @remarks
   * The durability item component specifies how much damage the item
   * takes before breaking, and allows the item to be combined to
   * repair or augment them.
   */
  "minecraft:durability": MinecraftItemItemComponentsMinecraftDurability;

  /**
   * @remarks
   * Enables an item to emit effects when it receives damage. Because of
   * this, the item also needs a `minecraft:durability` 
   * component.
   */
  "minecraft:durability_sensor": MinecraftItemItemComponentsMinecraftDurabilitySensor;

  /**
   * @remarks
   * minecraft:dyeable
   */
  "minecraft:dyeable": MinecraftItemItemComponentsMinecraftDyeable;

  /**
   * @remarks
   * The enchantable component specifies what enchantments can be
   * applied to the item. Not all enchantments will have an effect on
   * all item components.
   */
  "minecraft:enchantable": MinecraftItemItemComponentsMinecraftEnchantable;

  /**
   * @remarks
   * The entity_placer item component specifies the blocks that the
   * item can be placed on.
   */
  "minecraft:entity_placer": MinecraftItemItemComponentsMinecraftEntityPlacer;

  /**
   * @remarks
   * When an item has a food component, it becomes edible to the
   * player. Must have the 'minecraft:use_duration' component in
   * order to function properly.
   */
  "minecraft:food": MinecraftItemItemComponentsMinecraftFood;

  /**
   * @remarks
   * Fuel item component allows this item to be used as fuel in a
   * furnace to 'cook' other items.
   */
  "minecraft:fuel": number;

  /**
   * @remarks
   * The glint component determines whether the item has the
   * enchanted glint render effect on it.
   */
  "minecraft:glint": boolean;

  /**
   * @remarks
   * The hand_equipped component determines if an item is rendered like
   * a tool while it is in a player's hand.
   */
  "minecraft:hand_equipped": boolean;

  /**
   * @remarks
   * The hover_text_color component specifies the color of the item
   * name when the players hovers the cursor over the item.
   */
  "minecraft:hover_text_color": string;

  /**
   * @remarks
   * Icon item component determines which icon graphic will be used to
   * represent the item in the UI and elsewhere.
   */
  "minecraft:icon": string;

  /**
   * @remarks
   * This component is a boolean or string that determines if the
   * interact button is shown in touch controls and what text is
   * displayed on the button. When set as true, default "Use Item" text
   * will be displayed.
   */
  "minecraft:interact_button": boolean;

  /**
   * @remarks
   * The liquid_clipped component determines whether the item
   * interacts with liquid blocks on use.
   */
  "minecraft:liquid_clipped": boolean;

  /**
   * @remarks
   * The max_stack_size component specifies how many of the item can
   * be stacked together.
   */
  "minecraft:max_stack_size": number;

  /**
   * @remarks
   * Projectile items shoot out, like an arrow.
   */
  "minecraft:projectile": MinecraftItemItemComponentsMinecraftProjectile;

  /**
   * @remarks
   * Specifies the base rarity and subsequently color of the item name
   * when the player hovers the cursor over the item.
   */
  "minecraft:rarity": string;

  /**
   * @remarks
   * Record Item Component. Used by record items to play music.
   */
  "minecraft:record": MinecraftItemItemComponentsMinecraftRecord;

  /**
   * @remarks
   * The repairable item component specifies which items can be used
   * to repair this item, along with how much durability is 
   * gained.
   */
  "minecraft:repairable": MinecraftItemItemComponentsMinecraftRepairable;

  /**
   * @remarks
   * Shooter Item Component.
   */
  "minecraft:shooter": MinecraftItemItemComponentsMinecraftShooter;

  /**
   * @remarks
   * Should_despawn component determines if the item should eventually
   * despawn while floating in the world
   */
  "minecraft:should_despawn": boolean;

  /**
   * @remarks
   * The stacked_by_data component determines whether the same items
   * with different aux values can stack. Also defines whether the
   * item entities can merge while floating in the world.
   */
  "minecraft:stacked_by_data": boolean;

  /**
   * @remarks
   * [EXPERIMENTAL] Storage Items can be used by other components to
   * store other items within this item.
   */
  "minecraft:storage_item": MinecraftItemItemComponentsMinecraftStorageItem;

  /**
   * @remarks
   * Specifies the maximum weight limit that a storage item can 
   * hold
   */
  "minecraft:storage_weight_limit": MinecraftItemItemComponentsMinecraftStorageWeightLimit;

  /**
   * @remarks
   * Specifies the maximum weight limit that a storage item can 
   * hold
   */
  "minecraft:storage_weight_modifier": MinecraftItemItemComponentsMinecraftStorageWeightModifier;

  /**
   * @remarks
   * The tags component specifies which tags an item has on it.
   */
  "minecraft:tags": MinecraftItemItemComponentsMinecraftTags;

  /**
   * @remarks
   * Throwable items can be thrown by the player, such as a
   * snowball.
   */
  "minecraft:throwable": MinecraftItemItemComponentsMinecraftThrowable;

  /**
   * @remarks
   * Use_animation specifies which animation is played when the
   * player uses the item.
   */
  "minecraft:use_animation": string;

  /**
   * @remarks
   * This component modifies use effects, including how long the item
   * takes to use and the player's speed when used in combination with
   * components like "shooter", "throwable", or "food".
   */
  "minecraft:use_modifiers": MinecraftItemItemComponentsMinecraftUseModifiers;

  /**
   * @remarks
   * Wearable items can be worn by a player in the head, chest, legs,
   * feet, or off-hand slots.
   */
  "minecraft:wearable": MinecraftItemItemComponentsMinecraftWearable;

}


/**
 * Allow Off Hand
 * The allow_off_hand component determines whether the item can be
 * placed in the off hand slot of the inventory.
 */
export interface MinecraftItemItemComponentsMinecraftAllowOffHand {

}


/**
 * Block Placer
 * Items with the block_placer component will place a block when
 * used. 
This component can also be used instead of the
 * "minecraft:icon" component to render the referenced block as
 * the item icon.
 */
export interface MinecraftItemItemComponentsMinecraftBlockPlacer {

  /**
   * @remarks
   * Defines the block that will be placed.
   */
  block: object;

  /**
   * @remarks
   * If true, the item will be registered as the item for this block.
   * This item will be returned by default when the block is
   * broken/picked. Note: the identifier for this item must match the
   * block's identifier for this field to be valid.
   */
  replace_block_item: boolean;

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * used on. If left empty, all blocks will be allowed.
   */
  use_on: MinecraftItemItemComponentsMinecraftBlockPlacerUseOn[];

}


/**
 * Use On
 * Use On
 */
export interface MinecraftItemItemComponentsMinecraftBlockPlacerUseOn {

  /**
   * @remarks
   * name
   */
  name: string;

  /**
   * @remarks
   * states
   */
  states: number;

  /**
   * @remarks
   * tags
   */
  tags: string;

}


/**
 * Bundle Interaction
 * [EXPERIMENTAL] Adds bundle-specific interactions and tooltip to
 * the item. Requires a "minecraft:storage_item" component.
 */
export interface MinecraftItemItemComponentsMinecraftBundleInteraction {

  /**
   * @remarks
   * The maximum number of slots in the bundle viewable by the
   * plater. Can be from 1 to 64. Default is 12.
   */
  num_viewable_slots: number;

}


/**
 * Can Destroy In Creative
 * The can_destroy_in_creative component determines if the item can
 * be used by a player to break blocks when in creative mode.
 */
export interface MinecraftItemItemComponentsMinecraftCanDestroyInCreative {

}


/**
 * Compostable
 * Specifies that an item is compostable and provides the chance of
 * creating a composting layer in the composter.
 */
export interface MinecraftItemItemComponentsMinecraftCompostable {

  /**
   * @remarks
   * The chance of this item to create a layer upon composting with
   * the composter. Valid value range is 1 - 100 inclusive
   */
  composting_chance: number;

}


/**
 * Cooldown
 * After you use an item, all items specified with the same `cool
 * down category` setting becomes unusable for the duration specified by
 * the 'cool down time' setting in this component.
 */
export interface MinecraftItemItemComponentsMinecraftCooldown {

  /**
   * @remarks
   * The type of cool down for this item. All items with a cool down
   * component with the same category are put on cool down when one
   * is used.
   */
  category: string;

  /**
   * @remarks
   * The duration of time (in seconds) items with a matching category will
   * spend cooling down before becoming usable again.
   */
  duration: number;

}


/**
 * Custom Components
 * Specifies an array of custom components defined in a script that
 * should be added to this item.
 */
export interface MinecraftItemItemComponentsMinecraftCustomComponents {

}


/**
 * Damage
 * The damage component determines how much extra damage the item
 * does on attack.
 */
export interface MinecraftItemItemComponentsMinecraftDamage {

}


/**
 * Damage Absorption
 * It allows an item to absorb damage that would otherwise be
 * dealt to its wearer. For this to happen, the item needs to be
 * equipped in an armor slot. The absorbed damage reduces the
 * item's durability, with any excess damage being ignored. Because of
 * this, the item also needs a `minecraft:durability` 
 * component.
 */
export interface MinecraftItemItemComponentsMinecraftDamageAbsorption {

  /**
   * @remarks
   * List of damage causes that can be absorbed by the item. By
   * default, no damage cause is absorbed.
   */
  absorbable_causes: string[];

}


/**
 * Digger
 * Digger item component specifies how quickly this item can dig
 * specific blocks.
 */
export interface MinecraftItemItemComponentsMinecraftDigger {

  /**
   * @remarks
   * A list of blocks to dig with correlating speeds of digging.
   */
  destroy_speeds: MinecraftItemItemComponentsMinecraftDiggerDestroySpeeds[];

  /**
   * @remarks
   * Determines whether this item should be impacted if the
   * efficiency enchantment is applied to it.
   */
  use_efficiency: boolean;

}


/**
 * V1 20 50 DiggerItemComponent BlockInfo
 * V1 20 50 DiggerItemComponent BlockInfo.
 */
export interface MinecraftItemItemComponentsMinecraftDiggerDestroySpeeds {

  /**
   * @remarks
   * Block to be dug.
   */
  block: MinecraftItemItemComponentsMinecraftDiggerDestroySpeedsBlock;

  /**
   * @remarks
   * Digging speed for the correlating block(s).
   */
  speed: number;

}


/**
 * Block
 * Block
 */
export interface MinecraftItemItemComponentsMinecraftDiggerDestroySpeedsBlock {

  /**
   * @remarks
   * name
   */
  name: string;

  /**
   * @remarks
   * states
   */
  states: number;

  /**
   * @remarks
   * tags
   */
  tags: string;

}


/**
 * Display Name
 * The display_name item component specifies the text shown whenever an
 * item's name is displayed, like in hover text.
 */
export interface MinecraftItemItemComponentsMinecraftDisplayName {

  /**
   * @remarks
   * Name shown for an item.
   */
  value: string;

}


/**
 * Durability
 * The durability item component specifies how much damage the item
 * takes before breaking, and allows the item to be combined to
 * repair or augment them.
 */
export interface MinecraftItemItemComponentsMinecraftDurability {

  /**
   * @remarks
   * Specifies the percentage chance of this item losing durability. Default
   * is set to 100. Defined as an int range with min and max 
   * value.
   */
  damage_chance: MinecraftItemItemComponentsMinecraftDurabilityDamageChance;

  /**
   * @remarks
   * Max durability is the amount of damage that this item can take
   * before breaking. This is a required parameter and has a
   * minimum of 0.
   */
  max_durability: number;

}


/**
 * IntRange
 * IntRange
 */
export interface MinecraftItemItemComponentsMinecraftDurabilityDamageChance {

  /**
   * @remarks
   * max
   */
  max: number;

  /**
   * @remarks
   * min
   */
  min: number;

}


/**
 * Durability Sensor
 * Enables an item to emit effects when it receives damage. Because of
 * this, the item also needs a `minecraft:durability` 
 * component.
 */
export interface MinecraftItemItemComponentsMinecraftDurabilitySensor {

  /**
   * @remarks
   * The list of both durability thresholds and effects emitted when
   * each threshold is met. When multiple thresholds are met, only the
   * threshold with the lowest durability after applying the damage is
   * considered.
   */
  durability_thresholds: MinecraftItemItemComponentsMinecraftDurabilitySensorDurabilityThresholds[];

}


/**
 * Durability Sensor Durability Threshold
 * Defines both the durability threshold, and the effects emitted when
 * that threshold is met.
 */
export interface MinecraftItemItemComponentsMinecraftDurabilitySensorDurabilityThresholds {

  /**
   * @remarks
   * The effects are emitted when the item durability value is less
   * than or equal to this value.
   */
  durability: number;

  /**
   * @remarks
   * Particle effect to emit when the threshold is met.
   */
  particle_type: string;

  /**
   * @remarks
   * Sound effect to emit when the threshold is met.
   */
  sound_event: string;

}


/**
 * Dyeable
 * Dyeable
 */
export interface MinecraftItemItemComponentsMinecraftDyeable {

  /**
   * @remarks
   * default_color
   */
  default_color: string;

}


/**
 * Enchantable
 * The enchantable component specifies what enchantments can be
 * applied to the item. Not all enchantments will have an effect on
 * all item components.
 */
export interface MinecraftItemItemComponentsMinecraftEnchantable {

  /**
   * @remarks
   * Specifies which types of enchantments can be applied. For
   * example, `bow` would allow this item to be enchanted as if it
   * were a bow.
   */
  slot: string;

  /**
   * @remarks
   * Specifies the value of the enchantment (minimum of 0).
   */
  value: number;

}


/**
 * Entity Placer
 * The entity_placer item component specifies the blocks that the
 * item can be placed on.
 */
export interface MinecraftItemItemComponentsMinecraftEntityPlacer {

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * dispensed on. If left empty, all blocks will be allowed.
   */
  dispense_on: MinecraftItemItemComponentsMinecraftEntityPlacerDispenseOn[];

  /**
   * @remarks
   * The entity to be placed in the world.
   */
  entity: string;

  /**
   * @remarks
   * List of block descriptors of the blocks that this item can be
   * used on. If left empty, all blocks will be allowed.
   */
  use_on: MinecraftItemItemComponentsMinecraftEntityPlacerUseOn[];

}


/**
 * Dispense On
 * Dispense On.
 */
export interface MinecraftItemItemComponentsMinecraftEntityPlacerDispenseOn {

  /**
   * @remarks
   * name
   */
  name: string;

  /**
   * @remarks
   * states
   */
  states: number;

  /**
   * @remarks
   * tags
   */
  tags: string;

}


/**
 * Use On
 * Use On
 */
export interface MinecraftItemItemComponentsMinecraftEntityPlacerUseOn {

  /**
   * @remarks
   * name
   */
  name: string;

  /**
   * @remarks
   * states
   */
  states: number;

  /**
   * @remarks
   * tags
   */
  tags: string;

}


/**
 * Food
 * When an item has a food component, it becomes edible to the
 * player. Must have the 'minecraft:use_duration' component in
 * order to function properly.
 */
export interface MinecraftItemItemComponentsMinecraftFood {

  /**
   * @remarks
   * If true you can always eat this item (even when not hungry). Default
   * is set to false.
   */
  can_always_eat: boolean;

  /**
   * @remarks
   * Value that is added to the entity's nutrition when the item is
   * used. Default is set to 0.
   */
  nutrition: number;

  /**
   * @remarks
   * saturation_modifier is used in this formula: (nutrition *
   * saturation_modifier * 2) when applying the saturation buff.
   * Default is set to 0.6.
   */
  saturation_modifier: number;

  /**
   * @remarks
   * When used, converts to the item specified by the string in this
   * field. Default does not convert item.
   */
  using_converts_to: string;

}


/**
 * Using Converts To
 * Using Converts To.
 */
export interface MinecraftItemItemComponentsMinecraftFoodUsingConvertsTo {

}


/**
 * Fuel
 * Fuel item component allows this item to be used as fuel in a
 * furnace to 'cook' other items.
 */
export interface MinecraftItemItemComponentsMinecraftFuel {

}


/**
 * Glint
 * The glint component determines whether the item has the
 * enchanted glint render effect on it.
 */
export interface MinecraftItemItemComponentsMinecraftGlint {

}


/**
 * Hand Equipped
 * The hand_equipped component determines if an item is rendered like
 * a tool while it is in a player's hand.
 */
export interface MinecraftItemItemComponentsMinecraftHandEquipped {

}


/**
 * Hover Text Color
 * The hover_text_color component specifies the color of the item
 * name when the players hovers the cursor over the item.
 */
export interface MinecraftItemItemComponentsMinecraftHoverTextColor {

}


/**
 * Icon
 * Icon item component determines which icon graphic will be used to
 * represent the item in the UI and elsewhere.
 */
export interface MinecraftItemItemComponentsMinecraftIcon {

}


/**
 * Interact Button
 * This component is a boolean or string that determines if the
 * interact button is shown in touch controls and what text is
 * displayed on the button. When set as true, default "Use Item" text
 * will be displayed.
 */
export interface MinecraftItemItemComponentsMinecraftInteractButton {

}


/**
 * Liquid Clipped
 * The liquid_clipped component determines whether the item
 * interacts with liquid blocks on use.
 */
export interface MinecraftItemItemComponentsMinecraftLiquidClipped {

}


/**
 * Max Stack Size
 * The max_stack_size component specifies how many of the item can
 * be stacked together.
 */
export interface MinecraftItemItemComponentsMinecraftMaxStackSize {

}


/**
 * Projectile
 * Projectile items shoot out, like an arrow.
 */
export interface MinecraftItemItemComponentsMinecraftProjectile {

  /**
   * @remarks
   * Specifies how long a player must charge a projectile for it to
   * critically hit.
   */
  minimum_critical_power: number;

  /**
   * @remarks
   * Which entity is to be fired as a projectile.
   */
  projectile_entity: string;

}


/**
 * Rarity
 * Specifies the base rarity and subsequently color of the item name
 * when the player hovers the cursor over the item.
 */
export interface MinecraftItemItemComponentsMinecraftRarity {

}


/**
 * Record
 * Record Item Component. Used by record items to play music.
 */
export interface MinecraftItemItemComponentsMinecraftRecord {

  /**
   * @remarks
   * Specifies signal strength for comparator blocks to use, from 1
   * - 13.
   */
  comparator_signal: number;

  /**
   * @remarks
   * Specifies duration of sound event in seconds, float value.
   */
  duration: number;

  /**
   * @remarks
   * Sound event type: 13, cat, blocks, chirp, far, mall, mellohi, stal,
   * strad, ward, 11, wait, pigstep, otherside, 5, relic.
   */
  sound_event: string;

}


/**
 * Repairable
 * The repairable item component specifies which items can be used
 * to repair this item, along with how much durability is 
 * gained.
 */
export interface MinecraftItemItemComponentsMinecraftRepairable {

  /**
   * @remarks
   * List of repair item entries. Each entry needs to define a list of
   * strings for `items` that can be used for the repair and an
   * optional `repair_amount` for how much durability is gained.
   */
  repair_items: string;

}


/**
 * Shooter
 * Shooter Item Component.
 */
export interface MinecraftItemItemComponentsMinecraftShooter {

  /**
   * @remarks
   * Ammunition.
   */
  ammunition: MinecraftItemItemComponentsMinecraftShooterAmmunition[];

  /**
   * @remarks
   * Charge on draw? Default is set to false.
   */
  charge_on_draw: boolean;

  /**
   * @remarks
   * Draw Duration. Default is set to 0.
   */
  max_draw_duration: number;

  /**
   * @remarks
   * Scale power by draw duration? Default is set to false.
   */
  scale_power_by_draw_duration: boolean;

}


/**
 * V1 20 50 ShooterItemComponent Ammunition
 * V1 20 50 ShooterItemComponent Ammunition.
 */
export interface MinecraftItemItemComponentsMinecraftShooterAmmunition {

  /**
   * @remarks
   * Ammunition item description identifier.
   */
  item: string;

  /**
   * @remarks
   * Can search inventory? Default is set to false.
   */
  search_inventory: boolean;

  /**
   * @remarks
   * Can use in creative mode? Default is set to false.
   */
  use_in_creative: boolean;

  /**
   * @remarks
   * Can use off-hand? Default is set to false.
   */
  use_offhand: boolean;

}


/**
 * Should Despawn
 * Should_despawn component determines if the item should eventually
 * despawn while floating in the world.
 */
export interface MinecraftItemItemComponentsMinecraftShouldDespawn {

}


/**
 * Stacked By Data
 * The stacked_by_data component determines whether the same items
 * with different aux values can stack. Also defines whether the
 * item entities can merge while floating in the world.
 */
export interface MinecraftItemItemComponentsMinecraftStackedByData {

}


/**
 * Storage Item
 * [EXPERIMENTAL] Storage Items can be used by other components to
 * store other items within this item.
 */
export interface MinecraftItemItemComponentsMinecraftStorageItem {

  /**
   * @remarks
   * Determines whether another Storage Item is allowed inside of
   * this item. Default is true.
   */
  allow_nested_storage_items: boolean;

  /**
   * @remarks
   * List of items that are exclusively allowed in this Storage Item.
   * If empty all items are allowed.
   */
  allowed_items: string;

  /**
   * @remarks
   * List of items that are not allowed in this Storage Item.
   */
  banned_items: string;

  /**
   * @remarks
   * The maximum allowed weight of the sum of all contained items.
   * Maximum is 64. Default is 64.
   */
  max_slots: number;

}


/**
 * Storage Weight Limit
 * Specifies the maximum weight limit that a storage item can 
 * hold.
 */
export interface MinecraftItemItemComponentsMinecraftStorageWeightLimit {

  /**
   * @remarks
   * The maximum allowed weight of the sum of all contained items.
   * Maximum is 64. Default is 64.
   */
  max_weight_limit: number;

}


/**
 * Storage Weight Modifier
 * Specifies the maximum weight limit that a storage item can 
 * hold.
 */
export interface MinecraftItemItemComponentsMinecraftStorageWeightModifier {

  /**
   * @remarks
   * The weight of this item when inside another Storage Item. Default is
   * 4. 0 means item is not allowed in another Storage Item.
   */
  weight_in_storage_item: number;

}


/**
 * Tags
 * The tags component specifies which tags an item has on it.
 */
export interface MinecraftItemItemComponentsMinecraftTags {

  /**
   * @remarks
   * An array that can contain multiple item tags.
   */
  tags: string[];

}


/**
 * Throwable
 * Throwable items can be thrown by the player, such as a
 * snowball.
 */
export interface MinecraftItemItemComponentsMinecraftThrowable {

  /**
   * @remarks
   * Determines whether the item should use the swing animation when
   * thrown. Default is set to false.
   */
  do_swing_animation: boolean;

  /**
   * @remarks
   * The scale at which the power of the throw increases. Default is
   * set to 1.0.
   */
  launch_power_scale: number;

  /**
   * @remarks
   * The maximum duration to draw a throwable item. Default is set to
   * 0.0.
   */
  max_draw_duration: number;

  /**
   * @remarks
   * The maximum power to launch the throwable item. Default is set
   * to 1.0.
   */
  max_launch_power: number;

  /**
   * @remarks
   * The minimum duration to draw a throwable item. Default is set to
   * 0.0.
   */
  min_draw_duration: number;

  /**
   * @remarks
   * Whether or not the power of the throw increases with duration
   * charged. Default is set to false.
   */
  scale_power_by_draw_duration: boolean;

}


/**
 * Use Animation
 * Use_animation specifies which animation is played when the
 * player uses the item.
 */
export interface MinecraftItemItemComponentsMinecraftUseAnimation {

}


/**
 * Use Modifiers
 * This component modifies use effects, including how long the item
 * takes to use and the player's speed when used in combination with
 * components like "shooter", "throwable", or "food".
 */
export interface MinecraftItemItemComponentsMinecraftUseModifiers {

  /**
   * @remarks
   * Modifier value to scale the players movement speed when item is
   * in use.
   */
  movement_modifier: number;

  /**
   * @remarks
   * How long the item takes to use in seconds.
   */
  use_duration: number;

}


/**
 * Wearable
 * Wearable items can be worn by a player in the head, chest, legs,
 * feet, or off-hand slots.
 */
export interface MinecraftItemItemComponentsMinecraftWearable {

  /**
   * @remarks
   * How much protection the wearable item provides. Default is set
   * to 0.
   */
  protection: number;

  /**
   * @remarks
   * Specifies where the item can be worn. If any non-hand slot is
   * chosen, the max stack size is set to 1.
   */
  slot: string;

}


/**
 * Description
 * Contains the required identifier for the item. May contain optional
 * fields like menu_category.
 */
export interface MinecraftItemItemDescription {

  /**
   * @remarks
   * Unique name for the item that must include a namespace and must
   * not use the Minecraft namespace unless overriding a Vanilla 
   * item.
   */
  identifier: string;

  /**
   * @remarks
   * menu_category contains the creative group name and category for
   * this item.
   */
  menu_category: MinecraftItemItemDescriptionMenuCategory;

}


/**
 * Menu Category
 * Menu_category contains the creative group name and category for
 * this item.
 */
export interface MinecraftItemItemDescriptionMenuCategory {

  /**
   * @remarks
   * Creative category where this item belongs. Defaults to 
   * "none".
   */
  category: string;

  /**
   * @remarks
   * The Creative Group that this item belongs to. Group name is
   * limited to 256 characters. The name also must start with a
   * namespace.
   */
  group: string;

  /**
   * @remarks
   * Determines whether or not this item can be used with commands.
   * Commands can use items by default if a category is set.
   */
  is_hidden_in_commands: boolean;

}