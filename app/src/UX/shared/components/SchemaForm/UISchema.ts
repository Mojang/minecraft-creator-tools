import { Hierarchy, HierarchyEntry, OneOfType } from "./SchemaParser";

export type UIDefinition = {
  /* will display as hidden */
  hideFromUI?: boolean;
  /* overrides titles */
  title?: string;
  /* displays elements with an object horizontally rather than vertically, will be ignored on non-objects*/
  displayHorizontal?: boolean;
  /* Message to display if regex validation fails, overrides message found in schema */
  regexErrorMessage?: string;
  /* strange pattern found in MC json where {} === true and undefined === false */
  isObjectAsBool?: boolean;
  /* 
   Sorts items within parent object in ascending order, defaults to 0 if not defined. 

   Therefore, greater values will sort to lower on the page and 
   negative values can be used to sort above all unspecified entries 
  */
  order?: number;
  //overrides description
  description?: string;
  // ui definitions of child elements, keyed on the child's name. Use for objects not for arrays. see: items
  children?: { [key: string]: UIDefinition };
  //the UI definition for child items in an array
  items?: UIDefinition;
  //regex pattern for validation
  pattern?: string;
  // overrides the default value specified in the schema
  default?: any;
  //specifices which OneOf option to use.
  //"uichoice" can also be specifed to defer the choice to the ui
  oneOf?: OneOfType;
  //defines how OneOf choices are displayed, intended for use with "uichoice", see: oneOf
  choices?: OneOfChoice[];

  select?: string[]; //TODO: support: | [string, unknown][];

  /* When true, hides the root-level title (e.g., "Loot Table Editor") from the schema form */
  hideRootTitle?: boolean;
  /* Render hint for numeric fields: "slider" renders a Slider+TextField combo instead of plain input */
  displayAs?: "slider" | "default";
};

export type OneOfChoice = {
  title?: string;
  order?: number;
  hidden?: boolean;
};

export type UISchema =
  | UIDefinition
  | {
      children?: { [key: string]: UIDefinition };
    };

export function getUIDefinition(
  uischema: UISchema | null,
  hierarchy: Hierarchy,
  leaf?: HierarchyEntry
): UIDefinition | null {
  let definition: UIDefinition | null = uischema;

  const newHierarchy = !leaf ? [...hierarchy] : [...hierarchy, leaf];

  //skip root element, its not used in the UIDefinition hierarchy
  newHierarchy.splice(0, 1);

  for (const entry of newHierarchy) {
    if (entry.isArrayItem) {
      definition = definition?.items ?? null;
    } else {
      const key = entry.schemaKey || entry.key;
      definition = definition?.children?.[key] ?? null;
    }
  }

  return definition;
}
