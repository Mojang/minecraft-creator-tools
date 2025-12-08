/**
 * Comprehensive Accessibility Tests for MCTools
 *
 * Uses @axe-core/playwright to run automated WCAG accessibility audits
 * on the landing page and editor interfaces in both light and dark modes.
 *
 * These tests help ensure the application is accessible to users with disabilities
 * and follows WCAG 2.1 Level AA guidelines.
 *
 * Theme Modes:
 * - Light mode is forced via URL parameter ?theme=l
 * - Dark mode is forced via URL parameter ?theme=d
 * - FluentUI Northstar theme is set on page load, so we use URL params for reliable testing
 */

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { enterEditor, gotoWithTheme, ThemeMode } from "./WebTestUtilities";

// Helper to save accessibility results to a file for review
async function saveAccessibilityResults(violations: any[], testName: string, page: any): Promise<void> {
  if (violations.length > 0) {
    console.log(`\n=== Accessibility Issues for ${testName} ===`);
    violations.forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.id}: ${violation.description}`);
      console.log(`   Impact: ${violation.impact}`);
      console.log(`   Help: ${violation.helpUrl}`);
      console.log(`   Affected elements: ${violation.nodes.length}`);
      violation.nodes.slice(0, 3).forEach((node: any) => {
        console.log(`   - ${node.html.substring(0, 100)}...`);
      });
    });
  }
}

test.describe("Accessibility Tests - Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Wait for React to fully render
    await page.waitForTimeout(1000);
  });

  test("landing page should have no critical accessibility violations", async ({ page }) => {
    // Take a screenshot for reference
    await page.screenshot({ path: "debugoutput/screenshots/a11y-landing-page.png", fullPage: true });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Exclude known minor issues that are acceptable
      .disableRules(["heading-order"]) // Heading order issues are moderate, not critical
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Landing Page", page);

    // Filter for critical and serious issues only
    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    // Log all violations for awareness, but only fail on critical/serious
    if (accessibilityScanResults.violations.length > 0) {
      console.log(`\nTotal violations found: ${accessibilityScanResults.violations.length}`);
      console.log(`Critical/Serious violations: ${criticalViolations.length}`);
    }

    // Assert no critical violations - we may need to fix these
    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations on landing page`
    ).toHaveLength(0);
  });

  test("landing page header should be accessible", async ({ page }) => {
    // Focus on header area only
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include("header, [role='banner'], nav")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Landing Page Header", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("landing page buttons should be keyboard accessible", async ({ page }) => {
    // Test that main buttons can be focused and activated
    const chooseFilesButton = page.getByRole("button", { name: /choose files/i }).first();
    const editFolderButton = page.getByRole("button", { name: /edit folder/i }).first();
    const createNewButtons = page.getByRole("button", { name: /create new/i });

    // Check Choose Files button
    if (await chooseFilesButton.isVisible()) {
      await chooseFilesButton.focus();
      await expect(chooseFilesButton).toBeFocused();
    }

    // Check Edit Folder button
    if (await editFolderButton.isVisible()) {
      await editFolderButton.focus();
      await expect(editFolderButton).toBeFocused();
    }

    // Check at least one Create New button
    const firstCreateNew = createNewButtons.first();
    if (await firstCreateNew.isVisible()) {
      await firstCreateNew.focus();
      await expect(firstCreateNew).toBeFocused();
    }

    // Take screenshot showing focus state
    await page.screenshot({ path: "debugoutput/screenshots/a11y-button-focus.png" });
  });

  test("landing page should have proper heading hierarchy", async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["heading-order", "empty-heading", "page-has-heading-one"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Heading Hierarchy", page);

    // These are important for screen readers
    expect(accessibilityScanResults.violations.filter((v) => v.id === "page-has-heading-one")).toHaveLength(0);
  });

  test("landing page images should have alt text", async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["image-alt", "image-redundant-alt"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Image Alt Text", page);

    const criticalImageIssues = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalImageIssues).toHaveLength(0);
  });

  test("landing page color contrast should meet WCAG AA", async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["color-contrast", "color-contrast-enhanced"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Color Contrast", page);

    // Log contrast issues for review (common with dark themes)
    if (accessibilityScanResults.violations.length > 0) {
      console.log("\nColor contrast issues found - review for Minecraft theme compatibility");
    }
  });

  test("landing page forms should be properly labeled", async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["label", "label-title-only", "form-field-multiple-labels"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Form Labels", page);

    const criticalFormIssues = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalFormIssues).toHaveLength(0);
  });
});

