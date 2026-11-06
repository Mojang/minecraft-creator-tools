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
 * Entities that were not generated from traits in the first place (vanilla
 * mobs added from the gallery such as the cow or the wolf, or the Full
 * Add-On sample's hand-authored biceson) keep the components that define a
 * trait inside their own component groups and wire them up with their own
 * events. The applier has to respect that authored content:
 *
 * 1. Removing a trait deletes the trait's canonical data (its top-level
 *    components, its component groups and its events) and additionally
 *    strips, from every authored location, only the components that both
 *    belong to the trait and keep it detectable: the part of the detector
 *    signature the trait contributes itself. Deselecting Tameable on the
 *    wolf removes `minecraft:tameable` from `minecraft:wolf_wild` but leaves
 *    the llama avoidance that lives next to it, even though the Tameable
 *    template happens to ship a player avoidance of its own.
 * 2. When a trait is replaced by one it conflicts with (a temperament
 *    switch), the components the outgoing trait keeps inside its own groups
 *    are its state machinery and go too; a passive mob must not keep the
 *    on-sight targeting of its neutral past. Two protections still apply:
 *    components the detector needs to keep reporting a trait that stays
 *    selected are kept (`TraitDetector.getEntityTraitDetectionComponents`
 *    over the whole requested selection, so deselecting Passive on a
 *    wandering mob keeps `random_stroll`, while deselecting Wanders on a
 *    passive mob does remove it), and authored entries that the incoming
 *    trait itself supplies are kept, so Hostile → Neutral does not delete a
 *    mob's own targeting only for Neutral to add a generic copy back.
 * 3. Nothing authored is ever overwritten by a trait's defaults. An existing
 *    top-level component wins over the trait's version; an existing
 *    component group with a canonical name keeps its own values and only
 *    gains the components the trait needs; an existing event with a
 *    canonical name (Neutral's `minecraft:on_hurt` is a built-in trigger
 *    name a mob may well define itself) gains the trait's group transitions
 *    and keeps its own. Removing the trait takes exactly that back out
 *    again. Families a trait adds to `minecraft:type_family` are recorded so
 *    removing the trait drops only the memberships it introduced (a spider
 *    that was already a `monster` stays one after Undead goes on and off).
 *    A trait only ever inserts families at the top level, so that is the
 *    only place a recorded removal looks: a family list inside one of the
 *    mob's own component groups is authored and is left alone, even when it
 *    names a family the trait ships. Whatever still keeps the trait detected
 *    once its recorded memberships are gone is the mob's own, whether there
 *    never was a record (a shipped undead mob, or a project saved before the
 *    journal existed) or the record is partial (the vanilla skeleton horse's
 *    authored `undead` comes back on re-selection, so only `monster` is
 *    recorded as the trait's): it is dropped, from the top level and from
 *    the mob's own groups (the vanilla zombie's baby and rider groups each
 *    say `undead`), so the deselection sticks, and journaled as the mob's
 *    own so it comes back with the trait. The rest of the mob's
 *    classification (`monster`) is left alone. A membership the trait
 *    introduced but the creator has since commented is theirs too: it
 *    still goes with the trait, but journaled rather than quietly, and
 *    comes back with it. Each membership taken out is journaled with its
 *    position in the list and the comments that sat on it, so it goes back
 *    as it was; and a family list the creator
 *    commented (or whose component they commented) is never deleted when
 *    that empties it: it is left empty, the way a commented event is kept,
 *    so the comment stays in the file.
 * 4. Authored entries that do get deleted (rules 1 and 2, plus a canonical
 *    group the creator edited after it was generated, plus the mob's own
 *    event transitions into a canonical group, see rule 5) are journaled
 *    per trait; re-selecting the trait that caused the deletion puts them
 *    back, so a Neutral → Hostile → Neutral round trip leaves the authored
 *    groups and events exactly as they were. The journal is part of the
 *    tool-only trait metadata the caller passes in
 *    (`IEntityTraitOverrides.traitJournal`, persisted on the project item),
 *    so it survives saving, closing and reopening the entity; only callers
 *    that pass no overrides get a journal that lives as long as the
 *    definition object. Journaled values are the authored objects
 *    themselves, never copies, so the comments a creator wrote inside them
 *    survive an in-session round trip. The project file is plain JSON and
 *    would drop those comments, so a value that carries any is also
 *    journaled as comment-preserving text (`IAuthoredEdit.text`) and is
 *    rebuilt from that after a reload. A comment is authored content too:
 *    a canonical group that differs from the template only by a comment is
 *    journaled, not discarded as pristine, and a commented event is never
 *    deleted. An entry whose slot is occupied when the trait comes back is
 *    left in the journal and reported as unrestored rather than dropped, so
 *    a later round trip can still recover it. Every call returns an
 *    `IEntityTraitChangeReport` listing what was removed, restored and left
 *    unrestored; the Traits tab shows that summary to the creator.
 * 5. A trait's replacement behavior is activated, not just declared. Traits
 *    whose behavior lives in a component group (Hostile targets from
 *    `hostile_angry`) declare a `spawnEvent`; the applier merges its groups
 *    into every branch of the entity's `minecraft:entity_spawned` (and
 *    `minecraft:entity_born` when present), the way `ContentGenerator` does
 *    for new entities: every spawn outcome gets them, so a group the mob
 *    already names on one random sibling is still added to the others. An
 *    outcome that already enters one of the trait's states (a spawn branch
 *    the creator set up to start out angry) is in the trait's hands already
 *    and is left in that state rather than also made calm.
 *    Removing the trait scrubs its groups from every event again so no
 *    transition references a deleted group. Every reference it takes out
 *    is journaled with its position in the transition's group list (a later
 *    group overrides an earlier one, so the position is behavior, and a
 *    name may appear twice with both occurrences counting), with the
 *    comments that sat on it, and with what identified every branch on the
 *    way to it: its filters, weight, trigger and so on, plus, since two
 *    outcomes may share all of those, everything else the branch held once
 *    the trait's groups were out of it, and whether a sibling looked the
 *    same at the time. When the trait returns it goes back in that
 *    position, in that branch, with its comments, and nothing else in the
 *    list is touched: a comment the creator changed meanwhile stays
 *    changed, and another trait's references can come and go around it. A
 *    group the creator has put back by hand in the meantime is theirs and
 *    is not listed a second time.
 *    Which references are the trait's own is recorded, never inferred from
 *    names (`IEntityTraitJournal.eventGroupsAddedByTrait`); those go back
 *    the same way but are not reported as the creator's content. Everything
 *    else that names a canonical group (a creator's own `my:enrage` event
 *    that adds `neutral_angry`, or a `minecraft:on_hurt` the mob wrote
 *    itself that goes angry in only one `randomize` branch) is the mob's
 *    own wiring, however closely it matches the template, and is reported.
 *    A branch that has since been deleted or replaced (the lone survivor of
 *    two that looked alike included), one that can no longer be told from a
 *    sibling, and a group list the creator reordered around the slot cannot
 *    take an entry back: it stays journaled and is reported as unrestored.
 *    A group the mob's own event already names on that side is left where
 *    the mob put it when the trait's own events are merged in; the trait
 *    does not spread it into every branch. The same goes for a reference
 *    of the mob's own that could not go back because its branch was
 *    deleted while the trait was off: it is still the mob's wiring for
 *    that group, so the default is not spread into the surviving branches
 *    either; the entry stays journaled and is reported as unrestored. Only
 *    when the mob's event itself is gone is the trait's event created
 *    whole. The steps of a `sequence` run one after another on the same
 *    spawn, unlike `randomize` outcomes, which are alternatives: a state an
 *    earlier step enters (the creator's angry step, or the calm this pass
 *    has just given every outcome of a fan-out before it) holds for the
 *    steps after it, so those are left alone rather than given a default
 *    that would override it. A step that runs only under `filters` (the
 *    creator's baby-only angry step) enters its state only on the spawns
 *    the filters let through; the spawns that skip it still need the
 *    default, but the step after it is the wrong place, where the default
 *    would come last and override the state on the spawns that did run it.
 *    The default gets a step of its own instead, right before the step
 *    that would otherwise get it, that runs only when none of those
 *    filters do (`none_of`), so
 *    both outcomes of the filter end up in a state and neither overrides
 *    the other. That step is the trait's own: it leaves with the trait and
 *    comes back with it, and is never reported as the creator's content.
 * 6. Body shapes are indistinguishable by their components alone and their
 *    locomotion components are shared by every land mob, so they never
 *    remove anything: picking one only fills in missing locomotion defaults
 *    and records the choice as tool-only metadata
 *    (`IEntityTraitOverrides.bodyShape`, persisted on the project item).
 *    `resolveEntityTraits` applies that choice on top of detection, which is
 *    what the Traits tab shows. `minecraft:type_family` is gameplay data and
 *    is never used to carry the choice.
 *
 * Related files:
 * - traits/ContentTraits.ts — Trait data interfaces & registry
 * - traits/index.ts — Registers all built-in traits
 * - TraitDetector.ts — Detects current traits from raw components
 * - ../app/IProjectItemData.ts — Where the body shape choice and the journal are persisted
 * - EntityTraitPicker.tsx — UX that calls into this module via the editor and shows the report
 */

import { EntityTraitId } from "./IContentMetaSchema";
import EntityTypeDefinition from "./EntityTypeDefinition";
import { TraitRegistry, IEntityTraitData } from "./traits/ContentTraits";
import { registerAllEntityTraits } from "./traits";
import TraitDetector, { BODY_SHAPE_TRAIT_IDS, ITraitDetectionResult } from "./TraitDetector";
import {
  CommentArrayClass,
  hasCommentMetadata,
  parseJsonWithComments,
  stringifyJsonWithComments,
} from "../core/JsonUtilities";

const TYPE_FAMILY_COMPONENT = "minecraft:type_family";
const SPAWN_EVENT = "minecraft:entity_spawned";
const BORN_EVENT = "minecraft:entity_born";

/** One comment comment-json kept on a list entry, in the shape the project file can hold. */
export interface IJournaledComment {
  type: "BlockComment" | "LineComment";
  value: string;
  inline: boolean;
}

/** What kind of authored entry an `IAuthoredEdit` describes. */
export type AuthoredEditKind = "component" | "componentGroup" | "eventGroup" | "family";

/**
 * One authored entry that a trait change deleted, restored or could not
 * restore. For a component or a family membership, `group` names the
 * component group holding it and is undefined at the entity's top level; a
 * component group has no `group`. An event group is one occurrence of a
 * component-group name in an event transition: `event` names the event,
 * `action` the side of the transition, `branch` the way down the event's
 * `randomize` / `sequence` tree to the node holding it (alternating key and
 * index; empty at the event's top level), `branchIdentity` and
 * `branchContext` what identified each node on that way (the event first),
 * `index` and `siblings` where it sat in the transition's group list and
 * what that list was, and `comments` the comments that sat on it there. A
 * family membership carries `index`, `siblings` and `comments` the same
 * way, for its place in the holder's family list. Events themselves are
 * never deleted (see rule 3), so they carry no value.
 */
export interface IAuthoredEdit {
  kind: AuthoredEditKind;
  group?: string;
  /** Component id, component group name, family name, or the group an event transition names. */
  id: string;
  /** The authored object itself for a component or component group; absent for an event group or family. */
  value?: any;
  /**
   * Comment-preserving JSON of `value`, present only when the authored
   * object carries comments. The project file is plain JSON and loses
   * them, so this is what a reloaded journal restores from.
   */
  text?: string;
  event?: string;
  action?: "add" | "remove";
  branch?: (string | number)[];
  /** What identified each node down `branch`, the event itself first; see `_nodeIdentity`. */
  branchIdentity?: string[];
  /**
   * Everything else each node down `branch` held once the trait's groups
   * were out of it, the event itself first; tells apart siblings that share
   * an identity (two outcomes of the same weight). See `_nodeContext`.
   */
  branchContext?: string[];
  /**
   * Whether each node down `branch` had a sibling with the same identity
   * when the entry was taken out, the event itself first (always false).
   * Such a node is only ever found again by its context, even when it is
   * the only lookalike left: the other one may be what was deleted.
   */
  branchShared?: boolean[];
  /** Position of an event group in its transition's group list, or of a family in its family list, when it was taken out. */
  index?: number;
  /** That list as it was, so the entry can go back in the same relative order. */
  siblings?: string[];
  /** The comments that sat on this occurrence in its list, by kind (`before`, `after`...), so they come back with it. */
  comments?: { [kind: string]: IJournaledComment[] };
  /** A reference the trait put there itself: journaled for its position only, never reported as the creator's content. */
  traitOwn?: boolean;
}

/**
 * One component-group reference the applier inserted into an event on a
 * trait's behalf: the event, the side of the transition, the way down the
 * event's `randomize` / `sequence` tree (as `IAuthoredEdit.branch`) and the
 * group named there.
 */
export interface IEventGroupReference {
  event: string;
  action: "add" | "remove";
  branch: (string | number)[];
  id: string;
}

/**
 * Journal of what trait changes did to a mob's own content, kept so that
 * re-selecting a trait can put back what its removal took and removing it
 * can tell what it added from what the mob had. Plain JSON so it can live in
 * the project item's data; see `IEntityTraitOverrides.traitJournal`.
 */
export interface IEntityTraitJournal {
  /** Authored entries deleted by removing a trait, keyed by that trait. */
  removedByTrait: Record<string, IAuthoredEdit[]>;
  /** `minecraft:type_family` memberships each trait actually introduced. */
  familiesAddedByTrait: Record<string, string[]>;
  /** Event transitions each trait actually inserted, at the place it put them. */
  eventGroupsAddedByTrait: Record<string, IEventGroupReference[]>;
}

/** Callback for one component-group reference at its place in an event's branch tree. */
type EventGroupReferenceVisitor = (action: "add" | "remove", branch: (string | number)[], group: string) => void;

/**
 * Tool-only trait state kept outside the entity file. `ProjectItem`
 * implements this, so the editor passes the item straight through; tests
 * can pass a plain object.
 */
export interface IEntityTraitOverrides {
  bodyShape?: EntityTraitId;
  traitJournal?: IEntityTraitJournal;
}

/**
 * What a call to `applyEntityTraitChanges` did beyond adding and removing
 * canonical trait data.
 */
export interface IEntityTraitChangeReport {
  added: EntityTraitId[];
  removed: EntityTraitId[];
  /** Authored entries deleted because they kept a removed trait detectable. */
  removedAuthored: IAuthoredEdit[];
  /** Authored entries put back from an earlier change. */
  restoredAuthored: IAuthoredEdit[];
  /**
   * Journaled entries that could not be put back because their slot now
   * holds something else (or their group is gone). They stay journaled.
   */
  unrestoredAuthored: IAuthoredEdit[];
  /**
   * The definition was older than its file (its content had been replaced
   * behind it; see `EntityTypeDefinition.isOlderThanFile`), so nothing was
   * changed, written or recorded, and `added`/`removed` are empty. The
   * definition has been parsed again from the file; the caller shows what
   * the file holds and lets the user click again.
   */
  staleDefinition?: boolean;
}

/** Journals for callers that pass no overrides: as long-lived as the definition object. */
const _sessionJournals = new WeakMap<EntityTypeDefinition, IEntityTraitJournal>();

let _entityTraitsInitialized = false;
function ensureEntityTraitsInitialized(): void {
  if (!_entityTraitsInitialized) {
    registerAllEntityTraits();
    _entityTraitsInitialized = true;
  }
}

export function isBodyShapeTrait(traitId: EntityTraitId): boolean {
  return BODY_SHAPE_TRAIT_IDS.includes(traitId);
}

/** True when the report describes anything beyond canonical trait data coming and going. */
export function traitChangeTouchedAuthoredContent(report: IEntityTraitChangeReport): boolean {
  return (
    report.removedAuthored.length > 0 || report.restoredAuthored.length > 0 || report.unrestoredAuthored.length > 0
  );
}

/**
 * Detect an entity's traits from its components and component groups, then
 * apply the creator's explicit choices on top. This is what the Traits tab
 * shows and what it diffs against; use it wherever a trait list should
 * reflect the creator's intent rather than raw inference.
 */
export function resolveEntityTraits(
  et: EntityTypeDefinition,
  overrides?: IEntityTraitOverrides,
  minConfidence: number = TraitDetector.DEFAULT_MIN_CONFIDENCE
): ITraitDetectionResult<EntityTraitId>[] {
  if (!et._data) {
    return [];
  }

  const componentGroups: Record<string, Record<string, any>> = {};
  for (const [name, group] of Object.entries(et._data.component_groups || {})) {
    if (group && typeof group === "object") {
      componentGroups[name] = group as Record<string, any>;
    }
  }

  let results = TraitDetector.detectEntityTraits(et._data.components || {}, componentGroups, minConfidence);

  const bodyShape = overrides?.bodyShape;
  if (bodyShape && isBodyShapeTrait(bodyShape)) {
    results = results.filter((r) => !isBodyShapeTrait(r.traitId));
    results.push({
      traitId: bodyShape,
      confidence: 1.0,
      matchedComponents: [],
      notes: "Chosen in the Traits tab",
    });
  }

  return results;
}

/**
 * Apply the difference between two trait selections to an entity definition.
 *
 * Components, component groups, and events contributed by traits that were
 * removed are deleted; those contributed by newly-added traits are merged in
 * and activated. The entity's underlying `_data` is mutated in place, and a
 * file-backed definition is written back to its file's content before this
 * returns; callers are responsible for refreshing any dependent UI. A body
 * shape choice and the journal of deleted authored entries are recorded on
 * `overrides` when given.
 *
 * The write-back happens here, in the same step that records the choice on
 * the project item, so the entity bytes and the item's trait metadata are
 * never out of step: whichever project save comes next (the Save button,
 * creating a variant, a settings change) finds both pending, or neither.
 * Left to the editor's own persist, a save path that skipped it would write
 * the journal with an entity file that never had the removal.
 *
 * Body-type traits are mutually exclusive (handled upstream by
 * `toggleEntityTrait`), so when the user swaps body types the diff will
 * naturally include both a removal and an addition.
 */
export function applyEntityTraitChanges(
  et: EntityTypeDefinition,
  oldTraits: EntityTraitId[],
  newTraits: EntityTraitId[],
  overrides?: IEntityTraitOverrides
): IEntityTraitChangeReport {
  ensureEntityTraitsInitialized();

  const oldSet = new Set(oldTraits);
  const newSet = new Set(newTraits);
  const added = newTraits.filter((t) => !oldSet.has(t));
  const removed = oldTraits.filter((t) => !newSet.has(t));

  const report: IEntityTraitChangeReport = {
    added,
    removed,
    removedAuthored: [],
    restoredAuthored: [],
    unrestoredAuthored: [],
  };

  if (!et._data || (added.length === 0 && removed.length === 0)) {
    return report;
  }

  // A definition that is older than its file must not be edited: the write
  // at the end would be refused, and the journal and body shape recorded on
  // the item would then describe a removal the file never had. Nothing is
  // touched; the definition is parsed again from the file so the caller can
  // show what is there. Everything from here to the write is synchronous,
  // so the file cannot change in between and the write cannot be refused.
  if (et.behaviorPackFile && et.reloadIfOlderThanFile()) {
    return { ...report, added: [], removed: [], staleDefinition: true };
  }

  // Components that keep a still-selected trait detectable must not be
  // deleted just because a removed trait also contributed them.
  const protectedComponents = new Set<string>();
  for (const traitId of newTraits) {
    for (const id of TraitDetector.getEntityTraitDetectionComponents(traitId)) {
      protectedComponents.add(id);
    }
  }

  // Authored entries that an incoming trait would supply anyway are part of
  // the requested behavior; deleting them only to add a generic copy back
  // would lose the mob's own configuration.
  const incomingComponents = new Set<string>();
  for (const traitId of added) {
    const data = _getTraitData(traitId);
    if (data) {
      for (const id of _componentsContributedAnywhere(data)) {
        incomingComponents.add(id);
      }
    }
  }

  const journal = _getJournal(et, overrides);

  // Removals first so that re-adding a trait restores its components even if
  // it was previously removed via a different code path.
  for (const traitId of removed) {
    const data = _getTraitData(traitId);
    if (!data) continue;

    const replacedByConflict = added.some((a) => TraitDetector.entityTraitsConflict(traitId, a));
    _removeTraitData(et, traitId, data, replacedByConflict, protectedComponents, incomingComponents, journal, report);
  }

  for (const traitId of added) {
    const data = _getTraitData(traitId);
    // Authored entries come back first so the trait's own data is layered on
    // top of them the same way it was the first time round.
    _restoreRemoved(et, traitId, journal, report);
    if (data) {
      _addTraitData(et, traitId, data, journal);
    }
  }

  if (overrides) {
    const addedShape = added.find(isBodyShapeTrait);
    if (addedShape) {
      overrides.bodyShape = addedShape;
    } else if (removed.some(isBodyShapeTrait)) {
      overrides.bodyShape = undefined;
    }

    // Assign rather than rely on the in-place edits so an item that tracks
    // property changes notices, and drop an empty journal to keep the
    // project data clean.
    overrides.traitJournal = _isJournalEmpty(journal) ? undefined : journal;
  }

  if (et.behaviorPackFile) {
    et.persist();
  }

  return report;
}

function _getTraitData(traitId: string): IEntityTraitData | undefined {
  const trait = TraitRegistry.getEntityTrait(traitId);
  if (!trait) return undefined;
  return trait.getData();
}

function _emptyJournal(): IEntityTraitJournal {
  return { removedByTrait: {}, familiesAddedByTrait: {}, eventGroupsAddedByTrait: {} };
}

function _isJournalEmpty(journal: IEntityTraitJournal): boolean {
  return (
    Object.keys(journal.removedByTrait).length === 0 &&
    Object.keys(journal.familiesAddedByTrait).length === 0 &&
    Object.keys(journal.eventGroupsAddedByTrait).length === 0
  );
}

/**
 * The journal to record into: the one carried by the caller's overrides
 * (persisted with the project item) or, failing that, one tied to the
 * definition object for the session.
 */
function _getJournal(et: EntityTypeDefinition, overrides: IEntityTraitOverrides | undefined): IEntityTraitJournal {
  if (overrides) {
    const journal = overrides.traitJournal;
    if (journal && journal.removedByTrait && journal.familiesAddedByTrait) {
      // A journal saved before event references were recorded says nothing
      // about them, so every transition it meets counts as the mob's own.
      if (!journal.eventGroupsAddedByTrait) {
        journal.eventGroupsAddedByTrait = {};
      }
      return journal;
    }
    return _emptyJournal();
  }

  let journal = _sessionJournals.get(et);
  if (!journal) {
    journal = _emptyJournal();
    _sessionJournals.set(et, journal);
  }
  return journal;
}

/** Deep copy of canonical trait data (plain objects). Never used on authored values: it would drop their comments. */
function _clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function _sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Every component id a trait ships, at the top level or inside its own groups. */
function _componentsContributedAnywhere(data: IEntityTraitData): Set<string> {
  const ids = new Set<string>(Object.keys(data.components || {}));
  for (const group of Object.values(data.componentGroups || {})) {
    for (const id of Object.keys(group || {})) {
      ids.add(id);
    }
  }
  return ids;
}

/**
 * The components that have to leave an authored mob for a removed trait to
 * stop being detected: the part of its detector signature the trait
 * contributes itself. When the trait is being replaced by a conflicting one,
 * the components it keeps inside its own component groups (its behavioral
 * state machinery) are included as well.
 */
function _traitMachineryComponents(
  traitId: EntityTraitId,
  data: IEntityTraitData,
  replacedByConflict: boolean
): Set<string> {
  const contributed = _componentsContributedAnywhere(data);
  const machinery = new Set<string>();

  for (const id of TraitDetector.getEntityTraitDetectionComponents(traitId)) {
    if (contributed.has(id)) {
      machinery.add(id);
    }
  }

  if (replacedByConflict) {
    for (const group of Object.values(data.componentGroups || {})) {
      for (const id of Object.keys(group || {})) {
        machinery.add(id);
      }
    }
  }

  machinery.delete(TYPE_FAMILY_COMPONENT);

  return machinery;
}

function _addTraitData(
  et: EntityTypeDefinition,
  traitId: EntityTraitId,
  data: IEntityTraitData,
  journal: IEntityTraitJournal
): void {
  const bp = et._data!;

  if (data.components) {
    if (!bp.components) bp.components = {} as any;
    for (const [id, value] of Object.entries(data.components)) {
      // A trait that ships its own families (e.g. Undead's "undead"/"monster")
      // must not wipe the families the mob already has, or a cow turned
      // undead stops being a cow and its body shape detection goes with it.
      const incomingFamilies = id === TYPE_FAMILY_COMPONENT ? _getFamilyList(value) : undefined;
      if (incomingFamilies) {
        const inserted = _addFamilies(et, incomingFamilies);
        if (inserted.length > 0) {
          journal.familiesAddedByTrait[traitId] = [...(journal.familiesAddedByTrait[traitId] || []), ...inserted];
        }
        continue;
      }

      // The mob's own configuration wins over the trait's defaults.
      if (id in bp.components) continue;

      // Use the managed API so component-added events fire and the editor UI
      // refreshes if it is observing them.
      et.addComponent(id, _clone(value) as any);
    }
  }

  if (data.componentGroups) {
    if (!bp.component_groups) bp.component_groups = {} as any;
    for (const [name, group] of Object.entries(data.componentGroups)) {
      const existing = bp.component_groups[name];
      if (existing && typeof existing === "object") {
        // A group of that name is already there (the creator edited a
        // generated one, or wrote their own): keep it and only fill in the
        // components the trait needs.
        const existingGroup = existing as Record<string, any>;
        for (const [id, value] of Object.entries(group || {})) {
          if (!(id in existingGroup)) {
            existingGroup[id] = _clone(value);
          }
        }
        continue;
      }

      bp.component_groups[name] = _clone(group) as any;
    }
  }

  if (data.events) {
    if (!bp.events) bp.events = {} as any;
    for (const [name, event] of Object.entries(data.events)) {
      const record = _insertedReferenceRecorder(journal, traitId, name);
      const existing = bp.events[name];
      if (existing && typeof existing === "object") {
        // The mob already handles this event (built-in trigger names such as
        // minecraft:on_hurt are shared): add the trait's group transitions
        // to what it does rather than replacing it. A reference of the
        // mob's own that could not go back (its branch is gone) is still
        // the mob's wiring for that group, not a gap for the default to
        // fill: it stays journaled and reported instead.
        _mergeEventGroupTransitions(existing, event, record, _pendingEventReferences(journal, traitId, name));
        continue;
      }

      bp.events[name] = _clone(event) as any;
      _forEachGroupReference(bp.events[name], [], record);
    }
  }

  if (data.spawnEvent) {
    _activateSpawnGroups(et, data.spawnEvent, Object.keys(data.componentGroups || {}), journal, traitId);
  }
}

function _removeTraitData(
  et: EntityTypeDefinition,
  traitId: EntityTraitId,
  data: IEntityTraitData,
  replacedByConflict: boolean,
  protectedComponents: Set<string>,
  incomingComponents: Set<string>,
  journal: IEntityTraitJournal,
  report: IEntityTraitChangeReport
): void {
  const bp = et._data!;

  // Locomotion is shared by every land mob, and species families are the
  // mob's own; a body shape only ever adds what is missing and records the
  // choice, so there is nothing to take away.
  if (isBodyShapeTrait(traitId)) {
    return;
  }

  // Families are shared with the mob's own identity, so the memberships this
  // trait introduced go quietly, and whatever still keeps the trait detected
  // after that is the mob's own (authored, or put back from an earlier
  // removal, which leaves the record partial): it goes too so the
  // deselection sticks, journaled so it comes back with the trait.
  const addedFamilies = journal.familiesAddedByTrait[traitId];
  if (addedFamilies) {
    _removeFamilies(et, addedFamilies, traitId, journal, report);
  }
  delete journal.familiesAddedByTrait[traitId];
  _removeDetectableFamilies(et, traitId, journal, report);

  const canonicalGroups = Object.keys(data.componentGroups || {});

  if (data.components && bp.components) {
    for (const [id, canonicalValue] of Object.entries(data.components)) {
      if (id === TYPE_FAMILY_COMPONENT) continue;
      if (protectedComponents.has(id) || incomingComponents.has(id) || !(id in bp.components)) continue;

      _journalRemoval(journal, traitId, { kind: "component", id, value: bp.components[id] }, canonicalValue, report);
      et.removeComponent(id);
    }
  }

  if (bp.component_groups) {
    for (const name of canonicalGroups) {
      if (!(name in bp.component_groups)) continue;

      // A canonical group the creator changed since it was generated is
      // their content now: it still has to go (it is what keeps the trait
      // detected), but it is journaled so re-selecting the trait brings the
      // edited version back instead of the template.
      _journalRemoval(
        journal,
        traitId,
        { kind: "componentGroup", id: name, value: bp.component_groups[name] },
        data.componentGroups?.[name],
        report
      );
      delete bp.component_groups[name];
    }
  }

  if (data.events && bp.events) {
    for (const [name, canonicalEvent] of Object.entries(data.events)) {
      // Only an event that is still exactly the trait's own is deleted. One
      // the mob defines itself (or one the creator left a comment in) keeps
      // everything but the trait's group transitions, which the scrub below
      // takes out.
      if (name in bp.events && _sameValue(bp.events[name], canonicalEvent) && !_hasComments(bp.events[name])) {
        delete bp.events[name];
      }
    }
  }

  if (canonicalGroups.length > 0) {
    _removeGroupReferencesFromEvents(et, traitId, canonicalGroups, journal, report);
  }
  delete journal.eventGroupsAddedByTrait[traitId];

  // Strip the trait's own machinery from the mob's hand-written groups so
  // the detector stops reporting it; everything else in those groups stays.
  for (const id of _traitMachineryComponents(traitId, data, replacedByConflict)) {
    if (protectedComponents.has(id) || incomingComponents.has(id)) continue;

    if (bp.components && id in bp.components) {
      _journalRemoval(
        journal,
        traitId,
        { kind: "component", id, value: bp.components[id] },
        data.components?.[id],
        report
      );
      et.removeComponent(id);
    }

    for (const [groupName, group] of Object.entries(bp.component_groups || {})) {
      if (canonicalGroups.includes(groupName) || !group || typeof group !== "object" || !(id in group)) continue;

      const groupData = group as Record<string, any>;
      _journalRemoval(
        journal,
        traitId,
        { kind: "component", group: groupName, id, value: groupData[id] },
        data.componentGroups?.[groupName]?.[id],
        report
      );
      delete groupData[id];
    }
  }
}

/**
 * Record an authored entry the removal of `traitId` is about to delete.
 * Entries that still hold the trait's own canonical value were added by the
 * trait and are not authored content; a comment inside one makes it the
 * creator's. The journaled value is the authored object itself (it is being
 * detached from the entity), so any comments inside it come back with it in
 * this session, and a comment-preserving text copy carries them through the
 * plain-JSON project file for the next one.
 */
function _journalRemoval(
  journal: IEntityTraitJournal,
  traitId: EntityTraitId,
  edit: IAuthoredEdit,
  canonicalValue: any,
  report: IEntityTraitChangeReport
): void {
  const commented = edit.value !== undefined && _hasComments(edit.value);

  if (canonicalValue !== undefined && !commented && _sameValue(edit.value, canonicalValue)) {
    return;
  }

  if (commented) {
    edit.text = stringifyJsonWithComments(edit.value);
  }

  const edits = journal.removedByTrait[traitId] || [];
  edits.push(edit);
  journal.removedByTrait[traitId] = edits;

  // A reference the trait inserted itself is journaled so it goes back in
  // the position the creator may since have given it, but it is not the
  // creator's content and is not reported as such.
  if (!edit.traitOwn) {
    report.removedAuthored.push(edit);
  }
}

/** Whether a value, or anything nested inside it, carries comment-json comment metadata. */
function _hasComments(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (hasCommentMetadata(value)) {
    return true;
  }
  for (const child of Object.values(value as Record<string, unknown>)) {
    if (_hasComments(child)) {
      return true;
    }
  }
  return false;
}

/**
 * The authored object to put back for a journaled entry: the object itself
 * while it is still the one that was detached, or, once the journal has been
 * through the plain-JSON project file, the same object rebuilt from its
 * comment-preserving text.
 */
function _journaledValue(edit: IAuthoredEdit): any {
  if (edit.text !== undefined && !_hasComments(edit.value)) {
    try {
      return parseJsonWithComments(edit.text, false);
    } catch (e) {
      return edit.value;
    }
  }
  return edit.value;
}

/**
 * Put back what removing `traitId` deleted earlier, where the slot is still
 * free. Entries whose slot is taken (or whose group is gone) stay in the
 * journal and are reported as unrestored, so a later round trip can still
 * bring them back.
 */
function _restoreRemoved(
  et: EntityTypeDefinition,
  traitId: EntityTraitId,
  journal: IEntityTraitJournal,
  report: IEntityTraitChangeReport
): void {
  const edits = journal.removedByTrait[traitId];
  if (!edits) return;

  const bp = et._data!;
  const unrestored: IAuthoredEdit[] = [];
  const canonicalGroups = Object.keys(_getTraitData(traitId)?.componentGroups || {});
  // How many occurrences of each event reference this pass has put back so
  // far, so one the creator re-added by hand meanwhile can be told apart.
  const occurrencesBack = new Map<string, number>();

  for (const edit of edits) {
    if (_restoreEdit(et, bp, edit, canonicalGroups, occurrencesBack)) {
      if (edit.traitOwn) {
        // Back in place (at the branch it was actually found at, which may
        // have moved), and the trait's own again: the next removal has to
        // find it on record, not take it for the creator's.
        if (edit.event && edit.action) {
          _insertedReferenceRecorder(journal, traitId, edit.event)(edit.action, edit.branch || [], edit.id);
        }
      } else {
        report.restoredAuthored.push(edit);
      }
    } else if (edit.traitOwn) {
      // The trait's own reference has no place to go back to; the trait's
      // events and spawn activation put one there again anyway.
      continue;
    } else {
      unrestored.push(edit);
      report.unrestoredAuthored.push(edit);
    }
  }

  if (unrestored.length > 0) {
    journal.removedByTrait[traitId] = unrestored;
  } else {
    delete journal.removedByTrait[traitId];
  }
}

/** Put one journaled entry back if its slot is free; false when it is not. */
function _restoreEdit(
  et: EntityTypeDefinition,
  bp: any,
  edit: IAuthoredEdit,
  canonicalGroups: string[],
  occurrencesBack: Map<string, number>
): boolean {
  switch (edit.kind) {
    case "componentGroup": {
      if (!bp.component_groups) bp.component_groups = {};
      if (edit.id in bp.component_groups) return false;
      bp.component_groups[edit.id] = _journaledValue(edit);
      return true;
    }
    case "eventGroup": {
      return _restoreEventGroupReference(bp, edit, canonicalGroups, occurrencesBack);
    }
    case "family": {
      return _restoreFamily(et, bp, edit);
    }
    default: {
      if (edit.group === undefined) {
        if (!bp.components) bp.components = {};
        if (edit.id in bp.components) return false;
        et.addComponent(edit.id, _journaledValue(edit));
        return true;
      }

      const group = bp.component_groups?.[edit.group] as Record<string, any> | undefined;
      if (!group || typeof group !== "object" || edit.id in group) return false;
      group[edit.id] = _journaledValue(edit);
      return true;
    }
  }
}

/**
 * Put one occurrence of a group name back into the event transition it was
 * scrubbed from, in the position it had and with the comments it carried.
 * The branch is the one it came from (see `_findBranchNode`); a branch that
 * is gone, replaced or no longer distinguishable cannot take it back, nor
 * can a group list the creator reordered around its slot. Nothing else in
 * the list is touched, so comments on the other entries stay as they are
 * now, not as they were. Every occurrence of the group was scrubbed, so one
 * the list names again is the creator's doing while the trait was off (or
 * an earlier entry of this pass): a creator's occurrence over and above
 * what this pass put back counts as this entry restored, where they put
 * it, rather than being listed twice. On success `edit.branch` is the
 * branch the entry actually went back to, which may differ from the one
 * recorded when the creator moved the branch.
 */
function _restoreEventGroupReference(
  bp: any,
  edit: IAuthoredEdit,
  canonicalGroups: string[],
  occurrencesBack: Map<string, number>
): boolean {
  if (!edit.event || !edit.action) return false;

  const found = _findBranchNode(bp, edit, canonicalGroups);
  if (!found) return false;
  const node = found.node;

  const existing = node[edit.action]?.component_groups;
  let list: string[] = Array.isArray(existing) ? existing : [];

  const slot = [edit.event, edit.action, (edit.branch || []).join("/"), edit.id].join("|");
  const back = occurrencesBack.get(slot) || 0;
  occurrencesBack.set(slot, back + 1);
  if (list.filter((group) => group === edit.id).length > back) {
    edit.branch = found.branch;
    return true;
  }

  const position = _originalPosition(list, edit, canonicalGroups);
  if (position === undefined) return false;

  if (!node[edit.action] || typeof node[edit.action] !== "object") node[edit.action] = {};
  if (edit.comments && !(list instanceof CommentArrayClass)) {
    // Comments ride on the array as index-keyed metadata; a comment-json
    // array is what keeps them aligned through later edits.
    list = CommentArrayClass.from(list) as unknown as string[];
  }
  node[edit.action].component_groups = list;

  // In place: a comment-json array shifts the other entries' comments along.
  list.splice(position, 0, edit.id);
  if (edit.comments) {
    _putElementComments(list, position, edit.comments);
  }
  edit.branch = found.branch;
  return true;
}

/**
 * Where in a transition's group list a journaled occurrence goes back. Later
 * groups override earlier ones, so the slot is behavior: it is right before
 * the first of the groups that followed it, failing that right after the
 * last of the groups that preceded it, of the ones still in the list, each
 * occurrence matched in turn so a name that appears twice anchors twice.
 * The trait's own groups after the slot are not back yet and are not
 * looked for; those before it are. Undefined when the creator has since
 * reordered the groups around the slot, so there is no such place any more.
 * With no record of the list it is the recorded index, capped to the list.
 */
function _originalPosition(list: string[], edit: IAuthoredEdit, canonicalGroups: string[]): number | undefined {
  const index = edit.index === undefined ? list.length : edit.index;
  const siblings = edit.siblings;
  if (!siblings) {
    return Math.min(index, list.length);
  }

  const before = siblings.slice(0, index);
  const after = siblings.slice(index + 1).filter((group) => !canonicalGroups.includes(group));

  let lastBefore = -1;
  let from = 0;
  for (const group of before) {
    const found = list.indexOf(group, from);
    if (found >= 0) {
      lastBefore = found;
      from = found + 1;
    }
  }

  let firstAfter = list.length;
  let upTo = list.length - 1;
  for (let i = after.length - 1; i >= 0 && upTo >= 0; i--) {
    const found = list.lastIndexOf(after[i], upTo);
    if (found >= 0) {
      firstAfter = found;
      upTo = found - 1;
    }
  }

  if (lastBefore >= firstAfter) return undefined;
  if (firstAfter < list.length) return firstAfter;
  if (lastBefore >= 0) return lastBefore + 1;
  return Math.min(index, list.length);
}

const ELEMENT_COMMENT_KINDS = ["before", "after-prop", "after-colon", "after-value", "after"];

/**
 * The comments comment-json keeps on one element of a list, copied out so
 * they can travel in the journal and taken off the list: the element is
 * about to be spliced out, and comment-json leaves the comments of a
 * removed element behind, where they would land on whatever moves into
 * its place.
 */
function _takeElementComments(list: unknown[], index: number): { [kind: string]: IJournaledComment[] } | undefined {
  let comments: { [kind: string]: IJournaledComment[] } | undefined;

  for (const kind of ELEMENT_COMMENT_KINDS) {
    const key = Symbol.for(kind + ":" + index);
    const tokens = (list as any)[key];
    if (Array.isArray(tokens) && tokens.length > 0) {
      comments = comments || {};
      comments[kind] = tokens.map((token: IJournaledComment) => ({
        type: token.type,
        value: token.value,
        inline: token.inline,
      }));
    }
    delete (list as any)[key];
  }

  return comments;
}

function _putElementComments(list: unknown[], index: number, comments: { [kind: string]: IJournaledComment[] }): void {
  for (const [kind, tokens] of Object.entries(comments)) {
    (list as any)[Symbol.for(kind + ":" + index)] = tokens.map((token) => ({ ...token }));
  }
}

/**
 * The node a journaled event entry came from, or undefined when it is gone.
 * Every node down the branch path has to still be the one the entry left
 * (same filters, weight, trigger and so on, see `_nodeIdentity`); a branch
 * the creator moved is found by that identity elsewhere in the same list.
 * Siblings that share an identity (two outcomes of the same weight) are
 * told apart by everything else they hold once this trait's groups are out
 * of them (`_nodeContext`); when even that does not single one out, the
 * entry is not put on a guess. A node that had a lookalike sibling when the
 * entry left (`branchShared`) is only ever accepted on its context, even
 * when it is the one lookalike left: with the other one deleted, the
 * survivor is just as likely the wrong outcome. A branch the creator
 * deleted or replaced by another condition at the same index is not
 * mistaken for it. The event itself is recreated when scrubbing emptied it
 * away. Entries journaled before identities were recorded are followed by
 * index alone. Returns the node with the branch path it was found at.
 */
function _findBranchNode(
  bp: any,
  edit: IAuthoredEdit,
  canonicalGroups: string[]
): { node: any; branch: (string | number)[] } | undefined {
  if (!edit.event) return undefined;

  if (!bp.events) bp.events = {};
  const branch = edit.branch || [];
  const identity = edit.branchIdentity;
  if (!bp.events[edit.event]) {
    if (branch.length > 0) return undefined;
    bp.events[edit.event] = {};
  }

  let node: any = bp.events[edit.event];
  if (identity && identity.length > 0 && _nodeIdentity(node) !== identity[0]) return undefined;
  const actual: (string | number)[] = [];

  for (let i = 0; i + 1 < branch.length; i += 2) {
    const list = node?.[branch[i]];
    if (!Array.isArray(list)) return undefined;

    const step = i / 2 + 1;
    const expected = identity?.[step];
    let next: any;

    if (expected === undefined) {
      next = list[branch[i + 1] as number];
    } else {
      const lookalikes = list.filter((n: any) => n && typeof n === "object" && _nodeIdentity(n) === expected);
      const context = edit.branchContext?.[step];
      const shared = edit.branchShared?.[step] === true;

      if (lookalikes.length === 1 && !(shared && context !== undefined)) {
        next = lookalikes[0];
      } else if (context === undefined) {
        const atIndex = list[branch[i + 1] as number];
        next = lookalikes.includes(atIndex) ? atIndex : undefined;
      } else {
        const matching = lookalikes.filter((n: any) => _nodeContext(n, canonicalGroups) === context);
        next = matching.length === 1 ? matching[0] : undefined;
      }
    }

    if (!next || typeof next !== "object") return undefined;
    actual.push(branch[i], list.indexOf(next));
    node = next;
  }

  return { node, branch: actual };
}

/**
 * What tells a node in an event's branch tree from its siblings: everything
 * it carries besides its transitions and sub-branches (its filters, weight,
 * trigger, commands), as text that does not depend on key order.
 */
function _nodeIdentity(node: any): string {
  const own: Record<string, unknown> = {};
  for (const key of Object.keys(node || {})) {
    if (key === "add" || key === "remove" || key === "randomize" || key === "sequence") continue;
    own[key] = node[key];
  }
  return _stableJson(own);
}

/**
 * Everything a node holds, transitions and sub-branches included, once the
 * given groups are out of it, as text that does not depend on key order or
 * comments. Recorded for each node on an entry's branch path after the
 * trait's removal; the same groups are taken out of a candidate node at
 * restore time, so entries of this trait already put back do not get in
 * the way of the comparison.
 */
function _nodeContext(node: any, groups: string[]): string {
  return _stableJson(_withoutGroups(_clone(node), groups));
}

/** A plain copy of a branch node with every reference to the given groups taken out, the way scrubbing takes them out. */
function _withoutGroups(node: any, groups: string[]): any {
  if (!node || typeof node !== "object") return node;

  for (const action of ["add", "remove"] as const) {
    const transition = node[action];
    if (!transition || typeof transition !== "object") continue;

    if (Array.isArray(transition.component_groups)) {
      transition.component_groups = transition.component_groups.filter(
        (group: unknown) => !groups.includes(group as string)
      );
      if (transition.component_groups.length === 0) {
        delete transition.component_groups;
      }
    }
    if (Object.keys(transition).length === 0) {
      delete node[action];
    }
  }

  for (const key of ["randomize", "sequence"]) {
    if (Array.isArray(node[key])) {
      node[key] = node[key].map((child: any) => _withoutGroups(child, groups));
    }
  }

  return node;
}

/** `_nodeContext` of every node down a branch path, the event itself first. */
function _branchContext(event: any, branch: (string | number)[], groups: string[]): string[] {
  const contexts: string[] = [];
  let node: any = event;

  for (let i = 0; node && typeof node === "object"; i += 2) {
    contexts.push(_nodeContext(node, groups));
    if (i + 1 >= branch.length) break;
    const list = node[branch[i]];
    node = Array.isArray(list) ? list[branch[i + 1] as number] : undefined;
  }

  return contexts;
}

function _stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(_stableJson).join(",") + "]";
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort()
        .map((key) => JSON.stringify(key) + ":" + _stableJson(record[key]))
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value) ?? "null";
}

