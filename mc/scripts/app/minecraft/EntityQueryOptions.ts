// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import BlockAreaSize from "./BlockAreaSize";
import EntityQueryScoreOptions from "./EntityQueryScoreOptions";
import { GameMode } from "./GameMode";
import Location from "../minecraft/Location";

/**
 * Contains options for selecting entities within an area.
 */
export default class EntityQueryOptions {
  /**
   * Limits the number of entities to return, opting for the
   * closest N entities as specified by this property. The
   * location value must also be specified on the query options
   * object.
   */
  "closest": number;
  /**
   * Excludes entities that match one or more of the specified
   * families.
   */
  "excludeFamilies": string[];
  /**
   * Excludes entities if have a specific gamemode that matches
   * the specified gamemode.
   */
  "excludeGameModes": GameMode[];
  /**
   * Excludes entities that have a name that match one of the
   * specified values.
   */
  "excludeNames": string[];
  /**
   * Excludes entities with a tag that matches one of the
   * specified values.
   */
  "excludeTags": string[];
  /**
   * Excludes entities if they are one of the specified types.
   */
  "excludeTypes": string[];
  /**
   * If specified, includes entities that match one of the
   * specified families.
   */
  "families": string[];
  /**
   * Limits the number of entities to return, opting for the
   * farthest N entities as specified by this property. The
   * location value must also be specified on the query options
   * object.
   */
  "farthest": number;
  /**
   * If specified, includes entities with a gamemode that matches
   * the specified gamemode.
   */
  "gameMode": GameMode;
  /**
   * Adds a seed location to the query that is used in
   * conjunction with closest, farthest, limit, volume, and
   * distance properties.
   */
  "location": Location;
  /**
   * If specified, includes entities that are less than this
   * distance away from the location specified in the location
   * property.
   */
  "maxDistance": number;
  /**
   * If specified, will only include entities that have at most
   * this horizontal rotation.
   */
  "maxHorizontalRotation": number;
  /**
   * If defined, only players that have at most this level are
   * returned.
   */
  "maxLevel": number;
  /**
   * If specified, only entities that have at most this vertical
   * rotation are returned.
   */
  "maxVerticalRotation": number;
  /**
   * If specified, includes entities that are least this distance
   * away from the location specified in the location property.
   */
  "minDistance": number;
  /**
   * If specified, will only include entities that have at a
   * minimum this horizontal rotation.
   */
  "minHorizontalRotation": number;
  /**
   * If defined, only players that have at least this level are
   * returned.
   */
  "minLevel": number;
  /**
   * If specified, will only include entities that have at least
   * this vertical rotation.
   */
  "minVerticalRotation": number;
  /**
   * Includes entities with the specified name.
   */
  "name": string;
  /**
   * Gets/sets a collection of EntityQueryScoreOptions objects
   * with filters for specific scoreboard objectives.
   */
  "scoreOptions": EntityQueryScoreOptions[];
  /**
   * Includes entities that match one or more of the specified
   * tags.
   */
  "tags": string[];
  /**
   * If defined, entities that match this type are included.
   */
  "type": string;
  /**
   * In conjunction with location, specified a cuboid volume of
   * entities to include.
   */
  "volume": BlockAreaSize;
}
