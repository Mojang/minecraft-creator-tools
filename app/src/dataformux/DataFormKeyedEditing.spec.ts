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

// Add / rename / edit / save coverage for the keyed editors the Offspring
// component override selects. Both used to leave the JSON in a state the
// game would not run as intended: renaming a keyed-string entry copied it
// (the placeholder key stayed behind), keyed-object entries could not be
// named at all, and editing a numeric mutation value turned it into text.

// @types/react 18.3.0 does not yet declare React.act even though react 18.3.1 ships it.
const act: (callback: () => void) => void = (React as any).act;

const overridePath = path.join(
  __dirname,
  "../../public_supplemental/data/local_forms/entity/minecraft_offspring.form.json"
);

/** The offspring override reduced to a single field so the harness has one editor on the page. */
function formForField(fieldId: string): IFormDefinition {
  const form = JSON.parse(fs.readFileSync(overridePath, "utf8")) as IFormDefinition;
  return { id: form.id, fields: form.fields.filter((f) => f.id === fieldId) };
}

interface IHarness {
  /** The object the form is editing, as the form last reported it. */
  current(): any;
  render(definition: IFormDefinition, directObject: any): void;
  clickAddItem(): void;
  /** Press the + of the scalar-array editor on the page (there is one per rendered entry). */
  clickScalarArrayAdd(): void;
  /** Pick the type the scalar-array editor gives its next added value. */
  chooseNewValueType(type: "string" | "number" | "boolean"): void;
  /** Press the Close control of the entry sub form whose title input has this id. */
  closeEntry(titleInputId: string): void;
  setInput(id: string, text: string): void;
  /** Type into an input held by reference, so the same node can be driven across id changes. */
  typeInto(input: HTMLInputElement, text: string): void;
  input(id: string): HTMLInputElement | null;
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
      return JSON.parse(JSON.stringify(reported !== undefined ? reported : directObject));
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
    clickAddItem() {
      const button = container.querySelector('button[title="Add item"]') as HTMLButtonElement | null;
      expect(button, "add item button").to.not.equal(null);

      act(() => {
        button!.click();
      });
    },
    clickScalarArrayAdd() {
      const button = container.querySelector(".sarr-add button") as HTMLButtonElement | null;
      expect(button, "scalar array add button").to.not.equal(null);

      act(() => {
        button!.click();
      });
    },
    chooseNewValueType(type: "string" | "number" | "boolean") {
      const select = container.querySelector(".sarr-newType select") as HTMLSelectElement | null;
      expect(select, "new value type selector").to.not.equal(null);

      act(() => {
        select!.value = type;
        select!.dispatchEvent(new domWindow.Event("change", { bubbles: true }));
      });
    },
    closeEntry(titleInputId: string) {
      const input = harness.input(titleInputId);
      expect(input, "title input " + titleInputId).to.not.equal(null);

      // The entry's own Close control is the nearest one above its title input.
      let element: HTMLElement | null = input;
      let button: HTMLButtonElement | null = null;
      while (element && !button) {
        button = element.querySelector('button[title="Close"]') as HTMLButtonElement | null;
        element = element.parentElement;
      }
      expect(button, "close button for " + titleInputId).to.not.equal(null);

      act(() => {
        button!.click();
      });
    },
    input(id: string) {
      return domWindow.document.getElementById(id) as HTMLInputElement | null;
    },
    setInput(id: string, text: string) {
      const input = harness.input(id);
      expect(input, "input " + id).to.not.equal(null);

      harness.typeInto(input!, text);
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

describe("DataForm keyed editing for the offspring component", () => {
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

  describe("offspring pairs (keyed strings)", () => {
    const form = formForField("offspring_pairs");

    it("add, rename the key and set the value leaves exactly the intended pair", () => {
      harness.render(form, { offspring_pairs: { "minecraft:cow": "minecraft:cow" } });

      harness.clickAddItem();
      expect(harness.current().offspring_pairs).to.deep.equal({
        "minecraft:cow": "minecraft:cow",
        "minecraft:mate_entity": "value",
      });

      harness.setInput("offspring_pairs.minecraft:mate_entity.text", "minecraft:pig");
      harness.setInput("offspring_pairs.minecraft:pig.input", "minecraft:piglet");

      expect(harness.current().offspring_pairs).to.deep.equal({
        "minecraft:cow": "minecraft:cow",
        "minecraft:pig": "minecraft:piglet",
      });
    });

    it("renaming an existing key moves the entry instead of copying it", () => {
      harness.render(form, { offspring_pairs: { "minecraft:cow": "minecraft:cow" } });

      harness.setInput("offspring_pairs.minecraft:cow.text", "minecraft:mooshroom");

      expect(harness.current().offspring_pairs).to.deep.equal({ "minecraft:mooshroom": "minecraft:cow" });
      expect(harness.input("offspring_pairs.minecraft:cow.text")).to.equal(null);
      expect(harness.input("offspring_pairs.minecraft:mooshroom.text")).to.not.equal(null);
    });

    it("keeps the entry order across a rename", () => {
      harness.render(form, {
        offspring_pairs: { "minecraft:cow": "minecraft:cow", "minecraft:pig": "minecraft:pig" },
      });

      harness.setInput("offspring_pairs.minecraft:cow.text", "minecraft:mooshroom");

      expect(Object.keys(harness.current().offspring_pairs)).to.deep.equal(["minecraft:mooshroom", "minecraft:pig"]);
    });

    it("refuses to rename onto a key that already exists", () => {
      harness.render(form, {
        offspring_pairs: { "minecraft:cow": "minecraft:cow", "minecraft:pig": "minecraft:piglet" },
      });

      harness.setInput("offspring_pairs.minecraft:pig.text", "minecraft:cow");

      expect(harness.current().offspring_pairs).to.deep.equal({
        "minecraft:cow": "minecraft:cow",
        "minecraft:pig": "minecraft:piglet",
      });
    });
  });

  describe("property inheritance (keyed objects)", () => {
    const form = formForField("property_inheritance");

    it("a new entry can be named after the entity property it applies to", () => {
      harness.render(form, { property_inheritance: { "minecraft:climate_variant": {} } });

      harness.clickAddItem();
      expect(Object.keys(harness.current().property_inheritance)).to.deep.equal([
        "minecraft:climate_variant",
        "minecraft:property",
      ]);

      harness.setInput("dftitle.property_inheritance.minecraft:property", "minecraft:variant");

      expect(harness.current().property_inheritance).to.deep.equal({
        "minecraft:climate_variant": {},
        "minecraft:variant": {},
      });
      expect(harness.input("dftitle.property_inheritance.minecraft:variant")).to.not.equal(null);
    });

    // A renamed entry used to keep its original name as its React key. Adding
    // another entry after the rename reuses that name for the newcomer, so the
    // two sub forms shared a key and React could hand one the other's state.
    it("add, rename, add again gives the two entries distinct identities", () => {
      const errors: string[] = [];
      const originalError = console.error;
      console.error = (...args: unknown[]) => {
        errors.push(args.map((a) => String(a)).join(" "));
      };

      try {
        harness.render(form, { property_inheritance: { "minecraft:climate_variant": {} } });

        harness.clickAddItem();
        harness.setInput("dftitle.property_inheritance.minecraft:property", "minecraft:variant");
        harness.clickAddItem();

        expect(Object.keys(harness.current().property_inheritance)).to.deep.equal([
          "minecraft:climate_variant",
          "minecraft:variant",
          "minecraft:property",
        ]);
        expect(harness.input("dftitle.property_inheritance.minecraft:variant")).to.not.equal(null);
        expect(harness.input("dftitle.property_inheritance.minecraft:property")).to.not.equal(null);

        // Each entry still renames on its own.
        harness.setInput("dftitle.property_inheritance.minecraft:property", "minecraft:color");

        expect(Object.keys(harness.current().property_inheritance)).to.deep.equal([
          "minecraft:climate_variant",
          "minecraft:variant",
          "minecraft:color",
        ]);
        expect(harness.input("dftitle.property_inheritance.minecraft:variant")).to.not.equal(null);
        expect(harness.input("dftitle.property_inheritance.minecraft:color")).to.not.equal(null);
      } finally {
        console.error = originalError;
      }

      expect(
        errors.filter((e) => e.includes("same key")),
        "React must not see two children with the same key"
      ).to.deep.equal([]);
    });

    it("renaming an entry keeps its settings", () => {
      harness.render(form, {
        property_inheritance: { "minecraft:climate_variant": { mutation_chance: 0.25 } },
      });

      harness.setInput("dftitle.property_inheritance.minecraft:climate_variant", "minecraft:variant");

      expect(harness.current().property_inheritance).to.deep.equal({
        "minecraft:variant": { mutation_chance: 0.25 },
      });
    });

    // The sub form's React key used to switch from the entry's name to an
    // identity on the first accepted keystroke, which remounted the title
    // input mid-word and dropped focus. The identity is now there from the
    // first render, so the node the user is typing into stays put.
    it("typing a name one character at a time keeps the title input mounted and focused", () => {
      harness.render(form, { property_inheritance: { "minecraft:climate_variant": {} } });
      harness.clickAddItem();

      const input = harness.input("dftitle.property_inheritance.minecraft:property")!;
      act(() => {
        input.focus();
      });
      expect(domWindow.document.activeElement).to.equal(input);

      let typed = "";
      for (const character of "demo:custom_variant") {
        typed += character;
        harness.typeInto(input, typed);

        expect(input.isConnected, "title input still mounted after typing " + JSON.stringify(typed)).to.equal(true);
        expect(domWindow.document.activeElement, "focus after typing " + JSON.stringify(typed)).to.equal(input);
        expect(input.value).to.equal(typed);
      }

      expect(harness.current().property_inheritance).to.deep.equal({
        "minecraft:climate_variant": {},
        "demo:custom_variant": {},
      });
      expect(harness.input("dftitle.property_inheritance.demo:custom_variant")).to.equal(input);
    });

    it("an entry loaded from the file keeps its title input across a character-by-character rename", () => {
      harness.render(form, { property_inheritance: { "minecraft:climate_variant": { mutation_chance: 0.25 } } });

      const input = harness.input("dftitle.property_inheritance.minecraft:climate_variant")!;
      act(() => {
        input.focus();
      });

      let typed = "";
      for (const character of "minecraft:variant") {
        typed += character;
        harness.typeInto(input, typed);

        expect(input.isConnected, "after typing " + JSON.stringify(typed)).to.equal(true);
        expect(domWindow.document.activeElement, "after typing " + JSON.stringify(typed)).to.equal(input);
      }

      expect(harness.current().property_inheritance).to.deep.equal({
        "minecraft:variant": { mutation_chance: 0.25 },
      });
    });

    // Keys are opaque names: `demo:coat.variant` is a valid entity property.
    // The rename and close handlers used to split the sub form id at its last
    // period, so a dotted name could not be renamed, and closing it left the
    // entry in place and wrote a stray "property_inheritance.demo:coat" key.
    it("an entry named with periods can be typed, renamed and removed", () => {
      harness.render(form, { property_inheritance: { "minecraft:climate_variant": {} } });
      harness.clickAddItem();

      const input = harness.input("dftitle.property_inheritance.minecraft:property")!;
      let typed = "";
      for (const character of "demo:coat.variant") {
        typed += character;
        harness.typeInto(input, typed);

        expect(input.isConnected, "after typing " + JSON.stringify(typed)).to.equal(true);
        expect(input.value).to.equal(typed);
      }

      expect(harness.current()).to.deep.equal({
        property_inheritance: { "minecraft:climate_variant": {}, "demo:coat.variant": {} },
      });

      harness.setInput("dftitle.property_inheritance.demo:coat.variant", "demo:coat.variant2");

      expect(harness.current()).to.deep.equal({
        property_inheritance: { "minecraft:climate_variant": {}, "demo:coat.variant2": {} },
      });
      expect(harness.input("dftitle.property_inheritance.demo:coat.variant2")).to.equal(input);

      harness.closeEntry("dftitle.property_inheritance.demo:coat.variant2");

      expect(harness.current()).to.deep.equal({ property_inheritance: { "minecraft:climate_variant": {} } });
      expect(harness.input("dftitle.property_inheritance.demo:coat.variant2")).to.equal(null);
    });

    it("an entry loaded from the file under a dotted name can be renamed and removed", () => {
      harness.render(form, {
        property_inheritance: { "demo:coat.variant": { mutation_chance: 0.25 }, "minecraft:climate_variant": {} },
      });

      harness.setInput("dftitle.property_inheritance.demo:coat.variant", "demo:coat.color");

      expect(harness.current()).to.deep.equal({
        property_inheritance: { "demo:coat.color": { mutation_chance: 0.25 }, "minecraft:climate_variant": {} },
      });

      harness.closeEntry("dftitle.property_inheritance.demo:coat.color");

      expect(harness.current()).to.deep.equal({ property_inheritance: { "minecraft:climate_variant": {} } });
    });

    // Add alone used to leave the new false / 0 in the editor only; the file
    // still held the old list until some other edit happened to report it.
    it("a mutation value added by type reaches the file without any typing and survives an unrelated edit", () => {
      harness.render(form, { property_inheritance: { "demo:enabled": { mutation_values: [true] } } });

      harness.chooseNewValueType("boolean");
      harness.clickScalarArrayAdd();

      expect(harness.current().property_inheritance["demo:enabled"].mutation_values).to.deep.equal([true, false]);

      // An edit elsewhere on the entry re-renders the whole sub form.
      harness.setInput("mutation_chance", "0.5");

      expect(harness.current().property_inheritance["demo:enabled"]).to.deep.equal({
        mutation_values: [true, false],
        mutation_chance: 0.5,
      });
      expect(harness.input("1")!.value).to.equal("false");
    });

    it("a number added to an entry that had no mutation values yet is saved and kept across a parent refresh", () => {
      harness.render(form, { property_inheritance: { "demo:size": {} } });

      harness.chooseNewValueType("number");
      harness.clickScalarArrayAdd();

      expect(harness.current().property_inheritance["demo:size"].mutation_values).to.deep.equal([0]);

      // Renaming the entry re-renders it from the parent with its current value.
      harness.setInput("dftitle.property_inheritance.demo:size", "demo:scale");

      expect(harness.current().property_inheritance).to.deep.equal({ "demo:scale": { mutation_values: [0] } });
      expect(harness.input("0")!.value).to.equal("0");
    });

    it("editing a mutation value keeps numbers numeric", () => {
      harness.render(form, {
        property_inheritance: { "minecraft:climate_variant": { mutation_values: [1, 5, 9] } },
      });

      harness.setInput("0", "2");

      const values = harness.current().property_inheritance["minecraft:climate_variant"].mutation_values;
      expect(values).to.deep.equal([2, 5, 9]);
      expect(values.map((v: unknown) => typeof v)).to.deep.equal(["number", "number", "number"]);
    });

    it("editing a text mutation value keeps it text even when it now looks like a number or a boolean", () => {
      harness.render(form, {
        property_inheritance: { "minecraft:climate_variant": { mutation_values: ["7", "true"] } },
      });

      harness.setInput("0", "8");
      harness.setInput("1", "false");

      const values = harness.current().property_inheritance["minecraft:climate_variant"].mutation_values;
      expect(values).to.deep.equal(["8", "false"]);
      expect(values.map((v: unknown) => typeof v)).to.deep.equal(["string", "string"]);
    });
  });
});
