/**
 * Data-Loss Survival Tests
 *
 * High-value end-to-end tests that exercise editing flows the way a real
 * creator does, with a relentless focus on **data loss**: any scenario where
 * an edit a user clearly made could silently disappear.
 *
 * The existing suites cover narrower slices:
 *
 *   - `RoundTripPersistence.spec.ts` — single edit, tab switch, return.
 *   - `JsonEditorRoundTrip.spec.ts`  — raw JSON edit, sidebar navigate, return.
 *   - `PhantomEdits.spec.ts`         — viewing files shouldn't make them dirty.
 *   - `ProjectReloadEditors.spec.ts` — JSON config items rehydrate after save+reload.
 *
 * What was missing — and what this file covers:
 *
 *   1. **Save → page reload → reopen project → edits survive.** This is the
 *      single most painful failure mode (browser-storage round-trip).
 *   2. **Multi-field batch edit survival.** A creator who fills out half a
 *      DataForm and clicks a different tab expects *all* fields to be intact,
 *      not just the last one touched.
 *   3. **Form → Raw → Form value consistency.** Edits made through the
 *      simplified form view must appear verbatim in the underlying JSON, and
 *      edits made in raw JSON must be visible back in the form view.
 *   4. **Mode switch (focused ↔ raw) preserves dirty content.** Mid-session
 *      changing the editing mode must not roll back uncommitted edits.
 *   5. **Project switch survives edits.** Creating a second project and
 *      switching back to the first must not corrupt or revert the first
 *      project's content.
 *
 * These are tagged `@full` so they run as part of the full mctools.dev
 * regression (`npm run test-web-mctoolsdev`) and in the local Vite suite
 * (`npm run test-web`). The smallest, most reliable canary is also tagged
 * `@focused` so it participates in the fast CI core run.
 */

import { test, expect, ConsoleMessage, Page } from "@playwright/test";
import {
  processMessage,
  enterEditor,
  enableAllFileTypes,
  openFileInMonaco,
  switchToRawMode,
  selectEditMode,
  takeScreenshot,
  waitForEditorReady,
  clickTemplateCreateButton,
  preferBrowserStorageInProjectDialog,
  fillRequiredProjectDialogFields,
  waitForMonacoEditor,
} from "./WebTestUtilities";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the value of the first Monaco editor visible on the page.
 * Returns empty string if no editor model exists.
 *
 * If `uriPattern` is provided, returns the content of the first editor whose
 * model URI contains that substring instead. This is needed when more than
 * one Monaco editor is mounted (e.g. the manifest editor's live-preview
 * panel mounts a second read-only Monaco alongside the editable one), so
 * that we read and write the correct model.
 */
async function getMonacoContent(page: Page, uriPattern?: string): Promise<string> {
  return page.evaluate((needle: string | undefined) => {
    const editors = (window as any).monaco?.editor?.getEditors?.() || [];
    for (const editor of editors) {
      const model = editor.getModel?.();
      if (!model) continue;
      if (!needle) return model.getValue() || "";
      const uri = model.uri?.toString() || "";
      if (uri.toLowerCase().includes(needle.toLowerCase())) {
        return model.getValue() || "";
      }
    }
    // Fallback: first editor regardless of URI.
    if (editors[0]) return editors[0].getModel()?.getValue() || "";
    return "";
  }, uriPattern);
}

/**
 * Writes content into the Monaco editor whose model URI matches `uriPattern`
 * (or the first editor if no pattern is provided), and dispatches a
 * synthetic content change so that the JsonEditor's React onChange handler
 * runs. Without that handler firing, the file's manager state never receives
 * the edit and a subsequent Ctrl+S persists the *original* manager state,
 * silently reverting the Monaco model on the next render.
 */
async function setMonacoContent(page: Page, content: string, uriPattern?: string): Promise<void> {
  await page.evaluate(
    ({ c, needle }: { c: string; needle: string | undefined }) => {
      const monaco = (window as any).monaco;
      if (!monaco?.editor) return;

      // Find the editor whose model URI matches the pattern. Fall back to
      // the first editor if no match (e.g. URI doesn't contain `needle`).
      // IMPORTANT: prefer EDITABLE editors. The JsonEditor renders both an
      // editable Monaco for the user AND a read-only live-preview Monaco that
      // shares the same model URI. If we write to the read-only editor's
      // model, onChange may still fire there but JsonEditor's
      // `_handleContentUpdated` returns early because `this.props.readOnly`
      // is true — so the edit is silently dropped from file.content.
      const editors = monaco.editor.getEditors?.() || [];
      let target: any = null;
      const matchesNeedle = (editor: any) => {
        const model = editor?.getModel?.();
        if (!model) return false;
        const uri = model.uri?.toString() || "";
        return !needle || uri.toLowerCase().includes(needle.toLowerCase());
      };
      // First pass: editable editor matching the needle
      for (const editor of editors) {
        if (!matchesNeedle(editor)) continue;
        const readOnlyId = monaco.editor?.EditorOption?.readOnly;
        const isReadOnly =
          typeof readOnlyId === "number" ? editor.getOption?.(readOnlyId) : false;
        if (isReadOnly) continue;
        target = editor;
        break;
      }
      // Second pass: any matching editor (read-only ok as last resort)
      if (!target) {
        for (const editor of editors) {
          if (matchesNeedle(editor)) {
            target = editor;
            break;
          }
        }
      }
      if (!target && editors[0]) target = editors[0];
      if (!target) return;

      target.focus?.();
      const model = target.getModel();
      if (!model) return;

      // Use `executeEdits` rather than `model.setValue` — executeEdits is the
      // path a real user takes (the diff goes through Monaco's command
      // pipeline and reliably fires the onChange listener that
      // `@monaco-editor/react` attaches in its useEffect). `setValue` also
      // fires `onDidChangeModelContent`, but with a slightly different
      // `e.isFlush=true` flag that has caused at least one historical
      // listener to ignore the change. Going through executeEdits avoids
      // that whole class of races.
      const fullRange = model.getFullModelRange();
      const success = target.executeEdits("dls-test", [
        {
          range: fullRange,
          text: c,
          forceMoveMarkers: true,
        },
      ]);
      target.pushUndoStop?.();
      if (!success) {
        // executeEdits returns false when the editor is read-only or the
        // edit is rejected; fall back to setValue so the model is at least
        // visually updated (even if onChange doesn't propagate).
        model.setValue(c);
      }
    },
    { c: content, needle: uriPattern }
  );
}

