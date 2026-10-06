// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * DiagnosticsSchemaUtilities
 *
 * Platform-neutral helpers for the protocol v10 diagnostics schema (SchemaEvent).
 * Converts raw wire descriptors into typed UI models, validates malformed
 * descriptors without throwing, gates controls by negotiated capabilities, and
 * derives the DebugStatsPanel display state from session facts.
 *
 * This module is imported by both node-side code (MinecraftDebugClient) and web
 * UX (DebugStatsPanel.tsx), so it must not import anything node-specific.
 */

import {
  DebugAttachFailureReason,
  DebugOwnershipState,
  DiagnosticsDataSource,
  DiagnosticsDisplayType,
  IDiagnosticsTabDescriptor,
  IMinecraftDebugCapabilities,
  ProtocolVersion,
} from "./IMinecraftDebugProtocol";

const VALID_DATA_SOURCES: DiagnosticsDataSource[] = ["server", "client", "server_script"];

const VALID_DISPLAY_TYPES: DiagnosticsDisplayType[] = [
  "line_chart",
  "stacked_line_chart",
  "stacked_bar_chart",
  "table",
  "multi_column_table",
  "dynamic_properties_table",
];

/**
 * UI model for one diagnostics tab, derived from a validated wire descriptor.
 * camelCase mirror of IDiagnosticsTabDescriptor for consumption by React UX.
 */
export interface IDiagnosticsTabModel {
  /** Stable id for tab selection/aria wiring (name, uniquified per schema) */
  id: string;
  /** Internal name from the descriptor */
  name: string;
  /** Display title (falls back to name) */
  title: string;
  statGroupId: string;
  dataSource: DiagnosticsDataSource;
  displayType: DiagnosticsDisplayType;
  yLabel?: string;
  tickRange?: number;
  valueScalar?: number;
  targetValue?: number;
  keyLabel?: string;
  valueLabels?: string[];
  statisticIds?: string[];
  /** True when the server intentionally sends no data for this view on this target */
  isEmptyTab: boolean;
}

/**
 * One rejected descriptor with an actionable reason.
 */
export interface IDiagnosticsSchemaError {
  /** Index of the descriptor within the SchemaEvent */
  index: number;
  /** Descriptor name if one was present */
  name?: string;
  /** Human-readable reason the descriptor was rejected */
  message: string;
}

/**
 * Result of validating a SchemaEvent's descriptors: renderable tab models plus
 * per-descriptor errors for anything malformed or unsupported.
 */
export interface IDiagnosticsSchemaModel {
  tabs: IDiagnosticsTabModel[];
  errors: IDiagnosticsSchemaError[];
}

/**
 * Capability-gated controls model: which debugger actions the panel may show
 * for the negotiated protocol version. Actions the version does not support
 * must be hidden, not just disabled.
 */
export interface IDiagnosticsControlsModel {
  showPauseResume: boolean;
  showProfiler: boolean;
  showCommands: boolean;
}

/**
 * Minimal stat shape needed for tab matching. Structurally compatible with
 * IDebugStatItem (app/IServerNotification.ts) without importing it here.
 */
export interface IDiagnosticsStatValue {
  name: string;
  values: (number | string)[];
  parent?: string;
  fullId?: string;
  parentFullId?: string;
  /** Aggregate child rows as [childName, ...values] tuples; see IDebugStatItem */
  childrenStringValues?: string[][];
}

/**
 * Primary content state of the diagnostics panel. Derived purely from session
 * facts so transitions (connect, reconnect, target change, disconnect) stay
 * truthful and testable.
 */
export type DiagnosticsPanelDisplayState =
  | "disconnected"
  | "connecting"
  | "ownedExternally"
  | "diagnosticsDisabled"
  | "loadingSchema"
  | "noEvents"
  | "stale"
  | "active";

export interface IDiagnosticsPanelFacts {
  connectionStatus: "connected" | "disconnected" | "connecting";
  /** Whether the server has debugger/diagnostics streaming enabled at all */
  diagnosticsEnabled: boolean;
  /** Who owns the single-client debug endpoint */
  ownership: "unattached" | "attachedByMct" | "attachedExternally" | "unknown";
  protocolVersion?: number;
  /** True once a validated (possibly empty) schema has been received this session */
  hasSchema: boolean;
  /** True once any StatEvent2 has been received this session */
  hasReceivedStats: boolean;
  /** Milliseconds since the last debugger event, or undefined if none yet */
  msSinceLastEvent?: number;
  /**
   * Milliseconds since this session connected, or undefined if unknown.
   * Bounds the loadingSchema state: a v9+ target that never delivers a usable
   * SchemaEvent must not show "loading" forever. Undefined counts as within
   * the grace period.
   */
  msSinceConnect?: number;
}

