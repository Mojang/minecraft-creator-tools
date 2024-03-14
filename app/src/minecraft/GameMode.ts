// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Represents a game mode for the current world experience.
 */
export enum GameMode {
  /**
   * World is in a survival mode, where players can take damage
   * and entities may not be peaceful. Survival mode is where the
   * player must collect resources, build structures while
   * surviving in their generated world. Activities can, over
   * time, chip away at player health and hunger bar.
   */
  survival = 0,
  /**
   * World is in a full creative mode. In creative mode, the
   * player has all the resources available in the item selection
   * tabs and the survival selection tab. They can also destroy
   * blocks instantly including those which would normally be
   * indestructible. Command and structure blocks can also be
   * used in creative mode. Items also do not lose durability or
   * disappear.
   */
  creative = 1,
  /**
   * World is in a more locked-down experience, where blocks may
   * not be manipulated.
   */
  adventure = 2,
}
