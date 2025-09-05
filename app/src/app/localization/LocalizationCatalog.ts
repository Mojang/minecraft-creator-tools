import { validateJsonAndAssert, ValidationError } from "../../jsonschema/SchemaValidation";
import StorageUtilities from "../../storage/StorageUtilities";
import ProjectItem from "../ProjectItem";

export type LocalizationCatalog = {
  langs: string[];
};

export async function parseLocalizationCatalogFromItem(
  item: ProjectItem | undefined
): Promise<[null, ValidationError[]] | [LocalizationCatalog, null]> {
  const file = item && (await item.loadFileContent());
  const json = file && StorageUtilities.getJsonObject(file);

  const [langs, errors] = validateJsonAndAssert<string[]>(json, {
    type: "array",
    items: {
      type: "string",
    },
  });

  if (errors) {
    return [null, errors];
  }

  return [{ langs }, null];
}
