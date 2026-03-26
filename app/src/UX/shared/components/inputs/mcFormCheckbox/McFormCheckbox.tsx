/**
 * McFormCheckbox - Material UI Checkbox wrapper for Northstar migration
 *
 * This component provides a similar API to Northstar's FormCheckbox component
 * while using Material UI under the hood.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Migration from Northstar:
 * ```tsx
 * // Before (Northstar)
 * import { FormCheckbox } from "@fluentui/react-northstar";
 * <FormCheckbox
 *   label="Enable feature"
 *   checked={isEnabled}
 *   onChange={(e, data) => setEnabled(data?.checked || false)}
 * />
 *
 * // After (McFormCheckbox)
 * import McFormCheckbox from "./McFormCheckbox";
 * <McFormCheckbox
 *   label="Enable feature"
 *   checked={isEnabled}
 *   onChange={(checked) => setEnabled(checked)}
 * />
 * ```
 */

import React, { ChangeEvent, ReactNode, useId } from "react";
import { FormControlLabel, Checkbox, FormHelperText, FormControl, useTheme, Box } from "@mui/material";
import { mcColors } from "../../../../hooks/theme/mcColors";

interface McFormCheckboxProps {
  /** Label for the checkbox */
  label?: ReactNode;
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Callback when checked state changes */
  onChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void;
  /** Helper text below the checkbox */
  helperText?: string;
  /** Error state */
  error?: boolean;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Whether the checkbox is required */
  required?: boolean;
  /** Indeterminate state (for partial selection) */
  indeterminate?: boolean;
  /** Size variant */
  size?: "small" | "medium";
  /** Additional CSS class */
  className?: string;
  /** Custom styles */
  sx?: object;
  /** ID for the checkbox */
  id?: string;
  /** Name attribute */
  name?: string;
  /** Label placement */
  labelPlacement?: "end" | "start" | "top" | "bottom";
}

/**
 * McFormCheckbox - A Material UI-based checkbox component
 *
 * Replaces Northstar's FormCheckbox with a similar API.
 */
export default function McFormCheckbox({
  label,
  checked = false,
  onChange,
  helperText,
  error = false,
  disabled = false,
  required = false,
  indeterminate = false,
  size = "small",
  className,
  sx,
  id,
  name,
  labelPlacement = "end",
}: McFormCheckboxProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const generatedId = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.checked, event);
  };

  const checkbox = (
    <Checkbox
      id={id || generatedId}
      name={name}
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
      required={required}
      indeterminate={indeterminate}
      size={size}
      sx={{
        color: isDark ? mcColors.gray3 : mcColors.gray4,
        "&.Mui-checked": {
          color: mcColors.green4,
        },
        "&.MuiCheckbox-indeterminate": {
          color: mcColors.green4,
        },
      }}
    />
  );

  if (!label && !helperText) {
    return (
      <Box className={className} sx={sx}>
        {checkbox}
      </Box>
    );
  }

  return (
    <FormControl error={error} disabled={disabled} className={className} sx={sx}>
      <FormControlLabel
        control={checkbox}
        label={label}
        labelPlacement={labelPlacement}
        sx={{
          "& .MuiFormControlLabel-label": {
            color: isDark ? mcColors.white : mcColors.gray6,
          },
        }}
      />
      {helperText && <FormHelperText sx={{ ml: 0 }}>{helperText}</FormHelperText>}
    </FormControl>
  );
}
