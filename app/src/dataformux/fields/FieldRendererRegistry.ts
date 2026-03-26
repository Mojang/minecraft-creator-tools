/**
 * ========================================================================
 * ARCHITECTURE: FieldRendererRegistry.ts
 * ========================================================================
 *
 * FieldRendererRegistry provides a central mapping from FieldDataType
 * to field renderer components. This decouples DataForm from knowing
 * about specific field renderers, making it easier to add new field types.
 *
 * DESIGN PRINCIPLES:
 *
 * 1. REGISTRY PATTERN:
 *    Maps FieldDataType enum values to renderer factories.
 *    DataForm queries the registry to get the appropriate renderer.
 *
 * 2. GRADUAL MIGRATION:
 *    The registry can return undefined for types that haven't been
 *    extracted yet. DataForm falls back to inline rendering for those.
 *
 * 3. EXTENSIBILITY:
 *    New renderers can be added by calling registerRenderer().
 *    This enables plugin-style extensions in the future.
 *
 * 4. NO JSX IMPORTS:
 *    This file intentionally does NOT import TSX/JSX components
 *    to allow the Node.js CLI build (which doesn't have JSX) to compile.
 *    Renderers are registered at runtime by web-only code.
 *
 * FIELD TYPE GROUPINGS:
 *
 * TextboxField handles:
 *   - int (0), string (2), float (3), number (7)
 *   - stringLookup (8), stringEnum (4) - when NO choices provided
 *   - intEnum (5), intValueLookup (9), long (10)
 *   - uuid (26), molang (34), localizableString (37)
 *
 * CheckboxField handles:
 *   - boolean (1), intBoolean (6) - when NO choices provided
 *
 * DropdownField handles:
 *   - stringEnum (4), intEnum (5), boolean (1) - when choices ARE provided
 *
 * LongFormStringField handles:
 *   - longFormString (19)
 *
 * SliderField handles:
 *   - int/float/number with slider visual experience
 *
 * Point3Field handles:
 *   - point3 (9), intPoint3 (10), location (11), locationOffset (12)
 *
 * VersionField handles:
 *   - version (13)
 *
 * RangeField handles:
 *   - intRange (20), floatRange (21)
 *
 * ScalarArrayField handles:
 *   - stringArray (7), longFormStringArray (8), numberArray (18)
 *   - checkboxListAsStringArray (34)
 *
 * MAIN API:
 *   - getRendererType(dataType, hasChoices, visualExperience) - Determines renderer
 *   - isTextboxType/isCheckboxType/isPoint3Type/etc. - Type checks
 *   - registerRenderer/getRenderer - Dynamic registration
 *
 * RELATED FILES:
 *   - IFieldRendererProps.ts - Props interface
 *   - TextboxField.tsx - Text/dropdown field renderer
 *   - CheckboxField.tsx - Boolean toggle field renderer
 *   - DropdownField.tsx - Dropdown selection field renderer
 *   - LongFormStringField.tsx - Multi-line text field renderer
 *   - SliderField.tsx - Numeric slider field renderer
 *   - Point3Field.tsx - 3D point field renderer
 *   - VersionField.tsx - Version number field renderer
 *   - RangeField.tsx - Numeric range field renderer
 *   - ScalarArrayField.tsx - Array of scalars field renderer
 *   - DataForm.tsx - Uses registry to render fields
 *   - IField.ts - FieldDataType enum definition
 *
 * ========================================================================
 */

import { FieldDataType, FieldExperienceType } from "../../dataform/IField";

/**
 * Type for a render function that takes props and returns a render result.
 * The any type here allows for different prop types across renderers.
 *
 * Note: We use 'any' here intentionally because this registry is
 * decoupled from the JSX components. The actual props types are
 * defined in the TSX files.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RendererFactory = (props: any) => any;

/**
 * Enum value to renderer factory mapping.
 */
const rendererRegistry: Map<FieldDataType, RendererFactory> = new Map();

/**
 * Flag to track if the registry has been initialized with renderers.
 */
let isInitialized = false;

/**
 * Checks if a renderer is registered for the given field data type.
 *
 * @param dataType - The FieldDataType to check
 * @returns True if a renderer is registered, false otherwise
 */
export function hasRenderer(dataType: FieldDataType): boolean {
  return rendererRegistry.has(dataType);
}

/**
 * Gets the renderer for the given field data type.
 *
 * @param dataType - The FieldDataType to get the renderer for
 * @returns The renderer factory function, or undefined if not registered
 */
export function getRenderer(dataType: FieldDataType): RendererFactory | undefined {
  return rendererRegistry.get(dataType);
}

/**
 * Registers a custom renderer for a field data type.
 * This can be used to override built-in renderers or add new ones.
 *
 * @param dataType - The FieldDataType to register
 * @param renderer - The renderer factory function
 */
