// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ScriptCompletionItems - Completions for Minecraft Script API
 *
 * Provides completions for import statements, common patterns,
 * and API usage in TypeScript/JavaScript files.
 */

import { CompletionItemKind, ICompletionItem } from "../json/JsonCompletionItems";
import { SCRIPT_MODULES, COMMON_SCRIPT_TYPES } from "./ScriptModuleInfo";

/**
 * Context for script completions
 */
export interface IScriptCompletionContext {
  /** Line text before cursor */
  linePrefix: string;
  /** Current word being typed */
  currentWord: string;
  /** Whether we're in an import statement */
  isImportStatement: boolean;
  /** Whether we're completing a module name */
  isModuleName: boolean;
  /** Already imported modules in this file */
  importedModules: string[];
}

/**
 * Generate script completion items
 */
export class ScriptCompletionItemGenerator {
  /**
   * Generate completions for import statements
   */
  public generateImportCompletions(context: IScriptCompletionContext): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    if (context.isModuleName) {
      // Module name completions
      for (const module of SCRIPT_MODULES) {
        const isImported = context.importedModules.includes(module.name);

        items.push({
          label: module.name,
          kind: CompletionItemKind.Value,
          detail: isImported ? "Already imported" : module.description,
          documentation: `Version: ${module.latestStableVersion}\n${module.docsUrl}`,
          insertText: module.name,
          sortText: isImported ? "z" + module.name : "a" + module.name,
        });
      }
    } else if (context.isImportStatement) {
      // Named import completions for known modules
      const moduleMatch = context.linePrefix.match(/from\s+["'](@minecraft\/[^"']+)["']/);
      if (moduleMatch) {
        const moduleName = moduleMatch[1];
        items.push(...this.getModuleExportCompletions(moduleName));
      }
    }

