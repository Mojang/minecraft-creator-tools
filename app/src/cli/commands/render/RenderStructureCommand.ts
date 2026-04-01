import { Command as Commander } from "commander";
import { ICommand, ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import { TaskType } from "../../ClUtils";
import ServerManager, { ServerManagerFeatures } from "../../../local/ServerManager";
import PlaywrightPageRenderer from "../../../local/PlaywrightPageRenderer";
import Log from "../../../core/Log";
import ProjectItem from "../../../app/ProjectItem";
import * as fs from "fs";
import * as path from "path";
import LocalUtilities from "../../../local/LocalUtilities";

const MIN_RENDER_PORT = 6500;
const MAX_RENDER_PORT = 6999;

function getRandomRenderPort(): number {
  return LocalUtilities.getRandomSafePort(MIN_RENDER_PORT, MAX_RENDER_PORT);
}

/**
 * Renders a .mcstructure file to a PNG image using the structure viewer.
 *
 * Usage: mct renderstructure <structureName> [outputPath] -i <projectPath> [--isolated]
 *
 * ARCHITECTURE:
 * - structureName (context.mode): The name of the .mcstructure file to find within the project
 * - outputPath (context.newName): The output PNG file path
 * - -i (context.inputFolder): The project folder to search for the structure
 *
 * This matches the legacy behavior where the structure is searched within the project,
 * not read directly from a file path.
 */
export class RenderStructureCommand extends CommandBase implements ICommand {
  public readonly metadata: ICommandMetadata = {
    name: "renderstructure",
    description: "Render a .mcstructure file to a PNG image",
    taskType: TaskType.renderStructure,
    aliases: ["renstruct", "renderst"],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: false,
    category: "Render",
    arguments: [
      {
        name: "structureName",
        description: "Name of the .mcstructure file to render",
        required: true,
        contextField: "mode",
      },
      {
        name: "outputPath",
        description: "Path to save the output PNG",
        required: false,
        contextField: "newName",
      },
    ],
  };

  public configure(cmd: Commander): void {
    // Add command-specific options (the command itself is created by CommandRegistry)
    cmd.option("--isolated", "Use isolated mode (skip vanilla resources)");
  }

  public async execute(context: ICommandContext): Promise<void> {
    const { creatorTools, localEnv, log } = context;

    if (!creatorTools || !localEnv) {
      log.error("Not properly configured for rendering.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // mode contains the structure path/name, newName contains the optional output path
    const structurePath = context.mode;
    let outputPath = context.newName;
    const isIsolated = context.isolated;

    if (!structurePath) {
      log.error(
        "No structure path specified. Usage: mct renderstructure <structurePath> [outputPath] -i <projectPath>"
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    // Get the project to search in
    if (!context.projects || context.projects.length === 0) {
      log.error("No project loaded. Use -i to specify the project folder containing the structure.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const project = context.projects[0];

    Log.verbose(`Loading project and searching for structure: ${structurePath}`);

    // Load the project to find items
    await project.inferProjectItemsFromFiles();

    // Find the structure file in the project
    // Use multi-pass search: exact match first, then partial match
    let structureItem: ProjectItem | undefined;
    const structurePathLower = structurePath.toLowerCase();

    // First pass: look for exact match (path ends with the exact filename)
    for (const item of project.items) {
      if (!item.projectPath) {
        continue;
      }

      const itemPathLower = item.projectPath.toLowerCase();
      if (
        itemPathLower.endsWith(".mcstructure") &&
        (itemPathLower === structurePathLower || itemPathLower.endsWith("/" + structurePathLower))
      ) {
        structureItem = item;
        break;
      }
    }

    // Second pass: if no exact match, look for partial match
    if (!structureItem) {
      for (const item of project.items) {
        if (!item.projectPath) {
          continue;
        }

        const itemPathLower = item.projectPath.toLowerCase();
        if (itemPathLower.endsWith(".mcstructure") && itemPathLower.includes(structurePathLower)) {
          structureItem = item;
          break;
        }
      }
    }

    if (!structureItem) {
      log.error(`Could not find structure file matching: ${structurePath}`);
      log.info("Available structure files:");
      for (const item of project.items) {
        if (item.projectPath && item.projectPath.toLowerCase().endsWith(".mcstructure")) {
          log.info(`  - ${item.projectPath}`);
        }
      }
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    log.info(`Found structure: ${structureItem.projectPath}`);

    // Load the structure file
    await structureItem.ensureFileStorage();
    const file = structureItem.getFile();
    if (!file) {
      log.error("Could not load structure file.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    await file.loadContent();

    if (!(file.content instanceof Uint8Array)) {
      log.error("Structure file content is not binary data.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const structureData = file.content;

    // Set default output path if not specified
    if (!outputPath) {
      const structName = path.basename(structurePath).replace(/\.mcstructure$/i, "");
      outputPath = `${structName}.png`;
    }

    Log.verbose(`Output path: ${outputPath}`);

    // Use a random port to avoid conflicts
    const port = getRandomRenderPort();
    localEnv.serverHostPort = port;

    // Start the HTTP server
    const sm = new ServerManager(localEnv, creatorTools);
    sm.features = ServerManagerFeatures.all;

    const httpServer = sm.ensureHttpServer();

    // Register the structure as temporary content
    httpServer.registerTempContent("/temp/structure.mcstructure", structureData, "application/octet-stream");

    // Wait for server to be listening before navigating the browser
    await httpServer.waitForReady(30000);

    const baseUrl = `http://localhost:${port}`;

    Log.verbose(`Server started at ${baseUrl}`);

    // Initialize the headless renderer
    const renderer = new PlaywrightPageRenderer(baseUrl);
    const initialized = await renderer.initialize();

    if (!initialized) {
      log.error(
        "Could not initialize headless renderer. Ensure Chrome/Edge is available or run: npx playwright install chromium"
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    Log.verbose(`Using browser: ${renderer.getBrowserInfo()}`);
    Log.verbose(`Rendering structure...`);

    // Use the structureViewer mode with structure URL and hideChrome for clean screenshots
    let structureViewerUrl = `/?mode=structureviewer&structure=${encodeURIComponent(
      "/temp/structure.mcstructure"
    )}&hideChrome=true`;

    // Pass skipVanilla=false to load vanilla resources for block textures
    if (!isIsolated) {
      structureViewerUrl += `&skipVanilla=false`;
      structureViewerUrl += `&contentRoot=${encodeURIComponent("https://mctools.dev/")}`;
    } else {
      structureViewerUrl += `&skipVanilla=true`;
    }

    const result = await renderer.renderModel(structureViewerUrl, {
      width: 800,
      height: 600,
      renderWaitTime: isIsolated ? 15000 : 20000, // Longer wait for vanilla resource loading
      canvasTimeout: 30000, // Generous timeout for canvas screenshot on CI with SwiftShader
    });

    await renderer.close();

    // Clean up temporary content and stop the server
    httpServer.clearTempContent();
    await httpServer.stop("rendering complete");

    if (result.error) {
      log.error(`Rendering failed: ${result.error}`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
    }

    if (result.imageData) {
      // Write the image to disk
      const absoluteOutputPath = path.isAbsolute(outputPath) ? outputPath : path.join(process.cwd(), outputPath);

      // Ensure directory exists
      const outputDir = path.dirname(absoluteOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(absoluteOutputPath, result.imageData);
      log.info(`Rendered image saved to: ${absoluteOutputPath}`);
    } else {
      log.info("No image data was generated. The structure may not be renderable.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
    }
  }
}

export const renderStructureCommand = new RenderStructureCommand();
