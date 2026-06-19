/**
 * RenderBatchCommand - Render many model geometries in one process.
 *
 * Why this exists:
 * `mct rendermodel` starts a fresh temporary HTTP server and Playwright Chromium
 * per invocation, which dominates wall time when a caller needs many renders
 * (per-angle previews, benchmark suites, etc.). This command initializes those
 * once, then walks a manifest of (geometryPath, outputPath) entries.
 *
 * Manifest format (JSON file at <manifestPath>):
 *
 *   {
 *     "renders": [
 *       { "geometryPath": "models/entity/owl.geo.json", "outputPath": "C:/.../yaw_0.png" },
 *       { "geometryPath": "models/entity/owl_yaw_90.geo.json", "outputPath": "C:/.../yaw_90.png" }
 *     ]
 *   }
 *
 * Per-entry overrides (renderWaitMs, width, height, vanilla) are optional;
 * unset values fall back to the CLI defaults (`--render-wait-ms`, `--width`,
 * `--height`, `--vanilla`/`--no-vanilla`).
 *
 * USAGE:
 *   mct renderbatch <manifestPath> -i <project>
 */

import { Command } from "commander";
import { ICommandMetadata, CommandBase } from "../../core/ICommand";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";
import ClUtils, { TaskType } from "../../ClUtils";
import ProjectItem from "../../../app/ProjectItem";
import ModelGeometryDefinition from "../../../minecraft/ModelGeometryDefinition";
import PlaywrightPageRenderer from "../../../local/PlaywrightPageRenderer";
import ServerManager, { ServerManagerFeatures } from "../../../local/ServerManager";
import type HttpServer from "../../../local/HttpServer";
import LocalUtilities, { UNSAFE_PORTS } from "../../../local/LocalUtilities";
import * as path from "path";
import * as fs from "fs";

interface IBatchManifestEntry {
  geometryPath: string;
  outputPath: string;
  renderWaitMs?: number;
  width?: number;
  height?: number;
  vanilla?: boolean;
  cameraX?: number;
  cameraY?: number;
  cameraZ?: number;
}

interface IBatchManifest {
  renders: IBatchManifestEntry[];
}

interface IRenderBatchOptions {
  port: number;
  width: number;
  height: number;
  renderWaitMs?: number;
  canvasTimeoutMs: number;
  vanilla: boolean;
  gpu: boolean;
}

interface IResolvedBatchRender {
  entry: IBatchManifestEntry;
  geometryJson: string;
  geometryId: string;
  textureData?: Uint8Array;
  textureMime: string;
}

interface IRenderBatchSession {
  httpServer: HttpServer;
  renderer: PlaywrightPageRenderer;
}

export class RenderBatchCommand extends CommandBase {
  readonly metadata: ICommandMetadata = {
    name: "renderbatch",
    description:
      "Renders many model geometry files in one process, reusing a headless " +
      "Chromium instance for the entire batch. Much faster than calling " +
      "rendermodel once per geometry.",
    taskType: TaskType.renderBatch,
    aliases: ["rb"],
    requiresProjects: true,
    isWriteCommand: true,
    isEditInPlace: false,
    isLongRunning: true,
    category: "Render",
    arguments: [
      {
        name: "manifestPath",
        description: "Path to a JSON manifest describing the renders to perform.",
        required: true,
        contextField: "mode",
      },
    ],
  };

  configure(cmd: Command): void {
    cmd
      .option("--vanilla", "Default to loading vanilla Minecraft resources from mctools.dev for fallback textures")
      .option(
        "--no-vanilla",
        "Default to skipping the vanilla Minecraft texture fallback. Per-entry `vanilla` in the manifest overrides this."
      )
      .option("--port <port>", "Use a specific localhost port for the temporary render server")
      .option("--port-start <port>", "First port in the random temporary render server range", "6200")
      .option("--port-end <port>", "Last port in the random temporary render server range", "6299")
      .option("--width <pixels>", "Default rendered image width in pixels", "512")
      .option("--height <pixels>", "Default rendered image height in pixels", "512")
      .option("--gpu", "Prefer hardware GPU rendering instead of SwiftShader software WebGL")
      .option(
        "--stdin",
        "Keep the process alive and read render requests from stdin. Each line is <manifestPath> or <projectDir>|<manifestPath>."
      )
      .option("--render-wait-ms <milliseconds>", "Default milliseconds to wait after loading each model before capture")
      .option(
        "--canvas-timeout-ms <milliseconds>",
        "Milliseconds to wait for the viewer canvas to become visible",
        "15000"
      );
  }