    return items;
  }

  /**
   * Generate quick import snippets for common patterns
   */
  public generateImportSnippets(): ICompletionItem[] {
    return [
      {
        label: "import-server",
        kind: CompletionItemKind.Value,
        detail: "Import from @minecraft/server",
        insertText: 'import { world, system } from "@minecraft/server";',
        isSnippet: false,
      },
      {
        label: "import-server-ui",
        kind: CompletionItemKind.Value,
        detail: "Import from @minecraft/server-ui",
        insertText: 'import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";',
        isSnippet: false,
      },
      {
        label: "import-gametest",
        kind: CompletionItemKind.Value,
        detail: "Import from @minecraft/server-gametest",
        insertText: 'import { Test, register } from "@minecraft/server-gametest";',
        isSnippet: false,
      },
      {
        label: "world-beforeEvents",
        kind: CompletionItemKind.Value,
        detail: "Subscribe to world before events",
        insertText:
          "world.beforeEvents.${1|playerBreakBlock,playerPlaceBlock,chatSend,itemUse|}.subscribe((${2:event}) => {\n\t$0\n});",
        isSnippet: true,
      },
      {
        label: "world-afterEvents",
        kind: CompletionItemKind.Value,
        detail: "Subscribe to world after events",
        insertText:
          "world.afterEvents.${1|playerSpawn,playerJoin,playerLeave,entityDie|}.subscribe((${2:event}) => {\n\t$0\n});",
        isSnippet: true,
      },
      {
        label: "system-runInterval",
        kind: CompletionItemKind.Value,
        detail: "Run code on interval",
        insertText: "system.runInterval(() => {\n\t$0\n}, ${1:20});",
        isSnippet: true,
      },
      {
        label: "system-runTimeout",
        kind: CompletionItemKind.Value,
        detail: "Run code after delay",
        insertText: "system.runTimeout(() => {\n\t$0\n}, ${1:20});",
        isSnippet: true,
      },
      {
        label: "actionform-basic",
        kind: CompletionItemKind.Value,
        detail: "Create basic action form",
        insertText: `const form = new ActionFormData()
\t.title("$\{1:Title}")
\t.body("$\{2:Body text}")
\t.button("$\{3:Button 1}")
\t.button("$\{4:Button 2}");

form.show($\{5:player}).then((response) => {
\tif (response.canceled || response.selection === undefined) return;
\t$0
});`,
        isSnippet: true,
      },
      {
        label: "modalform-basic",
        kind: CompletionItemKind.Value,
        detail: "Create basic modal form",
        insertText: `const form = new ModalFormData()
\t.title("$\{1:Title}")
\t.textField("$\{2:Label}", "$\{3:Placeholder}")
\t.toggle("$\{4:Toggle label}", $\{5:false})
\t.slider("$\{6:Slider label}", $\{7:0}, $\{8:100}, $\{9:1});

form.show($\{10:player}).then((response) => {
\tif (response.canceled || response.formValues === undefined) return;
\tconst [$\{11:text}, $\{12:toggle}, $\{13:slider}] = response.formValues;
\t$0
});`,
        isSnippet: true,
      },
    ];
  }

  /**
   * Generate completions for world and system globals
   */
  public generateGlobalCompletions(): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    // World properties and methods
    const worldMembers = [
      { name: "afterEvents", desc: "Event signals that fire after an event occurs" },
      { name: "beforeEvents", desc: "Event signals that fire before an event occurs" },
      { name: "scoreboard", desc: "Access to scoreboard system" },
      { name: "getDimension", desc: "Get a dimension by ID" },
      { name: "getAllPlayers", desc: "Get all players in the world" },
      { name: "getPlayers", desc: "Get players matching filter options" },
      { name: "getEntity", desc: "Get an entity by ID" },
      { name: "sendMessage", desc: "Send message to all players" },
      { name: "gameRules", desc: "Access to world game rules" },
      { name: "structureManager", desc: "Manage structures in the world" },
    ];

    for (const member of worldMembers) {
      items.push({
        label: `world.${member.name}`,
        kind: CompletionItemKind.Property,
        detail: member.desc,
        insertText: `world.${member.name}`,
      });
    }

    // System properties and methods
    const systemMembers = [
      { name: "run", desc: "Run callback in next tick" },
      { name: "runInterval", desc: "Run callback on interval" },
      { name: "runTimeout", desc: "Run callback after delay" },
      { name: "clearRun", desc: "Clear a scheduled run" },
      { name: "currentTick", desc: "Current game tick" },
      { name: "afterEvents", desc: "System event signals" },
      { name: "beforeEvents", desc: "System before events" },
    ];

    for (const member of systemMembers) {
      items.push({
        label: `system.${member.name}`,
        kind: CompletionItemKind.Property,
        detail: member.desc,
        insertText: `system.${member.name}`,
      });
    }

    return items;
  }

  /**
   * Get export completions for a specific module
   */
  private getModuleExportCompletions(moduleName: string): ICompletionItem[] {
    const items: ICompletionItem[] = [];

    // Add common type exports for each module
    for (const [typeName, info] of Object.entries(COMMON_SCRIPT_TYPES)) {
      if (info.module === moduleName) {
        items.push({
          label: typeName,
          kind: CompletionItemKind.Value,
          detail: info.description,
          insertText: typeName,
        });
      }
    }

    // Add module-specific exports
    if (moduleName === "@minecraft/server") {
      const serverExports = [
        "world",
        "system",
        "Entity",
        "Player",
        "Block",
        "BlockPermutation",
        "Dimension",
        "ItemStack",
        "Vector3",
        "Direction",
        "GameMode",
        "EntityDamageCause",
        "EntityComponentTypes",
        "BlockComponentTypes",
        "ItemComponentTypes",
        "EquipmentSlot",
        "EntityHealthComponent",
        "EntityInventoryComponent",
        "Container",
      ];

      for (const exp of serverExports) {
        if (!items.some((i) => i.label === exp)) {
          items.push({
            label: exp,
            kind: CompletionItemKind.Value,
            detail: `@minecraft/server export`,
            insertText: exp,
          });
        }
      }
    }

    if (moduleName === "@minecraft/server-ui") {
      const uiExports = [
        "ActionFormData",
        "ActionFormResponse",
        "MessageFormData",
        "MessageFormResponse",
        "ModalFormData",
        "ModalFormResponse",
        "FormCancelationReason",
      ];

      for (const exp of uiExports) {
        if (!items.some((i) => i.label === exp)) {
          items.push({
            label: exp,
            kind: CompletionItemKind.Value,
            detail: `@minecraft/server-ui export`,
            insertText: exp,
          });
        }
      }
    }

    return items;
  }
}

// Singleton instance
export const scriptCompletionItemGenerator = new ScriptCompletionItemGenerator();
