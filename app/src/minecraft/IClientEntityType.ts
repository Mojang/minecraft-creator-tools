export interface IClientEntityTypeWrapper {
  format_version: string;
  "minecraft:client_entity": IClientEntityType;
}

export interface IClientEntityType {
  description: IClientEntityTypeDescription;
}

export interface IClientEntityTypeDescription {
  identifier: string;
  materials: { [identifier: string]: string };
  textures: { [identifier: string]: string };

  geometry: { [identifier: string]: string };
  particle_effects: { [identifier: string]: string };
  animations: { [identifier: string]: string };
  scripts: { [identifier: string]: string[] };
  render_controllers: string[];
  spawn_egg?: IClientEntitySpawnEgg;
}

export interface IClientEntitySpawnEgg {
  texture?: string;
  texture_index?: number;
}
