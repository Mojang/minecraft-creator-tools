// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Serializes work per key, in arrival order. `designStructure` holds it per
 * structure file around read → run → write → history, so two concurrent edits
 * of one structure can't both start from the same base and drop one of them.
 * Different keys run independently. Scope is this process only.
 */
export default class StructureEditLock {
  private _tails = new Map<string, Promise<void>>();

  /** Runs `work` once every earlier call with the same key has settled. */
  async run<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this._tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => held);
    this._tails.set(key, tail);

    await previous;
    try {
      return await work();
    } finally {
      release();
      if (this._tails.get(key) === tail) {
        this._tails.delete(key);
      }
    }
  }

  /** Keys with work running or waiting. */
  get activeKeyCount(): number {
    return this._tails.size;
  }
}
