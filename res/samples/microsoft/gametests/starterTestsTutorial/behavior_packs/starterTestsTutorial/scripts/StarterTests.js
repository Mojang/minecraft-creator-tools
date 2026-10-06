import * as GameTest from "@minecraft/server-gametest";

function simpleMobTest(test) {
  const foxId = "fox";
  const chickenId = "chicken";
  
  test.spawn(foxId, { x: 5, y: 2, z: 5 });
  test.spawn(chickenId, { x: 2, y: 2, z: 2 });
  
  test.assertEntityPresentInArea(chickenId, true);
  
  test.succeedWhen(() => {
    test.assertEntityPresentInArea(chickenId, false);
  });
}

GameTest.register("StarterTests", "simpleMobTest", simpleMobTest)
  .maxTicks(410)
  .structureName("startertests:mediumglass"); /* use the mediumglass.mcstructure file */
