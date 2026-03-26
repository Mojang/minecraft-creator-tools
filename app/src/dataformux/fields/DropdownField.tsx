/**
 * ========================================================================
 * ARCHITECTURE: DropdownField.tsx
 * ========================================================================
 *
 * DropdownField is a field renderer for enum/choice-based fields.
 * It renders as a FormDropdown with predefined choices.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.stringEnum (4) - when choices are defined
 *   - FieldDataType.intEnum (5) - when choices are defined
 *   - FieldDataType.boolean (1) - when choices are defined (rare)
 *
 * NOTE: This is different from the dropdown mode of TextboxField.
 *   - DropdownField: Uses _handleDropdownChange, tracks dropdownItems
 *   - TextboxField dropdown: Uses _handleDropdownTextChange, searchable
 *
 * FEATURES:
 *   - Dropdown with predefined choices
 *   - Support for humanified display values
 *   - Tracks selected item for form state
 *   - Consistent styling with theme support
 *
 * RELATED FILES:
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *   - FieldUtilities.ts - Title and description helpers
 *   - TextboxField.tsx - Alternative dropdown for lookups
 *
 * ========================================================================
 */

import React from "react";
import { Select, MenuItem, FormControl, InputLabel, SelectChangeEvent } from "@mui/material";
import { IFieldRendererProps, getCssClassName, IFieldRenderResult } from "./IFieldRendererProps";
import ISimpleReference from "../../dataform/ISimpleReference";
import FieldUtilities from "../../dataform/FieldUtilities";
import Utilities from "../../core/Utilities";
import { mcColors } from "../../UX/hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

/**
 * Dropdown item structure for compatibility.
 */
export interface IDropdownItem {
  content: string;
  selected: boolean;
}

/**
 * Props for DropdownField component.
 */
export interface IDropdownFieldProps extends IFieldRendererProps<string | number | boolean> {
  /**
   * Choices for the dropdown. Required for this field type.
   */
  choices: ISimpleReference[];

  /**
   * Property index used for the dropdown ID.
   * This is used by the parent to track which dropdown changed.
   */
  propIndex: number;

  /**
   * Callback for dropdown selection changes.
   * Receives the field ID and selected value.
   */
  onDropdownChange: (fieldId: string, value: string) => void;
}

/**
 * Renders a dropdown field with predefined choices.
 *
 * Used for enum-style fields where the user selects from
 * a fixed set of options.
 */
export default function DropdownField(props: IDropdownFieldProps): JSX.Element {
  const { field, value, baseKey, theme, cssConfig, choices, propIndex, descriptionElements, sampleElements } = props;

  const title = FieldUtilities.getFieldTitle(field);
  const cssClass = getCssClassName("fieldWrap", cssConfig);
  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

  // Build dropdown items and find selected value
  const items: IDropdownItem[] = [];
  let dropdownValue = "";
  let foundMatch = false;

  for (let i = 0; i < choices.length; i++) {
    const choice = choices[i];
    items.push({
      content: choice.title || Utilities.humanify(choice.id, field.humanifyValues),
      selected: choice.id === value,
    });

    if (value === choice.id) {
      dropdownValue = String(choice.id);
      foundMatch = true;
    }
  }

  // Fall back to first choice to avoid MUI out-of-range warning
  if (!foundMatch && choices.length > 0) {
    dropdownValue = String(choices[0].id);
  }

  const handleChange = (event: SelectChangeEvent<string>) => {
    props.onDropdownChange(field.id, event.target.value);
  };

  const dropdown = (
    <FormControl fullWidth size="small">
      <InputLabel id={`dropdown-label-${propIndex}`}>{title}</InputLabel>
      <Select
        labelId={`dropdown-label-${propIndex}`}
        id={propIndex.toString()}
        key={"frs" + baseKey + title + propIndex}
        value={dropdownValue}
        label={title}
        onChange={handleChange}
      >
        {choices.map((choice, index) => (
          <MenuItem key={index} value={String(choice.id)}>
            {choice.title || Utilities.humanify(choice.id, field.humanifyValues)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );

  return (
    <div
      className={cssClass}
      key={"fwg" + baseKey}
      style={{
        borderTopColor: isDark ? mcColors.gray5 : mcColors.gray2,
        borderBottomColor: isDark ? mcColors.gray4 : mcColors.gray3,
      }}
    >
      {descriptionElements}
      {dropdown}
      {sampleElements}
    </div>
  );
}

/**
 * Renders DropdownField and returns structured result with registrations.
 * This is the entry point that provides dropdown tracking data.
 *
 * @param props - Dropdown field props
 * @returns Render result with element and dropdown registration
 */
export function renderDropdownField(props: IDropdownFieldProps): IFieldRenderResult {
  // Build items for registration
  const items: IDropdownItem[] = props.choices.map((choice) => ({
    content: choice.title || "",
    selected: choice.id === props.value,
  }));

  return {
    element: <DropdownField {...props} />,
    registrations: {
      dropdownNames: [props.field.id],
    },
  };
}

/**
 * Gets the dropdown items for form state tracking.
 * Called by DataForm to populate dropdownItems array.
 */
export function getDropdownItems(choices: ISimpleReference[], value: unknown): IDropdownItem[] {
  return choices.map((choice) => ({
    content: choice.title || "",
    selected: choice.id === value,
  }));
}
