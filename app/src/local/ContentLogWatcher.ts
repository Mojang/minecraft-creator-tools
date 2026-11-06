// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from "path";
import MinecraftLogItem from "./MinecraftLogItem";
import { EventDispatcher } from "ste-events";
import LocalEnvironment from "./LocalEnvironment";
import {
  ContentLogTail,
  IContentLogEntry,
  IContentLogFileSystem,
  IContentLogScheduler,
  nodeContentLogFileSystem,
  timerContentLogScheduler,
} from "./ContentLog";

/** Most items kept in `logItems`; older ones are dropped. */
const MAX_LOG_ITEMS = 2000;

/** How far back the first read goes, by time and by bytes per file. */
const CATCH_UP_MS = 30 * 60 * 1000;
const CATCH_UP_BYTES = 256 * 1024;

/**
 * Collects content log entries from a Minecraft client's `logs` folder: recent entries from files
 * written in the last 30 minutes (at most 256 KB from the end of each), then new ones as they're
 * written (see ContentLogTail). Raises onLogItem for each entry.
 */
export default class ContentLogWatcher {
  private _onLogItem = new EventDispatcher<ContentLogWatcher, MinecraftLogItem>();

  private _env: LocalEnvironment;
  private _fs: IContentLogFileSystem;
  private _scheduler: IContentLogScheduler;
  private _tail: ContentLogTail | undefined;

  logItems: MinecraftLogItem[] = [];

  constructor(
    env: LocalEnvironment,
    fileSystem: IContentLogFileSystem = nodeContentLogFileSystem,
    scheduler: IContentLogScheduler = timerContentLogScheduler
  ) {
    this._env = env;
    this._fs = fileSystem;
    this._scheduler = scheduler;
  }

  public get onLogItem() {
    return this._onLogItem.asEvent();
  }

  /**
   * Watches the Minecraft client's log folder for the retail or Preview track. Does nothing if it's
   * already watching that folder, and stops watching where there's no client log folder (off
   * Windows), so callers can call it whenever the track may have changed.
   */
  public watchMinecraftFolder(usePreview = false) {
    const utilities = this._env.utilities;
    const folder = usePreview ? utilities.localPreviewServerLogPath : utilities.localReleaseServerLogPath;

    if (!folder) {
      this.stop();
    } else if (folder !== this._tail?.folder) {
      this.watchLogFolder(folder);
    }
  }

  /**
   * Adds recent entries from `mcLogPath`, then new ones as they're written. The tail does both from
   * one listing of the folder, reading each file to its end before the next, so an entry written or
   * a file started during startup is read once and in order.
   */
  public watchLogFolder(mcLogPath: string, pollIntervalMs = 500) {
    this.stop();

    const tail = new ContentLogTail(mcLogPath, {
      fileSystem: this._fs,
      startAtEnd: true,
      catchUpSinceMs: Date.now() - CATCH_UP_MS,
      catchUpBytes: CATCH_UP_BYTES,
    });

    this._tail = tail;
    tail.start((entries) => this.addEntries(tail.currentFile, entries), pollIntervalMs, this._scheduler);
  }

  public stop() {
    this._tail?.stop();
    this._tail = undefined;
  }

  private addEntries(filePath: string | undefined, entries: IContentLogEntry[]) {
    const fileName = filePath ? path.basename(filePath) : undefined;

    for (const entry of entries) {
      const logItem = new MinecraftLogItem();

      logItem.fileName = fileName;
      logItem.message = entry.message;
      logItem.time = entry.time;
      logItem.category = entry.category;
      logItem.level = entry.level;

      this.logItems.push(logItem);
      this._onLogItem.dispatch(this, logItem);
    }

    if (this.logItems.length > MAX_LOG_ITEMS) {
      this.logItems.splice(0, this.logItems.length - MAX_LOG_ITEMS);
    }
  }
}
