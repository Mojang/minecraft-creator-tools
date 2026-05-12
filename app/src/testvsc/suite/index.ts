/**
 * Mocha suite loader. This file runs inside the VS Code extension host (Node side)
 * and is the entry point configured via `extensionTestsPath` in runTest.ts.
 *
 * It instantiates a Mocha runner, discovers all *.test.js files in this folder,
 * registers them, and returns a promise that resolves/rejects based on test results.
 * `@vscode/test-electron` uses that promise to set the exit code.
 */

import * as path from "path";
import * as fs from "fs";
import Mocha from "mocha";

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "bdd",
    color: true,
    timeout: 60000, // extension activation + webview mount can be slow on first launch
  });

  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    try {
      // Discover test files without pulling in the `glob` dep — we only have a handful of
      // files in this folder so a simple recursive walk is plenty.
      const testFiles = walkForTests(testsRoot);
      testFiles.forEach((f) => mocha.addFile(f));

      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

function walkForTests(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkForTests(full));
    } else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      out.push(full);
    }
  }
  return out;
}