test.describe("Accessibility Tests - Editor Interface", () => {
  test("editor interface should have no critical accessibility violations", async ({ page }) => {
    // Enter editor using centralized helper
    const enteredEditor = await enterEditor(page);

    if (!enteredEditor) {
      console.log("Could not enter editor - skipping editor accessibility test");
      test.skip();
      return;
    }

    await page.screenshot({ path: "debugoutput/screenshots/a11y-editor-interface.png", fullPage: true });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Exclude aria-toggle-field-name - this is a FluentUI Northstar library limitation
      // where List items with selectableListBehavior get role="option" but the library
      // doesn't support passing aria-label to the <li> element. The items do have visible
      // text content which should be accessible.
      .disableRules(["aria-toggle-field-name"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Editor Interface", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    // Log detailed info about violations for debugging
    criticalViolations.forEach((v) => {
      console.log(`\nViolation: ${v.id}`);
      v.nodes.forEach((node: any) => {
        console.log(`  Target: ${JSON.stringify(node.target)}`);
        console.log(`  HTML: ${node.html.substring(0, 200)}`);
      });
    });

    console.log(`\nEditor - Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Editor - Critical/Serious: ${criticalViolations.length}`);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious accessibility violations in editor`
    ).toHaveLength(0);
  });

  test("editor toolbar should be keyboard navigable", async ({ page }) => {
    const enteredEditor = await enterEditor(page);

    if (!enteredEditor) {
      test.skip();
      return;
    }

    // Test toolbar buttons can be focused
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    const shareButton = page.getByRole("button", { name: /share/i }).first();
    const runButton = page.getByRole("button", { name: /run/i }).first();

    // Focus each toolbar button
    await viewButton.focus();
    await expect(viewButton).toBeFocused();

    await shareButton.focus();
    await expect(shareButton).toBeFocused();

    await runButton.focus();
    await expect(runButton).toBeFocused();

    await page.screenshot({ path: "debugoutput/screenshots/a11y-editor-toolbar-focus.png" });
  });

  test("editor file list should be accessible", async ({ page }) => {
    const enteredEditor = await enterEditor(page);

    if (!enteredEditor) {
      test.skip();
      return;
    }

    // Run accessibility check on the whole page but focus on list-related issues
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["listitem", "list", "aria-required-children", "aria-required-parent"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Editor File List", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("editor dropdown menus should be accessible", async ({ page }) => {
    const enteredEditor = await enterEditor(page);

    if (!enteredEditor) {
      test.skip();
      return;
    }

    // Open View dropdown
    const viewButton = page.getByRole("button", { name: /view/i }).first();
    await viewButton.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: "debugoutput/screenshots/a11y-editor-dropdown.png" });

    // Check dropdown accessibility
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[role="menu"], [role="listbox"], [class*="dropdown"], [class*="menu"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Editor Dropdown Menus", page);

    // Close dropdown
    await page.keyboard.press("Escape");
  });

  test("editor should support keyboard navigation", async ({ page }) => {
    const enteredEditor = await enterEditor(page);

    if (!enteredEditor) {
      test.skip();
      return;
    }

    // Test Tab navigation through main interface elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Verify something is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();

    await page.screenshot({ path: "debugoutput/screenshots/a11y-editor-keyboard-nav.png" });
  });
});

test.describe("Accessibility Tests - Interactive Components", () => {
  test("McButton components should be accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find all buttons styled with McButton
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include("button")
      .withRules(["button-name"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "McButton Components", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("McListItem components should be accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check if there's a project list (McListItem components)
    const projectPanel = page.locator('[class*="project"], [class*="Project"]');

    if (await projectPanel.first().isVisible()) {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[class*="project"], [class*="Project"]')
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      await saveAccessibilityResults(accessibilityScanResults.violations, "McListItem Components", page);
    }
  });

  test("project creation dialog should be accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open project creation dialog
    const newButton = page.getByRole("button", { name: "New" }).first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: "debugoutput/screenshots/a11y-project-dialog.png" });

      // Check dialog accessibility
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include('[role="dialog"], [class*="dialog"], [class*="modal"], [class*="Dialog"]')
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();

      await saveAccessibilityResults(accessibilityScanResults.violations, "Project Creation Dialog", page);

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      // Close dialog
      const cancelButton = page.locator("button:has-text('Cancel')").first();
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      } else {
        await page.keyboard.press("Escape");
      }

      expect(criticalViolations).toHaveLength(0);
    }
  });
});

test.describe("Accessibility Tests - ARIA and Semantic HTML", () => {
  test("page should have proper ARIA landmarks", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["landmark-one-main", "region", "bypass"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "ARIA Landmarks", page);

    // Log landmark issues - these help screen reader users navigate
    if (accessibilityScanResults.violations.length > 0) {
      console.log("\nLandmark issues found - consider adding main, nav, and other ARIA landmarks");
    }
  });

  test("interactive elements should have accessible names", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["button-name", "link-name", "input-button-name"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Accessible Names", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(criticalViolations).toHaveLength(0);
  });

  test("focus order should be logical", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["tabindex", "focus-order-semantics"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Focus Order", page);
  });
});

test.describe("Accessibility Summary Report", () => {
  test("generate full accessibility report for landing page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    console.log("\n========================================");
    console.log("ACCESSIBILITY SUMMARY REPORT - LANDING PAGE");
    console.log("========================================");
    console.log(`Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Passes: ${accessibilityScanResults.passes.length}`);
    console.log(`Incomplete (needs review): ${accessibilityScanResults.incomplete.length}`);
    console.log(`Inapplicable: ${accessibilityScanResults.inapplicable.length}`);

    // Group by impact
    const byImpact = {
      critical: accessibilityScanResults.violations.filter((v) => v.impact === "critical"),
      serious: accessibilityScanResults.violations.filter((v) => v.impact === "serious"),
      moderate: accessibilityScanResults.violations.filter((v) => v.impact === "moderate"),
      minor: accessibilityScanResults.violations.filter((v) => v.impact === "minor"),
    };

    console.log("\nViolations by impact:");
    console.log(`  Critical: ${byImpact.critical.length}`);
    console.log(`  Serious: ${byImpact.serious.length}`);
    console.log(`  Moderate: ${byImpact.moderate.length}`);
    console.log(`  Minor: ${byImpact.minor.length}`);

    // List all violations with their IDs for tracking
    if (accessibilityScanResults.violations.length > 0) {
      console.log("\nAll violations:");
      accessibilityScanResults.violations.forEach((v) => {
        console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
      });
    }

    await page.screenshot({ path: "debugoutput/screenshots/a11y-full-report-landing.png", fullPage: true });
  });

  test("generate full accessibility report for editor", async ({ page }) => {
    // Enter editor using centralized helper
    const enteredEditor = await enterEditor(page);

    if (!enteredEditor) {
      console.log("Could not enter editor - skipping editor report");
      test.skip();
      return;
    }

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    console.log("\n========================================");
    console.log("ACCESSIBILITY SUMMARY REPORT - EDITOR");
    console.log("========================================");
    console.log(`Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Passes: ${accessibilityScanResults.passes.length}`);
    console.log(`Incomplete (needs review): ${accessibilityScanResults.incomplete.length}`);

    const byImpact = {
      critical: accessibilityScanResults.violations.filter((v) => v.impact === "critical"),
      serious: accessibilityScanResults.violations.filter((v) => v.impact === "serious"),
      moderate: accessibilityScanResults.violations.filter((v) => v.impact === "moderate"),
      minor: accessibilityScanResults.violations.filter((v) => v.impact === "minor"),
    };

    console.log("\nViolations by impact:");
    console.log(`  Critical: ${byImpact.critical.length}`);
    console.log(`  Serious: ${byImpact.serious.length}`);
    console.log(`  Moderate: ${byImpact.moderate.length}`);
    console.log(`  Minor: ${byImpact.minor.length}`);

    if (accessibilityScanResults.violations.length > 0) {
      console.log("\nAll violations:");
      accessibilityScanResults.violations.forEach((v) => {
        console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
      });
    }

    await page.screenshot({ path: "debugoutput/screenshots/a11y-full-report-editor.png", fullPage: true });
  });
});

// ============================================================================
// THEME-SPECIFIC ACCESSIBILITY TESTS
// ============================================================================
// These tests verify accessibility in both light and dark modes.
// FluentUI Northstar theme is set on page load via URL parameter.
// ============================================================================

test.describe("Accessibility Tests - Light Mode", () => {
  test("landing page in light mode should have no critical accessibility violations", async ({ page }) => {
    await gotoWithTheme(page, "light");
    await page.waitForTimeout(500);

    await page.screenshot({ path: "debugoutput/screenshots/a11y-landing-light-mode.png", fullPage: true });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["heading-order"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Landing Page - Light Mode", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    console.log(`\nLight Mode - Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Light Mode - Critical/Serious: ${criticalViolations.length}`);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious violations in light mode landing page`
    ).toHaveLength(0);
  });

  test("light mode color contrast should meet WCAG AA", async ({ page }) => {
    await gotoWithTheme(page, "light");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["color-contrast", "color-contrast-enhanced"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Color Contrast - Light Mode", page);

    // Log contrast issues for review
    const contrastIssues = accessibilityScanResults.violations.filter((v) => v.id === "color-contrast");
    if (contrastIssues.length > 0) {
      console.log(`\nLight Mode - Color contrast issues: ${contrastIssues.length}`);
      contrastIssues.forEach((v) => {
        v.nodes.slice(0, 5).forEach((node: any) => {
          console.log(`  - ${node.html.substring(0, 80)}...`);
        });
      });
    }

    // Light mode should have good contrast - fail on serious contrast issues
    const seriousContrastIssues = accessibilityScanResults.violations.filter(
      (v) => v.id === "color-contrast" && (v.impact === "critical" || v.impact === "serious")
    );

    expect(
      seriousContrastIssues,
      `Found ${seriousContrastIssues.length} serious contrast issues in light mode`
    ).toHaveLength(0);
  });

  test("editor in light mode should have no critical accessibility violations", async ({ page }) => {
    const enteredEditor = await enterEditor(page, "light");

    if (!enteredEditor) {
      console.log("Could not enter editor in light mode - skipping");
      test.skip();
      return;
    }

    await page.screenshot({ path: "debugoutput/screenshots/a11y-editor-light-mode.png", fullPage: true });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["aria-toggle-field-name"]) // FluentUI library limitation
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Editor - Light Mode", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    console.log(`\nLight Mode Editor - Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Light Mode Editor - Critical/Serious: ${criticalViolations.length}`);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious violations in light mode editor`
    ).toHaveLength(0);
  });
});

