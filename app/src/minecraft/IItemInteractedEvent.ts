// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default interface IItemInteractedEvent {
  eventName: string;
  eventId?: string;

  properties: {
    AccountType: number;
    ActiveSessionID: string;
    AppSessionID: string;
    Aux: number;
    Biome: number;
    Build: string;
    BuildNum: string;
    BuildPlat: number;
    Cheevos: boolean;
    ClientId: string;
    Count: number;
    CurrentNumDevices: number;
    DeviceSessionId: string;
    Difficulty: string;
    Dim: number;
    DnAPlat: string;
    Id: string;
    Method: number;
    Mode: number;
    Seq: number;
    ServerId: string;
    Plat: string;
    PlayerGameMode: number;
    UserId: string;
    WorldFeature: number;
    WorldSessionId: string;
    editionType: string;
    isUnderground: boolean;
    vrMode: boolean;
  };
}