/**
 * Make the groups named by a trait's spawn event part of the entity's spawn
 * (and birth) transitions, in every branch, so the trait's group-hosted
 * behavior is live on every spawn outcome. A branch that already names a
 * group keeps it where it is; its siblings still get it, a mob's own
 * reference on one random outcome is not activation on the others. A
 * branch that already enters any of the trait's states (`stateGroups`, the
 * trait's component groups: a spawn outcome the creator set up to start out
 * angry) is activated as it stands and is not also made calm, since a later
 * group would override the state the creator chose.
 */
function _activateSpawnGroups(
  et: EntityTypeDefinition,
  spawnEvent: any,
  stateGroups: string[],
  journal: IEntityTraitJournal,
  traitId: EntityTraitId
): void {
  const groups: string[] = spawnEvent?.add?.component_groups || [];
  if (groups.length === 0) return;

  const bp = et._data!;
  if (!bp.events) bp.events = {} as any;

  if (!bp.events[SPAWN_EVENT]) {
    bp.events[SPAWN_EVENT] = _clone(spawnEvent);
    _forEachGroupReference(bp.events[SPAWN_EVENT], [], _insertedReferenceRecorder(journal, traitId, SPAWN_EVENT));
  } else {
    _addGroupsToEventBranches(
      bp.events[SPAWN_EVENT],
      groups,
      "add",
      [],
      _insertedReferenceRecorder(journal, traitId, SPAWN_EVENT),
      stateGroups
    );
  }

  if (bp.events[BORN_EVENT]) {
    _addGroupsToEventBranches(
      bp.events[BORN_EVENT],
      groups,
      "add",
      [],
      _insertedReferenceRecorder(journal, traitId, BORN_EVENT),
      stateGroups
    );
  }
}

