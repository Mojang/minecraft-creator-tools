// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ItemTextureTemplates - Template-based item texture generation.
 *
 * Stores 16x16 shape masks for each item type (sword, helmet, etc.) extracted
 * from the custom_items sample pack. Each pixel is encoded as a shade level:
 *   0 = transparent
 *   1 = dark (shadow)
 *   2 = mid (base color)
 *   3 = light (highlight)
 *
 * The recolor function applies a user-chosen color, producing darker/lighter
 * variants for depth, then encodes the result as RGBA pixels.
 */

import ImageCodec from "../core/ImageCodec";
import { parseHex } from "./PngEncoder";

/**
 * 16x16 shape masks. Each string is 16 rows of 16 chars.
 * Chars: '0'=transparent, '1'=dark, '2'=mid, '3'=highlight
 */
const TEMPLATES: Record<string, string> = {
  sword:
    "0000000000000111" +
    "0000000000001331" +
    "0000000000013231" +
    "0000000000132310" +
    "0000000001322100" +
    "0000000013221000" +
    "0011000122210000" +
    "0011101222100000" +
    "0001112121000000" +
    "0001111210000000" +
    "0000111100000000" +
    "0001111110000000" +
    "0012101111000000" +
    "1111000011000000" +
    "1110000000000000" +
    "1110000000000000",

  tool:
    "0000000000000000" +
    "0000000002300000" +
    "0000000023300000" +
    "0000000233000000" +
    "0000000230000000" +
    "0000000213000330" +
    "0000000231203320" +
    "0000000222133200" +
    "0000002222222000" +
    "0000022200000000" +
    "0000232000000000" +
    "0002320000000000" +
    "0023200000000000" +
    "0232000000000000" +
    "2220000000000000" +
    "2200000000000000",

  helmet:
    "0000000000000000" +
    "0000000000000000" +
    "0000000000000000" +
    "0000011111100000" +
    "0000122222210000" +
    "0001233322221000" +
    "0001233222221000" +
    "0001221111221000" +
    "0001211111121000" +
    "0001211111121000" +
    "0001211111121000" +
    "0000110000110000" +
    "0000000000000000" +
    "0000000000000000" +
    "0000000000000000" +
    "0000000000000000",

  chestplate:
    "0000000000000000" +
    "0000000000000000" +
    "0111110000111110" +
    "0133210000133210" +
    "0132221001232210" +
    "0122232112222210" +
    "0122233332222210" +
    "0112333222222110" +
    "0001332222221000" +
    "0001232222221000" +
    "0001222222221000" +
    "0001222222221000" +
    "0001222222221000" +
    "0000122222210000" +
    "0000011111100000" +
    "0000000000000000",

  leggings:
    "0000000000000000" +
    "0000000000000000" +
    "0000111111110000" +
    "0001333332221000" +
    "0001332222221000" +
    "0001322222221000" +
    "0001322112221000" +
    "0001221001221000" +
    "0001221001221000" +
    "0001221001221000" +
    "0001221001221000" +
    "0001221001221000" +
    "0001221001221000" +
    "0001111001111000" +
    "0000000000000000" +
    "0000000000000000",

  boots:
    "0000000000000000" +
    "0000000000000000" +
    "0000000000000000" +
    "0000111001110000" +
    "0001331001331000" +
    "0001331001321000" +
    "0001321001221000" +
    "0001221001221000" +
    "0001221001221000" +
    "0012221001222100" +
    "0122221001222210" +
    "0122211001122210" +
    "0111100000011110" +
    "0000000000000000" +
    "0000000000000000" +
    "0000000000000000",

  food:
    "0000002200000000" +
    "0000023320000000" +
    "0000232232220000" +
    "0002232332332000" +
    "0023323323223200" +
    "0232232223233200" +
    "0232232222332200" +
    "0223322223222000" +
    "0022222223233200" +
    "0002332332322200" +
    "0023223222322200" +
    "0023223233232000" +
    "0002332322320000" +
    "0000222322200000" +
    "0000000220000000" +
    "0000000000000000",
};

/** Map item trait IDs to template names */
const TRAIT_TO_TEMPLATE: Record<string, string> = {
  sword: "sword",
  pickaxe: "tool",
  axe: "tool",
  shovel: "tool",
  armor_helmet: "helmet",
  armor_chestplate: "chestplate",
  armor_leggings: "leggings",
  armor_boots: "boots",
  food: "food",
};

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Generate a recolored 16x16 RGBA pixel array from a template and a hex color.
 *
 * Shade levels map to color multipliers:
 *   1 (dark)      = color * 0.45
 *   2 (mid/base)  = color * 0.75
 *   3 (highlight) = color * 1.0 + 40 brightness boost
 */
export function recolorTemplate(
  templateName: string,
  hexColor: string
): { pixels: Uint8Array; width: number; height: number } | undefined {
  const template = TEMPLATES[templateName];
  if (!template || template.length !== 256) {
    return undefined;
  }

  const { r, g, b } = parseHex(hexColor);
  const pixels = new Uint8Array(16 * 16 * 4);

  for (let i = 0; i < 256; i++) {
    const shade = template.charCodeAt(i) - 48; // '0'=0, '1'=1, '2'=2, '3'=3
    const idx = i * 4;

    if (shade === 0) {
      // Transparent
      pixels[idx] = 0;
      pixels[idx + 1] = 0;
      pixels[idx + 2] = 0;
      pixels[idx + 3] = 0;
    } else if (shade === 1) {
      // Dark shadow
      pixels[idx] = clamp(r * 0.45);
      pixels[idx + 1] = clamp(g * 0.45);
      pixels[idx + 2] = clamp(b * 0.45);
      pixels[idx + 3] = 255;
    } else if (shade === 2) {
      // Mid tone (base)
      pixels[idx] = clamp(r * 0.75);
      pixels[idx + 1] = clamp(g * 0.75);
      pixels[idx + 2] = clamp(b * 0.75);
      pixels[idx + 3] = 255;
    } else {
      // Highlight
      pixels[idx] = clamp(r + 40);
      pixels[idx + 1] = clamp(g + 40);
      pixels[idx + 2] = clamp(b + 40);
      pixels[idx + 3] = 255;
    }
  }

  return { pixels, width: 16, height: 16 };
}

/**
 * Get the template name for an item based on its traits.
 * Returns undefined if no matching template exists.
 */
export function getTemplateForTraits(traits: string[]): string | undefined {
  if (!traits) return undefined;

  for (const traitId of traits) {
    const template = TRAIT_TO_TEMPLATE[traitId];
    if (template) {
      return template;
    }
  }

  return undefined;
}

/**
 * Generate a recolored item texture PNG from traits and a color.
 * Returns PNG bytes, or undefined if no template matches or encoding fails.
 */
export async function generateItemTextureFromTemplate(
  traits: string[],
  hexColor: string
): Promise<Uint8Array | undefined> {
  const templateName = getTemplateForTraits(traits);
  if (!templateName) {
    return undefined;
  }

  const result = recolorTemplate(templateName, hexColor);
  if (!result) {
    return undefined;
  }

  // Try sync encoding (Node.js)
  const syncEncoded = ImageCodec.encodeToPngSync(result.pixels, result.width, result.height);
  if (syncEncoded) {
    return syncEncoded;
  }

  // Try async browser encoding (Canvas API)
  const browserEncoded = await ImageCodec.encodeToPngBrowser(result.pixels, result.width, result.height);
  if (browserEncoded) {
    return browserEncoded;
  }

  return undefined;
}
