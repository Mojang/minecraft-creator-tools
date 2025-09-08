import Database from "../Database";
import { SkinModelTarget as SkinTarget } from "../skins/Skin";
import TextureDefinition, { ImageCoords } from "../TextureDefinition";
import {
  Head,
  RightArmCustom,
  LeftArmCustom,
  LeftLeg,
  RightLeg,
  RightArmSlim,
  LeftArmSlim,
  LeftArmCustomDifference,
  RightArmCustomDifference,
} from "./ModelSegments";

interface TextureSizeData {
  name: string;
  allowedTextures: TextureDefinition | undefined;
  allowedTexturesHighRes: TextureDefinition | undefined;
  geometryName: string;
  segments: readonly ModelSegment[];
}

export type ModelSegment = {
  name: string;
  parts: {
    top: ImageCoords;
    front: ImageCoords;
    left: ImageCoords;
    right: ImageCoords;
    bottom: ImageCoords;
    back: ImageCoords;
  };
};

// Generally, steve == custom and alex == customSlim
const CustomSlimGeometryTags = new Set<string>(["a", "alex", "slim", "customslim"]);
const CustomGeometryTags = new Set<string>(["s", "steve", "custom"]);

export default class TextureUtilities {
  private static _custom: TextureSizeData = {
    name: "custom",
    allowedTextures: undefined,
    allowedTexturesHighRes: undefined,
    geometryName: "geometry.humanoid.custom",
    segments: [Head, RightArmCustom, LeftArmCustom, LeftLeg, RightLeg],
  };

  private static _customSlim: TextureSizeData = {
    name: "customSlim",
    allowedTextures: undefined,
    allowedTexturesHighRes: undefined,
    geometryName: "geometry.humanoid.customSlim",
    segments: [Head, RightArmSlim, LeftArmSlim, LeftLeg, RightLeg],
  };

  private static _isLoaded = false;

  static getBySize(size: SkinTarget): TextureSizeData {
    switch (size) {
      case SkinTarget.Custom:
        return this._custom;
      case SkinTarget.CustomSlim:
        return this._customSlim;
      default:
        throw new Error(`Unknown skin size: ${size}`);
    }
  }

  static async getTextureDefinititionForContent(filePath: string) {
    const contentFile = await Database.getContentFolderFile(filePath);

    if (!contentFile) {
      return undefined;
    }

    if (!contentFile.isContentLoaded) {
      await contentFile.loadContent();
    }

    if (!(contentFile.content instanceof Uint8Array)) {
      return undefined;
    }

    let textDef = await TextureDefinition.ensureOnFile(contentFile);

    if (!textDef) {
      return undefined;
    }

    if (!textDef.isContentProcessed) {
      await textDef.processContent();
    }

    return textDef;
  }

  static async load() {
    if (this._isLoaded) {
      return;
    }

    this._custom.allowedTextures = await TextureUtilities.getTextureDefinititionForContent(
      "textures/Custom_AllowedPixels_64.png"
    );
    this._custom.allowedTexturesHighRes = await TextureUtilities.getTextureDefinititionForContent(
      "textures/Custom_AllowedPixels_128.png"
    );

    this._customSlim.allowedTextures = await TextureUtilities.getTextureDefinititionForContent(
      "textures/CustomSlim_AllowedPixels_64.png"
    );

    this._customSlim.allowedTexturesHighRes = await TextureUtilities.getTextureDefinititionForContent(
      "textures/CustomSlim_AllowedPixels_128.png"
    );

    this._isLoaded = true;
  }
}

export function isRegionVisible(texture: TextureDefinition, area: ImageCoords) {
  const multiplier = isHighResolutionSkinPackTexture(texture) ? 2 : 1;
  const maxX = Math.floor(area.x2) * multiplier;
  const maxY = Math.floor(area.y2) * multiplier;

  if (texture.imageData) {
    for (let x = area.x1 * multiplier; x <= maxX; x++) {
      for (let y = area.y1 * multiplier; y <= maxY; y++) {
        if (texture.getPixel(x, y).a !== 0) {
          return true;
        }
      }
    }
  }

  return false;
}

export function getSkinTargetByUniquePixelLocations(texture: TextureDefinition) {
  const hasCustomSkinPixels =
    isRegionVisible(texture, RightArmCustomDifference) || isRegionVisible(texture, LeftArmCustomDifference);

  return hasCustomSkinPixels ? SkinTarget.Custom : SkinTarget.CustomSlim;
}

export function getSkinTargetFromName(textureName: string): SkinTarget | undefined {
  const tokens = textureName.split(/[._]/);
  if (tokens.length > 2) {
    const prefix = tokens[0]?.toLowerCase();
    const suffix = tokens[tokens.length - 2]?.toLowerCase();

    if (CustomGeometryTags.has(prefix) || CustomGeometryTags.has(suffix)) {
      return SkinTarget.Custom;
    }

    if (CustomSlimGeometryTags.has(prefix) || CustomSlimGeometryTags.has(suffix)) {
      return SkinTarget.CustomSlim;
    }
  }
  return undefined;
}

export function isHighResolutionSkinPackTexture(textureDefinition: TextureDefinition) {
  return textureDefinition.width === 128;
}

export async function isOuterAreaIsBlank(texture: TextureDefinition, size: SkinTarget) {
  await TextureUtilities.load();

  if (texture.width === undefined || texture.height === undefined) {
    throw new Error("Texture width or height is undefined");
  }

  const allowedAlphaMask = isHighResolutionSkinPackTexture(texture)
    ? TextureUtilities.getBySize(size).allowedTexturesHighRes
    : TextureUtilities.getBySize(size).allowedTextures;

  if (!allowedAlphaMask) {
    throw new Error("Could not find reference for texture");
  }

  if (texture.imageData) {
    for (let x = 0; x < texture.width; ++x) {
      for (let y = 0; y < texture.height; ++y) {
        const texIsVisibleInDisallowedSpot = allowedAlphaMask.getPixel(x, y).a === 0 && texture.getPixel(x, y).a > 0;
        if (texIsVisibleInDisallowedSpot) {
          return false;
        }
      }
    }
  }

  return true;
}

export function getSegmentsVisibilities(texture: TextureDefinition, size: SkinTarget) {
  const values = TextureUtilities.getBySize(size);

  return values.segments.map((segment) => checkTextureVisibilityForSegment(texture, segment));
}

function checkTextureVisibilityForSegment(texture: TextureDefinition, segment: ModelSegment) {
  return {
    segmentName: segment.name,
    visibilities: {
      top: isRegionVisible(texture, segment.parts.top),
      front: isRegionVisible(texture, segment.parts.front),
      left: isRegionVisible(texture, segment.parts.left),
      right: isRegionVisible(texture, segment.parts.right),
      bottom: isRegionVisible(texture, segment.parts.bottom),
      back: isRegionVisible(texture, segment.parts.back),
    },
  };
}
