// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ========================================================================
 * ARCHITECTURE: FormPropertyManager
 * ========================================================================
 *
 * FormPropertyManager is the core property management layer for DataForm.
 * It handles all get/set operations for form data across three possible
 * backing stores, abstracting the complexity of property access from the
 * UI rendering layer.
 *
 * KEY CONCEPTS:
 *
 * 1. THREE BACKING STORES:
 *    - dataPropertyObject: IDataPropertyObject - uses getProperty()/ensureProperty() pattern
 *    - getsetPropertyObject: IGetSetPropertyObject - uses getProperty()/setProperty() pattern
 *    - directObject: plain JavaScript object - direct property access
 *
 *    Only one is typically used at a time, but the manager checks all three.
 *
 * 2. SCALAR VS OBJECT REPRESENTATION:
 *    Some form fields can be represented as either a scalar value OR an object.
 *    For example, a damage field might be:
 *      - Scalar: 5
 *      - Object: { amount: 5, type: "fire" }
 *
 *    The manager handles "upscaling" (scalar → object) and "downscaling"
 *    (object → scalar when only default values remain).
 *
 * 3. TYPE COERCION:
 *    Input from form controls is always strings. The manager converts to
 *    the appropriate type based on the field's dataType (int, float, boolean, etc.)
 *
 * ========================================================================
 * UPSCALE / DOWNSCALE STRATEGY
 * ========================================================================
 *
 * The "upscale on edit, downscale on persist" pattern is a core design
 * principle throughout this form system. It allows the UI to handle a
 * canonical (most complex) representation while persisting the simplest
 * valid format.
 *
 * THE PATTERN:
 *
 *   ┌────────────────┐     upscale()      ┌────────────────┐
 *   │  File/Stored   │  ───────────────▶  │  Edit Form     │
 *   │  (simplest)    │                    │  (canonical)   │
 *   └────────────────┘                    └────────────────┘
 *          ▲                                      │
 *          │            downscale()               │
 *          └──────────────────────────────────────┘
 *
 * WHY THIS MATTERS:
 *
 *   Minecraft JSON often supports multiple representations of the same data.
 *   For example, the `repair_items` field in `minecraft:repairable`:
 *
 *     Simple:   "minecraft:iron_ingot"
 *     Array:    ["minecraft:iron_ingot", "minecraft:gold_ingot"]
 *     Object:   { "items": ["minecraft:iron_ingot"], "repair_amount": 50 }
 *
 *   Without upscaling, the editor would need to handle all three forms.
 *   With upscaling, we always edit the object form and simplify on save.
 *
 * TWO LAYERS OF UPSCALING:
 *
 *   1. DATA LAYER (FormPropertyManager):
 *      - upscaleDirectObject(): Converts scalars to objects
 *        Example: 5 → { __scalar: 5 } or { amount: 5 }
 *      - downscaleDirectObject(): Collapses back to scalar if only defaults
 *        Example: { amount: 5 } → 5 (if amount is the only non-default)
 *
 *   2. UI LAYER (DataFormUtilities.selectFieldForValue):
 *      - Selects the appropriate field alternate based on actual value type
 *      - Ensures object values use object editors, arrays use array editors
 *      - Works with field "alternates" that define multiple type representations
 *
 * FIELD ALTERNATES:
 *
 *   A field definition can have multiple type representations via `alternates`.
 *   Each alternate is a complete field definition with a different dataType.
 *
 *   Example from repair_items:
 *     Primary:   { id: "repair_items", dataType: stringArray }
 *     Alternate: { dataType: objectArray, subForm: repairItemsSubForm }
 *
 *   selectFieldForValue() examines the actual data and picks the right variant.
 *
 * IMPLEMENTATION LOCATIONS:
 *
 *   - FormPropertyManager.upscaleDirectObject() - Scalar → Object
 *   - FormPropertyManager.downscaleDirectObject() - Object → Scalar
 *   - FormPropertyManager.setPropertyValue() - Uses upscale → edit → downscale
 *   - DataFormUtilities.selectFieldForValue() - Picks field variant for value type
 *   - DataForm.tsx render - Uses selectFieldForValue() for rendering
 *
 * EXTENDING THE PATTERN:
 *
 *   When adding new field types or component editors:
 *   1. Define all possible representations as field alternates
 *   2. Ensure selectFieldForValue() handles the new types
 *   3. The downscale logic automatically simplifies on persist
 *   4. Test with both simple and complex input data
 *
 * ========================================================================
 *
 * USAGE:
 *    const manager = new FormPropertyManager(definition, {
 *      dataPropertyObject: myDataPropertyObject,
 *      getsetPropertyObject: myGetSetPropertyObject,
 *      directObject: myDirectObject,
 *    });
 *
 *    // Get a property value
 *    const damage = manager.getProperty("damage", 0);
 *
 *    // Set a property value (returns updated directObject if applicable)
 *    const updatedObj = manager.setPropertyValue("damage", 10, currentDirectObject);
 *
 * RELATED FILES:
 *    - src/dataformux/DataForm.tsx - Main UI component that uses this manager
 *    - src/dataform/IField.ts - Field definitions including FieldDataType
 *    - src/dataform/IFormDefinition.ts - Form structure definitions
 *    - src/dataform/DataFormUtilities.ts - Static utilities for form operations
 *
 * ========================================================================
 */

