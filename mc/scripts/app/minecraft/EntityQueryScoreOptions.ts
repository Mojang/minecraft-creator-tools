// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Contains additional options for filtering players based on
 * their score for an objective.
 */
export default class EntityQueryScoreOptions {
  /**
   * If set to true, entities and players within this score range
   * are excluded from query results.
   */
  "exclude": boolean;
  /**
   * If defined, only players that have a score under maxScore
   * are included.
   */
  "maxScore": number;
  /**
   * If defined, only players that have a score over minScore are
   * included.
   */
  "minScore": number;
  /**
   * Identifier of the scoreboard objective to filter on.
   */
  "objective": string;
}
