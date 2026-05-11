// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ItemSpriteDatabase - Unified catalog of all available Minecraft items.
 *
 * Loads from a pre-built static catalog (recipe-item-catalog.json) generated
 * at build time by scripts/generate-item-catalog.mjs. This avoids slow
 * async Database calls and makes the item list appear instantly.
 *
 * Also merges project-defined custom items/blocks on top of the vanilla list.
 */

import Project from "../../../app/Project";
import { ProjectItemType } from "../../../app/IProjectItemData";
import Utilities from "../../../core/Utilities";
import CreatorToolsHost from "../../../app/CreatorToolsHost";
import Log from "../../../core/Log";
import SpriteAtlasLoader from "../../components/sprites/SpriteAtlasLoader";

export interface IItemSpriteEntry {
  id: string;
  displayName: string;
  isVanilla: boolean;
  isBlock: boolean;
  category: string;
  sprite: string | null;
  /** Atlas X offset in pixels (only for vanilla items with sprites) */
  atlasX?: number;
  /** Atlas Y offset in pixels (only for vanilla items with sprites) */
  atlasY?: number;
}

interface ICatalogItem {
  id: string;
  n: string; // display name
  c: string; // category
  s: string | null; // sprite filename or null
  ax?: number; // atlas x pixel offset
  ay?: number; // atlas y pixel offset
}

interface ICatalogAtlas {
  cols: number;
  rows: number;
  spriteSize: number;
  file: string; // relative path from data/ to atlas PNG
}

interface ICatalogFile {
  version: number;
  atlas?: ICatalogAtlas;
  items: ICatalogItem[];
}

const CATEGORY_PROJECT = "Project Items";
const SPRITE_BASE_PATH = "res/latest/van/serve/resource_pack/textures/items/";

export default class ItemSpriteDatabase {
  private static _vanillaItems: IItemSpriteEntry[] | null = null;
  private static _lookupById: Map<string, IItemSpriteEntry> | null = null;
  private static _loadPromise: Promise<IItemSpriteEntry[]> | null = null;
  // Cache the per-project merged item list keyed by the actual Project
  // instance (rather than `project.name`, which collides on duplicate or
  // empty names and never invalidates when items are added/removed). The
  // WeakMap auto-evicts entries when projects become unreachable.
  private static _projectCache: WeakMap<Project, IItemSpriteEntry[]> = new WeakMap();
  // Separate slot for the "no project" path (vanilla-only catalog).
  private static _noProjectCache: IItemSpriteEntry[] | null = null;
  private static _atlas = new SpriteAtlasLoader("ItemSpriteDatabase");
  private static _atlasSpriteSize = 16;
  private static _atlasCols = 0;
  private static _atlasRows = 0;

  static clearCache(): void {
    ItemSpriteDatabase._projectCache = new WeakMap();
    ItemSpriteDatabase._noProjectCache = null;
    ItemSpriteDatabase._lookupById = null;
  }

  /**
   * Load the static vanilla item catalog. This is a single JSON fetch that
   * returns ~1500 items with pre-resolved sprite filenames. Cached after
   * first load so subsequent calls are synchronous.
   */
  private static async _loadVanillaCatalog(): Promise<IItemSpriteEntry[]> {
    if (ItemSpriteDatabase._vanillaItems) {
      return ItemSpriteDatabase._vanillaItems;
    }

    if (ItemSpriteDatabase._loadPromise) {
      return ItemSpriteDatabase._loadPromise;
    }

    ItemSpriteDatabase._loadPromise = (async () => {
      try {
        const url = CreatorToolsHost.contentWebRoot + "data/recipe-item-catalog.json";
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to load item catalog: " + response.status);
        }
        const catalog: ICatalogFile = await response.json();

        // Set up atlas metadata if present (v3+ catalog)
        if (catalog.atlas) {
          ItemSpriteDatabase._atlasSpriteSize = catalog.atlas.spriteSize;
          ItemSpriteDatabase._atlasCols = catalog.atlas.cols;
          ItemSpriteDatabase._atlasRows = catalog.atlas.rows;
          ItemSpriteDatabase._atlas.setAtlasUrl(CreatorToolsHost.contentWebRoot + "data/" + catalog.atlas.file);
        }

        const items: IItemSpriteEntry[] = catalog.items.map((entry) => ({
          id: entry.id,
          displayName: entry.n,
          isVanilla: true,
          isBlock: false,
          category: entry.c,
          sprite: entry.s,
          atlasX: entry.ax,
          atlasY: entry.ay,
        }));

        ItemSpriteDatabase._vanillaItems = items;

        return items;
      } catch (err) {
        Log.debug("ItemSpriteDatabase: item catalog load failed, using empty list: " + err);
        ItemSpriteDatabase._vanillaItems = [];
        return [];
      }
    })();

