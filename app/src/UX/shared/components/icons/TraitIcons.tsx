// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * TraitIcons - SVG icons for entity, block, and item traits in the Content Wizard.
 *
 * Each icon uses a 24x24 viewBox, renders at 20x20px by default, and uses
 * `currentColor` for fill/stroke so they adapt to any theme.
 *
 * Follows the same inline-React-SVG pattern as BodyTypeIcons.tsx.
 */

import React from "react";

// ============================================================================
// ENTITY TRAIT ICONS
// ============================================================================

/** Two-legged (humanoid) - standing figure silhouette. Reuses BodyTypeIcons.HumanoidIcon design. */
const TwoLeggedIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <circle cx="12" cy="4" r="2.5" />
    <rect x="10" y="7" width="4" height="7" rx="1" />
    <rect x="6" y="8" width="3" height="5" rx="1" transform="rotate(-15 7.5 10.5)" />
    <rect x="15" y="8" width="3" height="5" rx="1" transform="rotate(15 16.5 10.5)" />
    <rect x="9" y="14" width="2.5" height="6" rx="1" />
    <rect x="12.5" y="14" width="2.5" height="6" rx="1" />
  </svg>
);

/** Four-legged (quadruped) - animal silhouette. Reuses BodyTypeIcons.QuadrupedIcon design. */
const FourLeggedIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="12" cy="10" rx="6" ry="4" />
    <circle cx="18" cy="8" r="2.5" />
    <rect x="7" y="12" width="2" height="5" rx="0.5" />
    <rect x="10" y="12" width="2" height="5" rx="0.5" />
    <rect x="13" y="12" width="2" height="5" rx="0.5" />
    <rect x="16" y="12" width="2" height="5" rx="0.5" />
    <path d="M19 9 L22 8 L22 9 L19 10 Z" />
  </svg>
);

/** Flying - bird/bat with spread wings. */
const FlyingIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="12" cy="12" rx="3" ry="2" />
    <circle cx="16" cy="11" r="1.5" />
    <path d="M9 10 C4 6, 4 10, 6 12 C4 14, 4 18, 9 14 Z" />
    <path d="M15 10 C20 6, 20 10, 18 12 C20 14, 20 18, 15 14 Z" />
    <path d="M9 12 L7 14 L8 14 L10 12 Z" />
  </svg>
);

/** Aquatic - fish silhouette with tail fin. */
const AquaticIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="12" cy="12" rx="7" ry="3" />
    <path d="M19 12 L23 9 L23 15 Z" />
    <path d="M12 9 L14 6 L14 9 Z" />
    <circle cx="7" cy="11" r="1" fill="white" />
  </svg>
);

/** Hostile - angry face / fangs. */
const HostileIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="8" y1="7" x2="10" y2="9" />
    <line x1="16" y1="7" x2="14" y2="9" />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" />
    <path d="M8 15 L10 13 L12 15 L14 13 L16 15" />
  </svg>
);

/** Passive - peaceful face with smile. */
const PassiveIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" />
    <path d="M8 14 Q12 18, 16 14" />
  </svg>
);

/** Neutral - calm face, flat mouth. */
const NeutralIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <circle cx="9" cy="10" r="1.2" fill="currentColor" />
    <circle cx="15" cy="10" r="1.2" fill="currentColor" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
);

/** Melee Attacker - sword. */
const MeleeAttackerIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="19" x2="14" y2="10" />
    <path d="M14 10 L14 5 L19 5" />
    <line x1="14" y1="5" x2="19" y2="10" />
    <line x1="3" y1="17" x2="7" y2="21" />
    <line x1="5" y1="19" x2="3" y2="17" />
  </svg>
);

/** Ranged Attacker - bow and arrow. */
const RangedAttackerIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 19 Q2 12, 5 5" />
    <line x1="5" y1="5" x2="5" y2="19" />
    <line x1="5" y1="12" x2="19" y2="5" />
    <path d="M17 5 L20 4 L19 7" />
  </svg>
);

