export default interface ISkinCatalog {
  skins: ISkin[];
  serialize_name?: string;
  localization_name?: string;
}

export interface ISkin {
  localization_name: string;
  geometry: "geometry.humanoid.customSlim" /* alex */ | "geometry.humanoid.custom" /* steve */;
  texture: string;
  type: "free" | "paid";
}
