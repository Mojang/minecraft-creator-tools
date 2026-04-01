// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ViteBundleIntegrityTest - Static analysis of vite.config.js manualChunks
 *
 * This test validates that the Vite production build configuration correctly
 * routes known-problematic scoped npm packages into the vendor-misc chunk.
 *
 * BACKGROUND:
 * Vite's manualChunks function splits scoped packages (@scope/name) into
 * individual vendor chunks (e.g., vendor-formatjs-intl). Some packages have
 * tightly-coupled circular dependencies with non-scoped packages that land
 * in vendor-misc. When these interdependent modules are split across chunk
 * boundaries, ES module hoisting causes "X is not a function" or
 * "Cannot access X before initialization" errors at runtime.
 *
 * The fix is to merge these scoped packages into vendor-misc alongside their
 * non-scoped counterparts. This test ensures that known-problematic scopes
 * are always routed to vendor-misc in the manualChunks function.
 *
 * This test would have caught the @formatjs chunking regression that caused
 * "Gk is not a function" errors on the production GitHub Pages deployment.
 */

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import TestPaths from "./TestPaths";

// Scoped packages that MUST be routed to vendor-misc due to cross-chunk
// initialization dependencies. If a new scoped dependency causes runtime
// errors in the production build, add its scope here and in vite.config.js.
const REQUIRED_VENDOR_MISC_SCOPES = ["@mui", "@emotion", "@babel", "@formatjs"];

describe("Vite Bundle Configuration", () => {
  let viteConfigContent: string;

  before(() => {
    const viteConfigPath = path.join(TestPaths.appRoot, "vite.config.js");
    viteConfigContent = fs.readFileSync(viteConfigPath, "utf-8");
  });

  it("should have a manualChunks function", () => {
    expect(viteConfigContent).to.include("manualChunks");
  });

  for (const scope of REQUIRED_VENDOR_MISC_SCOPES) {
    it(`should route ${scope} packages to vendor-misc`, () => {
      // The vite config routes scoped packages to vendor-misc using patterns like:
      //   if (scope === "@formatjs") { return "vendor-misc"; }
      //   if (scope === "@mui" || scope === "@emotion") { return "vendor-misc"; }
      // We use a regex to find: scope === "@scope" ... return "vendor-misc"
      // on the same logical if-block (within a few lines).

      // Extract the manualChunks function section
      const chunksStart = viteConfigContent.indexOf("manualChunks");
      expect(chunksStart, "manualChunks section should exist").to.be.greaterThan(-1);

      const chunksSection = viteConfigContent.slice(chunksStart);

      // Look for: scope === "@scope" ... return "vendor-misc" within a short span
      // This handles both single-scope checks and OR'd checks like:
      //   scope === "@mui" || scope === "@emotion"
      const escapedScope = scope.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(
        `scope\\s*===\\s*"${escapedScope}"[^}]*return\\s*"vendor-misc"`,
        "s" // dotAll flag to match across newlines
      );

      expect(
        pattern.test(chunksSection),
        `${scope} should be routed to vendor-misc in manualChunks. ` +
          `Add: if (scope === "${scope}") { return "vendor-misc"; } ` +
          `before the generic scoped package rule.`
      ).to.be.true;
    });
  }

  it("should route scoped vendor-misc packages before the generic scoped package rule", () => {
    // The vendor-misc routing for specific scopes MUST come before the generic
    // `return \`vendor-\${scope}-\${name}\`` line, otherwise the generic rule
    // would match first and create separate chunks.
    const chunksStart = viteConfigContent.indexOf("manualChunks");
    const chunksSection = viteConfigContent.slice(chunksStart);

    const genericRuleIndex = chunksSection.indexOf("vendor-${scope");

    for (const scope of REQUIRED_VENDOR_MISC_SCOPES) {
      const scopeIndex = chunksSection.indexOf(`"${scope}"`);
      if (scopeIndex > -1) {
        expect(
          scopeIndex,
          `${scope} vendor-misc routing must appear before the generic scoped package rule`
        ).to.be.lessThan(genericRuleIndex);
      }
    }
  });
});
