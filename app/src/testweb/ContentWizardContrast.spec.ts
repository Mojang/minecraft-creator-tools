/**
 * Color-contrast coverage for the Content Wizard (WCAG 1.4.3, 4.5:1).
 *
 * Covers two surfaces, in BOTH light and dark themes:
 *  - Section count badges (.cwiz-section-badge): previously painted the mid-tone
 *    brand accent (green4) as text on a faint-green tint (~3.09:1 dark / ~2.4:1 light).
 *  - Field hints (.cwiz-field-hint), e.g. the "Name shown in-game" hint under the
 *    Display Name field: previously dimmed body text with opacity, dropping it to
 *    ~4.16:1 on the white light-mode dialog. De-emphasis must come from size/weight,
 *    not opacity, so the rendered text stays >= 4.5:1.
 *  - Trait group headers (.cwiz-trait-group-header), e.g. "BODY SHAPE (PICK ONE)":
 *    same opacity-on-text defect (~3.58:1 on the white dialog).
 *  - Selected trait cards (.cwiz-trait-selected): the card background turns dark
 *    green on selection, but the label/description kept the theme's default (dark)
 *    foreground, dropping the text to ~1.42:1 in light mode.
 *  - Primary action button (.cwiz-btn-primary, the Next/Create button): white text
 *    on the brand green (green4 #52a535) is only 3.09:1; it needs a darker green.
 *
 * getRenderedContrast computes the *rendered* contrast (compositing semi-transparent
 * backgrounds over ancestors AND folding in any CSS opacity on the text), so these
 * fail on the real defects and pass once a contrast-safe token/treatment is used.
 *
 * Run: npx playwright test ContentWizardContrast.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage, getRenderedContrast } from "./WebTestUtilities";

const MIN_CONTRAST = 4.5;

for (const theme of ["light", "dark"] as const) {
  test(`Content Wizard count badges meet 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme })).toBe(true);

    // Open the Add → Content Wizard, which shows collapsed sections with count badges.
    const addButton = page.getByRole("button", { name: /add new content/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    const badge = page.locator(".cwiz-section-badge").first();
    await expect(badge).toBeVisible({ timeout: 5000 });

    const ratios = await getRenderedContrast(page, ".cwiz-section-badge");
    expect(ratios.length, "expected at least one count badge").toBeGreaterThan(0);

    for (const r of ratios) {
      expect(r, `badge contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`).toBeGreaterThanOrEqual(
        MIN_CONTRAST
      );
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`Content Wizard field hints meet 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme })).toBe(true);

    // Open the Add → Content Wizard launcher.
    const addButton = page.getByRole("button", { name: /add new content/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Launch the step-by-step "New Mob" wizard.
    const newMob = page.locator('[data-testid="wizard-new-mob"]').first();
    await expect(newMob).toBeVisible({ timeout: 10000 });
    await newMob.click();

    // Advance from the trait picker to the Basic Information step, where the
    // "Name shown in-game" hint sits under the Display Name field.
    const nextButton = page.locator(".cwiz-btn-primary").first();
    await expect(nextButton).toBeVisible({ timeout: 10000 });
    await nextButton.click();

    const hint = page.locator(".cwiz-field-hint").first();
    await expect(hint).toBeVisible({ timeout: 10000 });

    const ratios = await getRenderedContrast(page, ".cwiz-field-hint");
    expect(ratios.length, "expected at least one field hint").toBeGreaterThan(0);

    for (const r of ratios) {
      expect(r, `field-hint contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`).toBeGreaterThanOrEqual(
        MIN_CONTRAST
      );
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`Content Wizard trait group headers meet 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme })).toBe(true);

    // Open the Add → Content Wizard launcher.
    const addButton = page.getByRole("button", { name: /add new content/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Launch the step-by-step "New Mob" wizard; step 1 is the trait picker, which
    // shows the uppercase group headers ("BODY SHAPE (PICK ONE)", "MOVEMENT…", …).
    const newMob = page.locator('[data-testid="wizard-new-mob"]').first();
    await expect(newMob).toBeVisible({ timeout: 10000 });
    await newMob.click();

    const groupHeader = page.locator(".cwiz-trait-group-header").first();
    await expect(groupHeader).toBeVisible({ timeout: 10000 });

    const ratios = await getRenderedContrast(page, ".cwiz-trait-group-header");
    expect(ratios.length, "expected at least one trait group header").toBeGreaterThan(0);

    for (const r of ratios) {
      expect(
        r,
        `trait group header contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`Content Wizard selected trait card text meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme })).toBe(true);

    // Neutralize transitions/animations so contrast is measured on settled colors,
    // not mid-transition values (the trait card animates background-color on select).
    await page.addStyleTag({
      content: "*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }",
    });

    // Open the Add → Content Wizard launcher and start the "New Mob" trait picker.
    const addButton = page.getByRole("button", { name: /add new content/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    const newMob = page.locator('[data-testid="wizard-new-mob"]').first();
    await expect(newMob).toBeVisible({ timeout: 10000 });
    await newMob.click();

    // Select the first trait card; its label and description must stay readable on
    // the green selected background.
    const firstTrait = page.locator(".cwiz-trait").first();
    await expect(firstTrait).toBeVisible({ timeout: 10000 });
    await firstTrait.click();

    const selected = page.locator(".cwiz-trait-selected").first();
    await expect(selected).toBeVisible({ timeout: 5000 });

    // Move the pointer off the card so we measure the resting selected state, not
    // the (lighter) :hover background the cursor would otherwise sit on.
    await page.mouse.move(0, 0);

    const ratios = await getRenderedContrast(
      page,
      ".cwiz-trait-selected .cwiz-trait-label, .cwiz-trait-selected .cwiz-trait-desc"
    );
    expect(ratios.length, "expected selected trait card text").toBeGreaterThan(0);

    for (const r of ratios) {
      expect(
        r,
        `selected trait text contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`
      ).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`Content Wizard primary button text meets 4.5:1 contrast (${theme})`, async ({ page }) => {
    test.setTimeout(90000);
    const consoleErrors: { url: string; error: string }[] = [];
    const consoleWarnings: { url: string; error: string }[] = [];
    page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

    expect(await enterEditor(page, { theme })).toBe(true);

    // Open the Add → Content Wizard launcher and start the "New Mob" wizard, whose
    // footer shows the green primary "Next" button.
    const addButton = page.getByRole("button", { name: /add new content/i }).first();
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    const newMob = page.locator('[data-testid="wizard-new-mob"]').first();
    await expect(newMob).toBeVisible({ timeout: 10000 });
    await newMob.click();

    const primaryBtn = page.locator(".cwiz-btn-primary").first();
    await expect(primaryBtn).toBeVisible({ timeout: 10000 });

    // Measure the resting button, not the (lighter) :hover background.
    await page.mouse.move(0, 0);

    const ratios = await getRenderedContrast(page, ".cwiz-btn-primary");
    expect(ratios.length, "expected the primary wizard button").toBeGreaterThan(0);

    for (const r of ratios) {
      expect(r, `primary button contrast ${r}:1 must be >= ${MIN_CONTRAST}:1 (${theme} mode)`).toBeGreaterThanOrEqual(
        MIN_CONTRAST
      );
    }
  });
}
