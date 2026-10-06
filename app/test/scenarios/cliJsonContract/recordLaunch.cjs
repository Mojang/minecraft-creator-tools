// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Preloaded only in disposable CLI test children. Keep the real launch helper and
// `open` package, but record process launches instead of starting external apps.
const childProcess = require("node:child_process");
const fs = require("node:fs");

const launchFile = process.env.MCT_TEST_LAUNCH_FILE;
if (!launchFile) {
  throw new Error("The launch recorder requires MCT_TEST_LAUNCH_FILE.");
}

childProcess.spawn = (command, args) => {
  fs.appendFileSync(launchFile, JSON.stringify({ command, args }) + "\n");
  if (process.env.MCT_TEST_LAUNCH_ERROR === "true") {
    throw new Error("Test launch failure");
  }
  return new childProcess.ChildProcess();
};
