// Copyright (c) Mojang AB.  All rights reserved.
// Licensed under the MIT License.

import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import MinecraftMcpServer from "../local/MinecraftMcpServer";

/**
 * Tests the output-path resolution heuristic used by createMinecraftContent:
 *   1. Reference points (behavior_packs/, resource_packs/, package.json, manifest.json)
 *      anchor to the project root.
 *   2. Empty / non-existent folders are used directly.
 *   3. Non-empty folders with unrelated content get a namespaced subfolder.
 */
describe("MinecraftMcpServer._resolveProjectRoot", function () {
  let tempRoot: string;

  beforeEach(function () {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mct-resolve-"));
  });

  afterEach(function () {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  });

  // _resolveProjectRoot is TypeScript-private; reach into it for targeted testing.
  const resolve = (outputPath: string, def: { namespace?: string; displayName?: string }) =>
    (MinecraftMcpServer as any)._resolveProjectRoot(outputPath, def) as { root: string; reason: string };

  it("uses outputPath as-is when it does not yet exist", function () {
    const target = path.join(tempRoot, "new_project_folder");
    const result = resolve(target, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(target));
    expect(result.reason).to.match(/empty|does not/i);
  });

  it("uses outputPath as-is when it is empty", function () {
    const result = resolve(tempRoot, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(tempRoot));
    expect(result.reason).to.match(/empty/i);
  });

  it("ignores hidden/system files when deciding emptiness", function () {
    fs.writeFileSync(path.join(tempRoot, ".DS_Store"), "");
    fs.writeFileSync(path.join(tempRoot, "Thumbs.db"), "");
    const result = resolve(tempRoot, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(tempRoot));
  });

  it("anchors to outputPath when behavior_packs/ is present", function () {
    fs.mkdirSync(path.join(tempRoot, "behavior_packs"));
    fs.writeFileSync(path.join(tempRoot, "README.md"), "hello");
    const result = resolve(tempRoot, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(tempRoot));
    expect(result.reason).to.match(/behavior_packs|resource_packs/);
  });

  it("anchors to outputPath when resource_packs/ is present", function () {
    fs.mkdirSync(path.join(tempRoot, "resource_packs"));
    const result = resolve(tempRoot, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(tempRoot));
  });

  it("anchors to outputPath when package.json is present", function () {
    fs.writeFileSync(path.join(tempRoot, "package.json"), "{}");
    fs.writeFileSync(path.join(tempRoot, "other.txt"), "x");
    const result = resolve(tempRoot, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(tempRoot));
    expect(result.reason).to.match(/package\.json/);
  });

  it("walks up one level to find behavior_packs/ in the parent", function () {
    const subdir = path.join(tempRoot, "scratch");
    fs.mkdirSync(subdir);
    fs.mkdirSync(path.join(tempRoot, "behavior_packs"));
    const result = resolve(subdir, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(tempRoot));
  });

  it("creates a namespaced subfolder for non-empty, unmarked folders", function () {
    fs.writeFileSync(path.join(tempRoot, "random.txt"), "x");
    fs.writeFileSync(path.join(tempRoot, "other.md"), "y");
    const result = resolve(tempRoot, { namespace: "castles_and_knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(path.join(tempRoot, "castles_and_knights")));
    expect(result.reason).to.match(/subfolder/);
  });

  it("sanitizes the subfolder name from displayName when namespace is missing", function () {
    fs.writeFileSync(path.join(tempRoot, "random.txt"), "x");
    const result = resolve(tempRoot, { displayName: "Castles & Knights!" });
    expect(path.basename(result.root)).to.equal("castles_knights");
  });

  it("treats outputPath as inside a pack when it contains a manifest.json", function () {
    // Simulate outputPath pointing at behavior_packs/my_pack/
    const packDir = path.join(tempRoot, "behavior_packs", "my_pack");
    fs.mkdirSync(packDir, { recursive: true });
    fs.writeFileSync(path.join(packDir, "manifest.json"), "{}");
    const result = resolve(packDir, { namespace: "knights" });
    expect(path.resolve(result.root)).to.equal(path.resolve(tempRoot));
    expect(result.reason).to.match(/manifest/i);
  });
});
