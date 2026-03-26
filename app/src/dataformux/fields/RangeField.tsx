/**
 * ========================================================================
 * ARCHITECTURE: RangeField.tsx
 * ========================================================================
 *
 * RangeField is a field renderer wrapper for numeric range fields.
 * It wraps the existing Range class component in a standard field container.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.intRange (16)
 *   - FieldDataType.floatRange (17)
 *
 * FEATURES:
 *   - Min/Max value input
 *   - Integer or float parsing
 *   - Consistent styling with theme support
 *
 * RELATED FILES:
 *   - Range.tsx - The underlying range component
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *
 * ========================================================================
 */

import React, { SyntheticEvent } from "react";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import Range, { IRangeProps } from "../Range";
import IFormDefinition from "../../dataform/IFormDefinition";
import { getThemeColors } from "../../UX/hooks/theme/useThemeColors";

/**
 * Props for RangeField component.
 */
export interface IRangeFieldProps extends IFieldRendererProps<number[]> {
  /**
   * The form definition (needed by Range component).
   */
  form: IFormDefinition;

  /**
   * Unique object key for state management.
   */
  objectKey: string;

  /**
   * Whether the range is integer (true) or float (false).
   */
  isInt: boolean;

  /**
   * Callback when the range value changes.
   */
  onRangeChange: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IRangeProps
  ) => void;
}

/**
 * Renders a numeric range input field.
 *
 * Wraps the Range class component in a standard field container
 * with consistent styling.
 */
export default function RangeField(props: IRangeFieldProps): JSX.Element {
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
    isInt,
    onRangeChange,
  } = props;

  const cssClass = getCssClassName("fieldWrap", cssConfig);

  const range = (
    <Range
      data={value}
      objectKey={objectKey}
      key={"ra" + baseKey}
      label={field.title}
      isInt={isInt}
      onChange={onRangeChange}
      form={form}
      field={field}
    />
  );

  const colors = getThemeColors();
  return (
    <div
      className={cssClass}
      key={"fwl" + baseKey}
      style={{
        borderTopColor: colors.background3,
        borderBottomColor: colors.background1,
      }}
    >
      {descriptionElements}
      {range}
      {sampleElements}
    </div>
  );
}