export function registerRenderer(dataType: FieldDataType, renderer: RendererFactory): void {
  rendererRegistry.set(dataType, renderer);
}

/**
 * Registers multiple field types with the same renderer.
 * Convenience method for bulk registration.
 *
 * @param dataTypes - Array of FieldDataTypes to register
 * @param renderer - The renderer factory function to use for all types
 */
export function registerRendererForTypes(dataTypes: FieldDataType[], renderer: RendererFactory): void {
  for (const dataType of dataTypes) {
    rendererRegistry.set(dataType, renderer);
  }
}

/**
 * Unregisters a renderer for a field data type.
 * Primarily useful for testing.
 *
 * @param dataType - The FieldDataType to unregister
 * @returns True if a renderer was removed, false if none was registered
 */
export function unregisterRenderer(dataType: FieldDataType): boolean {
  return rendererRegistry.delete(dataType);
}

/**
 * Gets all registered field data types.
 * Useful for debugging and testing.
 *
 * @returns Array of registered FieldDataType values
 */
export function getRegisteredTypes(): FieldDataType[] {
  return Array.from(rendererRegistry.keys());
}

/**
 * Checks if the registry has been initialized with renderers.
 * This can be used to detect if web-only initialization has run.
 *
 * @returns True if initialized, false otherwise
 */
export function isRegistryInitialized(): boolean {
  return isInitialized;
}

/**
 * Marks the registry as initialized.
 * Called by web-only initialization code after registering renderers.
 */
export function markInitialized(): void {
  isInitialized = true;
}

/**
 * Clears all registered renderers.
 * Primarily useful for testing.
 */
export function clearRegistry(): void {
  rendererRegistry.clear();
  isInitialized = false;
}

/**
 * Checks if the given data type should use the TextboxField renderer.
 * Helper for DataForm to determine which props to prepare.
 *
 * @param dataType - The FieldDataType to check
 * @returns True if this type uses TextboxField
 */
export function isTextboxType(dataType: FieldDataType): boolean {
  return (
    dataType === FieldDataType.int ||
    dataType === FieldDataType.string ||
    dataType === FieldDataType.float ||
    dataType === FieldDataType.number ||
    dataType === FieldDataType.stringEnum ||
    dataType === FieldDataType.intEnum ||
    dataType === FieldDataType.stringLookup ||
    dataType === FieldDataType.intValueLookup ||
    dataType === FieldDataType.long ||
    dataType === FieldDataType.uuid ||
    dataType === FieldDataType.molang ||
    dataType === FieldDataType.localizableString
  );
}

/**
 * Checks if the given data type should use the CheckboxField renderer.
 * Helper for DataForm to determine which props to prepare.
 *
 * @param dataType - The FieldDataType to check
 * @returns True if this type uses CheckboxField
 */
export function isCheckboxType(dataType: FieldDataType): boolean {
  return dataType === FieldDataType.boolean || dataType === FieldDataType.intBoolean;
}

/**
 * List of field data types that TextboxField handles.
 * Exported for use by web initialization code.
 */
export const TEXTBOX_TYPES: FieldDataType[] = [
  FieldDataType.int,
  FieldDataType.string,
  FieldDataType.float,
  FieldDataType.number,
  FieldDataType.stringEnum,
  FieldDataType.intEnum,
  FieldDataType.stringLookup,
  FieldDataType.intValueLookup,
  FieldDataType.long,
  FieldDataType.uuid,
  FieldDataType.molang,
  FieldDataType.localizableString,
];

/**
 * List of field data types that CheckboxField handles.
 * Exported for use by web initialization code.
 */
export const CHECKBOX_TYPES: FieldDataType[] = [FieldDataType.boolean, FieldDataType.intBoolean];

/**
 * List of field data types that Point3Field handles.
 * Exported for use by web initialization code.
 */
export const POINT3_TYPES: FieldDataType[] = [
  FieldDataType.point3,
  FieldDataType.intPoint3,
  FieldDataType.location,
  FieldDataType.locationOffset,
];

/**
 * List of field data types that RangeField handles.
 * Exported for use by web initialization code.
 */
export const RANGE_TYPES: FieldDataType[] = [FieldDataType.intRange, FieldDataType.floatRange];

/**
 * List of field data types that ScalarArrayField handles.
 * Exported for use by web initialization code.
 */
export const SCALAR_ARRAY_TYPES: FieldDataType[] = [
  FieldDataType.stringArray,
  FieldDataType.longFormStringArray,
  FieldDataType.numberArray,
  FieldDataType.checkboxListAsStringArray,
];

/**
 * Enum for field renderer types.
 * Used to identify which renderer component to use.
 */
