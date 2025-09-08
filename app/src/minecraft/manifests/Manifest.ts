import { CamelCase, convertKeysToCamelCase } from "../../core/ObjectUtilities";
import { validateJsonAndAssert } from "../../jsonschema/SchemaValidation";
import { JsonManifest, ManifestSchema } from "./JsonManifest";

type Manifest = CamelCase<JsonManifest>;

const transforms = [convertKeysToCamelCase];
export const parseManifest = (json: any) => validateJsonAndAssert<Manifest>(json, ManifestSchema, transforms);

export default Manifest;