/** Exploder - explosion / starburst. */
const ExploderIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <polygon points="12,2 14,8 20,6 16,11 22,12 16,13 20,18 14,16 12,22 10,16 4,18 8,13 2,12 8,11 4,6 10,8" />
  </svg>
);

/** Tameable - heart above a hand. */
const TameableIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 8 C10 4, 5 4, 5 8 C5 12, 12 16, 12 16 C12 16, 19 12, 19 8 C19 4, 14 4, 12 8 Z" fill="currentColor" />
    <path d="M7 19 L12 21 L17 19" />
  </svg>
);

/** Rideable - saddle shape. */
const RideableIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 14 Q8 8, 12 10 Q16 8, 20 14" />
    <path d="M4 14 Q4 18, 8 18 L16 18 Q20 18, 20 14" />
    <path d="M10 10 L10 7 L14 7 L14 10" />
  </svg>
);

/** Breedable - two small hearts. */
const BreedableIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M8 10 C7 8, 4 8, 4 10 C4 13, 8 15, 8 15 C8 15, 12 13, 12 10 C12 8, 9 8, 8 10 Z" />
    <path d="M16 8 C15 6, 12 6, 12 8 C12 11, 16 13, 16 13 C16 13, 20 11, 20 8 C20 6, 17 6, 16 8 Z" />
  </svg>
);

/** Undead - skull. */
const UndeadIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 13 Q6 4, 12 4 Q18 4, 18 13 L18 15 L15 15 L15 13 L13 15 L11 13 L9 15 L6 15 Z" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" />
    <circle cx="15" cy="10" r="1.5" fill="currentColor" />
  </svg>
);

/** Wanders - footprints / path. */
const WandersIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <ellipse cx="8" cy="6" rx="1.5" ry="2.5" transform="rotate(-20 8 6)" />
    <ellipse cx="14" cy="10" rx="1.5" ry="2.5" transform="rotate(15 14 10)" />
    <ellipse cx="9" cy="15" rx="1.5" ry="2.5" transform="rotate(-10 9 15)" />
    <ellipse cx="16" cy="19" rx="1.5" ry="2.5" transform="rotate(20 16 19)" />
  </svg>
);

/** Teleporter - sparkle / warp effect. */
const TeleporterIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 2 L13 8 L18 5 L14 10 L20 12 L14 14 L18 19 L13 16 L12 22 L11 16 L6 19 L10 14 L4 12 L10 10 L6 5 L11 8 Z" />
  </svg>
);

// ============================================================================
// BLOCK TRAIT ICONS
// ============================================================================

/** Solid block - filled cube. */
const SolidIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" opacity="0.85">
    <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" />
    <path d="M12 12 L22 8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
    <path d="M12 12 L2 8" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
    <path d="M12 12 L12 22" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
  </svg>
);

/** Transparent block - outlined cube with dashes. */
const TransparentIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeDasharray="2 2"
  >
    <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" />
    <path d="M12 12 L22 8" />
    <path d="M12 12 L2 8" />
    <path d="M12 12 L12 22" />
  </svg>
);

/** Slab - half-height block. */
const SlabIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" opacity="0.85">
    <path d="M12 11 L22 14 L22 18 L12 22 L2 18 L2 14 Z" />
    <path d="M12 11 L22 14" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
    <path d="M12 16 L2 14" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
    <path d="M12 16 L12 22" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
  </svg>
);

/** Stairs - step shape. */
const StairsIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" opacity="0.85">
    <path d="M4 8 L12 8 L12 14 L20 14 L20 20 L4 20 Z" />
  </svg>
);

/** Fence - vertical post with rails. */
const FenceIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <line x1="6" y1="4" x2="6" y2="20" />
    <line x1="18" y1="4" x2="18" y2="20" />
    <line x1="6" y1="9" x2="18" y2="9" />
    <line x1="6" y1="15" x2="18" y2="15" />
    <path d="M4 4 L6 2 L8 4" />
    <path d="M16 4 L18 2 L20 4" />
  </svg>
);

/** Door - rectangle with handle. */
const DoorIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="3" width="14" height="18" rx="1" />
    <line x1="5" y1="12" x2="19" y2="12" />
    <circle cx="16" cy="15" r="1" fill="currentColor" />
  </svg>
);

