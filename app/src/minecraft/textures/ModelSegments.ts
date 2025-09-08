import { ImageCoords } from "../TextureDefinition";
import { ModelSegment } from "./TextureUtilities";

export const Head: ModelSegment = {
  name: "Head",
  parts: {
    top: { x1: 8, y1: 0, x2: 15, y2: 7 },
    front: { x1: 8, y1: 8, x2: 15, y2: 15 },
    left: { x1: 16, y1: 8, x2: 23, y2: 15 },
    right: { x1: 0, y1: 8, x2: 7, y2: 15 },
    bottom: { x1: 16, y1: 0, x2: 23, y2: 7 },
    back: { x1: 24, y1: 8, x2: 31, y2: 15 },
  },
} as const;

export const Body: ModelSegment = {
  name: "Body",
  parts: {
    top: { x1: 20, y1: 16, x2: 27, y2: 19 },
    front: { x1: 20, y1: 20, x2: 27, y2: 31 },
    left: { x1: 16, y1: 20, x2: 19, y2: 31 },
    right: { x1: 28, y1: 20, x2: 31, y2: 31 },
    bottom: { x1: 26, y1: 16, x2: 35, y2: 19 },
    back: { x1: 32, y1: 20, x2: 39, y2: 31 },
  },
} as const;

// Right Arm - Custom
export const RightArmCustom: ModelSegment = {
  name: "Right Arm",
  parts: {
    top: { x1: 44, y1: 16, x2: 47, y2: 19 },
    front: { x1: 44, y1: 20, x2: 47, y2: 31 },
    left: { x1: 40, y1: 20, x2: 43, y2: 31 },
    right: { x1: 48, y1: 20, x2: 51, y2: 31 },
    bottom: { x1: 48, y1: 16, x2: 51, y2: 19 },
    back: { x1: 52, y1: 20, x2: 55, y2: 31 },
  },
} as const;

// Right Arm - Slim
export const RightArmSlim: ModelSegment = {
  name: "Right Arm",
  parts: {
    top: { x1: 44, y1: 16, x2: 46, y2: 19 },
    front: { x1: 44, y1: 20, x2: 46, y2: 31 },
    left: { x1: 40, y1: 20, x2: 43, y2: 31 },
    right: { x1: 47, y1: 20, x2: 50, y2: 31 },
    bottom: { x1: 47, y1: 16, x2: 49, y2: 19 },
    back: { x1: 51, y1: 20, x2: 53, y2: 31 },
  },
};

// Left Arm - Custom
export const LeftArmCustom: ModelSegment = {
  name: "Left Arm",
  parts: {
    top: { x1: 36, y1: 48, x2: 39, y2: 51 },
    front: { x1: 36, y1: 52, x2: 39, y2: 63 },
    left: { x1: 32, y1: 52, x2: 35, y2: 63 },
    right: { x1: 40, y1: 52, x2: 43, y2: 63 },
    bottom: { x1: 40, y1: 48, x2: 43, y2: 51 },
    back: { x1: 44, y1: 52, x2: 47, y2: 63 },
  },
} as const;

// Left Arm - Slim
export const LeftArmSlim: ModelSegment = {
  name: "Left Arm",
  parts: {
    top: { x1: 36, y1: 48, x2: 38, y2: 51 },
    front: { x1: 36, y1: 52, x2: 38, y2: 63 },
    left: { x1: 32, y1: 52, x2: 35, y2: 63 },
    right: { x1: 39, y1: 52, x2: 42, y2: 63 },
    bottom: { x1: 39, y1: 48, x2: 41, y2: 51 },
    back: { x1: 43, y1: 52, x2: 45, y2: 63 },
  },
} as const;

// Right Leg
export const RightLeg: ModelSegment = {
  name: "Right Leg",
  parts: {
    top: { x1: 4, y1: 16, x2: 7, y2: 19 },
    front: { x1: 4, y1: 20, x2: 7, y2: 31 },
    left: { x1: 0, y1: 20, x2: 3, y2: 31 },
    right: { x1: 8, y1: 20, x2: 11, y2: 31 },
    bottom: { x1: 8, y1: 16, x2: 11, y2: 19 },
    back: { x1: 12, y1: 20, x2: 15, y2: 31 },
  },
} as const;

// Left Leg
export const LeftLeg: ModelSegment = {
  name: "Left Leg",
  parts: {
    top: { x1: 20, y1: 48, x2: 23, y2: 51 },
    front: { x1: 20, y1: 52, x2: 23, y2: 63 },
    left: { x1: 16, y1: 52, x2: 19, y2: 63 },
    right: { x1: 24, y1: 52, x2: 27, y2: 63 },
    bottom: { x1: 24, y1: 48, x2: 27, y2: 51 },
    back: { x1: 28, y1: 52, x2: 31, y2: 63 },
  },
} as const;

// Right Arm Custom Difference
export const RightArmCustomDifference: ImageCoords = { x1: 54, y1: 20, x2: 55, y2: 31 } as const;
// Extra 1px column present in the Custom (thick) right arm but not in the Slim variant.
export const LeftArmCustomDifference: ImageCoords = { x1: 46, y1: 52, x2: 47, y2: 63 } as const;
// Extra 1px column present in the Custom (thick) left arm but not in the Slim variant.