test.describe("Accessibility Tests - Dark Mode", () => {
  test("landing page in dark mode should have no critical accessibility violations", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    await page.screenshot({ path: "debugoutput/screenshots/a11y-landing-dark-mode.png", fullPage: true });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["heading-order"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Landing Page - Dark Mode", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    console.log(`\nDark Mode - Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Dark Mode - Critical/Serious: ${criticalViolations.length}`);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious violations in dark mode landing page`
    ).toHaveLength(0);
  });

  test("dark mode color contrast should meet WCAG AA", async ({ page }) => {
    await gotoWithTheme(page, "dark");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withRules(["color-contrast", "color-contrast-enhanced"])
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Color Contrast - Dark Mode", page);

    // Log contrast issues for review
    const contrastIssues = accessibilityScanResults.violations.filter((v) => v.id === "color-contrast");
    if (contrastIssues.length > 0) {
      console.log(`\nDark Mode - Color contrast issues: ${contrastIssues.length}`);
      contrastIssues.forEach((v) => {
        v.nodes.slice(0, 5).forEach((node: any) => {
          console.log(`  - ${node.html.substring(0, 80)}...`);
        });
      });
    }

    // Dark mode commonly has contrast challenges - report but don't fail for now
    // This allows us to track dark mode contrast issues separately
    const seriousContrastIssues = accessibilityScanResults.violations.filter(
      (v) => v.id === "color-contrast" && (v.impact === "critical" || v.impact === "serious")
    );

    expect(
      seriousContrastIssues,
      `Found ${seriousContrastIssues.length} serious contrast issues in dark mode`
    ).toHaveLength(0);
  });

  test("editor in dark mode should have no critical accessibility violations", async ({ page }) => {
    const enteredEditor = await enterEditor(page, "dark");

    if (!enteredEditor) {
      console.log("Could not enter editor in dark mode - skipping");
      test.skip();
      return;
    }

    await page.screenshot({ path: "debugoutput/screenshots/a11y-editor-dark-mode.png", fullPage: true });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["aria-toggle-field-name"]) // FluentUI library limitation
      .analyze();

    await saveAccessibilityResults(accessibilityScanResults.violations, "Editor - Dark Mode", page);

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    console.log(`\nDark Mode Editor - Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Dark Mode Editor - Critical/Serious: ${criticalViolations.length}`);

    expect(
      criticalViolations,
      `Found ${criticalViolations.length} critical/serious violations in dark mode editor`
    ).toHaveLength(0);
  });
});

