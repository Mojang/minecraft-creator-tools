import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@fontsource/noto-sans";
import App from "./UX/appShell/App";
import AppServiceProxy from "./core/AppServiceProxy";
import CreatorToolsHost, { CreatorToolsThemeStyle } from "./app/CreatorToolsHost";
import { loader } from "@monaco-editor/react";
import { minecraftToolDarkTheme, minecraftToolLightTheme } from "./core/StandardInit";
import { ThemeProvider } from "@mui/material";
import { createMcTheme } from "./UX/hooks/theme/UseTheme";
import { LocalizationProvider, getUserLocale } from "./UX/appShell/LocalizationProvider";

import Log from "./core/Log";
import ErrorService, { ErrorKind, ErrorSeverity } from "./core/ErrorService";
import { GlobalErrorBoundary, GlobalErrorOverlay } from "./UX/appShell/errorOverlay";

// Import ProjectWorkerManager to register it for web worker support
// This module self-registers when loaded in browser environments
import "./workers/ProjectWorkerManager";

CreatorToolsHost.init();

// ---------------------------------------------------------------------------
// Categorizers — tag known classes of errors with a triage label so we can
// bucket them in telemetry without dropping signal. Errors keep flowing to
// 1DS exactly as before; the category just shows up as the `errorCode`
// property, which makes dashboards easier to filter and correlate.
//
// Prefer adding categorizers (tag, don't drop) over filters. Reserve
// addFilter for truly pathological cases that we cannot diagnose or fix
// (cross-origin "Script error.", DOM mutations from translation extensions,
// etc.) — see the filter section below for examples.
// ---------------------------------------------------------------------------

function _isMonacoStack(stack: string | undefined): boolean {
  if (!stack) return false;
  return stack.includes("/monaco/min/vs") || stack.includes("/dist/vs") || /vendor-monaco-[\w-]*\.js/.test(stack);
}

// Tag any error whose stack lives inside the Monaco editor bundle so we can
// triage Monaco-related issues independently. We DO want these in telemetry —
// some Monaco bugs are fixable on our side (we may be feeding it bad input).
ErrorService.addCategorizer((err) => {
  if (_isMonacoStack(err.stack) || _isMonacoStack(err.source)) {
    return "monaco-internal";
  }
  return undefined;
});

// Tag the well-known benign ResizeObserver loop notification. Spec dictates
// the browser fires this whenever a ResizeObserver callback causes a layout
// change that would re-trigger another observation in the same animation
// frame; the next round is just deferred to the following frame. Chromium
// has explicitly classified it as not-an-error (crbug.com/809574). We tag it
// so we can still see volume in telemetry (helps spot a bona-fide layout
// thrash regression) but skip the user-facing overlay.
ErrorService.addCategorizer((err) => {
  const msg = err.message || "";
  if (
    /ResizeObserver loop limit exceeded/.test(msg) ||
    /ResizeObserver loop completed with undelivered notifications/.test(msg)
  ) {
    return "browser-resizeobserver-loop";
  }
  return undefined;
});

// ---------------------------------------------------------------------------
// Filters — drop errors only when they carry no actionable information.
// ---------------------------------------------------------------------------

// Suppress the browser's redacted cross-origin "Script error." event. When a
// <script> from another origin (extension, ad, third-party CDN) throws an
// uncaught exception, browsers strip the message/file/line/stack and just
// dispatch ErrorEvent { message: "Script error." }. There is no actionable
// information and it isn't our code, so it should not pollute telemetry.
//
// Also drops other "anonymous" errors that arrive with no stack and no source
// information — e.g. raw "SyntaxError: Unexpected token ." from an extension
// trying to inject a script that doesn't parse in the current Chromium build.
// If there is no stack and no source URL, the error did not originate from
// any code we ship; we cannot diagnose it and the user would not benefit
// from us logging it.
ErrorService.addFilter((err) => {
  const msg = (err.message || "").trim();
  if ((msg === "Script error." || msg === "Script error") && !err.stack) {
    return true;
  }
  // Anonymous SyntaxError with no stack/source — almost certainly an
  // injected/external script that the page can't see.
  if (!err.stack && !err.source && /^SyntaxError:/.test(msg)) {
    return true;
  }
  return false;
});

// Suppress async vendor errors from TUI Grid (`tui-grid`). Its internal
// resize/layout callbacks can fire after the grid's DOM element has been
// disposed (e.g. between `_addGrid` re-creation, or after unmount), producing
// "null is not an object (evaluating 'E.clientHeight')" inside refreshLayout.
// The stack lives entirely in vendor-misc with no application frames, so we
// cannot catch it with a try/catch. Filter it instead.
ErrorService.addFilter((err) => {
  const msg = err.message || "";
  // Match both Safari ("null is not an object (evaluating 'X.clientHeight')")
  // and Chrome/Edge ("Cannot read properties of null (reading 'clientHeight')")
  // shapes. The minified property name (X/E/etc.) varies per build, so match
  // any single-letter token.
  if (
    /\(evaluating\s+'\w\.clientHeight'\)/.test(msg) ||
    /Cannot read properties of null \(reading 'clientHeight'\)/.test(msg)
  ) {
    return true;
  }
  return false;
});

// Drop one specific Monaco internal recursion guard ("Invoking deltaDecorations
// recursively could lead to leaking decorations."). This fires from Monaco's
// own auto-closed-bracket validator (`_validateAutoClosedActions` re-enters
// the decorations system mid-event). Stack has zero application frames, the
// error is non-fatal (Monaco recovers), and there is no fix on our side
// since we are not calling deltaDecorations synchronously inside any content
// change handler. The general "monaco-internal" category above already tags
// most Monaco issues for triage; this one is dropped because the volume is
// high and the cause is well-understood vendor code.
ErrorService.addFilter((err) => {
  return /Invoking\s+deltaDecorations\s+recursively/i.test(err.message || "");
});

