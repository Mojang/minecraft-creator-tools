/**
 * McFormInput - Material UI TextField wrapper for Northstar migration
 *
 * This component provides a similar API to Northstar's FormInput component
 * while using Material UI under the hood.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Migration from Northstar:
 * ```tsx
 * // Before (Northstar)
 * import { FormInput } from "@fluentui/react-northstar";
 * <FormInput
 *   label="Name"
 *   value={name}
 *   onChange={(e, data) => setName(data?.value || "")}
 * />
 *
 * // After (McFormInput)
 * import McFormInput from "./McFormInput";
 * <McFormInput
 *   label="Name"
 *   value={name}
 *   onChange={(value) => setName(value)}
 * />
 * ```
 */

import React, { ChangeEvent, useId, ReactNode } from "react";
import { TextField, InputAdornment, useTheme } from "@mui/material";
import { mcColors } from "../../../../hooks/theme/mcColors";

interface McFormInputProps {
  /** Label for the input */
  label?: string;
  /** Current value */
  value?: string;
  /** Callback when value changes */
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Helper text below the input */
  helperText?: string;
  /** Error state */
  error?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is required */
  required?: boolean;
  /** Whether the input is read-only */
  readOnly?: boolean;
  /** Whether to take full width */
  fullWidth?: boolean;
  /** Input type (text, password, number, etc.) */
  type?: string;
  /** Size variant */
  size?: "small" | "medium";
  /** Icon/element to show at the start */
  startAdornment?: ReactNode;
  /** Icon/element to show at the end */
  endAdornment?: ReactNode;
  /** Maximum length */
  maxLength?: number;
  /** Whether this is a multiline textarea */
  multiline?: boolean;
  /** Number of rows for multiline */
  rows?: number;
  /** Minimum rows for multiline */
  minRows?: number;
  /** Maximum rows for multiline */
  maxRows?: number;
  /** Additional CSS class */
  className?: string;
  /** Custom styles */
  sx?: object;
  /** ID for the input */
  id?: string;
  /** Name attribute */
  name?: string;
  /** Autofocus */
  autoFocus?: boolean;
  /** Callback when input loses focus */
  onBlur?: () => void;
  /** Callback when Enter key is pressed */
  onEnterKey?: () => void;
}

/**
 * McFormInput - A Material UI-based text input component
 *
 * Replaces Northstar's FormInput with a similar API.
 */
export default function McFormInput({
  label,
  value = "",
  onChange,
  placeholder,
  helperText,
  error = false,
  disabled = false,
  required = false,
  readOnly = false,
  fullWidth = true,
  type = "text",
  size = "small",
  startAdornment,
  endAdornment,
  maxLength,
  multiline = false,
  rows,
  minRows,
  maxRows,
  className,
  sx,
  id,
  name,
  autoFocus = false,
  onBlur,
  onEnterKey,
}: McFormInputProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const generatedId = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.value, event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !multiline && onEnterKey) {
      event.preventDefault();
      onEnterKey();
    }
  };

  return (
    <TextField
      id={id || generatedId}
      name={name}
      label={label}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      helperText={helperText}
      error={error}
      disabled={disabled}
      required={required}
      fullWidth={fullWidth}
      type={type}
      size={size}
      multiline={multiline}
      rows={rows}
      minRows={minRows}
      maxRows={maxRows}
      autoFocus={autoFocus}
      className={className}
      inputProps={{
        maxLength,
        readOnly,
      }}
      InputProps={{
        startAdornment: startAdornment ? <InputAdornment position="start">{startAdornment}</InputAdornment> : undefined,
        endAdornment: endAdornment ? <InputAdornment position="end">{endAdornment}</InputAdornment> : undefined,
      }}
      sx={{
        "& .MuiOutlinedInput-root": {
          "& fieldset": {
            borderColor: isDark ? mcColors.gray4 : mcColors.gray3,
          },
          "&:hover fieldset": {
            borderColor: mcColors.green4,
          },
          "&.Mui-focused fieldset": {
            borderColor: mcColors.green4,
          },
        },
        ...sx,
      }}
    />
  );
}
