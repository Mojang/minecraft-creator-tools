import { expect } from "chai";
import { RenderVanillaCommand } from "../cli/commands/render/RenderVanillaCommand";

describe("RenderVanillaCommand filename derivation", () => {
  it("sanitizes Windows-invalid characters in derived names", () => {
    const fileName = RenderVanillaCommand.buildDerivedOutputFileName("block", "minecraft:stone");

    expect(fileName).to.equal("block-minecraft-stone.png");
  });

  it("sanitizes path separator characters", () => {
    const fileName = RenderVanillaCommand.buildDerivedOutputFileName("mob", "namespace/has\\slashes");

    expect(fileName).to.equal("mob-namespace-has-slashes.png");
  });

  it("retains batch underscore-to-hyphen behavior", () => {
    const fileName = RenderVanillaCommand.buildDerivedOutputFileName("item", "diamond_chestplate", true);

    expect(fileName).to.equal("item-diamond-chestplate.png");
  });

  it("falls back to a safe placeholder when identifier sanitizes to empty", () => {
    const fileName = RenderVanillaCommand.buildDerivedOutputFileName("block", ":::***");

    expect(fileName).to.equal("block-unnamed.png");
  });
});
