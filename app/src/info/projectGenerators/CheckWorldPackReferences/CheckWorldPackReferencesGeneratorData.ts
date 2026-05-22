// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// A valid UUID (36 chars) used as the header UUID in fixture manifests
export const PACK_REF_UUID = "aaaabbbb-cccc-dddd-eeee-ffff00001111";
// A distinct UUID for the module entry in the manifest
export const MANIFEST_MODULE_UUID = "11112222-3333-4444-5555-666677778888";

/** A valid resource pack manifest JSON string containing PACK_REF_UUID as the header uuid. */
export const VALID_RESOURCE_MANIFEST_JSON = JSON.stringify({
  format_version: 2,
  header: {
    uuid: PACK_REF_UUID,
    version: [1, 0, 0],
    name: "Test RP",
    description: "Test resource pack",
  },
  modules: [{ type: "resources", uuid: MANIFEST_MODULE_UUID, version: [1, 0, 0] }],
});

/** A valid world_resource_packs.json referencing PACK_REF_UUID. */
export const VALID_PACK_REF_JSON = JSON.stringify([{ pack_id: PACK_REF_UUID, version: [1, 0, 0] }]);

/** A world_resource_packs.json that is not an array — triggers invalidWorldPackReferencesJson. */
export const INVALID_PACK_REF_NOT_ARRAY_JSON = JSON.stringify({ pack_id: PACK_REF_UUID, version: [1, 0, 0] });

/** A world_resource_packs.json with a malformed UUID — triggers invalidPackId. */
export const INVALID_PACK_REF_BAD_UUID_JSON = JSON.stringify([{ pack_id: "not-a-real-uuid", version: [1, 0, 0] }]);

/** A world_resource_packs.json referencing a UUID that won't match any registered manifest. */
export const PACK_REF_UNKNOWN_UUID = "99999999-9999-9999-9999-999999999999";
export const PACK_REF_UNKNOWN_UUID_JSON = JSON.stringify([{ pack_id: PACK_REF_UNKNOWN_UUID, version: [1, 0, 0] }]);
