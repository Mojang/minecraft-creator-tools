// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import { Command } from "commander";
import { parseCommandLine } from "../cli/core/CommandLineHelp";
import { needsOutputFolder } from "../cli/core/CommandEffects";
import { hasInputFileOption, isValidInputFileOption } from "../cli/core/InputFileOption";

describe("explicit input-file option", () => {
  it("distinguishes an absent option from every supplied invalid value", () => {
    expect(hasInputFileOption(undefined)).to.equal(false);
    expect(isValidInputFileOption(undefined)).to.equal(true);
    for (const value of ["", true, false, null, 0, [], {}]) {
      expect(hasInputFileOption(value)).to.equal(true);
      expect(isValidInputFileOption(value)).to.equal(false);
      expect(needsOutputFolder("fix", { inputFile: value })).to.equal(false);
    }
  });

  for (const inputFile of ["./pack.mcaddon", "  ./path with spaces/pack.mcaddon  ", "./\u00e9xample.mcpack"]) {
    it(`preserves supplied path bytes: ${JSON.stringify(inputFile)}`, () => {
      const program = new Command().option("--if, --input-file <path>");
      program.command("run").action(() => {});
      parseCommandLine(program, ["node", "mct", "run", "--if", inputFile]);
      expect(program.opts().inputFile).to.equal(inputFile);
      expect(isValidInputFileOption(inputFile)).to.equal(true);
    });
  }
});
