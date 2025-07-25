export type Skin = {
  localization_name: string;
  geometry: string;
  texture: string;
  type: string;
  cape?: string;
  animations?: string;
  enable_attachables?: boolean;
};

export enum SkinModelTarget {
  /* 'custom' is the model target used for Steve */
  Custom = "Custom",
  /* Model target for Alex uses */
  CustomSlim = "CustomSlim",
}

const GeometryNamesToModelTarget = new Map<string, SkinModelTarget>([
  ["geometry.humanoid.custom", SkinModelTarget.Custom],
  ["geometry.humanoid.customSlim", SkinModelTarget.CustomSlim],
]);
const ValidSkinTextureResolutions = [
  [64, 64],
  [64, 32],
  [128, 128],
];

const ValidPurchaseTypes = new Set(["free", "paid"]);

const ValidCapeTextureSizes = [[64, 32]];

export function isValidSkinPurchaseType(type: string) {
  return ValidPurchaseTypes.has(type);
}

export function isValidGeometry(skin: Skin) {
  return GeometryNamesToModelTarget.has(skin.geometry);
}

export function getModelTargetGeometry(skin: Skin): SkinModelTarget | undefined {
  return GeometryNamesToModelTarget.get(skin.geometry);
}

export function isValidSkinModelTarget(modelTarget: [number, number]) {
  return ValidSkinTextureResolutions.some((dim) => dim[0] === modelTarget[0] && dim[1] === modelTarget[1]);
}

export function isValidCapeSize(size: [number, number]) {
  return ValidCapeTextureSizes.some((dim) => dim[0] === size[0] && dim[1] === size[1]);
}
