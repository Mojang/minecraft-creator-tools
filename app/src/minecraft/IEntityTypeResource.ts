// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IEntityTypeResourceWrapper {
  format_version: string;
  "minecraft:client_entity": IEntityTypeResource;
}

export interface IEntityTypeResource {
  description: IEntityTypeResourceDescription;
}

export interface IEntityTypeResourceDescription {
  identifier: string;
  materials: { [identifier: string]: string };
  textures: { [identifier: string]: string | undefined };

  geometry: { [identifier: string]: string };
  particle_effects: { [identifier: string]: string };
  animations: { [identifier: string]: string };
  animation_controllers: { [identifier: string]: string };
  scripts: { [identifier: string]: (string | { [name: string]: string })[] };
  render_controllers: string[];
  spawn_egg?: IEntityResourceSpawnEgg;
}

export interface IEntityResourceSpawnEgg {
  texture?: string;
  texture_index?: number;
}
