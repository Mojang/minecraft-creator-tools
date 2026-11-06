/**
 * Fills the served vanilla texture maps (item_texture.json, terrain_texture.json) from the
 * release pack.
 *
 * Some preview drops of bedrock-samples ship sparse texture maps that list only the entries new
 * to that preview, even though the full set of PNGs is present. Served unchanged, every existing
 * item or block loses its texture lookup (for example, the recipe item catalog drops its sprites).
 * The merge keeps every release entry and lets preview entries win for shared keys.
 */
const fs = require("fs");
const path = require("path");

const TEXTURE_MAP_FILES = ["item_texture.json", "terrain_texture.json"];

function parseJsonWithLineComments(text) {
  return JSON.parse(text.replace(/^\s*\/\/[^\n]*\n/gm, ""));
}

function mergeTextureMap(release, preview) {
  if (!release || !release.texture_data) {
    return preview;
  }

  if (!preview || !preview.texture_data) {
    return release;
  }

  return {
    ...release,
    ...preview,
    texture_data: { ...release.texture_data, ...preview.texture_data },
  };
}

function mergeServeTextureMaps(releaseTexturesDir, serveTexturesDir) {
  for (const fileName of TEXTURE_MAP_FILES) {
    const releasePath = path.join(releaseTexturesDir, fileName);
    const servePath = path.join(serveTexturesDir, fileName);

    if (!fs.existsSync(releasePath) || !fs.existsSync(servePath)) {
      continue;
    }

    const release = parseJsonWithLineComments(fs.readFileSync(releasePath, "utf-8"));
    const preview = parseJsonWithLineComments(fs.readFileSync(servePath, "utf-8"));

    fs.writeFileSync(servePath, JSON.stringify(mergeTextureMap(release, preview), null, 2) + "\n");
  }
}

module.exports = { mergeTextureMap, mergeServeTextureMaps, TEXTURE_MAP_FILES };
