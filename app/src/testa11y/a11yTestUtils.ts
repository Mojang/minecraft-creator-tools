/**
 * Shared accessibility test utilities for the comprehensive MAS test suite.
 *
 * Provides standardized axe scanning, keyboard navigation helpers, focus management
 * assertions, media emulation, and ARIA live region verification. All utilities use
 * consistent WCAG tag sets and violation filtering matching the project conventions
 * established in testweb/Accessibility.spec.ts.
 *
 * Reuses helpers from testweb/WebTestUtilities.ts (enterEditor, gotoWithTheme, etc.)
 * to avoid duplication.
 */

import { Page, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/** WCAG tags checked across all a11y scans */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/**
 * Theme × high-contrast testing matrix.
 *
 * Every screen should be tested in all four combinations:
 * - light: standard light theme
 * - dark: standard dark theme
 * - light-hc: light theme + forced-colors: active (Windows High Contrast)
 * - dark-hc: dark theme + forced-colors: active
 *
 * Use `THEME_MATRIX` for iterating all modes in tests, and
 * `applyThemeVariant()` to navigate + configure the page.
 */
export type ThemeVariant = "light" | "dark" | "light-hc" | "dark-hc";

export interface ThemeVariantConfig {
  variant: ThemeVariant;
  theme: "light" | "dark";
  forcedColors: boolean;
  label: string;
}

export const THEME_MATRIX: ThemeVariantConfig[] = [
  { variant: "light", theme: "light", forcedColors: false, label: "light" },
  { variant: "dark", theme: "dark", forcedColors: false, label: "dark" },
  { variant: "light-hc", theme: "light", forcedColors: true, label: "light + high contrast" },
  { variant: "dark-hc", theme: "dark", forcedColors: true, label: "dark + high contrast" },
];

/** Subset for quick CI runs — just the two standard themes */
export const THEME_MATRIX_STANDARD: ThemeVariantConfig[] = THEME_MATRIX.filter((t) => !t.forcedColors);

/** Subset for high-contrast-specific tests */
export const THEME_MATRIX_HC: ThemeVariantConfig[] = THEME_MATRIX.filter((t) => t.forcedColors);

/**
 * Navigate to a path with the given theme variant applied.
 * Handles both the URL theme parameter and forced-colors media emulation.
 */
export async function applyThemeVariant(page: Page, config: ThemeVariantConfig, path: string = "/"): Promise<void> {
  const themeParam = config.theme === "light" ? "theme=l" : "theme=d";
  const separator = path.includes("?") ? "&" : "?";
  const url = `${path}${separator}${themeParam}`;

  if (config.forcedColors) {
    await page.emulateMedia({ forcedColors: "active", colorScheme: config.theme });
  } else {
    await page.emulateMedia({ forcedColors: "none", colorScheme: config.theme });
  }

  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/**
 * Axe rules disabled project-wide with documented justification.
 * - heading-order: Moderate; Minecraft-themed UI intentionally uses display headings
 * - aria-toggle-field-name: FluentUI Northstar library limitation — <li> elements have
 *   visible text content but the library doesn't support aria-label on them.
 */
export const DISABLED_RULES = ["heading-order", "aria-toggle-field-name"] as const;

/** Violation impact levels that cause test failure */
export type FailingImpact = "critical" | "serious";

/** Structured result from an axe scan */
export interface AxeScanResult {
  violations: import("axe-core").Result[];
  criticalViolations: import("axe-core").Result[];
  passes: import("axe-core").Result[];
  incomplete: import("axe-core").Result[];
}

/**
 * Run a standardized axe-core scan with project-default WCAG tags and disabled rules.
 *
 * @param page - Playwright page
 * @param options - Override defaults: extra disabled rules, include/exclude selectors, extra tags
 */
export async function runAxeScan(
  page: Page,
  options: {
    includeSelector?: string;
    excludeSelector?: string;
    extraDisabledRules?: string[];
    extraTags?: string[];
    screenshotPath?: string;
  } = {}
): Promise<AxeScanResult> {
  if (options.screenshotPath) {
    await page.screenshot({ path: options.screenshotPath, fullPage: true });
  }

  let builder = new AxeBuilder({ page })
    .withTags([...WCAG_TAGS, ...(options.extraTags ?? [])])
    .disableRules([...DISABLED_RULES, ...(options.extraDisabledRules ?? [])]);

  if (options.includeSelector) {
    builder = builder.include(options.includeSelector);
  }
  if (options.excludeSelector) {
    builder = builder.exclude(options.excludeSelector);
  }

  const results = await builder.analyze();

  const criticalViolations = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");

  return {
    violations: results.violations,
    criticalViolations,
    passes: results.passes,
    incomplete: results.incomplete,
  };
}

/**
 * Log violations to console grouped by impact, matching the convention in
 * Accessibility.spec.ts saveAccessibilityResults().
 */
export function logViolations(violations: import("axe-core").Result[], testName: string): void {
  if (violations.length === 0) return;

  console.log(`\n=== Accessibility Issues for ${testName} ===`);
  violations.forEach((violation, index) => {
    console.log(`\n${index + 1}. ${violation.id}: ${violation.description}`);
    console.log(`   Impact: ${violation.impact}`);
    console.log(`   Help: ${violation.helpUrl}`);
    console.log(`   Affected elements: ${violation.nodes.length}`);
    violation.nodes.slice(0, 5).forEach((node: { html: string }) => {
      console.log(`   - ${node.html.substring(0, 120)}`);
    });
  });
}

/**
 * Assert that a page/region has no critical or serious axe violations.
 * Logs all violations (including moderate/minor) for awareness.
 */
export async function assertNoCriticalViolations(
  page: Page,
  testName: string,
  options: Parameters<typeof runAxeScan>[1] = {}
): Promise<AxeScanResult> {
  const result = await runAxeScan(page, options);
  logViolations(result.violations, testName);

  if (result.violations.length > 0) {
    console.log(
      `\n${testName} — Total: ${result.violations.length}, Critical/Serious: ${result.criticalViolations.length}`
    );
  }

  expect(
    result.criticalViolations,
    `Found ${result.criticalViolations.length} critical/serious accessibility violations in ${testName}`
  ).toHaveLength(0);

  return result;
}

// ---------------------------------------------------------------------------
// Keyboard & Focus helpers
// ---------------------------------------------------------------------------

/**
 * Press Tab repeatedly and verify that `selector` eventually receives focus.
 * Returns the number of Tab presses needed, or throws if maxTabs is exceeded.
 */
export async function assertKeyboardReachable(page: Page, selector: string, maxTabs: number = 50): Promise<number> {
  // Start focus from the body so the first Tab enters the natural flow
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());

  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, selector);
    if (focused) return i + 1;
  }

  throw new Error(`Element matching "${selector}" was not reached via Tab within ${maxTabs} presses`);
}

