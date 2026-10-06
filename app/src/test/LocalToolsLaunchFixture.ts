// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Exercises the two-argument host API in a disposable child with recordLaunch.cjs preloaded.
import "../app/Project";
import CreatorTools from "../app/CreatorTools";
import LocalTools from "../local/LocalTools";
import NodeStorage from "../local/NodeStorage";

async function launchWorld() {
  const dataDir = process.env.MCTOOLS_DATA_DIR;
  const worldName = process.argv[2];
  if (!dataDir || !worldName || !process.env.MCT_TEST_LAUNCH_FILE) {
    throw new Error("The launch fixture requires an isolated data folder, launch recorder, and world name.");
  }

  const storage = new NodeStorage(dataDir, "");
  const creatorTools = new CreatorTools(storage, storage, [], null, null, null, null);

  await LocalTools.launchWorld(creatorTools, worldName);
}

if (require.main === module) {
  launchWorld().catch((error: unknown) => {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
    process.exitCode = 1;
  });
}