import IFormDefinition from "./IFormDefinition";
import IField, { FieldDataType } from "./IField";
import IProperty from "./IProperty";
import Log from "../core/Log";
import Utilities from "../core/Utilities";
import DataFormUtilities from "./DataFormUtilities";

/**
 * Interface for objects that provide property access via getProperty/ensureProperty pattern.
 * Used by block-style data objects.
 */
export interface IDataPropertyObject {
  getProperty(name: string): IProperty | undefined;
  ensureProperty(name: string): IProperty;
  onPropertyChanged: {
    subscribe(callback: () => void): void;
    unsubscribe(callback: () => void): void;
  };
}

/**
 * Interface for objects that provide property access via getProperty/setProperty pattern.
 * Used by simpler data objects.
 */
export interface IGetSetPropertyObject {
  getProperty(name: string): any;
  setProperty(name: string, value: any): void;
  setBaseValue?(value: any): void;
}

/**
 * Configuration options for FormPropertyManager.
 */
export interface IFormPropertyManagerOptions {
  /** Property object using getProperty/ensureProperty pattern */
  dataPropertyObject?: IDataPropertyObject;
  /** Property object using getProperty/setProperty pattern */
  getsetPropertyObject?: IGetSetPropertyObject;
  /** Plain JavaScript object for direct property access */
  directObject?: any;
}

/**
 * Result of a property update operation.
 */
export interface IPropertyUpdateResult {
  /** The updated direct object (after upscaling/downscaling) */
  updatedDirectObject: any;
  /** The property that was changed */
  property: IProperty;
  /** The new value */
  newValue: any;
}

/**
 * FormPropertyManager handles all property get/set operations for DataForm.
 *
 * It abstracts the complexity of:
 * - Multiple backing stores (dataPropertyObject, getsetPropertyObject, directObject)
 * - Scalar to object conversion (upscaling) and back (downscaling)
 * - Type coercion from string inputs to typed values
 * - Default value handling
 */
export default class FormPropertyManager {
  private _definition: IFormDefinition;
  private _dataPropertyObject: IDataPropertyObject | undefined;
  private _getsetPropertyObject: IGetSetPropertyObject | undefined;

  constructor(definition: IFormDefinition, options: IFormPropertyManagerOptions = {}) {
    this._definition = definition;
    this._dataPropertyObject = options.dataPropertyObject;
    this._getsetPropertyObject = options.getsetPropertyObject;
  }

  /**
   * Gets the form definition.
   */
  get definition(): IFormDefinition {
    return this._definition;
  }

  /**
   * Updates the form definition.
   */
  set definition(value: IFormDefinition) {
    this._definition = value;
  }

  /**
   * Updates the backing store objects.
   */
  updateBackingStores(options: IFormPropertyManagerOptions): void {
    this._dataPropertyObject = options.dataPropertyObject;
    this._getsetPropertyObject = options.getsetPropertyObject;
  }

  /**
   * Gets a field definition by its ID.
   *
   * @param id - The field ID to look up
   * @returns The field definition, or undefined if not found
   */
  getFieldById(id: string): IField | undefined {
    const fields = this._definition.fields;

    // Special case: __scalar represents the scalar field when no upgrade name is specified
    if (id === "__scalar" && this._definition.scalarField && !this._definition.scalarFieldUpgradeName) {
      return this._definition.scalarField;
    }

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (field.id === id) {
        return field;
      }
    }

