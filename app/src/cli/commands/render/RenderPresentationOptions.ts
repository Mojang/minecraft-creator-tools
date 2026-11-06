// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Command, Option } from "commander";
import {
  choice,
  renderAppearances,
  renderEnvironments,
  renderTimes,
  renderViews,
  RenderPresentationOptions,
} from "../../../app/RenderPresentation";
import { ICommandContext, ErrorCodes } from "../../core/ICommandContext";

// Cap both dimensions and combined viewport/capture/output area. This is an
// allocation guard, not a guarantee about total GPU/process memory consumption.
export const MAX_RENDER_CANVAS_SIDE = 4096;
export const MAX_RENDER_EFFECTIVE_PIXELS = 32 * 1024 * 1024;

/** Camera overrides replace the whole inherited camera selection, not individual fields. */
export function resolveRenderPresentationOptions(
  input: Record<string, unknown>,
  inherited?: RenderPresentationOptions,
  supportsBones = true
): RenderPresentationOptions {
  const camera = ["cameraX", "cameraY", "cameraZ"].some((key) => input[key] !== undefined);
  const explicitView = input.view !== undefined;
  const explicitSheet = input.allViews !== undefined;
  if (input.grid !== undefined && typeof input.grid !== "boolean") throw new Error("grid must be a boolean.");
  if (input.skeleton !== undefined && typeof input.skeleton !== "boolean")
    throw new Error("skeleton must be a boolean.");
  const skeleton = input.skeleton !== undefined ? input.skeleton : (inherited?.skeleton ?? false);
  if (explicitSheet && typeof input.allViews !== "boolean") throw new Error("allViews must be a boolean.");
  if (
    camera &&
    !["cameraX", "cameraY", "cameraZ"].every((key) => typeof input[key] === "number" && Number.isFinite(input[key]))
  ) {
    throw new Error("Supply finite numeric cameraX, cameraY, and cameraZ together.");
  }
  if ((camera && (explicitView || input.allViews === true)) || (explicitView && input.allViews === true)) {
    throw new Error("Choose only one camera: --view (view), --all-views (allViews), or cameraX/cameraY/cameraZ.");
  }
  const appearance = choice(
    input.appearance !== undefined ? input.appearance : (inherited?.appearance ?? "textured"),
    renderAppearances,
    "--appearance"
  );
  if ((appearance === "bones" || skeleton) && !supportsBones) {
    throw new Error(
      "--appearance bones and --skeleton require named model bones; use other appearances without --skeleton for blocks and structures."
    );
  }
  const environment = choice(
    input.environment !== undefined ? input.environment : (inherited?.environment ?? "neutral"),
    renderEnvironments,
    "--environment"
  );
  const timeOfDay = choice(
    input.timeOfDay !== undefined ? input.timeOfDay : (inherited?.timeOfDay ?? "noon"),
    renderTimes,
    "--time-of-day"
  );
  if (environment === "neutral" && input.timeOfDay !== undefined) {
    throw new Error("--time-of-day requires --environment plains, desert, or snowy; neutral uses white light.");
  }
  const replacesCamera = camera || explicitView || explicitSheet;
  return {
    grid: input.grid !== undefined ? input.grid : (inherited?.grid ?? true),
    skeleton,
    appearance,
    environment,
    timeOfDay: environment === "neutral" ? "noon" : timeOfDay,
    allViews: replacesCamera ? input.allViews === true : (inherited?.allViews ?? false),
    view: camera
      ? undefined
      : choice(
          explicitView ? input.view : ((!replacesCamera ? inherited?.view : undefined) ?? "three-quarter"),
          renderViews,
          "--view"
        ),
  };
}

