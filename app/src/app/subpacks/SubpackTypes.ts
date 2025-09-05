const SubpackTypes: Record<string, { name: string; minTier: number }> = {
  Subpack16x: {
    name: "16x",
    minTier: 2,
  },
  Subpack32x: {
    name: "32x",
    minTier: 2,
  },
  Subpack64x: {
    name: "64x",
    minTier: 8,
  },
  Subpack128x: {
    name: "128x",
    minTier: 12,
  },
  Subpack256x: {
    name: "256x",
    minTier: 16,
  },
};

export default SubpackTypes;