/** Container - chest / box with lid. */
const ContainerIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="10" width="18" height="10" rx="1" />
    <path d="M3 10 L3 7 Q3 5, 5 5 L19 5 Q21 5, 21 7 L21 10" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <rect x="10" y="12" width="4" height="2" rx="0.5" fill="currentColor" />
  </svg>
);

/** Light Source - sun / glow. */
const LightSourceIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <line x1="12" y1="2" x2="12" y2="5" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="2" y1="12" x2="5" y2="12" />
    <line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.9" y1="4.9" x2="6.9" y2="6.9" />
    <line x1="17.1" y1="17.1" x2="19.1" y2="19.1" />
    <line x1="4.9" y1="19.1" x2="6.9" y2="17.1" />
    <line x1="17.1" y1="6.9" x2="19.1" y2="4.9" />
  </svg>
);

/** Gravity - falling block with down arrow. */
const GravityIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="7" y="3" width="10" height="8" rx="1" fill="currentColor" opacity="0.3" />
    <line x1="12" y1="13" x2="12" y2="20" />
    <path d="M8 17 L12 21 L16 17" />
  </svg>
);

/** Redstone Signal - redstone dust / signal. */
const RedstoneSignalIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" fill="currentColor" />
    <path d="M12 4 L12 9" />
    <path d="M12 15 L12 20" />
    <path d="M4 12 L9 12" />
    <path d="M15 12 L20 12" />
    <circle cx="12" cy="4" r="1.5" fill="currentColor" />
    <circle cx="12" cy="20" r="1.5" fill="currentColor" />
  </svg>
);

// ============================================================================
// ITEM TRAIT ICONS
// ============================================================================

/** Sword - blade shape. */
const SwordIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="19" x2="15" y2="5" />
    <path d="M15 5 L18 3 L19 6 L15 5" fill="currentColor" />
    <line x1="7" y1="17" x2="3" y2="21" />
    <line x1="5" y1="15" x2="9" y2="19" />
  </svg>
);

/** Pickaxe - mining tool. */
const PickaxeIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="18" x2="16" y2="8" />
    <path d="M13 5 L16 8 L19 5 Q17 2, 13 5" fill="currentColor" />
  </svg>
);

/** Axe - chopping tool. */
const AxeIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="20" x2="16" y2="8" />
    <path d="M14 10 Q18 6, 20 4 Q18 4, 14 6 Q12 8, 14 10 Z" fill="currentColor" />
  </svg>
);

/** Shovel - digging tool. */
const ShovelIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="16" x2="14" y2="10" />
    <path d="M14 10 Q14 5, 17 3 Q20 5, 18 10 Q16 12, 14 10 Z" fill="currentColor" />
    <line x1="6" y1="18" x2="10" y2="14" />
  </svg>
);

/** Food - apple / fruit. */
const FoodIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 6 Q7 6, 5 12 Q5 19, 12 20 Q19 19, 19 12 Q17 6, 12 6 Z" />
    <path d="M12 6 Q11 3, 13 2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <ellipse cx="14" cy="4" rx="2" ry="1" fill="currentColor" opacity="0.5" />
  </svg>
);

/** Helmet - head armor. */
const HelmetIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 14 L5 10 Q5 4, 12 4 Q19 4, 19 10 L19 14" />
    <path d="M3 14 L21 14 L21 17 L3 17 Z" fill="currentColor" opacity="0.3" />
    <rect x="7" y="14" width="10" height="4" rx="0.5" fill="currentColor" opacity="0.15" />
  </svg>
);

/** Chestplate - chest armor. */
const ChestplateIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 7 L8 5 L12 7 L16 5 L20 7 L20 18 L14 20 L12 18 L10 20 L4 18 Z" />
    <line x1="12" y1="7" x2="12" y2="18" />
  </svg>
);

/** Leggings - leg armor. */
const LeggingsIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 4 L18 4 L18 10 L15 20 L13 20 L12 14 L11 20 L9 20 L6 10 Z" />
    <line x1="12" y1="4" x2="12" y2="14" />
  </svg>
);