/**
 * Facts the server side knows about its debug attach attempts, used to
 * classify who owns the single-client debug endpoint.
 */
export interface IDebugOwnershipFacts {
  /** MCT's debug client completed the protocol handshake and is attached */
  clientConnected: boolean;
  /** Typed reason of the last failed attach attempt, if any */
  attachFailure?: DebugAttachFailureReason;
  /**
   * True only when Minecraft explicitly printed "Debugger listening" — NOT
   * when the 10-second fallback assumed readiness without confirmation.
   */
  listenerConfirmed: boolean;
  /** Whether BDS was started with the script debugger enabled */
  debuggerEnabled: boolean;
  /** Whether MCT's debugger streaming is enabled */
  streamingEnabled: boolean;
}

/**
 * Classify who owns the single-client Minecraft debug endpoint.
 *
 * "attachedExternally" requires POSITIVE contention evidence: Minecraft
 * confirmed its listener is up AND our TCP connect was accepted but the peer
 * closed/went silent before completing the protocol handshake — the signature
 * of a busy single-client endpoint (e.g., VS Code attached). Transport-level
 * failures (refused, timeout, unreachable) have too many innocent causes —
 * listener startup races, firewalls, BDS shutting down mid-retry — so they
 * classify as "unknown" (retryable) rather than telling the user to go stop
 * another debugger that may not exist.
 */
export function deriveDebugOwnership(facts: IDebugOwnershipFacts): DebugOwnershipState {
  if (facts.clientConnected) {
    return "attachedByMct";
  }

  if (facts.attachFailure === "handshakeFailed" && facts.listenerConfirmed) {
    return "attachedExternally";
  }

  if (facts.attachFailure !== undefined) {
    return "unknown";
  }

  if (facts.debuggerEnabled && facts.streamingEnabled) {
    return "unattached";
  }

  return "unknown";
}

/** Events older than this are considered stale ("no recent events"). */
export const STALE_EVENT_THRESHOLD_MS = 5000;

/** How long to show "loading schema" before falling back to hardcoded views. */
export const SCHEMA_LOAD_GRACE_MS = 3000;

/**
 * Convert one raw wire descriptor to a typed UI tab model.
 * Returns an error message string instead of a model when malformed.
 */
function buildTabModel(raw: unknown, index: number): IDiagnosticsTabModel | string {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return "Descriptor is not an object";
  }

  const desc = raw as Partial<IDiagnosticsTabDescriptor>;

  if (typeof desc.name !== "string" || desc.name.length === 0) {
    return "Descriptor is missing a name";
  }

  if (typeof desc.stat_group_id !== "string" || desc.stat_group_id.length === 0) {
    return `Descriptor '${desc.name}' is missing stat_group_id`;
  }

  if (VALID_DATA_SOURCES.indexOf(desc.data_source as DiagnosticsDataSource) < 0) {
    return `Descriptor '${desc.name}' has unsupported data_source '${String(desc.data_source)}'`;
  }

  if (VALID_DISPLAY_TYPES.indexOf(desc.display_type as DiagnosticsDisplayType) < 0) {
    return `Descriptor '${desc.name}' has unsupported display_type '${String(desc.display_type)}'`;
  }

  const statisticIds: string[] = [];

  if (typeof desc.statistic_id === "string" && desc.statistic_id.length > 0) {
    statisticIds.push(desc.statistic_id);
  }

  if (Array.isArray(desc.statistic_ids)) {
    for (const id of desc.statistic_ids) {
      if (typeof id === "string" && id.length > 0 && statisticIds.indexOf(id) < 0) {
        statisticIds.push(id);
      }
    }
  }

  // A line chart renders a single series; the protocol defines its effective
  // statistic as statistic_id ?? stat_group_id (see the official renderer's
  // SimpleStatisticProvider). Without this fallback, a line_chart descriptor
  // that omits statistic_id would render every stat in the group as unrelated
  // sibling cards. Multi-series display types intentionally keep the whole
  // group when no statistic_ids are declared.
  if (statisticIds.length === 0 && desc.display_type === "line_chart") {
    statisticIds.push(desc.stat_group_id);
  }

  return {
    id: desc.name,
    name: desc.name,
    title: typeof desc.title === "string" && desc.title.length > 0 ? desc.title : desc.name,
    statGroupId: desc.stat_group_id,
    dataSource: desc.data_source as DiagnosticsDataSource,
    displayType: desc.display_type as DiagnosticsDisplayType,
    yLabel: typeof desc.y_label === "string" ? desc.y_label : undefined,
    tickRange: typeof desc.tick_range === "number" ? desc.tick_range : undefined,
    valueScalar: typeof desc.value_scalar === "number" ? desc.value_scalar : undefined,
    targetValue: typeof desc.target_value === "number" ? desc.target_value : undefined,
    keyLabel: typeof desc.key_label === "string" ? desc.key_label : undefined,
    valueLabels: Array.isArray(desc.value_labels) ? desc.value_labels.filter((v) => typeof v === "string") : undefined,
    statisticIds: statisticIds.length > 0 ? statisticIds : undefined,
    isEmptyTab: desc.is_empty_tab === true,
  };
}

