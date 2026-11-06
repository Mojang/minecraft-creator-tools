// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { installDomGlobals, restoreDomGlobals, domWindow } from "./fields/textboxFieldSpecSetup";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import * as fs from "fs";
import * as path from "path";
import Summarizer from "./Summarizer";
import DataForm from "./DataForm";
import IFormDefinition from "../dataform/IFormDefinition";
import ISummarizer from "../dataform/ISummarizer";
import IProjectTheme from "../UX/types/IProjectTheme";

// The shim installs jsdom globals at import time so react-dom and MUI load with
// a DOM present; drop them again until the hooks below re-install them.
restoreDomGlobals();

// Selecting the "can shoot projectiles" component used to crash the entity
// editor (public issue #159): the shooter form that @minecraft/bedrock-schemas
// ships writes its exists token with `tokens`/`elseTokens`, the evaluator
// iterated the `whenDefined` it expected, and "tokens is not iterable" came
// out of DataForm's render. The override in public_supplemental corrects the
// form; these specs render the real summary from it and check that a form
// with the upstream shape, or one that makes evaluation throw, shows a
// visible note instead of taking React down.

// @types/react 18.3.0 does not yet declare React.act even though react 18.3.1 ships it.
const act: (callback: () => void | Promise<void>) => void | Promise<void> = (React as any).act;

const overridePath = path.join(
  __dirname,
  "../../public_supplemental/data/local_forms/entity/minecraft_shooter.form.json"
);

function shooterForm(): IFormDefinition {
  return JSON.parse(fs.readFileSync(overridePath, "utf8")) as IFormDefinition;
}

/** The shooter summarizer the way bedrock-schemas 1.26.50 ships it, before the override. */
function upstreamShooterSummarizer(): ISummarizer {
  const summarizer = shooterForm().summarizer as any;
  const exists = summarizer.phrases[0].tokens[1];

  exists.tokens = exists.whenDefined;
  exists.elseTokens = exists.whenUndefined;
  delete exists.whenDefined;
  delete exists.whenUndefined;

  return summarizer as ISummarizer;
}

interface IHarness {
  container: HTMLElement;
  render(element: React.ReactElement): void;
  renderAsync(element: React.ReactElement): Promise<void>;
  text(): string;
  unavailable(): HTMLElement | null;
  unmount(): void;
}

function createHarness(): IHarness {
  const container = domWindow.document.createElement("div");
  domWindow.document.body.appendChild(container);

  const root: Root = createRoot(container);

  return {
    container,
    render(element: React.ReactElement) {
      act(() => {
        root.render(element);
      });
    },
    async renderAsync(element: React.ReactElement) {
      // DataForm loads its sub forms and summarizer from componentDidMount, so
      // the summary card appears after the mount's awaits have settled.
      await act(async () => {
        root.render(element);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    },
    text() {
      return (container.textContent || "").replace(/\s+/g, " ").trim();
    },
    unavailable() {
      return container.querySelector(".sum-unavailable") as HTMLElement | null;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("Summarizer rendering of the shooter component", () => {
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

  describe("Summarizer component", () => {
    it("renders the ranged-attack summary from the corrected shooter form", () => {
      const form = shooterForm();

      harness.render(
        React.createElement(Summarizer, { summarizer: form.summarizer, data: {}, formDefinition: form, noun: "entity" })
      );

      expect(harness.unavailable()).to.equal(null);
      expect(harness.text()).to.equal("This entity shoots projectiles for ranged attacks");

      harness.render(
        React.createElement(Summarizer, {
          summarizer: form.summarizer,
          data: { def: "minecraft:arrow", magic: true },
          formDefinition: form,
          noun: "entity",
        })
      );

      expect(harness.unavailable()).to.equal(null);
      expect(harness.text()).to.equal(
        "This entity shoots minecraft:arrow for ranged attacks and uses magic projectiles"
      );
    });

    it("shows a visible note instead of crashing for the upstream token shape", () => {
      const summarizer = upstreamShooterSummarizer();

      harness.render(React.createElement(Summarizer, { summarizer, data: { def: "minecraft:arrow" }, noun: "entity" }));

      const note = harness.unavailable();
      expect(note, "unavailable note").to.not.equal(null);
      expect(note!.textContent).to.include("Summary unavailable");
      expect(note!.textContent).to.include('"whenDefined"');
      expect(note!.getAttribute("title")).to.include('field "def"');
      expect(harness.text()).to.not.include("for ranged attacks");

      harness.render(React.createElement(Summarizer, { summarizer, data: {}, plainText: true }));

      expect(harness.unavailable()!.tagName).to.equal("SPAN");
      expect(harness.text()).to.equal("Summary unavailable");
    });

    it("shows the note when evaluating the definition throws", () => {
      const summarizer = {
        id: "throws",
        get phrases(): any[] {
          throw new Error("phrase list exploded");
        },
      } as ISummarizer;

      harness.render(React.createElement(Summarizer, { summarizer, data: {} }));

      const note = harness.unavailable();
      expect(note, "unavailable note").to.not.equal(null);
      expect(note!.textContent).to.include("Summary unavailable");
      expect(note!.textContent).to.include("phrase list exploded");
    });

    it("recovers once a usable definition arrives", () => {
      harness.render(React.createElement(Summarizer, { summarizer: upstreamShooterSummarizer(), data: {} }));
      expect(harness.unavailable()).to.not.equal(null);

      harness.render(React.createElement(Summarizer, { summarizer: shooterForm().summarizer, data: {} }));
      expect(harness.unavailable()).to.equal(null);
      expect(harness.text()).to.equal("Shoots projectiles for ranged attacks");
    });
  });

  describe("DataForm with the shooter form", () => {
    function renderForm(definition: IFormDefinition, directObject: any): Promise<void> {
      return harness.renderAsync(
        React.createElement(DataForm, {
          definition,
          directObject,
          theme: {} as IProjectTheme,
          readOnly: false,
          displayTitle: false,
          summarizerNoun: "entity",
          onPropertyChanged: () => {},
        })
      );
    }

    function typeInto(input: HTMLInputElement, text: string) {
      const valueSetter = Object.getOwnPropertyDescriptor(domWindow.HTMLInputElement.prototype, "value")!.set!;

      act(() => {
        valueSetter.call(input, text);
        input.dispatchEvent(new domWindow.Event("input", { bubbles: true }));
      });
    }

    it("opens the component with its summary and keeps it up to date while editing", async function () {
      this.timeout(30000);

      await renderForm(shooterForm(), {});

      expect(harness.unavailable()).to.equal(null);
      expect(harness.text()).to.include("This entity shoots projectiles for ranged attacks");

      const defInput = domWindow.document.getElementById("def") as HTMLInputElement | null;
      expect(defInput, "def field input").to.not.equal(null);

      typeInto(defInput!, "minecraft:arrow");

      expect(harness.unavailable()).to.equal(null);
      expect(harness.text()).to.include("This entity shoots minecraft:arrow for ranged attacks");
    });

    it("still opens, with the note in place of the summary, when the form carries the upstream shape", async function () {
      this.timeout(30000);

      const definition = { ...shooterForm(), summarizer: upstreamShooterSummarizer() };

      await renderForm(definition, { def: "minecraft:arrow" });

      expect(harness.unavailable(), "unavailable note").to.not.equal(null);
      expect(harness.text()).to.include("Summary unavailable");
      expect(domWindow.document.getElementById("def"), "def field input").to.not.equal(null);
    });
  });
});
