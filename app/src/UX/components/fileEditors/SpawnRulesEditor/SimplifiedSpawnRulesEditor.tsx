/**
 * SIMPLIFIED SPAWN RULES EDITOR
 * ==============================
 *
 * A biome-picker-based spawn rules editor that provides a beginner-friendly
 * interface for configuring where and how mobs spawn.
 *
 * KEY CONCEPTS:
 * - Shows categorized biome tags as a checkbox list
 * - A "Default" entry at top sets baseline herd size and spawn-on-block filter
 * - Checked biomes can be expanded to override herd/block settings per-biome
 * - Unconfigured biomes inherit from Default
 * - Custom project biomes appear in a separate category
 * - Non-biome filters (brightness, difficulty, etc.) are preserved on round-trip
 *
 * DATA FLOW:
 * - Reads from IFile (minecraft:spawn_rules.conditions[])
 * - Parses biome tags from minecraft:biome_filter (has_biome_tag tests)
 * - Writes back: one condition for default+non-overridden biomes, separate
 *   conditions for biomes with custom overrides. Preserves extra filters.
 *
 * RELATED FILES:
 * - SpawnRulesEditorWrapper.tsx — parent component with subtab switching
 * - SpawnRulesEditor.tsx — the "Advanced" SchemaEditor-based editor
 * - BiomeTagCategories.ts — shared biome tag constant
 * - ISpawnRulesBehavior.ts — TypeScript types for spawn rules JSON
 * - SimplifiedBiomeFilterEditor.tsx — similar pattern for feature rules biome filters
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./SimplifiedSpawnRulesEditor.css";
import Project from "../../../../app/Project";
import IFile from "../../../../storage/IFile";
import IPersistable from "../../../types/IPersistable";
import StorageUtilities from "../../../../storage/StorageUtilities";
import Log from "../../../../core/Log";
import BIOME_TAG_CATEGORIES, { IBiomeTagCategory } from "../../../../data/BiomeTagCategories";
import { ProjectItemType } from "../../../../app/IProjectItemData";
import {
  ISpawnRulesBiomeFilter,
  ISpawnRulesCondition,
  ISpawnRulesHerd,
} from "../../../../minecraft/ISpawnRulesBehavior";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
import { faSquare, faSquareCheck, faSquareMinus } from "@fortawesome/free-regular-svg-icons";
import { Button, ButtonBase, Chip, IconButton, Stack, TextField } from "@mui/material";
import BlockPickerDialog from "../../blockPicker/BlockPickerDialog";

type SimplifiedSpawnRulesEditorProps = {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  readOnly?: boolean;
  heightOffset?: number;
};

interface IHerdConfig {
  minSize: number;
  maxSize: number;
}

interface IBiomeOverride {
  herd?: IHerdConfig;
  spawnOnBlocks?: string[];
}

interface IParsedState {
  selectedBiomes: Set<string>;
  defaultHerd: IHerdConfig;
  defaultSpawnOnBlocks: string[];
  perBiomeOverrides: Map<string, IBiomeOverride>;
  /** Extra filters from the original default condition, preserved for round-trip */
  preservedExtraFilters: Record<string, unknown>;
  /** Extra filters per biome override condition */
  preservedBiomeExtraFilters: Map<string, Record<string, unknown>>;
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

function extractBiomeTagsFromFilter(filter: ISpawnRulesBiomeFilter | undefined): string[] {
  if (!filter) return [];

  const tags: string[] = [];

  if (filter.test === "has_biome_tag" && filter.value && filter.operator !== "!=" && filter.operator !== "not") {
    tags.push(String(filter.value));
  }

  if (filter.any_of) {
    for (const sub of filter.any_of) {
      tags.push(...extractBiomeTagsFromFilter(sub));
    }
  }
  if (filter.all_of) {
    for (const sub of filter.all_of) {
      tags.push(...extractBiomeTagsFromFilter(sub));
    }
  }

  return tags;
}

function getHerdFromCondition(condition: ISpawnRulesCondition): IHerdConfig | undefined {
  const herd = condition["minecraft:herd"];
  if (!herd) return undefined;

  const h = Array.isArray(herd) ? herd[0] : herd;
  if (!h) return undefined;

  return {
    minSize: h.min_size ?? 1,
    maxSize: h.max_size ?? 1,
  };
}

