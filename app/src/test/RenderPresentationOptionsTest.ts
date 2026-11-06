// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import { Command } from "commander";
import {
  configureRenderPresentationOptions,
  renderDimension,
  resolveRenderPresentationOptions,
  validateRenderDimensions,
  MAX_RENDER_CANVAS_SIDE,
  MAX_RENDER_EFFECTIVE_PIXELS,
} from "../cli/commands/render/RenderPresentationOptions";
import { RenderModelCommand } from "../cli/commands/render/RenderModelCommand";
import { RenderBatchCommand } from "../cli/commands/render/RenderBatchCommand";
import { RenderStructureCommand } from "../cli/commands/render/RenderStructureCommand";
import { RenderVanillaCommand } from "../cli/commands/render/RenderVanillaCommand";
import { renderAppearances, renderViews, renderPresentationUrl } from "../app/RenderPresentation";

describe("CLI render presentation contract", () => {
  for (const command of [
    new RenderModelCommand(),
    new RenderBatchCommand(),
    new RenderStructureCommand(),
    new RenderVanillaCommand(),
  ]) {
    it(`${command.metadata.name} selects the neutral environment and increased defaults`, () => {
      const parser = new Command();
      command.configure(parser);
      parser.parse(["node", "mct"]);
      const options = parser.opts();
      assert.equal(options.width, "1024");
      assert.equal(options.height, "1024");
      assert.equal(options.view, undefined, "implicit three-quarter must not look explicit");
      assert.deepEqual(resolveRenderPresentationOptions(options), {
        grid: true,
        skeleton: false,
        appearance: "textured",
        view: "three-quarter",
        allViews: false,
        environment: "neutral",
        timeOfDay: "noon",
      });
    });
  }

  for (const appearance of renderAppearances)
    for (const view of renderViews) {
      it(`accepts ${appearance} with ${view}`, () => {
        assert.equal(resolveRenderPresentationOptions({ appearance, view }).view, view);
      });
    }
  const camera = { cameraX: 8, cameraY: 3, cameraZ: -12 };
  const replacements = [
    { input: camera, view: undefined, allViews: false },
    { input: { view: "front" }, view: "front", allViews: false },
    { input: { allViews: true }, view: "three-quarter", allViews: true },
    { input: { allViews: false }, view: "three-quarter", allViews: false },
  ];
  for (const inherited of [{}, { view: "back" }, { allViews: true }])
    for (const replacement of replacements) {
      it(`replaces ${JSON.stringify(inherited)} with ${JSON.stringify(replacement.input)}`, () => {
        const result = resolveRenderPresentationOptions(replacement.input, resolveRenderPresentationOptions(inherited));
        assert.equal(result.view, replacement.view);
        assert.equal(result.allViews, replacement.allViews);
      });
    }
  for (const input of [
    { view: "front", allViews: true },
    { ...camera, view: "back" },
    { ...camera, allViews: true },
    { cameraX: 1 },
    { ...camera, cameraY: Infinity },
    { allViews: "false" },
    { appearance: "skeleton" },
    { appearance: null },
    { environment: null },
    { view: null },
    { timeOfDay: null },
    { grid: "false" },
    { grid: null },
    { skeleton: "true" },
    { skeleton: null },
    { view: "above" },
    { environment: "jungle" },
    { timeOfDay: "night" },
    { environment: "neutral", timeOfDay: "noon" },
  ]) {
    it(`rejects conflicting/unsupported ${JSON.stringify(input)}`, () => {
      assert.throws(() => resolveRenderPresentationOptions(input));
    });
  }
  it("rejects bones for content without named model bones", () => {
    assert.throws(
      () => resolveRenderPresentationOptions({ appearance: "bones" }, undefined, false),
      /named model bones/
    );
  });
  it("resets biome-only time when an entry chooses neutral", () => {
    const inherited = resolveRenderPresentationOptions({ environment: "desert", timeOfDay: "sunset" });
    assert.equal(resolveRenderPresentationOptions({ environment: "neutral" }, inherited).timeOfDay, "noon");
    assert.equal(resolveRenderPresentationOptions({ appearance: "clay" }, inherited).timeOfDay, "sunset");
    assert.throws(() => resolveRenderPresentationOptions({ environment: "neutral", timeOfDay: "night" }, inherited));
  });
  it("accepts all-views without an explicit view and validates before the action", () => {
    const command = new Command().exitOverride().configureOutput({ writeErr: () => {} });
    configureRenderPresentationOptions(command);
    let ran = false;
    command.action(() => {
      ran = true;
    });
    command.parse(["node", "mct", "--all-views"]);
    assert.isTrue(ran);
    ran = false;
    assert.throws(() => command.parse(["node", "mct", "--all-views", "--view", "front"]), /Choose only one/);
    assert.isFalse(ran);
  });
  it("preserves positive explicit rectangular dimensions", () => {
    for (const value of [1, 192, 256, 800, 1024, 4097]) assert.equal(renderDimension(String(value), "--width"), value);
    for (const value of [0, -1, 2.5, NaN, Infinity, "12px", ""]) assert.throws(() => renderDimension(value, "--width"));
  });
  it("rejects a sheet without room for an image, but preserves single-view one-pixel dimensions", () => {
    assert.doesNotThrow(() => validateRenderDimensions(resolveRenderPresentationOptions({}), 1, 1));
    assert.throws(
      () => validateRenderDimensions(resolveRenderPresentationOptions({ allViews: true }), 64, 1),
      /at least 2/
    );
    assert.doesNotThrow(() => validateRenderDimensions(resolveRenderPresentationOptions({ allViews: true }), 64, 2));
    const command = new Command().exitOverride().configureOutput({ writeErr: () => {} });
    configureRenderPresentationOptions(command);
    let ran = false;
    command.action(() => {
      ran = true;
    });
    assert.throws(() => command.parse(["node", "mct", "--all-views", "--height", "1"]), /at least 2/);
    assert.isFalse(ran);
  });
  for (const input of [
    {},
    { allViews: true },
    { appearance: "wireframe" },
    { appearance: "wireframe", allViews: true },
  ]) {
    it(`bounds scaled sides and combined pixel allocations for ${JSON.stringify(input)}`, () => {
      const options = resolveRenderPresentationOptions(input);
      const captureScale = options.appearance === "wireframe" ? 2 : 1;
      const outputScale = options.allViews ? 2 : 1;
      const maxSide = MAX_RENDER_CANVAS_SIDE / Math.max(captureScale, outputScale);
      const pixelFactor = 1 + captureScale ** 2 + outputScale ** 2;
      const maxHeight = Math.min(maxSide, Math.floor(MAX_RENDER_EFFECTIVE_PIXELS / (maxSide * pixelFactor)));
      assert.doesNotThrow(() => validateRenderDimensions(options, maxSide, maxHeight));
      assert.throws(() => validateRenderDimensions(options, maxSide + 1, maxHeight), /4096 pixels per side/);
      assert.throws(() => validateRenderDimensions(options, maxSide, maxHeight + 1));
      assert.doesNotThrow(() => validateRenderDimensions(options, 1920, 1080), "Presentation sizes remain supported");
      assert.throws(() => validateRenderDimensions(options, 20000, 20000), /Use smaller/);
    });
  }
  it("rejects a valid-side image whose combined area exceeds the budget", () => {
    assert.throws(
      () => validateRenderDimensions(resolveRenderPresentationOptions({}), 4096, 2731),
      /33,554,432-pixel budget/
    );
    assert.throws(
      () =>
        validateRenderDimensions(
          resolveRenderPresentationOptions({ appearance: "wireframe", allViews: true }),
          2048,
          1821
        ),
      /33,554,432-pixel budget/
    );
  });
  for (const renderer of [
    new RenderModelCommand(),
    new RenderBatchCommand(),
    new RenderStructureCommand(),
    new RenderVanillaCommand(),
  ]) {
    it(`${renderer.metadata.name} rejects oversized dimensions before its action`, () => {
      const command = new Command().exitOverride().configureOutput({ writeErr: () => {} });
      renderer.configure(command);
      let ran = false;
      command.action(() => {
        ran = true;
      });
      assert.throws(() => command.parse(["node", "mct", "--width", "20000", "--height", "20000"]), /4096/);
      assert.isFalse(ran);
    });
  }
  it("keeps the grid on by default and lets each entry override it", () => {
    assert.isTrue(resolveRenderPresentationOptions({}).grid);
    const defaults = resolveRenderPresentationOptions({ grid: false });
    assert.isFalse(resolveRenderPresentationOptions({}, defaults).grid);
    assert.isTrue(resolveRenderPresentationOptions({ grid: true }, defaults).grid);
    const command = new Command();
    configureRenderPresentationOptions(command);
    command.parse(["node", "mct", "--no-grid"]);
    assert.isFalse(resolveRenderPresentationOptions(command.opts()).grid);
  });
  it("keeps skeleton independent of appearance, grid and inherited camera choices", () => {
    const inherited = resolveRenderPresentationOptions({ skeleton: true, allViews: true, grid: false });
    const result = resolveRenderPresentationOptions({ skeleton: false, view: "front" }, inherited);
    assert.isFalse(result.skeleton);
    assert.equal(result.view, "front");
    assert.isFalse(result.grid);
    assert.isTrue(resolveRenderPresentationOptions({ appearance: "clay" }, inherited).skeleton);
    assert.throws(() => resolveRenderPresentationOptions({ skeleton: true }, undefined, false), /named model bones/);
    const command = new Command();
    configureRenderPresentationOptions(command);
    command.parse(["node", "mct", "--skeleton"]);
    assert.isTrue(resolveRenderPresentationOptions(command.opts()).skeleton);
  });
  it("gates presentation URLs without changing input selectors or camera coordinates", () => {
    const url = renderPresentationUrl(
      "/?mode=modelviewer&geometry=foo&cameraX=1&cameraY=2&cameraZ=3",
      resolveRenderPresentationOptions({})
    );
    assert.include(url, "&geometry=foo&cameraX=1&cameraY=2&cameraZ=3");
    assert.include(url, "&presentation=true&appearance=textured");
  });
});
