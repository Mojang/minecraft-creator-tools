import "../app/CreatorToolsHost";
import { expect } from "chai";
import Storage from "../storage/Storage";
import Database from "../minecraft/Database";
import VanillaProjectManager from "../minecraft/VanillaProjectManager";

function makeVanillaFolder(terrain: object, items: object) {
  const root = new Storage().rootFolder;
  const textures = root.ensureFolder("resource_pack").ensureFolder("textures");
  textures.ensureFile("terrain_texture.json").setContent(JSON.stringify({ texture_data: terrain }));
  textures.ensureFile("item_texture.json").setContent(JSON.stringify({ texture_data: items }));
  return root;
}

describe("vanilla texture catalogs", () => {
  const saved = {
    preview: Database.previewVanillaFolder,
    release: Database.releaseVanillaFolder,
    terrain: VanillaProjectManager.terrainTextureCatalog,
    item: VanillaProjectManager.itemTextureCatalog,
  };

  after(() => {
    Database.previewVanillaFolder = saved.preview;
    Database.releaseVanillaFolder = saved.release;
    VanillaProjectManager.terrainTextureCatalog = saved.terrain;
    VanillaProjectManager.itemTextureCatalog = saved.item;
  });

  it("fill sparse preview maps from release, with preview entries winning", async () => {
    Database.releaseVanillaFolder = makeVanillaFolder(
      { stone: { textures: "textures/blocks/stone" }, dirt: { textures: "textures/blocks/dirt" } },
      { apple: { textures: "textures/items/apple" } }
    );
    Database.previewVanillaFolder = makeVanillaFolder(
      { dirt: { textures: "textures/blocks/dirt_preview" }, icicle: { textures: "textures/blocks/icicle" } },
      { ice_ball: { textures: "textures/items/ice_ball" } }
    );
    VanillaProjectManager.terrainTextureCatalog = null;
    VanillaProjectManager.itemTextureCatalog = null;

    const terrain = (await VanillaProjectManager.getTerrainTexturesCatalog())?.textureData;
    const items = (await VanillaProjectManager.getItemTexturesCatalog())?.textureData;

    if (!terrain || !items) {
      throw new Error("Vanilla texture catalogs did not load");
    }

    expect(terrain.stone.textures).to.equal("textures/blocks/stone");
    expect(terrain.dirt.textures).to.equal("textures/blocks/dirt_preview");
    expect(terrain.icicle.textures).to.equal("textures/blocks/icicle");
    expect(items.apple.textures).to.equal("textures/items/apple");
    expect(items.ice_ball.textures).to.equal("textures/items/ice_ball");
  });
});
