/**
 * ========================================================================
 * ARCHITECTURE: ScalarArrayField.tsx
 * ========================================================================
 *
 * ScalarArrayField is a field renderer wrapper for array-of-scalar fields.
 * It wraps the existing ScalarArray class component in a standard field container.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.stringArray (7)
 *   - FieldDataType.longFormStringArray (8)
 *   - FieldDataType.numberArray (18)
 *   - FieldDataType.checkboxListAsStringArray (34)
 *
 * FEATURES:
 *   - Add/remove array elements
 *   - Long-form text support
 *   - Number vs string parsing
 *   - Lookup values support
 *   - Consistent styling with theme support
 *
 * RELATED FILES:
 *   - ScalarArray.tsx - The underlying array component
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *
 * ========================================================================
 */

import React from "react";
import { getThemeColors } from "../../UX/hooks/theme/useThemeColors";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import ScalarArray, { IScalarArrayProps } from "../ScalarArray";
import IFormDefinition from "../../dataform/IFormDefinition";
import FieldUtilities from "../../dataform/FieldUtilities";
import { FieldDataType } from "../../dataform/IField";
import ISimpleReference from "../../dataform/ISimpleReference";

/**
 * Lookup values for autocomplete/suggestions.
 * Matches the type expected by ScalarArray component.
 */
export type IScalarArrayLookups = { [name: string]: ISimpleReference[] | undefined } | undefined;

/**
 * Props for ScalarArrayField component.
 */
export interface IScalarArrayFieldProps extends IFieldRendererProps<string[]> {
  /**
   * The form definition (needed by ScalarArray component).
   */
  form: IFormDefinition;

  /**
   * Unique object key for state management.
   */
  objectKey: string;

  /**
   * Lookup values for autocomplete suggestions.
   */
  lookups?: IScalarArrayLookups;

  /**
   * Whether the field is valid (affects title styling).
   */
  isValid?: boolean;

  /**
   * Callback when the array value changes.
   * Note: ScalarArray's onChange signature differs from other components.
   */
  onScalarArrayChange: (data: IScalarArrayProps) => void;

  /**
   * Callback to check if a lookup type supports adding new items.
   */
  canAddItem?: (lookupId: string) => boolean;

  /**
   * Callback to add a new item for a lookup type.
   * Returns the ID of the newly created item.
   */
  onAddItem?: (lookupId: string) => Promise<string | undefined>;
}

/**
 * Renders a scalar array input field.
 *
 * Wraps the ScalarArray class component in a standard field container
 * with consistent styling.
 */
export default function ScalarArrayField(props: IScalarArrayFieldProps): JSX.Element {
  const {
    field,
    value,
    baseKey,
    theme,
    cssConfig,
    descriptionElements,
    sampleElements,
    form,
    objectKey,
    lookups,
    isValid = true,
    onScalarArrayChange,
    canAddItem,
    onAddItem,
  } = props;

  const title = FieldUtilities.getFieldTitle(field);
  const cssClass = getCssClassName("fieldWrap", cssConfig);

  const scalarArray = (
    <ScalarArray
      data={value}
      objectKey={objectKey}
      key={"sarr" + baseKey}
      lookups={lookups}
      longForm={field.dataType === FieldDataType.longFormStringArray}
      isNumber={field.dataType === FieldDataType.numberArray}
      label={title}
      allowCreateDelete={field.allowCreateDelete}
      onChange={onScalarArrayChange}
      form={form}
      field={field}
      canAddItem={canAddItem}
      onAddItem={onAddItem}
    />
  );

  const colors = getThemeColors();
  return (
    <div
      className={cssClass}
      key={"fwk" + baseKey}
      style={{
        borderTopColor: colors.background3,
        borderBottomColor: colors.background1,
      }}
    >
      <div className={getCssClassName(isValid ? "elementTitle" : "elementTitleInvalid", cssConfig)}>{title}</div>
      {descriptionElements}
      {scalarArray}
      {sampleElements}
    </div>
  );
}
