// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Test utilities for the extra (optional) tests in test-extra/.
 *
 * These utilities provide common functionality for:
 * - Discovering snapshot files
 * - Image comparison
 * - Server management for headless rendering
 */

import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";

/** Path to the snapshots directory - output to debugoutput so generated images don't pollute public/ */
export const SNAPSHOTS_DIR = path.join(process.cwd(), "debugoutput/res/snapshots");

/** Default base URL for the rendering server */
export const DEFAULT_SERVER_URL = "http://localhost:6126";

/**
 * Get all block names that have snapshots in the snapshots directory.
 *
 * Snapshot files use hyphens (e.g., block-acacia-fence-gate.png) but
 * Minecraft block identifiers use underscores (e.g., acacia_fence_gate).
 * This function converts the filenames to proper block identifiers.
 *
 * @returns Array of block identifiers (with underscores, ready for the renderer)
 */
export function getSnapshotBlockNames(): string[] {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    console.warn(`Snapshots directory not found: ${SNAPSHOTS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(SNAPSHOTS_DIR);
  return files
    .filter((f) => f.startsWith("block-") && f.endsWith(".png"))
    .map((f) => f.replace("block-", "").replace(".png", "").replace(/-/g, "_"));
}

/**
 * Get all mob names that have snapshots in the snapshots directory.
 *
 * Snapshot files use hyphens (e.g., mob-cave-spider.png) but
 * Minecraft mob identifiers use underscores (e.g., cave_spider).
 * This function converts the filenames to proper mob identifiers.
 *
 * @returns Array of mob identifiers (with underscores, ready for the renderer)
 */
export function getSnapshotMobNames(): string[] {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    console.warn(`Snapshots directory not found: ${SNAPSHOTS_DIR}`);
    return [];
  }

  const files = fs.readdirSync(SNAPSHOTS_DIR);
  return files
    .filter((f) => f.startsWith("mob-") && f.endsWith(".png"))
    .map((f) => f.replace("mob-", "").replace(".png", "").replace(/-/g, "_"));
}

/**
 * Image comparison result
 */
export interface ImageComparisonResult {
  /** Whether the images match within the tolerance */
  matches: boolean;
  /** Percentage of pixels that differ */
  diffPercent: number;
  /** Number of pixels that differ */
  diffPixels: number;
  /** Total number of pixels compared */
  totalPixels: number;
  /** Error message if comparison failed */
  error?: string;
  /** Dimensions of the images */
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Image comparison options
 */
export interface ImageComparisonOptions {
  /** Threshold for per-channel pixel difference (0-255). Default: 15 */
  pixelThreshold?: number;
  /** Maximum percentage of pixels allowed to differ. Default: 5 */
  maxDiffPercent?: number;
  /** If true, generate a diff image. Default: false */
  generateDiff?: boolean;
  /** Path to save the diff image (required if generateDiff is true) */
  diffOutputPath?: string;
}

/**
 * Compare two PNG images and return the comparison result.
 *
 * @param imagePath1 - Path to the first image
 * @param imagePath2 - Path to the second image
 * @param options - Comparison options
 * @returns Comparison result
 */
export function compareImages(
  imagePath1: string,
  imagePath2: string,
  options: ImageComparisonOptions = {}
): ImageComparisonResult {
  const pixelThreshold = options.pixelThreshold ?? 15;
  const maxDiffPercent = options.maxDiffPercent ?? 5;

  // Check files exist
  if (!fs.existsSync(imagePath1)) {
    return {
      matches: false,
      diffPercent: 100,
      diffPixels: -1,
      totalPixels: 0,
      error: `First image not found: ${imagePath1}`,
    };
  }

  if (!fs.existsSync(imagePath2)) {
    return {
      matches: false,
      diffPercent: 100,
      diffPixels: -1,
      totalPixels: 0,
      error: `Second image not found: ${imagePath2}`,
    };
  }

  try {
    const buffer1 = fs.readFileSync(imagePath1);
    const buffer2 = fs.readFileSync(imagePath2);

    const png1 = PNG.sync.read(buffer1);
    const png2 = PNG.sync.read(buffer2);

    // Check dimensions match
    if (png1.width !== png2.width || png1.height !== png2.height) {
      return {
        matches: false,
        diffPercent: 100,
        diffPixels: -1,
        totalPixels: 0,
        error: `Dimension mismatch: ${png1.width}x${png1.height} vs ${png2.width}x${png2.height}`,
        dimensions: { width: png1.width, height: png1.height },
      };
    }

    const totalPixels = png1.width * png1.height;
    let diffPixels = 0;

    // Optional: Create diff image
    let diffPng: PNG | undefined;
    if (options.generateDiff && options.diffOutputPath) {
      diffPng = new PNG({ width: png1.width, height: png1.height });
    }

    for (let i = 0; i < png1.data.length; i += 4) {
      const rDiff = Math.abs(png1.data[i] - png2.data[i]);
      const gDiff = Math.abs(png1.data[i + 1] - png2.data[i + 1]);
      const bDiff = Math.abs(png1.data[i + 2] - png2.data[i + 2]);
      const aDiff = Math.abs(png1.data[i + 3] - png2.data[i + 3]);

      const isDifferent =
        rDiff > pixelThreshold || gDiff > pixelThreshold || bDiff > pixelThreshold || aDiff > pixelThreshold;

      if (isDifferent) {
        diffPixels++;

        // Mark difference in red in diff image
        if (diffPng) {
          diffPng.data[i] = 255; // R
          diffPng.data[i + 1] = 0; // G
          diffPng.data[i + 2] = 0; // B
          diffPng.data[i + 3] = 255; // A
        }
      } else if (diffPng) {
        // Copy original pixel but dimmed
        diffPng.data[i] = Math.floor(png1.data[i] * 0.5);
        diffPng.data[i + 1] = Math.floor(png1.data[i + 1] * 0.5);
        diffPng.data[i + 2] = Math.floor(png1.data[i + 2] * 0.5);
        diffPng.data[i + 3] = png1.data[i + 3];
      }
    }

    // Save diff image if requested
    if (diffPng && options.diffOutputPath) {
      const diffBuffer = PNG.sync.write(diffPng);
      fs.writeFileSync(options.diffOutputPath, diffBuffer);
    }

    const diffPercent = (diffPixels / totalPixels) * 100;
    const matches = diffPercent <= maxDiffPercent;

    return {
      matches,
      diffPercent,
      diffPixels,
      totalPixels,
      dimensions: { width: png1.width, height: png1.height },
    };
  } catch (e: any) {
    return {
      matches: false,
      diffPercent: 100,
      diffPixels: -1,
      totalPixels: 0,
      error: `Comparison error: ${e.message}`,
    };
  }
}

/**
 * Check if the dev server is running on the specified port.
 *
 * @param url - The URL to check
 * @returns Promise that resolves to true if server is running
 */
export async function isServerRunning(url: string = DEFAULT_SERVER_URL): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for the server to become available.
 *
 * @param url - The URL to check
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @param pollIntervalMs - How often to check in milliseconds
 * @returns Promise that resolves when server is ready, rejects on timeout
 */
export async function waitForServer(
  url: string = DEFAULT_SERVER_URL,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 1000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (await isServerRunning(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Server at ${url} did not become available within ${timeoutMs}ms`);
}

