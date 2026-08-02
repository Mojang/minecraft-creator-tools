import * as GameTest from "@minecraft/server-gametest";

function runAsLlama(test) {
  const llamaEntityType = "llama";

  // spawn a llama in one cell
  test.spawn(llamaEntityType, { x: 4, y: 2, z: 1 });

  // press a button which triggers a command block that "runs as llama" and moves them into a different block
  test.pressButton({ x: 2, y: 2, z: 2 });
  test.succeedWhenEntityPresent(llamaEntityType, { x: 4, y: 2, z: 3 }, true); // has the llama moved cells?
}

function cloneBlocksCommand(test) {
  // clone some terracotta blocks
  test.pressButton({ x: 1, y: 2, z: 0 });

  // clone the chest
  test.pressButton({ x: 1, y: 2, z: 3 });

  // clone the andesite stairs
  test.pressButton({ x: 1, y: 2, z: 6 });

  test.runAtTickTime(10, () => {
    test.assertBlockPresent("minecraft:purple_glazed_terracotta", { x: 5, y: 2, z: 1 }, true);
    test.assertBlockPresent("minecraft:pink_glazed_terracotta", { x: 6, y: 2, z: 2 }, true);
    test.assertBlockPresent("minecraft:oak_log", { x: 5, y: 2, z: 2 }, true);

    // test that the chest was cloned.
    test.assertBlockPresent("minecraft:chest", { x: 5, y: 2, z: 4 }, true);
    test.assertBlockPresent("minecraft:chest", { x: 6, y: 2, z: 4 }, true);

    // test that the andesite stairs was cloned.
    test.assertBlockPresent("minecraft:andesite_stairs", { x: 5, y: 2, z: 8 }, true);
    test.assertBlockPresent("minecraft:andesite_stairs", { x: 6, y: 2, z: 8 }, true);
    test.assertBlockPresent("minecraft:andesite_stairs", { x: 5, y: 2, z: 9 }, true);
    test.assertBlockPresent("minecraft:andesite_stairs", { x: 6, y: 2, z: 9 }, true);
  });

  test.runAtTickTime(20, () => {
    // clone some terracotta again, but ensure cobblestone isn't overwritten with air
    test.pressButton({ x: 2, y: 2, z: 0 });

    // clone the chest again
    test.pressButton({ x: 2, y: 2, z: 3 });

    // clone just one of the andesite stairs using a filter
    test.pressButton({ x: 3, y: 2, z: 7 });
  });

  test.runAtTickTime(30, () => {
    test.assertBlockPresent("minecraft:purple_glazed_terracotta", { x: 8, y: 2, z: 1 }, true);
    test.assertBlockPresent("minecraft:pink_glazed_terracotta", { x: 9, y: 2, z: 2 }, true);
    test.assertBlockPresent("minecraft:cobblestone", { x: 9, y: 2, z: 1 }, true);
    test.assertBlockPresent("minecraft:chest", { x: 5, y: 2, z: 4 }, true);
    test.assertBlockPresent("minecraft:purple_glazed_terracotta", { x: 6, y: 2, z: 4 }, true);
    test.assertBlockPresent("minecraft:oak_log", { x: 6, y: 2, z: 5 }, true);
    test.assertBlockPresent("minecraft:pink_glazed_terracotta", { x: 7, y: 2, z: 5 }, true);

    // test that only one of the andesite stairs was cloned.
    test.assertBlockPresent("minecraft:air", { x: 8, y: 2, z: 8 }, true);
    test.assertBlockPresent("minecraft:air", { x: 9, y: 2, z: 8 }, true);
    test.assertBlockPresent("minecraft:air", { x: 8, y: 2, z: 9 }, true);
    test.assertBlockPresent("minecraft:andesite_stairs", { x: 9, y: 2, z: 9 }, true);
  });
  test.runAtTickTime(40, () => {
    test.succeed();
  });
}

export function registerCommandTests() {
  GameTest.register("CommandTests", "cloneBlocksCommand", cloneBlocksCommand)
    .structureName("gametests:clone_command")
    .maxTicks(50);

  GameTest.register("CommandTests", "runAsLlama", runAsLlama).structureName("gametests:LlamaCommands");
}
