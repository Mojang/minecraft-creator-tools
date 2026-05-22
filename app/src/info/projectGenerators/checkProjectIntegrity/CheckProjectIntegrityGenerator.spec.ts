// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import CheckProjectIntegrityGenerator from "./CheckProjectIntegrityGenerator";
import { CheckIntegrityTests } from "./CheckProjectIntegrityData";
import { createStubProject } from "../../../test/stubs/app/projects/StubProject";
import { createStubProjectItem } from "../../../test/stubs/app/projects/StubProjectItem";
import { createStubFile } from "../../../test/stubs/app/io/StubFile";
import { createStubPack } from "../../../test/stubs/app/projects/StubPack";

describe("CheckProjectIntegrityGenerator", () => {
  let generator: CheckProjectIntegrityGenerator;

  beforeEach(() => {
    generator = new CheckProjectIntegrityGenerator();
  });

  it("should have correct id and title", () => {
    expect(generator.id).to.equal("PRJINT");
    expect(generator.title).to.be.a("string").and.have.length.above(0);
  });

  it("should return no results for a clean project with no unknown files or packs", async () => {
    const results = await generator.generate(createStubProject());
    expect(results.length).to.equal(0);
  });

  it("should report OrphanedFile for each unknown file", async () => {
    const unknownFiles = [
      createStubFile({ name: "stray1.txt", extendedPath: "/project/stray1.txt" }),
      createStubFile({ name: "stray2.txt", extendedPath: "/project/stray2.txt" }),
      createStubFile({ name: "stray3.txt", extendedPath: "/project/stray3.txt" }),
    ];
    const project = createStubProject([], [], { unknownFiles });
    const results = await generator.generate(project);
    const orphans = results.filter((r) => r.generatorIndex === CheckIntegrityTests.OrphanedFile.id);
    expect(orphans.length).to.equal(3);
  });

  it("should cap orphaned file results at 5 even when more unknown files exist", async () => {
    const unknownFiles = Array.from({ length: 7 }, (_, i) =>
      createStubFile({ name: `stray${i}.txt`, extendedPath: `/project/stray${i}.txt` })
    );
    const project = createStubProject([], [], { unknownFiles });
    const results = await generator.generate(project);
    const orphans = results.filter((r) => r.generatorIndex === CheckIntegrityTests.OrphanedFile.id);
    expect(orphans.length).to.equal(5);
  });

  it("should not report UnexpectedManifest for a pack with a single manifest", async () => {
    const manifest = createStubProjectItem({ name: "manifest.json" });
    const pack = createStubPack({ items: [manifest], name: "my-pack" });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckIntegrityTests.UnexpectedManifest.id);
    expect(errors.length).to.equal(0);
  });

  it("should report UnexpectedManifest when a pack has more than one manifest", async () => {
    const manifest1 = createStubProjectItem({ name: "manifest.json" });
    const manifest2 = createStubProjectItem({ name: "manifest.json" });
    const pack = createStubPack({ items: [manifest1, manifest2], name: "bad-pack" });
    const results = await generator.generate(createStubProject([], [pack]));
    const errors = results.filter((r) => r.generatorIndex === CheckIntegrityTests.UnexpectedManifest.id);
    expect(errors.length).to.equal(1);
  });
});
