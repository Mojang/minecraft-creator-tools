/**
 * Mobile regression for reading a Project Inspector issue in full.
 *
 * Public issue mojang/minecraft-creator-tools#113: on an Android phone the
 * inspector's desktop table clipped the message and file path of an issue, so
 * the user could not read what was wrong or where. At mobile width the
 * inspector now renders a card per issue and the card's details action opens a
 * dialog with the complete message and file path. These tests pin down what
 * that layout has to guarantee on a phone:
 *
 * 1. The card list and each card fit the viewport: no horizontal scrolling is
 *    needed to reach any part of a message, and the compact location, which is
 *    allowed to ellipsize, carries the full path for assistive technology.
 * 2. The details action opens with a tap and exposes the complete message and
 *    file path, and a long message or a long, deeply nested path wraps inside
 *    the dialog instead of forcing horizontal scrolling.
 * 3. The details action also works from the keyboard (Enter opens, Escape
 *    closes) and focus returns to the action afterwards.
 *
 * Runs under playwright-mobile.config.js (390×844, isMobile, hasTouch), and
 * repeats the layout checks at 320px, the narrowest width WCAG 1.4.10 reflow
 * asks for.
 *
 * Run with:  npx playwright test --config playwright-mobile.config.js InspectorIssueDetails
 */

import { test, expect, Page, Locator } from "@playwright/test";
import { enterEditor, waitForInspectorValidationComplete } from "../testweb/WebTestUtilities";

const SCREENSHOT_DIR = "debugoutput/screenshots/mobile";

/** A path about as long and as deeply nested as content packs produce, with no spaces to wrap at. */
const LONG_NESTED_PATH =
  "/behavior_packs/my_long_adventure_pack_behaviors/entities/boss_arena/phase_three/" +
  "elder_guardian_variant_with_a_really_long_identifier_for_testing.behavior.json";

/** A long message that includes one long unbroken identifier, the hardest case for wrapping. */
const LONG_MESSAGE =
  "Entity type definition references component group minecraft:elder_guardian_variant_phase_three_enraged_state " +
  "which is not defined anywhere in this behavior pack; define it under component_groups or remove the event " +
  "that adds it so the entity loads in game.";

/** Opens the inspector on a freshly created starter project and switches to the item cards. */
async function openInspectorItems(page: Page): Promise<boolean> {
  if (!(await enterEditor(page, { theme: "light", editMode: "full" }))) {
    return false;
  }

  // At phone width the project item list is collapsed, so the inspector is reached
  // through the "Inspect Project" quick action; the sidebar entry is the desktop route.
  const inspectAction = page.getByRole("button", { name: "Inspect Project" }).first();
  if (await inspectAction.isVisible({ timeout: 5000 }).catch(() => false)) {
    await inspectAction.tap();
  } else {
    await page.getByText("Check for Problems").first().click();
  }
  await expect(page.locator("h2.pid-title")).toBeVisible({ timeout: 20000 });
  await waitForInspectorValidationComplete(page);

  const itemsTab = page.locator("#pid-tab-items");
  if (await itemsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await itemsTab.click();
  }

  await expect(page.locator(".piid-card").first()).toBeVisible({ timeout: 20000 });

  // The default filters show errors and warnings, which for the starter project are
  // project-wide. The file-scoped items (the shape the public report was about) are
  // informational, so switch that filter on when no card points at a file yet.
  if (
    !(await firstCardWithLocation(page)
      .isVisible({ timeout: 3000 })
      .catch(() => false))
  ) {
    await page.getByRole("button", { name: /^Filter by info/ }).tap();
  }

  await expect(firstCardWithLocation(page), "an issue that points at a file is listed").toBeVisible({
    timeout: 10000,
  });
  return true;
}

/** The first card that points at a file, which is the shape the public report was about. */
function firstCardWithLocation(page: Page): Locator {
  return page
    .locator(".piid-card")
    .filter({ has: page.locator(".piid-locationLink") })
    .first();
}

/** Horizontal overflow of an element: how far its content extends past its box. */
async function horizontalOverflow(locator: Locator): Promise<number> {
  return locator.evaluate((el) => el.scrollWidth - el.clientWidth);
}

async function expectPageHasNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(1);
}

/** Every card must fit the list: the list wrapper hides overflow, so anything wider would be unreachable. */
async function expectCardsFit(page: Page) {
  const list = page.locator(".pid-cardList");
  await expect(list).toBeVisible();

  const listWidth = await list.evaluate((el) => el.clientWidth);
  const cards = page.locator(".piid-card");
  const count = Math.min(await cards.count(), 12);
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const box = await card.boundingBox();
    expect(box, `card ${i} is laid out`).not.toBeNull();
    expect(box!.width, `card ${i} is no wider than the list`).toBeLessThanOrEqual(listWidth + 1);
    expect(await horizontalOverflow(card), `card ${i} has no clipped horizontal content`).toBeLessThanOrEqual(1);

    const message = card.locator(".piid-cardMessage");
    if ((await message.count()) > 0) {
      expect(await horizontalOverflow(message), `card ${i} message wraps instead of clipping`).toBeLessThanOrEqual(1);
    }
  }
}