/**
 * The group references of the mob's own that an earlier removal of
 * `traitId` scrubbed from `eventName` and that are still waiting to go
 * back, as `action|group` keys. By the time the trait's own events are
 * merged in, `_restoreRemoved` has run, so whatever is still journaled
 * under the trait for that event could not be restored.
 */
function _pendingEventReferences(journal: IEntityTraitJournal, traitId: EntityTraitId, eventName: string): Set<string> {
  const pending = new Set<string>();
  for (const edit of journal.removedByTrait[traitId] || []) {
    if (edit.kind === "eventGroup" && edit.event === eventName && edit.action) {
      pending.add(edit.action + "|" + edit.id);
    }
  }
  return pending;
}

/**
 * Add a trait event's group transitions to an event the mob already has.
 * Trait events only ever add and remove component groups, so that is all
 * that is merged; the mob's own transitions are untouched. `pending` names
 * the mob's own references into this event that are waiting to be put
 * back; those count as the mob's wiring too.
 */
function _mergeEventGroupTransitions(
  existing: any,
  traitEvent: any,
  onInserted: EventGroupReferenceVisitor,
  pending?: Set<string>
): void {
  for (const action of ["add", "remove"] as const) {
    const groups: string[] = traitEvent?.[action]?.component_groups || [];
    if (groups.length > 0) {
      _addGroupsToEvent(existing, groups, action, onInserted, pending);
    }
  }
}

