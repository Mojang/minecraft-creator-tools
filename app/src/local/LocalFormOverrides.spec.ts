// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import { Writable } from "stream";
import LocalUtilities from "./LocalUtilities";
import Database from "../minecraft/Database";
import TestPaths from "../test/TestPaths";

// The checked-in form overrides in public_supplemental/data/local_forms/ fix
// bugs in @minecraft/bedrock-schemas forms. Every path that hands a form to
// an editor has to prefer them over the package copy: the Vite dev
// middleware, the production bundle, the Node package behind `npx mct` and
// `mct serve` (its resolver and the Database loader the editors call), and
// the VS Code extension's packaged forms tree. Each is checked here against
// the real override for the offspring component, whose upstream form
// declares keyed maps as arrays.

const overrideRelativePath = "entity/minecraft_offspring.form.json";
const checkedInOverride = path.join(
  TestPaths.appRoot,
  "public_supplemental",
  "data",
  "local_forms",
  overrideRelativePath
);
const scratchRoot = path.join(TestPaths.appRoot, "debugoutput", "localFormOverrides");

function fieldTypes(form: any): { [id: string]: string } {
  const types: { [id: string]: string } = {};
  for (const field of form.fields) {
    types[field.id] = field.dataType;
  }
  return types;
}

function expectOffspringOverride(form: any) {
  const types = fieldTypes(form);
  expect(types["offspring_pairs"]).to.equal("keyedStringCollection");
  expect(types["property_inheritance"]).to.equal("keyedObjectCollection");
}