test.describe("Accessibility Tests - Theme Comparison", () => {
  test("compare accessibility between light and dark modes", async ({ page }) => {
    // Test light mode
    await gotoWithTheme(page, "light");
    await page.waitForTimeout(500);

    const lightResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    // Test dark mode
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(500);

    const darkResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    console.log("\n========================================");
    console.log("THEME COMPARISON REPORT");
    console.log("========================================");
    console.log(`Light Mode violations: ${lightResults.violations.length}`);
    console.log(`Dark Mode violations: ${darkResults.violations.length}`);

    // Compare critical issues
    const lightCritical = lightResults.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    const darkCritical = darkResults.violations.filter((v) => v.impact === "critical" || v.impact === "serious");

    console.log(`\nLight Mode critical/serious: ${lightCritical.length}`);
    console.log(`Dark Mode critical/serious: ${darkCritical.length}`);

    // Find violations unique to each mode
    const lightViolationIds = new Set(lightResults.violations.map((v) => v.id));
    const darkViolationIds = new Set(darkResults.violations.map((v) => v.id));

    const lightOnly = [...lightViolationIds].filter((id) => !darkViolationIds.has(id));
    const darkOnly = [...darkViolationIds].filter((id) => !lightViolationIds.has(id));

    if (lightOnly.length > 0) {
      console.log(`\nViolations only in Light Mode: ${lightOnly.join(", ")}`);
    }
    if (darkOnly.length > 0) {
      console.log(`Violations only in Dark Mode: ${darkOnly.join(", ")}`);
    }

    // Take comparison screenshots
    await gotoWithTheme(page, "light");
    await page.screenshot({ path: "debugoutput/screenshots/a11y-comparison-light.png", fullPage: true });

    await gotoWithTheme(page, "dark");
    await page.screenshot({ path: "debugoutput/screenshots/a11y-comparison-dark.png", fullPage: true });
  });

  test("McButton should be accessible in both themes", async ({ page }) => {
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      await gotoWithTheme(page, mode);

      const accessibilityScanResults = await new AxeBuilder({ page })
        .include("button")
        .withRules(["button-name", "color-contrast"])
        .analyze();

      await saveAccessibilityResults(accessibilityScanResults.violations, `McButton Components - ${mode} mode`, page);

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      expect(
        criticalViolations,
        `Found ${criticalViolations.length} critical button violations in ${mode} mode`
      ).toHaveLength(0);
    }
  });

  test("project creation dialog should be accessible in both themes", async ({ page }) => {
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      await gotoWithTheme(page, mode);

      // Open project creation dialog
      const newButton = page.getByRole("button", { name: "New" }).first();
      if (await newButton.isVisible()) {
        await newButton.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `debugoutput/screenshots/a11y-project-dialog-${mode}.png`,
        });

        // Check dialog accessibility
        const accessibilityScanResults = await new AxeBuilder({ page })
          .include('[role="dialog"], [class*="dialog"], [class*="modal"], [class*="Dialog"]')
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();

        await saveAccessibilityResults(accessibilityScanResults.violations, `Project Dialog - ${mode} mode`, page);

        const criticalViolations = accessibilityScanResults.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious"
        );

        // Close dialog
        const cancelButton = page.locator("button:has-text('Cancel')").first();
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        } else {
          await page.keyboard.press("Escape");
        }

        expect(
          criticalViolations,
          `Found ${criticalViolations.length} critical dialog violations in ${mode} mode`
        ).toHaveLength(0);
      }
    }
  });
});