/**
 * Name groups on one side of an event the mob already has, in every branch,
 * for a trait's own event merged into a same-named one of the mob's. A
 * group the event already names on that side, in any branch, is the mob's
 * own wiring (a `minecraft:on_hurt` that goes angry under its own
 * conditions) and is left exactly where the mob put it; so is one the mob
 * named in a branch that is gone, whose reference is still journaled
 * (`pending`, as `action|group`). Each reference this inserts is reported
 * with its place so it can be told apart later.
 */
function _addGroupsToEvent(
  event: any,
  groups: string[],
  action: "add" | "remove",
  onInserted: EventGroupReferenceVisitor,
  pending?: Set<string>
): void {
  const missing = groups.filter(
    (group) => !_eventReferencesGroup(event, action, group) && !pending?.has(action + "|" + group)
  );
  if (missing.length > 0) {
    _addGroupsToEventBranches(event, missing, action, [], onInserted);
  }
}

/**
 * Name groups on one side of every branch under a node. A node whose own
 * transition already names one of `settled` is left alone, sub-branches
 * included: everything that spawns through it is already in one of those
 * states, and what a parent adds applies to every outcome under it. The
 * steps of a `sequence` all run, in order, on the same spawn, so a step
 * after ones that enter a settled state on every path through them
 * (whether the creator put it there or this pass just did; see
 * `_settledBySteps`) is left alone as well: a default added there would
 * come later and override that state. A step that enters a settled state
 * only under its `filters` settles only the spawns those let through; a
 * default in the step after it would override the state on exactly those
 * spawns, so the default gets a step of its own instead, put in right
 * before the first step that would otherwise get it, that runs only when
 * none of those filters do (`_guardStep`). The steps from there on are
 * then settled on every path. Random outcomes are alternatives and each
 * gets its own.
 */
