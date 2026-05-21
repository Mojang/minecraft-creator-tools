// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export enum TextureImageInfoGeneratorTest {
  textureImages = 101,
  textureImagesTier0 = 200,
  textureImagesTier1 = 201,
  textureImagesTier2 = 202,
  textureImagesTier3 = 203,
  textureImagesTier4 = 204,
  textureImagesTier5 = 205,
  pngJpgImageProcessingError = 401,
  individualTextureMemoryExceedsBudget = 402,
  totalTextureMemoryExceedsBudget = 403,
  tgaImageProcessingError = 404,
  individualAtlasTextureMemoryExceedsBudget = 405,
  totalAtlasTextureMemoryExceedsBudgetWarn = 406,
  totalAtlasTextureMemoryExceedsBudgetError = 407,
  pngJpgImageProcessingNoResults = 408,
  invalidTieringConfiguration = 409,
  invalidTieringForVibrantVisuals = 410,

  totalTextureMemoryExceedsBudgetErrorBase = 420,
  totalTextureMemoryExceedsBudgetWarningBase = 440,
  texturePackDoesntOverrideVanillaGameTexture = 460,
  texturePackDoesntOverrideMostTextures = 461,
  mashupPackDoesntOverrideMostTextures = 462,
}

export const TexturePerformanceTierCount = 6;
