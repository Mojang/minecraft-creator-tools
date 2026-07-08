/**
 * Accessibility coverage for the Creator Tools Settings panel (WCAG 4.1.2).
 *
 * A MUI <Select> labelled via a top-level aria-labelledby drops that attribute
 * onto the role-less .MuiInputBase-root wrapper rather than the inner
 * role="combobox". That breaks two axe rules at once: aria-prohibited-attr (the
 * wrapper has no role) and aria-input-field-name (the combobox has no accessible
 * name). The label must be applied through SelectDisplayProps so it lands on the
 * combobox. These tests guard the Appearance / Deployment Target / Target
 * Minecraft dropdowns against regressing to the wrapper pattern.
 *
 * The same panel also has bare <Checkbox>es and a server-path <TextField>. A
 * <Checkbox> with no name renders an anonymous native checkbox (axe "label"),
 * and an aria-labelledby placed directly on a <TextField> lands on its role-less
 * FormControl root (axe aria-prohibited-attr) while leaving the inner <input>
 * unnamed (axe "label"). Each checkbox must carry an aria-label, and the
 * TextField's name must be set via inputProps so it sits on the <input>. The
 * server-path field and auto-start checkbox only render in debug/app-service
 * builds, so one test starts the app with ?debug=true to surface them.
 *
 * Run (from app/):
 *   npx playwright test SettingsPanelAccessibility.spec.ts --project=chromium
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  processMessage,
  enterEditor,
  preferBrowserStorageInProjectDialog,
  fillRequiredProjectDialogFields,
  selectEditMode,
  waitForEditorReady,
} from "./WebTestUtilities";

async function openSettings(page: Page): Promise<void> {
  expect(await enterEditor(page, { editMode: "full" })).toBe(true);
  await page.locator('button[title="Settings"], [aria-label="Settings"]').first().click();
  await expect(page.locator(".csp-grid")).toBeVisible({ timeout: 15000 });
}

// Opens the Settings panel in a debug build so the server-path TextField and the
// auto-start checkbox (gated on hasAppServiceOrDebug) actually render. The
// create-project flow runs entirely client-side after the initial navigation,
// so the ?debug=true session persists into the editor.
async function openSettingsWithServerControls(page: Page): Promise<void> {
  await page.goto("/?debug=true", { waitUntil: "load" });
  await page.waitForTimeout(1000);

  const newButton = page.getByRole("button", { name: "Create New" }).first();
  await expect(newButton).toBeVisible({ timeout: 15000 });
  await newButton.click();
  await page.waitForTimeout(800);

  await preferBrowserStorageInProjectDialog(page);
  await fillRequiredProjectDialogFields(page);

  const createButton = page.getByTestId("submit-button");
  await expect(createButton).toBeVisible({ timeout: 8000 });
  await createButton.click();

  await page.waitForTimeout(3000);
  await waitForEditorReady(page, 20000);
  await selectEditMode(page, "full");
  await waitForEditorReady(page, 15000);

  await page.locator('button[title="Settings"], [aria-label="Settings"]').first().click();
  await expect(page.locator(".csp-grid")).toBeVisible({ timeout: 15000 });
}

test("Creator Tools Settings dropdowns do not put aria-labelledby on a role-less div", async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  await openSettings(page);

  // The theme dropdown's aria-labelledby must be on the combobox, not the
  // role-less .MuiInputBase-root wrapper.
  const wrapperLabelledBy = await page
    .locator(".csp-themeinput .MuiInputBase-root")
    .first()
    .getAttribute("aria-labelledby");
  expect(wrapperLabelledBy, "aria-labelledby must not sit on the role-less InputBase wrapper").toBeNull();

  await expect(page.locator('.csp-themeinput [role="combobox"]')).toHaveAttribute("aria-labelledby", "csp-themelabel");

  // The settings panel must clear the exact axe rule the audit flagged.
  const results = await new AxeBuilder({ page }).include(".csp-grid").withRules(["aria-prohibited-attr"]).analyze();
  expect(
    results.violations,
    `aria-prohibited-attr violations: ${JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.html)))}`
  ).toHaveLength(0);
});

test("Creator Tools Settings dropdowns each expose an accessible name", async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  await openSettings(page);

  // Each dropdown's combobox must expose a non-empty accessible name (WCAG 4.1.2)
  // so screen readers can announce what the field controls.
  for (const wrapper of [".csp-themeinput", ".csp-defaultDeployTarget", ".csp-trackinput"]) {
    const combobox = page.locator(`${wrapper} [role="combobox"]`).first();
    await expect(combobox, `${wrapper} should render a combobox`).toBeVisible({ timeout: 10000 });
    await expect(combobox, `${wrapper} combobox needs an accessible name`).toHaveAccessibleName(/\S/);
  }

  // And the panel must clear the exact axe rule the audit flagged.
  const results = await new AxeBuilder({ page }).include(".csp-grid").withRules(["aria-input-field-name"]).analyze();
  expect(
    results.violations,
    `aria-input-field-name violations: ${JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.html)))}`
  ).toHaveLength(0);
});

test("Creator Tools Settings checkboxes expose accessible names", async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  await openSettings(page);

  // The bare MUI <Checkbox>es render a native <input type="checkbox"> with no
  // wrapping <label> and no name, so assistive tech announces them anonymously
  // (axe "label", WCAG 4.1.2). Their visible text lives in a separate grid cell,
  // so each checkbox carries its own aria-label.
  for (const [wrapper, name] of [
    [".csp-formatbeforesave", "Format JSON and script on save"],
    [".csp-showwelcome", "Show welcome panel"],
  ] as const) {
    const checkbox = page.locator(`${wrapper} input[type="checkbox"]`).first();
    await expect(checkbox, `${wrapper} checkbox needs an accessible name`).toHaveAccessibleName(name);
  }

  // The panel must clear the "label" rule for every native form control.
  const results = await new AxeBuilder({ page }).include(".csp-grid").withRules(["label"]).analyze();
  expect(
    results.violations,
    `label violations: ${JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.html)))}`
  ).toHaveLength(0);
});

test("Creator Tools Settings server-path field names its input, not the role-less root (debug build)", async ({
  page,
}) => {
  test.setTimeout(120000);
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];
  page.on("console", (msg: ConsoleMessage) => processMessage(msg, page, consoleErrors, consoleWarnings));

  await openSettingsWithServerControls(page);

  // Fail loudly if the debug-only controls stop rendering, rather than passing
  // vacuously.
  const serverPathInput = page.locator(".csp-dspathinput input").first();
  await expect(serverPathInput, "server path field should render in a debug build").toBeVisible({ timeout: 10000 });

  // The name must sit on the inner <input> (set via inputProps). MUI spreads a
  // bare aria-labelledby onto the role-less FormControl root, where ARIA
  // prohibits it, so that root must carry no aria-labelledby.
  await expect(serverPathInput).toHaveAccessibleName(/\S/);
  const rootLabelledBy = await page
    .locator(".csp-dspathinput .MuiTextField-root")
    .first()
    .getAttribute("aria-labelledby");
  expect(rootLabelledBy, "aria-labelledby must not sit on the role-less TextField root").toBeNull();

  // With every control rendered (dropdowns, checkboxes, text field), the panel
  // must clear both rules at once.
  const results = await new AxeBuilder({ page })
    .include(".csp-grid")
    .withRules(["aria-prohibited-attr", "label"])
    .analyze();
  expect(
    results.violations,
    `violations: ${JSON.stringify(results.violations.map((v) => v.nodes.map((n) => n.html)))}`
  ).toHaveLength(0);
});
