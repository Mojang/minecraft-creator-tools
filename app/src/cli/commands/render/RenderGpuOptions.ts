// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Command } from "commander";
import type { PlaywrightPageRendererOptions } from "../../../local/PlaywrightPageRenderer";

export function configureRenderGpuOptions(command: Command): void {
  command
    .option("--gpu", "Prefer hardware GPU rendering instead of SwiftShader software WebGL")
    .option("--no-gpu", "Use software WebGL and skip hardware detection, for repeatable images");
}

/** Only CLI rendering opts into detection. Explicit booleans keep their previous meaning. */
export function getRenderGpuOptions(options: Record<string, unknown> = {}): PlaywrightPageRendererOptions {
  return { useHardwareGpu: typeof options.gpu === "boolean" ? options.gpu : "auto" };
}
