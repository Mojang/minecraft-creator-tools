// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * OpenSampleCommand - Open a built-in sample project
 *
 * Loads vanilla Minecraft content from the web server's /res/ folder
 * directly into the editor as a read-only project. This is useful for:
 * - Testing with large real-world content (2000+ files)
 * - Exploring vanilla Minecraft definitions
 * - Performance testing and benchmarking
 */

import type { IToolCommandMetadata, IToolCommandResult } from "../IToolCommand";
import { ToolCommandBase } from "../IToolCommand";
import type { IToolCommandContext } from "../IToolCommandContext";
import HttpStorage from "../../../storage/HttpStorage";
import Project from "../../Project";

const SAMPLES: Record<string, { path: string; title: string; description: string }> = {
  vanilla: {
    path: "/res/latest/van/serve/",
    title: "Vanilla Minecraft",
    description: "The complete vanilla Minecraft behavior pack + resource pack (2000+ files)",
  },
  "vanilla-bp": {
    path: "/res/latest/van/serve/behavior_pack/",
    title: "Vanilla Behavior Pack",
    description: "Vanilla entities, items, recipes, loot tables, spawn rules, and biomes",
  },
  "vanilla-rp": {
    path: "/res/latest/van/serve/resource_pack/",
    title: "Vanilla Resource Pack",
    description: "Vanilla textures, models, animations, and sounds",
  },
};

export class OpenSampleCommand extends ToolCommandBase {
  readonly metadata: IToolCommandMetadata = {
    name: "open-sample",
    description: "Open a built-in sample project (e.g., vanilla Minecraft content)",
    aliases: ["sample", "vanilla"],
    category: "Project",
    arguments: [
      {
        name: "sample",
        description: "Sample to open: vanilla, vanilla-bp, vanilla-rp",
        type: "choice",
        required: false,
        defaultValue: "vanilla-bp",
      },
    ],
    flags: [],
    isWriteCommand: false,
    examples: [
      "/open-sample",
      "/open-sample vanilla-bp",
      "/open-sample vanilla",
      "/open-sample vanilla-rp",
    ],
  };

  async execute(
    context: IToolCommandContext,
    args: string[],
    _flags: Record<string, string | boolean | string[]>
  ): Promise<IToolCommandResult> {
    const sampleId = (args[0] || "vanilla-bp").toLowerCase();
    const sample = SAMPLES[sampleId];

    if (!sample) {
      const available = Object.keys(SAMPLES).join(", ");
      return this.error("SAMPLE_NOT_FOUND", `Sample '${sampleId}' not found. Available: ${available}`);
    }

    if (!context.creatorTools) {
      return this.error("NO_CREATOR_TOOLS", "No CreatorTools instance available.");
    }

    context.output.info(`Loading ${sample.title}...`);

    try {
      const contentStorage = HttpStorage.get(sample.path);
      await contentStorage.rootFolder.load();

      const newProject = new Project(context.creatorTools, sample.title, null);
      newProject.setProjectFolder(contentStorage.rootFolder);
      newProject.readOnlySafety = true;

      await newProject.attemptToLoadPreferences();
      await newProject.inferProjectItemsFromFiles(true);

      context.project = newProject;

      const itemCount = newProject.items.length;
      context.output.success(`Loaded ${sample.title} with ${itemCount} items`);

      return this.success(`Loaded ${sample.title}`, {
        sampleId,
        itemCount,
        title: sample.title,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return this.error("LOAD_ERROR", `Failed to load sample: ${message}`);
    }
  }

  async getCompletions(
    _context: IToolCommandContext,
    _args: string[],
    partialArg: string,
    argIndex: number
  ): Promise<string[]> {
    if (argIndex === 0) {
      const all = Object.keys(SAMPLES);
      if (!partialArg) return all;
      return all.filter((s) => s.startsWith(partialArg.toLowerCase()));
    }
    return [];
  }
}

export const openSampleCommand = new OpenSampleCommand();