function _addGroupsToEventBranches(
  node: any,
  groups: string[],
  action: "add" | "remove",
  branch: (string | number)[],
  onInserted: EventGroupReferenceVisitor,
  settled?: string[]
): void {
  if (!node || typeof node !== "object") return;

  const own = node[action]?.component_groups;
  if (settled && Array.isArray(own) && own.some((group: unknown) => settled.includes(group as string))) return;

  let branched = false;
  for (const key of ["randomize", "sequence"]) {
    const steps: any[] = node[key];
    if (!Array.isArray(steps)) continue;
    branched = true;

    // Once a guard of this pass is in, every step after it runs on spawns
    // that are settled: the filtered steps settled theirs, and the guard
    // settled the rest. That is known by construction, not by looking at
    // the steps again, so the walk cannot keep putting guards in front of
    // the same step.
    let guarded = false;
    for (let index = 0; index < steps.length && !guarded; index++) {
      if (settled && key === "sequence") {
        const before = _settledBySteps(steps, index, action, settled);
        if (before.everyPath) continue;
        if (before.conditional.length > 0 && !_settlesEveryPath(steps[index], action, settled)) {
          // This step would get the default on spawns the filtered steps
          // before it have already put in a state. In place, so a
          // comment-json list keeps the comments on the creator's steps
          // aligned with them.
          const guard = _guardStep(before.conditional);
          steps.splice(index, 0, guard);
          _addGroupsToEventBranches(guard, groups, action, [...branch, key, index], onInserted, settled);
          guarded = true;
          continue;
        }
      }
      _addGroupsToEventBranches(steps[index], groups, action, [...branch, key, index], onInserted, settled);
    }
  }

  // A node that only fans out to branches contributes nothing itself; the
  // groups belong on each branch so every spawn outcome gets them.
  if (branched && !node[action]) return;

  if (!node[action] || typeof node[action] !== "object") node[action] = {};
  if (!Array.isArray(node[action].component_groups)) node[action].component_groups = [];
  for (const group of groups) {
    if (!node[action].component_groups.includes(group)) {
      node[action].component_groups.push(group);
      onInserted(action, branch, group);
    }
  }
}

