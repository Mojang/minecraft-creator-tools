// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { installDomGlobals, restoreDomGlobals, domWindow } from "./textboxFieldSpecSetup";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import * as fs from "fs";
import * as path from "path";
import ScalarArrayField, { IScalarArrayFieldProps } from "./ScalarArrayField";
import IField, { FieldDataType } from "../../dataform/IField";
import IFormDefinition from "../../dataform/IFormDefinition";
import IProjectTheme from "../../UX/types/IProjectTheme";
import { IScalarArrayProps, ScalarArrayValue, parseScalarArrayValue } from "../ScalarArray";

// The shim installs jsdom globals at import time so react-dom and MUI load with
// a DOM present; drop them again until the hooks below re-install them.
restoreDomGlobals();

// Regression coverage for the "+" button on array fields. Pressing it on the
// Offspring component of a mob based on a vanilla entity threw
// "this.state.data.push is not a function": the upstream form declared
// offspring_pairs / property_inheritance as string arrays while the entity JSON
// holds keyed objects ({"minecraft:cow": "minecraft:cow"}). The control now
// refuses to edit such a value (editing it as a list would overwrite the map
// on the first keystroke), and a local form override declares the real shape.

// @types/react 18.3.0 does not yet declare React.act even though react 18.3.1 ships it.
const act: (callback: () => void) => void = (React as any).act;

const FORM: IFormDefinition = { id: "minecraft:offspring", fields: [] };

function stringArrayField(overrides: Partial<IField> = {}): IField {
  return {
    id: "offspring_pairs",
    title: "Offspring Pairs",
    dataType: FieldDataType.stringArray,
    ...overrides,
  };
}

function primitiveArrayField(): IField {
  return {
    id: "mutation_values",
    title: "Mutation Values",
    dataType: FieldDataType.primitiveArray,
  };
}

interface IHarness {
  changes: ScalarArrayValue[][];
  render(field: IField, value: unknown): void;
  inputs(): HTMLInputElement[];
  addButton(): HTMLButtonElement | null;
  alertText(): string | undefined;
  clickAdd(): void;
  /** Pick the type the next added value gets (primitive arrays only). */
  chooseNewType(type: "string" | "number" | "boolean"): void;
  /** The type label shown on each row (primitive arrays only). */
  rowTypes(): string[];
  typeInto(input: HTMLInputElement, text: string): void;
  unmount(): void;
}

