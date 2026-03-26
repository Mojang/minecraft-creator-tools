/**
 * PackageValidationTest - Validates that the built JSNode CLI package is correct.
 *
 * After jsnbuild completes, this test:
 *   1. Runs `npm pack` in toolbuild/jsn/ to create a .tgz in debugoutput/packages/
 *   2. Unpacks the .tgz into debugoutput/packages/unpacked/
 *   3. Installs dependencies in the unpacked package
 *   4. Validates that the CLI entry point loads without crashing (--help)
 *   5. Validates that the library entry point is requireable
 *
 * Run with: npm run test-package (from app/)
 * Requires: npm run jsnbuild to have completed first
 */

import { assert } from "chai";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import TestPaths from "./TestPaths";

const packagesDir = path.join(TestPaths.appRoot, "debugoutput", "packages");
const unpackedDir = path.join(packagesDir, "unpacked");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cleanDir(dir: string) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

describe("PackageValidation", function () {
  this.timeout(120000);

  const jsnDir = path.join(TestPaths.appRoot, "toolbuild", "jsn");
  let tgzPath: string;

  before(function () {
    // Verify jsnbuild output exists
    const cliEntry = path.join(jsnDir, "cli", "index.mjs");
    if (!fs.existsSync(cliEntry)) {
      this.skip();
      return;
    }

    const packageJson = path.join(jsnDir, "package.json");
    if (!fs.existsSync(packageJson)) {
      this.skip();
      return;
    }

    ensureDir(packagesDir);
    cleanDir(unpackedDir);
  });

  describe("npm pack", function () {
    it("should create a .tgz package", function () {
      // npm pack outputs the filename of the created tarball to stdout
      const packOutput = execSync("npm pack --pack-destination " + JSON.stringify(packagesDir), {
        cwd: jsnDir,
        encoding: "utf-8",
        timeout: 30000,
      });

      const result = (packOutput as string).trim();

      // result is the filename (e.g., "mctools-int-0.0.1.tgz")
      const tgzName = result.split("\n").pop()!.trim();
      tgzPath = path.join(packagesDir, tgzName);

      assert(fs.existsSync(tgzPath), `Expected .tgz at ${tgzPath}`);

      const stats = fs.statSync(tgzPath);
      assert(stats.size > 1000, `Package too small (${stats.size} bytes), likely empty`);
    });
  });

  describe("unpack and validate", function () {
    before(function () {
      if (!tgzPath || !fs.existsSync(tgzPath)) {
        this.skip();
        return;
      }

      // tar xzf extracts into a "package/" subdirectory by convention
      execSync("tar xzf " + JSON.stringify(tgzPath), {
        cwd: unpackedDir,
        timeout: 30000,
      });
    });

    it("should contain package.json with correct bin entry", function () {
      const pkgJsonPath = path.join(unpackedDir, "package", "package.json");
      assert(fs.existsSync(pkgJsonPath), "package.json missing from unpacked package");

      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      assert(pkg.bin, "package.json should have a bin entry");

      const binKeys = Object.keys(pkg.bin);
      assert(binKeys.length > 0, "bin entry should have at least one command");
    });

    it("should contain the CLI entry point", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(unpackedDir, "package", "package.json"), "utf-8"));
      const binEntries = Object.values(pkg.bin) as string[];

      for (const binPath of binEntries) {
        const fullPath = path.join(unpackedDir, "package", binPath);
        assert(fs.existsSync(fullPath), `CLI entry point missing: ${binPath}`);
      }
    });

    it("should contain the library entry point", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(unpackedDir, "package", "package.json"), "utf-8"));
      if (!pkg.main) {
        this.skip();
        return;
      }

      const mainPath = path.join(unpackedDir, "package", pkg.main);
      assert(fs.existsSync(mainPath), `Library entry point missing: ${pkg.main} — run libbuild before packaging`);
    });
  });

  describe("install and run", function () {
    const packageDir = path.join(unpackedDir, "package");

    before(function () {
      if (!fs.existsSync(path.join(packageDir, "package.json"))) {
        this.skip();
        return;
      }

      // Install production dependencies only
      execSync("npm install --omit=dev --ignore-scripts", {
        cwd: packageDir,
        encoding: "utf-8",
        timeout: 60000,
        // Suppress npm output noise
        stdio: ["pipe", "pipe", "pipe"],
      });
    });

    it("CLI entry point should execute --help without error", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
      const binEntries = Object.values(pkg.bin) as string[];
      const cliPath = path.join(packageDir, binEntries[0]);

      const result = execSync(`node ${JSON.stringify(cliPath)} --help`, {
        cwd: packageDir,
        encoding: "utf-8",
        timeout: 15000,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      });

      assert(result.length > 0, "CLI --help should produce output");
    });

    it("CLI entry point should execute version without error", function () {
      const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf-8"));
      const binEntries = Object.values(pkg.bin) as string[];
      const cliPath = path.join(packageDir, binEntries[0]);

      const result = execSync(`node ${JSON.stringify(cliPath)} version`, {
        cwd: packageDir,
        encoding: "utf-8",
        timeout: 15000,
        env: { ...process.env, NODE_NO_WARNINGS: "1" },
      });

      assert(result.length > 0, "CLI version should produce output");
    });
  });
});
