// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { InfoItemType } from "../../IInfoItemData";

export const CheckSkinPackJsonTests = {
  JsonNotFoundFile: {
    id: 101,
    title: "Skin Pack Json File Not Found",
    severity: InfoItemType.error,
    defaultMessage: "skins.json file not found.",
  },
  InvalidJsonFile: { id: 102, title: "Invalid Json File" },
  InvalidPackLocName: {
    id: 103,
    title: "Invalid Localization Name",
    severity: InfoItemType.error,
    defaultMessage: "skins.json localization_name and serialize_name must be the same.",
  },
  TooManyFreeSkins: { id: 104, title: "More Free Skins Than Allowed" },
  DuplicateTextures: { id: 105, title: "Duplicate Textures Found", severity: InfoItemType.warning },
  CapeTextureNotAllowed: { id: 106, title: "Cape Texture Not Allowed" },
  InvalidTextureSize: { id: 107, title: "Texture Invalid Size" },
  MCCreatorPropertyNotAllowed: { id: 108, title: "Minecraft Creator Property Not Allowed" },
  FailedToReadFile: { id: 109, title: "File Read Failed" },
  OrphanedTexture: { id: 110, title: "Texture Not Found in skins.json" },
  OrphanedLocKey: { id: 111, title: "Loc Key Not Found in Lang File" },
  LocalizedKeyNotFoundInSkinsJson: { id: 112, title: "Localized Key Not Found In skins.json" },
  InvalidSpacingOnLocalizedKey: { id: 113, title: "Localized Key Cannot Have Leading Or Trailing Spaces" },
  InvalidSkinType: { id: 114, title: "Skin Purchase Type Not Allowed" },
  InvalidSkinModelTarget: { id: 115, title: "Invalid Skin Model Target" },
  InvalidNumberOfSkins: {
    id: 116,
    title: "Invalid Number Of Skins",
    defaultMessage: "Maximum Allowable skins is: 80",
  },
  OuterAreaIsBlank: { id: 117, title: "Outer Area Blank" },
  ModelInvisible: { id: 118, title: "Model Invisible From Some Angles" },
  ModelPartiallyInvisible: { id: 119, title: "Model Partially Invisible", severity: InfoItemType.warning },
  CouldNotFindRelatedPack: {
    id: 120,
    title: "Could Not Find Related Skin Pack",
    defaultMessage: "Could not read skin pack manifest pack",
  },
} as const;