describe("local form overrides reach every form delivery path", () => {
  before(function () {
    // A previous run leaves a copy of the whole forms tree behind.
    this.timeout(120000);

    fs.rmSync(scratchRoot, { recursive: true, force: true });
    fs.mkdirSync(scratchRoot, { recursive: true });
  });

  describe("Node resolver (npx mct, mct serve)", () => {
    const contentRoot = path.join(scratchRoot, "package");
    const overrideFile = path.join(contentRoot, "data", "local_forms", overrideRelativePath);

    before(() => {
      fs.mkdirSync(path.dirname(overrideFile), { recursive: true });
      fs.copyFileSync(checkedInOverride, overrideFile);
    });

    /** Runs a check with Database's local host pointed at the scratch package, with no cached forms in the way. */
    async function withDatabaseOn(contentRoot: string, check: () => Promise<void>) {
      const utilities = new LocalUtilities();
      utilities.basePathAdjust = contentRoot;

      const previous = Database.local;
      const cachedNames = ["minecraft_offspring", "minecraft_breedable"].map((n) => Database.getFormName("entity", n));
      const forget = () => cachedNames.forEach((n) => delete Database.uxCatalog[n]);

      Database.local = utilities;
      forget();
      try {
        await check();
      } finally {
        forget();
        Database.local = previous;
      }
    }

    it("prefers the shipped override over the package form", () => {
      const utilities = new LocalUtilities();
      utilities.basePathAdjust = contentRoot;

      expect(path.resolve(utilities.getFullPath("data/forms/" + overrideRelativePath))).to.equal(
        path.resolve(overrideFile)
      );
    });

    it("falls back to the package for forms without an override", () => {
      const utilities = new LocalUtilities();
      utilities.basePathAdjust = contentRoot;

      const resolved = path.resolve(utilities.getFullPath("data/forms/entity/minecraft_breedable.form.json"));

      expect(resolved.startsWith(path.resolve(LocalUtilities.bedrockSchemasRoot!))).to.equal(true);
      expect(fs.existsSync(resolved)).to.equal(true);
    });

    // Database.ensureFormLoaded asks for the whole folder, not a file. The
    // sparse override folder must never stand in for the package folder, or
    // every form without an override disappears from the built package.
    it("resolves a forms folder to the package even when an override folder of that name exists", async () => {
      const utilities = new LocalUtilities();
      utilities.basePathAdjust = contentRoot;

      const resolved = path.resolve(utilities.getFullPath("data/forms/entity/"));

      expect(resolved.startsWith(path.resolve(LocalUtilities.bedrockSchemasRoot!))).to.equal(true);
      expect(utilities.getLocalFormOverridePath("entity/")).to.equal(undefined);

      const storage = utilities.createStorage("data/forms/entity/")!;
      await storage.rootFolder.load();
      expect(storage.rootFolder.files).to.have.property("entity_behavior_document.form.json");
    });

    it("never resolves an override outside data/local_forms", () => {
      const utilities = new LocalUtilities();
      utilities.basePathAdjust = contentRoot;

      expect(utilities.getLocalFormOverridePath("../local_forms/" + overrideRelativePath)).to.equal(undefined);
    });

    // The editors do not resolve file paths; they call Database, which
    // enumerates the package folder and reads the child file out of it. That
    // folder never contains the override, so the loader has to ask for the
    // file by name first.
    it("Database.ensureFormLoaded hands Node editors the override", async () => {
      await withDatabaseOn(contentRoot, async () => {
        const form = await Database.ensureFormLoaded("entity", "minecraft_offspring");
        expect(form, "offspring form").to.not.equal(undefined);
        expectOffspringOverride(form);
      });
    });

    it("Database.ensureFormLoadedSync hands Node editors the override", async () => {
      await withDatabaseOn(contentRoot, async () => {
        const form = Database.ensureFormLoadedSync("entity", "minecraft_offspring");
        expect(form, "offspring form").to.not.equal(undefined);
        expectOffspringOverride(form);
      });
    });

    it("Database still loads forms without an override from the package folder", async () => {
      await withDatabaseOn(contentRoot, async () => {
        const form = await Database.ensureFormLoaded("entity", "minecraft_breedable");
        expect(form?.fields?.length, "breedable form fields").to.be.greaterThan(0);

        const sync = Database.ensureFormLoadedSync("entity", "minecraft_breedable");
        expect(sync?.fields?.length, "breedable form fields (sync)").to.be.greaterThan(0);
      });
    });
  });

  // The extension reads toolbuild/vsc/data/forms/. vscbuild cleans that tree,
  // copies the upstream forms again and packages, so the overlay has to run
  // after that copy, every time; the stages are shared with the build.
  describe("VS Code extension (vscbuild)", () => {
    const vscRoot = path.join(scratchRoot, "vsc");
    const finalForm = path.join(vscRoot, "data", "forms", overrideRelativePath);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const gulp = require("gulp");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const stages = require(path.join(TestPaths.appRoot, "tools", "vscFormsStages.js"))(gulp, vscRoot);

    function runStage(stage: () => unknown): Promise<void> {
      return new Promise((resolve, reject) => {
        gulp.series(stage)((error?: Error) => (error ? reject(error) : resolve()));
      });
    }

    it("a clean forms tree ends up with the override once the overlay has run after the upstream copy", async function () {
      // Copies the whole upstream forms tree.
      this.timeout(120000);

      fs.rmSync(vscRoot, { recursive: true, force: true });

      await runStage(stages.copyVscBedrockSchemasForms);
      const upstream = JSON.parse(fs.readFileSync(finalForm, "utf8"));
      expect(fieldTypes(upstream)["offspring_pairs"], "upstream copy is the baseline").to.equal("stringArray");

      await runStage(stages.mergeLocalFormsIntoVsc);
      expectOffspringOverride(JSON.parse(fs.readFileSync(finalForm, "utf8")));
      expect(
        fs.existsSync(path.join(vscRoot, "data", "forms", "entity", "entity_behavior_document.form.json"))
      ).to.equal(true);
    });

    it("running the upstream copy again without the overlay would put the upstream form back", async function () {
      this.timeout(120000);

      fs.rmSync(finalForm, { force: true });
      await runStage(stages.copyVscBedrockSchemasForms);
      expect(fieldTypes(JSON.parse(fs.readFileSync(finalForm, "utf8")))["offspring_pairs"]).to.equal("stringArray");

      await runStage(stages.mergeLocalFormsIntoVsc);
      expectOffspringOverride(JSON.parse(fs.readFileSync(finalForm, "utf8")));
    });

    it("vscbuild and vscdevbuild overlay the local forms after the upstream copy and before packaging", function () {
      // Registers every gulp task, which loads webpack and the build tools.
      this.timeout(120000);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require(path.join(TestPaths.appRoot, "gulpfile.js"));

      const tree = gulp.tree({ deep: true });

      function stepsOf(taskName: string): string[] {
        const task = tree.nodes.find((n: any) => n.label === taskName);
        expect(task, "task " + taskName).to.not.equal(undefined);

        const steps: string[] = [];
        const walk = (node: any) => {
          steps.push(node.label);
          (node.nodes || []).forEach(walk);
        };
        walk(task);
        return steps;
      }

      for (const taskName of ["vscbuild", "vscdevbuild"]) {
        const steps = stepsOf(taskName);
        const upstreamCopy = steps.indexOf("copyVscBedrockSchemasForms");
        const formsOverlay = steps.indexOf("mergeLocalFormsIntoVsc");
        const schemasOverlay = steps.indexOf("mergeLocalSchemasIntoVsc");

        expect(upstreamCopy, taskName + " copies upstream forms").to.be.greaterThan(-1);
        expect(formsOverlay, taskName + " overlays local forms after the upstream copy").to.be.greaterThan(
          upstreamCopy
        );
        expect(schemasOverlay, taskName + " overlays local schemas after the upstream copy").to.be.greaterThan(
          steps.indexOf("copyVscSchemas")
        );

        if (taskName === "vscbuild") {
          expect(steps.indexOf("packageVsix"), "vscbuild packages after the overlay").to.be.greaterThan(formsOverlay);
        }
      }
    });
  });

  describe("Vite (web app)", () => {
    let plugin: any;

    before(async function () {
      this.timeout(60000);

      // vite.config.js is an ES module; load it the way Node does rather than
      // through the CommonJS transform the test build applies to imports.
      const importModule = new Function("specifier", "return import(specifier)") as (s: string) => Promise<any>;
      const configModule = await importModule(pathToFileURL(path.join(TestPaths.appRoot, "vite.config.js")).href);

      plugin = configModule.serveBedrockSchemas();
    });

    it("dev middleware serves the override for /data/forms/", async () => {
      let middleware: ((req: any, res: any, next: () => void) => void) | undefined;
      plugin.configureServer({ middlewares: { use: (fn: any) => (middleware = fn) } });
      expect(middleware, "middleware registered").to.not.equal(undefined);

      const chunks: Buffer[] = [];
      const res = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
      }) as Writable & { setHeader: (name: string, value: string) => void };
      res.setHeader = () => {};

      const finished = new Promise<void>((resolve) => res.on("finish", () => resolve()));
      let fellThrough = false;

      middleware!({ url: "/data/forms/" + overrideRelativePath }, res, () => {
        fellThrough = true;
        res.end();
      });

      await finished;

      expect(fellThrough, "request handled by the middleware").to.equal(false);
      expectOffspringOverride(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    });

    it("production bundle carries the override", function () {
      // Copies the whole forms and schemas trees out of the package.
      this.timeout(120000);

      const outDir = path.join(scratchRoot, "build");
      plugin.writeBundle({ dir: outDir });

      const built = JSON.parse(fs.readFileSync(path.join(outDir, "data", "forms", overrideRelativePath), "utf8"));
      expectOffspringOverride(built);

      const index = JSON.parse(fs.readFileSync(path.join(outDir, "data", "forms", "entity", "index.json"), "utf8"));
      expect(index.files).to.include("minecraft_offspring.form.json");
    });
  });
});
