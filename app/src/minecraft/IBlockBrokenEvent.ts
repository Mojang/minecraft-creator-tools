// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IBlockBrokenEvent {
  eventId?: string;
  eventName: string;
  measurements: {
    count: number;
  };
  properties: {
    ActiveSessionID: string;
    Biome: number;
    Block: string;
    Build: string;
    BuildNum: string;
    BuildPlat: number;
    ToolItemType: number;
    Type: number;
    Cheevos: boolean;
    Dim: number;
    ClientId: string;
    DeviceSessionId: string;
    PlayerGameMode: number;
    UserId: string;
    WorldFeature: number;
    WorldSessionId: string;
    editionType: string;
    isUnderground: boolean;
    vrMode: boolean;
  };
}
