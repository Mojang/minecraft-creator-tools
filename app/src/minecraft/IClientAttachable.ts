// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface IClientAttachableWrapper {
  format_version: string;
  "minecraft:attachable": IClientAttachable;
}

export interface IClientAttachable {
  description: IClientAttachableDescription;
}

export interface IClientAttachableDescription {
  identifier: string;
  materials: { [identifier: string]: string };
  textures: { [identifier: string]: string };

  geometry: { [identifier: string]: string };
  particle_effects: { [identifier: string]: string };
  animations: { [identifier: string]: string };
  scripts: { [identifier: string]: string[] };
  render_controllers: string[];
}