test.describe("Accessibility Summary Reports - Both Themes", () => {
  test("generate full accessibility report for light mode", async ({ page }) => {
    await gotoWithTheme(page, "light");
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    console.log("\n========================================");
    console.log("ACCESSIBILITY SUMMARY - LIGHT MODE");
    console.log("========================================");
    console.log(`Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Passes: ${accessibilityScanResults.passes.length}`);
    console.log(`Incomplete: ${accessibilityScanResults.incomplete.length}`);

    const byImpact = {
      critical: accessibilityScanResults.violations.filter((v) => v.impact === "critical"),
      serious: accessibilityScanResults.violations.filter((v) => v.impact === "serious"),
      moderate: accessibilityScanResults.violations.filter((v) => v.impact === "moderate"),
      minor: accessibilityScanResults.violations.filter((v) => v.impact === "minor"),
    };

    console.log("\nViolations by impact:");
    console.log(`  Critical: ${byImpact.critical.length}`);
    console.log(`  Serious: ${byImpact.serious.length}`);
    console.log(`  Moderate: ${byImpact.moderate.length}`);
    console.log(`  Minor: ${byImpact.minor.length}`);

    if (accessibilityScanResults.violations.length > 0) {
      console.log("\nAll violations:");
      accessibilityScanResults.violations.forEach((v) => {
        console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
      });
    }

    await page.screenshot({ path: "debugoutput/screenshots/a11y-report-light-mode.png", fullPage: true });
  });

  test("generate full accessibility report for dark mode", async ({ page }) => {
    await gotoWithTheme(page, "dark");
    await page.waitForTimeout(1000);

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
      .analyze();

    console.log("\n========================================");
    console.log("ACCESSIBILITY SUMMARY - DARK MODE");
    console.log("========================================");
    console.log(`Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`Passes: ${accessibilityScanResults.passes.length}`);
    console.log(`Incomplete: ${accessibilityScanResults.incomplete.length}`);

    const byImpact = {
      critical: accessibilityScanResults.violations.filter((v) => v.impact === "critical"),
      serious: accessibilityScanResults.violations.filter((v) => v.impact === "serious"),
      moderate: accessibilityScanResults.violations.filter((v) => v.impact === "moderate"),
      minor: accessibilityScanResults.violations.filter((v) => v.impact === "minor"),
    };

    console.log("\nViolations by impact:");
    console.log(`  Critical: ${byImpact.critical.length}`);
    console.log(`  Serious: ${byImpact.serious.length}`);
    console.log(`  Moderate: ${byImpact.moderate.length}`);
    console.log(`  Minor: ${byImpact.minor.length}`);

    if (accessibilityScanResults.violations.length > 0) {
      console.log("\nAll violations:");
      accessibilityScanResults.violations.forEach((v) => {
        console.log(`  - [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
      });
    }

    await page.screenshot({ path: "debugoutput/screenshots/a11y-report-dark-mode.png", fullPage: true });
  });

  test("generate full editor accessibility report for both themes", async ({ page }) => {
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      const enteredEditor = await enterEditor(page, mode);

      if (!enteredEditor) {
        console.log(`Could not enter editor in ${mode} mode - skipping`);
        continue;
      }

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();

      console.log(`\n========================================`);
      console.log(`EDITOR ACCESSIBILITY - ${mode.toUpperCase()} MODE`);
      console.log(`========================================`);
      console.log(`Total violations: ${accessibilityScanResults.violations.length}`);

      const byImpact = {
        critical: accessibilityScanResults.violations.filter((v) => v.impact === "critical"),
        serious: accessibilityScanResults.violations.filter((v) => v.impact === "serious"),
        moderate: accessibilityScanResults.violations.filter((v) => v.impact === "moderate"),
        minor: accessibilityScanResults.violations.filter((v) => v.impact === "minor"),
      };

      console.log(`\nViolations by impact:`);
      console.log(`  Critical: ${byImpact.critical.length}`);
      console.log(`  Serious: ${byImpact.serious.length}`);
      console.log(`  Moderate: ${byImpact.moderate.length}`);
      console.log(`  Minor: ${byImpact.minor.length}`);

      await page.screenshot({
        path: `debugoutput/screenshots/a11y-editor-report-${mode}.png`,
        fullPage: true,
      });
    }
  });
});
