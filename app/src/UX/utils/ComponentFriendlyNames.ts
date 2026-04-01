/**
 * Maps Minecraft component IDs to user-friendly display names.
 * These names are designed for non-technical creators (especially beginners)
 * to understand what each component does at a glance.
 *
 * Only the most common/important components need entries here.
 * Components not in this map fall back to Utilities.humanifyMinecraftName().
 */
import Utilities from "../../core/Utilities";

const entityComponentFriendlyNames: { [id: string]: string } = {
  // Movement behaviors
  "minecraft:behavior.float": "Float in Water",
  "minecraft:behavior.random_stroll": "Wander Around",
  "minecraft:behavior.random_look_around": "Look Around Randomly",
  "minecraft:behavior.look_at_player": "Look at Player",
  "minecraft:behavior.look_at_entity": "Look at Entity",
  "minecraft:behavior.follow_parent": "Follow Parent",
  "minecraft:behavior.follow_owner": "Follow Owner",
  "minecraft:behavior.wander": "Wander",
  "minecraft:behavior.swim_idle": "Idle Swimming",
  "minecraft:behavior.swim_wander": "Swim Around",
  "minecraft:behavior.random_swim": "Swim Randomly",
  "minecraft:behavior.random_fly": "Fly Randomly",
  "minecraft:behavior.random_hover": "Hover Randomly",
  "minecraft:behavior.move_to_water": "Go to Water",
  "minecraft:behavior.move_to_land": "Go to Land",
  "minecraft:behavior.stay_near_noteblock": "Stay Near Noteblock",

  // Combat behaviors
  "minecraft:behavior.melee_attack": "Melee Attack",
  "minecraft:behavior.ranged_attack": "Ranged Attack",
  "minecraft:behavior.hurt_by_target": "Retaliate When Hurt",
  "minecraft:behavior.nearest_attackable_target": "Target Nearest Enemy",
  "minecraft:behavior.nearest_prioritized_attackable_target": "Target Nearest (Prioritized)",
  "minecraft:behavior.defend_village_target": "Defend Village",
  "minecraft:behavior.owner_hurt_by_target": "Attack What Hurts Owner",
  "minecraft:behavior.owner_hurt_target": "Attack Owner's Target",

  // Interaction behaviors
  "minecraft:behavior.tempt": "Tempt with Items",
  "minecraft:behavior.breed": "Breed",
  "minecraft:behavior.beg": "Beg for Food",
  "minecraft:behavior.offer_flower": "Offer Flower",
  "minecraft:behavior.receive_love": "Accept Breeding",
  "minecraft:behavior.trade_with_player": "Trade with Player",
  "minecraft:behavior.admire_item": "Admire Item",

  // Survival behaviors
  "minecraft:behavior.panic": "Panic When Hurt",
  "minecraft:behavior.flee_sun": "Flee from Sunlight",
  "minecraft:behavior.avoid_mob_type": "Avoid Certain Mobs",
  "minecraft:behavior.avoid_block": "Avoid Certain Blocks",
  "minecraft:behavior.hide": "Hide",
  "minecraft:behavior.run_around_like_crazy": "Run Around Wildly",

  // Special behaviors
  "minecraft:behavior.lay_egg": "Lay Eggs",
  "minecraft:behavior.make_love": "Make Love",
  "minecraft:behavior.nap": "Take a Nap",
  "minecraft:behavior.sleep": "Sleep at Night",
  "minecraft:behavior.eat_block": "Eat Block",
  "minecraft:behavior.eat_mob": "Eat Mob",
  "minecraft:behavior.celebrate": "Celebrate",
  "minecraft:behavior.play": "Play",
  "minecraft:behavior.roll": "Roll",
  "minecraft:behavior.sneeze": "Sneeze",

  // Door/Block interactions
  "minecraft:behavior.open_door": "Open Doors",
  "minecraft:behavior.break_door": "Break Doors",
  "minecraft:behavior.pickup_items": "Pick Up Items",
  "minecraft:behavior.drop_item_for": "Drop Items",

  // Core attributes
  "minecraft:physics": "Physics",
  "minecraft:pushable": "Can Be Pushed",
  "minecraft:collision_box": "Size",
  "minecraft:health": "Health",
  "minecraft:attack": "Attack Damage",
  "minecraft:movement": "Movement Speed",
  "minecraft:navigation.walk": "Walk Navigation",
  "minecraft:navigation.fly": "Fly Navigation",
  "minecraft:navigation.swim": "Swim Navigation",
  "minecraft:navigation.float": "Float Navigation",
  "minecraft:navigation.climb": "Climb Navigation",
  "minecraft:navigation.hover": "Hover Navigation",
  "minecraft:movement.basic": "Basic Movement",
  "minecraft:movement.fly": "Fly Movement",
  "minecraft:movement.swim": "Swim Movement",
  "minecraft:movement.hover": "Hover Movement",
  "minecraft:movement.skip": "Skip Movement",
  "minecraft:movement.glide": "Glide Movement",
  "minecraft:jump.static": "Jump Ability",
  "minecraft:jump.dynamic": "Dynamic Jump",
  "minecraft:can_climb": "Can Climb",
  "minecraft:can_fly": "Can Fly",
  "minecraft:can_power_jump": "Can Power Jump",
  "minecraft:floats_in_liquid": "Floats in Liquid",

  // Appearance
  "minecraft:scale": "Size Scale",
  "minecraft:color": "Color",
  "minecraft:color2": "Secondary Color",
  "minecraft:variant": "Visual Variant",
  "minecraft:mark_variant": "Mark Variant",
  "minecraft:skin_id": "Skin ID",
  "minecraft:is_baby": "Is Baby",
  "minecraft:is_charged": "Is Charged",
  "minecraft:is_tamed": "Is Tamed",
  "minecraft:is_saddled": "Is Saddled",
  "minecraft:is_sheared": "Is Sheared",

  // Spawning
  "minecraft:type_family": "Mob Type",
  "minecraft:spawn_entity": "Spawn Other Entity",
  "minecraft:despawn": "Despawn Rules",
  "minecraft:experience_reward": "XP Reward",
  "minecraft:loot": "Loot Table",

  // Interaction
  "minecraft:interact": "Player Interactions",
  "minecraft:tameable": "Can Be Tamed",
  "minecraft:rideable": "Can Be Ridden",
  "minecraft:leashable": "Can Be Leashed",
  "minecraft:nameable": "Can Be Named",
  "minecraft:breedable": "Can Be Bred",
  "minecraft:healable": "Can Be Healed",
  "minecraft:ageable": "Can Grow Up",
  "minecraft:equippable": "Can Wear Equipment",
  "minecraft:inventory": "Has Inventory",
  "minecraft:container": "Has Container",
  "minecraft:projectile": "Projectile",
  "minecraft:shooter": "Can Shoot Projectiles",
  "minecraft:damage_sensor": "Damage Response",
  "minecraft:burns_in_daylight": "Burns in Daylight",
  "minecraft:breathable": "Breathing Rules",
  "minecraft:fire_immune": "Immune to Fire",
};