  async execute(context: ICommandContext): Promise<void> {
    this.logStart(context);

    const manifestPath = context.mode;
    if (!manifestPath) {
      context.log.error("No manifest path specified. Usage: mct renderbatch <manifestPath> -i <project>");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }
    if (!fs.existsSync(manifestPath)) {
      context.log.error("Manifest file not found: " + manifestPath);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }
    if (context.projectCount === 0) {
      context.log.error("No project specified. Use -i to specify the project folder.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return;
    }

    const options = (context.commandOptions ?? {}) as Record<string, unknown>;
    const stdinMode = options.stdin === true;
    const manifest = this.readManifest(context, manifestPath, stdinMode);
    if (!manifest) {
      if (stdinMode) {
        process.stdout.write("RENDER_ERROR\n");
        context.exitCode = 0;
      }
      return;
    }

    // Take vanilla default from CLI flags. `--no-vanilla` => vanilla=false.
    let defaultVanilla = !context.isolated;
    if (options.vanilla === false) {
      defaultVanilla = false;
    } else if (options.vanilla === true) {
      defaultVanilla = true;
    }

    const batchOptions = this.resolveBatchOptions(context, defaultVanilla);
    if (!batchOptions) {
      return;
    }

    if (stdinMode) {
      const session = await this.startRenderSession(context, batchOptions);
      if (!session) {
        process.stdout.write("RENDER_ERROR\n");
        context.exitCode = 0;
        return;
      }
      try {
        const succeeded = await this.renderManifestForProjects(context, context.projects, manifest, batchOptions, session);
        process.stdout.write(succeeded ? "RENDER_DONE\n" : "RENDER_ERROR\n");
        context.exitCode = 0;
        await this.processStdinRequests(context, batchOptions, session);
      } finally {
        await this.stopRenderSession(context, session);
        context.exitCode = 0;
      }
      return;
    }

    const succeeded = await this.renderManifestForProjects(context, context.projects, manifest, batchOptions);
    if (!succeeded) {
      context.setExitCode(ErrorCodes.INIT_ERROR);
    }

    this.logComplete(context);
  }

  private async renderManifestForProjects(
    context: ICommandContext,
    projects: Array<import("../../../app/Project").default>,
    manifest: IBatchManifest,
    batchOptions: IRenderBatchOptions,
    session?: IRenderBatchSession
  ): Promise<boolean> {
    let allSucceeded = true;
    for (const project of projects) {
      allSucceeded = (await this.renderBatchForProject(context, project, manifest, batchOptions, session)) && allSucceeded;
    }
    return allSucceeded;
  }

  private async processStdinRequests(
    context: ICommandContext,
    batchOptions: IRenderBatchOptions,
    session: IRenderBatchSession
  ): Promise<void> {
    process.stdin.setEncoding("utf8");
    let buffer = "";
    for await (const chunk of process.stdin) {
      buffer += chunk;
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) {
          continue;
        }
        let succeeded = false;
        try {
          succeeded = await this.processStdinRequest(context, batchOptions, session, line);
        } catch (e: any) {
          context.log.error("Could not process stdin render request: " + (e?.message ?? String(e)));
        } finally {
          context.exitCode = 0;
        }
        process.stdout.write(succeeded ? "RENDER_DONE\n" : "RENDER_ERROR\n");
      }
    }
  }

  private async processStdinRequest(
    context: ICommandContext,
    batchOptions: IRenderBatchOptions,
    session: IRenderBatchSession,
    line: string
  ): Promise<boolean> {
    const separatorIndex = line.indexOf("|");
    const projectDir = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : undefined;
    const manifestPath = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;
    const manifest = this.readManifest(context, manifestPath);
    if (!manifest) {
      return false;
    }

    const project = projectDir
      ? this.createProjectForFolder(context, projectDir)
      : context.projects[0];
    if (!project) {
      context.log.error("No project available for stdin render request.");
      return false;
    }

    return await this.renderBatchForProject(context, project, manifest, batchOptions, session);
  }

  private createProjectForFolder(
    context: ICommandContext,
    projectDir: string
  ): import("../../../app/Project").default | undefined {
    const resolvedProjectDir = path.isAbsolute(projectDir) ? projectDir : path.resolve(process.cwd(), projectDir);
    if (!fs.existsSync(resolvedProjectDir)) {
      context.log.error("Project folder not found: " + resolvedProjectDir);
      return undefined;
    }

    return ClUtils.createProject(context.creatorTools, {
      ctorProjectName: path.basename(resolvedProjectDir),
      localFolderPath: resolvedProjectDir,
    });
  }

  private async renderBatchForProject(
    context: ICommandContext,
    project: import("../../../app/Project").default,
    manifest: IBatchManifest,
    batchOptions: IRenderBatchOptions,
    session?: IRenderBatchSession
  ): Promise<boolean> {
    context.log.verbose(`Loading project for batch render (${manifest.renders.length} entries)...`);
    if (manifest.renders.length === 0) {
      context.log.success("Batch rendering complete: 0 succeeded, 0 failed (of 0).");
      return true;
    }

    await project.inferProjectItemsFromFiles();

    // Resolve all manifest entries up front so we fail fast on missing geos.
    const resolved: IResolvedBatchRender[] = [];

    const ProjectItemUtilities = (await import("../../../app/ProjectItemUtilities")).default;
    const { ProjectItemType } = await import("../../../app/IProjectItemData");

    for (const entry of manifest.renders) {
      const geometryItem = this.findGeometryItem(project, entry.geometryPath);
      if (!geometryItem) {
        context.log.error(`Could not find geometry file matching: ${entry.geometryPath}`);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return false;
      }

      await geometryItem.ensureFileStorage();
      const file = geometryItem.getFile();
      if (!file) {
        context.log.error("Could not load geometry file: " + entry.geometryPath);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return false;
      }
      await file.loadContent();

      const geoDef = await ModelGeometryDefinition.ensureOnFile(file);
      if (!geoDef || geoDef.identifiers.length === 0) {
        context.log.error("Could not parse geometry file: " + entry.geometryPath);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return false;
      }
      const geometryId = geoDef.identifiers[0];
      const geometryJson = typeof file.content === "string" ? file.content : undefined;
      if (!geometryJson) {
        context.log.error("Geometry file content is not a string: " + entry.geometryPath);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return false;
      }

      // Texture discovery follows the same cousin-then-basename strategy as RenderModelCommand.
      let textureItem = ProjectItemUtilities.getCousinOfType(geometryItem, ProjectItemType.texture);
      if (!textureItem) {
        const geoBaseName = path
          .basename(entry.geometryPath)
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
      let textureData: Uint8Array | undefined;
      let textureMime = "image/png";
      if (textureItem) {
        await textureItem.loadContent();
        const texFile = textureItem.getFile();
        if (texFile?.content instanceof Uint8Array) {
          textureData = texFile.content;
          const ext = path.extname(textureItem.projectPath || "").toLowerCase();
          if (ext === ".tga") {
            textureMime = "image/tga";
          } else if (ext === ".jpg" || ext === ".jpeg") {
            textureMime = "image/jpeg";
          }
        }
      }

      resolved.push({ entry, geometryJson, geometryId, textureData, textureMime });
    }

    const renderSession = session ?? (await this.startRenderSession(context, batchOptions));
    if (!renderSession) {
      return false;
    }
    try {
      return await this.renderResolvedBatch(context, resolved, batchOptions, renderSession);
    } finally {
      if (!session) {
        await this.stopRenderSession(context, renderSession);
      }
    }
  }

  private async startRenderSession(
    context: ICommandContext,
    batchOptions: IRenderBatchOptions
  ): Promise<IRenderBatchSession | undefined> {
    const port = batchOptions.port;
    context.localEnv.serverHostPort = port;

    const sm = new ServerManager(context.localEnv, context.creatorTools);
    sm.features = ServerManagerFeatures.all;
    const httpServer = sm.ensureHttpServer();
    let renderer: PlaywrightPageRenderer | undefined;
    try {
      await httpServer.waitForReady(30000);
      const baseUrl = `http://localhost:${port}`;
      renderer = new PlaywrightPageRenderer(baseUrl, { useHardwareGpu: batchOptions.gpu });
      const initialized = await renderer.initialize();
      if (!initialized) {
        context.log.error("Could not initialize headless renderer. Run: npx playwright install chromium");
        context.setExitCode(ErrorCodes.INIT_ERROR);
        await this.runCleanupStep(context, "close renderer", () => renderer!.close());
        httpServer.clearTempContent();
        await this.runCleanupStep(context, "stop render server", () => httpServer.stop("batch renderer init failed"));
        return undefined;
      }

      // Warm-up reduces flakiness on the first real render.
      await renderer.warmUp();
      return { httpServer, renderer };
    } catch (e: any) {
      context.log.error("Could not initialize batch renderer: " + (e?.message ?? String(e)));
      context.setExitCode(ErrorCodes.INIT_ERROR);
      if (renderer) {
        await this.runCleanupStep(context, "close renderer", () => renderer!.close());
      }
      httpServer.clearTempContent();
      await this.runCleanupStep(context, "stop render server", () => httpServer.stop("batch renderer init failed"));
      return undefined;
    }
  }

  private async renderResolvedBatch(
    context: ICommandContext,
    resolved: IResolvedBatchRender[],
    batchOptions: IRenderBatchOptions,
    session: IRenderBatchSession
  ): Promise<boolean> {
    const { httpServer, renderer } = session;
    let succeeded = 0;
    let failed = 0;

    for (const [index, item] of resolved.entries()) {
      const { entry, geometryJson, geometryId, textureData, textureMime } = item;
      const useVanilla = entry.vanilla ?? batchOptions.vanilla;
      const width = entry.width ?? batchOptions.width;
      const height = entry.height ?? batchOptions.height;
      const renderWaitMs = entry.renderWaitMs ?? batchOptions.renderWaitMs ?? (useVanilla ? 15000 : 5000);

      // Use a unique URL per entry so the renderer reloads fresh content.
      const geoUrl = `/temp/geometry-${index}.json`;
      const texUrl = textureData ? `/temp/texture-${index}.png` : undefined;

      httpServer.registerTempContent(geoUrl, geometryJson, "application/json");
      if (textureData && texUrl) {
        httpServer.registerTempContent(texUrl, textureData, textureMime);
      }

      try {
        let modelViewerUrl = `/?mode=modelviewer&geometry=${encodeURIComponent(geoUrl)}`;
        if (texUrl) {
          modelViewerUrl += `&texture=${encodeURIComponent(texUrl)}`;
        }
        if (useVanilla) {
          modelViewerUrl += `&skipVanilla=false&contentRoot=${encodeURIComponent("https://mctools.dev/")}`;
        } else {
          modelViewerUrl += `&skipVanilla=true`;
        }
        // Camera override allows callers to fix camera framing per entry.
        if (entry.cameraX !== undefined && entry.cameraY !== undefined && entry.cameraZ !== undefined) {
          modelViewerUrl += `&cameraX=${entry.cameraX}&cameraY=${entry.cameraY}&cameraZ=${entry.cameraZ}`;
        }
        modelViewerUrl += `&_batch=${index}`;

        const result = await renderer.renderModelFast(modelViewerUrl, {
          width,
          height,
          renderWaitTime: renderWaitMs,
          canvasTimeout: batchOptions.canvasTimeoutMs,
          forceReload: true,
        });

        if (result.error || !result.imageData) {
          failed += 1;
          context.log.error(`[${index + 1}/${resolved.length}] ${geometryId}: ${result.error ?? "no image data"}`);
          continue;
        }

        const absoluteOutputPath = path.isAbsolute(entry.outputPath)
          ? entry.outputPath
          : path.join(process.cwd(), entry.outputPath);
        if (context.dryRun) {
          context.log.info(`Dry run: would write rendered image to ${absoluteOutputPath}`);
        } else {
          const outputDir = path.dirname(absoluteOutputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          fs.writeFileSync(absoluteOutputPath, result.imageData);
          context.log.verbose(`[${index + 1}/${resolved.length}] Wrote ${absoluteOutputPath}`);
        }
        succeeded += 1;
      } finally {
        httpServer.unregisterTempContent(geoUrl);
        if (texUrl) {
          httpServer.unregisterTempContent(texUrl);
        }
      }
    }

    context.log.success(
      `Batch rendering complete: ${succeeded} succeeded, ${failed} failed (of ${resolved.length}).`
    );
    if (failed > 0) {
      context.setExitCode(ErrorCodes.INIT_ERROR);
    }
    return failed === 0;
  }

  private async stopRenderSession(context: ICommandContext, session: IRenderBatchSession): Promise<void> {
    await this.runCleanupStep(context, "reset renderer page", () => session.renderer.resetPersistentPage(), false);
    await this.runCleanupStep(context, "close renderer", () => session.renderer.close());
    session.httpServer.clearTempContent();
    await this.runCleanupStep(context, "stop render server", () => session.httpServer.stop("batch rendering complete"));
  }

  private readManifest(context: ICommandContext, manifestPath: string, allowEmpty = false): IBatchManifest | undefined {
    if (!manifestPath) {
      context.log.error("No manifest path specified.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }
    if (!fs.existsSync(manifestPath)) {
      context.log.error("Manifest file not found: " + manifestPath);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    let manifestJson: unknown;
    try {
      const raw = fs.readFileSync(manifestPath, "utf8");
      manifestJson = JSON.parse(raw);
    } catch (e: any) {
      context.log.error("Could not parse manifest JSON: " + (e?.message ?? String(e)));
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    return this.parseManifest(context, manifestJson, allowEmpty);
  }

  private parseManifest(
    context: ICommandContext,
    manifestJson: unknown,
    allowEmpty: boolean
  ): IBatchManifest | undefined {
    if (
      !manifestJson ||
      typeof manifestJson !== "object" ||
      !Array.isArray((manifestJson as { renders?: unknown }).renders)
    ) {
      context.log.error("Manifest must contain a `renders` array.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    if ((manifestJson as { renders: unknown[] }).renders.length === 0 && !allowEmpty) {
      context.log.error("Manifest must contain a non-empty `renders` array.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    const renders: IBatchManifestEntry[] = [];
    for (const [index, entryJson] of (manifestJson as { renders: unknown[] }).renders.entries()) {
      const entry = this.parseManifestEntry(context, entryJson, index);
      if (!entry) {
        return undefined;
      }
      renders.push(entry);
    }

    return { renders };
  }

  private parseManifestEntry(
    context: ICommandContext,
    entryJson: unknown,
    index: number
  ): IBatchManifestEntry | undefined {
    if (!entryJson || typeof entryJson !== "object" || Array.isArray(entryJson)) {
      context.log.error(`Manifest entry #${index} must be an object.`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    const entry = entryJson as Record<string, unknown>;
    const geometryPath = this.parseRequiredStringField(context, entry.geometryPath, `renders[${index}].geometryPath`);
    const outputPath = this.parseRequiredStringField(context, entry.outputPath, `renders[${index}].outputPath`);
    const width = this.parseOptionalManifestPositiveInteger(context, entry.width, `renders[${index}].width`);
    const height = this.parseOptionalManifestPositiveInteger(context, entry.height, `renders[${index}].height`);
    const renderWaitMs = this.parseOptionalManifestPositiveInteger(
      context,
      entry.renderWaitMs,
      `renders[${index}].renderWaitMs`
    );
    const vanilla = this.parseOptionalBooleanField(context, entry.vanilla, `renders[${index}].vanilla`);
    const camera = this.parseOptionalCameraFields(context, entry, index);

    if (
      geometryPath === undefined ||
      outputPath === undefined ||
      width === null ||
      height === null ||
      renderWaitMs === null ||
      vanilla === null ||
      camera === null
    ) {
      return undefined;
    }

    return {
      geometryPath,
      outputPath,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(renderWaitMs !== undefined ? { renderWaitMs } : {}),
      ...(vanilla !== undefined ? { vanilla } : {}),
      ...(camera !== undefined ? camera : {}),
    };
  }

  private parseRequiredStringField(
    context: ICommandContext,
    value: unknown,
    fieldName: string
  ): string | undefined {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }

    context.log.error(`${fieldName} must be a non-empty string.`);
    context.setExitCode(ErrorCodes.INIT_ERROR);
    return undefined;
  }

  private parseOptionalManifestPositiveInteger(
    context: ICommandContext,
    value: unknown,
    fieldName: string
  ): number | undefined | null {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
      return value;
    }

    context.log.error(`${fieldName} must be a positive integer.`);
    context.setExitCode(ErrorCodes.INIT_ERROR);
    return null;
  }

  private parseOptionalBooleanField(
    context: ICommandContext,
    value: unknown,
    fieldName: string
  ): boolean | undefined | null {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "boolean") {
      return value;
    }

    context.log.error(`${fieldName} must be a boolean.`);
    context.setExitCode(ErrorCodes.INIT_ERROR);
    return null;
  }

  private parseOptionalCameraFields(
    context: ICommandContext,
    entry: Record<string, unknown>,
    index: number
  ): { cameraX: number; cameraY: number; cameraZ: number } | undefined | null {
    const hasCameraValue =
      entry.cameraX !== undefined || entry.cameraY !== undefined || entry.cameraZ !== undefined;

    if (!hasCameraValue) {
      return undefined;
    }

    if (
      typeof entry.cameraX !== "number" ||
      typeof entry.cameraY !== "number" ||
      typeof entry.cameraZ !== "number" ||
      !Number.isFinite(entry.cameraX) ||
      !Number.isFinite(entry.cameraY) ||
      !Number.isFinite(entry.cameraZ)
    ) {
      context.log.error(
        `Manifest entry #${index} camera override must include finite numeric cameraX, cameraY, and cameraZ values.`
      );
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return null;
    }

    return {
      cameraX: entry.cameraX,
      cameraY: entry.cameraY,
      cameraZ: entry.cameraZ,
    };
  }

  private findGeometryItem(
    project: import("../../../app/Project").default,
    requestedPath: string
  ): ProjectItem | undefined {
    let normalized = requestedPath.replace(/\\/g, "/").toLowerCase();
    const projectRoot = (project.projectFolder?.fullPath || "").replace(/\\/g, "/").toLowerCase();
    if (projectRoot && normalized.startsWith(projectRoot)) {
      normalized = normalized.substring(projectRoot.length);
      if (normalized.startsWith("/")) normalized = normalized.substring(1);
    }
    for (const item of project.items) {
      if (!item.projectPath) continue;
      const itemPath = item.projectPath.toLowerCase();
      if (
        itemPath.endsWith(".json") &&
        (itemPath === normalized || itemPath.endsWith("/" + normalized) || itemPath.includes(normalized))
      ) {
        return item;
      }
    }
    return undefined;
  }

  private resolveBatchOptions(context: ICommandContext, defaultVanilla: boolean): IRenderBatchOptions | undefined {
    const options = (context.commandOptions ?? {}) as Record<string, unknown>;
    const portStart = this.parsePositiveIntegerOption(context, options.portStart, "--port-start");
    const portEnd = this.parsePositiveIntegerOption(context, options.portEnd, "--port-end");
    const width = this.parsePositiveIntegerOption(context, options.width, "--width");
    const height = this.parsePositiveIntegerOption(context, options.height, "--height");
    const canvasTimeoutMs = this.parsePositiveIntegerOption(context, options.canvasTimeoutMs, "--canvas-timeout-ms");
    const renderWaitMs = options.renderWaitMs !== undefined
      ? this.parsePositiveIntegerOption(context, options.renderWaitMs, "--render-wait-ms")
      : undefined;
    if (
      portStart === undefined ||
      portEnd === undefined ||
      width === undefined ||
      height === undefined ||
      canvasTimeoutMs === undefined ||
      (options.renderWaitMs !== undefined && renderWaitMs === undefined)
    ) {
      return undefined;
    }

    if (portStart > portEnd) {
      context.log.error("--port-start must be less than or equal to --port-end.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    if (portStart > 65535 || portEnd > 65535) {
      context.log.error("--port-start and --port-end must be valid TCP ports between 1 and 65535.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    if (!this.hasSafePortInRange(portStart, portEnd)) {
      context.log.error("--port-start and --port-end must include at least one browser-safe port.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    const explicitPort = options.port ? this.parsePositiveIntegerOption(context, options.port, "--port") : undefined;
    if (options.port && !explicitPort) {
      return undefined;
    }

    if (explicitPort && explicitPort > 65535) {
      context.log.error("--port must be a valid TCP port between 1 and 65535.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    if (explicitPort && UNSAFE_PORTS.has(explicitPort)) {
      context.log.error("--port must be a browser-safe port. This port is blocked by Chromium.");
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }

    return {
      port: explicitPort ?? LocalUtilities.getRandomSafePort(portStart, portEnd),
      width,
      height,
      renderWaitMs,
      canvasTimeoutMs,
      vanilla: defaultVanilla,
      gpu: options.gpu === true,
    };
  }

  private parsePositiveIntegerOption(
    context: ICommandContext,
    value: unknown,
    optionName: string
  ): number | undefined {
    let parsed: number;
    if (typeof value === "number") {
      parsed = value;
    } else {
      const textValue = String(value ?? "").trim();
      if (!/^[1-9]\d*$/.test(textValue)) {
        context.log.error(`${optionName} must be a positive integer.`);
        context.setExitCode(ErrorCodes.INIT_ERROR);
        return undefined;
      }
      parsed = Number(textValue);
    }

    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      context.log.error(`${optionName} must be a positive integer.`);
      context.setExitCode(ErrorCodes.INIT_ERROR);
      return undefined;
    }
    return parsed;
  }

  private hasSafePortInRange(startPort: number, endPort: number): boolean {
    for (let port = startPort; port <= endPort; port++) {
      if (!UNSAFE_PORTS.has(port)) {
        return true;
      }
    }

    return false;
  }

  private async runCleanupStep(
    context: ICommandContext,
    description: string,
    step: () => Promise<unknown>,
    setExitCodeOnFailure = true
  ): Promise<void> {
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanupPromise = step().catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      context.log.warn(`Could not ${description}: ${message}`);
      if (setExitCodeOnFailure) {
        context.setExitCode(ErrorCodes.INIT_ERROR);
      }
    });

    const didTimeout = await Promise.race([
      cleanupPromise.then(() => false),
      new Promise<boolean>((resolve) => {
        cleanupTimer = setTimeout(() => resolve(true), 20_000);
        cleanupTimer.unref?.();
      }),
    ]);

    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
    }

    if (didTimeout) {
      context.log.warn(`Timed out while trying to ${description}.`);
      if (setExitCodeOnFailure) {
        context.setExitCode(ErrorCodes.INIT_ERROR);
      }
    }
  }
}

export const renderBatchCommand = new RenderBatchCommand();
