// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Shared CLI/browser contract. Absence of this config preserves interactive and MCP rendering. */
export const renderAppearances = ["textured", "clay", "wireframe", "bones"] as const;
export type RenderAppearance = (typeof renderAppearances)[number];
export const renderViews = ["three-quarter", "front", "side", "back"] as const;
export type RenderView = (typeof renderViews)[number];
export const renderEnvironments = ["neutral", "plains", "desert", "snowy"] as const;
export const renderTimes = ["noon", "sunset", "night"] as const;

export interface RenderPresentationOptions {
  grid: boolean;
  skeleton: boolean;
  appearance: RenderAppearance;
  view?: RenderView;
  allViews: boolean;
  environment: (typeof renderEnvironments)[number];
  timeOfDay: (typeof renderTimes)[number];
}

export interface SkeletonJoint {
  name: string;
  parent?: string;
  position: [number, number, number];
}

export interface ProjectedJoint {
  name: string;
  parent?: string;
  x: number;
  y: number;
}

export interface RenderCapture {
  capture(view: RenderView | undefined, width: number, height: number): string;
  describe(): {
    min: number[];
    max: number[];
    camera: number[];
    orthoTop: number | null;
    joints?: ProjectedJoint[][];
  };
  release(): void;
}

declare global {
  interface Window {
    mctPresentation?: RenderCapture;
    mctPresentationError?: string;
  }
}

export function renderPresentationUrl(modelPath: string, options: RenderPresentationOptions): string {
  const params = new URLSearchParams({
    presentation: "true",
    appearance: options.appearance,
    environment: options.environment,
    timeOfDay: options.timeOfDay,
    grid: String(options.grid),
    skeleton: String(options.skeleton),
  });
  return `${modelPath}&${params}`;
}

export function renderPresentationFromUrl(): RenderPresentationOptions | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  if (params.get("presentation") !== "true") return undefined;
  return {
    grid: choice(params.get("grid") ?? "true", ["true", "false"], "grid") === "true",
    skeleton: choice(params.get("skeleton") ?? "false", ["true", "false"], "skeleton") === "true",
    appearance: choice(params.get("appearance") ?? "textured", renderAppearances, "appearance"),
    environment: choice(params.get("environment") ?? "neutral", renderEnvironments, "environment"),
    timeOfDay: choice(params.get("timeOfDay") ?? "noon", renderTimes, "timeOfDay"),
    allViews: false,
  };
}

export function choice<T extends string>(value: unknown, choices: readonly T[], name: string): T {
  const match = choices.find((entry) => entry === value);
  if (match === undefined) throw new Error(`${name} must be one of: ${choices.join(", ")}.`);
  return match;
}
