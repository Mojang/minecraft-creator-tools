// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Traits Index
 *
 * This module exports all content traits for Minecraft content generation.
 * Traits are organized by content type: Entity, Block, and Item.
 */

// Base types and registry
export type {
  ITraitData,
  IEntityTraitData,
  IBlockTraitData,
  IItemTraitData,
  ITraitConfig,
  TraitCategory,
} from "./ContentTraits";

export { EntityContentTrait, BlockContentTrait, ItemContentTrait, TraitRegistry } from "./ContentTraits";

// ============================================================================
// ENTITY TRAITS
// ============================================================================

// Body Types
export { HumanoidEntityTrait } from "./HumanoidEntityTrait";
export { QuadrupedEntityTrait } from "./QuadrupedEntityTrait";
export { QuadrupedSmallEntityTrait } from "./QuadrupedSmallEntityTrait";
export { FlyingEntityTrait } from "./FlyingEntityTrait";
export { AquaticEntityTrait } from "./AquaticEntityTrait";
export { ArthropodEntityTrait } from "./ArthropodEntityTrait";
export { SlimeEntityTrait } from "./SlimeEntityTrait";

// Behaviors
export { HostileEntityTrait } from "./HostileEntityTrait";
export { PassiveEntityTrait } from "./PassiveEntityTrait";
export { NeutralEntityTrait } from "./NeutralEntityTrait";
export { BossEntityTrait } from "./BossEntityTrait";
export { WandersEntityTrait } from "./WandersEntityTrait";
export { FleesDaylightEntityTrait } from "./FleesDaylightEntityTrait";

// Combat
export { MeleeAttackerEntityTrait } from "./MeleeAttackerEntityTrait";
export { RangedAttackerEntityTrait } from "./RangedAttackerEntityTrait";
export { ExploderEntityTrait } from "./ExploderEntityTrait";

// Interaction
export { TameableEntityTrait } from "./TameableEntityTrait";
export { RideableEntityTrait } from "./RideableEntityTrait";
export { BreedableEntityTrait } from "./BreedableEntityTrait";
export { LeasableEntityTrait } from "./LeasableEntityTrait";
export { TraderEntityTrait } from "./TraderEntityTrait";

// Special
export { UndeadEntityTrait } from "./UndeadEntityTrait";
export { BabyVariantEntityTrait } from "./BabyVariantEntityTrait";
export { TeleporterEntityTrait } from "./TeleporterEntityTrait";

// ============================================================================
// BLOCK TRAITS
// ============================================================================

// Materials
export { StoneMaterialBlockTrait } from "./StoneMaterialBlockTrait";
export { WoodMaterialBlockTrait } from "./WoodMaterialBlockTrait";
export { MetalMaterialBlockTrait } from "./MetalMaterialBlockTrait";
export { SoftMaterialBlockTrait } from "./SoftMaterialBlockTrait";

// Interactive
export { DoorBlockTrait } from "./DoorBlockTrait";
export { TrapdoorBlockTrait } from "./TrapdoorBlockTrait";
export { ButtonBlockTrait } from "./ButtonBlockTrait";
export { LeverBlockTrait } from "./LeverBlockTrait";
export { ContainerBlockTrait } from "./ContainerBlockTrait";
export { CraftingStationBlockTrait } from "./CraftingStationBlockTrait";

// Placement
export { RotatableHorizontalBlockTrait } from "./RotatableHorizontalBlockTrait";
export { RotatableAllBlockTrait } from "./RotatableAllBlockTrait";
export { SlabBlockTrait } from "./SlabBlockTrait";
export { StairsBlockTrait } from "./StairsBlockTrait";

// Special
export { LightSourceBlockTrait } from "./LightSourceBlockTrait";
export { VariableLightBlockTrait } from "./VariableLightBlockTrait";
export { PassableBlockTrait } from "./PassableBlockTrait";
export { TransparentBlockTrait } from "./TransparentBlockTrait";
export { GravityAffectedBlockTrait } from "./GravityAffectedBlockTrait";
export { CropBlockTrait } from "./CropBlockTrait";

