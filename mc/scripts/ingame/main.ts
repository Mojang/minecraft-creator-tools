import { ItemUseAfterEvent, Player, StartupEvent, system, world } from "@minecraft/server";
import { CreatorTools } from "../creator_tools/CreatorTools";

let curTick = 0;
let hasInitted = false;

const _ct = new CreatorTools();

function tick() {
  curTick++;

  if (!hasInitted && curTick > 10) {
    hasInitted = true;

    _ct.init();
  }

  system.run(tick);
}

function afterItemUse(event: ItemUseAfterEvent) {
  if (!event.source || event.source.typeId !== "minecraft:player") {
    return;
  }

  if (event.itemStack.typeId === "debug_tools:pliers_next") {
    _ct.showNextItemLocation(event.source as Player);
  }

  if (event.itemStack.typeId === "debug_tools:pliers_prev") {
    _ct.showPreviousItemLocation(event.source as Player);
  }
}

world.afterEvents.itemUse.subscribe(afterItemUse);

system.beforeEvents.startup.subscribe(_ct.startup);

system.run(tick);