/**
 * Whether every path through a node enters one of `states` on the given
 * side of a transition, taking the node's own `filters` as given: its own
 * transition names one, or every one of its random outcomes does, or its
 * sequence does by the time it is through (`_settledBySteps`).
 */
function _settlesEveryPath(node: any, action: "add" | "remove", states: string[]): boolean {
  if (!node || typeof node !== "object") return false;

  const own = node[action]?.component_groups;
  if (Array.isArray(own) && own.some((group: unknown) => states.includes(group as string))) return true;

  const outcomes: any[] = node.randomize;
  if (Array.isArray(outcomes) && outcomes.length > 0) {
    if (outcomes.every((outcome: any) => _settlesEveryPath(outcome, action, states))) return true;
  }

  const steps: any[] = node.sequence;
  if (Array.isArray(steps) && _settledBySteps(steps, steps.length, action, states).everyPath) return true;

  return false;
}

/**
 * How far the first `upTo` steps of a sequence go towards entering one of
 * `states` on every spawn that runs them. A step without `filters` that
 * settles every path through it settles everything after it. Steps with
 * `filters` that settle every path through them settle only the spawns
 * their filters let through; those filters are returned as `conditional`
 * so the default can be put where those spawns are not. Together they
 * still settle every path when one of them is a `none_of` of the others
 * (the creator's own complement, or a `_guardStep` put in earlier): a
 * spawn either passes one of those filters or passes the `none_of`. Both
 * sides are compared in the same form (`_filterGroup`), so a step whose
 * filter is a bare list of tests is matched by the `all_of` the guard
 * wrapped it in.
 */
