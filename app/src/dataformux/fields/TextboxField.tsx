/**
 * ========================================================================
 * ARCHITECTURE: TextboxField.tsx
 * ========================================================================
 *
 * TextboxField is a field renderer for text-based input fields.
 * It handles string, int, float, and number field types with optional
 * dropdown choices.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.string (2)
 *   - FieldDataType.int (0)
 *   - FieldDataType.float (1)
 *   - FieldDataType.number (21)
 *   - FieldDataType.stringLookup (15)
 *
 * FEATURES:
 *   - Text input for free-form values
 *   - Dropdown when choices are provided
 *   - Searchable dropdown for non-strict choice matching
 *   - Working value tracking for float inputs (preserves "3." while typing "3.5")
 *   - Consistent styling with theme support
 *
 * RELATED FILES:
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *   - FieldRendererRegistry.ts - Registry that maps types to renderers
 *   - FieldUtilities.ts - Title and description helpers
 *
 * ========================================================================
 */

import React, { ChangeEvent } from "react";
import { TextField, Autocomplete, Box, Button } from "@mui/material";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import { FieldDataType } from "../../dataform/IField";
import FieldUtilities from "../../dataform/FieldUtilities";
import { mcColors } from "../../UX/hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

/**
 * Extended props for TextboxField that includes text change callback.
 */
export interface ITextboxFieldProps extends Omit<IFieldRendererProps<string | number>, "onTextChange"> {
  /**
   * Callback for raw text changes (before type conversion).
   * Used for working value tracking in float/number fields.
   * Note: Different signature from base - takes fieldId instead of field.
   */
  onTextChange: (fieldId: string, newText: string) => void;

  /**
   * Callback for dropdown selection changes.
   * Called with the selected choice ID.
   */
  onDropdownChange: (fieldId: string, selectedId: string | number | boolean) => void;

  /**
   * Whether an "Add" button should be shown for this field's lookup.
   * Set by parent when lookupProvider.canAddItem() returns true.
   */
  showAddButton?: boolean;

  /**
   * Callback when the "Add" button is clicked.
   * Parent should invoke lookupProvider.addItem() and update choices.
   */
  onAddClick?: (fieldId: string, lookupId: string) => void;
}

/**
 * Renders a text input or dropdown field based on the field configuration.
 *
 * When choices are provided, renders as a searchable dropdown.
 * Otherwise, renders as a standard text input.
 */
