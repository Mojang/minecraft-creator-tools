/**
 * ProjectSettingsTypeDropdown.spec.ts
 *
 * Regression test for the Project Settings → TYPE dropdown bug where only
 * "General" could be selected. Picking GameTests / World / Sample Behavior /
 * Editor Extension silently reverted to General.
 *
 * Root cause was in ProjectPropertyEditor._handleFocusChange: it used
 * `for (const str in getProjectFocusStrings(...))` which iterates array
 * INDICES (string "0","1","2",...), not the localized option strings.
 * `data.value === str` therefore never matched and `project.focus` was
 * never updated.
 *
 * This test:
 *   1. Creates an Add-On Starter project (via enterEditor)
 *   2. Navigates to the Project Settings page
 *   3. Selects each non-default Type and asserts the <select> retains
 *      the chosen value after re-rendering (i.e. the change was accepted,
 *      not silently reverted).
 */

import { test, expect, ConsoleMessage } from "@playwright/test";
import { enterEditor, processMessage } from "./WebTestUtilities";

const DIR = "debugoutput/screenshots/project-settings-type-dropdown";

const FOCUS_OPTIONS = ["General", "GameTests", "World", "Sample Behavior", "Editor Extension"];

test.describe("Project Settings Type dropdown @focused", () => {
  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  test("Type dropdown accepts every focus value (not just General)", async ({ page }) => {
    const ok = await enterEditor(page, "dark");
    test.skip(!ok, "Could not enter editor");

    // Navigate to Project Settings (left sidebar entry in Focused mode)
    const projectSettings = page.locator("text=/^Project Settings$/").first();
    await expect(projectSettings).toBeVisible({ timeout: 10000 });
    await projectSettings.click();
    await page.waitForTimeout(800);

    // The TYPE dropdown is the <select> labelled by #ppe-focuslabel
    const typeSelect = page.locator('select[aria-labelledby="ppe-focuslabel"]');
    await expect(typeSelect).toBeVisible({ timeout: 5000 });

    // Snapshot baseline
    await page.screenshot({ path: `${DIR}/00-initial.png`, fullPage: false });

    // Confirm all expected options are present
    const optionTexts = await typeSelect.locator("option").allTextContents();
    for (const expected of FOCUS_OPTIONS) {
      expect(optionTexts).toContain(expected);
    }

    // The Edit Experience dropdown lives in the same section and its onChange
    // handler ALWAYS calls forceUpdate(). We use it to force a re-render between
    // selecting a Type and asserting the Type value persisted — this is what
    // catches the bug: without a working _handleFocusChange, the controlled
    // <select>'s `value` prop snaps back to "General" on re-render.
    const editPrefSelect = page.locator('select[aria-labelledby="ppe-defaultEditlabel"]');
    await expect(editPrefSelect).toBeVisible({ timeout: 5000 });
    const editPrefOptions = await editPrefSelect.locator("option").allTextContents();
    // Pick any edit-preference option that is NOT the current one to guarantee onChange fires.
    const currentEditPref = await editPrefSelect.inputValue();
    const otherEditPref = editPrefOptions.find((o) => o && o !== currentEditPref) || editPrefOptions[0];

    // Try selecting every non-default option and assert the select retains the choice
    // even AFTER a parent re-render.
    for (const option of FOCUS_OPTIONS) {
      await typeSelect.selectOption({ label: option });
      await page.waitForTimeout(150);

      // Force a parent re-render via the Edit Experience dropdown (its handler calls forceUpdate)
      const before = await editPrefSelect.inputValue();
      const toggleTo = before === otherEditPref ? currentEditPref : otherEditPref;
      await editPrefSelect.selectOption({ label: toggleTo });
      await page.waitForTimeout(200);

      const current = await typeSelect.inputValue();
      expect(
        current,
        `Type dropdown reverted after parent re-render: expected '${option}', got '${current}'`
      ).toBe(option);

      await page.screenshot({
        path: `${DIR}/after-select-${option.replace(/\s+/g, "-").toLowerCase()}.png`,
        fullPage: false,
      });
    }

    // Re-select General at the end to leave a clean state
    await typeSelect.selectOption({ label: "General" });
  });

  test("Target Minecraft default option substitutes {target} placeholder", async ({ page }) => {
    // Regression for FormatJS treating "<default to {target}>" as a rich-text tag,
    // which left `{target}` literal in the dropdown. The string was changed to
    // "Default ({target})" so the ICU placeholder actually substitutes.
    const ok = await enterEditor(page, "dark");
    test.skip(!ok, "Could not enter editor");

    const projectSettings = page.locator("text=/^Project Settings$/").first();
    await expect(projectSettings).toBeVisible({ timeout: 10000 });
    await projectSettings.click();
    await page.waitForTimeout(800);

    const targetSelect = page.locator('select[aria-labelledby="ppe-tracklabel"]');
    await expect(targetSelect).toBeVisible({ timeout: 5000 });

    const firstOption = (await targetSelect.locator("option").first().textContent()) ?? "";

    // Hard assertions: no un-substituted placeholder, no XML-tag remnants.
    expect(firstOption, `First Target option still contains '{target}' placeholder: "${firstOption}"`)
      .not.toContain("{target}");
    expect(firstOption, `First Target option still contains stray '<': "${firstOption}"`)
      .not.toContain("<");
    // And the substituted value must include a real target name.
    expect(firstOption.toLowerCase()).toContain("minecraft");
  });

  test("Script Settings dropdowns persist selection after re-render", async ({ page }) => {
    // Regression for two bugs:
    //   1. _handleLanguageChange did not call forceUpdate(), so the controlled
    //      <select>'s value snapped back on the next render.
    //   2. _handleVersionChange compared against the literal "Latest Beta",
    //      which is never an option string, so EVERY selection silently set
    //      the version to stable10. (Plus the script-version defaultValue
    //      compared "Latest Stable" against the actual option text
    //      "Latest Stable (2.0)", causing a controlled/uncontrolled mismatch.)
    const ok = await enterEditor(page, "dark");
    test.skip(!ok, "Could not enter editor");

    const projectSettings = page.locator("text=/^Project Settings$/").first();
    await expect(projectSettings).toBeVisible({ timeout: 10000 });
    await projectSettings.click();
    await page.waitForTimeout(800);

    const langSelect = page.locator('select[aria-labelledby="ppe-scriptLanguagelabel"]');
    const versionSelect = page.locator('select[aria-labelledby="ppe-scriptVersionlabel"]');
    await expect(langSelect).toBeVisible({ timeout: 5000 });
    await expect(versionSelect).toBeVisible({ timeout: 5000 });

    // Sanity: options exist
    const langOptions = await langSelect.locator("option").allTextContents();
    expect(langOptions).toEqual(expect.arrayContaining(["JavaScript", "TypeScript"]));
    const versionOptions = await versionSelect.locator("option").allTextContents();
    expect(versionOptions.length).toBeGreaterThanOrEqual(2);

    // Confirm defaultValue actually matches an option (catches the "Latest Stable"
    // vs "Latest Stable (2.0)" mismatch). If they didn't match, inputValue would
    // be the first option instead of the intended initial value.
    const initialLangValue = await langSelect.inputValue();
    expect(langOptions).toContain(initialLangValue);
    const initialVersionValue = await versionSelect.inputValue();
    expect(versionOptions).toContain(initialVersionValue);

    // Use the Edit Experience dropdown to force a parent re-render between
    // selecting an option and asserting it persisted.
    const editPrefSelect = page.locator('select[aria-labelledby="ppe-defaultEditlabel"]');
    const editPrefOptions = await editPrefSelect.locator("option").allTextContents();
    const currentEditPref = await editPrefSelect.inputValue();
    const otherEditPref = editPrefOptions.find((o) => o && o !== currentEditPref) || editPrefOptions[0];

    async function forceParentReRender() {
      const before = await editPrefSelect.inputValue();
      const toggleTo = before === otherEditPref ? currentEditPref : otherEditPref;
      await editPrefSelect.selectOption({ label: toggleTo });
      await page.waitForTimeout(200);
    }

    // --- LANGUAGE dropdown: flip to JavaScript, force re-render, expect it stays ---
    await langSelect.selectOption({ label: "JavaScript" });
    await page.waitForTimeout(150);
    await forceParentReRender();
    expect(
      await langSelect.inputValue(),
      "Language dropdown reverted to TypeScript after parent re-render"
    ).toBe("JavaScript");

    // Flip back to TypeScript
    await langSelect.selectOption({ label: "TypeScript" });
    await page.waitForTimeout(150);
    await forceParentReRender();
    expect(await langSelect.inputValue()).toBe("TypeScript");

    // --- VERSION dropdown: flip to the SECOND option, force re-render, expect it stays ---
    const secondVersion = versionOptions.find((o) => o && o !== initialVersionValue);
    expect(secondVersion, "Need at least two distinct script-version options to test").toBeTruthy();
    await versionSelect.selectOption({ label: secondVersion! });
    await page.waitForTimeout(150);
    await forceParentReRender();
    expect(
      await versionSelect.inputValue(),
      `Script Version dropdown reverted: expected '${secondVersion}', got '${await versionSelect.inputValue()}'`
    ).toBe(secondVersion);

    // Flip back
    await versionSelect.selectOption({ label: initialVersionValue });
  });
});
