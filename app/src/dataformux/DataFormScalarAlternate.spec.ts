// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { installDomGlobals, restoreDomGlobals, domWindow } from "./fields/textboxFieldSpecSetup";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import * as fs from "fs";
import * as path from "path";
import DataForm from "./DataForm";
import IFormDefinition from "../dataform/IFormDefinition";
import IProjectTheme from "../UX/types/IProjectTheme";

// The shim installs jsdom globals at import time so react-dom and MUI load with
// a DOM present; drop them again until the hooks below re-install them.
restoreDomGlobals();

// Display -> edit -> persist coverage for a scalar field with alternates, using
// the interact_button overrides: the component is either a boolean or a string
// caption. DataForm binds the primary scalar field to the __scalar property, and
// the alternates have to follow, or the string textbox sends its edits under the
// alternate's own id, which no backing store can resolve, and the edit is dropped.

// @types/react 18.3.0 does not yet declare React.act even though react 18.3.1 ships it.
const act: (callback: () => void) => void = (React as any).act;

const overridesRoot = path.join(__dirname, "../../public_supplemental/data/local_forms");

const overrides = ["item_components", "item"].map((folder) => ({
  folder,
  file: path.join(overridesRoot, folder, "minecraft_interact_button.form.json"),
}));

function loadForm(file: string): IFormDefinition {
  return JSON.parse(fs.readFileSync(file, "utf8")) as IFormDefinition;
}

interface IHarness {
  /** The value the form is editing, as the form last reported it. */
  current(): any;
  render(definition: IFormDefinition, directObject: any): void;
  input(id: string): HTMLInputElement | null;
  typeInto(input: HTMLInputElement, text: string): void;
  checkboxes(): HTMLInputElement[];
  unmount(): void;
}

function createHarness(): IHarness {
  const container = domWindow.document.createElement("div");
  domWindow.document.body.appendChild(container);

  const root: Root = createRoot(container);
  let directObject: any;
  let reported: any;

  const harness: IHarness = {
    current() {
      return reported !== undefined ? reported : directObject;
    },
    render(definition: IFormDefinition, obj: any) {
      directObject = obj;
      reported = undefined;

      act(() => {
        root.render(
          React.createElement(DataForm, {
            definition,
            directObject: obj,
            theme: {} as IProjectTheme,
            readOnly: false,
            displayTitle: false,
            onPropertyChanged: (_props: any, _property: any, _newValue: any, updatingObject?: any) => {
              if (updatingObject !== undefined) {
                reported = updatingObject;
              }
            },
          })
        );
      });
    },
    input(id: string) {
      return domWindow.document.getElementById(id) as HTMLInputElement | null;
    },
    typeInto(input: HTMLInputElement, text: string) {
      // Drive React's controlled-input plumbing the way a real keystroke does:
      // set the native value, then dispatch a bubbling input event.
      const valueSetter = Object.getOwnPropertyDescriptor(domWindow.HTMLInputElement.prototype, "value")!.set!;

      act(() => {
        valueSetter.call(input, text);
        input.dispatchEvent(new domWindow.Event("input", { bubbles: true }));
      });
    },
    checkboxes() {
      return Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };

  return harness;
}

describe("DataForm scalar alternates for the interact_button component", () => {
  let harness: IHarness;

  before(() => {
    installDomGlobals();
  });

  after(() => {
    restoreDomGlobals();
  });

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.unmount();
  });

  for (const override of overrides) {
    describe(override.folder + " override", () => {
      it("shows an existing string caption in a textbox bound to the scalar property", () => {
        harness.render(loadForm(override.file), "Open Menu");

        const textbox = harness.input("__scalar");
        expect(textbox, "scalar textbox").to.not.equal(null);
        expect(textbox!.value).to.equal("Open Menu");
        expect(harness.checkboxes()).to.have.lengthOf(0);
      });

      it("editing the caption persists the new string as the component value", () => {
        harness.render(loadForm(override.file), "Open Menu");

        harness.typeInto(harness.input("__scalar")!, "Open Shop");

        expect(harness.current()).to.equal("Open Shop");
        expect(harness.input("__scalar")!.value).to.equal("Open Shop");
      });

      it("shows a boolean value as a checkbox rather than the string editor", () => {
        harness.render(loadForm(override.file), true);

        expect(harness.checkboxes()).to.have.lengthOf(1);

        const scalarInput = harness.input("__scalar");
        expect(scalarInput === null || scalarInput.type === "checkbox", "no string editor for a boolean").to.equal(
          true
        );
      });
    });
  }
});
