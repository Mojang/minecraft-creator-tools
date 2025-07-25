import { JSONSchema7 } from "json-schema";
import { validateJsonAndAssert } from "../../jsonschema/SchemaValidation";
import { Skin } from "./Skin";

export type SkinPack = {
  localization_name: string;
  serialize_name: string;
  skins: Skin[];
};

/*
 Schema for validating SkinPack
*/
const SkinPackSchema: JSONSchema7 = {
  type: "object",
  properties: {
    localization_name: { type: "string" },
    serialize_name: { type: "string" },
    skins: {
      type: "array",
      items: {
        type: "object",
        properties: {
          localization_name: { type: "string" },
          geometry: { type: "string" },
          texture: { type: "string" },
          type: { type: "string" },
        },
        required: ["localization_name", "geometry", "texture", "type"],
      },
    },
  },
  required: ["localization_name", "serialize_name", "skins"],
};

/*
  validates json against SkinPack-Schema and returns it as a fully typed SkinPack object 

  alias of validateJsonAndAssert for clarity and convenience
*/
export const validateSkinPackJson = (json: any) => validateJsonAndAssert<SkinPack>(json, SkinPackSchema);

export function getLocKeysFromSkinPack(pack: SkinPack) {
  const skinKeys = pack.skins.map((skin) => `skin.${pack.localization_name}.${skin.localization_name}`);

  return [`skinpack.${pack.localization_name}`, ...skinKeys];
}
