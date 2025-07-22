import * as GameTest from "@minecraft/server-gametest";
import { BlockLocation } from "@minecraft/server";

GameTest.register("StarterTests", "simpleMobTest", (test) => {
  const attackerId = "fox";
  const victimId = "chicken";

  test.spawn(attackerId, new BlockLocation(5, 2, 5));
  test.spawn(victimId, new BlockLocation(2, 2, 2));

  test.assertEntityPresentInArea(victimId, true);

  // Succeed when the victim dies
  test.succeedWhen(() => {
    test.assertEntityPresentInArea(victimId, false);
  });
})
  .maxTicks(400)
  .structureName("startertests:mediumglass"); /* use the mediumglass.mcstructure file */