// ============================================================================
// ITEM TRAITS
// ============================================================================

// Tools
export { SwordItemTrait } from "./SwordItemTrait";
export { PickaxeItemTrait } from "./PickaxeItemTrait";
export { AxeItemTrait } from "./AxeItemTrait";
export { ShovelItemTrait } from "./ShovelItemTrait";
export { HoeItemTrait } from "./HoeItemTrait";

// Armor
export { HelmetItemTrait } from "./HelmetItemTrait";
export { ChestplateItemTrait } from "./ChestplateItemTrait";
export { LeggingsItemTrait } from "./LeggingsItemTrait";
export { BootsItemTrait } from "./BootsItemTrait";

// Consumables
export { FoodItemTrait } from "./FoodItemTrait";
export { DrinkItemTrait } from "./DrinkItemTrait";

// Special
export { ThrowableItemTrait } from "./ThrowableItemTrait";
export { StackableItemTrait } from "./StackableItemTrait";
export { NonStackableItemTrait } from "./NonStackableItemTrait";
export { FuelItemTrait } from "./FuelItemTrait";
export { GlintingItemTrait } from "./GlintingItemTrait";
export { RepairableItemTrait } from "./RepairableItemTrait";
export { CooldownItemTrait } from "./CooldownItemTrait";
export { MusicDiscItemTrait } from "./MusicDiscItemTrait";

// ============================================================================
// TRAIT REGISTRATION FUNCTIONS
// ============================================================================

import { TraitRegistry } from "./ContentTraits";

// Entity traits
import { HumanoidEntityTrait } from "./HumanoidEntityTrait";
import { QuadrupedEntityTrait } from "./QuadrupedEntityTrait";
import { QuadrupedSmallEntityTrait } from "./QuadrupedSmallEntityTrait";
import { FlyingEntityTrait } from "./FlyingEntityTrait";
import { AquaticEntityTrait } from "./AquaticEntityTrait";
import { ArthropodEntityTrait } from "./ArthropodEntityTrait";
import { SlimeEntityTrait } from "./SlimeEntityTrait";
import { HostileEntityTrait } from "./HostileEntityTrait";
import { PassiveEntityTrait } from "./PassiveEntityTrait";
import { NeutralEntityTrait } from "./NeutralEntityTrait";
import { BossEntityTrait } from "./BossEntityTrait";
import { WandersEntityTrait } from "./WandersEntityTrait";
import { FleesDaylightEntityTrait } from "./FleesDaylightEntityTrait";
import { MeleeAttackerEntityTrait } from "./MeleeAttackerEntityTrait";
import { RangedAttackerEntityTrait } from "./RangedAttackerEntityTrait";
import { ExploderEntityTrait } from "./ExploderEntityTrait";
import { TameableEntityTrait } from "./TameableEntityTrait";
import { RideableEntityTrait } from "./RideableEntityTrait";
import { BreedableEntityTrait } from "./BreedableEntityTrait";
import { LeasableEntityTrait } from "./LeasableEntityTrait";
import { TraderEntityTrait } from "./TraderEntityTrait";
import { UndeadEntityTrait } from "./UndeadEntityTrait";
import { BabyVariantEntityTrait } from "./BabyVariantEntityTrait";
import { TeleporterEntityTrait } from "./TeleporterEntityTrait";

