import { expect } from "chai";
import { createRequire } from "module";
import TestPaths from "./TestPaths";

const { mergeTextureMap } = createRequire(TestPaths.appRoot + "package.json")("./tools/mergeTextureMaps");

describe("mergeTextureMap", () => {
  it("keeps release entries when the preview map is sparse, with preview entries winning", () => {
    const release = {
      resource_pack_name: "vanilla",
      texture_name: "atlas.items",
      texture_data: {
        bucket: { textures: "textures/items/bucket_empty" },
        fishing_rod: { textures: "textures/items/fishing_rod_uncast" },
        apple: { textures: "textures/items/apple" },
      },
    };
    const preview = {
      resource_pack_name: "vanilla",
      texture_name: "atlas.items",
      texture_data: {
        icicle: { textures: "textures/items/icicle" },
        apple: { textures: "textures/items/apple_preview" },
      },
    };

    const merged = mergeTextureMap(release, preview);

    expect(merged.texture_name).to.equal("atlas.items");
    expect(merged.texture_data.bucket.textures).to.equal("textures/items/bucket_empty");
    expect(merged.texture_data.fishing_rod.textures).to.equal("textures/items/fishing_rod_uncast");
    expect(merged.texture_data.icicle.textures).to.equal("textures/items/icicle");
    expect(merged.texture_data.apple.textures).to.equal("textures/items/apple_preview");
  });
});