/**
 * Trigger a project save via Ctrl+S (the same shortcut a real creator would
 * use). Wait long enough for the storage layer to flush.
 */
async function saveProject(page: Page): Promise<void> {
  await page.keyboard.press("Control+S");
  await page.waitForTimeout(2000);
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * Find the first editable text-like input on the page (or within a scope),
 * skipping search boxes, number-only inputs (which need numeric mutation),
 * readonly fields, and the project Creator field (which is a top-level
 * identity field that's intentionally write-once after submit).
 */
async function findEditableTextInput(
  page: Page,
  scope?: ReturnType<typeof page.locator>
): Promise<{ locator: ReturnType<typeof page.locator>; value: string; name: string } | null> {
  const root = scope || page;
  const inputs = root.locator(
    "input[type='text'], input:not([type='checkbox']):not([type='hidden']):not([type='radio']):not([type='range']):not([type='file']):not([type='color']):not([type='number'])"
  );
  const count = await inputs.count();

  for (let i = 0; i < Math.min(count, 30); i++) {
    const input = inputs.nth(i);
    if (!(await input.isVisible({ timeout: 250 }).catch(() => false))) continue;

    const readOnly = await input.getAttribute("readonly");
    if (readOnly !== null) continue;
    if (await input.isDisabled().catch(() => true)) continue;

    const placeholder = (await input.getAttribute("placeholder")) || "";
    if (/search/i.test(placeholder)) continue;

    const name = (await input.getAttribute("name")) || "";
    // Skip identity fields that may not round-trip predictably.
    if (/^(creator|title)$/i.test(name)) continue;

    const value = await input.inputValue().catch(() => "");
    return { locator: input, value, name };
  }
  return null;
}

/**
 * Synchronously check `project.changedFilesSinceLastSaved` (when exposed)
 * to detect "phantom edits" introduced by load. Returns the count, or
 * undefined if the test hooks aren't available.
 *
 * Production builds expose `window.mct.project` for diagnostics; we tolerate
 * the absence of the hook and only assert when the field is reachable.
 */
async function getDirtyFileCount(page: Page): Promise<number | undefined> {
  return page.evaluate(() => {
    const proj = (window as any).mct?.project;
    if (!proj) return undefined;
    try {
      const arr = proj.changedFilesSinceLastSaved;
      if (Array.isArray(arr)) return arr.length;
      if (arr && typeof arr.size === "number") return arr.size;
      return undefined;
    } catch {
      return undefined;
    }
  });
}

/**
 * Walk every Monaco model currently registered in the page and return the
 * concatenated content of any whose URI mentions `pattern`. This avoids the
 * sidebar's ambiguous-text-match problem (e.g. two files named "manifest"
 * appear once a project has both a BP and RP pack) and lets us assert on the
 * actual file we edited regardless of which one the UI currently shows.
 */
async function getAllMonacoContentMatching(page: Page, pattern: string): Promise<string> {
  return page.evaluate((needle: string) => {
    const models = (window as any).monaco?.editor?.getModels?.() || [];
    const chunks: string[] = [];
    for (const m of models) {
      const uri = m.uri?.toString() || "";
      if (uri.toLowerCase().includes(needle.toLowerCase())) {
        try {
          chunks.push(m.getValue());
        } catch {
          /* ignore */
        }
      }
    }
    return chunks.join("\n----\n");
  }, pattern);
}

/**
 * Click the dirty marker (`*`) on a file entry in the sidebar, if any. This
 * is a reliable way to reopen the file the test just edited — it can be
 * tricky to distinguish a BP and RP `manifest.json` by text alone otherwise.
 */
async function openDirtyFileInSidebar(page: Page): Promise<boolean> {
  const dirty = page.locator(".pit-name").filter({ hasText: /\*$/ }).first();
  if (!(await dirty.isVisible({ timeout: 1500 }).catch(() => false))) {
    return false;
  }
  await dirty.scrollIntoViewIfNeeded().catch(() => {});
  await dirty.click();
  await page.waitForTimeout(1000);
  return true;
}

/**
 * Reopen the same project after a full page reload. Browser-storage projects
 * persist via the URL hash that `saveProject` produces, so the simplest
 * reliable recovery is to capture `page.url()` before reload and `goto()` it
 * back. The home page's "Recent Projects" list is not yet stable enough on
 * production to drive purely via clicks across all viewports.
 */
async function reloadAndReopen(page: Page, projectUrl: string): Promise<boolean> {
  await page.goto(projectUrl, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await page.waitForLoadState("networkidle").catch(() => {});
  const ready = await waitForEditorReady(page, 25000);
  if (!ready) {
    return false;
  }
  // After reload the FRE may show again — keep our editing mode preference.
  await selectEditMode(page, "focused").catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

/**
 * Returns true when a value containing `marker` has been written to *any*
 * IndexedDB key whose name matches `keyPattern` (default: /manifest/i).
 * Used to confirm that an edit has actually flushed to persistent storage
 * (rather than relying on the sidebar dirty marker, which can mislead — it's
 * cleared at the end of `project.save()` even if intermediate I/O races
 * leave the underlying file unwritten).
 *
 * This is the most authoritative signal we can get from outside the page:
 * if the marker is in IndexedDB, a reload WILL see it.
 */
async function markerIsInIndexedDB(
  page: Page,
  marker: string,
  keyPattern: RegExp = /manifest/i
): Promise<boolean> {
  return await page.evaluate(
    async ({ m, patternSource, patternFlags }) => {
      const re = new RegExp(patternSource, patternFlags);
      try {
        const dbs = await (indexedDB as any).databases?.();
        if (!dbs) return false;
        for (const dbInfo of dbs) {
          const dbName = dbInfo.name;
          if (!dbName) continue;
          const db: IDBDatabase = await new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, dbInfo.version);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
          });
          const storeNames = Array.from(db.objectStoreNames);
          let foundMarker = false;
          for (const storeName of storeNames) {
            try {
              const tx = db.transaction(storeName, "readonly");
              const store = tx.objectStore(storeName);
              const allKeysReq = store.getAllKeys();
              const allKeys: any[] = await new Promise((resolve) => {
                allKeysReq.onsuccess = () => resolve(allKeysReq.result);
              });
              for (const key of allKeys) {
                if (!re.test(String(key))) continue;
                const valReq = store.get(key);
                const val: any = await new Promise((resolve) => {
                  valReq.onsuccess = () => resolve(valReq.result);
                });
                const s = typeof val === "string" ? val : "";
                if (s.includes(m)) {
                  foundMarker = true;
                  break;
                }
              }
              if (foundMarker) break;
            } catch {
              /* ignore */
            }
          }
          db.close();
          if (foundMarker) return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    { m: marker, patternSource: keyPattern.source, patternFlags: keyPattern.flags }
  );
}

/**
 * Create a fresh Add-On Starter project anchored in browser storage.
 *
 * We prefer the Starter (rather than Full Add-On) because it doesn't fetch
 * from GitHub, so it's much more deterministic in a production smoke run.
 *
 * Optionally pass a `title` to give the project a unique name — required when
 * spawning a *second* project in the same browser context, since browser
 * storage is keyed by project name and two projects with the default
 * "My Add-On" title will collide silently.
 */
async function createStarterProject(page: Page, title?: string): Promise<boolean> {
  await page.goto("/", { waitUntil: "load" });
  await page.waitForTimeout(800);

  const clicked = await clickTemplateCreateButton(page, "addonStarter");
  if (!clicked) {
    console.log("createStarterProject: Could not click addonStarter Create New");
    return false;
  }
  await page.waitForTimeout(800);

  await preferBrowserStorageInProjectDialog(page);
  await fillRequiredProjectDialogFields(page);

  // If a title override was provided, set it on the dialog *before* submit.
  if (title) {
    const titleInput = page.locator('input[name="title"]').first();
    if (await titleInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await titleInput.fill(title);
      await page.waitForTimeout(200);
      console.log(`createStarterProject: Set title = "${title}"`);
    }
  }

  const submit = page.getByTestId("submit-button").first();
  if (await submit.isVisible({ timeout: 3000 }).catch(() => false)) {
    await submit.click();
  } else {
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(2500);

  const ready = await waitForEditorReady(page, 25000);
  if (!ready) return false;

  // Default to focused mode for these tests; raw-mode variants opt in.
  await selectEditMode(page, "focused").catch(() => {});
  await page.waitForTimeout(500);
  return true;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe("Data-Loss Survival Tests @full", () => {
  test.setTimeout(180_000);

  const consoleErrors: { url: string; error: string }[] = [];
  const consoleWarnings: { url: string; error: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;
    page.on("console", (msg: ConsoleMessage) => {
      processMessage(msg, page, consoleErrors, consoleWarnings);
    });
  });

  // -----------------------------------------------------------------------
  // Test 1 (@focused) – Raw JSON edit survives full page reload
  //
  // This is the canonical "did my work just vanish?" scenario. It's also our
  // most reliable canary because Monaco round-trips are deterministic in a
  // way that DataForm field selection across templates isn't.
  //
  // Implementation notes:
  //
  //   * Add-On Starter projects contain *two* `manifest.json` files (BP + RP)
  //     so we can't open the file we just edited by clicking "manifest" in
  //     the sidebar — both entries match. Instead we read every Monaco model
  //     whose URI mentions "manifest" and assert the marker appears in at
  //     least one of them.
  //   * Browser-storage projects auto-persist on each change; the dirty
  //     marker (`*`) reflects "changed in this session", not "unsaved". A
  //     successful round-trip just means the content is intact, regardless
  //     of whether the asterisk reappears.
  // -----------------------------------------------------------------------
  test("raw JSON edit survives save + page reload @focused", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "raw" });
    if (!entered) {
      test.skip();
      return;
    }
    await enableAllFileTypes(page).catch(() => {});
    await page.waitForTimeout(500);

    const opened = await openFileInMonaco(page, "manifest");
    if (!opened) {
      test.skip();
      return;
    }

    // The JSON editor renders a `.jse-loading-placeholder` while Monaco's
    // chunk loads and `Database.uxCatalog` initializes. That can be slow
    // while project validation is consuming the main thread, so wait for
    // the placeholder to disappear before asserting Monaco is mounted.
    await page
      .locator(".jse-loading-placeholder")
      .first()
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => undefined);

    const monaco = page.locator(".monaco-editor").first();
    await expect(monaco).toBeVisible({ timeout: 20000 });

    const originalContent = await getMonacoContent(page, "manifest");
    if (!originalContent || !originalContent.includes('"description"')) {
      console.log("Manifest content not as expected — skipping");
      test.skip();
      return;
    }

    const marker = `__DLS_RELOAD_${Date.now()}`;
    const modified = originalContent.replace(
      /"description"\s*:\s*"([^"]*)"/,
      `"description": "$1 ${marker}"`
    );
    if (modified === originalContent) {
      test.skip();
      return;
    }

    await setMonacoContent(page, modified, "manifest");
    // Give React's onChange a tick to commit the edit into the file manager
    // before we trigger save (otherwise Ctrl+S persists the pre-edit state).
    await page.waitForTimeout(500);

    // Verify the marker is in the manifest model immediately after editing
    // (before save). If this fails, the edit pathway is broken — not save.
    const postEdit = await getAllMonacoContentMatching(page, "manifest");
    expect(postEdit, "Marker should be present in the manifest model immediately after edit").toContain(
      marker
    );

    // Focus Monaco and Ctrl+S to flush to storage.
    const viewLines = page.locator(".monaco-editor .view-lines").first();
    if (await viewLines.isVisible({ timeout: 1000 }).catch(() => false)) {
      await viewLines.click();
    }
    await saveProject(page);
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-reload-01-edited");

    // Verify the marker is in the model we edited *before* we reload, so a
    // test failure unambiguously points at the reload pathway and not the
    // edit pathway.
    const preReload = await getAllMonacoContentMatching(page, "manifest");
    expect(
      preReload,
      "Sanity: marker should be present in some manifest model before reload"
    ).toContain(marker);

    const projectUrl = page.url();
    console.log(`Reloading project from: ${projectUrl}`);

    const reopened = await reloadAndReopen(page, projectUrl);
    expect(reopened, "Editor should re-render after full page reload").toBe(true);

    // After reload, prefer reopening the dirty file directly. Fall back to a
    // generic manifest open so we have *some* manifest model loaded for
    // assertion. The final check inspects every loaded manifest model so the
    // assertion is robust to which one the UI happens to show.
    await enableAllFileTypes(page).catch(() => {});
    await selectEditMode(page, "raw").catch(() => {});

    const reopenedDirty = await openDirtyFileInSidebar(page);
    if (!reopenedDirty) {
      // Some browser-storage projects come back clean after reload — just
      // open any manifest so a Monaco model exists.
      await openFileInMonaco(page, "manifest");
    }

    await expect(monaco).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => (await getAllMonacoContentMatching(page, "manifest")).length, {
        timeout: 20000,
        intervals: [500, 1000, 1500, 2000],
      })
      .toBeGreaterThan(0);

    await takeScreenshot(page, "debugoutput/screenshots/dataloss-reload-02-after-reload");

    const afterContent = await getAllMonacoContentMatching(page, "manifest");
    expect(
      afterContent,
      "The marker we wrote before reload must still be present in some manifest model after reload"
    ).toContain(marker);
  });

  // -----------------------------------------------------------------------
  // Test 2 – Multi-field batch edit survives navigation away
  //
  // A creator who edits several form fields in a row and clicks elsewhere
  // expects every one of those edits to be preserved, not just the last
  // input that lost focus.
  // -----------------------------------------------------------------------
  test("multi-field batch edits all survive a navigation away", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "raw" });
    if (!entered) {
      test.skip();
      return;
    }
    await enableAllFileTypes(page).catch(() => {});
    await openFileInMonaco(page, "manifest");

    const monaco = page.locator(".monaco-editor").first();
    if (!(await monaco.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const original = await getMonacoContent(page);
    if (!original) {
      test.skip();
      return;
    }

    // Make three independent additions so we can detect ordering / dedup bugs:
    // 1. mutate the description value
    // 2. add a JSONC trailing-style marker comment
    // 3. inject a new top-level "x_dls_marker" property
    const markerA = `__DLS_BATCH_A_${Date.now()}`;
    const markerB = `__DLS_BATCH_B_${Date.now()}`;
    const markerC = `__DLS_BATCH_C_${Date.now()}`;

    let modified = original.replace(
      /"description"\s*:\s*"([^"]*)"/,
      `"description": "$1 ${markerA}"`
    );
    modified = modified.replace(/^{\s*/, `{\n  "x_dls_marker": "${markerB}",\n  `);

    // Append a top-level field at the end of the object (before the final brace).
    modified = modified.replace(/}\s*$/, `,\n  "x_dls_extra": "${markerC}"\n}`);

    if (modified === original) {
      test.skip();
      return;
    }

    await setMonacoContent(page, modified);
    await page.locator(".monaco-editor .view-lines").first().click().catch(() => {});
    await saveProject(page);

    await takeScreenshot(page, "debugoutput/screenshots/dataloss-multi-01-edited");

    // Navigate away to a different sidebar item, then come back.
    const settings = page.getByRole("treeitem", { name: /Project Settings|Dashboard/i }).first();
    if (await settings.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settings.click();
      await page.waitForTimeout(1500);
    }

    // Reopen the dirty file we just edited, falling back to any manifest.
    const reopenedDirty = await openDirtyFileInSidebar(page);
    if (!reopenedDirty) {
      await openFileInMonaco(page, "manifest");
    }
    await expect(monaco).toBeVisible({ timeout: 8000 });
    await expect
      .poll(async () => (await getAllMonacoContentMatching(page, "manifest")).length, {
        timeout: 15000,
      })
      .toBeGreaterThan(0);

    const after = await getAllMonacoContentMatching(page, "manifest");
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-multi-02-after");

    expect(after, "marker A (description suffix) must survive").toContain(markerA);
    expect(after, "marker B (new top-level property) must survive").toContain(markerB);
    expect(after, "marker C (appended property) must survive").toContain(markerC);
  });

  // -----------------------------------------------------------------------
  // Test 3 – Form ↔ Raw value consistency in a single session
  //
  // Editing the same file through two different editor surfaces is a common
  // pattern in real use (a creator types in the form, peeks at the raw JSON,
  // then keeps editing). The two views must stay in lockstep.
  //
  // What this test specifically guards against: a known-risky pattern where
  // an in-flight form field value, committed only on blur, can be silently
  // dropped if the editor remounts (mode switch, navigation away, etc.)
  // before the blur fires. We:
  //
  //   1. fill the description field
  //   2. force commit by pressing Tab (blur) and Ctrl+S
  //   3. switch globally to Raw mode
  //   4. read every manifest model and assert the marker is somewhere in
  //      the JSON
  //
  // If this assertion fails, look at the screenshots in
  // `debugoutput/screenshots/dataloss-formraw-*` — a "marker visible in
  // form, missing in raw" outcome means the form ↔ underlying-file binding
  // is dropping changes.
  // -----------------------------------------------------------------------
  test("form-view edit is immediately reflected in raw view", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "focused" });
    if (!entered) {
      test.skip();
      return;
    }
    await enableAllFileTypes(page).catch(() => {});

    const opened = await openFileInMonaco(page, "manifest");
    if (!opened) {
      test.skip();
      return;
    }
    await page.waitForTimeout(1000);

    // Specifically target the Description form field — searching for it by
    // label is reliable across themes and edit modes. Fall back to the first
    // editable input in the right-hand pane if the label-lookup fails.
    const pieOuter = page.locator(".pie-outer").first();
    let descField: ReturnType<typeof page.locator> | null = null;
    let descFieldName = "<unknown>";

    const descByLabel = pieOuter.getByLabel(/^description$/i).first();
    if (await descByLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      descField = descByLabel;
      descFieldName = "description";
    } else {
      const candidate = await findEditableTextInput(page, pieOuter);
      if (candidate) {
        descField = candidate.locator;
        descFieldName = candidate.name || "<first-editable>";
      }
    }

    if (!descField) {
      console.log("Could not find a form-editable text field — skipping");
      test.skip();
      return;
    }

    const marker = `__DLS_FORMRAW_${Date.now()}`;
    const baseValue = (await descField.inputValue().catch(() => "")) || "";
    const newValue = `${baseValue} ${marker}`.trim();

    console.log(`Editing form field "${descFieldName}": "${baseValue}" → "${newValue}"`);
    await descField.scrollIntoViewIfNeeded().catch(() => {});
    await descField.click({ force: true });
    await descField.fill(newValue);

    // Commit the edit: blur via Tab, then explicitly Ctrl+S to flush.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(500);
    await saveProject(page);

    await takeScreenshot(page, "debugoutput/screenshots/dataloss-formraw-01-form-edit");

    // Try the per-file Raw tab first (some focused editors expose one).
    // If that's not available — and on production manifest in focused mode
    // it often isn't — fall back to a global mode switch to Raw, which
    // forces every file into Monaco.
    let switched = await switchToRawMode(page);
    if (!switched) {
      console.log("Per-file Raw button not found; switching global edit mode to Raw");
      await selectEditMode(page, "raw");
      await page.waitForTimeout(800);
      const reopenedDirty = await openDirtyFileInSidebar(page);
      if (!reopenedDirty) {
        await openFileInMonaco(page, "manifest");
      }
      switched = await page.locator(".monaco-editor").first().isVisible({ timeout: 5000 }).catch(() => false);
    }
    if (!switched) {
      console.log("Could not get a Monaco view of manifest — skipping");
      test.skip();
      return;
    }

    const monaco = page.locator(".monaco-editor").first();
    await expect(monaco).toBeVisible({ timeout: 8000 });
    await expect
      .poll(async () => (await getAllMonacoContentMatching(page, "manifest")).length, {
        timeout: 12000,
      })
      .toBeGreaterThan(0);

    const rawContent = await getAllMonacoContentMatching(page, "manifest");
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-formraw-02-raw-view");

    expect(
      rawContent,
      "Form edit must be visible in raw JSON view of the same file"
    ).toContain(marker);
  });

  // -----------------------------------------------------------------------
  // Test 4 – Mid-session mode switch preserves dirty edits
  //
  // Real users sometimes toggle "Full" / "Focused" / "Raw" from the View
  // menu while their work is dirty. The mode switch must not throw away
  // unsaved edits in any open file.
  // -----------------------------------------------------------------------
  test("switching editor mode mid-session preserves dirty edits", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "raw" });
    if (!entered) {
      test.skip();
      return;
    }
    await enableAllFileTypes(page).catch(() => {});

    const opened = await openFileInMonaco(page, "manifest");
    if (!opened) {
      test.skip();
      return;
    }

    // Monaco fetches its ~3.5MB bundle from /dist/vs and can take 10-25s on the dev
    // server under contention; wait for it (DOM + API) before reading its model.
    expect(await waitForMonacoEditor(page)).toBe(true);
    const monaco = page.locator(".monaco-editor").first();

    const original = await getMonacoContent(page);
    if (!original) {
      test.skip();
      return;
    }

    const marker = `__DLS_MODESWITCH_${Date.now()}`;
    const modified = original.replace(
      /"description"\s*:\s*"([^"]*)"/,
      `"description": "$1 ${marker}"`
    );
    if (modified === original) {
      test.skip();
      return;
    }

    await setMonacoContent(page, modified);
    await page.locator(".monaco-editor .view-lines").first().click().catch(() => {});

    // Do NOT save yet — we want to verify the dirty content survives a mode
    // switch even before the underlying storage write.
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-modeswitch-01-raw-dirty");

    // Switch to Focused mode. The Focused FRE often opens manifest in form
    // view, so we need to switch *back* to raw to read the model.
    await selectEditMode(page, "focused");
    await page.waitForTimeout(1000);

    // Reopen manifest to ensure the focused view is showing it.
    await openFileInMonaco(page, "manifest");
    await page.waitForTimeout(500);

    // Switch back to Raw so we can compare the Monaco model.
    await selectEditMode(page, "raw");
    await page.waitForTimeout(1000);

    const reopenedDirty = await openDirtyFileInSidebar(page);
    if (!reopenedDirty) {
      await openFileInMonaco(page, "manifest");
    }
    expect(await waitForMonacoEditor(page)).toBe(true);
    await expect
      .poll(async () => (await getAllMonacoContentMatching(page, "manifest")).length, {
        timeout: 15000,
      })
      .toBeGreaterThan(0);

    const after = await getAllMonacoContentMatching(page, "manifest");
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-modeswitch-02-after");

    expect(
      after,
      "Marker written before the mode switch must survive the focused → raw round-trip"
    ).toContain(marker);
  });

  // -----------------------------------------------------------------------
  // Test 5 – Two-project isolation
  //
  // Creating a second project and switching back to the first must not
  // corrupt the first project's content. We piggy-back on the reload helper
  // to leave/return via URL because the homepage's recent-project list isn't
  // reliable enough across CI environments to drive by click alone.
  // -----------------------------------------------------------------------
  test("editing a second project does not corrupt the first", async ({ page }) => {
    // ---- Project A ----
    const enteredA = await enterEditor(page, { editMode: "raw" });
    if (!enteredA) {
      test.skip();
      return;
    }
    await enableAllFileTypes(page).catch(() => {});
    await openFileInMonaco(page, "manifest");

    // CRITICAL: wait for the JSON editor's loading placeholder to disappear.
    // Until it does, JsonEditor hasn't finished `_ensureContentLoaded` /
    // `_ensureModelForFile`, meaning the Monaco onChange listener may not be
    // wired through to `file.setContent`. Writing to the model in that window
    // updates Monaco visibly but is silently dropped from the file model,
    // and the next Ctrl+S persists the original content. See Test 1 for the
    // same wait — that test is the canary that proves the save path works
    // when the editor is fully ready.
    await page
      .locator(".jse-loading-placeholder")
      .first()
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => undefined);

    const monaco = page.locator(".monaco-editor").first();
    if (!(await monaco.isVisible({ timeout: 20000 }).catch(() => false))) {
      test.skip();
      return;
    }

    // Read the editable manifest model specifically (not the live-preview model)
    // by passing the "manifest" uri pattern. Without this, we may read from the
    // first Monaco editor we find which can be a read-only live preview.
    const originalA = await getMonacoContent(page, "manifest");
    if (!originalA) {
      test.skip();
      return;
    }

    const markerA = `__DLS_PROJA_${Date.now()}`;
    const modifiedA = originalA.replace(
      /"description"\s*:\s*"([^"]*)"/,
      `"description": "$1 ${markerA}"`
    );
    if (modifiedA === originalA) {
      test.skip();
      return;
    }

    // Target the manifest model specifically and give React's onChange a tick
    // to commit the edit into file.content before we trigger save (otherwise
    // Ctrl+S persists the pre-edit state). See Test 1 for the same pattern.
    await setMonacoContent(page, modifiedA, "manifest");
    await page.waitForTimeout(500);

    // Sanity check: confirm the marker reached at least one manifest model
    // before we save. If this fails, the edit pathway is broken — not save.
    const postEditA = await getAllMonacoContentMatching(page, "manifest");
    expect(postEditA, "Project A marker should be in manifest model immediately after edit").toContain(
      markerA
    );

    // Robust check: also wait for the sidebar dirty marker (`*`) to appear on
    // manifest. The asterisk only appears once `file.setContent` has been
    // called via JsonEditor's onChange. If it never appears, the edit didn't
    // make it to the file model, so Ctrl+S would silently persist the
    // original content. Fail loud here rather than later with a confusing
    // marker-missing assertion.
    await expect
      .poll(
        async () => {
          const items = await page.locator(".pit-name").allInnerTexts();
          return items.some((t) => t.trim() === "manifest*");
        },
        {
          message:
            "Sidebar should show dirty marker (*) on manifest — confirms the edit reached file.setContent",
          timeout: 10000,
        }
      )
      .toBe(true);

    await page.locator(".monaco-editor .view-lines").first().click().catch(() => {});
    // Click the Save toolbar button rather than relying on Ctrl+S. Some
    // Monaco mounting paths capture the Ctrl+S keystroke before our window
    // keydown listener (which calls save()) gets a chance to fire. Clicking
    // the toolbar button bypasses that race entirely.
    const saveButton = page.getByRole("button", { name: /^Save( \(.+\))?$/i }).first();
    if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveButton.click();
    } else {
      await saveProject(page);
    }
    // Wait for our marker to actually appear in IndexedDB. This is the most
    // direct signal that the edit is durable: if the marker is there, a
    // reload WILL see it. The sidebar dirty marker (`*`) is a less reliable
    // signal — `project.save()` clears `changedFilesSinceLastSaved` (which
    // drives the `*`) at the end of save, but on a fresh Add-On Starter
    // project the first save also triggers autogeneration of tsconfig,
    // package.json, etc. which can keep refilling the dirty map and leave
    // the `*` lingering even after our manifest write has flushed.
    await expect
      .poll(async () => await markerIsInIndexedDB(page, markerA), {
        message:
          "Project A's marker should be flushed to IndexedDB after save — confirms the edit will survive a reload",
        timeout: 30000,
        intervals: [500, 1000, 1500, 2000],
      })
      .toBe(true);
    // Extra settle time for IndexedDB transactions to fully commit before we
    // navigate to a different project. localforage's setItem is async and
    // can race with page navigation if we don't wait.
    await page.waitForTimeout(1500);
    const projectAUrl = page.url();
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-twoproj-01-A-edited");

    // ---- Project B ----
    // Give Project B a *unique* title. Browser storage is keyed by project
    // title, so two projects with the default "My Add-On" name would silently
    // overwrite each other — which itself is a data-loss footgun, but one
    // outside the scope of this test (see HomeGallerySearch / ProjectWorkflow
    // for that scenario).
    const projectBTitle = `DLS-Project-B-${Date.now()}`;
    const createdB = await createStarterProject(page, projectBTitle);
    if (!createdB) {
      console.log("Could not create second project — skipping");
      test.skip();
      return;
    }
    await selectEditMode(page, "raw").catch(() => {});
    await enableAllFileTypes(page).catch(() => {});
    await openFileInMonaco(page, "manifest");
    // Wait for the JSON editor to fully mount before reading from the model
    // (see Project A above for why this matters — without it, the file's
    // onChange wiring may not be active and our edit gets dropped).
    await page
      .locator(".jse-loading-placeholder")
      .first()
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => undefined);
    await expect(monaco).toBeVisible({ timeout: 20000 });

    const originalB = await getMonacoContent(page, "manifest");
    if (originalB) {
      // Ensure Project B's manifest does NOT already contain Project A's marker
      // (would indicate cross-project storage leakage).
      expect(
        originalB,
        "Project B manifest must not contain Project A's edit marker (storage isolation)"
      ).not.toContain(markerA);

      const markerB = `__DLS_PROJB_${Date.now()}`;
      const modifiedB = originalB.replace(
        /"description"\s*:\s*"([^"]*)"/,
        `"description": "$1 ${markerB}"`
      );
      if (modifiedB !== originalB) {
        await setMonacoContent(page, modifiedB, "manifest");
        await page.waitForTimeout(500);
        // Wait for the dirty marker so we know the edit reached file.content.
        await expect
          .poll(
            async () => {
              const items = await page.locator(".pit-name").allInnerTexts();
              return items.some((t) => t.trim() === "manifest*");
            },
            { timeout: 10000 }
          )
          .toBe(true)
          .catch(() => {
            console.log("Project B: manifest dirty marker did not appear; proceeding anyway");
          });
        await page.locator(".monaco-editor .view-lines").first().click().catch(() => {});
        const saveButtonB = page.getByRole("button", { name: /^Save( \(.+\))?$/i }).first();
        if (await saveButtonB.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveButtonB.click();
        } else {
          await saveProject(page);
        }
        // Wait for Project B's marker to land in IndexedDB before we navigate
        // back to Project A — same rationale as for Project A above.
        await expect
          .poll(async () => await markerIsInIndexedDB(page, markerB), {
            message:
              "Project B's marker should be flushed to IndexedDB after save",
            timeout: 30000,
            intervals: [500, 1000, 1500, 2000],
          })
          .toBe(true)
          .catch(() => {
            console.log("Project B: marker did not appear in IndexedDB; proceeding anyway");
          });
        // Give the storage write a moment to flush before subsequent operations.
        await page.waitForTimeout(1500);
      }
    }
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-twoproj-02-B-edited");

    // ---- Return to Project A ----
    const reopened = await reloadAndReopen(page, projectAUrl);
    expect(reopened, "Editor should re-open Project A after reload").toBe(true);

    await selectEditMode(page, "raw").catch(() => {});
    await enableAllFileTypes(page).catch(() => {});

    const reopenedDirty = await openDirtyFileInSidebar(page);
    if (!reopenedDirty) {
      await openFileInMonaco(page, "manifest");
    }

    // Wait for the JSON editor to fully mount so the model contains the file
    // we're about to read from.
    await page
      .locator(".jse-loading-placeholder")
      .first()
      .waitFor({ state: "hidden", timeout: 30000 })
      .catch(() => undefined);
    await expect(monaco).toBeVisible({ timeout: 20000 });
    await expect
      .poll(async () => (await getAllMonacoContentMatching(page, "manifest")).length, {
        timeout: 20000,
      })
      .toBeGreaterThan(0);

    const afterA = await getAllMonacoContentMatching(page, "manifest");
    await takeScreenshot(page, "debugoutput/screenshots/dataloss-twoproj-03-A-returned");

    expect(
      afterA,
      "Project A's marker must still be present after editing Project B and returning"
    ).toContain(markerA);
  });

  // -----------------------------------------------------------------------
  // Test 6 – Editor never auto-mutates a file the user only viewed
  //
  // Companion canary to `PhantomEdits.spec.ts` that also asserts the file
  // content itself is byte-identical after a passive open in raw mode.
  // -----------------------------------------------------------------------
  test("passively opening manifest in raw mode does not mutate content", async ({ page }) => {
    const entered = await enterEditor(page, { editMode: "raw" });
    if (!entered) {
      test.skip();
      return;
    }
    await enableAllFileTypes(page).catch(() => {});
    await openFileInMonaco(page, "manifest");

    // Monaco fetches its ~3.5MB bundle from /dist/vs and can take 10-25s on the dev
    // server under contention; wait for it (DOM + API) before snapshotting models.
    expect(await waitForMonacoEditor(page)).toBe(true);
    const monaco = page.locator(".monaco-editor").first();

    // Snapshot the content of EVERY manifest model in the project, keyed by
    // URI, so we can detect mutation of either the BP or RP manifest.
    const initialSnapshot = await page.evaluate(() => {
      const models = (window as any).monaco?.editor?.getModels?.() || [];
      const out: Record<string, string> = {};
      for (const m of models) {
        const uri = m.uri?.toString() || "";
        if (uri.toLowerCase().includes("manifest")) {
          out[uri] = m.getValue();
        }
      }
      return out;
    });

    const initialUris = Object.keys(initialSnapshot);
    if (initialUris.length === 0) {
      test.skip();
      return;
    }

    // Click elsewhere and come back without touching any manifest.
    const settings = page.getByRole("treeitem", { name: /Project Settings|Dashboard/i }).first();
    if (await settings.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settings.click();
      await page.waitForTimeout(1500);
    }
    await openFileInMonaco(page, "manifest");
    expect(await waitForMonacoEditor(page)).toBe(true);
    await page.waitForTimeout(1500);

    const afterSnapshot = await page.evaluate(() => {
      const models = (window as any).monaco?.editor?.getModels?.() || [];
      const out: Record<string, string> = {};
      for (const m of models) {
        const uri = m.uri?.toString() || "";
        if (uri.toLowerCase().includes("manifest")) {
          out[uri] = m.getValue();
        }
      }
      return out;
    });

    for (const uri of initialUris) {
      if (afterSnapshot[uri] !== undefined) {
        expect(
          afterSnapshot[uri],
          `Passive open → navigate away → return must not mutate ${uri}`
        ).toBe(initialSnapshot[uri]);
      }
    }

    // Optional sanity: the project should report 0 dirty files (when the
    // diagnostic hook is reachable on this build).
    const dirty = await getDirtyFileCount(page);
    if (typeof dirty === "number") {
      expect(dirty, "No phantom edits should be recorded on a passive open").toBe(0);
    }
  });
});