const blockComponentFriendlyNames: { [id: string]: string } = {
  "minecraft:destructible_by_mining": "Mining Speed",
  "minecraft:destructible_by_explosion": "Explosion Resistance",
  "minecraft:collision_box": "Size",
  "minecraft:selection_box": "Selection Area",
  "minecraft:geometry": "Custom Shape",
  "minecraft:material_instances": "Textures & Materials",
  "minecraft:light_emission": "Light Emission",
  "minecraft:light_dampening": "Light Blocking",
  "minecraft:flammable": "Flammable",
  "minecraft:friction": "Surface Friction",
  "minecraft:map_color": "Map Color",
  "minecraft:display_name": "Display Name",
  "minecraft:loot": "Loot When Mined",
  "minecraft:placement_filter": "Placement Rules",
  "minecraft:crafting_table": "Crafting Table",
  "minecraft:transformation": "Transform/Rotate",
  "minecraft:unit_cube": "Standard Block Shape",
  "minecraft:breathability": "Air or Solid",
  "minecraft:random_ticking": "Random Updates",
  "minecraft:queued_ticking": "Timed Updates",
  "minecraft:redstone_conductivity": "Redstone Conductivity",
  "minecraft:custom_components": "Script Components",
  "minecraft:tick": "Tick Updates",
  "minecraft:replaceable": "Can Be Replaced",
  "minecraft:entity_fall_on": "Entity Fall Event",
};

/**
 * Get a user-friendly display name for an entity component.
 * Returns undefined if no friendly name is defined (caller should fall back to humanifyMinecraftName).
 */
export function getEntityFriendlyName(componentId: string): string | undefined {
  return entityComponentFriendlyNames[componentId];
}

/**
 * Get a user-friendly display name for a block component.
 * Returns undefined if no friendly name is defined.
 */
export function getBlockFriendlyName(componentId: string): string | undefined {
  return blockComponentFriendlyNames[componentId];
}

/**
 * Get a friendly name for any component (entity or block), falling back to humanified name.
 */
export function getFriendlyComponentName(componentId: string, humanifiedFallback: string): string {
  return entityComponentFriendlyNames[componentId] || blockComponentFriendlyNames[componentId] || humanifiedFallback;
}

function getFriendlyGroupVariantToken(token: string): string {
  switch (token) {
    case "wild":
      return "wild variant";
    case "hostile":
      return "hostile variant";
    case "scared":
      return "scared state";
    case "angry":
      return "angry state";
    case "calm":
      return "calm state";
    default:
      return Utilities.humanifyMinecraftName(token).toLowerCase();
  }
}

/**
 * Get a beginner-friendly label for an entity component group/state.
 */
export function getFriendlyComponentGroupName(groupId: string): string {
  if (!groupId || groupId === "(default)" || groupId.toLowerCase() === "default") {
    return "Default (base state)";
  }

  let id = groupId;
  const colon = id.indexOf(":");
  if (colon >= 0) {
    id = id.substring(colon + 1);
  }

  const normalized = id.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const tokens = normalized.split("_").filter(Boolean);

  if (tokens.length === 0) {
    return Utilities.humanifyMinecraftName(id);
  }

  const stageToken = tokens.find((token) => token === "baby" || token === "adult");
  const stageLabel = stageToken ? Utilities.humanifyMinecraftName(stageToken) : undefined;
  const variantTokens = tokens.filter((token) => token !== stageToken && token !== "group");

  if (stageLabel && variantTokens.length === 0) {
    return `${stageLabel} (normal state)`;
  }

  if (stageLabel && variantTokens.length > 0) {
    return `${stageLabel} (${variantTokens.map(getFriendlyGroupVariantToken).join(", ")})`;
  }

  if (variantTokens.length > 0) {
    return variantTokens.map(getFriendlyGroupVariantToken).join(", ");
  }

  return Utilities.humanifyMinecraftName(id);
}
