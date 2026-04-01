/**
 * ========================================================================
 * ARCHITECTURE: Point3Field.tsx
 * ========================================================================
 *
 * Point3Field is a field renderer wrapper for 3D point/location fields.
 * It wraps the existing Point3 class component in a standard field container.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.point3 (9)
 *   - FieldDataType.intPoint3 (10)
 *   - FieldDataType.location (11)
 *   - FieldDataType.locationOffset (12)
 *
 * FEATURES:
 *   - X, Y, Z coordinate input
 *   - Ambient point "set from" button (for location fields)
 *   - Consistent styling with theme support
 *
 * RELATED FILES:
 *   - Point3.tsx - The underlying 3D point component
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *
 * ========================================================================
 */

import React, { SyntheticEvent } from "react";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import Point3, { IPoint3Props } from "../Point3";
import IFormDefinition from "../../dataform/IFormDefinition";
import { getThemeColors } from "../../UX/hooks/theme/useThemeColors";

/**
 * Props for Point3Field component.
 */
export interface IPoint3FieldProps extends IFieldRendererProps<number[]> {
  /**
   * The form definition (needed by Point3 component).
   */
  form: IFormDefinition;

  /**
   * Unique object key for state management.
   */
  objectKey: string;

  /**
   * Optional ambient point for "set from" functionality.
   */
  ambientPoint?: number[];

  /**
   * Callback when the point value changes.
   */
  onPoint3Change: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IPoint3Props
  ) => void;
}

/**
 * Renders a 3D point input field.
 *
 * Wraps the Point3 class component in a standard field container
 * with consistent styling.
 */
export default function Point3Field(props: IPoint3FieldProps): JSX.Element {
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
    ambientPoint,
    onPoint3Change,
  } = props;

  const cssClass = getCssClassName("fieldWrap", cssConfig);

  const point3 = (
    <Point3
      data={value}
      objectKey={objectKey}
      key={"p3" + baseKey}
      label={field.title}
      ambientPoint={ambientPoint}
      onChange={onPoint3Change}
      form={form}
      field={field}
    />
  );

  const colors = getThemeColors();
  return (
    <div
      className={cssClass}
      key={"fwh" + baseKey}
      style={{
        borderTopColor: colors.background3,
        borderBottomColor: colors.background1,
      }}
    >
      {point3}
      {descriptionElements}
      {sampleElements}
    </div>
  );
}
