import { SkinModelTarget as SkinTarget } from "../skins/Skin";
import FileTexture from "./FileTexture";
import { ImageArea, ITexture } from "./ITexture";
import {
  Head,
  RightArmCustom,
  LeftArmCustom,
  LeftLeg,
  RightLeg,
  RightArmSlim,
  LeftArmSlim,
  LeftArmSide,
  LeftArmSideLayer2,
  LeftShoulder,
  LeftShoulderLayer2,
  RightArmSide,
  RightArmSideLayer2,
  RightShoulder,
  RightShoulderLayer2,
} from "./ModelSegments";

interface TextureSizeData {
  name: string;
  allowedTextures: ITexture | undefined;
  allowedTexturesHighRes: ITexture | undefined;
  geometryName: string;
  segments: readonly ModelSegment[];
}

export type ModelSegment = {
  name: string;
  parts: { top: ImageArea; front: ImageArea; left: ImageArea; right: ImageArea; bottom: ImageArea; back: ImageArea };
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

  static async load() {
    if (this._isLoaded) {
      return;
    }

    this._custom.allowedTextures = await FileTexture.readTextureFromLocalPath("textures/Custom_AllowedPixels_64.png");
    this._custom.allowedTexturesHighRes = await FileTexture.readTextureFromLocalPath(
      "textures/Custom_AllowedPixels_128.png"
    );

    this._customSlim.allowedTextures = await FileTexture.readTextureFromLocalPath(
      "textures/CustomSlim_AllowedPixels_64.png"
    );

    this._customSlim.allowedTexturesHighRes = await FileTexture.readTextureFromLocalPath(
      "textures/CustomSlim_AllowedPixels_128.png"
    );

    this._isLoaded = true;
  }
}
export function isRegionVisible(texture: ITexture, area: ImageArea) {
  const multiplier = texture.isHighResolution() ? 2 : 1;
  const maxX = Math.floor(area.width) * multiplier;
  const maxY = Math.floor(area.height) * multiplier;

  for (let x = area.x * multiplier; x <= maxX; x++) {
    for (let y = area.y * multiplier; y <= maxY; y++) {
      if (texture.getPixel(x, y).a !== 0) {
        return true;
      }
    }
  }

  return false;
}

export function getSkinTargetByUniquePixelLocations(texture: ITexture) {
  const looksLikeCustom =
    isRegionVisible(texture, RightShoulder) ||
    isRegionVisible(texture, RightArmSide) ||
    isRegionVisible(texture, LeftShoulder) ||
    isRegionVisible(texture, LeftArmSide) ||
    isRegionVisible(texture, RightArmSideLayer2) ||
    isRegionVisible(texture, RightShoulderLayer2) ||
    isRegionVisible(texture, LeftArmSideLayer2) ||
    isRegionVisible(texture, LeftShoulderLayer2);

  return looksLikeCustom ? SkinTarget.Custom : SkinTarget.CustomSlim;
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

export async function isOuterAreaIsBlank(texture: ITexture, size: SkinTarget) {
  await TextureUtilities.load();

  const allowedAlphaMask = texture.isHighResolution()
    ? TextureUtilities.getBySize(size).allowedTexturesHighRes
    : TextureUtilities.getBySize(size).allowedTextures;

  if (!allowedAlphaMask) {
    throw new Error("Could not find reference for texture");
  }

  for (let x = 0; x < texture.width; ++x) {
    for (let y = 0; y < texture.height; ++y) {
      const texIsVisibleInDisallowedSpot = allowedAlphaMask.getPixel(x, y).a === 0 && texture.getPixel(x, y).a > 0;
      if (texIsVisibleInDisallowedSpot) {
        return false;
      }
    }
  }

  return true;
}

export function getSegmentsVisibilities(texture: ITexture, size: SkinTarget) {
  const values = TextureUtilities.getBySize(size);

  return values.segments.map((segment) => checkTextureVisibilityForSegment(texture, segment));
}

function checkTextureVisibilityForSegment(texture: ITexture, segment: ModelSegment) {
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
