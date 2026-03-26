// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import FormPropertyManager, { IDataPropertyObject, IGetSetPropertyObject } from "../dataform/FormPropertyManager";
import IFormDefinition from "../dataform/IFormDefinition";
import IField, { FieldDataType } from "../dataform/IField";
import IProperty from "../dataform/IProperty";
import DataFormUtilities from "../dataform/DataFormUtilities";

describe("FormPropertyManager", () => {
  // ==========================================================================
  // TEST FIXTURES
  // ==========================================================================

  /**
   * Creates a basic form definition for testing.
   */
  function createBasicFormDefinition(): IFormDefinition {
    return {
      id: "testForm",
      title: "Test Form",
      fields: [
        { id: "name", dataType: FieldDataType.string, title: "Name" },
        { id: "count", dataType: FieldDataType.int, title: "Count", defaultValue: 0 },
        { id: "enabled", dataType: FieldDataType.boolean, title: "Enabled", defaultValue: false },
        { id: "amount", dataType: FieldDataType.float, title: "Amount" },
        { id: "type", dataType: FieldDataType.stringEnum, title: "Type", defaultValue: "default" },
      ],
    };
  }

  /**
   * Creates a form definition with scalar field support.
   */
  function createScalarFormDefinition(): IFormDefinition {
    return {
      id: "scalarForm",
      title: "Scalar Form",
      scalarField: { id: "__scalar", dataType: FieldDataType.int, title: "Value" },
      fields: [{ id: "extra", dataType: FieldDataType.string, title: "Extra" }],
    };
  }

  /**
   * Creates a form definition with scalar upgrade field.
   */
  function createScalarUpgradeFormDefinition(): IFormDefinition {
    return {
      id: "scalarUpgradeForm",
      title: "Scalar Upgrade Form",
      scalarFieldUpgradeName: "value",
      fields: [
        { id: "value", dataType: FieldDataType.int, title: "Value" },
        { id: "type", dataType: FieldDataType.string, title: "Type" },
      ],
    };
  }

  /**
   * Creates a mock IDataPropertyObject for testing.
   */
  function createMockDataPropertyObject(): IDataPropertyObject & { properties: { [key: string]: IProperty } } {
    const properties: { [key: string]: IProperty } = {};

    return {
      properties,
      getProperty(name: string): IProperty | undefined {
        return properties[name];
      },
      ensureProperty(name: string): IProperty {
        if (!properties[name]) {
          properties[name] = { id: name, value: undefined };
        }
        return properties[name];
      },
      onPropertyChanged: {
        subscribe: () => {},
        unsubscribe: () => {},
      },
    };
  }

  /**
   * Creates a mock IGetSetPropertyObject for testing.
   */
  function createMockGetSetPropertyObject(): IGetSetPropertyObject & { data: { [key: string]: any }; baseValue: any } {
    const data: { [key: string]: any } = {};
    let baseValue: any = undefined;

    return {
      data,
      get baseValue() {
        return baseValue;
      },
      set baseValue(val: any) {
        baseValue = val;
      },
      getProperty(name: string): any {
        return data[name];
      },
      setProperty(name: string, value: any): void {
        data[name] = value;
      },
      setBaseValue(value: any): void {
        baseValue = value;
      },
    };
  }

  // ==========================================================================
  // CONSTRUCTOR & BASIC SETUP
  // ==========================================================================

  describe("constructor", () => {
    it("should create a manager with a form definition", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      expect(manager.definition).to.equal(definition);
    });

    it("should accept backing store options", () => {
      const definition = createBasicFormDefinition();
      const dataPropertyObject = createMockDataPropertyObject();
      const getsetPropertyObject = createMockGetSetPropertyObject();

      const manager = new FormPropertyManager(definition, {
        dataPropertyObject,
        getsetPropertyObject,
      });

      expect(manager.definition).to.equal(definition);
    });
  });

  describe("updateBackingStores", () => {
    it("should update backing stores", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const dataPropertyObject = createMockDataPropertyObject();
      dataPropertyObject.properties["name"] = { id: "name", value: "Test" };

      manager.updateBackingStores({ dataPropertyObject });

      expect(manager.getProperty("name", undefined, undefined)).to.equal("Test");
    });
  });

  // ==========================================================================
  // FIELD LOOKUP
  // ==========================================================================

  describe("getFieldById", () => {
    it("should find a field by ID", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const field = manager.getFieldById("name");

      expect(field).to.not.be.undefined;
      expect(field?.id).to.equal("name");
      expect(field?.dataType).to.equal(FieldDataType.string);
    });

    it("should return undefined for unknown field", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const field = manager.getFieldById("unknown");

      expect(field).to.be.undefined;
    });

    it("should return scalar field for __scalar ID", () => {
      const definition = createScalarFormDefinition();
      const manager = new FormPropertyManager(definition);

      const field = manager.getFieldById("__scalar");

      expect(field).to.not.be.undefined;
      expect(field?.id).to.equal("__scalar");
    });

    it("should not return scalar field when scalarFieldUpgradeName is set", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      // With scalarFieldUpgradeName, __scalar should not match the scalar field
      const field = manager.getFieldById("__scalar");

      expect(field).to.be.undefined;
    });
  });

  // ==========================================================================
  // PROPERTY GETTERS
  // ==========================================================================

  describe("getProperty", () => {
    it("should return default value when property not set", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const value = manager.getProperty("name", "default", {});

      expect(value).to.equal("default");
    });

    it("should return field default when no explicit default provided", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const value = manager.getProperty("count", undefined, {});

      expect(value).to.equal(0);
    });

    it("should read from directObject", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const directObject = { name: "TestValue", count: 42 };
      const value = manager.getProperty("name", undefined, directObject);

      expect(value).to.equal("TestValue");
    });

    it("should read from dataPropertyObject", () => {
      const definition = createBasicFormDefinition();
      const dataPropertyObject = createMockDataPropertyObject();
      dataPropertyObject.properties["name"] = { id: "name", value: "FromDataProp" };

      const manager = new FormPropertyManager(definition, { dataPropertyObject });

      const value = manager.getProperty("name", undefined, undefined);

      expect(value).to.equal("FromDataProp");
    });

    it("should read from getsetPropertyObject", () => {
      const definition = createBasicFormDefinition();
      const getsetPropertyObject = createMockGetSetPropertyObject();
      getsetPropertyObject.data["name"] = "FromGetSet";

      const manager = new FormPropertyManager(definition, { getsetPropertyObject });

      const value = manager.getProperty("name", undefined, undefined);

      expect(value).to.equal("FromGetSet");
    });

    it("should upscale scalar directObject before reading", () => {
      const definition = createScalarFormDefinition();
      const manager = new FormPropertyManager(definition);

      // When directObject is a scalar, it should be upscaled to { __scalar: value }
      const value = manager.getProperty("__scalar", undefined, 42);

      expect(value).to.equal(42);
    });
  });

  describe("getPropertyAsInt", () => {
    it("should convert boolean to int", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      expect(manager.getPropertyAsInt("enabled", undefined, { enabled: true })).to.equal(1);
      expect(manager.getPropertyAsInt("enabled", undefined, { enabled: false })).to.equal(0);
    });

    it("should parse string to int", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      expect(manager.getPropertyAsInt("count", undefined, { count: "123" })).to.equal(123);
    });

    it("should return number as-is", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      expect(manager.getPropertyAsInt("count", undefined, { count: 42 })).to.equal(42);
    });
  });

  describe("getPropertyAsBoolean", () => {
    it("should return boolean as-is", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      expect(manager.getPropertyAsBoolean("enabled", undefined, { enabled: true })).to.be.true;
      expect(manager.getPropertyAsBoolean("enabled", undefined, { enabled: false })).to.be.false;
    });

    it("should convert number to boolean", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      expect(manager.getPropertyAsBoolean("count", undefined, { count: 1 })).to.be.true;
      expect(manager.getPropertyAsBoolean("count", undefined, { count: 0 })).to.be.false;
    });

    it("should convert string to boolean", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      expect(manager.getPropertyAsBoolean("name", undefined, { name: "true" })).to.be.true;
      expect(manager.getPropertyAsBoolean("name", undefined, { name: "false" })).to.be.false;
      expect(manager.getPropertyAsBoolean("name", undefined, { name: "" })).to.be.false;
      expect(manager.getPropertyAsBoolean("name", undefined, { name: "0" })).to.be.false;
      expect(manager.getPropertyAsBoolean("name", undefined, { name: "anything" })).to.be.true;
    });
  });

  // ==========================================================================
  // TYPE COERCION
  // ==========================================================================

  describe("getTypedData", () => {
    it("should parse string to int for int field", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);
      const field = manager.getFieldById("count")!;

      expect(manager.getTypedData(field, "123")).to.equal(123);
    });

    it("should return undefined for empty string on int field", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);
      const field = manager.getFieldById("count")!;

      expect(manager.getTypedData(field, "")).to.be.undefined;
    });

    it("should parse string to float for float field", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);
      const field = manager.getFieldById("amount")!;

      expect(manager.getTypedData(field, "3.14")).to.be.closeTo(3.14, 0.001);
    });

    it("should convert boolean to int for int field", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);
      const field = manager.getFieldById("count")!;

      expect(manager.getTypedData(field, true)).to.equal(1);
      expect(manager.getTypedData(field, false)).to.equal(0);
    });

    it("should convert to string for string field", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);
      const field = manager.getFieldById("name")!;

      expect(manager.getTypedData(field, 123)).to.equal("123");
      expect(manager.getTypedData(field, "hello")).to.equal("hello");
    });
  });

  // ==========================================================================
  // SCALAR UPSCALE/DOWNSCALE
  // ==========================================================================

  describe("upscaleDirectObject", () => {
    it("should pass through objects unchanged", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const obj = { name: "Test", count: 5 };
      const result = manager.upscaleDirectObject(obj);

      expect(result).to.equal(obj);
    });

    it("should convert scalar to __scalar object", () => {
      const definition = createScalarFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.upscaleDirectObject(42);

      expect(result).to.deep.equal({ __scalar: 42 });
    });

    it("should convert scalar using scalarFieldUpgradeName", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.upscaleDirectObject(42);

      expect(result).to.deep.equal({ value: 42 });
    });

    it("should return empty object for undefined", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.upscaleDirectObject(undefined as any);

      expect(result).to.deep.equal({});
    });
  });

  describe("downscaleDirectObject", () => {
    it("should collapse to scalar when only default values remain", () => {
      const definition = createScalarFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.downscaleDirectObject({ __scalar: 42 });

      expect(result).to.equal(42);
    });

    it("should collapse using scalarFieldUpgradeName", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.downscaleDirectObject({ value: 42 });

      expect(result).to.equal(42);
    });

    it("should keep object when non-default values exist", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.downscaleDirectObject({ value: 42, type: "custom" });

      expect(result).to.deep.equal({ value: 42, type: "custom" });
    });
  });

  describe("directObjectHasUniqueValuesBesidesScalar", () => {
    it("should return false for object with only scalar value", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.directObjectHasUniqueValuesBesidesScalar({ value: 42 });

      expect(result).to.be.false;
    });

    it("should return true for object with non-default values", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.directObjectHasUniqueValuesBesidesScalar({ value: 42, type: "custom" });

      expect(result).to.be.true;
    });

    it("should return false for object with only default values", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      // count has defaultValue: 0, type has defaultValue: "default"
      const result = manager.directObjectHasUniqueValuesBesidesScalar({ count: 0, type: "default" });

      expect(result).to.be.false;
    });
  });

  // ==========================================================================
  // PROPERTY SETTERS
  // ==========================================================================

  describe("setPropertyValue", () => {
    it("should update directObject", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.setPropertyValue("name", "NewValue", { name: "OldValue" });

      expect(result.updatedDirectObject.name).to.equal("NewValue");
      expect(result.property.id).to.equal("name");
      expect(result.newValue).to.equal("NewValue");
    });

    it("should update dataPropertyObject", () => {
      const definition = createBasicFormDefinition();
      const dataPropertyObject = createMockDataPropertyObject();

      const manager = new FormPropertyManager(definition, { dataPropertyObject });
      manager.setPropertyValue("name", "NewValue", undefined);

      expect(dataPropertyObject.properties["name"].value).to.equal("NewValue");
    });

    it("should update getsetPropertyObject", () => {
      const definition = createBasicFormDefinition();
      const getsetPropertyObject = createMockGetSetPropertyObject();

      const manager = new FormPropertyManager(definition, { getsetPropertyObject });
      manager.setPropertyValue("name", "NewValue", undefined);

      expect(getsetPropertyObject.data["name"]).to.equal("NewValue");
    });

    it("should call setBaseValue for __scalar property", () => {
      const definition = createScalarFormDefinition();
      const getsetPropertyObject = createMockGetSetPropertyObject();

      const manager = new FormPropertyManager(definition, { getsetPropertyObject });
      manager.setPropertyValue("__scalar", 42, undefined);

      expect(getsetPropertyObject.baseValue).to.equal(42);
    });

    it("should upscale and downscale directObject", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      // Start with scalar, set a value - should stay scalar if only value field set
      const result = manager.setPropertyValue("value", 100, 42);

      expect(result.updatedDirectObject).to.equal(100);
    });

    it("should keep object when setting non-scalar field", () => {
      const definition = createScalarUpgradeFormDefinition();
      const manager = new FormPropertyManager(definition);

      // Start with scalar, set type - should become object
      const result = manager.setPropertyValue("type", "custom", 42);

      expect(result.updatedDirectObject).to.deep.equal({ value: 42, type: "custom" });
    });
  });

  describe("processInputUpdate", () => {
    it("should convert string input to typed value", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.processInputUpdate("count", "123", {});

      expect(result?.newValue).to.equal(123);
      expect(result?.updatedDirectObject.count).to.equal(123);
    });

    it("should return undefined for invalid field ID", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.processInputUpdate("unknownField", "value", {});

      expect(result).to.be.undefined;
    });

    it("should handle empty string for numeric fields", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.processInputUpdate("count", "", {});

      expect(result?.newValue).to.be.undefined;
    });
  });

  describe("toggleBooleanProperty", () => {
    it("should toggle false to true", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.toggleBooleanProperty("enabled", false, { enabled: false });

      expect(result.newValue).to.be.true;
      expect(result.updatedDirectObject.enabled).to.be.true;
    });

    it("should toggle true to false", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.toggleBooleanProperty("enabled", false, { enabled: true });

      expect(result.newValue).to.be.false;
    });

    it("should toggle undefined to true (using default)", () => {
      const definition = createBasicFormDefinition();
      const manager = new FormPropertyManager(definition);

      const result = manager.toggleBooleanProperty("enabled", false, {});

      // enabled has defaultValue: false, so toggling should give true
      expect(result.newValue).to.be.true;
    });
  });
});

