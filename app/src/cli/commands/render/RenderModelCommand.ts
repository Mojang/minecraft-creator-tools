/**
 * RenderModelCommand - Render a model geometry file to PNG
 *
 * ARCHITECTURE DOCUMENTATION
 * ==========================
 *
 * This command renders a .geo.json model geometry file to a PNG image.
 * It uses the PlaywrightPageRenderer for headless browser rendering.
 *
 * FEATURES:
 * - Finds geometry file in project by path matching
 * - Auto-discovers related textures via cousin relationships
 * - Starts temporary HTTP server to serve content
 * - Uses Playwright for headless Chrome/Edge rendering
 *
 * USAGE:
 * npx mct rendermodel <geometryPath> [outputPath] -i <project-folder>
 * npx mct rm biceson.geo.json output.png -i ./my-addon
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ProjectItem from "../../../app/ProjectItem";
import ModelGeometryDefinition from "../../../minecraft/ModelGeometryDefinition";
import PlaywrightPageRenderer from "../../../local/PlaywrightPageRenderer";
import ServerManager, { ServerManagerFeatures } from "../../../local/ServerManager";
import LocalUtilities from "../../../local/LocalUtilities";
import * as path from "path";
import * as fs from "fs";

export class RenderModelCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "rendermodel",
    description:
      "Renders a model geometry file from the project to a PNG image. " +
      "Automatically finds related textures via project item relationships.",
    taskType: TaskType.renderModel,
    aliases: ["rm"],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Render",
    arguments: [
      {
        name: "geometryPath",
        description: "Path to the .geo.json file within the project to render.",
        required: true,
        contextField: "mode",
      },
      {
        name: "outputPath",
        description: "Path to save the rendered PNG image. Defaults to <geometryName>.png",
        required: false,
        contextField: "newName",
      },
    ],
  };

  configure(cmd: Command): void {
    // Arguments are configured via metadata.arguments
    cmd.option("--vanilla", "Load vanilla Minecraft resources from mctools.dev for fallback textures");
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const geometryPath = context.mode;
    let outputPath = context.newName;
    const useVanilla = !context.isolated;

    if (!geometryPath) {
      context.log.error("No geometry path specified. Usage: mct rendermodel <geometryPath> [outputPath] -i <project>");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    if (fs.existsSync(geometryPath)) {
      const stat = fs.statSync(geometryPath);
      if (stat.isDirectory()) {
        context.log.error("Expected a geometry file path, not a directory: " + geometryPath);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return;
      }
    }

    if (context.projectCount === 0) {
      context.log.error("No project specified. Use -i to specify the project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    for (const project of context.projects) {
      await this.renderModelFromProject(context, project, geometryPath, outputPath, useVanilla);
    }

    this.logComplete(context);
  }

  private async renderModelFromProject(
    context: ICommandContext,
    project: import("../../../app/Project").default,
    geometryPath: string,
    outputPath: string | undefined,
    useVanilla: boolean
  ): Promise<void> {
    context.log.verbose(`Loading project and searching for geometry: ${geometryPath}`);

    await project.inferProjectItemsFromFiles();

    // Find the geometry file in the project
    let geometryItem: ProjectItem | undefined;
    const geometryPathLower = geometryPath.toLowerCase();

    for (const item of project.items) {
      if (!item.projectPath) continue;

      const itemPathLower = item.projectPath.toLowerCase();
      if (
        itemPathLower.endsWith(".json") &&
        (itemPathLower === geometryPathLower ||
          itemPathLower.endsWith("/" + geometryPathLower) ||
          itemPathLower.includes(geometryPathLower))
      ) {
        geometryItem = item;
        break;
      }
    }

    if (!geometryItem) {
      context.log.error(`Could not find geometry file matching: ${geometryPath}`);
      context.log.info("Available geometry files:");
      for (const item of project.items) {
        if (item.projectPath?.toLowerCase().endsWith(".geo.json")) {
          context.log.info(`  - ${item.projectPath}`);
        }
      }
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    context.log.verbose(`Found geometry: ${geometryItem.projectPath}`);

    // Load the geometry file
    await geometryItem.ensureFileStorage();
    const file = geometryItem.getFile();
    if (!file) {
      context.log.error("Could not load geometry file.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await file.loadContent();

    const geoDef = await ModelGeometryDefinition.ensureOnFile(file);
    if (!geoDef) {
      context.log.error("Could not parse geometry file.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const geoIds = geoDef.identifiers;
    if (geoIds.length === 0) {
      context.log.error("Geometry file contains no geometry definitions.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const geometryId = geoIds[0];
    context.log.verbose(`Geometry identifier: ${geometryId}`);

    if (!outputPath) {
      const geoName = geometryId.replace(/^geometry\./, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      outputPath = `${geoName}.png`;
    }

    let geometryJson: string;
    if (typeof file.content === "string") {
      geometryJson = file.content;
    } else {
      context.log.error("Geometry file content is not a string.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Try to find related texture
    let textureData: Uint8Array | undefined;
    const ProjectItemUtilities = (await import("../../../app/ProjectItemUtilities")).default;
    const { ProjectItemType } = await import("../../../app/IProjectItemData");

    let textureItem = ProjectItemUtilities.getCousinOfType(geometryItem, ProjectItemType.texture);

    if (!textureItem) {
      const geoBaseName = path
        .basename(geometryPath)
        .replace(/\.geo\.json$/i, "")
        .replace(/\.json$/i, "");

      for (const item of project.items) {
        if (item.itemType === ProjectItemType.texture) {
          const texBaseName = path.basename(item.projectPath || "").replace(/\.(png|tga|jpg|jpeg)$/i, "");
          if (texBaseName.toLowerCase() === geoBaseName.toLowerCase()) {
            textureItem = item;
            break;
          }
        }
      }
    }

    if (textureItem) {
      await textureItem.loadContent();
      const texFile = textureItem.getFile();
      if (texFile?.content instanceof Uint8Array) {
        textureData = texFile.content;
        context.log.verbose(`Found related texture: ${textureItem.projectPath}`);
      } else {
        context.log.warn("Found texture item but could not load texture data.");
      }
    } else {
      context.log.verbose("Could not find related texture; rendering without texture.");
    }

    // Start HTTP server and renderer
    const port = LocalUtilities.getRandomSafePort(6200, 6299);
    context.localEnv.serverHostPort = port;

    const sm = new ServerManager(context.localEnv, context.creatorTools);
    sm.features = ServerManagerFeatures.all;
    const httpServer = sm.ensureHttpServer();

    httpServer.registerTempContent("/temp/geometry.json", geometryJson, "application/json");
    if (textureData) {
      httpServer.registerTempContent("/temp/texture.png", textureData, "image/png");
    }

    // Wait for server to be listening before navigating the browser
    await httpServer.waitForReady(30000);

    const baseUrl = `http://localhost:${port}`;
    const renderer = new PlaywrightPageRenderer(baseUrl);
    const initialized = await renderer.initialize();

    if (!initialized) {
      context.log.error("Could not initialize headless renderer. Run: npx playwright install chromium");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    let modelViewerUrl = `/?mode=modelviewer&geometry=${encodeURIComponent("/temp/geometry.json")}`;
    if (textureData) {
      modelViewerUrl += `&texture=${encodeURIComponent("/temp/texture.png")}`;
    }
    if (useVanilla) {
      modelViewerUrl += `&skipVanilla=false&contentRoot=${encodeURIComponent("https://mctools.dev/")}`;
    } else {
      modelViewerUrl += `&skipVanilla=true`;
    }

    const result = await renderer.renderModel(modelViewerUrl, {
      width: 512,
      height: 512,
      renderWaitTime: useVanilla ? 15000 : 5000,
      canvasTimeout: 15000,
    });

    await renderer.close();
    httpServer.clearTempContent();
    await httpServer.stop("rendering complete");

    if (result.error) {
      context.log.error(`Rendering failed: ${result.error}`);
    }

    if (result.imageData) {
      const absoluteOutputPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);

      if (context.dryRun) {
        context.log.info("Dry run: would write rendered image to " + absoluteOutputPath);
        return;
      }

      const outputDir = path.dirname(absoluteOutputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(absoluteOutputPath, result.imageData);
      context.log.success(`Rendered image saved to: ${absoluteOutputPath}`);
    } else {
      context.log.warn("No image data was generated.");
    }
  }
}

export const renderModelCommand = new RenderModelCommand();