window.addEventListener("unhandledrejection", (evt) => {
  // Route through ErrorService so categorizers (e.g. monaco-internal) and
  // filters (e.g. cross-origin Script error.) get a chance. Don't call
  // stopImmediatePropagation here — letting the event continue lets 1DS
  // auto-capture also see it as a backstop.
  const reasonStack: string | undefined = evt?.reason?.stack;
  const reason = evt?.reason;
  const message =
    reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Unhandled promise rejection";
  ErrorService.report({
    kind: ErrorKind.unhandledRejection,
    severity: ErrorSeverity.recoverable,
    message,
    stack: reason instanceof Error ? reason.stack : reasonStack,
  });
});

window.addEventListener("error", (evt) => {
  // Route through ErrorService so categorizers/filters apply. 1DS auto-capture
  // sees this event in parallel, which is intentional — see site.js comment.
  const stack = evt?.error?.stack;
  ErrorService.report({
    kind: ErrorKind.windowError,
    severity: ErrorSeverity.recoverable,
    message: evt?.message || (evt?.error instanceof Error ? evt.error.message : "Uncaught error"),
    stack,
    source: evt?.filename ? `${evt.filename}:${evt.lineno ?? ""}:${evt.colno ?? ""}` : undefined,
  });
});

// Bridge for fatal Electron-main errors. The preload exposes a hook on window
// (no-op when not running under Electron). We deliberately keep this dynamic
// so the web build doesn't have a hard dependency on Electron typings.
try {
  const electronApi = (window as any).api;
  if (electronApi && typeof electronApi.receive === "function") {
    electronApi.receive("error:fatal", (payload: { message?: string; stack?: string } | undefined) => {
      ErrorService.report({
        kind: ErrorKind.electronMain,
        severity: ErrorSeverity.fatal,
        message: payload?.message || "A fatal error occurred in the Electron main process.",
        stack: payload?.stack,
      });
    });
  }
} catch {
  // ignore — best effort only
}

function ensureFirstBackSlash(str: string) {
  return str.length > 0 && str.charAt(0) !== "/" ? "/" + str : str;
}

function uriFromPath(_path: string) {
  const pathName = _path.replace(/\\/g, "/");

  return encodeURI("file://" + ensureFirstBackSlash(pathName));
}

async function initVsLoader() {
  if (AppServiceProxy.hasAppService) {
    let basePath = window.location.href;

    basePath = basePath.substring(0, basePath.lastIndexOf("/"));

    if (basePath.includes("?")) {
      basePath = basePath.substring(0, basePath.indexOf("?"));
    }

    loader.config({
      paths: {
        vs: basePath + "/dist/vs",
      },
    });

    try {
      await loader.init();
    } catch (err) {
      Log.fail("Monaco loader initialization failed: " + err);
    }
  } else {
    loader.config({
      paths: { vs: "/dist/vs" },
    });
  }
}

async function initAsync() {
  await initVsLoader();

  const darkTheme = minecraftToolDarkTheme;
  const lightTheme = minecraftToolLightTheme;

  const storedMode = localStorage.getItem("color-mode") as string;

  // Detect forced-colors (Windows High Contrast) mode
  const isForcedColors = window.matchMedia?.("(forced-colors: active)").matches ?? false;
  CreatorToolsHost.isHighContrast = isForcedColors;

  if (window.location.search.indexOf("theme=l") > 0) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
  } else if (window.location.search.indexOf("theme=d") > 0) {
    CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
  } else if (!isForcedColors && storedMode) {
    // When forced-colors is active, ignore stored preference — follow system color scheme
    CreatorToolsHost.theme = storedMode === "light" ? CreatorToolsThemeStyle.light : CreatorToolsThemeStyle.dark;
  } else {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      CreatorToolsHost.theme = CreatorToolsThemeStyle.dark;
    } else {
      CreatorToolsHost.theme = CreatorToolsThemeStyle.light;
    }
  }

  document.body.classList.toggle("ct-dark", CreatorToolsHost.theme === CreatorToolsThemeStyle.dark);
  document.body.classList.toggle("ct-light", CreatorToolsHost.theme === CreatorToolsThemeStyle.light);
  document.body.classList.toggle("ct-hc", isForcedColors);

  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element not found");
  }
  const root = createRoot(container);

  /**
   * Wrapper that keeps the MUI ThemeProvider in sync with CreatorToolsHost.theme.
   * Without this, components using MUI's useTheme() (e.g. McToolbar) would stay
   * stuck on the initial theme because <ThemeProvider theme={...}> was only set once.
   */
  function ThemedApp() {
    const [mode, setMode] = useState<"dark" | "light">(
      CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light"
    );

    useEffect(() => {
      const handler = () => {
        setMode(CreatorToolsHost.theme === CreatorToolsThemeStyle.dark ? "dark" : "light");
      };
      CreatorToolsHost.onThemeChanged.subscribe(handler);
      return () => {
        CreatorToolsHost.onThemeChanged.unsubscribe(handler);
      };
    }, []);

    return (
      <LocalizationProvider locale={getUserLocale()}>
        <ThemeProvider theme={createMcTheme(mode)}>
          <GlobalErrorBoundary>
            <App darkTheme={darkTheme} lightTheme={lightTheme} />
          </GlobalErrorBoundary>
          {/* Sibling overlay for non-fatal (recoverable) errors so it can render even while App is alive. */}
          <GlobalErrorOverlay />
        </ThemeProvider>
      </LocalizationProvider>
    );
  }

  root.render(
    <React.StrictMode>
      <ThemedApp />
    </React.StrictMode>
  );
}

initAsync();
