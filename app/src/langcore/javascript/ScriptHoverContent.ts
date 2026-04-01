// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ScriptHoverContent - Hover content for Minecraft Script API
 *
 * Provides hover documentation for script-related content,
 * including modules, APIs, and common patterns.
 */

import { IHoverContent, IHoverSection } from "../json/JsonHoverContent";
import { ScriptModuleInfoProvider, COMMON_SCRIPT_TYPES, ModuleStability } from "./ScriptModuleInfo";

/**
 * Generate script hover content
 */
export class ScriptHoverContentGenerator {
  /**
   * Generate hover for a module import
   */
  public generateModuleHover(moduleName: string): IHoverContent | null {
    const info = ScriptModuleInfoProvider.getModuleInfo(moduleName);
    if (!info) {
      return null;
    }

    const sections: IHoverSection[] = [];

    // Module title and description
    const lines: string[] = [`### ${moduleName}`, "", info.description];

    sections.push({ markdown: lines.join("\n") });

    // Version info
    const versionLines: string[] = ["**Versions:**", `- Stable: \`${info.latestStableVersion}\``];

    if (info.latestBetaVersion !== info.latestStableVersion) {
      versionLines.push(`- Beta: \`${info.latestBetaVersion}\``);
    }

    sections.push({ markdown: versionLines.join("\n") });

    // Stability badge
    const stabilityBadge = this.getStabilityBadge(info.stability);
    sections.push({ markdown: stabilityBadge });

    // Documentation link
    sections.push({
      markdown: `[📖 Documentation](${info.docsUrl})`,
    });

    return { sections };
  }

  /**
   * Generate hover for a script type
   */
  public generateTypeHover(typeName: string): IHoverContent | null {
    const typeInfo = COMMON_SCRIPT_TYPES[typeName as keyof typeof COMMON_SCRIPT_TYPES];
    if (!typeInfo) {
      return null;
    }

    const moduleInfo = ScriptModuleInfoProvider.getModuleInfo(typeInfo.module);

    const sections: IHoverSection[] = [];

    sections.push({
      markdown: [`### ${typeName}`, "", typeInfo.description, "", `**Module:** \`${typeInfo.module}\``].join("\n"),
    });

    if (moduleInfo) {
      sections.push({
        markdown: `[📖 Documentation](${moduleInfo.docsUrl})`,
      });
    }

    return { sections };
  }

  /**
   * Generate hover for world/system globals
   */
  public generateGlobalHover(globalName: string): IHoverContent | null {
    const globals: { [key: string]: { description: string; example: string } } = {
      world: {
        description:
          "The global World instance. Provides access to dimensions, players, scoreboards, and world events.",
        example: `// Get all players
const players = world.getAllPlayers();

// Send message to all players
world.sendMessage("Hello, world!");

// Subscribe to events
world.afterEvents.playerSpawn.subscribe((e) => {
  e.player.sendMessage("Welcome!");
});`,
      },
      system: {
        description: "The System object. Provides timing utilities and script lifecycle management.",
        example: `// Run every 20 ticks (1 second)
system.runInterval(() => {
  // Periodic code
}, 20);

// Run after 100 ticks
system.runTimeout(() => {
  // Delayed code
}, 100);

// Current tick
const tick = system.currentTick;`,
      },
    };

    const info = globals[globalName];
    if (!info) {
      return null;
    }

    const sections: IHoverSection[] = [];

    sections.push({
      markdown: [`### ${globalName}`, "", info.description, "", "**Module:** `@minecraft/server`"].join("\n"),
    });

    sections.push({
      markdown: "**Example:**",
    });

    sections.push({
      markdown: "```typescript\n" + info.example + "\n```",
      isCode: true,
      language: "typescript",
    });

    return { sections };
  }

  /**
   * Generate hover for events
   */
  public generateEventHover(eventPath: string): IHoverContent | null {
    const eventInfo = this.getEventInfo(eventPath);
    if (!eventInfo) {
      return null;
    }

    const sections: IHoverSection[] = [];

    sections.push({
      markdown: [`### ${eventInfo.name}`, "", eventInfo.description, "", `**Type:** ${eventInfo.type}`].join("\n"),
    });

    if (eventInfo.example) {
      sections.push({
        markdown: "**Example:**",
      });
      sections.push({
        markdown: "```typescript\n" + eventInfo.example + "\n```",
        isCode: true,
        language: "typescript",
      });
    }

    return { sections };
  }

  /**
   * Get stability badge markdown
   */
  private getStabilityBadge(stability: ModuleStability): string {
    switch (stability) {
      case ModuleStability.Stable:
        return "✅ **Stable** - Safe for production use";
      case ModuleStability.Beta:
        return "⚠️ **Beta** - API may change between versions";
      case ModuleStability.Internal:
        return "🔒 **Internal** - Not for external use";
      default:
        return "";
    }
  }

  /**
   * Get information about common events
   */
  private getEventInfo(
    eventPath: string
  ): { name: string; description: string; type: string; example?: string } | null {
    const events: { [key: string]: { description: string; type: string; example?: string } } = {
      "world.afterEvents.playerSpawn": {
        description: "Fires when a player spawns in the world.",
        type: "PlayerSpawnAfterEvent",
        example: `world.afterEvents.playerSpawn.subscribe((event) => {
  const { player, initialSpawn } = event;
  if (initialSpawn) {
    player.sendMessage("Welcome to the server!");
  }
});`,
      },
      "world.afterEvents.playerJoin": {
        description: "Fires when a player joins the world.",
        type: "PlayerJoinAfterEvent",
      },
      "world.afterEvents.playerLeave": {
        description: "Fires when a player leaves the world.",
        type: "PlayerLeaveAfterEvent",
      },
      "world.afterEvents.entityDie": {
        description: "Fires when an entity dies.",
        type: "EntityDieAfterEvent",
        example: `world.afterEvents.entityDie.subscribe((event) => {
  const { deadEntity, damageSource } = event;
  console.log(\`\${deadEntity.typeId} died\`);
});`,
      },
      "world.beforeEvents.chatSend": {
        description: "Fires before a chat message is sent. Can be cancelled.",
        type: "ChatSendBeforeEvent",
        example: `world.beforeEvents.chatSend.subscribe((event) => {
  if (event.message.includes("bad word")) {
    event.cancel = true;
    event.sender.sendMessage("That word is not allowed!");
  }
});`,
      },
      "world.beforeEvents.itemUse": {
        description: "Fires before an item is used. Can be cancelled.",
        type: "ItemUseBeforeEvent",
      },
      "world.beforeEvents.playerBreakBlock": {
        description: "Fires before a player breaks a block. Can be cancelled.",
        type: "PlayerBreakBlockBeforeEvent",
      },
      "world.beforeEvents.playerPlaceBlock": {
        description: "Fires before a player places a block. Can be cancelled.",
        type: "PlayerPlaceBlockBeforeEvent",
      },
    };

    if (!events[eventPath]) {
      return null;
    }

    const parts = eventPath.split(".");
    return {
      name: parts[parts.length - 1],
      ...events[eventPath],
    };
  }
}

// Singleton instance
export const scriptHoverContentGenerator = new ScriptHoverContentGenerator();