export function renderDimension(value: unknown, name: string): number {
  const number = typeof value === "number" ? value : Number(value);
  if ((typeof value === "string" && !/^[1-9]\d*$/.test(value.trim())) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer in pixels per view.`);
  }
  return number;
}

export function validateRenderDimensions(presentation: RenderPresentationOptions, width: number, height: number): void {
  if (presentation.allViews && height < 2) {
    throw new Error("--all-views (allViews) requires a per-view height of at least 2 pixels for a label and image.");
  }
  const captureScale = presentation.appearance === "wireframe" ? 2 : 1;
  const outputScale = presentation.allViews ? 2 : 1;
  const largestScale = Math.max(captureScale, outputScale);
  if (width > MAX_RENDER_CANVAS_SIDE / largestScale || height > MAX_RENDER_CANVAS_SIDE / largestScale) {
    throw new Error(
      `The requested capture is ${width * captureScale}x${height * captureScale} and output is ${width * outputScale}x${height * outputScale}; ` +
        `each render canvas is limited to ${MAX_RENDER_CANVAS_SIDE} pixels per side. ` +
        `Use smaller --width and --height values (at most ${MAX_RENDER_CANVAS_SIDE / largestScale} per view for these options), ` +
        "or omit --all-views or choose an appearance other than wireframe."
    );
  }
  const effectivePixels = width * height * (1 + captureScale ** 2 + outputScale ** 2);
  if (effectivePixels > MAX_RENDER_EFFECTIVE_PIXELS) {
    throw new Error(
      `The render needs ${effectivePixels.toLocaleString("en-US")} pixels for viewport, capture, and output combined; ` +
        `this exceeds the ${MAX_RENDER_EFFECTIVE_PIXELS.toLocaleString("en-US")}-pixel budget. ` +
        "Use smaller --width and --height values, omit --all-views, or choose an appearance other than wireframe."
    );
  }
}

export function configureRenderPresentationOptions(cmd: Command, supportsBones = true, vanilla = false): void {
  cmd
    .addOption(
      new Option("--appearance <mode>", "Choose how to show the model")
        .choices([...renderAppearances])
        .default("textured")
    )
    .addOption(new Option("--view <view>", "Choose a camera view (default: three-quarter)").choices([...renderViews]))
    .option("--all-views", "Combine three-quarter, front, side, and back in one labeled 2x2 image")
    .option("--no-grid", "Hide the ground grid while keeping the ground plane and shadows")
    .option("--skeleton", "Overlay bone pivots and their parent connections on named model geometry")
    .addOption(
      new Option("--environment <preset>", "Choose neutral or biome-inspired lighting, sky, and ground")
        .choices([...renderEnvironments])
        .default("neutral")
    )
    .addOption(
      new Option("--time-of-day <time>", "Choose the time for a biome environment (default: noon)").choices([
        ...renderTimes,
      ])
    )
    .option("--width <pixels>", "Set each view's width in pixels; a four-view sheet is twice as wide", "1024")
    .option(
      "--height <pixels>",
      "Set each view's height in pixels, including sheet labels; scaled canvases are limited to 4096 pixels per side and 32 Mi pixels combined",
      "1024"
    );
  cmd.hook("preAction", (_hook, action) => {
    try {
      const presentation = resolveRenderPresentationOptions(
        action.opts(),
        undefined,
        supportsBones && (!vanilla || action.args[0]?.toLowerCase() !== "block")
      );
      validateRenderDimensions(
        presentation,
        renderDimension(action.opts().width, "--width"),
        renderDimension(action.opts().height, "--height")
      );
    } catch (error) {
      action.error(`error: ${error instanceof Error ? error.message : String(error)}`, {
        exitCode: ErrorCodes.INIT_ERROR,
      });
    }
  });
}

export function getRenderPresentationOptions(
  context: ICommandContext,
  supportsBones = true
): RenderPresentationOptions | undefined {
  try {
    const options = context.commandOptions ?? {};
    const presentation = resolveRenderPresentationOptions(options, undefined, supportsBones);
    validateRenderDimensions(
      presentation,
      renderDimension(options.width ?? 1024, "--width"),
      renderDimension(options.height ?? 1024, "--height")
    );
    return presentation;
  } catch (error) {
    context.log.error(error instanceof Error ? error.message : String(error));
    context.setExitCode(ErrorCodes.INIT_ERROR);
    return undefined;
  }
}
