// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { PackType } from "../../../minecraft/Pack";
import { InfoItemType } from "../../IInfoItemData";
import { TestDefinition } from "../../tests/TestDefinition";

export enum VanillaProtectedAssetsInfoGeneratorTest {
  protectedVanillaAssetOverride = 101,
}

export type ProtectedVanillaAssetEntry = {
  packType: PackType;
  protectedPath: string;
  displayPath: string;
};

export const ProtectedVanillaAssetEntries: readonly ProtectedVanillaAssetEntry[] = [
  {
    packType: PackType.behavior,
    protectedPath: "structures/sulfur_spring/",
    displayPath: "behavior/structures/sulfur_spring",
  },
];

export const VanillaProtectedAssetsTests: Record<string, TestDefinition> = {
  protectedVanillaAssetOverride: {
    id: VanillaProtectedAssetsInfoGeneratorTest.protectedVanillaAssetOverride,
    title: "Protected Vanilla Asset Override",
    severity: InfoItemType.error,
  },
} as const;
