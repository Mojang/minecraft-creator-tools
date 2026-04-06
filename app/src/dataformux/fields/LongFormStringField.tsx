/**
 * ========================================================================
 * ARCHITECTURE: LongFormStringField.tsx
 * ========================================================================
 *
 * LongFormStringField is a field renderer for multi-line text input.
 * It renders as a TextArea with spell checking enabled.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.longFormString (13)
 *
 * FEATURES:
 *   - Multi-line text editing via TextArea
 *   - Spell checking enabled by default
 *   - Fluid width to fill container
 *   - Consistent styling with theme support
 *
 * RELATED FILES:
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *   - FieldUtilities.ts - Title and description helpers
 *
 * ========================================================================
 */

import React, { ChangeEvent } from "react";
import { TextField } from "@mui/material";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import FieldUtilities from "../../dataform/FieldUtilities";
import { mcColors } from "../../UX/hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

/**
 * Props for LongFormStringField component.
 */
export interface ILongFormStringFieldProps extends IFieldRendererProps<string> {
  /**
   * Whether the field is valid (affects title styling).
   */
  isValid?: boolean;

  /**
   * Callback for text area changes.
   */
  onTextAreaChange: (fieldId: string, newValue: string) => void;
}

/**
 * Renders a multi-line text input field using TextArea.
 *
 * Used for long-form text content like descriptions, notes,
 * or any field that benefits from multi-line editing.
 */
export default function LongFormStringField(props: ILongFormStringFieldProps): JSX.Element {
  const {
    field,
    value,
    defaultValue,
    baseKey,
    theme,
    cssConfig,
    descriptionElements,
    sampleElements,
    isValid = true,
  } = props;

  const title = FieldUtilities.getFieldTitle(field);
  const cssClass = getCssClassName("fieldWrap", cssConfig);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    props.onTextAreaChange(field.id, event.target.value);
  };

  const fieldInput = (
    <TextField
      fullWidth
      multiline
      rows={2}
      key={"txa" + baseKey}
      id={field.id}
      value={value as string}
      defaultValue={defaultValue as string}
      spellCheck={true}
      onChange={handleChange}
      size="small"
      variant="outlined"
    />
  );

  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

  return (
    <div
      className={cssClass}
      key={"fwn" + baseKey}
      style={{
        borderTopColor: isDark ? mcColors.gray5 : mcColors.gray2,
        borderBottomColor: isDark ? mcColors.gray4 : mcColors.gray3,
      }}
    >
      {descriptionElements}
      <div key={baseKey + "titleA"} className={getCssClassName("fieldTitle", cssConfig)}>
        <div className={getCssClassName(isValid ? "elementTitle" : "elementTitleInvalid", cssConfig)}>{title}</div>
        {fieldInput}
      </div>
      {sampleElements}
    </div>
  );
}
