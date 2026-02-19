import * as GameTest from "@minecraft/server-gametest";
import { Utilities } from "Utilities.js";

function minibiomes(test) {
  let minecartEntityType = "minecraft:minecart";
  let pigEntityType = "minecraft:pig";

  let minecart = test.spawn(minecartEntityType, { x: 9, y: 7, z: 7 });
  let pig = test.spawn(pigEntityType, { x: 9, y: 7, z: 7 });

  test.setBlockType("minecraft:cobblestone", { x: 10, y: 7, z: 7 });

  let minecartRideableComp = minecart.getComponent("minecraft:rideable");

  minecartRideableComp.addRider(pig);

  test.succeedWhenEntityPresent(pigEntityType, { x: 5, y: 3, z: 1 }, true);
}

function collapsing(test) {
  const zoglinEntityType = "minecraft:zoglin";
  const shulkerEntityType = "minecraft:shulker";

  for (let i = 0; i < 3; i++) {
    test.spawn(zoglinEntityType, { x: i + 2, y: 2, z: 3 });
    test.spawn(shulkerEntityType, { x: 4, y: 2, z: i + 2 });
  }

  test.pressButton({ x: 6, y: 8, z: 5 });

  test.succeedWhen(() => {
    Utilities.assertEntityInVolume(test, zoglinEntityType, 0, 8, 0, 12, 12, 12);
  });
}

export function registerChallengeTests() {
  GameTest.register("ChallengeTests", "minibiomes", minibiomes).structureName("gametests:minibiomes").maxTicks(260);
  GameTest.register("ChallengeTests", "collapsing", collapsing)
    .structureName("gametests:collapsing_space")
    .maxTicks(260);
}