function _settledBySteps(
  steps: any[],
  upTo: number,
  action: "add" | "remove",
  states: string[]
): { everyPath: boolean; conditional: unknown[] } {
  const conditional: unknown[] = [];

  for (const step of steps.slice(0, upTo)) {
    if (!step || typeof step !== "object" || !_settlesEveryPath(step, action, states)) continue;
    if (step.filters === undefined) return { everyPath: true, conditional };
    conditional.push(step.filters);
  }

  const keys = conditional.map((filters) => _stableJson(_filterGroup(filters)));
  const everyPath = conditional.some((filters, i) => {
    const complementOf = _noneOfList(filters);
    if (!complementOf || complementOf.length === 0) return false;
    const others = keys.filter((_key, j) => j !== i);
    return complementOf.every((member) => others.includes(_stableJson(_filterGroup(member))));
  });

  return { everyPath, conditional };
}

/** The filters a `{ none_of: [...] }` filter group negates, or undefined for any other filter. */
function _noneOfList(filters: unknown): unknown[] | undefined {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) return undefined;
  const keys = Object.keys(filters);
  const list = (filters as Record<string, unknown>).none_of;
  return keys.length === 1 && Array.isArray(list) ? list : undefined;
}

/**
 * A filter in the one form a filter group takes: a filter written as a bare
 * list of tests means all of them (vanilla's `damage_sensor` filters are
 * written that way), and is wrapped as `all_of` so a `none_of` member can
 * hold it and so two spellings of the same filter compare equal.
 */
function _filterGroup(filter: unknown): unknown {
  return Array.isArray(filter) ? { all_of: filter } : filter;
}

/**
 * A sequence step of the trait's own that runs only when none of the given
 * filters do: where a default goes when the steps before it enter a settled
 * state only under those filters. It holds nothing but the filters until
 * the default is put in it (plain copies: the trait's step carries no
 * comments of the creator's), and once the default is scrubbed out of it
 * again it is spent and goes too (`_isSpentGuardStep`).
 */
function _guardStep(filters: unknown[]): any {
  return {
    filters: { none_of: filters.map((filter) => _clone(_filterGroup(filter))) },
  };
}

/** Whether a sequence step is a `_guardStep` with nothing left in it but its filters (and no comments). */
function _isSpentGuardStep(step: any): boolean {
  if (!step || typeof step !== "object" || _hasComments(step)) return false;
  const keys = Object.keys(step);
  return keys.length === 1 && keys[0] === "filters" && _noneOfList(step.filters) !== undefined;
}

/** Visit every component-group reference in an event's branch tree, each with its place. */
function _forEachGroupReference(node: any, branch: (string | number)[], visit: EventGroupReferenceVisitor): void {
  if (!node || typeof node !== "object") return;

  for (const action of ["add", "remove"] as const) {
    const groups = node[action]?.component_groups;
    if (Array.isArray(groups)) {
      for (const group of groups) {
        if (typeof group === "string") {
          visit(action, branch, group);
        }
      }
    }
  }

  for (const key of ["randomize", "sequence"]) {
    if (Array.isArray(node[key])) {
      node[key].forEach((child: any, index: number) => {
        _forEachGroupReference(child, [...branch, key, index], visit);
      });
    }
  }
}

function _eventReferencesGroup(event: any, action: "add" | "remove", group: string): boolean {
  let found = false;
  _forEachGroupReference(event, [], (a, _branch, g) => {
    if (a === action && g === group) {
      found = true;
    }
  });
  return found;
}

/** A visitor that journals each reference it is handed as inserted by `traitId` into `eventName`. */
function _insertedReferenceRecorder(
  journal: IEntityTraitJournal,
  traitId: EntityTraitId,
  eventName: string
): EventGroupReferenceVisitor {
  return (action, branch, group) => {
    const reference: IEventGroupReference = { event: eventName, action, branch, id: group };
    const references = journal.eventGroupsAddedByTrait[traitId] || [];
    if (!references.some((r) => _sameReference(r, reference))) {
      references.push(reference);
    }
    journal.eventGroupsAddedByTrait[traitId] = references;
  };
}

function _sameReference(a: IEventGroupReference, b: IEventGroupReference): boolean {
  return a.event === b.event && a.action === b.action && a.id === b.id && _sameValue(a.branch || [], b.branch || []);
}

/**
 * Drop references to a removed trait's groups from every event, so no
 * transition points at a group that no longer exists. A reference still at
 * a place the journal says this trait inserted it goes quietly; every other
 * one is the mob's own transition, whatever its names, and is journaled
 * with its position in the group list and its place in the event's branch
 * tree so re-selecting the trait wires it up again there. A transition the
 * creator commented is journaled whole, comments included, before it is
 * touched, and is never deleted, not even emptied. Group lists are edited
 * in place so a comment-json array keeps its comments aligned.
 */
function _removeGroupReferencesFromEvents(
  et: EntityTypeDefinition,
  traitId: EntityTraitId,
  groupNames: string[],
  journal: IEntityTraitJournal,
  report: IEntityTraitChangeReport
): void {
  const bp = et._data!;
  if (!bp.events) return;

  const inserted = journal.eventGroupsAddedByTrait[traitId] || [];

  for (const [name, event] of Object.entries(bp.events)) {
    const taken: IAuthoredEdit[] = [];
    _scrubNode(name, event, [], [], [false], taken);

    // Only once the whole event is scrubbed does each branch look the way
    // it will when the entry comes back, so that is when its context is
    // recorded (see `_nodeContext`).
    for (const edit of taken) {
      edit.branchContext = _branchContext(event, edit.branch || [], groupNames);
      _journalRemoval(journal, traitId, edit, undefined, report);
    }

    if (event && typeof event === "object" && Object.keys(event).length === 0 && !_hasComments(event)) {
      delete bp.events[name];
    }
  }

  function _scrubNode(
    eventName: string,
    node: any,
    branch: (string | number)[],
    parents: string[],
    branchShared: boolean[],
    taken: IAuthoredEdit[]
  ): void {
    if (!node || typeof node !== "object") return;
    const branchIdentity = [...parents, _nodeIdentity(node)];

    for (const action of ["add", "remove"] as const) {
      const transition = node[action];
      if (!transition || typeof transition !== "object" || !Array.isArray(transition.component_groups)) continue;

      const list: string[] = transition.component_groups;
      const doomed = list.map((group, index) => (groupNames.includes(group) ? index : -1)).filter((i) => i >= 0);
      if (doomed.length === 0) continue;

      // Every occurrence is journaled with its position and its own comments
      // (a comment-json array drops those with the element). One the trait
      // inserted itself goes back the same way but is not the creator's
      // content, unless they commented it, which makes it theirs.
      const siblings = [...list];
      for (const index of doomed) {
        const group = list[index];
        const comments = _takeElementComments(list, index);
        const traitOwn =
          comments === undefined &&
          inserted.some((r) => _sameReference(r, { event: eventName, action, branch, id: group }));
        taken.push({
          kind: "eventGroup",
          id: group,
          event: eventName,
          action,
          branch,
          branchIdentity,
          branchShared,
          index,
          siblings,
          comments,
          traitOwn: traitOwn || undefined,
        });
      }

      for (let i = doomed.length - 1; i >= 0; i--) {
        list.splice(doomed[i], 1);
      }

      if (list.length === 0 && !_hasComments(transition)) {
        delete transition.component_groups;
        if (Object.keys(transition).length === 0) {
          delete node[action];
        }
      }
    }

    for (const key of ["randomize", "sequence"]) {
      const children: any[] = node[key];
      if (!Array.isArray(children)) continue;

      for (let index = 0; index < children.length; index++) {
        const child = children[index];
        // A child that looks like a sibling is only ever found again by its
        // context (see `IAuthoredEdit.branchShared`).
        const identities = children.map((c: any) => (c && typeof c === "object" ? _nodeIdentity(c) : undefined));
        const shared = identities.filter((id: string | undefined) => id === identities[index]).length > 1;

        const takenBefore = taken.length;
        _scrubNode(eventName, child, [...branch, key, index], branchIdentity, [...branchShared, shared], taken);

        // A step the trait put in only to carry its default past a filtered
        // step of the creator's (`_guardStep`) is spent once that default is
        // out of it: the step goes, and so does the record of what it held,
        // since the trait's activation makes it afresh. One the creator
        // commented, or that carries anything of theirs, is not spent.
        const fromChild = taken.slice(takenBefore);
        if (
          key === "sequence" &&
          fromChild.length > 0 &&
          fromChild.every((edit) => edit.traitOwn) &&
          _isSpentGuardStep(child)
        ) {
          taken.splice(takenBefore);
          children.splice(index, 1);
          index--;
        }
      }
    }
  }
}

