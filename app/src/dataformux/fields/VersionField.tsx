/**
 * ========================================================================
 * ARCHITECTURE: VersionField.tsx
 * ========================================================================
 *
 * VersionField is a field renderer wrapper for version number fields.
 * It wraps the existing Version class component in a standard field container.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.version (14)
 *
 * FEATURES:
 *   - Major, Minor, Patch version input
 *   - Default version "set from" button
 *   - String or array format support
 *   - Consistent styling with theme support
 *
 * RELATED FILES:
 *   - Version.tsx - The underlying version component
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *
 * ========================================================================
 */

import React, { SyntheticEvent } from "react";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import Version, { IVersionProps } from "../Version";
import IFormDefinition from "../../dataform/IFormDefinition";
import { getThemeColors } from "../../UX/hooks/theme/useThemeColors";

/**
 * Props for VersionField component.
 */
export interface IVersionFieldProps extends IFieldRendererProps<number[] | string> {
  /**
   * The form definition (needed by Version component).
   */
  form: IFormDefinition;

  /**
   * Unique object key for state management.
   */
  objectKey: string;

  /**
   * Callback when the version value changes.
   */
  onVersionChange: (
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: IVersionProps
  ) => void;
}

/**
 * Renders a version number input field.
 *
 * Wraps the Version class component in a standard field container
 * with consistent styling.
 */
export default function VersionField(props: IVersionFieldProps): JSX.Element {
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
    onVersionChange,
  } = props;

  const cssClass = getCssClassName("fieldWrap", cssConfig);

  const version = (
    <Version
      data={value}
      objectKey={objectKey}
      key={"ver" + baseKey}
      label={field.title}
      onChange={onVersionChange}
      form={form}
      field={field}
    />
  );

  const colors = getThemeColors();
  return (
    <div
      className={cssClass}
      key={"fwi" + baseKey}
      style={{
        borderTopColor: colors.background3,
        borderBottomColor: colors.background1,
      }}
    >
      {descriptionElements}
      {version}
      {sampleElements}
    </div>
  );
}
