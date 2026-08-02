import { expect } from "chai";
import ModelService from "./ModelService";

describe("ModelService", () => {
  it("updates the geometry identifier", () => {
    const modelService = new ModelService();

    const result = modelService.getUnitCubeGeometry("minecraft:custom_block");

    expect(result["minecraft:geometry"][0].description.identifier).to.equal("minecraft:custom_block");
  });

  it("has correct uvs for unit cube", () => {
    const modelService = new ModelService();

    const result = modelService.getUnitCubeGeometry("minecraft:custom_block");

    expect(result["minecraft:geometry"][0].bones[0].cubes[0].uv).to.deep.equal({
      north: { uv: [0, 0], uv_size: [16, 16] },
      east: { uv: [0, 0], uv_size: [16, 16] },
      south: { uv: [0, 0], uv_size: [16, 16] },
      west: { uv: [0, 0], uv_size: [16, 16] },
      up: { uv: [0, 0], uv_size: [16, 16] },
      down: { uv: [0, 0], uv_size: [16, 16] },
    });
  });
});
