// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { FieldDataType } from "../dataform/IField";
import FieldUtilities from "../dataform/FieldUtilities";
import IFormDefinition from "../dataform/IFormDefinition";

describe("FieldUtilities", () => {
  describe("normalizeFieldDataType", () => {
    const legacyNumericMappings: [number, FieldDataType][] = [
      [0, FieldDataType.int],
      [1, FieldDataType.boolean],
      [2, FieldDataType.string],
      [3, FieldDataType.float],
      [4, FieldDataType.stringEnum],
      [5, FieldDataType.intEnum],
      [6, FieldDataType.intBoolean],
      [7, FieldDataType.number],
      [8, FieldDataType.stringLookup],
      [14, FieldDataType.keyedObjectCollection],
      [15, FieldDataType.objectArray],
      [16, FieldDataType.object],
      [17, FieldDataType.stringArray],
      [22, FieldDataType.minecraftEventTrigger],
      [24, FieldDataType.keyedStringCollection],
      [25, FieldDataType.version],
      [27, FieldDataType.keyedBooleanCollection],
      [31, FieldDataType.keyedNumberCollection],
      [32, FieldDataType.numberArray],
      [34, FieldDataType.molang],
      [35, FieldDataType.molangArray],
      [38, FieldDataType.keyedNumberArrayCollection],
      [39, FieldDataType.minecraftEventReference],
    ];

    for (const [numeric, expected] of legacyNumericMappings) {
      it(`should convert legacy numeric ${numeric} to "${expected}"`, () => {
        expect(FieldUtilities.normalizeFieldDataType(numeric)).to.equal(expected);
      });
    }

    it("should pass through string FieldDataType values unchanged", () => {
      expect(FieldUtilities.normalizeFieldDataType(FieldDataType.int)).to.equal(FieldDataType.int);
      expect(FieldUtilities.normalizeFieldDataType(FieldDataType.object)).to.equal(FieldDataType.object);
      expect(FieldUtilities.normalizeFieldDataType(FieldDataType.molang)).to.equal(FieldDataType.molang);
    });

    it("should default unknown numeric values to string", () => {
      expect(FieldUtilities.normalizeFieldDataType(999)).to.equal(FieldDataType.string);
    });
  });

  describe("normalizeFormFieldDataTypes", () => {
    it("should normalize all fields in a form definition", () => {
      const form: IFormDefinition = {
        id: "test",
        title: "Test",
        fields: [
          { id: "field1", dataType: 7 as any },
          { id: "field2", dataType: 16 as any },
          { id: "field3", dataType: FieldDataType.boolean },
        ],
      };

      FieldUtilities.normalizeFormFieldDataTypes(form);

      expect(form.fields[0].dataType).to.equal(FieldDataType.number);
      expect(form.fields[1].dataType).to.equal(FieldDataType.object);
      expect(form.fields[2].dataType).to.equal(FieldDataType.boolean);
    });

    it("should normalize nested subForm fields", () => {
      const form: IFormDefinition = {
        id: "test",
        title: "Test",
        fields: [
          {
            id: "parent",
            dataType: 16 as any,
            subForm: {
              id: "sub",
              title: "Sub",
              fields: [{ id: "child", dataType: 0 as any }],
            },
          },
        ],
      };

      FieldUtilities.normalizeFormFieldDataTypes(form);

      expect(form.fields[0].dataType).to.equal(FieldDataType.object);
      expect(form.fields[0].subForm!.fields[0].dataType).to.equal(FieldDataType.int);
    });

    it("should normalize alternate fields", () => {
      const form: IFormDefinition = {
        id: "test",
        title: "Test",
        fields: [
          {
            id: "field1",
            dataType: 2 as any,
            alternates: [{ id: "field1", dataType: 24 as any }],
          },
        ],
      };

      FieldUtilities.normalizeFormFieldDataTypes(form);

      expect(form.fields[0].dataType).to.equal(FieldDataType.string);
      expect(form.fields[0].alternates![0].dataType).to.equal(FieldDataType.keyedStringCollection);
    });

    it("should handle forms with no fields", () => {
      const form: IFormDefinition = {
        id: "test",
        title: "Test",
        fields: [],
      };

      // Should not throw
      FieldUtilities.normalizeFormFieldDataTypes(form);
    });
  });
});