describe("DataFormUtilities.selectFieldForValue", () => {
  /**
   * Creates a field with alternates for testing field selection.
   * Simulates a field that can be either an array (primary) or an object (alternate).
   */
  function createFieldWithObjectAlternate(): IField {
    return {
      id: "repair_items",
      title: "Repair Items",
      dataType: FieldDataType.stringArray, // Primary: array type
      alternates: [
        {
          id: "repair_items",
          title: "Repair Items",
          dataType: FieldDataType.object, // Alternate: object type
          subForm: {
            id: "repair_items_form",
            title: "Repair Items",
            fields: [
              { id: "items", dataType: FieldDataType.stringArray, title: "Items" },
              { id: "repair_amount", dataType: FieldDataType.string, title: "Repair Amount" },
            ],
          },
        },
      ],
    };
  }

  /**
   * Creates a field with multiple alternates for scalar types.
   */
  function createFieldWithScalarAlternates(): IField {
    return {
      id: "damage",
      title: "Damage",
      dataType: FieldDataType.int, // Primary: integer
      alternates: [
        { id: "damage", title: "Damage", dataType: FieldDataType.string }, // Alternate: string
        { id: "damage", title: "Damage", dataType: FieldDataType.boolean }, // Alternate: boolean
      ],
    };
  }

  it("should return the primary field when value is undefined", () => {
    const field = createFieldWithObjectAlternate();
    const result = DataFormUtilities.selectFieldForValue(field, undefined);
    expect(result).to.equal(field);
  });

  it("should return the primary field when value is null", () => {
    const field = createFieldWithObjectAlternate();
    const result = DataFormUtilities.selectFieldForValue(field, null);
    expect(result).to.equal(field);
  });

  it("should select object alternate when value is an object", () => {
    const field = createFieldWithObjectAlternate();
    const objectValue = { items: ["minecraft:stick"], repair_amount: "0.25" };

    const result = DataFormUtilities.selectFieldForValue(field, objectValue);

    // Should select the alternate with dataType: object
    expect(result.dataType).to.equal(FieldDataType.object);
    expect(result.subForm).to.not.be.undefined;
  });

  it("should select array type when value is an array", () => {
    const field = createFieldWithObjectAlternate();
    const arrayValue = ["item1", "item2"];

    const result = DataFormUtilities.selectFieldForValue(field, arrayValue);

    // Should select the primary field with dataType: stringArray
    expect(result.dataType).to.equal(FieldDataType.stringArray);
  });

  it("should select integer type when value is a number", () => {
    const field = createFieldWithScalarAlternates();
    const result = DataFormUtilities.selectFieldForValue(field, 42);
    expect(result.dataType).to.equal(FieldDataType.int);
  });

  it("should select string type when value is a string", () => {
    const field = createFieldWithScalarAlternates();
    const result = DataFormUtilities.selectFieldForValue(field, "hello");
    expect(result.dataType).to.equal(FieldDataType.string);
  });

  it("should select boolean type when value is a boolean", () => {
    const field = createFieldWithScalarAlternates();
    const result = DataFormUtilities.selectFieldForValue(field, true);
    expect(result.dataType).to.equal(FieldDataType.boolean);
  });

  it("should return the primary field when no alternates exist", () => {
    const field: IField = {
      id: "simple",
      title: "Simple",
      dataType: FieldDataType.string,
    };

    const result = DataFormUtilities.selectFieldForValue(field, { some: "object" });

    // Should return the primary field since there are no alternates
    expect(result).to.equal(field);
  });

  it("should prefer object with subForm over plain object type", () => {
    const field: IField = {
      id: "complex",
      title: "Complex",
      dataType: FieldDataType.object, // Primary: object without subForm
      alternates: [
        {
          id: "complex",
          title: "Complex",
          dataType: FieldDataType.object, // Alternate: object WITH subForm
          subForm: {
            id: "complex_form",
            title: "Complex Form",
            fields: [{ id: "value", dataType: FieldDataType.int, title: "Value" }],
          },
        },
      ],
    };

    const result = DataFormUtilities.selectFieldForValue(field, { value: 10 });

    // Should prefer the alternate with subForm
    expect(result.subForm).to.not.be.undefined;
  });
});