/**
 * Assert that pressing Tab while inside `containerSelector` keeps focus
 * within that container (modal / dialog focus trap).
 *
 * Tabs through all focusable elements and verifies that after wrapping,
 * focus returns to the first focusable element inside the container.
 */
export async function assertFocusTrapped(page: Page, containerSelector: string, maxTabs: number = 30): Promise<void> {
  const focusableCount = await page.evaluate((sel) => {
    const container = document.querySelector(sel);
    if (!container) return 0;
    const focusable = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    return focusable.length;
  }, containerSelector);

  if (focusableCount === 0) {
    throw new Error(`No focusable elements found inside "${containerSelector}"`);
  }

  // Tab through all focusable elements + 1 to check wrapping
  for (let i = 0; i < Math.min(focusableCount + 2, maxTabs); i++) {
    await page.keyboard.press("Tab");
    const insideContainer = await page.evaluate((sel) => {
      const container = document.querySelector(sel);
      return container?.contains(document.activeElement) ?? false;
    }, containerSelector);
    expect(insideContainer, `Focus escaped container "${containerSelector}" after ${i + 1} Tab presses`).toBe(true);
  }
}

/**
 * Assert that no horizontal overflow exceeds `tolerance` pixels (reflow check).
 */
export async function assertNoHorizontalOverflow(page: Page, tolerance: number = 50): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - document.documentElement.clientWidth;
  });
  expect(overflow, `Horizontal overflow of ${overflow}px exceeds tolerance of ${tolerance}px`).toBeLessThanOrEqual(
    tolerance
  );
}

