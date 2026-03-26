// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
//
// Worker polyfills - this file must be imported FIRST in any web worker
// to set up compatibility shims for browser-only APIs.
//
// IMPORTANT: This file should have NO imports to avoid circular dependencies.

// POLYFILL: Some dependencies (like axios, localforage) expect window to exist.
// In a web worker, we don't have window, but we can provide a minimal stub.
// This must run before any other code that might reference window.
// @ts-ignore
if (typeof window === "undefined") {
  // Create a minimal window-like object with properties commonly accessed at module load time
  const windowPolyfill: Record<string, unknown> = {
    // Location properties
    location: {
      href: "worker://localhost/",
      protocol: "worker:",
      host: "localhost",
      hostname: "localhost",
      pathname: "/",
      search: "",
      hash: "",
      origin: "worker://localhost",
    },
    // Navigator (use self.navigator if available in worker)
    navigator: typeof self !== "undefined" ? (self as unknown as Record<string, unknown>).navigator : { userAgent: "" },
    // DOM-related (not available in workers)
    document: undefined as unknown,
    localStorage: undefined as unknown,
    sessionStorage: undefined as unknown,
    // crypto is available in workers
    crypto: typeof crypto !== "undefined" ? crypto : undefined,
    // @ts-ignore - msCrypto for older browsers
    msCrypto: typeof self !== "undefined" ? (self as unknown as Record<string, unknown>).msCrypto : undefined,
    // XMLHttpRequest might be needed by axios
    XMLHttpRequest: typeof XMLHttpRequest !== "undefined" ? XMLHttpRequest : undefined,
    // Timers (use self's timers in worker context)
    setTimeout: typeof setTimeout !== "undefined" ? setTimeout : undefined,
    setInterval: typeof setInterval !== "undefined" ? setInterval : undefined,
    clearTimeout: typeof clearTimeout !== "undefined" ? clearTimeout : undefined,
    clearInterval: typeof clearInterval !== "undefined" ? clearInterval : undefined,
    // Microtask scheduling
    queueMicrotask: typeof queueMicrotask !== "undefined" ? queueMicrotask : undefined,
    setImmediate: typeof setImmediate !== "undefined" ? setImmediate : undefined,
    // Promise
    Promise: typeof Promise !== "undefined" ? Promise : undefined,
    // Buffer might be needed by some Node.js-style code
    Buffer: undefined as unknown,
    // Process stub for Node.js-style code
    process: undefined as unknown,
    // Open stub (can't open windows from workers)
    open: (): null => null,
    // Add self reference
    self: typeof self !== "undefined" ? self : undefined,
  };

  // @ts-ignore - Assign to globalThis.window
  globalThis.window = windowPolyfill;
}

// Export a marker to confirm this module loaded
export const WORKER_POLYFILLS_LOADED = true;

/**
 * Generate a crypto random number for UUID generation.
 * This is a worker-compatible implementation that mirrors CreatorToolsHost.generateCryptoRandomNumber.
 * Uses rejection sampling to avoid modulo bias.
 */
export function generateCryptoRandomNumber(toVal: number): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    // Use rejection sampling to avoid modulo bias
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % toVal);
    let randomValue: number;
    do {
      randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    } while (randomValue >= limit);
    return randomValue % toVal;
  }
  return Math.floor(Math.random() * toVal);
}