    return ItemSpriteDatabase._loadPromise;
  }

  /**
   * Wait for the atlas image to be fully loaded into browser cache.
   */
  static async waitForPreload(): Promise<void> {
    // Make sure the catalog has been loaded — that is what wires the
    // atlas URL into the loader. Without this step, the loader would
    // report "preloaded" simply because no URL has been set yet.
    if (!ItemSpriteDatabase._vanillaItems) {
      await ItemSpriteDatabase._loadVanillaCatalog();
    }
    await ItemSpriteDatabase._atlas.waitForPreload();
  }

  /** Whether the atlas image has been fully preloaded. */
  static get isPreloaded(): boolean {
    return ItemSpriteDatabase._atlas.isPreloaded;
  }

  /** The URL to the sprite atlas PNG, or null if unavailable. */
  static get atlasUrl(): string | null {
    return ItemSpriteDatabase._atlas.atlasUrl;
  }

  /** The pixel size of each sprite cell in the atlas (default 16). */
  static get atlasSpriteSize(): number {
    return ItemSpriteDatabase._atlasSpriteSize;
  }

  /** Whether the atlas is available and ready for use. */
  static get hasAtlas(): boolean {
    return ItemSpriteDatabase._atlas.hasAtlas;
  }

  /** Total atlas image width in pixels. */
  static get atlasWidth(): number {
    return ItemSpriteDatabase._atlasCols * ItemSpriteDatabase._atlasSpriteSize;
  }

  /** Total atlas image height in pixels. */
  static get atlasHeight(): number {
    return ItemSpriteDatabase._atlasRows * ItemSpriteDatabase._atlasSpriteSize;
  }

  /**
   * Synchronously look up a vanilla catalog entry by item id. Returns
   * `undefined` if the catalog hasn't been loaded yet or the id is unknown.
   * Callers that want to render right away should pair this with
   * {@link ensureLoaded} and re-render once the returned promise resolves.
   */
  static getEntrySync(itemId: string): IItemSpriteEntry | undefined {
    if (!ItemSpriteDatabase._vanillaItems) return undefined;
    if (!ItemSpriteDatabase._lookupById) {
      const map = new Map<string, IItemSpriteEntry>();
      for (const it of ItemSpriteDatabase._vanillaItems) {
        map.set(it.id, it);
        // Also index by id without the "minecraft:" namespace so callers
        // that store ids without the prefix still resolve correctly.
        if (it.id.includes(":")) {
          const bare = it.id.substring(it.id.indexOf(":") + 1);
          if (!map.has(bare)) map.set(bare, it);
        }
      }
      ItemSpriteDatabase._lookupById = map;
    }
    let entry = ItemSpriteDatabase._lookupById.get(itemId);
    if (!entry && !itemId.includes(":")) {
      entry = ItemSpriteDatabase._lookupById.get("minecraft:" + itemId);
    }
    return entry;
  }

  /**
   * Ensure the vanilla catalog is loaded (without waiting for the atlas
   * image to preload). Resolves when {@link getEntrySync} will return
   * meaningful data.
   */
  static async ensureLoaded(): Promise<void> {
    if (ItemSpriteDatabase._vanillaItems) return;
    await ItemSpriteDatabase._loadVanillaCatalog();
  }

  static async getAllAvailableItems(project?: Project): Promise<IItemSpriteEntry[]> {
    const cached = project
      ? ItemSpriteDatabase._projectCache.get(project)
      : ItemSpriteDatabase._noProjectCache;
    if (cached) {
      return cached;
    }

    const vanillaItems = await ItemSpriteDatabase._loadVanillaCatalog();
    const items: IItemSpriteEntry[] = [];
    const seenIds = new Set<string>();

    // 1. Project custom items (shown first)
    if (project) {
      const customItems = project.getItemsByType(ProjectItemType.itemTypeBehavior);
      for (const pi of customItems) {
        const id = pi.name;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          items.push({
            id: id,
            displayName: Utilities.humanifyMinecraftName(id.includes(":") ? id.substring(id.indexOf(":") + 1) : id),
            isVanilla: false,
            isBlock: false,
            category: CATEGORY_PROJECT,
            sprite: null,
          });
        }
      }

      const customBlocks = project.getItemsByType(ProjectItemType.blockTypeBehavior);
      for (const pi of customBlocks) {
        const id = pi.name;
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          items.push({
            id: id,
            displayName: Utilities.humanifyMinecraftName(id.includes(":") ? id.substring(id.indexOf(":") + 1) : id),
            isVanilla: false,
            isBlock: true,
            category: CATEGORY_PROJECT,
            sprite: null,
          });
        }
      }
    }

    // 2. Add vanilla items from the static catalog
    for (const vi of vanillaItems) {
      if (!seenIds.has(vi.id)) {
        seenIds.add(vi.id);
        items.push(vi);
      }
    }

    if (project) {
      ItemSpriteDatabase._projectCache.set(project, items);
    } else {
      ItemSpriteDatabase._noProjectCache = items;
    }
    return items;
  }

  /**
   * Resolve the sprite URL for a given item. Uses the static catalog's
   * pre-resolved sprite filename when available.
   */
  static getSpriteUrl(itemId: string, catalogItems?: IItemSpriteEntry[]): string | null {
    // Check catalog first for pre-resolved sprite
    if (catalogItems) {
      const entry = catalogItems.find((e) => e.id === itemId);
      if (entry?.sprite) {
        return CreatorToolsHost.contentWebRoot + SPRITE_BASE_PATH + entry.sprite;
      }
    }

    // Fallback: direct name-based guess
    const cleanName = itemId.includes(":") ? itemId.substring(itemId.indexOf(":") + 1) : itemId;
    return CreatorToolsHost.contentWebRoot + SPRITE_BASE_PATH + cleanName + ".png";
  }

  static filterItems(items: IItemSpriteEntry[], query: string): IItemSpriteEntry[] {
    if (!query || query.trim().length === 0) {
      return items;
    }

    const lower = query.toLowerCase().trim();
    return items.filter(
      (item) => item.displayName.toLowerCase().includes(lower) || item.id.toLowerCase().includes(lower)
    );
  }

  static getCategories(items: IItemSpriteEntry[]): string[] {
    const cats = new Set<string>();
    for (const item of items) {
      cats.add(item.category);
    }
    // Put project items first
    const result: string[] = [];
    if (cats.has(CATEGORY_PROJECT)) {
      result.push(CATEGORY_PROJECT);
      cats.delete(CATEGORY_PROJECT);
    }
    const sorted = Array.from(cats).sort();
    return result.concat(sorted);
  }
}