function getSpawnOnBlocksFromCondition(condition: ISpawnRulesCondition): string[] {
  const blocks = condition["minecraft:spawns_on_block_filter"];
  if (!blocks) return [];
  if (typeof blocks === "string") return [blocks];
  if (Array.isArray(blocks)) {
    return blocks.map((b) => (typeof b === "string" ? b : ((b as { name?: string }).name ?? ""))).filter(Boolean);
  }
  return [];
}

const BIOME_AND_HERD_KEYS = new Set(["minecraft:biome_filter", "minecraft:herd", "minecraft:spawns_on_block_filter"]);

function getExtraFilters(condition: ISpawnRulesCondition): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(condition)) {
    if (!BIOME_AND_HERD_KEYS.has(key)) {
      extra[key] = condition[key];
    }
  }
  return extra;
}

function herdConfigsEqual(a: IHerdConfig | undefined, b: IHerdConfig | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.minSize === b.minSize && a.maxSize === b.maxSize;
}

function blockArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function parseSpawnRulesFromFile(file: IFile): IParsedState {
  const defaultState: IParsedState = {
    selectedBiomes: new Set(),
    defaultHerd: { minSize: 1, maxSize: 1 },
    defaultSpawnOnBlocks: [],
    perBiomeOverrides: new Map(),
    preservedExtraFilters: {},
    preservedBiomeExtraFilters: new Map(),
  };

  const parsed = StorageUtilities.getJsonObject(file);
  if (!parsed) return defaultState;

  const conditions: ISpawnRulesCondition[] = parsed["minecraft:spawn_rules"]?.conditions;
  if (!conditions || !Array.isArray(conditions)) return defaultState;

  // Find the "default" condition (no biome_filter or the first one)
  let defaultCondition: ISpawnRulesCondition | undefined;
  const biomeConditions: ISpawnRulesCondition[] = [];

  for (const cond of conditions) {
    const biomeTags = extractBiomeTagsFromFilter(cond["minecraft:biome_filter"]);
    if (biomeTags.length === 0 && !defaultCondition) {
      defaultCondition = cond;
    } else {
      biomeConditions.push(cond);
    }
  }

  // If no explicit default, use the first condition and remove it from the
  // biome list so its filters aren't replayed into both default and override
  // conditions on round-trip. (`splice(0, 0)` is a no-op — we need to delete
  // the duplicated entry, not zero entries.)
  if (!defaultCondition && conditions.length > 0) {
    defaultCondition = conditions[0];
    if (biomeConditions[0] === conditions[0]) {
      biomeConditions.splice(0, 1);
    }
  }

  const defaultHerd = defaultCondition
    ? (getHerdFromCondition(defaultCondition) ?? { minSize: 1, maxSize: 1 })
    : { minSize: 1, maxSize: 1 };
  const defaultBlocks = defaultCondition ? getSpawnOnBlocksFromCondition(defaultCondition) : [];
  const preservedExtraFilters = defaultCondition ? getExtraFilters(defaultCondition) : {};

  const selectedBiomes = new Set<string>();
  const perBiomeOverrides = new Map<string, IBiomeOverride>();
  const preservedBiomeExtraFilters = new Map<string, Record<string, unknown>>();

  // Also extract biome tags from the default condition's biome_filter
  if (defaultCondition) {
    const defaultBiomeTags = extractBiomeTagsFromFilter(defaultCondition["minecraft:biome_filter"]);
    for (const tag of defaultBiomeTags) {
      selectedBiomes.add(tag);
    }
  }

  for (const cond of biomeConditions) {
    const biomeTags = extractBiomeTagsFromFilter(cond["minecraft:biome_filter"]);
    const herd = getHerdFromCondition(cond);
    const blocks = getSpawnOnBlocksFromCondition(cond);
    const extra = getExtraFilters(cond);

    for (const tag of biomeTags) {
      selectedBiomes.add(tag);

      const hasHerdOverride = herd && !herdConfigsEqual(herd, defaultHerd);
      const hasBlockOverride = blocks.length > 0 && !blockArraysEqual(blocks, defaultBlocks);

      if (hasHerdOverride || hasBlockOverride) {
        const override: IBiomeOverride = {};
        if (hasHerdOverride) override.herd = herd;
        if (hasBlockOverride) override.spawnOnBlocks = blocks;
        perBiomeOverrides.set(tag, override);
      }

      if (Object.keys(extra).length > 0) {
        preservedBiomeExtraFilters.set(tag, extra);
      }
    }
  }

  return {
    selectedBiomes,
    defaultHerd,
    defaultSpawnOnBlocks: defaultBlocks,
    perBiomeOverrides,
    preservedExtraFilters,
    preservedBiomeExtraFilters,
  };
}

