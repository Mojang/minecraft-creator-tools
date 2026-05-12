// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * NpmPackageDefinition Tests
 *
 * Validates that all package.json generation and sanitization logic
 * produces pinned (exact) dependency versions with no semver range
 * prefixes (^, ~, >=, etc.).
 */

import { expect } from "chai";
import {
  DevDependenciesDefault,
  DependenciesDefault,
  SetupRequiredDependencies,
  PackageJsonDefault,
  pinVersion,
  pinDependencies,
} from "../devproject/NpmPackageDefinition";
import NpmPackageDefinition from "../devproject/NpmPackageDefinition";
import ZipStorage from "../storage/ZipStorage";

const RANGE_PREFIX_PATTERN = /^[~^>=<]/;

describe("pinVersion", () => {
  it("strips caret prefix", () => {
    expect(pinVersion("^1.2.3")).to.equal("1.2.3");
  });

  it("strips tilde prefix", () => {
    expect(pinVersion("~1.2.3")).to.equal("1.2.3");
  });

  it("strips >= prefix", () => {
    expect(pinVersion(">=1.2.3")).to.equal("1.2.3");
  });

  it("strips < prefix", () => {
    expect(pinVersion("<2.0.0")).to.equal("2.0.0");
  });

  it("leaves exact version unchanged", () => {
    expect(pinVersion("1.2.3")).to.equal("1.2.3");
  });

  it("handles prerelease versions", () => {
    expect(pinVersion("^0.1.0-beta.1.21.30-preview.24")).to.equal("0.1.0-beta.1.21.30-preview.24");
  });

  it("handles version 0.x correctly", () => {
    expect(pinVersion("^0.7.4")).to.equal("0.7.4");
  });
});

describe("pinDependencies", () => {
  it("strips all range prefixes from a dependency record", () => {
    const input: Record<string, string> = {
      foo: "^1.0.0",
      bar: "~2.3.4",
      baz: "3.0.0",
    };
    const result = pinDependencies(input);
    expect(result).to.deep.equal({
      foo: "1.0.0",
      bar: "2.3.4",
      baz: "3.0.0",
    });
  });

  it("returns empty record for empty input", () => {
    expect(pinDependencies({})).to.deep.equal({});
  });
});

describe("dependency-version-pinning", () => {
  it("DevDependenciesDefault has no range prefixes", () => {
    for (const [pkg, version] of Object.entries(DevDependenciesDefault)) {
      expect(version, `DevDependency '${pkg}' version '${version}' must be pinned`).to.not.match(RANGE_PREFIX_PATTERN);
    }
  });

  it("DependenciesDefault has no range prefixes", () => {
    for (const [pkg, version] of Object.entries(DependenciesDefault)) {
      expect(version, `Dependency '${pkg}' version '${version}' must be pinned`).to.not.match(RANGE_PREFIX_PATTERN);
    }
  });

  it("SetupRequiredDependencies has no range prefixes", () => {
    for (const [pkg, version] of Object.entries(SetupRequiredDependencies)) {
      expect(version, `SetupRequired '${pkg}' version '${version}' must be pinned`).to.not.match(RANGE_PREFIX_PATTERN);
    }
  });

  it("PackageJsonDefault dependencies have no range prefixes", () => {
    if (PackageJsonDefault.dependencies) {
      for (const [pkg, version] of Object.entries(PackageJsonDefault.dependencies)) {
        expect(version, `PackageJsonDefault dep '${pkg}' version '${version}' must be pinned`).to.not.match(
          RANGE_PREFIX_PATTERN
        );
      }
    }
    if (PackageJsonDefault.devDependencies) {
      for (const [pkg, version] of Object.entries(PackageJsonDefault.devDependencies)) {
        expect(version, `PackageJsonDefault devDep '${pkg}' version '${version}' must be pinned`).to.not.match(
          RANGE_PREFIX_PATTERN
        );
      }
    }
  });
});