/**
 * Validate a SchemaEvent's descriptors and build UI tab models. Never throws:
 * malformed descriptors become per-descriptor errors and valid ones still
 * render, so one bad descriptor cannot take down the panel.
 */
export function buildSchemaModel(descriptors: unknown): IDiagnosticsSchemaModel {
  const result: IDiagnosticsSchemaModel = { tabs: [], errors: [] };

  if (!Array.isArray(descriptors)) {
    result.errors.push({
      index: -1,
      message: "SchemaEvent descriptors payload is not an array",
    });
    return result;
  }

  const usedIds = new Set<string>();

  for (let i = 0; i < descriptors.length; i++) {
    const modelOrError = buildTabModel(descriptors[i], i);

    if (typeof modelOrError === "string") {
      const name =
        descriptors[i] && typeof (descriptors[i] as IDiagnosticsTabDescriptor).name === "string"
          ? (descriptors[i] as IDiagnosticsTabDescriptor).name
          : undefined;
      result.errors.push({ index: i, name: name, message: modelOrError });
    } else {
      // Uniquify ids so duplicate descriptor names can't break tab selection
      let id = modelOrError.id;
      let suffix = 1;
      while (usedIds.has(id)) {
        id = modelOrError.id + "_" + suffix++;
      }
      usedIds.add(id);
      modelOrError.id = id;

      result.tabs.push(modelOrError);
    }
  }

  return result;
}

/**
 * Determine which debugger controls the panel may show for a negotiated
 * session. Unsupported actions are hidden entirely (not disabled) so users
 * never see profiler/debugger actions the protocol version cannot honor.
 */
export function buildControlsModel(
  protocolVersion: number | undefined,
  capabilities?: Partial<IMinecraftDebugCapabilities>
): IDiagnosticsControlsModel {
  const version = protocolVersion ?? ProtocolVersion.Unknown;

  return {
    // Pause/resume are part of the base protocol
    showPauseResume: version >= ProtocolVersion.Initial,
    showProfiler: capabilities?.supportsProfiler ?? version >= ProtocolVersion.SupportProfilerCaptures,
    showCommands: capabilities?.supportsCommands ?? version >= ProtocolVersion.SupportProfilerCaptures,
  };
}

/**
 * Normalize a stat/group id for tolerant EQUALITY matching: lowercase with all
 * separators stripped, so "server_timing", "serverTiming", and "servertiming"
 * compare equal. Never use this form for prefix checks - without separators,
 * "tick" would falsely prefix-match "tickle_x".
 */
function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Normalize a stat/group id to its canonical PATH form: lowercase with
 * separator runs collapsed to single underscores. Preserves segment
 * boundaries so subtree checks can require a whole-segment prefix.
 */