// ─── Write-back helpers ─────────────────────────────────────────────────────

function buildBiomeFilter(tags: string[]): ISpawnRulesBiomeFilter {
  if (tags.length === 1) {
    return { test: "has_biome_tag", value: tags[0] };
  }
  return {
    any_of: tags.map((tag) => ({ test: "has_biome_tag", value: tag })),
  };
}

function buildHerd(config: IHerdConfig): ISpawnRulesHerd {
  return { min_size: config.minSize, max_size: config.maxSize };
}

function writeSpawnRulesToFile(file: IFile, state: IParsedState): void {
  const parsed = StorageUtilities.getJsonObject(file);
  if (!parsed) return;

  const conditions: ISpawnRulesCondition[] = [];

  // Collect biomes without overrides
  const defaultBiomes: string[] = [];
  const overrideBiomes: string[] = [];

  for (const tag of state.selectedBiomes) {
    if (state.perBiomeOverrides.has(tag)) {
      overrideBiomes.push(tag);
    } else {
      defaultBiomes.push(tag);
    }
  }

  // Build default condition
  const defaultCond: ISpawnRulesCondition = {
    ...state.preservedExtraFilters,
  };

  if (defaultBiomes.length > 0) {
    defaultCond["minecraft:biome_filter"] = buildBiomeFilter(defaultBiomes);
  }

  defaultCond["minecraft:herd"] = buildHerd(state.defaultHerd);

  if (state.defaultSpawnOnBlocks.length > 0) {
    defaultCond["minecraft:spawns_on_block_filter"] = state.defaultSpawnOnBlocks;
  }

  conditions.push(defaultCond);

  // Build per-biome override conditions
  for (const tag of overrideBiomes) {
    const override = state.perBiomeOverrides.get(tag)!;
    const cond: ISpawnRulesCondition = {};

    // Preserved extra filters for this biome
    const extra = state.preservedBiomeExtraFilters.get(tag);
    if (extra) {
      Object.assign(cond, extra);
    }

    cond["minecraft:biome_filter"] = buildBiomeFilter([tag]);
    cond["minecraft:herd"] = buildHerd(override.herd ?? state.defaultHerd);

    const blocks = override.spawnOnBlocks ?? state.defaultSpawnOnBlocks;
    if (blocks.length > 0) {
      cond["minecraft:spawns_on_block_filter"] = blocks;
    }

    conditions.push(cond);
  }

  // Defensive: the parsed file may not yet have the "minecraft:spawn_rules"
  // envelope (e.g., a freshly-created spawn rule whose stub content hasn't
  // finished being written, or a partially-typed user-edited file). Ensure
  // the envelope exists before assigning conditions, otherwise we crash with
  // "Cannot set properties of undefined (setting 'conditions')" and tear
  // down the whole editor via the global error boundary.
  let inner = parsed["minecraft:spawn_rules"];
  if (!inner || typeof inner !== "object") {
    inner = {};
    parsed["minecraft:spawn_rules"] = inner;
  }
  inner.conditions = conditions;
  file.setObjectContentIfSemanticallyDifferent(parsed);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SimplifiedSpawnRulesEditor({
  project,
  file,
  setActivePersistable,
  readOnly,
  heightOffset,
}: SimplifiedSpawnRulesEditorProps) {
  const [state, setState] = useState<IParsedState>(() => parseSpawnRulesFromFile(file));
  const [searchFilter, setSearchFilter] = useState("");
  const [expandedBiomes, setExpandedBiomes] = useState<Set<string>>(new Set(["__default__"]));
  // When non-null, the BlockPickerDialog is open for this target. targetId === "__default__"
  // means the default block list; otherwise it's a per-biome override id, with isDefault=false.
  const [pickerTarget, setPickerTarget] = useState<{ targetId: string; isDefault: boolean } | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Track the file we most recently parsed so the re-parse effect only runs
  // when the file actually changes, not on every parent re-render that
  // happens to retrigger the effect (e.g., when a callback prop is reborn
  // on each render cycle). Without this guard the editor was re-parsing on
  // every keystroke in some cases, producing a layout-shift loop where
  // Playwright's actionability check kept seeing different elements under
  // the click point — see RoundTripPersistence test failures (F6).
  const parsedFileRef = useRef<{ file: IFile | null; name: string | null }>({ file: null, name: null });
  // Mirror the latest file in a ref so the persist callback can read it
  // without needing `file` in its useEffect deps.
  const fileRef = useRef(file);
  fileRef.current = file;

  // Re-parse when file actually changes
  useEffect(() => {
    if (parsedFileRef.current.file !== file || parsedFileRef.current.name !== file.name) {
      parsedFileRef.current = { file, name: file.name };
      setState(parseSpawnRulesFromFile(file));
    }
  }, [file, file.name]);

  // Persist callback
  const onPersist = useCallback((f: IFile): Promise<boolean> => {
    try {
      writeSpawnRulesToFile(f, stateRef.current);
      return Promise.resolve(true);
    } catch (e) {
      Log.error(`Error persisting simplified spawn rules: ${e}`);
      return Promise.resolve(false);
    }
  }, []);

  // Register the active persistable. We deliberately omit `file` from the
  // deps and read it from a ref instead, so the parent doesn't see a brand
  // new persistable object on every render that happens to receive a fresh
  // IFile reference. Re-registering the persistable on every render was a
  // contributor to the layout-shift loop described above.
  useEffect(() => {
    setActivePersistable?.({ persist: () => onPersist(fileRef.current) });
  }, [onPersist, setActivePersistable]);

  // Write-through: update file on every state change
  const updateState = useCallback(
    (updater: (prev: IParsedState) => IParsedState) => {
      setState((prev) => {
        const next = updater(prev);
        writeSpawnRulesToFile(file, next);
        return next;
      });
    },
    [file]
  );

  // Custom biomes from the project
  const customBiomeCategory: IBiomeTagCategory | undefined = useMemo(() => {
    const biomeItems = project.getItemsByType(ProjectItemType.biomeBehavior);
    if (biomeItems.length === 0) return undefined;

    const tags = biomeItems
      .map((item) => {
        const name = item.name ?? "";
        const id = name.replace(/\.json$/i, "").replace(/^.*[:/]/, "");
        return id ? { id, label: id.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) } : null;
      })
      .filter(Boolean) as { id: string; label: string }[];

    return tags.length > 0 ? { name: "Custom Biomes", tags } : undefined;
  }, [project]);

  const allCategories = useMemo(() => {
    const cats = [...BIOME_TAG_CATEGORIES];
    if (customBiomeCategory) cats.push(customBiomeCategory);
    return cats;
  }, [customBiomeCategory]);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleSearchFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSearchFilter(e.target.value);
  }, []);

  const toggleBiome = useCallback(
    (tagId: string) => {
      if (readOnly) return;
      updateState((prev) => {
        const next = {
          ...prev,
          selectedBiomes: new Set(prev.selectedBiomes),
          perBiomeOverrides: new Map(prev.perBiomeOverrides),
        };
        if (next.selectedBiomes.has(tagId)) {
          next.selectedBiomes.delete(tagId);
          next.perBiomeOverrides.delete(tagId);
        } else {
          next.selectedBiomes.add(tagId);
        }
        return next;
      });
    },
    [readOnly, updateState]
  );

  const toggleCategoryAll = useCallback(
    (tagIds: string[], select: boolean) => {
      if (readOnly || tagIds.length === 0) return;
      updateState((prev) => {
        const nextSelected = new Set(prev.selectedBiomes);
        const nextOverrides = new Map(prev.perBiomeOverrides);
        if (select) {
          for (const id of tagIds) nextSelected.add(id);
        } else {
          for (const id of tagIds) {
            nextSelected.delete(id);
            nextOverrides.delete(id);
          }
        }
        return { ...prev, selectedBiomes: nextSelected, perBiomeOverrides: nextOverrides };
      });
    },
    [readOnly, updateState]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedBiomes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const setDefaultHerd = useCallback(
    (field: "minSize" | "maxSize", value: number) => {
      if (readOnly) return;
      updateState((prev) => ({
        ...prev,
        defaultHerd: { ...prev.defaultHerd, [field]: value },
      }));
    },
    [readOnly, updateState]
  );

  const setBiomeHerd = useCallback(
    (tagId: string, field: "minSize" | "maxSize", value: number) => {
      if (readOnly) return;
      updateState((prev) => {
        const overrides = new Map(prev.perBiomeOverrides);
        const existing = overrides.get(tagId) ?? {};
        const herd = existing.herd ?? { ...prev.defaultHerd };
        overrides.set(tagId, { ...existing, herd: { ...herd, [field]: value } });
        return { ...prev, perBiomeOverrides: overrides };
      });
    },
    [readOnly, updateState]
  );

  const clearBiomeOverride = useCallback(
    (tagId: string) => {
      if (readOnly) return;
      updateState((prev) => {
        const overrides = new Map(prev.perBiomeOverrides);
        overrides.delete(tagId);
        return { ...prev, perBiomeOverrides: overrides };
      });
    },
    [readOnly, updateState]
  );

  const setDefaultSpawnOnBlocks = useCallback(
    (blocks: string[]) => {
      if (readOnly) return;
      updateState((prev) => ({ ...prev, defaultSpawnOnBlocks: blocks }));
    },
    [readOnly, updateState]
  );

  const setBiomeSpawnOnBlocks = useCallback(
    (tagId: string, blocks: string[]) => {
      if (readOnly) return;
      updateState((prev) => {
        const overrides = new Map(prev.perBiomeOverrides);
        const existing = overrides.get(tagId) ?? {};
        overrides.set(tagId, { ...existing, spawnOnBlocks: blocks });
        return { ...prev, perBiomeOverrides: overrides };
      });
    },
    [readOnly, updateState]
  );

  const addBlock = useCallback(
    (targetId: string, isDefault: boolean, blockId: string) => {
      const trimmed = blockId.trim();
      if (!trimmed) return;

      if (isDefault) {
        if (!state.defaultSpawnOnBlocks.includes(trimmed)) {
          setDefaultSpawnOnBlocks([...state.defaultSpawnOnBlocks, trimmed]);
        }
      } else {
        const existing = state.perBiomeOverrides.get(targetId)?.spawnOnBlocks ?? [...state.defaultSpawnOnBlocks];
        if (!existing.includes(trimmed)) {
          setBiomeSpawnOnBlocks(targetId, [...existing, trimmed]);
        }
      }
    },
    [state, setDefaultSpawnOnBlocks, setBiomeSpawnOnBlocks]
  );

  const removeBlock = useCallback(
    (targetId: string, isDefault: boolean, block: string) => {
      if (isDefault) {
        setDefaultSpawnOnBlocks(state.defaultSpawnOnBlocks.filter((b) => b !== block));
      } else {
        const existing = state.perBiomeOverrides.get(targetId)?.spawnOnBlocks ?? [...state.defaultSpawnOnBlocks];
        setBiomeSpawnOnBlocks(
          targetId,
          existing.filter((b) => b !== block)
        );
      }
    },
    [state, setDefaultSpawnOnBlocks, setBiomeSpawnOnBlocks]
  );

  // ─── Render helpers ─────────────────────────────────────────────────

  const renderHerdConfig = (herd: IHerdConfig, onChangeMin: (v: number) => void, onChangeMax: (v: number) => void) => (
    <Stack direction="row" spacing={1} alignItems="center" className="ssre-configRow">
      <span className="ssre-configLabel">Herd Size:</span>
      <TextField
        label="Min"
        type="number"
        size="small"
        value={herd.minSize}
        onChange={(e) => onChangeMin(Math.max(0, parseInt(e.target.value) || 0))}
        disabled={readOnly}
        inputProps={{ min: 0, style: { textAlign: "center" } }}
        sx={{ width: 90 }}
      />
      <TextField
        label="Max"
        type="number"
        size="small"
        value={herd.maxSize}
        onChange={(e) => onChangeMax(Math.max(0, parseInt(e.target.value) || 0))}
        disabled={readOnly}
        inputProps={{ min: 0, style: { textAlign: "center" } }}
        sx={{ width: 90 }}
      />
    </Stack>
  );

  const renderBlockConfig = (blocks: string[], targetId: string, isDefault: boolean) => (
    <>
      <div className="ssre-configRow">
        <span className="ssre-configLabel">Spawn On Blocks:</span>
      </div>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap className="ssre-blockList">
        {blocks.map((block) => (
          <Chip
            key={block}
            label={block}
            size="small"
            onDelete={readOnly ? undefined : () => removeBlock(targetId, isDefault, block)}
            deleteIcon={<FontAwesomeIcon icon={faTimes} style={{ fontSize: 11 }} />}
          />
        ))}
      </Stack>
      {!readOnly && (
        <div className="ssre-blockAdd">
          <Button
            variant="contained"
            size="small"
            color="success"
            startIcon={<FontAwesomeIcon icon={faPlus} />}
            onClick={() => setPickerTarget({ targetId, isDefault })}
          >
            Add Block…
          </Button>
        </div>
      )}
    </>
  );

  const renderDefaultEntry = () => {
    const isExpanded = expandedBiomes.has("__default__");

    return (
      <div className="ssre-defaultEntry">
        <ButtonBase
          className="ssre-defaultHeader"
          onClick={() => toggleExpanded("__default__")}
          aria-expanded={isExpanded}
        >
          <span className={`ssre-expandIcon ${isExpanded ? "ssre-expandIconOpen" : ""}`}>
            <FontAwesomeIcon icon={faChevronDown} />
          </span>
          Default Settings
          <span style={{ fontWeight: 400, fontSize: 11, color: "#888", marginLeft: 8 }}>
            (baseline herd size &amp; block filter for all selected biomes)
          </span>
        </ButtonBase>
        {isExpanded && (
          <div className="ssre-configPanel" style={{ paddingLeft: 12 }}>
            {renderHerdConfig(
              state.defaultHerd,
              (v) => setDefaultHerd("minSize", v),
              (v) => setDefaultHerd("maxSize", v)
            )}
            {renderBlockConfig(state.defaultSpawnOnBlocks, "__default__", true)}
          </div>
        )}
      </div>
    );
  };

  const renderBiomeRow = (tagId: string, label: string) => {
    const isSelected = state.selectedBiomes.has(tagId);
    const isExpanded = expandedBiomes.has(tagId);
    const hasOverride = state.perBiomeOverrides.has(tagId);
    const override = state.perBiomeOverrides.get(tagId);

    return (
      <div key={tagId} className={`ssre-biomeRow ${isSelected ? "ssre-biomeRowSelected" : ""}`}>
        <div className="ssre-biomeHeader">
          <ButtonBase
            className={`ssre-checkbox ssre-checkboxButton ${isSelected ? "ssre-checkboxChecked" : ""}`}
            onClick={() => toggleBiome(tagId)}
            aria-pressed={isSelected}
            aria-label={`Toggle biome ${label}`}
          >
            <FontAwesomeIcon icon={isSelected ? faSquareCheck : faSquare} />
          </ButtonBase>
          <ButtonBase
            className="ssre-biomeLabel"
            onClick={() => toggleBiome(tagId)}
            aria-label={`Toggle biome ${label}`}
          >
            {label}
          </ButtonBase>
          {isSelected && (
            <IconButton
              size="small"
              className={`ssre-biomeExpand ${isExpanded ? "ssre-biomeExpandOpen" : ""}`}
              onClick={() => toggleExpanded(tagId)}
              title="Configure spawn settings for this biome"
              aria-label={`Configure ${label}`}
              aria-expanded={isExpanded}
            >
              <FontAwesomeIcon icon={faChevronDown} />
              {hasOverride && <span style={{ marginLeft: 4, fontSize: 10, color: "#6c6" }}>●</span>}
            </IconButton>
          )}
        </div>
        {isSelected && isExpanded && (
          <div className="ssre-configPanel">
            {hasOverride && (
              <div className="ssre-useDefault" onClick={() => clearBiomeOverride(tagId)}>
                <FontAwesomeIcon icon={faSquareCheck} style={{ color: "#6c6" }} />
                Using custom settings — click to reset to defaults
              </div>
            )}
            {!hasOverride && (
              <div className="ssre-useDefault" style={{ color: "#999" }}>
                <FontAwesomeIcon icon={faSquare} style={{ color: "#666" }} />
                Using default settings — edit below to customize
              </div>
            )}
            {renderHerdConfig(
              override?.herd ?? state.defaultHerd,
              (v) => setBiomeHerd(tagId, "minSize", v),
              (v) => setBiomeHerd(tagId, "maxSize", v)
            )}
            {renderBlockConfig(override?.spawnOnBlocks ?? state.defaultSpawnOnBlocks, tagId, false)}
          </div>
        )}
      </div>
    );
  };

  const searchLower = searchFilter.toLowerCase();
  const selectedCount = state.selectedBiomes.size;

  return (
    <div className="ssre-outer">
      <div className="ssre-search">
        <TextField
          fullWidth
          size="small"
          placeholder="Search biomes…"
          value={searchFilter}
          onChange={handleSearchFilterChange}
        />
      </div>

      {renderDefaultEntry()}

      {allCategories.map((category) => {
        const filteredTags = category.tags.filter(
          (tag) =>
            !searchLower || tag.label.toLowerCase().includes(searchLower) || tag.id.toLowerCase().includes(searchLower)
        );

        if (filteredTags.length === 0) return null;

        const filteredIds = filteredTags.map((t) => t.id);
        const selectedInCategory = filteredIds.filter((id) => state.selectedBiomes.has(id)).length;
        const allSelected = selectedInCategory === filteredIds.length;
        const someSelected = selectedInCategory > 0 && !allSelected;
        const categoryIcon = allSelected ? faSquareCheck : someSelected ? faSquareMinus : faSquare;

        return (
          <div key={category.name} className="ssre-category">
            <ButtonBase
              className={`ssre-categoryName ssre-categoryNameToggle${readOnly ? " ssre-categoryNameDisabled" : ""}`}
              onClick={() => toggleCategoryAll(filteredIds, !allSelected)}
              disabled={readOnly}
              aria-pressed={allSelected}
              aria-label={`Toggle all ${category.name} biomes`}
              title={allSelected ? `Uncheck all ${category.name}` : `Check all ${category.name}`}
            >
              <span className={`ssre-checkbox ${allSelected || someSelected ? "ssre-checkboxChecked" : ""}`}>
                <FontAwesomeIcon icon={categoryIcon} />
              </span>
              <span className="ssre-categoryNameLabel">{category.name}</span>
            </ButtonBase>
            <div className="ssre-tagList">{filteredTags.map((tag) => renderBiomeRow(tag.id, tag.label))}</div>
          </div>
        );
      })}

      <div className="ssre-summary">
        {selectedCount} biome{selectedCount !== 1 ? " tags" : " tag"} selected
        {state.perBiomeOverrides.size > 0 && ` · ${state.perBiomeOverrides.size} with custom settings`}
      </div>
      {pickerTarget && (
        <BlockPickerDialog
          open={true}
          onClose={() => setPickerTarget(null)}
          onSelect={(blockId) => {
            if (pickerTarget) {
              addBlock(pickerTarget.targetId, pickerTarget.isDefault, blockId);
            }
          }}
          project={project}
          excludeIds={
            pickerTarget.isDefault
              ? state.defaultSpawnOnBlocks
              : (state.perBiomeOverrides.get(pickerTarget.targetId)?.spawnOnBlocks ?? state.defaultSpawnOnBlocks)
          }
          title="Choose a Spawn-On Block"
        />
      )}
    </div>
  );
}
