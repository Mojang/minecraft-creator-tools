// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Context for evaluating Molang expressions. Provides query values, variables,
 * and temporary values that Molang expressions can reference.
 *
 * Used by MolangEvaluator to resolve `query.*`, `variable.*`, and `temp.*` references
 * during render controller evaluation.
 */
export default interface IMolangContext {
  queries: Map<string, number>;
  variables: Map<string, number>;
  temps: Map<string, number>;
}

/**
 * Creates a default entity context for gallery/preview rendering.
 * Represents an adult entity with default variant (not baby, not sheared, variant 0).
 */
export function createDefaultEntityContext(): IMolangContext {
  const queries = new Map<string, number>();

  // Common entity state queries - default to adult, normal appearance
  queries.set("query.is_baby", 0);
  queries.set("query.is_sheared", 0);
  queries.set("query.is_tamed", 0);
  queries.set("query.is_angry", 0);
  queries.set("query.is_saddled", 0);
  queries.set("query.is_charged", 0);
  queries.set("query.is_powered", 0);
  queries.set("query.is_ignited", 0);
  queries.set("query.is_swimming", 0);
  queries.set("query.is_sleeping", 0);
  queries.set("query.variant", 0);
  queries.set("query.mark_variant", 0);
  queries.set("query.skin_id", 0);

  return {
    queries,
    variables: new Map<string, number>(),
    temps: new Map<string, number>(),
  };
}
