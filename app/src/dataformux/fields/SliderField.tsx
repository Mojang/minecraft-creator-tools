/**
 * ========================================================================
 * ARCHITECTURE: SliderField.tsx
 * ========================================================================
 *
 * SliderField is a field renderer for numeric values with a slider control.
 * It renders as a Slider with an accompanying text input for precise entry.
 *
 * FIELD TYPES HANDLED:
 *   - FieldDataType.int (0) - when experienceType is slider
 *   - FieldDataType.float (3) - when experienceType is slider
 *
 * FEATURES:
 *   - Slider for visual/intuitive value selection
 *   - Text input for precise numeric entry
 *   - Configurable min/max/step values
 *   - Consistent styling with theme support
 *
 * USAGE CONDITIONS:
 *   This renderer is used when:
 *   - field.experienceType === FieldExperienceType.slider
 *   - field has minValue/suggestedMinValue
 *   - field has maxValue/suggestedMaxValue
 *   - form is not read-only
 *
 * RELATED FILES:
 *   - IFieldRendererProps.ts - Props interface
 *   - DataForm.tsx - Parent form component
 *   - FieldUtilities.ts - Title and description helpers
 *
 * ========================================================================
 */

import React, { ChangeEvent } from "react";
import { Slider, TextField } from "@mui/material";
import { IFieldRendererProps, getCssClassName } from "./IFieldRendererProps";
import FieldUtilities from "../../dataform/FieldUtilities";
import { mcColors } from "../../UX/hooks/theme/mcColors";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "../../app/CreatorToolsHost";

/**
 * Props for SliderField component.
 */
export interface ISliderFieldProps extends Omit<IFieldRendererProps<number | string>, "onTextChange"> {
  /**
   * Callback for slider value changes.
   */
  onSliderChange: (fieldId: string, newValue: string) => void;

  /**
   * Callback for text input changes (overrides base onTextChange with different signature).
   */
  onSliderTextChange: (fieldId: string, newValue: string) => void;

  /**
   * Dynamic maximum resolved from a sibling field's current value (via maxValueField).
   * When set, overrides field.maxValue / field.suggestedMaxValue for the slider.
   */
  dynamicMax?: number;

  /**
   * Dynamic minimum resolved from a sibling field's current value (via minValueField).
   * When set, overrides field.minValue / field.suggestedMinValue for the slider.
   */
  dynamicMin?: number;
}

/**
 * Renders a slider with accompanying text input for numeric values.
 *
 * The slider provides visual feedback and easy adjustment,
 * while the text input allows precise value entry.
 */
export default function SliderField(props: ISliderFieldProps): JSX.Element {
  const { field, value, defaultValue, baseKey, theme, cssConfig, descriptionElements, sampleElements } = props;

  const title = FieldUtilities.getFieldTitle(field);
  const cssClass = getCssClassName("fieldWrap", cssConfig);

  // Determine min/max values from field definition, with dynamic overrides from sibling fields
  let minValue = field.minValue !== undefined ? field.minValue : field.suggestedMinValue;
  let maxValue = field.maxValue !== undefined ? field.maxValue : field.suggestedMaxValue;

  // Dynamic overrides from sibling field references (maxValueField / minValueField)
  if (props.dynamicMax !== undefined) {
    maxValue = props.dynamicMax;
  }
  if (props.dynamicMin !== undefined) {
    minValue = props.dynamicMin;
  }

  const step = field.step !== undefined ? field.step : 1;

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    props.onSliderChange(field.id, String(newValue));
  };

  const handleTextChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    props.onSliderTextChange(field.id, event.target.value);
  };

  const isDark = CreatorToolsHost.theme === CreatorToolsThemeStyle.dark;
  let numericValue = typeof value === "string" ? parseFloat(value) || 0 : (value as number) || 0;

  // Clamp value to the effective range so the slider thumb stays within bounds
  if (maxValue !== undefined && numericValue > maxValue) {
    numericValue = maxValue;
  }
  if (minValue !== undefined && numericValue < minValue) {
    numericValue = minValue;
  }

  return (
    <div
      className={cssClass}
      key={"fwa" + baseKey}
      style={{
        borderTopColor: isDark ? mcColors.gray5 : mcColors.gray2,
        borderBottomColor: isDark ? mcColors.gray4 : mcColors.gray3,
      }}
    >
      <div className={getCssClassName("sliderTitle", cssConfig)}>{title}</div>
      {descriptionElements}
      <div className="df-sliderSet" key={baseKey + "W"}>
        <Slider
          key={"sli" + baseKey}
          id={field.id}
          className={getCssClassName("slider", cssConfig)}
          step={step}
          min={minValue}
          max={maxValue}
          value={numericValue}
          onChange={handleSliderChange}
          size="small"
          sx={{ flex: 1 }}
        />
        <TextField
          className={getCssClassName("sliderInput", cssConfig)}
          key={baseKey + "TSL"}
          id={field.id}
          value={value as string}
          defaultValue={defaultValue as string}
          onChange={handleTextChange}
          size="small"
          variant="outlined"
          sx={{ width: 80, ml: 2 }}
        />
      </div>
      {sampleElements}
    </div>
  );
}