// Block traits
import { StoneMaterialBlockTrait } from "./StoneMaterialBlockTrait";
import { WoodMaterialBlockTrait } from "./WoodMaterialBlockTrait";
import { MetalMaterialBlockTrait } from "./MetalMaterialBlockTrait";
import { SoftMaterialBlockTrait } from "./SoftMaterialBlockTrait";
import { DoorBlockTrait } from "./DoorBlockTrait";
import { TrapdoorBlockTrait } from "./TrapdoorBlockTrait";
import { ButtonBlockTrait } from "./ButtonBlockTrait";
import { LeverBlockTrait } from "./LeverBlockTrait";
import { ContainerBlockTrait } from "./ContainerBlockTrait";
import { CraftingStationBlockTrait } from "./CraftingStationBlockTrait";
import { RotatableHorizontalBlockTrait } from "./RotatableHorizontalBlockTrait";
import { RotatableAllBlockTrait } from "./RotatableAllBlockTrait";
import { SlabBlockTrait } from "./SlabBlockTrait";
import { StairsBlockTrait } from "./StairsBlockTrait";
import { LightSourceBlockTrait } from "./LightSourceBlockTrait";
import { VariableLightBlockTrait } from "./VariableLightBlockTrait";
import { PassableBlockTrait } from "./PassableBlockTrait";
import { TransparentBlockTrait } from "./TransparentBlockTrait";
import { GravityAffectedBlockTrait } from "./GravityAffectedBlockTrait";
import { CropBlockTrait } from "./CropBlockTrait";

// Item traits
import { SwordItemTrait } from "./SwordItemTrait";
import { PickaxeItemTrait } from "./PickaxeItemTrait";
import { AxeItemTrait } from "./AxeItemTrait";
import { ShovelItemTrait } from "./ShovelItemTrait";
import { HoeItemTrait } from "./HoeItemTrait";
import { HelmetItemTrait } from "./HelmetItemTrait";
import { ChestplateItemTrait } from "./ChestplateItemTrait";
import { LeggingsItemTrait } from "./LeggingsItemTrait";
import { BootsItemTrait } from "./BootsItemTrait";
import { FoodItemTrait } from "./FoodItemTrait";
import { DrinkItemTrait } from "./DrinkItemTrait";
import { ThrowableItemTrait } from "./ThrowableItemTrait";
import { StackableItemTrait } from "./StackableItemTrait";
import { NonStackableItemTrait } from "./NonStackableItemTrait";
import { FuelItemTrait } from "./FuelItemTrait";
import { GlintingItemTrait } from "./GlintingItemTrait";
import { RepairableItemTrait } from "./RepairableItemTrait";
import { CooldownItemTrait } from "./CooldownItemTrait";
import { MusicDiscItemTrait } from "./MusicDiscItemTrait";

/**
 * Registers all built-in entity traits with the TraitRegistry.
 */
export function registerAllEntityTraits(): void {
  // Body types
  TraitRegistry.registerEntityTrait(new HumanoidEntityTrait());
  TraitRegistry.registerEntityTrait(new QuadrupedEntityTrait());
  TraitRegistry.registerEntityTrait(new QuadrupedSmallEntityTrait());
  TraitRegistry.registerEntityTrait(new FlyingEntityTrait());
  TraitRegistry.registerEntityTrait(new AquaticEntityTrait());
  TraitRegistry.registerEntityTrait(new ArthropodEntityTrait());
  TraitRegistry.registerEntityTrait(new SlimeEntityTrait());

  // Behaviors
  TraitRegistry.registerEntityTrait(new HostileEntityTrait());
  TraitRegistry.registerEntityTrait(new PassiveEntityTrait());
  TraitRegistry.registerEntityTrait(new NeutralEntityTrait());
  TraitRegistry.registerEntityTrait(new BossEntityTrait());
  TraitRegistry.registerEntityTrait(new WandersEntityTrait());
  TraitRegistry.registerEntityTrait(new FleesDaylightEntityTrait());

  // Combat
  TraitRegistry.registerEntityTrait(new MeleeAttackerEntityTrait());
  TraitRegistry.registerEntityTrait(new RangedAttackerEntityTrait());
  TraitRegistry.registerEntityTrait(new ExploderEntityTrait());

  // Interaction
  TraitRegistry.registerEntityTrait(new TameableEntityTrait());
  TraitRegistry.registerEntityTrait(new RideableEntityTrait());
  TraitRegistry.registerEntityTrait(new BreedableEntityTrait());
  TraitRegistry.registerEntityTrait(new LeasableEntityTrait());
  TraitRegistry.registerEntityTrait(new TraderEntityTrait());

  // Special
  TraitRegistry.registerEntityTrait(new UndeadEntityTrait());
  TraitRegistry.registerEntityTrait(new BabyVariantEntityTrait());
  TraitRegistry.registerEntityTrait(new TeleporterEntityTrait());
}

