// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * EntityTraitApplier — Applies trait diffs to an existing EntityTypeDefinition.
 *
 * The Content Wizard generates fresh entity files from a trait list via
 * `ContentGenerator`. Once an entity exists in a project, its traits are
 * inferred from its components by `TraitDetector` rather than being stored
 * explicitly. As a result, the Traits tab in the Entity Type Editor must
 * translate user toggles into actual component / component-group / event
 * mutations on the entity, otherwise the toggled state will simply revert
 * the next time the picker re-runs detection.
 *
 * This module implements that translation. Given the previously-detected
 * trait list and the user's desired list, it adds components/component
 * groups/events for newly-selected traits and removes them for de-selected
 * traits, using the same trait definitions registered in `TraitRegistry`
 * that `ContentGenerator` consumes during entity creation.
 *
 * Related files:
 * - traits/ContentTraits.ts — Trait data interfaces & registry
 * - traits/index.ts — Registers all built-in traits
 * - TraitDetector.ts — Detects current traits from raw components
 * - EntityTraitPicker.tsx — UX that calls into this module via the editor
 */

import { EntityTraitId } from "./IContentMetaSchema";
import EntityTypeDefinition from "./EntityTypeDefinition";
import { TraitRegistry, IEntityTraitData } from "./traits/ContentTraits";
import { registerAllEntityTraits } from "./traits";

let _entityTraitsInitialized = false;
function ensureEntityTraitsInitialized(): void {
  if (!_entityTraitsInitialized) {
    registerAllEntityTraits();
    _entityTraitsInitialized = true;
  }
}

/**
 * Apply the difference between two trait selections to an entity definition.
 *
 * Components, component groups, and events contributed by traits that were
 * removed are deleted; those contributed by newly-added traits are merged in.
 * The entity's underlying `_data` is mutated in place; callers are
 * responsible for calling `persist()` and refreshing any dependent UI.
 *
 * Body-type traits are mutually exclusive (handled upstream by
 * `toggleEntityTrait`), so when the user swaps body types the diff will
 * naturally include both a removal and an addition.
 */
export function applyEntityTraitChanges(
  et: EntityTypeDefinition,
  oldTraits: EntityTraitId[],
  newTraits: EntityTraitId[]
): void {
  ensureEntityTraitsInitialized();

  if (!et._data) {
    return;
  }

  const oldSet = new Set(oldTraits);
  const newSet = new Set(newTraits);
  const added = newTraits.filter((t) => !oldSet.has(t));
  const removed = oldTraits.filter((t) => !newSet.has(t));

  // Removals first so that re-adding a trait restores its components even if
  // it was previously removed via a different code path.
  for (const traitId of removed) {
    const data = _getTraitData(traitId);
    if (!data) continue;
    _removeTraitData(et, data);
  }

  for (const traitId of added) {
    const data = _getTraitData(traitId);
    if (!data) continue;
    _addTraitData(et, data);
  }
}

function _getTraitData(traitId: string): IEntityTraitData | undefined {
  const trait = TraitRegistry.getEntityTrait(traitId);
  if (!trait) return undefined;
  return trait.getData();
}

function _addTraitData(et: EntityTypeDefinition, data: IEntityTraitData): void {
  const bp = et._data!;

  if (data.components) {
    if (!bp.components) bp.components = {} as any;
    for (const [id, value] of Object.entries(data.components)) {
      // Use the managed API so component-added events fire and the editor UI
      // refreshes if it is observing them.
      et.addComponent(id, value as any);
    }
  }

  if (data.componentGroups) {
    if (!bp.component_groups) bp.component_groups = {} as any;
    for (const [name, group] of Object.entries(data.componentGroups)) {
      bp.component_groups[name] = { ...(group as Record<string, any>) } as any;
    }
  }

  if (data.events) {
    if (!bp.events) bp.events = {} as any;
    for (const [name, event] of Object.entries(data.events)) {
      bp.events[name] = { ...(event as Record<string, any>) } as any;
    }
  }
}

function _removeTraitData(et: EntityTypeDefinition, data: IEntityTraitData): void {
  const bp = et._data!;

  if (data.components && bp.components) {
    for (const id of Object.keys(data.components)) {
      et.removeComponent(id);
    }
  }

  if (data.componentGroups && bp.component_groups) {
    for (const name of Object.keys(data.componentGroups)) {
      delete bp.component_groups[name];
    }
  }

  if (data.events && bp.events) {
    for (const name of Object.keys(data.events)) {
      delete bp.events[name];
    }
  }
}
