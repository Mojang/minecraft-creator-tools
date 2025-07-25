import { ImageArea } from "./ITexture";
import { ModelSegment } from "./TextureUtilities";

export const Head: ModelSegment = {
  name: "Head",
  parts: {
    top: { x: 8, y: 0, width: 15, height: 7 },
    front: { x: 8, y: 8, width: 15, height: 15 },
    left: { x: 16, y: 8, width: 23, height: 15 },
    right: { x: 0, y: 8, width: 7, height: 15 },
    bottom: { x: 16, y: 0, width: 23, height: 7 },
    back: { x: 24, y: 8, width: 31, height: 1 },
  },
} as const;

export const Body: ModelSegment = {
  name: "Body",
  parts: {
    top: { x: 20, y: 16, width: 27, height: 19 },
    front: { x: 20, y: 20, width: 27, height: 31 },
    left: { x: 16, y: 20, width: 19, height: 31 },
    right: { x: 28, y: 20, width: 31, height: 31 },
    bottom: { x: 26, y: 16, width: 35, height: 19 },
    back: { x: 32, y: 20, width: 39, height: 31 },
  },
} as const;

// Right Arm - Custom
export const RightArmCustom: ModelSegment = {
  name: "Right Arm",
  parts: {
    top: { x: 44, y: 16, width: 47, height: 19 },
    front: { x: 44, y: 20, width: 47, height: 31 },
    left: { x: 40, y: 20, width: 43, height: 31 },
    right: { x: 48, y: 20, width: 51, height: 31 },
    bottom: { x: 48, y: 16, width: 51, height: 19 },
    back: { x: 52, y: 20, width: 55, height: 31 },
  },
} as const;

// Right Arm - Slim
export const RightArmSlim: ModelSegment = {
  name: "Right Arm",
  parts: {
    top: { x: 44, y: 16, width: 46, height: 19 },
    front: { x: 44, y: 20, width: 46, height: 31 },
    left: { x: 40, y: 20, width: 43, height: 31 },
    right: { x: 47, y: 20, width: 50, height: 31 },
    bottom: { x: 47, y: 16, width: 49, height: 19 },
    back: { x: 51, y: 20, width: 53, height: 31 },
  },
};

// Left Arm - Custom
export const LeftArmCustom: ModelSegment = {
  name: "Left Arm",
  parts: {
    top: { x: 36, y: 48, width: 39, height: 51 },
    front: { x: 36, y: 52, width: 39, height: 63 },
    left: { x: 32, y: 52, width: 35, height: 63 },
    right: { x: 40, y: 52, width: 43, height: 63 },
    bottom: { x: 40, y: 48, width: 43, height: 51 },
    back: { x: 44, y: 52, width: 47, height: 63 },
  },
} as const;

// Left Arm - Slim
export const LeftArmSlim: ModelSegment = {
  name: "Left Arm",
  parts: {
    top: { x: 36, y: 48, width: 38, height: 51 },
    front: { x: 36, y: 52, width: 38, height: 63 },
    left: { x: 32, y: 52, width: 35, height: 63 },
    right: { x: 39, y: 52, width: 42, height: 63 },
    bottom: { x: 39, y: 48, width: 41, height: 51 },
    back: { x: 43, y: 52, width: 45, height: 63 },
  },
} as const;

// Right Leg
export const RightLeg: ModelSegment = {
  name: "Right Leg",
  parts: {
    top: { x: 4, y: 16, width: 7, height: 19 },
    front: { x: 4, y: 20, width: 7, height: 31 },
    left: { x: 0, y: 20, width: 3, height: 31 },
    right: { x: 8, y: 20, width: 11, height: 31 },
    bottom: { x: 8, y: 16, width: 11, height: 19 },
    back: { x: 12, y: 20, width: 15, height: 31 },
  },
} as const;

// Left Leg
export const LeftLeg: ModelSegment = {
  name: "Left Leg",
  parts: {
    top: { x: 20, y: 48, width: 23, height: 51 },
    front: { x: 20, y: 52, width: 23, height: 63 },
    left: { x: 16, y: 52, width: 19, height: 63 },
    right: { x: 24, y: 52, width: 27, height: 63 },
    bottom: { x: 24, y: 48, width: 27, height: 51 },
    back: { x: 28, y: 52, width: 31, height: 63 },
  },
} as const;

export const RightShoulder: ImageArea = { x: 50, y: 16, width: 51, height: 19 } as const;
export const RightArmSide: ImageArea = { x: 54, y: 20, width: 55, height: 31 } as const;
export const RightShoulderLayer2: ImageArea = { x: 50, y: 32, width: 51, height: 35 } as const;
export const RightArmSideLayer2: ImageArea = { x: 54, y: 36, width: 55, height: 47 } as const;
export const LeftShoulder: ImageArea = { x: 42, y: 48, width: 43, height: 51 } as const;
export const LeftArmSide: ImageArea = { x: 46, y: 52, width: 47, height: 63 } as const;
export const LeftShoulderLayer2: ImageArea = { x: 58, y: 48, width: 59, height: 51 } as const;
export const LeftArmSideLayer2: ImageArea = { x: 62, y: 52, width: 63, height: 63 } as const;
