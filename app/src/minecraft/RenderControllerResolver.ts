// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ARCHITECTURE: RenderControllerResolver
 *
 * Resolves a Minecraft render controller into concrete geometry IDs, texture paths,
 * and tint colors by evaluating Molang expressions against an entity context.
 *
 * Pipeline:
 *   IRenderController (from .render_controllers.json)
 *   + EntityTypeResourceDefinition (texture/geometry key maps)
 *   + IMolangContext (entity state: is_baby, variant, etc.)
 *   → IRenderResolvedState (concrete geometry ID, texture paths, tint)
 *
 * Reference resolution:
 *   "Texture.default" → look up "default" key in entity's textures map → "textures/entity/sheep/sheep"
 *   "Geometry.baby"   → look up "baby" key in entity's geometry map → "geometry.sheep.baby"
 *   "Array.geos[query.is_sheared]" → evaluate index, look up in render controller arrays
 *
 * Related files:
 * - MolangEvaluator.ts — expression evaluation engine
 * - IMolangContext.ts — entity state context
 * - IRenderControllerSet.ts — render controller data structures
 * - IRenderResolvedState.ts — output interface
 * - EntityTypeResourceDefinition.ts — entity texture/geometry key maps
 */

import { IRenderController, RenderControllerArrayLists } from "./IRenderControllerSet";
import IMolangContext from "./IMolangContext";
import IRenderResolvedState, { IRenderTextureLayer } from "./IRenderResolvedState";
import MolangEvaluator from "./MolangEvaluator";

export default class RenderControllerResolver {
  private _evaluator: MolangEvaluator;

  constructor() {
    this._evaluator = new MolangEvaluator();
  }

  /**
   * Resolve a render controller to concrete geometry/texture/material values.
   *
   * @param rc The render controller data from the .render_controllers.json file
   * @param textureMap Entity's texture key map: {"default": "textures/entity/sheep/sheep", "baby": "..."}
   * @param geometryMap Entity's geometry key map: {"default": "geometry.sheep.v1.8", "sheared": "..."}
   * @param context Molang evaluation context (entity state)
   * @returns Resolved geometry ID, texture layers, and optional tint
   */
  resolve(
    rc: IRenderController,
    textureMap: { [key: string]: string | undefined },
    geometryMap: { [key: string]: string | undefined },
    context: IMolangContext
  ): IRenderResolvedState {
    const arrays = this._buildArrayMap(rc.arrays);

    // Resolve geometry
    let geometryId: string | undefined;
    if (rc.geometry) {
      const geoRef = this._evaluator.evaluateString(rc.geometry, context, arrays);
      geometryId = this._resolveReference(geoRef, "Geometry", geometryMap);
    }

    // Resolve texture layers
    const textureLayers: IRenderTextureLayer[] = [];
    if (rc.textures) {
      for (const texExpr of rc.textures) {
        const texRef = this._evaluator.evaluateString(texExpr, context, arrays);
        const texPath = this._resolveReference(texRef, "Texture", textureMap);
        if (texPath) {
          textureLayers.push({ texturePath: texPath });
        }
      }
    }

    // If no layers resolved, try fallback to "default" texture
    if (textureLayers.length === 0 && textureMap["default"]) {
      textureLayers.push({ texturePath: textureMap["default"] });
    }

    return {
      geometryId,
      textureLayers,
    };
  }

  /**
   * Resolve a reference like "Texture.default" or "Geometry.baby" to the actual
   * path/ID using the entity's key maps.
   */
  private _resolveReference(
    ref: string,
    prefix: string,
    keyMap: { [key: string]: string | undefined }
  ): string | undefined {
    if (!ref) return undefined;

    // Check if it's a prefixed reference: "Texture.default" → key "default"
    const prefixDot = prefix + ".";
    if (ref.startsWith(prefixDot)) {
      const key = ref.substring(prefixDot.length);
      return keyMap[key] ?? keyMap["default"];
    }

    // Check case-insensitive prefix match
    const lowerRef = ref.toLowerCase();
    const lowerPrefix = prefix.toLowerCase() + ".";
    if (lowerRef.startsWith(lowerPrefix)) {
      const key = ref.substring(lowerPrefix.length);
      return keyMap[key] ?? keyMap["default"];
    }

    // It might already be a direct path (e.g., "textures/entity/sheep/sheep")
    if (ref.includes("/")) {
      return ref;
    }

    // Try as a key directly
    if (keyMap[ref]) {
      return keyMap[ref];
    }

    return keyMap["default"];
  }

  /**
   * Build a flat Map<string, string[]> from the render controller's nested array definitions.
   * Converts: { textures: { "Array.skins": ["Texture.a", "Texture.b"] }, geometries: {...} }
   * To: Map { "Array.skins" → ["Texture.a", "Texture.b"], "Array.geos" → [...] }
   */
  private _buildArrayMap(arrays: RenderControllerArrayLists | undefined): Map<string, string[]> | undefined {
    if (!arrays) return undefined;

    const map = new Map<string, string[]>();

    for (const category of ["textures", "geometries", "materials"] as const) {
      const categoryArrays = arrays[category];
      if (categoryArrays) {
        for (const arrayName in categoryArrays) {
          const entries = categoryArrays[arrayName];
          if (entries) {
            map.set(arrayName, entries);
          }
        }
      }
    }

    return map.size > 0 ? map : undefined;
  }
}