export default function TextboxField(props: ITextboxFieldProps): JSX.Element {
  const {
    field,
    value,
    defaultValue,
    baseKey,
    theme,
    cssConfig,
    choices,
    workingValue,
    descriptionElements,
    sampleElements,
  } = props;

  const title = FieldUtilities.getFieldTitle(field);

  // Determine the string value to display
  let strVal = value !== undefined && value !== null ? String(value) : "";

  // Build CSS class - add fieldWrapNumber for numeric fields
  let cssClass = getCssClassName("fieldWrap", cssConfig);
  const isNumeric = field.dataType === FieldDataType.float || field.dataType === FieldDataType.number;

  // Add required but empty styling
  const isEmpty = value === undefined || value === null || value === "";
  if (field.isRequired && isEmpty) {
    cssClass += " " + getCssClassName("fieldWrapRequiredEmpty", cssConfig);
  }

  if (isNumeric) {
    cssClass += " " + getCssClassName("fieldWrapNumber", cssConfig);

    // For float/number fields, use working value if it represents the same numeric value
    // This preserves user input like "3." while typing "3.5"
    if (workingValue !== undefined && workingValue !== "") {
      // The parent should have already validated that workingValue parses to the same value
      strVal = workingValue;
    }
  }

  let interior: JSX.Element;
  let choiceDescriptionArea: JSX.Element = <></>;

  // Determine if we should show a dropdown (has choices OR is a lookup with add support)
  const hasChoices = choices && choices.length > 0;
  const showAsDropdown = hasChoices || (field.lookupId && props.showAddButton);

  // Render dropdown if choices are provided or if it's a lookup with add support
  if (showAsDropdown) {
    interface IDropdownOption {
      label: string;
      id: string | number | boolean;
      description?: string;
    }

    const options: IDropdownOption[] = [];
    let selectedOption: IDropdownOption | null = null;

    if (choices) {
      for (let i = 0; i < choices.length; i++) {
        const choiceTitle = choices[i].title;
        const id = choices[i].id;
        const option: IDropdownOption = {
          label: choiceTitle ? choiceTitle : String(id),
          id: choices[i].id,
          description: choices[i].description,
        };
        options.push(option);

        if (strVal.toString() === id.toString()) {
          selectedOption = option;
        }

        // Show description for selected choice
        if (id === value && choices[i].description) {
          choiceDescriptionArea = <div>{choices[i].description}</div>;
        }
      }
    }

    const handleDropdownChange = (event: React.SyntheticEvent, newValue: IDropdownOption | string | null) => {
      if (newValue && typeof newValue === "object" && newValue.id !== undefined) {
        props.onDropdownChange(field.id, newValue.id);
      } else if (typeof newValue === "string") {
        props.onDropdownChange(field.id, newValue);
      }
    };

    // Handle text input changes in freeSolo mode
    const handleInputChange = (event: React.SyntheticEvent, newInputValue: string, reason: string) => {
      // Only persist on input (typing), not on reset or clear
      if (reason === "input") {
        props.onTextChange(field.id, newInputValue);
      }
    };

    interior = (
      <Autocomplete
        freeSolo={!field.mustMatchChoices}
        options={options}
        value={selectedOption}
        inputValue={strVal}
        onChange={handleDropdownChange}
        onInputChange={handleInputChange}
        getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        size="small"
        fullWidth
        renderInput={(params) => <TextField {...params} label={title} variant="outlined" />}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={String(option.id)}>
            <div>
              <div>{option.label}</div>
              {option.description && <div style={{ fontSize: "0.8em", opacity: 0.7 }}>{option.description}</div>}
            </div>
          </Box>
        )}
      />
    );

    // Add "Add" button if the lookup supports adding
    if (props.showAddButton && props.onAddClick && field.lookupId) {
      interior = (
        <div className={getCssClassName("fieldWithAddButtonWrapper", cssConfig)}>
          <label className={getCssClassName("fieldAddButtonLabel", cssConfig)}>{title}</label>
          <div className={getCssClassName("fieldWithAddButton", cssConfig)}>
            <Autocomplete
              freeSolo={!field.mustMatchChoices}
              options={options}
              value={selectedOption}
              inputValue={strVal}
              onChange={handleDropdownChange}
              onInputChange={handleInputChange}
              getOptionLabel={(option) => (typeof option === "string" ? option : option.label)}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              size="small"
              fullWidth
              renderInput={(params) => <TextField {...params} variant="outlined" />}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => props.onAddClick!(field.id, field.lookupId!)}
              title={`Add new ${field.lookupId}`}
              sx={{ ml: 1, whiteSpace: "nowrap" }}
            >
              + Add
            </Button>
          </div>
        </div>
      );
    }
  } else {
    // Render text input
    const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      props.onTextChange(field.id, event.target.value);
    };

    interior = (
      <TextField
        label={title}
        key={"fri" + baseKey}
        id={field.id}
        value={strVal}
        defaultValue={defaultValue !== undefined ? String(defaultValue) : undefined}
        onChange={handleInputChange}
        size="small"
        fullWidth
        variant="outlined"
      />
    );
  }

  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;

  return (
    <div
      className={cssClass}
      key={"fz" + baseKey}
      style={{
        borderTopColor: isDark ? mcColors.gray5 : mcColors.gray2,
        borderBottomColor: isDark ? mcColors.gray4 : mcColors.gray3,
      }}
    >
      {interior}
      {choiceDescriptionArea}
      {descriptionElements}
      {sampleElements}
    </div>
  );
}
