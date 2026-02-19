import * as GameTest from "@minecraft/server-gametest";
import { Utilities } from "Utilities.js";

// Tests the behavior of zombies chasing villagers around some walls.
function zombieVillagerChase(test) {
  const villagerType = "villager_v2";
  const zombieType = "zombie";

  Utilities.addFourNotchedWalls(test, "minecraft:brick_block", 2, 1, 2, 4, 6, 4);

  test.spawn(villagerType, { x: 1, y: 3, z: 1 });
  test.spawn(zombieType, { x: 5, y: 3, z: 5 });

  test.runAtTickTime(180, () => {
    test.assertEntityPresentInArea(villagerType, true);
    test.succeed();
  });
}

// Tests basic toughness of the iron golem, and that it will defeat skeletons and zombies.
function ironGolemArena(test) {
  const ironGolemType = "iron_golem";
  const skeletonType = "skeleton";
  const zombieType = "zombie";

  test.spawn(ironGolemType, { x: 4, y: 3, z: 3 });
  test.spawn(skeletonType, { x: 5, y: 3, z: 5 });
  test.spawn(skeletonType, { x: 4, y: 3, z: 4 });
  test.spawn(skeletonType, { x: 3, y: 3, z: 3 });
  test.spawn(zombieType, { x: 4, y: 3, z: 6 });
  test.spawn(zombieType, { x: 3, y: 3, z: 5 });
  test.spawn(zombieType, { x: 2, y: 3, z: 4 });
  test.spawn(zombieType, { x: 5, y: 3, z: 2 });

  test.succeedWhen(() => {
    test.assertEntityPresentInArea(zombieType, false);
    test.assertEntityPresentInArea(skeletonType, false);
    test.assertEntityPresentInArea(ironGolemType, true);
  });
}

// Tests the behavior that a Shulker's attack will cause a Zoglin to float.
function zoglinFloat(test) {
  const zoglinType = "zoglin";
  const shulkerType = "shulker";

  test.spawn(zoglinType, { x: 5, y: 2, z: 5 });
  test.spawn(shulkerType, { x: 2, y: 2, z: 2 });

  test.succeedWhen(() => {
    // has the zoglin floated up to the top of the cage?
    Utilities.assertEntityInVolume(test, zoglinType, 1, 7, 1, 10, 10, 10);
  });
}
// This tests a particular behavior that the phantom /should/ fly away from a cat, but
// gets 'stuck' to the cat and doesn't fly away
function phantomsShouldFlyFromCats(test) {
  let catEntityType = "cat";
  const phantomEntityType = "phantom";

  test.spawn(catEntityType, { x: 4, y: 3, z: 3 });
  test.spawn(phantomEntityType, { x: 4, y: 3, z: 3 });

  test.succeedWhenEntityPresent(phantomEntityType, { x: 4, y: 6, z: 3 }, true); // has the phantom flown up in their column?
}

export function registerMobBehaviorTests() {
  GameTest.register("MobBehaviorTests", "zombie_villager_chase", zombieVillagerChase)
    .batch("night")
    .structureName("gametests:glass_pit")
    .maxTicks(2000);

  GameTest.register("MobBehaviorTests", "iron_golem_arena", ironGolemArena)
    .batch("night")
    .structureName("gametests:mediumglass")
    .maxTicks(810);

  GameTest.register("MobBehaviorTests", "zoglin_float", zoglinFloat)
    .batch("night")
    .structureName("gametests:mediumglass")
    .maxTicks(210);

  GameTest.register("MobBehaviorTests", "phantoms_should_fly_from_cats", phantomsShouldFlyFromCats)
    .structureName("gametests:glass_cells")
    .tag("suite:broken");
}