/**
 * Registers all built-in block traits with the TraitRegistry.
 */
export function registerAllBlockTraits(): void {
  // Materials
  TraitRegistry.registerBlockTrait(new StoneMaterialBlockTrait());
  TraitRegistry.registerBlockTrait(new WoodMaterialBlockTrait());
  TraitRegistry.registerBlockTrait(new MetalMaterialBlockTrait());
  TraitRegistry.registerBlockTrait(new SoftMaterialBlockTrait());

  // Interactive
  TraitRegistry.registerBlockTrait(new DoorBlockTrait());
  TraitRegistry.registerBlockTrait(new TrapdoorBlockTrait());
  TraitRegistry.registerBlockTrait(new ButtonBlockTrait());
  TraitRegistry.registerBlockTrait(new LeverBlockTrait());
  TraitRegistry.registerBlockTrait(new ContainerBlockTrait());
  TraitRegistry.registerBlockTrait(new CraftingStationBlockTrait());

  // Placement
  TraitRegistry.registerBlockTrait(new RotatableHorizontalBlockTrait());
  TraitRegistry.registerBlockTrait(new RotatableAllBlockTrait());
  TraitRegistry.registerBlockTrait(new SlabBlockTrait());
  TraitRegistry.registerBlockTrait(new StairsBlockTrait());

  // Special
  TraitRegistry.registerBlockTrait(new LightSourceBlockTrait());
  TraitRegistry.registerBlockTrait(new VariableLightBlockTrait());
  TraitRegistry.registerBlockTrait(new PassableBlockTrait());
  TraitRegistry.registerBlockTrait(new TransparentBlockTrait());
  TraitRegistry.registerBlockTrait(new GravityAffectedBlockTrait());
  TraitRegistry.registerBlockTrait(new CropBlockTrait());
}

/**
 * Registers all built-in item traits with the TraitRegistry.
 */
export function registerAllItemTraits(): void {
  // Tools
  TraitRegistry.registerItemTrait(new SwordItemTrait());
  TraitRegistry.registerItemTrait(new PickaxeItemTrait());
  TraitRegistry.registerItemTrait(new AxeItemTrait());
  TraitRegistry.registerItemTrait(new ShovelItemTrait());
  TraitRegistry.registerItemTrait(new HoeItemTrait());

  // Armor
  TraitRegistry.registerItemTrait(new HelmetItemTrait());
  TraitRegistry.registerItemTrait(new ChestplateItemTrait());
  TraitRegistry.registerItemTrait(new LeggingsItemTrait());
  TraitRegistry.registerItemTrait(new BootsItemTrait());

  // Consumables
  TraitRegistry.registerItemTrait(new FoodItemTrait());
  TraitRegistry.registerItemTrait(new DrinkItemTrait());

  // Special
  TraitRegistry.registerItemTrait(new ThrowableItemTrait());
  TraitRegistry.registerItemTrait(new StackableItemTrait());
  TraitRegistry.registerItemTrait(new NonStackableItemTrait());
  TraitRegistry.registerItemTrait(new FuelItemTrait());
  TraitRegistry.registerItemTrait(new GlintingItemTrait());
  TraitRegistry.registerItemTrait(new RepairableItemTrait());
  TraitRegistry.registerItemTrait(new CooldownItemTrait());
  TraitRegistry.registerItemTrait(new MusicDiscItemTrait());
}

/**
 * Registers all built-in traits with the TraitRegistry.
 */
export function registerAllTraits(): void {
  registerAllEntityTraits();
  registerAllBlockTraits();
  registerAllItemTraits();
}