export enum FieldRendererType {
  textbox = "textbox",
  checkbox = "checkbox",
  dropdown = "dropdown",
  longFormString = "longFormString",
  slider = "slider",
  point3 = "point3",
  version = "version",
  range = "range",
  scalarArray = "scalarArray",
  minecraftFilter = "minecraftFilter",
  minecraftEventTrigger = "minecraftEventTrigger",
  objectArray = "objectArray",
  keyedObject = "keyedObject",
  unknown = "unknown",
}

/**
 * Checks if the given data type should use the Point3Field renderer.
 *
 * @param dataType - The FieldDataType to check
 * @returns True if this type uses Point3Field
 */
export function isPoint3Type(dataType: FieldDataType): boolean {
  return (
    dataType === FieldDataType.point3 ||
    dataType === FieldDataType.intPoint3 ||
    dataType === FieldDataType.location ||
    dataType === FieldDataType.locationOffset
  );
}

/**
 * Checks if the given data type should use the RangeField renderer.
 *
 * @param dataType - The FieldDataType to check
 * @returns True if this type uses RangeField
 */
export function isRangeType(dataType: FieldDataType): boolean {
  return dataType === FieldDataType.intRange || dataType === FieldDataType.floatRange;
}

/**
 * Checks if the given data type should use the ScalarArrayField renderer.
 *
 * @param dataType - The FieldDataType to check
 * @returns True if this type uses ScalarArrayField
 */
export function isScalarArrayType(dataType: FieldDataType): boolean {
  return (
    dataType === FieldDataType.stringArray ||
    dataType === FieldDataType.longFormStringArray ||
    dataType === FieldDataType.numberArray ||
    dataType === FieldDataType.checkboxListAsStringArray
  );
}

/**
 * Checks if the given data type is compatible with slider visual experience.
 *
 * @param dataType - The FieldDataType to check
 * @returns True if this type can use a slider
 */
export function isSliderCompatibleType(dataType: FieldDataType): boolean {
  return (
    dataType === FieldDataType.int ||
    dataType === FieldDataType.float ||
    dataType === FieldDataType.number ||
    dataType === FieldDataType.long
  );
}

/**
 * Determines the renderer type for a given field based on its data type
 * and other properties like choices and experience type.
 *
 * @param dataType - The FieldDataType
 * @param hasChoices - Whether the field has choices defined
 * @param experienceType - Optional experience type setting (e.g., slider)
 * @returns The renderer type name
 */
export function getRendererType(
  dataType: FieldDataType,
  hasChoices: boolean = false,
  experienceType?: FieldExperienceType
): FieldRendererType {
  // Slider takes precedence if experience type is set
  if (experienceType === FieldExperienceType.slider && isSliderCompatibleType(dataType)) {
    return FieldRendererType.slider;
  }

  // Dropdown for enums and booleans with choices
  if (
    hasChoices &&
    (dataType === FieldDataType.stringEnum || dataType === FieldDataType.intEnum || dataType === FieldDataType.boolean)
  ) {
    return FieldRendererType.dropdown;
  }

  // Check specific type groupings
  if (isTextboxType(dataType)) {
    return FieldRendererType.textbox;
  }

  if (isCheckboxType(dataType)) {
    return FieldRendererType.checkbox;
  }

  if (isPoint3Type(dataType)) {
    return FieldRendererType.point3;
  }

  if (dataType === FieldDataType.version) {
    return FieldRendererType.version;
  }

  if (isRangeType(dataType)) {
    return FieldRendererType.range;
  }

  if (isScalarArrayType(dataType)) {
    return FieldRendererType.scalarArray;
  }

  if (dataType === FieldDataType.longFormString) {
    return FieldRendererType.longFormString;
  }

  // Fall back to unknown for types not yet extracted
  return FieldRendererType.unknown;
}

/**
 * Gets a human-readable name for the renderer type.
 * Useful for debugging and error messages.
 *
 * @param rendererType - The FieldRendererType
 * @returns Human-readable name
 */
export function getRendererTypeName(rendererType: FieldRendererType): string {
  switch (rendererType) {
    case FieldRendererType.textbox:
      return "Text Input";
    case FieldRendererType.checkbox:
      return "Checkbox";
    case FieldRendererType.dropdown:
      return "Dropdown";
    case FieldRendererType.longFormString:
      return "Text Area";
    case FieldRendererType.slider:
      return "Slider";
    case FieldRendererType.point3:
      return "3D Point";
    case FieldRendererType.version:
      return "Version";
    case FieldRendererType.range:
      return "Range";
    case FieldRendererType.scalarArray:
      return "List";
    case FieldRendererType.minecraftFilter:
      return "Minecraft Filter";
    case FieldRendererType.minecraftEventTrigger:
      return "Event Trigger";
    case FieldRendererType.objectArray:
      return "Object Array";
    case FieldRendererType.keyedObject:
      return "Keyed Object";
    default:
      return "Unknown";
  }
}