describe("ensureSetupContent-pinning", () => {
  it("pins caret versions in existing dependencies", async function () {
    this.timeout(10000);

    const zipStorage = new ZipStorage();
    const file = zipStorage.rootFolder.ensureFile("package.json");
    file.setContent(
      JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        dependencies: {
          "@minecraft/server": "^2.0.0",
          "@minecraft/server-ui": "~2.0.0",
        },
      })
    );
    await file.saveContent();

    const npmPkg = await NpmPackageDefinition.ensureOnFile(file);
    expect(npmPkg).to.not.be.undefined;

    if (npmPkg) {
      const changed = await npmPkg.ensureSetupContent();
      expect(changed).to.equal(true);

      expect(npmPkg.definition).to.not.be.undefined;
      if (npmPkg.definition && npmPkg.definition.dependencies) {
        for (const [pkg, version] of Object.entries(npmPkg.definition.dependencies)) {
          expect(version, `After ensureSetupContent, '${pkg}' should be pinned`).to.not.match(RANGE_PREFIX_PATTERN);
        }
      }
    }
  });

  it("pins caret versions in existing devDependencies", async function () {
    this.timeout(10000);

    const zipStorage = new ZipStorage();
    const file = zipStorage.rootFolder.ensureFile("package.json");
    file.setContent(
      JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        devDependencies: {
          typescript: "^5.5.4",
          "ts-node": "^10.9.1",
        },
      })
    );
    await file.saveContent();

    const npmPkg = await NpmPackageDefinition.ensureOnFile(file);
    expect(npmPkg).to.not.be.undefined;

    if (npmPkg) {
      const changed = await npmPkg.ensureSetupContent();
      expect(changed).to.equal(true);

      expect(npmPkg.definition).to.not.be.undefined;
      if (npmPkg.definition && npmPkg.definition.devDependencies) {
        for (const [pkg, version] of Object.entries(npmPkg.definition.devDependencies)) {
          expect(version, `After ensureSetupContent, devDep '${pkg}' should be pinned`).to.not.match(
            RANGE_PREFIX_PATTERN
          );
        }
      }
    }
  });

  it("does not report changes when versions are already pinned", async function () {
    this.timeout(10000);

    const zipStorage = new ZipStorage();
    const file = zipStorage.rootFolder.ensureFile("package.json");
    file.setContent(
      JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        dependencies: {
          "@minecraft/server": "2.0.0",
          "@minecraft/server-ui": "2.0.0",
        },
        scripts: {
          lint: "just-scripts lint",
          build: "just-scripts build",
          clean: "just-scripts clean",
          deploy: "npm run build && npx mct deploy env -i .",
          "local-deploy": "just-scripts local-deploy",
          mcaddon: "just-scripts mcaddon",
        },
      })
    );
    await file.saveContent();

    const npmPkg = await NpmPackageDefinition.ensureOnFile(file);
    expect(npmPkg).to.not.be.undefined;

    if (npmPkg) {
      const changed = await npmPkg.ensureSetupContent();
      expect(changed).to.equal(false, "Already-pinned versions should not cause changes");
    }
  });
});

describe("ensureStandardContent-pinning", () => {
  it("pins caret versions when processing known dependencies", async function () {
    this.timeout(10000);

    const zipStorage = new ZipStorage();
    const file = zipStorage.rootFolder.ensureFile("package.json");
    file.setContent(
      JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        dependencies: {
          "@minecraft/math": "^2.4.0",
          "@minecraft/server": "^2.0.0",
          "@minecraft/server-editor": "^0.1.0-beta.1.21.30-preview.24",
          "@minecraft/server-ui": "^2.0.0",
          "@minecraft/vanilla-data": "^1.26.13",
        },
        devDependencies: {
          "@minecraft/core-build-tasks": "^5.2.0",
          "eslint-plugin-minecraft-linting": "^2.0.2",
          "source-map": "^0.7.4",
          "ts-node": "^10.9.1",
          typescript: "^5.5.4",
        },
      })
    );
    await file.saveContent();

    const npmPkg = await NpmPackageDefinition.ensureOnFile(file);
    expect(npmPkg).to.not.be.undefined;

    if (npmPkg) {
      await npmPkg.ensureStandardContent();

      expect(npmPkg.definition).to.not.be.undefined;
      if (npmPkg.definition) {
        if (npmPkg.definition.dependencies) {
          for (const [pkg, version] of Object.entries(npmPkg.definition.dependencies)) {
            expect(version, `After ensureStandardContent, dep '${pkg}' should be pinned`).to.not.match(
              RANGE_PREFIX_PATTERN
            );
          }
        }
        if (npmPkg.definition.devDependencies) {
          for (const [pkg, version] of Object.entries(npmPkg.definition.devDependencies)) {
            expect(version, `After ensureStandardContent, devDep '${pkg}' should be pinned`).to.not.match(
              RANGE_PREFIX_PATTERN
            );
          }
        }
      }
    }
  });
});
