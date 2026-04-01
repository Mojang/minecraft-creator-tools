import { world, system, ItemStack } from "@minecraft/server";

system.runInterval(() => {
    // Sample script functionality
    const players = world.getAllPlayers();
    
    for (const player of players) {
        if (player.getComponent("minecraft:health")?.current === 20) {
            // Give the player our sample item when at full health
            const inventory = player.getComponent("minecraft:inventory");
            if (inventory) {
                const sampleItem = new ItemStack("test:sample_item", 1);
                inventory.container?.addItem(sampleItem);
            }
        }
    }
}, 1200); // Run every 60 seconds (1200 ticks)

// Event handlers
world.afterEvents.entitySpawn.subscribe((event) => {
    if (event.entity.typeId === "test:sample_entity") {
        world.sendMessage("A sample entity has spawned!");
    }
});

world.afterEvents.itemUse.subscribe((event) => {
    if (event.itemStack.typeId === "test:sample_item") {
        event.source.runCommand("say I used the sample item!");
    }
});