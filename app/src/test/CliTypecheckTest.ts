// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Guards the CLI compiler roots and npm command without executing either entry point.
 * Type-error probes use an in-memory compiler host so tests never modify source files.
 */

import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import "../app/Project";
import TestPaths from "./TestPaths";

const cliEntries = ["src/cli/index.ts", "src/cli/TaskWorker.ts"];

function readCliConfig(): ts.ParsedCommandLine {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.resolve(TestPaths.appRoot, "src/cli/tsconfig.json"),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        assert.fail(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    }
  );
  assert(config, "The CLI compiler configuration must load.");
  assert.deepEqual(config.errors, []);
  return config;
}

describe("CLI type-check coverage", function () {
  this.timeout(30000);

  it("roots the program at both bundles and the Ink declarations, not every build target", () => {
    const config = readCliConfig();
    const expectedRoots = [...cliEntries, "src/cli/ui/ink.d.ts"].map((file) => path.resolve(TestPaths.appRoot, file));

    assert.deepEqual(config.fileNames.map((file) => path.resolve(file)).sort(), expectedRoots.sort());
    assert.deepEqual(config.raw.include, []);
  });

  it("checks strict ESM types without emitting or skipping imported source", () => {
    const { options } = readCliConfig();

    assert.equal(options.module, ts.ModuleKind.ESNext);
    assert.equal(options.moduleResolution, ts.ModuleResolutionKind.Node10);
    assert.equal(options.strict, true);
    assert.equal(options.noImplicitAny, true);
    assert.equal(options.noEmit, true);
    assert.notEqual(options.noCheck, true);
    assert.notEqual(options.noResolve, true);
  });

  it("runs the project compiler from the npm script", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(TestPaths.appRoot, "package.json"), "utf8"));
    assert.equal(packageJson.scripts["typecheck-cli"], "tsc -p src/cli/tsconfig.json");
  });

  for (const entry of cliEntries) {
    it(`reports a type error in ${entry}`, () => {
      const config = readCliConfig();
      const entryPath = path.resolve(TestPaths.appRoot, entry);
      const original = fs.readFileSync(entryPath, "utf8");
      const host = ts.createCompilerHost(config.options);
      const getSourceFile = host.getSourceFile;

      host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
        if (path.resolve(fileName) === entryPath) {
          return ts.createSourceFile(
            fileName,
            original + '\nconst cliTypecheckProbe: number = "intentional type error";\n',
            languageVersion,
            true
          );
        }
        return getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
      };

      const program = ts.createProgram(config.fileNames, config.options, host);
      assert(program.getSourceFile(entryPath), `${entry} must be in the checked program.`);
      assert(
        program.getSourceFile(path.resolve(TestPaths.appRoot, "src/app/Project.ts")),
        "The entry graph must include its transitive source imports."
      );
      const diagnostics = ts.getPreEmitDiagnostics(program);
      assert(
        diagnostics.some(
          (diagnostic) =>
            diagnostic.code === 2322 &&
            diagnostic.file &&
            path.resolve(diagnostic.file.fileName) === entryPath &&
            diagnostic.start !== undefined &&
            diagnostic.start >= original.length
        ),
        `${entry} must report TS2322 for the injected string-to-number assignment.`
      );
    });
  }
});
