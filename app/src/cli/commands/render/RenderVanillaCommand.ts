/**
 * RenderVanillaCommand - Render vanilla Minecraft blocks or mobs
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command renders vanilla Minecraft blocks or mobs to PNG images.
 * It supports single items, comma-separated lists, or batch file input.
 *
 * MODES:
 * - block: Render block types (oak_stairs, stone, etc.)
 * - mob/entity: Render mob types (pig, zombie, etc.)
 * - item/attachable: Render item attachable types (bow, diamond_chestplate, etc.)
 *
 * BATCH INPUT:
 * - Comma-separated: "oak_stairs,stone,dirt"
 * - File input: "@blocks.txt" (one identifier per line)
 *
 * USAGE:
 * npx mct render vanilla <type> <identifier> [outputPath]
 * npx mct render vanilla block oak_stairs output.png
 * npx mct render vanilla mob pig,cow,sheep ./mobs/
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import PlaywrightPageRenderer from "../../../local/PlaywrightPageRenderer";
import ServerManager, { ServerManagerFeatures } from "../../../local/ServerManager";
import LocalUtilities from "../../../local/LocalUtilities";
import Log from "../../../core/Log";
import * as path from "path";
import * as fs from "fs";
import { configureRenderGpuOptions, getRenderGpuOptions } from "./RenderGpuOptions";
import {
  configureRenderPresentationOptions,
  getRenderPresentationOptions,
  renderDimension,
} from "./RenderPresentationOptions";

export class RenderVanillaCommand extends CommandBase {
  private static readonly invalidFileNameCharsRegex = /[<>:"/\\|?*\x00-\x1F]/g;

  public static buildDerivedOutputFileName(prefix: string, identifier: string, replaceUnderscores = false): string {
    const normalizedIdentifier = replaceUnderscores ? identifier.replace(/_/g, "-") : identifier;
    const safeIdentifier = RenderVanillaCommand.sanitizeFileNameFragment(normalizedIdentifier);

    return `${prefix}-${safeIdentifier}.png`;
  }

  private static sanitizeFileNameFragment(value: string): string {
    const sanitized = value
      .replace(RenderVanillaCommand.invalidFileNameCharsRegex, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.\s-]+|[.\s-]+$/g, "");

    return sanitized || "unnamed";
  }

  readonly metadata: ICommandMetadata = {
    name: "rendervanilla",
    route: ["render", "vanilla"],
    description:
      "Render vanilla blocks, entities, or items to images. " +
      "Use comma-separated identifiers or @filename to render several at once.",
    taskType: TaskType.renderVanilla,
    aliases: ["rv"],
    requiresProjects: false,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Render",
    globalOptionGroups: ["dryRun"],
    examples: [
      { description: "Render one block to a PNG", command: "mct render vanilla block oak_stairs oak_stairs.png" },
      { description: "Render several mobs into a folder", command: "mct render vanilla mob pig,cow,sheep ./renders" },
      {
        description: "Preview biome-inspired sunset lighting",
        command: "mct render vanilla mob pig pig.png --environment plains --time-of-day sunset",
      },
    ],
    learnMore: ["Bones requires geometry-backed entities or attachables; vanilla blocks reject this appearance."],
    arguments: [
      {
        name: "type",
        description: "Type of vanilla content to render (block, mob, entity, item, attachable)",
        required: true,
        choices: ["block", "mob", "entity", "item", "attachable"],
        contextField: "type",
      },
      {
        name: "identifier",
        description: "Identifier(s) to render (e.g., 'oak_stairs', 'pig,cow,sheep', '@blocks.txt')",
        required: true,
        contextField: "subCommand",
      },
      {
        name: "outputPath",
        description: "Output path: file for single item, directory for batch",
        required: false,
        contextField: "newName",
      },
    ],
  };

  configure(cmd: Command): void {
    configureRenderGpuOptions(cmd);
    configureRenderPresentationOptions(cmd, true, true);
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const contentType = context.type?.toLowerCase();
    const identifierInput = context.subCommand;
    let outputPath = context.newName;

    if (!contentType || !identifierInput) {
      context.log.error("Usage: mct render vanilla <type> <identifier(s)> [outputPath]");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const isBlock = contentType === "block";
    const isMob = contentType === "mob" || contentType === "entity";
    const isItem = contentType === "item" || contentType === "attachable";
    if (!getRenderPresentationOptions(context, !isBlock)) return;

    if (!isBlock && !isMob && !isItem) {
      context.log.error(`Unknown type: ${contentType}. Use 'block', 'mob', 'entity', 'item', or 'attachable'.`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (context.dryRun) {
      context.log.info("Dry run: would render " + identifierInput + " to " + (outputPath || "./output"));
      return;
    }

    // Parse identifiers
    let identifiers: string[];
    if (identifierInput.startsWith("@")) {
      const filePath = identifierInput.substring(1);
      if (!fs.existsSync(filePath)) {
        context.log.error(`File not found: ${filePath}`);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
      let fileContent: string;
      try {
        fileContent = fs.readFileSync(filePath, "utf-8");
      } catch (err) {
        context.log.error(`Failed to read file '${filePath}': ${err instanceof Error ? err.message : String(err)}`);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
      identifiers = fileContent
        .split(/[\r\n]+/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
    } else if (identifierInput.includes(",")) {
      identifiers = identifierInput
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    } else {
      identifiers = [identifierInput.trim()];
    }

    if (identifiers.length === 0) {
      context.log.error("No identifiers provided.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Start HTTP server
    const port = LocalUtilities.getRandomSafePort(6200, 6299);
    context.localEnv.serverHostPort = port;

    const sm = new ServerManager(context.localEnv, context.creatorTools);
    sm.features = ServerManagerFeatures.all;
    const httpServer = await sm.ensureHttpServer();
    const baseUrl = `http://localhost:${port}`;
    const renderer = new PlaywrightPageRenderer(baseUrl, getRenderGpuOptions(context.commandOptions));

    try {
      // Wait for server to be listening before navigating the browser
      await httpServer.waitForReady(30000);

      Log.verbose(`Server started at ${baseUrl}`);

      const initialized = await renderer.initialize();

      if (!initialized) {
        context.log.error("Could not initialize headless renderer. Run: npx playwright install chromium");
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }

      Log.verbose(`Using browser: ${renderer.getBrowserInfo()}`);

      const prefix = isBlock ? "block" : isItem ? "item" : "mob";
      const isBatchMode = identifiers.length > 1;

      if (isBatchMode) {
        await this.renderBatch(context, renderer, identifiers, isBlock, isMob, isItem, prefix, outputPath);
      } else {
        await this.renderSingle(context, renderer, identifiers[0], isBlock, isMob, isItem, prefix, outputPath);
      }
    } finally {
      try {
        await renderer.close();
      } finally {
        await httpServer.stop("rendering complete");
      }
    }

    this.logComplete(context);
  }

  private async renderBatch(
    context: ICommandContext,
    renderer: PlaywrightPageRenderer,
    identifiers: string[],
    isBlock: boolean,
    isMob: boolean,
    isItem: boolean,
    prefix: string,
    outputPath: string | undefined
  ): Promise<void> {
    const outputDir = outputPath || "./output";
    const absoluteOutputDir = path.isAbsolute(outputDir) ? outputDir : path.join(process.cwd(), outputDir);

    if (!fs.existsSync(absoluteOutputDir)) {
      fs.mkdirSync(absoluteOutputDir, { recursive: true });
    }

    const typeLabel = isBlock ? "block" : isItem ? "item" : "mob";
    context.log.info(`Batch rendering ${identifiers.length} ${typeLabel}(s)`);

    const items = identifiers.map((id) => ({
      name: id,
      outputPath: path.join(absoluteOutputDir, RenderVanillaCommand.buildDerivedOutputFileName(prefix, id, true)),
    }));

    const startTime = Date.now();

    const renderWaitTime = isBlock ? 1500 : isItem ? 5000 : 2500;
    const canvasTimeout = isItem ? 30000 : undefined; // Items with armor composites need more time
    const progressCb = (name: string, index: number, total: number) => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      context.log.info(`  [${index + 1}/${total}] Rendering ${name} (${elapsed}s elapsed)`);
    };

    let results;
    if (isBlock) {
      results = await renderer.renderBlocks(
        items,
        { ...this.renderOptions(context), renderWaitTime, fastMode: true },
        progressCb
      );
    } else if (isItem) {
      results = await renderer.renderItems(
        items,
        { ...this.renderOptions(context), renderWaitTime, canvasTimeout, fastMode: true },
        progressCb
      );
    } else if (isMob) {
      results = await renderer.renderMobs(
        items,
        { ...this.renderOptions(context), renderWaitTime, fastMode: true },
        progressCb
      );
    } else {
      context.log.error(`Unsupported content type for batch rendering`);
      return;
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    context.log.info("");
    context.log.info(`Batch rendering complete:`);
    context.log.info(`  Total: ${identifiers.length}, Successful: ${successful}, Failed: ${failed}`);
    context.log.info(`  Total time: ${totalTime}s`);
    context.log.info(`  Output directory: ${absoluteOutputDir}`);

    if (failed > 0) {
      context.log.warn("Failed items:");
      for (const result of results.filter((r) => !r.success)) {
        context.log.warn(`  - ${result.name}: ${result.error}`);
      }
      context.setExitCode(ErrorCodes.INIT_ERROR);
    }
  }

  private async renderSingle(
    context: ICommandContext,
    renderer: PlaywrightPageRenderer,
    identifier: string,
    isBlock: boolean,
    isMob: boolean,
    isItem: boolean,
    prefix: string,
    outputPath: string | undefined
  ): Promise<void> {
    if (!outputPath) {
      outputPath = RenderVanillaCommand.buildDerivedOutputFileName(prefix, identifier);
    }

    const typeLabel = isBlock ? "block" : isItem ? "item" : "mob";
    context.log.info(`Rendering ${typeLabel}: ${identifier}`);

    let result;
    if (isBlock) {
      result = await renderer.renderBlock(identifier, {
        ...this.renderOptions(context),
        renderWaitTime: 5000,
      });
    } else if (isItem) {
      result = await renderer.renderItem(identifier, { ...this.renderOptions(context), renderWaitTime: 8000 });
    } else if (isMob) {
      result = await renderer.renderMob(identifier, { ...this.renderOptions(context), renderWaitTime: 8000 });
    } else {
      context.log.error(`Unsupported content type for single rendering`);
      return;
    }

    if (result.error) {
      context.log.error(`Rendering failed: ${result.error}`);
    }

    if (result.imageData) {
      const absoluteOutputPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);
      const outputDir = path.dirname(absoluteOutputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      try {
        fs.writeFileSync(absoluteOutputPath, result.imageData);
      } catch (err) {
        context.log.error(
          `Failed to write image to '${absoluteOutputPath}': ${err instanceof Error ? err.message : String(err)}`
        );
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
      context.log.success(`Rendered image saved to: ${absoluteOutputPath}`);
    } else {
      context.log.error(`No image data was generated for: ${identifier}`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
    }
  }

  private renderOptions(context: ICommandContext) {
    return {
      presentation: getRenderPresentationOptions(context),
      width: renderDimension(context.commandOptions?.width ?? 1024, "--width"),
      height: renderDimension(context.commandOptions?.height ?? 1024, "--height"),
    };
  }
}

export const renderVanillaCommand = new RenderVanillaCommand();
