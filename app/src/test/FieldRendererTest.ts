// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { FieldDataType } from "../dataform/IField";
import {
  hasRenderer,
  getRenderer,
  registerRenderer,
  unregisterRenderer,
  getRegisteredTypes,
  isTextboxType,
  isCheckboxType,
  registerRendererForTypes,
  clearRegistry,
  isRegistryInitialized,
  markInitialized,
  TEXTBOX_TYPES,
  CHECKBOX_TYPES,
} from "../dataformux/fields/FieldRendererRegistry";
import {
  IFieldRendererProps,
  IFieldRenderResult,
  getCssClassName,
  ICssClassConfig,
} from "../dataformux/fields/IFieldRendererProps";

describe("Field Renderer Infrastructure", () => {
  // ==========================================================================
  // IFieldRendererProps Tests
  // ==========================================================================

  describe("getCssClassName", () => {
    it("should return narrow class names when displayNarrow is true", () => {
      const config: ICssClassConfig = { displayNarrow: true };
      const result = getCssClassName("fieldWrap", config);
      expect(result).to.equal("df-fieldWrap dfn-fieldWrap");
    });

    it("should return wide class names when displayNarrow is false", () => {
      const config: ICssClassConfig = { displayNarrow: false };
      const result = getCssClassName("fieldWrap", config);
      expect(result).to.equal("df-fieldWrap dfw-fieldWrap");
    });

    it("should handle various class names", () => {
      const narrowConfig: ICssClassConfig = { displayNarrow: true };
      const wideConfig: ICssClassConfig = { displayNarrow: false };

      expect(getCssClassName("elementTitle", narrowConfig)).to.equal("df-elementTitle dfn-elementTitle");
      expect(getCssClassName("slider", wideConfig)).to.equal("df-slider dfw-slider");
      expect(getCssClassName("fieldWrapNumber", narrowConfig)).to.equal("df-fieldWrapNumber dfn-fieldWrapNumber");
    });
  });

  // ==========================================================================
  // FieldRendererRegistry Tests
  // ==========================================================================

  describe("FieldRendererRegistry", () => {
    // NOTE: The registry is NOT auto-initialized in Node.js (no JSX support).
    // Tests that need renderers must register mock renderers first.

    // Mock renderer for testing
    const mockRenderer = (props: IFieldRendererProps): IFieldRenderResult => ({
      element: null as any,
    });

    describe("registerRenderer and unregisterRenderer", () => {
      afterEach(() => {
        // Clean up test registrations
        clearRegistry();
      });

      it("should register a custom renderer", () => {
        expect(hasRenderer(FieldDataType.string)).to.be.false;

        registerRenderer(FieldDataType.string, mockRenderer);
        expect(hasRenderer(FieldDataType.string)).to.be.true;
        expect(getRenderer(FieldDataType.string)).to.equal(mockRenderer);
      });

      it("should unregister a renderer", () => {
        registerRenderer(FieldDataType.string, mockRenderer);
        expect(hasRenderer(FieldDataType.string)).to.be.true;

        const result = unregisterRenderer(FieldDataType.string);
        expect(result).to.be.true;
        expect(hasRenderer(FieldDataType.string)).to.be.false;
      });

      it("should return false when unregistering non-existent renderer", () => {
        const result = unregisterRenderer(FieldDataType.point3);
        expect(result).to.be.false;
      });

      it("should register multiple types with registerRendererForTypes", () => {
        const types = [FieldDataType.string, FieldDataType.int, FieldDataType.float];
        registerRendererForTypes(types, mockRenderer);

        for (const type of types) {
          expect(hasRenderer(type)).to.be.true;
        }
      });
    });

    describe("getRegisteredTypes", () => {
      afterEach(() => {
        clearRegistry();
      });

      it("should return an empty array when no renderers registered", () => {
        const types = getRegisteredTypes();
        expect(types).to.be.an("array");
        expect(types.length).to.equal(0);
      });

      it("should return registered types after registration", () => {
        registerRenderer(FieldDataType.string, mockRenderer);
        registerRenderer(FieldDataType.boolean, mockRenderer);

        const types = getRegisteredTypes();
        expect(types).to.include(FieldDataType.string);
        expect(types).to.include(FieldDataType.boolean);
      });
    });

    describe("initialization tracking", () => {
      afterEach(() => {
        clearRegistry();
      });

      it("should track initialization state", () => {
        expect(isRegistryInitialized()).to.be.false;
        markInitialized();
        expect(isRegistryInitialized()).to.be.true;
      });

      it("should reset initialization on clearRegistry", () => {
        markInitialized();
        expect(isRegistryInitialized()).to.be.true;
        clearRegistry();
        expect(isRegistryInitialized()).to.be.false;
      });
    });

    describe("type constants", () => {
      it("should export TEXTBOX_TYPES with correct types", () => {
        expect(TEXTBOX_TYPES).to.be.an("array");
        expect(TEXTBOX_TYPES).to.include(FieldDataType.string);
        expect(TEXTBOX_TYPES).to.include(FieldDataType.int);
        expect(TEXTBOX_TYPES).to.include(FieldDataType.float);
        expect(TEXTBOX_TYPES).to.include(FieldDataType.number);
      });

      it("should export CHECKBOX_TYPES with correct types", () => {
        expect(CHECKBOX_TYPES).to.be.an("array");
        expect(CHECKBOX_TYPES).to.include(FieldDataType.boolean);
        expect(CHECKBOX_TYPES).to.include(FieldDataType.intBoolean);
      });
    });

    describe("isTextboxType", () => {
      it("should return true for textbox-compatible types", () => {
        for (const type of TEXTBOX_TYPES) {
          expect(isTextboxType(type), `isTextboxType should return true for ${FieldDataType[type]}`).to.be.true;
        }
      });

      it("should return false for non-textbox types", () => {
        expect(isTextboxType(FieldDataType.boolean)).to.be.false;
        expect(isTextboxType(FieldDataType.point3)).to.be.false;
        expect(isTextboxType(FieldDataType.objectArray)).to.be.false;
        expect(isTextboxType(FieldDataType.minecraftFilter)).to.be.false;
      });
    });

    describe("isCheckboxType", () => {
      it("should return true for checkbox-compatible types", () => {
        for (const type of CHECKBOX_TYPES) {
          expect(isCheckboxType(type), `isCheckboxType should return true for ${FieldDataType[type]}`).to.be.true;
        }
      });

      it("should return false for non-checkbox types", () => {
        expect(isCheckboxType(FieldDataType.string)).to.be.false;
        expect(isCheckboxType(FieldDataType.int)).to.be.false;
        expect(isCheckboxType(FieldDataType.point3)).to.be.false;
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe("Registry Integration", () => {
    afterEach(() => {
      clearRegistry();
    });

    it("should not have overlapping textbox and checkbox types", () => {
      for (const type of TEXTBOX_TYPES) {
        expect(!isCheckboxType(type), `Type ${FieldDataType[type]} should not be both textbox and checkbox`).to.be.true;
      }

      for (const type of CHECKBOX_TYPES) {
        expect(!isTextboxType(type), `Type ${FieldDataType[type]} should not be both textbox and checkbox`).to.be.true;
      }
    });

    it("should register types matching TEXTBOX_TYPES correctly", () => {
      const mockRenderer = () => ({ element: null as any });
      registerRendererForTypes(TEXTBOX_TYPES, mockRenderer);

      for (const type of TEXTBOX_TYPES) {
        expect(hasRenderer(type), `hasRenderer should return true for ${FieldDataType[type]}`).to.be.true;
      }
    });

    it("should register types matching CHECKBOX_TYPES correctly", () => {
      const mockRenderer = () => ({ element: null as any });
      registerRendererForTypes(CHECKBOX_TYPES, mockRenderer);

      for (const type of CHECKBOX_TYPES) {
        expect(hasRenderer(type), `hasRenderer should return true for ${FieldDataType[type]}`).to.be.true;
      }
    });
  });
});
