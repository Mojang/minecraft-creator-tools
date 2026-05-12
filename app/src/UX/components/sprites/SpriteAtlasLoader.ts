// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * SpriteAtlasLoader — shared helper for loading and preloading a sprite
 * atlas image (single PNG that contains many sprites). Both
 * `BlockSpriteDatabase` and `ItemSpriteDatabase` compose an instance of
 * this loader to avoid duplicating the boilerplate around `_atlasUrl`,
 * `_atlasReady`, the `Image()` preloader, and `waitForPreload()`.
 *
 * Usage:
 *   const loader = new SpriteAtlasLoader("MyDb");
 *   loader.setAtlasUrl(url);          // begins preloading the PNG
 *   await loader.waitForPreload();    // resolves when image is decoded or failed
 *   if (loader.hasAtlas) { ... }
 *
 * On image decode error the loader clears `atlasUrl` so callers can fall
 * back gracefully to per-icon rendering.
 */

import Log from "../../../core/Log";

export default class SpriteAtlasLoader {
  private _name: string;
  private _atlasUrl: string | null = null;
  private _atlasReady = false;
  private _preloadPromise: Promise<void> | null = null;

  constructor(name: string) {
    this._name = name;
  }

  /** Set the atlas image URL and begin preloading it into the browser cache. */
  setAtlasUrl(url: string): void {
    if (this._atlasUrl === url) return;
    this._atlasUrl = url;
    this._atlasReady = false;
    this._preloadPromise = null;
    this._beginPreload();
  }

  /** Clear the atlas URL (e.g. when the manifest could not be loaded). */
  clear(): void {
    this._atlasUrl = null;
    this._atlasReady = false;
    this._preloadPromise = null;
  }

  /** True once the atlas PNG is decoded and ready to render from. */
  get hasAtlas(): boolean {
    return this._atlasReady && this._atlasUrl !== null;
  }

  /** True if the preload step has finished (success or failure). */
  get isPreloaded(): boolean {
    return this._atlasReady || this._atlasUrl === null;
  }

  /** The atlas image URL, or null if unavailable / failed. */
  get atlasUrl(): string | null {
    return this._atlasUrl;
  }

  /** Resolve when the atlas PNG has finished loading (or failed). */
  async waitForPreload(): Promise<void> {
    if (this._preloadPromise) {
      await this._preloadPromise;
    }
  }

  private _beginPreload(): void {
    if (this._preloadPromise || !this._atlasUrl) return;

    this._preloadPromise = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this._atlasReady = true;
        resolve();
      };
      img.onerror = () => {
        Log.debug(this._name + ": atlas image failed to decode (" + this._atlasUrl + "), using per-icon fallback");
        this._atlasUrl = null;
        resolve();
      };
      img.src = this._atlasUrl!;
    });
  }
}