    return undefined;
  }

  /**
   * Gets a property value from the backing stores.
   *
   * Checks all three backing stores in order:
   * 1. dataPropertyObject
   * 2. getsetPropertyObject
   * 3. directObject
   *
   * @param name - The property name
   * @param defaultValue - Default value if property not found
   * @param directObject - The current direct object (may be updated state)
   * @returns The property value, or defaultValue if not found
   */
  getProperty(name: string, defaultValue?: any, directObject?: any): any {
    let value: any = undefined;

    // Get default from field definition if not provided
    if (defaultValue === undefined) {
      const field = this.getFieldById(name);
      if (field) {
        defaultValue = field.defaultValue;
      }
    }

    // Check dataPropertyObject
    if (this._dataPropertyObject !== undefined) {
      const prop = this._dataPropertyObject.getProperty(name);
      if (prop !== undefined) {
        value = prop.value;
      }
    }

    // Check getsetPropertyObject
    if (this._getsetPropertyObject !== undefined) {
      value = this._getsetPropertyObject.getProperty(name);
    }

    // Check directObject (upscale first to handle scalar values)
    if (directObject !== undefined) {
      const upscaledObject = this.upscaleDirectObject(directObject);
      value = upscaledObject[name];
    }

    // Return default if no value found
    if (value === undefined) {
      return defaultValue;
    }

    return value;
  }

  /**
   * Gets a property value as an integer.
   *
   * @param name - The property name
   * @param defaultValue - Default value if property not found or not convertible
   * @param directObject - The current direct object
   * @returns The property value as an integer
   */
  getPropertyAsInt(name: string, defaultValue?: number, directObject?: any): number | undefined {
    const value = this.getProperty(name, defaultValue, directObject);

    if (typeof value === "boolean") {
      return value ? 1 : 0;
    } else if (typeof value === "number") {
      return value;
    } else if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    }

    return defaultValue;
  }

  /**
   * Gets a property value as a boolean.
   *
   * @param name - The property name
   * @param defaultValue - Default value if property not found
   * @param directObject - The current direct object
   * @returns The property value as a boolean
   */
  getPropertyAsBoolean(name: string, defaultValue?: boolean, directObject?: any): boolean {
    const value = this.getProperty(name, defaultValue, directObject);

    if (typeof value === "boolean") {
      return value;
    } else if (typeof value === "number") {
      return value !== 0;
    } else if (typeof value === "string") {
      if (value !== undefined && value !== "" && value !== "false" && value !== "0") {
        return true;
      }
      return false;
    }

    return defaultValue === true;
  }

  /**
   * Converts a string value to the appropriate typed value based on field data type.
   *
   * @param field - The field definition
   * @param value - The value to convert (typically a string from form input)
   * @returns The typed value
   */
  getTypedData(field: IField, value: any): any {
    if (
      field.dataType === FieldDataType.int ||
      field.dataType === FieldDataType.intBoolean ||
      field.dataType === FieldDataType.intEnum ||
      field.dataType === FieldDataType.intValueLookup
    ) {
      if (typeof value === "number") {
        return value;
      } else if (typeof value === "string") {
        if (value.length === 0) {
          return undefined;
        }
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? undefined : parsed;
      } else if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
    } else if (field.dataType === FieldDataType.number || field.dataType === FieldDataType.float) {
      if (typeof value === "number") {
        return value;
      } else if (typeof value === "string") {
        if (value.length === 0) {
          return undefined;
        }
        const parsed = parseFloat(value);
        return isNaN(parsed) ? undefined : parsed;
      } else if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
    } else if (DataFormUtilities.isString(field.dataType)) {
      if (typeof value === "string") {
        return value.trim();
      } else {
        return value.toString().trim();
      }
    }

    return value;
  }

  /**
   * Converts a scalar value to an object representation.
   *
   * This is needed when a field can be represented as either:
   * - A scalar: 5
   * - An object: { amount: 5, type: "fire" }
   *
   * @param directObject - The value to upscale (may be scalar or object)
   * @returns An object representation
   */
  upscaleDirectObject(directObject: { [propName: string]: any } | string | number | boolean): { [name: string]: any } {
    if (typeof directObject === "string" || typeof directObject === "number" || typeof directObject === "boolean") {
      // Use special __scalar key if no upgrade name specified
      if (this._definition.scalarField && !this._definition.scalarFieldUpgradeName) {
        return {
          __scalar: directObject,
        };
      }

      // Use the scalar upgrade field name if specified
      if (this._definition.scalarFieldUpgradeName) {
        const fi = DataFormUtilities.getFieldById(this._definition, this._definition.scalarFieldUpgradeName);

        if (fi) {
          const retObj: { [name: string]: string | number | boolean } = {};

          if (Utilities.isUsableAsObjectKey(fi.id)) {
            retObj[fi.id] = directObject;
          } else {
            Log.unsupportedToken(fi.id);
          }
          return retObj;
        }
      }

      return { value: directObject };
    }

    if (directObject === undefined) {
      return {};
    }

    return directObject;
  }

  /**
   * Checks if the object has any values besides scalar and default values.
   *
   * Used to determine if an object can be collapsed back to a scalar.
   *
   * @param directObject - The object to check
   * @returns True if the object has unique values
   */
  directObjectHasUniqueValuesBesidesScalar(directObject: { [propName: string]: any }): boolean {
    const fields = this._definition.fields;

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (
        field.id !== "__scalar" &&
        (this._definition.scalarFieldUpgradeName === undefined || field.id !== this._definition.scalarFieldUpgradeName)
      ) {
        if (directObject[field.id] !== undefined && directObject[field.id] !== field.defaultValue) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Converts an object representation back to a scalar if possible.
   *
   * This collapses objects that only contain:
   * - Empty values
   * - Default values
   * - The scalar field value
   *
   * @param directObject - The object to potentially downscale
   * @returns Either the original object or a scalar value
   */
  downscaleDirectObject(directObject: { [propName: string]: any }): any {
    const fields = this._definition.fields;

    // Collapse empty objects and default values
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      if (!field.retainIfEmptyOrDefault) {
        let hasContent = false;

        if (directObject[field.id] !== undefined) {
          const fieldData = directObject[field.id];

          if (typeof fieldData === "object") {
            for (const propVal in directObject[field.id]) {
              if (propVal.length !== undefined && propVal.length > 0) {
                hasContent = true;
              }
            }
          } else {
            if (field.defaultValue === undefined || fieldData !== field.defaultValue) {
              hasContent = true;
            }
          }
        }

        if (!hasContent) {
          if (Utilities.isUsableAsObjectKey(field.id)) {
            directObject[field.id] = undefined;
          }
        }
      }
    }

    const hasUniqueValuesBesidesScalar = this.directObjectHasUniqueValuesBesidesScalar(directObject);

    if (!hasUniqueValuesBesidesScalar) {
      // Convert down to a scalar value if possible
      if (this._definition.scalarFieldUpgradeName) {
        if (directObject[this._definition.scalarFieldUpgradeName] !== undefined) {
          directObject = directObject[this._definition.scalarFieldUpgradeName];
        }
      } else {
        if (directObject["__scalar"] !== undefined) {
          directObject = directObject["__scalar"];
        }
      }
    }

    return directObject;
  }

  /**
   * Sets a property value across all applicable backing stores.
   *
   * @param id - The property ID to set
   * @param val - The new value
   * @param currentDirectObject - The current direct object state
   * @returns The update result with the new direct object state
   */
  setPropertyValue(id: string, val: any, currentDirectObject?: any): IPropertyUpdateResult {
    const property: IProperty = { id, value: val };

    // Update dataPropertyObject if present
    if (this._dataPropertyObject !== undefined) {
      const prop = this._dataPropertyObject.ensureProperty(id);
      prop.value = val;
    }

    // Update getsetPropertyObject if present
    if (this._getsetPropertyObject !== undefined) {
      if (id === "__scalar" && this._getsetPropertyObject.setBaseValue) {
        this._getsetPropertyObject.setBaseValue(val);
      } else {
        this._getsetPropertyObject.setProperty(id, val);
      }
    }

    // Update directObject if present
    let updatedDirectObject = currentDirectObject;

    if (currentDirectObject !== undefined) {
      updatedDirectObject = this.upscaleDirectObject(currentDirectObject);
      updatedDirectObject[id] = val;
      updatedDirectObject = this.downscaleDirectObject(updatedDirectObject);
    }

    return {
      updatedDirectObject,
      property,
      newValue: val,
    };
  }

  /**
   * Processes an input update from a form control.
   *
   * This is the main entry point for handling user input. It:
   * 1. Finds the field definition
   * 2. Converts the string input to the appropriate type
   * 3. Updates all backing stores
   *
   * @param id - The field ID being updated
   * @param data - The string value from the form control
   * @param currentDirectObject - The current direct object state
   * @returns The update result, or undefined if the update failed
   */
  processInputUpdate(id: string, data: string, currentDirectObject?: any): IPropertyUpdateResult | undefined {
    if (!Utilities.isUsableAsObjectKey(id)) {
      Log.unsupportedToken(id);
      return undefined;
    }

    const field = this.getFieldById(id);

    if (field === undefined) {
      Log.fail("Could not find field " + id);
      return undefined;
    }

    const val = this.getTypedData(field, data);

    return this.setPropertyValue(id, val, currentDirectObject);
  }

  /**
   * Toggles a boolean property value.
   *
   * @param id - The property ID to toggle
   * @param defaultValue - The default value to use if property is not set
   * @param currentDirectObject - The current direct object state
   * @returns The update result
   */
  toggleBooleanProperty(id: string, defaultValue: boolean, currentDirectObject?: any): IPropertyUpdateResult {
    const currentVal = this.getPropertyAsBoolean(id, defaultValue, currentDirectObject);
    const newVal = !currentVal;

    return this.setPropertyValue(id, newVal, currentDirectObject);
  }
}