async function expectDialogShowsFullDetails(page: Page, fullLocation: string, messageText: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // The complete path and message are in the dialog, not an ellipsized copy.
  await expect(dialog.locator(".piid-dialog-location code")).toHaveText(fullLocation);
  if (messageText.length > 0) {
    await expect(dialog.locator(".piid-dialog-message")).toContainText(messageText);
  }

  // The dialog stays inside the viewport and nothing in it needs horizontal scrolling.
  const viewportWidth = page.viewportSize()!.width;
  const paperBox = await dialog.boundingBox();
  expect(paperBox).not.toBeNull();
  expect(paperBox!.x).toBeGreaterThanOrEqual(0);
  expect(paperBox!.x + paperBox!.width).toBeLessThanOrEqual(viewportWidth + 1);

  const content = dialog.locator(".MuiDialogContent-root");
  expect(await horizontalOverflow(content), "dialog content has no horizontal scroll").toBeLessThanOrEqual(1);
}

/**
 * Replaces the dialog's message and path with representative long values and
 * checks that they wrap. Starter-project issues are short, so this is what
 * exercises the same CSS a user with a deeply nested pack hits.
 */
async function expectLongDetailsWrap(page: Page) {
  const dialog = page.getByRole("dialog");
  const content = dialog.locator(".MuiDialogContent-root");

  await dialog.locator(".piid-dialog-location code").evaluate((el, text) => {
    el.textContent = text;
  }, LONG_NESTED_PATH);
  await dialog.locator(".piid-dialog-message").evaluate((el, text) => {
    el.textContent = "Message: " + text;
  }, LONG_MESSAGE);

  const contentBox = await content.boundingBox();
  const codeBox = await dialog.locator(".piid-dialog-location code").boundingBox();
  expect(contentBox).not.toBeNull();
  expect(codeBox).not.toBeNull();

  expect(codeBox!.x + codeBox!.width, "long path stays inside the dialog").toBeLessThanOrEqual(
    contentBox!.x + contentBox!.width + 1
  );
  expect(await horizontalOverflow(content), "long message and path wrap without horizontal scroll").toBeLessThanOrEqual(
    1
  );
  // A wrapped path occupies more than one line of text.
  expect(codeBox!.height).toBeGreaterThan(20);
}

test.describe("Mobile: Inspector issue details @mobile", () => {
  test("a card's message and file path are readable in full through the details dialog", async ({ page }) => {
    test.setTimeout(180000);
    test.skip(!(await openInspectorItems(page)), "Could not open the inspector");

    await expectPageHasNoHorizontalScroll(page);
    await expectCardsFit(page);

    const card = firstCardWithLocation(page);
    await expect(card, "the starter project reports at least one issue with a file").toBeVisible();

    const link = card.locator(".piid-locationLink");
    const fullLocation = (await link.textContent()) ?? "";
    expect(fullLocation.length).toBeGreaterThan(0);
    // The compact location may ellipsize, so the link itself must name the whole path.
    await expect(link).toHaveAccessibleName(new RegExp(fullLocation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const messageText = (
      (await card
        .locator(".piid-cardMessage")
        .textContent()
        .catch(() => "")) ?? ""
    ).trim();

    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-inspector-issue-card.png` });

    // Touch: the details action opens the dialog with the complete text.
    await card.locator(".piid-infoButton").tap();
    await expectDialogShowsFullDetails(page, fullLocation, messageText);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-inspector-issue-details.png` });

    await expectLongDetailsWrap(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-inspector-issue-details-long.png` });

    await page.getByRole("dialog").getByRole("button", { name: "Close" }).tap();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the details action works from the keyboard and returns focus", async ({ page }) => {
    test.setTimeout(180000);
    test.skip(!(await openInspectorItems(page)), "Could not open the inspector");

    const card = firstCardWithLocation(page);
    await expect(card).toBeVisible();
    const infoButton = card.locator(".piid-infoButton");
    const fullLocation = (await card.locator(".piid-locationLink").textContent()) ?? "";

    await infoButton.focus();
    await expect(infoButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expectDialogShowsFullDetails(page, fullLocation, "");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(infoButton, "focus returns to the details action").toBeFocused();

    // The file path is itself a focusable control, so keyboard users can reach the navigation it offers.
    const link = card.locator(".piid-locationLink");
    await link.focus();
    await expect(link).toBeFocused();
  });

  test("cards and the details dialog still fit at 320px", async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 320, height: 568 });
    test.skip(!(await openInspectorItems(page)), "Could not open the inspector");

    await expectPageHasNoHorizontalScroll(page);
    await expectCardsFit(page);

    const card = firstCardWithLocation(page);
    await expect(card).toBeVisible();
    const fullLocation = (await card.locator(".piid-locationLink").textContent()) ?? "";

    await card.locator(".piid-infoButton").tap();
    await expectDialogShowsFullDetails(page, fullLocation, "");
    await expectLongDetailsWrap(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/mobile-inspector-issue-details-320.png` });
  });
});
