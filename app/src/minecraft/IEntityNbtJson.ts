// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

//        {blockPos: [1, 1, 1], pos: [1.5823922759590232d, 1.0d, 1.4471155527810424d], nbt: {
//Air: 300s, Dimension: 0, FallDistance: 0.0f, Fire: -1s, Invulnerable: 0b,
//Motion: [0.0d, 0.0d, 0.0d],
//OnGround: 1b, PortalCooldown: 0, Pos: [-601.417607724041d, 58.0d, -219.55288444721896d],
//Rotation: [-1.4245099f, 0.0f], Type: "oak",
//UUID: [I; -1336353034, 1136674645, -1851427156, 255031226], id: "minecraft:boat"}}

export default interface IEntityNbtJson {
  Air: number;
  Dimension: number;
  FallDistance: number;
  Fire: number;
  Invulnerable: boolean;
  Motion: number[];
  Onbound: boolean;
  Rotation: number[];
  Type: string;
  id: string;
  UUID: number[];
}
