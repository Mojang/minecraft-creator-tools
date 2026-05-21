// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { TestDefinition } from "../../tests/TestDefinition";
import { PackType } from "../../../minecraft/Pack";

export type PackageType = PackType | "WorldTemplate";

export enum ForbiddenTest {
  FailedToReadFile = "FailedToReadFile",
  ExtNotInAllowList = "ExtNotInAllowList",
  InvalidFileName = "InvalidFileName",
  ContainsInvalidCharacter = "ContainsInvalidCharacter",
}

export const ForbiddenTests: Record<ForbiddenTest, TestDefinition> = {
  FailedToReadFile: { id: 101, title: "Failed To Read File" },
  ExtNotInAllowList: { id: 102, title: "File Does Not Have Allowed Extension" },
  InvalidFileName: { id: 103, title: "File Name Is Blocked" },
  ContainsInvalidCharacter: { id: 104, title: "File Name Contains Invalid Character" },
} as const;

const SharedBPRPExtensions = [
  ".json",
  ".txt",
  ".lang",
  ".material",
  ".mcfunction",
  ".nbt",
  ".png",
  ".tga",
  ".jpg",
  ".jpeg",
  ".hdr",
  ".wav",
  ".ogg",
  ".fsb",
  ".mcstructure",
] as const;

export const AllowedExtensionsByType: Record<PackageType, Set<string> | "*"> = {
  [PackType.resource]: new Set([...SharedBPRPExtensions]),
  [PackType.behavior]: new Set([...SharedBPRPExtensions, ".js", ".ts"]),
  [PackType.skin]: new Set([".json", ".lang", ".png", ".tga", ".jpg", ".jpeg", ".mcstructure"]),
  [PackType.persona]: new Set([".json", ".lang", ".png", ".tga", ".mcstructure"]),
  [PackType.design]: "*",
  WorldTemplate: "*",
} as const;

const SharedBPRPBlockedFiles = [
  "font/emoticons.json",
  "credits/end.txt",
  "items_client.json",
  "items_offsets_clients.json",
  "texts/languages_names.json",
  "/shaders",
  "ui/mcoin.png",
] as const;

/* 
  In theory you would want to exclude these when handling "SystemResourcePacks"
  but that seems to be more of a marketplace concept that isn't handled in mctools
*/
const NonSystemResourceBlockedFiles = ["Contents.json"];

export const BlockedFilesByType: Record<PackageType, Set<string>> = {
  [PackType.resource]: new Set([...SharedBPRPBlockedFiles, ...NonSystemResourceBlockedFiles]),
  [PackType.behavior]: new Set([...SharedBPRPBlockedFiles, ...NonSystemResourceBlockedFiles]),
  [PackType.skin]: new Set(["ui/mcoin.png", "/contents.json"]),
  [PackType.persona]: new Set([]),
  [PackType.design]: new Set([]),
  WorldTemplate: new Set(["ui/mcoin.png", "/contents.json"]),
} as const;
