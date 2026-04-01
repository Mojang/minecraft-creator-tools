/**
 * Global teardown for Electron tests
 *
 * This script runs after all Electron tests complete (even if they crash).
 * It cleans up any orphaned test storage directories from the temp folder.
 *
 * Test directories are named with the pattern: mct-test-*
 */

import fs from "fs";
import path from "path";
import os from "os";

async function globalTeardown(): Promise<void> {
  const tempDir = os.tmpdir();
  console.log("[Global Teardown] Cleaning up orphaned test directories in:", tempDir);

  try {
    const entries = fs.readdirSync(tempDir, { withFileTypes: true });
    let cleanedCount = 0;

    for (const entry of entries) {
      // Match our test directory pattern: mct-test-*
      if (entry.isDirectory() && entry.name.startsWith("mct-test-")) {
        const dirPath = path.join(tempDir, entry.name);

        // Check if the directory is older than 1 hour (stale from crashed tests)
        // For current test run directories, the afterAll cleanup should handle them
        try {
          const stats = fs.statSync(dirPath);
          const ageMs = Date.now() - stats.mtimeMs;
          const oneHourMs = 60 * 60 * 1000;

          if (ageMs > oneHourMs) {
            console.log(
              `[Global Teardown] Removing stale test directory (${Math.round(ageMs / 60000)}min old):`,
              entry.name
            );
            fs.rmSync(dirPath, { recursive: true, force: true });
            cleanedCount++;
          }
        } catch (e) {
          // Directory may have been deleted by another process
          console.log(`[Global Teardown] Could not process directory ${entry.name}:`, e);
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`[Global Teardown] Cleaned up ${cleanedCount} stale test directories`);
    } else {
      console.log("[Global Teardown] No stale test directories to clean up");
    }
  } catch (e) {
    console.log("[Global Teardown] Error during cleanup:", e);
  }
}

export default globalTeardown;
