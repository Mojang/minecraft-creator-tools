/**
 * ========================================================================
 * ARCHITECTURE: IFieldRendererProps.ts
 * ========================================================================
 *
 * This interface defines the standard props passed to all field renderer
 * components. Field renderers are extracted from DataForm.tsx to create
 * modular, testable components for each field type.
 *
 * DESIGN PRINCIPLES:
 *
 * 1. MINIMAL SURFACE AREA:
 *    Field renderers receive only what they need to render and update
 *    a single field. They don't need access to the entire form.
 *
 * 2. VALUE-BASED, NOT REFERENCE-BASED:
 *    Renderers receive the current value and call back with new values.
 *    They don't directly mutate backing stores.
 *
 * 3. THEME PASSTHROUGH:
 *    Theme is passed through so components can apply consistent styling.
 *
 * 4. READ-ONLY SUPPORT:
 *    All renderers must handle read-only mode gracefully.
 *
 * USAGE:
 *
 * ```tsx
 * import { IFieldRendererProps } from './IFieldRendererProps';
 *
 * export default function TextboxField(props: IFieldRendererProps<string>) {
 *   return (
 *     <FormInput
 *       value={props.value || ''}
 *       onChange={(_, data) => props.onChange(data.value)}
 *       // ...
 *     />
 *   );
 * }
 * ```
 *
 * RELATED FILES:
 *   - TextboxField.tsx - Text/number input fields
 *   - CheckboxField.tsx - Boolean toggle fields
 *   - FieldRendererRegistry.ts - Maps FieldDataType to renderers
 *   - DataForm.tsx - Orchestrates field rendering
 *   - IField.ts - Field definition interface
 *
 * ========================================================================
 */

import React from "react";
import IField from "../../dataform/IField";
import ISimpleReference from "../../dataform/ISimpleReference";
import IProjectTheme from "../../UX/types/IProjectTheme";

/**
 * Configuration for CSS class name generation.
 * Matches the pattern from DataForm's getCssClassName method.
 */
export interface ICssClassConfig {
  /** Whether to use narrow display variant (dfn- prefix vs dfw- prefix) */
  displayNarrow: boolean;
}

/**
 * Standard props interface for all field renderer components.
 *
 * @typeParam T - The type of the field value (string, number, boolean, etc.)
 */
export interface IFieldRendererProps<T = unknown> {
  /** The field definition from the form schema */
  field: IField;

  /** Current value of the field (may be undefined if not set) */
  value: T | undefined;

  /** Default value for the field (from field definition or computed) */
  defaultValue: T | undefined;

  /** Unique key prefix for React keys (typically objectId + "." + field.id) */
  baseKey: string;

  /** Theme for consistent styling */
  theme: IProjectTheme;

  /** Whether the field is read-only */
  readOnly: boolean;

  /** CSS class configuration for generating class names */
  cssConfig: ICssClassConfig;

  /**
   * Callback when the field value changes.
   * The renderer should call this with the new value.
   */
  onChange: (newValue: T, field: IField) => void;

  /**
   * Optional: Choices for dropdown/select fields.
   * Populated from field.choices or resolved from lookupId.
   */
  choices?: ISimpleReference[];

  /**
   * Optional: Working value for intermediate states.
   * Used for float/number fields to preserve user's typing (e.g., "3." while typing "3.5")
   */
  workingValue?: string;

  /**
   * Optional: Callback for text-based changes that need working value tracking.
   * Called instead of onChange when the field needs to track intermediate string values.
   */
  onTextChange?: (newText: string, field: IField) => void;

  /**
   * Optional: Additional description elements to display below the field.
   */
  descriptionElements?: React.JSX.Element[];

  /**
   * Optional: Sample value elements to display below the field.
   */
  sampleElements?: React.JSX.Element[];
}

/**
 * Extended props for fields that display as dropdowns.
 */
export interface IDropdownFieldRendererProps<T = unknown> extends IFieldRendererProps<T> {
  /** Choices for the dropdown, required for this renderer */
  choices: ISimpleReference[];
}

/**
 * Result of rendering a field - includes both the element and optional metadata.
 */
export interface IFieldRenderResult {
  /** The rendered field element wrapped in appropriate containers */
  element: React.JSX.Element;

  /**
   * Optional: Names to register in form arrays (for checkboxes, dropdowns).
   * Used by DataForm to track grouped components.
   */
  registrations?: {
    checkboxNames?: string[];
    dropdownNames?: string[];
    formComponentNames?: string[];
  };
}

/**
 * Helper function to generate CSS class names matching DataForm's pattern.
 *
 * @param className - Base class name (e.g., "fieldWrap")
 * @param config - CSS configuration with displayNarrow setting
 * @returns Combined class string (e.g., "df-fieldWrap dfn-fieldWrap" or "df-fieldWrap dfw-fieldWrap")
 */
export function getCssClassName(className: string, config: ICssClassConfig): string {
  if (config.displayNarrow) {
    return "df-" + className + " dfn-" + className;
  }
  return "df-" + className + " dfw-" + className;
}

/**
 * Type for a field renderer component.
 * All field renderers should match this signature.
 */
export type FieldRenderer<T = unknown> = React.FC<IFieldRendererProps<T>>;

/**
 * Type for a field renderer that returns structured results.
 * Used when the renderer needs to provide registration data.
 */
export type FieldRendererWithResult<T = unknown> = (props: IFieldRendererProps<T>) => IFieldRenderResult;