function _getFamilyList(component: unknown): string[] | undefined {
  if (!component || typeof component !== "object") return undefined;
  const family = (component as Record<string, unknown>).family;
  return Array.isArray(family) ? (family as string[]) : undefined;
}

/**
 * Add families to the entity's top-level `minecraft:type_family`, creating the
 * component when the mob has none. Existing families are kept. Returns the
 * families that were actually inserted.
 */
function _addFamilies(et: EntityTypeDefinition, families: string[]): string[] {
  const bp = et._data!;
  if (!bp.components) bp.components = {} as any;

  const existing = _getFamilyList(bp.components[TYPE_FAMILY_COMPONENT]);
  if (!existing) {
    et.addComponent(TYPE_FAMILY_COMPONENT, { family: [...families] } as any);
    return [...families];
  }

  const inserted: string[] = [];
  for (const family of families) {
    if (!existing.some((f) => typeof f === "string" && f.toLowerCase() === family.toLowerCase())) {
      existing.push(family);
      inserted.push(family);
    }
  }
  return inserted;
}

/**
 * Remove the families `traitId` introduced from the entity's top-level
 * `minecraft:type_family`, the only place `_addFamilies` ever inserts them.
 * Family lists inside component groups are the mob's own and are left alone
 * even when they name one of these families. The comments on each
 * membership taken out come off the list first: a comment-json list leaves
 * a removed element's comments behind, where they would land on whatever
 * moves into its place or be lost with it. A membership the creator has
 * commented since the trait introduced it is theirs: it still goes (the
 * trait is being deselected), but journaled with its position and its
 * comment, and reported, so re-selecting the trait brings it back as it
 * was. A family list left empty takes its component with it, unless the
 * creator commented the list or its component: that is theirs and stays,
 * empty.
 */
function _removeFamilies(
  et: EntityTypeDefinition,
  families: string[],
  traitId: EntityTraitId,
  journal: IEntityTraitJournal,
  report: IEntityTraitChangeReport
): void {
  const bp = et._data!;
  if (!bp.components) return;

  const container = bp.components[TYPE_FAMILY_COMPONENT];
  const current = _getFamilyList(container);
  if (!current) return;

  const dropped = new Set(families.map((f) => f.toLowerCase()));
  const doomed = current
    .map((family, index) => (typeof family === "string" && dropped.has(family.toLowerCase()) ? index : -1))
    .filter((index) => index >= 0);
  if (doomed.length === 0) return;

  const siblings = [...current];
  for (const index of doomed) {
    const comments = _takeElementComments(current, index);
    if (comments) {
      _journalRemoval(
        journal,
        traitId,
        { kind: "family", id: current[index], index, siblings, comments },
        undefined,
        report
      );
    }
  }

  // One at a time, from the back and in place, so a comment-json list keeps
  // the comments on the families that stay aligned with them.
  for (let i = doomed.length - 1; i >= 0; i--) {
    current.splice(doomed[i], 1);
  }

  if (current.length === 0 && !_hasComments(container)) {
    et.removeComponent(TYPE_FAMILY_COMPONENT);
  }
}

/**
 * With no record of which families a trait introduced, take out of every
 * `minecraft:type_family` (top level and component groups) each family that
 * on its own keeps the trait detected, so the deselection sticks. Each one is
 * journaled as the mob's own and reported, with its position in the list
 * and the comments that sat on it, so re-selecting the trait puts it back
 * where it was, as it was. A list or component the creator commented is
 * emptied rather than deleted, so the comment stays. Families the trait
 * ships but the detector does not key on (Undead's "monster") are left to
 * whoever put them there.
 */
function _removeDetectableFamilies(
  et: EntityTypeDefinition,
  traitId: EntityTraitId,
  journal: IEntityTraitJournal,
  report: IEntityTraitChangeReport
): void {
  const bp = et._data!;
  const holders: [string | undefined, Record<string, any>][] = [];
  if (bp.components) holders.push([undefined, bp.components]);
  for (const [name, group] of Object.entries(bp.component_groups || {})) {
    if (group && typeof group === "object") holders.push([name, group as Record<string, any>]);
  }

  for (const [groupName, holder] of holders) {
    const container = holder[TYPE_FAMILY_COMPONENT];
    const current = _getFamilyList(container);
    if (!current) continue;

    const doomed = current
      .map((family, index) =>
        typeof family === "string" && TraitDetector.entityTraitDetectedFromFamily(traitId, family) ? index : -1
      )
      .filter((index) => index >= 0);
    if (doomed.length === 0) continue;

    // Each membership goes into the journal with its position and its own
    // comments (a comment-json list drops those with the element) before
    // the list is edited in place, one element at a time, so the comments
    // on the families that stay keep their place.
    const siblings = [...current];
    for (const index of doomed) {
      _journalRemoval(
        journal,
        traitId,
        {
          kind: "family",
          group: groupName,
          id: current[index],
          index,
          siblings,
          comments: _takeElementComments(current, index),
        },
        undefined,
        report
      );
    }
    for (let i = doomed.length - 1; i >= 0; i--) {
      current.splice(doomed[i], 1);
    }

    // A list the creator commented, or whose component they commented, is
    // theirs to keep: it is emptied, not deleted, the way a commented
    // event is kept.
    if (current.length > 0 || _hasComments(container)) continue;

    if (groupName === undefined) {
      et.removeComponent(TYPE_FAMILY_COMPONENT);
    } else {
      delete holder[TYPE_FAMILY_COMPONENT];
    }
  }
}

/**
 * Put a family membership back into the holder it was taken from, in the
 * position it had and with the comments that sat on it; false when that
 * holder is gone. The component is made again when its removal took it
 * away. A family the creator has since given the mob again by hand is
 * theirs, where they put it, and counts as this entry restored.
 */
function _restoreFamily(et: EntityTypeDefinition, bp: any, edit: IAuthoredEdit): boolean {
  let holder: Record<string, any> | undefined;
  if (edit.group === undefined) {
    if (!bp.components) bp.components = {};
    holder = bp.components;
  } else {
    holder = bp.component_groups?.[edit.group];
    if (!holder || typeof holder !== "object") return false;
  }

  let current = _getFamilyList(holder![TYPE_FAMILY_COMPONENT]);
  if (!current) {
    current = [];
    const component = { family: current };
    if (edit.group === undefined) {
      et.addComponent(TYPE_FAMILY_COMPONENT, component as any);
    } else {
      holder![TYPE_FAMILY_COMPONENT] = component;
    }
  }

  if (current.includes(edit.id)) return true;

  const position = _originalPosition(current, edit, []) ?? Math.min(edit.index ?? current.length, current.length);
  if (edit.comments && !(current instanceof CommentArrayClass)) {
    // Comments ride on the array as index-keyed metadata; a comment-json
    // array is what keeps them aligned through later edits.
    current = CommentArrayClass.from(current) as unknown as string[];
    holder![TYPE_FAMILY_COMPONENT].family = current;
  }

  // In place: a comment-json array shifts the other entries' comments along.
  current.splice(position, 0, edit.id);
  if (edit.comments) {
    _putElementComments(current, position, edit.comments);
  }
  return true;
}
