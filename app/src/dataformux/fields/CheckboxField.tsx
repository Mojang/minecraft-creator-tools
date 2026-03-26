/**
 * ========================================================================
 * ARCHITECTURE: CheckboxField.tsx
 * ========================================================================
 *
 * CheckboxField is a field renderer for boolean toggle fields.
 * It renders as a toggle switch with a label.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.boolean (3)
 *   - FieldDataType.intBoolean (4)
 *
 * FEATURES:
 *   - Toggle switch UI (not traditional checkbox)
 *   - Consistent styling with theme support
 *   - Simple boolean value management
 *
 * RELATED FILES:
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *   - FieldRendererRegistry.ts - Registry that maps types to renderers
 *   - FieldUtilities.ts - Title and description helpers
 *
 * ========================================================================
 */

import React from "react";
import { Switch } from "@mui/material";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import FieldUtilities from "../../dataform/FieldUtilities";
import { mcColors } from "../../UX/hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

/**
 * Props for CheckboxField component.
 */
export interface ICheckboxFieldProps extends IFieldRendererProps<boolean> {
  /**
   * Callback when the checkbox is toggled.
   * Called with the field ID for identification.
   */
  onToggle: (fieldId: string) => void;
}

/**
 * Renders a boolean toggle field as a switch.
 *
 * Uses MUI's Switch for a modern switch appearance
 * rather than a traditional checkbox.
 */
export default function CheckboxField(props: ICheckboxFieldProps): JSX.Element {
  const { field, value, baseKey, theme, cssConfig, descriptionElements, sampleElements } = props;

  const title = FieldUtilities.getFieldTitle(field);
  const cssClass = getCssClassName("fieldWrap", cssConfig);
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

  const handleChange = () => {
    // The toggle logic is handled by the parent via onToggle
    props.onToggle(field.id);
  };

  const checkbox = (
    <div className="df-checkboxRow">
      <Switch key={baseKey + field.id} checked={value === true} onChange={handleChange} />
      <label className="df-checkboxLabel">{title}</label>
    </div>
  );

  return (
    <div
      className={cssClass}
      key={"fwc" + field.id}
      style={{
        borderTopColor: isDark ? mcColors.gray5 : mcColors.gray2,
        borderBottomColor: isDark ? mcColors.gray4 : mcColors.gray3,
      }}
    >
      {checkbox}
      {descriptionElements}
      {sampleElements}
    </div>
  );
}