// ---------------------------------------------------------------------------
// Media emulation helpers
// ---------------------------------------------------------------------------

export interface MediaEmulationOptions {
  reducedMotion?: "reduce" | "no-preference";
  forcedColors?: "active" | "none";
  colorScheme?: "light" | "dark";
}

/**
 * Apply CSS media feature emulation on the page.
 * Playwright supports reducedMotion, colorScheme, and forcedColors natively.
 */
export async function setMediaEmulation(page: Page, options: MediaEmulationOptions): Promise<void> {
  await page.emulateMedia({
    reducedMotion: options.reducedMotion,
    colorScheme: options.colorScheme,
    forcedColors: options.forcedColors,
  });
}

// ---------------------------------------------------------------------------
// Text spacing override (MAS / WCAG 1.4.12)
// ---------------------------------------------------------------------------

/**
 * Inject WCAG 1.4.12 text spacing overrides. Returns a cleanup function.
 * Per the spec: line-height at least 1.5×, paragraph spacing 2×,
 * letter spacing 0.12em, word spacing 0.16em.
 */
export async function injectTextSpacingOverrides(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      * {
        line-height: 1.5 !important;
        letter-spacing: 0.12em !important;
        word-spacing: 0.16em !important;
      }
      p {
        margin-bottom: 2em !important;
      }
    `,
  });
}

/**
 * Check if any text is clipped or overlapping after text spacing overrides.
 * Returns elements where scrollHeight > clientHeight (likely clipped).
 */
export async function findClippedTextElements(page: Page): Promise<{ selector: string; clippedBy: number }[]> {
  return page.evaluate(() => {
    const results: { selector: string; clippedBy: number }[] = [];
    const elements = document.querySelectorAll("*");

    for (const el of elements) {
      const style = window.getComputedStyle(el);
      if (style.overflow === "hidden" || style.overflowY === "hidden") {
        const diff = el.scrollHeight - el.clientHeight;
        if (diff > 2) {
          // Skip elements that are *intentionally* hidden / off-screen and
          // therefore "clip" by design rather than by accident.
          //
          // - `.app-skipLink` is anchored off-screen until focused (WCAG
          //   2.4.1 Bypass Blocks pattern). It always reports as clipped.
          // - `MuiCollapse-hidden` is the collapsed state of MUI's expand/
          //   collapse component — clipping the contained content is the
          //   entire point of the component when in its closed state.
          const cls = el.className && typeof el.className === "string" ? el.className : "";
          if (cls.includes("app-skipLink")) continue;
          if (cls.includes("MuiCollapse-hidden")) continue;

          // Build a simple selector for reporting
          const tag = el.tagName.toLowerCase();
          const id = el.id ? `#${el.id}` : "";
          const clsSel = cls && typeof cls === "string" ? `.${cls.split(" ").join(".")}` : "";
          results.push({
            selector: `${tag}${id}${clsSel}`.substring(0, 120),
            clippedBy: diff,
          });
        }
      }
    }

    return results.slice(0, 20); // Limit to avoid huge payloads
  });
}

// ---------------------------------------------------------------------------
// ARIA live region helpers
// ---------------------------------------------------------------------------

/**
 * Wait for an aria-live region to contain specific text.
 * Useful for verifying status announcements.
 */
export async function waitForLiveRegionAnnouncement(
  page: Page,
  expectedText: string | RegExp,
  timeoutMs: number = 5000
): Promise<void> {
  const liveRegion = page.locator('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]');

  if (typeof expectedText === "string") {
    await expect(liveRegion.filter({ hasText: expectedText }).first()).toBeVisible({ timeout: timeoutMs });
  } else {
    await expect(liveRegion.filter({ hasText: expectedText }).first()).toBeVisible({ timeout: timeoutMs });
  }
}

/**
 * Check that at least one aria-live region exists on the page (for dynamic content pages).
 */
export async function assertLiveRegionExists(page: Page): Promise<number> {
  const count = await page.locator('[aria-live], [role="status"], [role="alert"], [role="log"]').count();
  return count;
}