function normalizeIdPath(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Return the stats belonging to a schema tab. Mirrors the official
 * minecraft-debugger providers: a stat is in the group when its DIRECT parent
 * is the group (event.group === stat_group_id in the official providers) or
 * when it IS the group stat itself (aggregate parents carry their rows as
 * child tuples). Nested descendants do NOT match - a stat whose direct group
 * is "world" belongs to the world tab even when that group sits under "tick".
 *
 * The tab's data source gates the ENTIRE match: client-source statistics
 * live under the per-client root ("clients_client0_tick") while
 * server/server_script statistics never do (server groups may nest under
 * other server groups - "world" under "tick" - but never under "clients"),
 * and the two sides legitimately declare the SAME group ids (both define
 * "tick"). A client tab therefore accepts only stats under the per-client
 * root, and a server/server_script tab rejects them. Without the gate, each
 * side's tab would consume the other side's statistics and the UI would
 * misattribute them.
 *
 * The bare name/parent comparisons are legacy fallbacks for payloads that
 * carry no full ids (source cannot be told apart there): when a stat's
 * fullId/parentFullId IS present it is authoritative, so a leaf merely NAMED
 * like the group (e.g. a "tick" leaf under tick_world, full id
 * tick_world_tick) must not be pulled into the group's tab by its name.
 * statistic_ids then filter exactly (no substring acceptance), and when the
 * named statistics have not arrived yet the result is empty - unrelated
 * sibling metrics must not be displayed as though they belonged to the tab.
 */
export function matchStatsForTab(tab: IDiagnosticsTabModel, stats: IDiagnosticsStatValue[]): IDiagnosticsStatValue[] {
  const group = normalizeId(tab.statGroupId);
  const groupPath = normalizeIdPath(tab.statGroupId);
  const isClientSource = tab.dataSource === "client";

  const inGroup = stats.filter((stat) => {
    // Grouping/non-value nodes arrive as stats with no values and no
    // aggregate child tuples (_flattenStats emits every tree node). The
    // official Simple/MultipleStatisticProvider suppress such events;
    // retaining them would render synthetic zero cards and blank table rows
    // instead of the truthful "no data received yet" state.
    if (
      stat.values.length === 0 &&
      (stat.childrenStringValues === undefined || stat.childrenStringValues.length === 0)
    ) {
      return false;
    }

    const fullId = stat.fullId ? normalizeId(stat.fullId) : "";
    const fullIdPath = stat.fullId ? normalizeIdPath(stat.fullId) : "";
    const parentFullId = stat.parentFullId ? normalizeId(stat.parentFullId) : "";
    const parentFullIdPath = stat.parentFullId ? normalizeIdPath(stat.parentFullId) : "";
    const name = normalizeId(stat.name);
    const parent = stat.parent ? normalizeId(stat.parent) : "";

    // Legacy fallbacks: with no full ids anywhere on the stat, the wire
    // gives no way to tell sources apart - the name-based match stands in
    // for every source.
    if (fullId === "" && parentFullId === "") {
      return name === group || parent === group;
    }

    if (isClientSource) {
      // Only the per-client nested forms match a client tab: the group node
      // itself ("clients_client0_tick") or a direct member of it. Requiring
      // the per-client root also keeps a server-side NESTED group that
      // merely shares the trailing segment ("tick_world" vs a client
      // "world" tab) from being claimed.
      return (
        (fullIdPath.startsWith("clients_") && fullIdPath.endsWith("_" + groupPath)) ||
        (parentFullIdPath.startsWith("clients_") && parentFullIdPath.endsWith("_" + groupPath))
      );
    }

    // Server/server_script: anything under the per-client root is client
    // data and must not be pulled into a server tab.
    if (fullIdPath.startsWith("clients_") || parentFullIdPath.startsWith("clients_")) {
      return false;
    }

    return (
      // The group stat itself; the bare name only stands in when the wire
      // provided no full id for the stat
      fullId === group ||
      (fullId === "" && name === group) ||
      // Direct members: the stat's direct parent is the group; the bare
      // parent name only stands in when no parent full id arrived
      parentFullId === group ||
      (parentFullId === "" && parent === group) ||
      // Server-side nesting: the group node itself may sit under another
      // server group ("world" under "tick"), so the direct parent's path
      // may end in the group segment.
      (parentFullIdPath !== "" && (parentFullIdPath === groupPath || parentFullIdPath.endsWith("_" + groupPath)))
    );
  });

  if (!tab.statisticIds || tab.statisticIds.length === 0) {
    return inGroup;
  }

  const wanted = tab.statisticIds.map(normalizeId);

  return inGroup.filter((stat) => {
    const name = normalizeId(stat.name);
    const fullId = stat.fullId ? normalizeId(stat.fullId) : "";
    return wanted.some((w) => name === w || fullId === w);
  });
}

/**
 * One renderable row for a table-type diagnostics tab.
 */
export interface IDiagnosticsTableRow {
  /** Stable row key: stat full id, plus the child name for aggregate rows */
  id: string;
  /** Raw row name; see verbatim for whether display code may prettify it */
  name: string;
  /**
   * True when the name is a creator-defined identifier (a dynamic property
   * key) that must be displayed verbatim rather than title-cased.
   */
  verbatim: boolean;
  values: (number | string)[];
}

/**
 * Expand a table tab's matched stats into renderable rows. Aggregate stats
 * (should_aggregate on the wire) deliver their data as [childName, ...values]
 * string tuples in childrenStringValues instead of in values -
 * dynamic_properties_table tabs and consolidated multi-column tables arrive
 * exclusively this way. Matching the official minecraft-debugger tables, an
 * aggregate stat contributes only its child rows (not a row of its own), and
 * a non-aggregate stat contributes one row holding only its newest sample:
 * its values array is an oldest-to-newest sample window, not a set of table
 * columns - true multi-column rows come exclusively from the child tuples.
 * Numeric child values were stringified at flatten time and are restored here
 * so value_scalar / target_value formatting still applies - EXCEPT for
 * dynamic_properties_table, whose values are creator data and must render
 * verbatim ("001" or "1e3" must not become 1 / 1000).
 */
export function buildTableRows(tab: IDiagnosticsTabModel, stats: IDiagnosticsStatValue[]): IDiagnosticsTableRow[] {
  const isDynamicProperties = tab.displayType === "dynamic_properties_table";
  const rows: IDiagnosticsTableRow[] = [];

  for (const stat of stats) {
    const statId = stat.fullId ?? stat.name;

    if (stat.childrenStringValues && stat.childrenStringValues.length > 0) {
      for (const child of stat.childrenStringValues) {
        if (child.length === 0) {
          continue;
        }

        rows.push({
          id: `${statId}:${child[0]}`,
          name: child[0],
          verbatim: isDynamicProperties,
          values: isDynamicProperties
            ? child.slice(1)
            : child.slice(1).map((v) => (v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v)),
        });
      }
    } else {
      rows.push({
        id: statId,
        name: stat.name,
        verbatim: false,
        values: stat.values.length > 0 ? [stat.values[stat.values.length - 1]] : [],
      });
    }
  }

  return rows;
}

/**
 * Apply a tab's value_scalar to a numeric stat value (string values pass through).
 */
export function scaleStatValue(tab: IDiagnosticsTabModel, value: number | string): number | string {
  if (typeof value !== "number" || tab.valueScalar === undefined) {
    return value;
  }
  return value * tab.valueScalar;
}

/**
 * Derive the panel's primary content state from session facts.
 *
 * Priority: server-side disablement > disconnect (with external-ownership
 * variant) > connecting > schema loading > no events yet > stale > active.
 * "paused" and schema errors are overlays/banners on top of these, not states,
 * so pause doesn't hide the last known diagnostics.
 */
export function derivePanelDisplayState(facts: IDiagnosticsPanelFacts): DiagnosticsPanelDisplayState {
  if (!facts.diagnosticsEnabled) {
    return "diagnosticsDisabled";
  }

  if (facts.connectionStatus === "disconnected") {
    return facts.ownership === "attachedExternally" ? "ownedExternally" : "disconnected";
  }

  if (facts.connectionStatus === "connecting") {
    return "connecting";
  }

  // Connected from here on.
  const supportsSchema = (facts.protocolVersion ?? 0) >= ProtocolVersion.SupportNativeDescriptors;

  if (supportsSchema && !facts.hasSchema && !facts.hasReceivedStats) {
    // v9+ session that has not yet delivered its schema or any stats: show a
    // deliberate loading state rather than "waiting for stats" - but only for
    // SCHEMA_LOAD_GRACE_MS. A target that omits the SchemaEvent, or sent one
    // so malformed it was ignored, must not pin the panel on "loading"
    // forever; after the grace period this falls through to the truthful
    // noEvents state.
    if (facts.msSinceConnect === undefined || facts.msSinceConnect <= SCHEMA_LOAD_GRACE_MS) {
      return "loadingSchema";
    }
  }

  if (!facts.hasReceivedStats) {
    return "noEvents";
  }

  if (facts.msSinceLastEvent !== undefined && facts.msSinceLastEvent > STALE_EVENT_THRESHOLD_MS) {
    return "stale";
  }

  return "active";
}
