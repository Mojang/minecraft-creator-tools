/**
 * Zlib browser shim that wraps browserify-zlib with a `constants` object
 *
 * browserify-zlib exports constants directly on the module (e.g., zlib.Z_SYNC_FLUSH)
 * but modern Node.js code expects them in a `constants` object (zlib.constants.Z_SYNC_FLUSH)
 *
 * This shim re-exports everything from browserify-zlib and adds a `constants` object
 * that references the same values for compatibility with axios and other modern packages.
 */

// Re-export everything from browserify-zlib
export * from "browserify-zlib";
export { default } from "browserify-zlib";

// Import the default export to access the constants
import zlib from "browserify-zlib";

// Create a constants object that mirrors the flat exports
// This provides compatibility with Node.js 10+ style zlib.constants.Z_*
export const constants = {
  // Flush modes
  Z_NO_FLUSH: zlib.Z_NO_FLUSH,
  Z_PARTIAL_FLUSH: zlib.Z_PARTIAL_FLUSH,
  Z_SYNC_FLUSH: zlib.Z_SYNC_FLUSH,
  Z_FULL_FLUSH: zlib.Z_FULL_FLUSH,
  Z_FINISH: zlib.Z_FINISH,
  Z_BLOCK: zlib.Z_BLOCK,
  Z_TREES: zlib.Z_TREES,

  // Return codes
  Z_OK: zlib.Z_OK,
  Z_STREAM_END: zlib.Z_STREAM_END,
  Z_NEED_DICT: zlib.Z_NEED_DICT,
  Z_ERRNO: zlib.Z_ERRNO,
  Z_STREAM_ERROR: zlib.Z_STREAM_ERROR,
  Z_DATA_ERROR: zlib.Z_DATA_ERROR,
  Z_MEM_ERROR: zlib.Z_MEM_ERROR,
  Z_BUF_ERROR: zlib.Z_BUF_ERROR,
  Z_VERSION_ERROR: zlib.Z_VERSION_ERROR,

  // Compression levels
  Z_NO_COMPRESSION: zlib.Z_NO_COMPRESSION,
  Z_BEST_SPEED: zlib.Z_BEST_SPEED,
  Z_BEST_COMPRESSION: zlib.Z_BEST_COMPRESSION,
  Z_DEFAULT_COMPRESSION: zlib.Z_DEFAULT_COMPRESSION,

  // Compression strategies
  Z_FILTERED: zlib.Z_FILTERED,
  Z_HUFFMAN_ONLY: zlib.Z_HUFFMAN_ONLY,
  Z_RLE: zlib.Z_RLE,
  Z_FIXED: zlib.Z_FIXED,
  Z_DEFAULT_STRATEGY: zlib.Z_DEFAULT_STRATEGY,

  // Window bits
  Z_MIN_WINDOWBITS: zlib.Z_MIN_WINDOWBITS,
  Z_MAX_WINDOWBITS: zlib.Z_MAX_WINDOWBITS,
  Z_DEFAULT_WINDOWBITS: zlib.Z_DEFAULT_WINDOWBITS,

  // Memory levels
  Z_MIN_MEMLEVEL: zlib.Z_MIN_MEMLEVEL,
  Z_MAX_MEMLEVEL: zlib.Z_MAX_MEMLEVEL,
  Z_DEFAULT_MEMLEVEL: zlib.Z_DEFAULT_MEMLEVEL,

  // Brotli-specific constants (may not exist in browserify-zlib)
  // These are stubbed to prevent errors in code that references them
  BROTLI_OPERATION_PROCESS: 0,
  BROTLI_OPERATION_FLUSH: 1,
  BROTLI_OPERATION_FINISH: 2,
  BROTLI_OPERATION_EMIT_METADATA: 3,
};
