import {
  ItemUseAfterEvent,
  PlayerInteractWithBlockAfterEvent,
  Player,
  StartupEvent,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import { CreatorTools } from "../creator_tools/CreatorTools";

let curTick = 0;
let hasInitted = false;

const _ct = new CreatorTools();

/** Per-player first corner of the in-progress pliers load selection. Keyed by Player.name. */
const _loadCorner1ByPlayer = new Map<string, Vector3>();

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

/**
 * Two-tap pliers wand for selecting a region to force-load and persist:
 *   1st tap:           store corner A, message "corner 1 set".
 *   2nd tap:           use corner A + tapped block as the region, clear state, run loader.
 *   Sneak + tap:       clear in-progress selection.
 * Only the initial button press is honored (isFirstEvent) so holding the
 * button doesn't repeatedly fire.
 */
function afterPlayerInteractWithBlock(event: PlayerInteractWithBlockAfterEvent) {
  if (!event.isFirstEvent) {
    return;
  }
  if (!event.itemStack || event.itemStack.typeId !== "debug_tools:pliers") {
    return;
  }

  const player = event.player;
  const key = player.name;

  if (player.isSneaking) {
    if (_loadCorner1ByPlayer.delete(key)) {
      player.sendMessage("§eLoad selection cleared.");
    }
    return;
  }

  const tapped = event.block.location;
  const corner1 = _loadCorner1ByPlayer.get(key);

  if (!corner1) {
    _loadCorner1ByPlayer.set(key, { x: tapped.x, y: tapped.y, z: tapped.z });
    player.sendMessage(
      `§eLoad corner 1 set at (${tapped.x}, ${tapped.z}). Tap another block with pliers to load the region. Sneak+tap to cancel.`
    );
    return;
  }

  _loadCorner1ByPlayer.delete(key);

  const fromX = Math.min(corner1.x, tapped.x);
  const fromZ = Math.min(corner1.z, tapped.z);
  const toX = Math.max(corner1.x, tapped.x);
  const toZ = Math.max(corner1.z, tapped.z);
  const widthBlocks = toX - fromX + 1;
  const depthBlocks = toZ - fromZ + 1;

  player.sendMessage(
    `§aLoading region ${widthBlocks}x${depthBlocks} blocks from (${fromX},${fromZ}) to (${toX},${toZ})...`
  );

  system.run(() => {
    _ct
      .loadRegion(player.dimension, fromX, fromZ, toX, toZ, (msg) => {
        try {
          player.sendMessage(msg);
        } catch {
          // player may have disconnected — best-effort only
        }
      })
      .catch((err: Error) => {
        try {
          player.sendMessage(`§cLoad failed: ${err.message}`);
        } catch {
          // ignore
        }
      });
  });
}

world.afterEvents.itemUse.subscribe(afterItemUse);
world.afterEvents.playerInteractWithBlock.subscribe(afterPlayerInteractWithBlock);

system.beforeEvents.startup.subscribe(_ct.startup);

system.run(tick);
