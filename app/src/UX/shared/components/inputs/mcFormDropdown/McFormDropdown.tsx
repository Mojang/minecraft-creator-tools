/**
 * McFormDropdown - Material UI Select wrapper for Northstar migration
 *
 * This component provides a similar API to Northstar's FormDropdown component
 * while using Material UI under the hood.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Migration from Northstar:
 * ```tsx
 * // Before (Northstar)
 * import { FormDropdown } from "@fluentui/react-northstar";
 * <FormDropdown
 *   label="Option"
 *   items={[{ content: "A" }, { content: "B" }]}
 *   value={value}
 *   onChange={(e, data) => setValue(data.value)}
 * />
 *
 * // After (McFormDropdown)
 * import McFormDropdown from "./McFormDropdown";
 * <McFormDropdown
 *   label="Option"
 *   items={[{ key: "a", content: "A" }, { key: "b", content: "B" }]}
 *   value="a"
 *   onChange={(value, item) => setValue(value)}
 * />
 * ```
 */

import React, { ReactNode, useId } from "react";
import { FormControl, InputLabel, Select, MenuItem, FormHelperText, useTheme, SelectChangeEvent } from "@mui/material";
import { mcColors } from "../../../../hooks/theme/mcColors";

/**
 * Dropdown item definition
 */
export interface McFormDropdownItem {
  /** Unique key/value for the item */
  key: string;
  /** Display content */
  content: ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Icon to display before the content */
  icon?: ReactNode;
}

interface McFormDropdownProps {
  /** Label for the dropdown */
  label?: string;
  /** Array of dropdown items */
  items: McFormDropdownItem[];
  /** Currently selected value (key) */
  value?: string;
  /** Callback when selection changes */
  onChange?: (value: string, item: McFormDropdownItem | undefined) => void;
  /** Placeholder text when no selection */
  placeholder?: string;
  /** Helper text below the dropdown */
  helperText?: string;
  /** Error state */
  error?: boolean;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Whether the dropdown is required */
  required?: boolean;
  /** Whether to take full width */
  fullWidth?: boolean;
  /** Size variant */
  size?: "small" | "medium";
  /** Additional CSS class */
  className?: string;
  /** Custom styles */
  sx?: object;
  /** ID for the form control */
  id?: string;
}

/**
 * McFormDropdown - A Material UI-based dropdown component
 *
 * Replaces Northstar's FormDropdown with a similar API.
 */
export default function McFormDropdown({
  label,
  items,
  value = "",
  onChange,
  placeholder,
  helperText,
  error = false,
  disabled = false,
  required = false,
  fullWidth = true,
  size = "small",
  className,
  sx,
  id,
}: McFormDropdownProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const generatedId = useId();
  const labelId = `${id || generatedId}-label`;

  const handleChange = (event: SelectChangeEvent<string>) => {
    const newValue = event.target.value;
    const selectedItem = items.find((item) => item.key === newValue);
    onChange?.(newValue, selectedItem);
  };

  return (
    <FormControl
      fullWidth={fullWidth}
      error={error}
      disabled={disabled}
      required={required}
      size={size}
      className={className}
      sx={sx}
    >
      {label && <InputLabel id={labelId}>{label}</InputLabel>}
      <Select
        labelId={labelId}
        id={id || generatedId}
        value={value}
        label={label}
        onChange={handleChange}
        displayEmpty={!!placeholder}
        sx={{
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: isDark ? mcColors.gray4 : mcColors.gray3,
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: mcColors.green4,
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: mcColors.green4,
          },
        }}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            <em>{placeholder}</em>
          </MenuItem>
        )}
        {items.map((item) => (
          <MenuItem key={item.key} value={item.key} disabled={item.disabled}>
            {item.icon && (
              <span style={{ marginRight: 8, display: "inline-flex", alignItems: "center" }}>{item.icon}</span>
            )}
            {item.content}
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}