/**
 * Get a list of all items (blocks or mobs) that have snapshots but may be missing
 * from the current rendering capability.
 *
 * This is useful for identifying gaps in coverage.
 *
 * @param type - 'block' or 'mob'
 * @param availableItems - Array of item names that can be rendered
 * @returns Array of snapshot names that don't have a corresponding available item
 */
export function findMissingItems(type: "block" | "mob", availableItems: string[]): string[] {
  const snapshotNames = type === "block" ? getSnapshotBlockNames() : getSnapshotMobNames();
  const availableSet = new Set(availableItems.map((i) => i.toLowerCase()));

  return snapshotNames.filter((name) => !availableSet.has(name.toLowerCase()));
}

/**
 * Generate a simple HTML report for visual comparison of test results.
 *
 * @param resultsDir - Directory containing the test result images
 * @param outputPath - Path for the HTML report
 * @param type - 'block' or 'mob'
 */
export function generateHtmlReport(resultsDir: string, outputPath: string, type: "block" | "mob"): void {
  const snapshotNames = type === "block" ? getSnapshotBlockNames() : getSnapshotMobNames();

  let html = `<!DOCTYPE html>
<html>
<head>
  <title>${type === "block" ? "Block" : "Mob"} Snapshot Comparison Report</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    .item { display: inline-block; margin: 10px; text-align: center; border: 1px solid #ddd; padding: 10px; }
    .item img { max-width: 200px; max-height: 200px; }
    .label { margin-top: 5px; font-weight: bold; }
    .images { display: flex; gap: 10px; }
    .image-container { text-align: center; }
    .caption { font-size: 0.8em; color: #666; }
    h1 { border-bottom: 2px solid #333; padding-bottom: 10px; }
  </style>
</head>
<body>
  <h1>${type === "block" ? "Block" : "Mob"} Snapshot Comparison</h1>
  <p>Generated: ${new Date().toISOString()}</p>
`;

  for (const name of snapshotNames) {
    const snapshotFile = `${type}-${name}.png`;
    const snapshotPath = path.join(SNAPSHOTS_DIR, snapshotFile);
    const resultPath = path.join(resultsDir, snapshotFile);

    const snapshotRelative = path.relative(path.dirname(outputPath), snapshotPath).replace(/\\/g, "/");
    const resultRelative = path.relative(path.dirname(outputPath), resultPath).replace(/\\/g, "/");

    const hasResult = fs.existsSync(resultPath);

    html += `
  <div class="item">
    <div class="label">${name}</div>
    <div class="images">
      <div class="image-container">
        <img src="${snapshotRelative}" alt="Snapshot ${name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22>Missing</text></svg>'">
        <div class="caption">Expected</div>
      </div>
      <div class="image-container">
        ${
          hasResult
            ? `<img src="${resultRelative}" alt="Result ${name}">`
            : `<div style="width:200px;height:200px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;">Not rendered</div>`
        }
        <div class="caption">Actual</div>
      </div>
    </div>
  </div>
`;
  }

  html += `
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
}