function createHarness(): IHarness {
  const container = domWindow.document.createElement("div");
  domWindow.document.body.appendChild(container);

  const root: Root = createRoot(container);
  const changes: ScalarArrayValue[][] = [];

  function props(field: IField, value: unknown): IScalarArrayFieldProps {
    return {
      field,
      value: value as string[] | undefined,
      defaultValue: [],
      baseKey: "spec." + field.id,
      theme: {} as IProjectTheme,
      readOnly: false,
      cssConfig: { displayNarrow: false },
      form: FORM,
      objectKey: field.id,
      onChange: () => {},
      onScalarArrayChange: (data: IScalarArrayProps) => {
        changes.push(data.data ? [...data.data] : []);
      },
    };
  }

  const harness: IHarness = {
    changes,
    render(field: IField, value: unknown) {
      act(() => {
        root.render(React.createElement(ScalarArrayField, props(field, value)));
      });
    },
    inputs() {
      return Array.from(container.querySelectorAll("input")) as HTMLInputElement[];
    },
    addButton() {
      return container.querySelector(".sarr-add button") as HTMLButtonElement | null;
    },
    alertText() {
      const alert = container.querySelector(".sarr-mismatch");
      return alert ? alert.textContent || "" : undefined;
    },
    clickAdd() {
      const button = harness.addButton();
      expect(button, "add button").to.not.equal(null);

      act(() => {
        button!.click();
      });
    },
    chooseNewType(type: "string" | "number" | "boolean") {
      const select = container.querySelector(".sarr-newType select") as HTMLSelectElement | null;
      expect(select, "type selector").to.not.equal(null);

      act(() => {
        select!.value = type;
        select!.dispatchEvent(new domWindow.Event("change", { bubbles: true }));
      });
    },
    rowTypes() {
      return Array.from(container.querySelectorAll(".sarr-type") as NodeListOf<Element>).map(
        (e) => e.textContent || ""
      );
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
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };

  return harness;
}

describe("ScalarArrayField add button", () => {
  let harness: IHarness;
  let windowErrors: ErrorEvent[];
  const onWindowError = (event: ErrorEvent) => {
    windowErrors.push(event);
    event.preventDefault();
  };

  before(() => {
    installDomGlobals();
  });

  after(() => {
    restoreDomGlobals();
  });

  beforeEach(() => {
    windowErrors = [];
    domWindow.addEventListener("error", onWindowError);
    harness = createHarness();
  });

  afterEach(() => {
    harness.unmount();
    domWindow.removeEventListener("error", onWindowError);
  });

  it("adds an empty entry to an existing list", () => {
    harness.render(stringArrayField(), ["minecraft:health"]);

    expect(harness.inputs().length).to.equal(1);

    harness.clickAdd();

    expect(windowErrors).to.deep.equal([]);
    expect(harness.inputs().length).to.equal(2);
    expect(harness.inputs()[1].value).to.equal("");
  });

  it("adds an entry when the field has no value yet", () => {
    harness.render(stringArrayField(), undefined);

    harness.clickAdd();

    expect(windowErrors).to.deep.equal([]);
    expect(harness.inputs().length).to.equal(1);
  });

  it("reports the added entry once it is edited", () => {
    harness.render(stringArrayField(), []);

    harness.clickAdd();
    harness.typeInto(harness.inputs()[0], "minecraft:cow");

    expect(harness.changes).to.deep.equal([["minecraft:cow"]]);
  });

  it("does not throw and refuses to edit when the stored value is a keyed object", () => {
    const stored = { "minecraft:cow": "minecraft:cow" };
    harness.render(stringArrayField(), stored);

    expect(windowErrors).to.deep.equal([]);
    expect(harness.inputs().length, "no editable rows for a non-list value").to.equal(0);
    expect(harness.addButton(), "no add button for a non-list value").to.equal(null);
    expect(harness.alertText()).to.contain("stored as an object");
    expect(harness.changes, "the stored value is never rewritten").to.deep.equal([]);
    expect(stored).to.deep.equal({ "minecraft:cow": "minecraft:cow" });
  });

  // The check has to follow the value, not the mount. A field that starts
  // out empty (the control is created, the + button is there) and later
  // receives the keyed object under the same key used to keep its editable
  // empty list, and the first edit wrote a list over the object.
  it("locks down when a keyed object arrives after the field was mounted empty", () => {
    harness.render(stringArrayField(), undefined);
    expect(harness.addButton(), "an empty field can be added to").to.not.equal(null);

    const stored = { "minecraft:cow": "minecraft:cow" };
    harness.render(stringArrayField(), stored);

    expect(windowErrors).to.deep.equal([]);
    expect(harness.inputs().length).to.equal(0);
    expect(harness.addButton()).to.equal(null);
    expect(harness.alertText()).to.contain("stored as an object");
    expect(harness.changes).to.deep.equal([]);
    expect(stored).to.deep.equal({ "minecraft:cow": "minecraft:cow" });
  });

  it("rows added while the field was empty cannot be written over a map that arrives later", () => {
    harness.render(stringArrayField(), undefined);
    harness.clickAdd();
    expect(harness.inputs().length).to.equal(1);

    const stored = { "minecraft:cow": "minecraft:cow" };
    harness.render(stringArrayField(), stored);

    expect(harness.inputs().length, "the pending row is gone").to.equal(0);
    expect(harness.addButton()).to.equal(null);
    expect(harness.changes).to.deep.equal([]);
    expect(stored).to.deep.equal({ "minecraft:cow": "minecraft:cow" });
  });

  it("is editable again once a list replaces the object", () => {
    harness.render(stringArrayField(), { "minecraft:cow": "minecraft:cow" });
    expect(harness.addButton()).to.equal(null);

    harness.render(stringArrayField(), ["minecraft:cow"]);

    expect(harness.alertText()).to.equal(undefined);
    expect(harness.inputs().length).to.equal(1);
    expect(harness.addButton()).to.not.equal(null);

    harness.typeInto(harness.inputs()[0], "minecraft:pig");
    expect(harness.changes).to.deep.equal([["minecraft:pig"]]);
  });

  // The parent form hands an absent field a fresh [] on each of its renders.
  // That used to read as a new (empty) value and threw away a row that had
  // been added but not typed into yet.
  it("keeps a row added to an empty field across an unrelated parent refresh", () => {
    harness.render(stringArrayField(), undefined);
    harness.clickAdd();
    expect(harness.inputs().length).to.equal(1);

    harness.render(stringArrayField(), []);
    expect(harness.inputs().length, "the pending row survives a fresh empty list").to.equal(1);

    harness.render(stringArrayField(), []);
    expect(harness.inputs().length).to.equal(1);

    harness.typeInto(harness.inputs()[0], "minecraft:cow");
    expect(harness.changes).to.deep.equal([["minecraft:cow"]]);
  });

  it("still drops its rows when a list that had entries is cleared", () => {
    harness.render(stringArrayField(), ["minecraft:cow"]);
    expect(harness.inputs().length).to.equal(1);

    harness.render(stringArrayField(), []);
    expect(harness.inputs().length).to.equal(0);
  });

  it("keeps a half-typed row when the list it reported comes back from the field", () => {
    harness.render(stringArrayField(), ["a"]);

    harness.typeInto(harness.inputs()[0], "ab");
    // The field re-renders with the list the control reported.
    harness.render(stringArrayField(), harness.changes[harness.changes.length - 1]);

    expect(harness.inputs()[0].value).to.equal("ab");
    expect(harness.inputs().length).to.equal(1);
  });
});

describe("ScalarArrayField primitive arrays", () => {
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

  it("keeps numbers numeric when one is edited", () => {
    harness.render(primitiveArrayField(), [1, 5, 9]);

    harness.typeInto(harness.inputs()[0], "2");

    expect(harness.changes).to.deep.equal([[2, 5, 9]]);
    expect(harness.changes[0].map((v) => typeof v)).to.deep.equal(["number", "number", "number"]);
  });

  it("stores a new numeric entry as a number and a new boolean entry as a boolean when those types are chosen", () => {
    harness.render(primitiveArrayField(), [1]);

    harness.chooseNewType("number");
    harness.clickAdd();
    harness.typeInto(harness.inputs()[1], "4");
    harness.chooseNewType("boolean");
    harness.clickAdd();
    harness.typeInto(harness.inputs()[2], "true");

    expect(harness.changes[harness.changes.length - 1]).to.deep.equal([1, 4, true]);
    expect(harness.rowTypes()).to.deep.equal(["number", "number", "boolean"]);
  });

  // The game reads "7" and 7 differently (text picks an enum property), so a
  // value keeps the type it has no matter what the new text spells.
  it("keeps an existing text value text even when the new text looks like a number or a boolean", () => {
    harness.render(primitiveArrayField(), ["7", "true"]);

    harness.typeInto(harness.inputs()[0], "8");
    harness.typeInto(harness.inputs()[1], "false");

    const last = harness.changes[harness.changes.length - 1];
    expect(last).to.deep.equal(["8", "false"]);
    expect(last.map((v) => typeof v)).to.deep.equal(["string", "string"]);
    expect(harness.rowTypes()).to.deep.equal(["text", "text"]);
  });

  // Add used to stage the row in the control only: it showed false (or 0)
  // while the form model still held the old list, so saving without any
  // further edit lost the row.
  it("reports a new boolean or number value the moment it is added, with no typing", () => {
    harness.render(primitiveArrayField(), [true]);

    harness.chooseNewType("boolean");
    harness.clickAdd();

    expect(harness.changes).to.deep.equal([[true, false]]);

    harness.chooseNewType("number");
    harness.clickAdd();

    expect(harness.changes).to.deep.equal([
      [true, false],
      [true, false, 0],
    ]);

    // The field comes back with what was reported, as after a save and reload.
    harness.render(primitiveArrayField(), harness.changes[harness.changes.length - 1]);
    expect(harness.inputs().map((input) => input.value)).to.deep.equal(["true", "false", "0"]);
    expect(harness.rowTypes()).to.deep.equal(["boolean", "boolean", "number"]);
  });

  it("reports a number added to a field that had no value yet", () => {
    harness.render(primitiveArrayField(), undefined);

    harness.chooseNewType("number");
    harness.clickAdd();

    expect(harness.changes).to.deep.equal([[0]]);
  });

  it("a new text row is reported once something is typed into it, not as an empty value", () => {
    harness.render(primitiveArrayField(), [1]);

    harness.clickAdd();
    expect(harness.changes, "a blank text row is not a value yet").to.deep.equal([]);

    harness.typeInto(harness.inputs()[1], "warm");
    expect(harness.changes).to.deep.equal([[1, "warm"]]);
  });

  it("a new value is text unless another type is chosen, so numeric-looking text can be authored", () => {
    harness.render(primitiveArrayField(), ["warm"]);

    harness.clickAdd();
    harness.typeInto(harness.inputs()[1], "7");

    const last = harness.changes[harness.changes.length - 1];
    expect(last).to.deep.equal(["warm", "7"]);
    expect(typeof last[1]).to.equal("string");
  });

  it("shows text that does not spell a value of the element's type without committing it", () => {
    harness.render(primitiveArrayField(), [1]);

    harness.typeInto(harness.inputs()[0], "abc");
    expect(harness.changes).to.deep.equal([]);
    expect(harness.inputs()[0].value).to.equal("abc");

    harness.typeInto(harness.inputs()[0], "12");
    expect(harness.changes).to.deep.equal([[12]]);
  });

  it("labels each row with its type", () => {
    harness.render(primitiveArrayField(), [1, "7", true]);

    expect(harness.rowTypes()).to.deep.equal(["number", "text", "boolean"]);
  });

  it("keeps text values as strings", () => {
    harness.render(primitiveArrayField(), ["warm"]);

    harness.clickAdd();
    harness.typeInto(harness.inputs()[1], "cold");

    expect(harness.changes[harness.changes.length - 1]).to.deep.equal(["warm", "cold"]);
  });

  it("lets a decimal be typed digit by digit", () => {
    harness.render(primitiveArrayField(), [1]);

    harness.typeInto(harness.inputs()[0], "1.");
    expect(harness.inputs()[0].value, "the trailing dot stays visible while typing").to.equal("1.");

    harness.typeInto(harness.inputs()[0], "1.5");

    expect(harness.changes[harness.changes.length - 1]).to.deep.equal([1.5]);
  });

  it("plain string arrays still store text even when it looks numeric", () => {
    harness.render(stringArrayField(), ["a"]);

    harness.typeInto(harness.inputs()[0], "2");

    expect(harness.changes).to.deep.equal([["2"]]);
  });

  it("parses typed text into the scalar it spells", () => {
    expect(parseScalarArrayValue("7")).to.equal(7);
    expect(parseScalarArrayValue("-0.25")).to.equal(-0.25);
    expect(parseScalarArrayValue("true")).to.equal(true);
    expect(parseScalarArrayValue("false")).to.equal(false);
    expect(parseScalarArrayValue("warm")).to.equal("warm");
    expect(parseScalarArrayValue("1.")).to.equal(1);
    expect(parseScalarArrayValue("")).to.equal("");
  });
});

describe("minecraft:offspring form override", () => {
  const overridePath = path.join(
    __dirname,
    "../../../public_supplemental/data/local_forms/entity/minecraft_offspring.form.json"
  );

  function loadOverride(): IFormDefinition {
    return JSON.parse(fs.readFileSync(overridePath, "utf8")) as IFormDefinition;
  }

  function fieldById(form: IFormDefinition, id: string): IField {
    const field = form.fields.find((candidate) => candidate.id === id);
    expect(field, "field " + id).to.not.equal(undefined);
    return field as IField;
  }

  it("declares offspring_pairs as a keyed string collection with a meaningful new key", () => {
    const field = fieldById(loadOverride(), "offspring_pairs");

    expect(field.dataType).to.equal(FieldDataType.keyedStringCollection);
    expect(field.defaultNewKey).to.equal("minecraft:mate_entity");
  });

  it("declares property_inheritance as a keyed object collection with typed mutation settings", () => {
    const field = fieldById(loadOverride(), "property_inheritance");

    expect(field.dataType).to.equal(FieldDataType.keyedObjectCollection);
    expect(field.defaultNewKey).to.equal("minecraft:property");
    expect(field.subForm, "subForm").to.not.equal(undefined);

    const subFields = field.subForm!.fields;
    expect(subFields.map((subField) => subField.id)).to.include.members(["mutation_chance", "mutation_values"]);
    expect(subFields.find((subField) => subField.id === "mutation_values")!.dataType).to.equal(
      FieldDataType.primitiveArray
    );
  });

  it("keeps the upstream fields and vanilla samples", () => {
    const override = loadOverride();
    const upstream = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          "../../../node_modules/@minecraft/bedrock-schemas/forms/entity/minecraft_offspring.form.json"
        ),
        "utf8"
      )
    ) as IFormDefinition;

    expect(override.fields.map((field) => field.id)).to.deep.equal(upstream.fields.map((field) => field.id));
    expect(fieldById(override, "offspring_pairs").samples).to.deep.equal(
      fieldById(upstream, "offspring_pairs").samples
    );
  });
});
