// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { assert } from "chai";
import MCFunctionInfoGenerator from "./MCFunctionInfoGenerator";
import { MCFunctionInfoGeneratorTest } from "./MCFunctionInfoData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { ProjectItemType } from "../../../app/IProjectItemData";

describe("MCFunctionInfoGenerator", () => {
  const gen = new MCFunctionInfoGenerator();

  it("has expected id and title", () => {
    assert.strictEqual(gen.id, "MCFUNCTION");
    assert.strictEqual(gen.title, "MC Function Validation");
  });

  it("returns empty array for empty project", async () => {
    const project = createStubProject();
    const results = await gen.generate(project);
    assert.deepEqual(results, []);
  });

  it("skips non-MCFunction items", async () => {
    const item = createStubProjectItem({ itemType: ProjectItemType.behaviorPackManifestJson });
    const project = createStubProject([item]);
    const results = await gen.generate(project);
    assert.deepEqual(results, []);
  });

  it("emits lineBeginsWithSlash warning when line starts with /", async () => {
    const file = createStubFile({ name: "test.mcfunction", content: "/say hello" });
    const item = createStubProjectItem({ itemType: ProjectItemType.MCFunction, file });
    const project = createStubProject([item]);
    const results = await gen.generate(project);

    const slashItems = results.filter((r) => r.generatorIndex === MCFunctionInfoGeneratorTest.lineBeginsWithSlash);
    assert.isAbove(slashItems.length, 0, "should emit lineBeginsWithSlash warning for /say hello");
  });

  it("emits no errors for valid built-in command", async () => {
    const file = createStubFile({ name: "test.mcfunction", content: "say hello" });
    const item = createStubProjectItem({ itemType: ProjectItemType.MCFunction, file });
    const project = createStubProject([item]);
    const results = await gen.generate(project);
    assert.deepEqual(results, [], "built-in command 'say' should produce no errors");
  });

  it("emits invalidCommandSyntax error for unknown un-namespaced command", async () => {
    const file = createStubFile({ name: "test.mcfunction", content: "notacommand arg1" });
    const item = createStubProjectItem({ itemType: ProjectItemType.MCFunction, file });
    const project = createStubProject([item]);
    const results = await gen.generate(project);

    const syntaxErrors = results.filter((r) => r.generatorIndex === MCFunctionInfoGeneratorTest.invalidCommandSyntax);
    assert.isAbove(syntaxErrors.length, 0, "should emit invalidCommandSyntax for unknown command");
  });

  it("emits no errors for namespaced command", async () => {
    const file = createStubFile({ name: "test.mcfunction", content: "mypkg:mycommand arg1" });
    const item = createStubProjectItem({ itemType: ProjectItemType.MCFunction, file });
    const project = createStubProject([item]);
    const results = await gen.generate(project);
    assert.deepEqual(results, [], "namespaced command should produce no errors");
  });
});