/** Boots - foot armor. */
const BootsIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 5 L5 16 L3 18 L3 20 L11 20 L11 16 L9 16 L9 5 Z" />
    <path d="M15 5 L15 16 L13 18 L13 20 L21 20 L21 16 L19 16 L19 5 Z" />
  </svg>
);

/** Throwable - projectile in arc. */
const ThrowableIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 18 Q8 4, 18 8" />
    <circle cx="18" cy="8" r="2.5" fill="currentColor" />
    <path d="M15 6 L18 3" />
    <path d="M20 6 L22 4" />
  </svg>
);

/** Custom item - wrench / gear. */
const CustomItemIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2 L13 5 L11 5 Z" fill="currentColor" />
    <path d="M12 22 L13 19 L11 19 Z" fill="currentColor" />
    <path d="M2 12 L5 13 L5 11 Z" fill="currentColor" />
    <path d="M22 12 L19 13 L19 11 Z" fill="currentColor" />
    <path d="M5 5 L7 7 L6 8 Z" fill="currentColor" />
    <path d="M19 19 L17 17 L18 16 Z" fill="currentColor" />
    <path d="M19 5 L17 7 L18 8 Z" fill="currentColor" />
    <path d="M5 19 L7 17 L6 16 Z" fill="currentColor" />
  </svg>
);

// ============================================================================
// ICON MAPS
// ============================================================================

/**
 * Maps entity trait IDs to their icon components.
 */
export const EntityTraitIconMap: Record<string, React.FC> = {
  humanoid: TwoLeggedIcon,
  quadruped: FourLeggedIcon,
  flying: FlyingIcon,
  aquatic: AquaticIcon,
  hostile: HostileIcon,
  passive: PassiveIcon,
  neutral: NeutralIcon,
  melee_attacker: MeleeAttackerIcon,
  ranged_attacker: RangedAttackerIcon,
  exploder: ExploderIcon,
  tameable: TameableIcon,
  rideable: RideableIcon,
  breedable: BreedableIcon,
  undead: UndeadIcon,
  wanders: WandersIcon,
  teleporter: TeleporterIcon,
};

/**
 * Maps block trait IDs to their icon components.
 */
export const BlockTraitIconMap: Record<string, React.FC> = {
  solid: SolidIcon,
  transparent: TransparentIcon,
  slab: SlabIcon,
  stairs: StairsIcon,
  fence: FenceIcon,
  door: DoorIcon,
  container: ContainerIcon,
  light_source: LightSourceIcon,
  gravity: GravityIcon,
  redstone_signal: RedstoneSignalIcon,
};

/**
 * Maps item trait IDs to their icon components.
 */
export const ItemTraitIconMap: Record<string, React.FC> = {
  sword: SwordIcon,
  pickaxe: PickaxeIcon,
  axe: AxeIcon,
  shovel: ShovelIcon,
  food: FoodIcon,
  armor_helmet: HelmetIcon,
  armor_chestplate: ChestplateIcon,
  armor_leggings: LeggingsIcon,
  armor_boots: BootsIcon,
  throwable: ThrowableIcon,
  custom: CustomItemIcon,
};

// ============================================================================
// RENDER HELPERS
// ============================================================================

/**
 * Render the icon for a given entity trait ID.
 * Returns null if no icon is defined for the trait.
 */
export function renderEntityTraitIcon(traitId: string): JSX.Element | null {
  const IconComponent = EntityTraitIconMap[traitId];
  if (!IconComponent) return null;
  return <IconComponent />;
}

/**
 * Render the icon for a given block trait ID.
 * Returns null if no icon is defined for the trait.
 */
export function renderBlockTraitIcon(traitId: string): JSX.Element | null {
  const IconComponent = BlockTraitIconMap[traitId];
  if (!IconComponent) return null;
  return <IconComponent />;
}

/**
 * Render the icon for a given item trait ID.
 * Returns null if no icon is defined for the trait.
 */
export function renderItemTraitIcon(traitId: string): JSX.Element | null {
  const IconComponent = ItemTraitIconMap[traitId];
  if (!IconComponent) return null;
  return <IconComponent />;
}
