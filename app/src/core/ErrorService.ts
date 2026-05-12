// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * ErrorService — centralized routing for uncaught JavaScript errors.
 *
 * Sources fed into this service:
 *   - GlobalErrorBoundary.componentDidCatch (React render/lifecycle errors)
 *   - window "error"   listener  (uncaught synchronous errors)
 *   - window "unhandledrejection" listener (uncaught Promise rejections)
 *   - Electron preload IPC bridge (fatal errors from the main process)
 *
 * Sinks fanned out from this service:
 *   - Subscribers to onErrorReported (the GlobalErrorOverlay React surface)
 *   - telemetryService.trackException (mirrors App.setHomeWithError shape)
 *   - Log.error (for parity with the rest of the app)
 *
 * Design notes:
 *   - This is a singleton so window listeners and React components can all
 *     converge on the same state without prop drilling.
 *   - addFilter() lets feature code suppress known-benign errors (e.g. cancelled
 *     fetches, Monaco loader noise) without touching this file.
 *   - A recursion guard prevents an exception thrown inside report() from
 *     re-entering and looping forever.
 *   - Save handler is registered by App once it knows how to save. The overlay
 *     calls runSaveAll() so the user can persist work before reloading.
 */

import { EventDispatcher } from "ste-events";
import Log from "./Log";
import telemetryService from "../analytics/Telemetry";
import { TelemetryProperties, TelemetrySeverity } from "../analytics/TelemetryConstants";
import CreatorToolsHost, { HostType } from "../app/CreatorToolsHost";

export enum ErrorKind {
  reactRender = "reactRender",
  windowError = "windowError",
  unhandledRejection = "unhandledRejection",
  electronMain = "electronMain",
}

export enum ErrorSeverity {
  /** Render-time error — the React subtree is broken; show full-screen overlay. */
  fatal = "fatal",
  /** UI is still functional — show a dismissible dialog. */
  recoverable = "recoverable",
}

export interface CapturedError {
  /** Unique id assigned by report(). */
  id: number;
  kind: ErrorKind;
  severity: ErrorSeverity;
  /** Short human-readable summary. */
  message: string;
  /** Full stack trace if available. */
  stack?: string;
  /** React component stack (only populated for reactRender errors). */
  componentStack?: string;
  /** Origin description (e.g. URL, file:line) when available. */
  source?: string;
  /** When the error was first observed by the service. */
  timestamp: Date;
  /**
   * Optional triage tag assigned by a categorizer. Used to bucket errors in
   * telemetry (e.g. "monaco-internal-known", "translation-extension-dom",
   * "browser-too-old") so we can filter dashboards without dropping signal.
   * Categorized errors still flow to telemetry — they're just easier to triage.
   */
  category?: string;
}

/** Predicate returning true to suppress an error (i.e. don't surface it to the user). */
export type ErrorFilter = (error: CapturedError) => boolean;

/**
 * Returns a category string to tag the error, or undefined to leave it untagged.
 * Categorizers run before filters; both the category and the captured error
 * still flow to telemetry. Use a categorizer when you want to bucket noise
 * for triage without losing signal — use addFilter only for truly pathological
 * cases that we cannot diagnose or fix (cross-origin "Script error.", DOM
 * mutations from translation extensions, etc.).
 */
export type ErrorCategorizer = (error: CapturedError) => string | undefined;

/**
 * Optional input to report(). The service fills in id and timestamp.
 */
export type ReportableError = Omit<CapturedError, "id" | "timestamp"> & {
  id?: number;
  timestamp?: Date;
};

class ErrorServiceImpl {
  private _nextId = 1;
  private _errors: CapturedError[] = [];
  private _filters: ErrorFilter[] = [];
  private _categorizers: ErrorCategorizer[] = [];
  private _saveAllHandler?: () => Promise<void>;
  private _isReporting = false;
  private _onErrorReported = new EventDispatcher<ErrorServiceImpl, CapturedError>();
  private _onErrorsCleared = new EventDispatcher<ErrorServiceImpl, void>();

  /** Fires whenever a new error makes it past the filters. */
  public get onErrorReported() {
    return this._onErrorReported.asEvent();
  }

  /** Fires when dismissAll() is called. */
  public get onErrorsCleared() {
    return this._onErrorsCleared.asEvent();
  }

  /** All errors captured this session, in arrival order (most recent last). */
  public get errors(): readonly CapturedError[] {
    return this._errors;
  }

  /** Whether this host has any UI surface that could show the overlay. */
  public get isUiHost(): boolean {
    const t = CreatorToolsHost.hostType;
    return (
      t === HostType.web ||
      t === HostType.electronWeb ||
      t === HostType.vsCodeMainWeb ||
      t === HostType.vsCodeWebWeb ||
      t === HostType.webPlusServices
    );
  }

  /** Register a predicate that returns true to suppress matching errors. */
  public addFilter(filter: ErrorFilter): void {
    this._filters.push(filter);
  }

  /**
   * Register a categorizer that tags matching errors with a triage label.
   * Tagged errors still flow to telemetry; the category is forwarded as the
   * `errorCode` property so dashboards can group by it.
   */
  public addCategorizer(categorizer: ErrorCategorizer): void {
    this._categorizers.push(categorizer);
  }

  /** Register the function the overlay should call when the user clicks "Save all". */
  public setSaveAllHandler(handler: (() => Promise<void>) | undefined): void {
    this._saveAllHandler = handler;
  }

  /** Whether a save handler is currently registered (used to enable/disable button). */
  public get hasSaveAllHandler(): boolean {
    return !!this._saveAllHandler;
  }

  /**
   * Run the registered save-all handler. Always resolves; never throws into the caller.
   * Returns true on success, false on failure (with the error swallowed and logged).
   */
  public async runSaveAll(): Promise<boolean> {
    if (!this._saveAllHandler) {
      return false;
    }
    try {
      await this._saveAllHandler();
      return true;
    } catch (e) {
      // Swallow so the overlay UI isn't itself broken by a save failure.
      Log.error("ErrorService: save-all handler threw: " + (e instanceof Error ? e.message : String(e)));
      return false;
    }
  }

  /**
   * Record an error and notify subscribers. Returns the captured error (with id +
   * timestamp filled in) or undefined if it was suppressed by a filter.
   */
  public report(input: ReportableError): CapturedError | undefined {
    // Recursion guard: if the act of reporting throws, do not re-enter.
    if (this._isReporting) {
      return undefined;
    }

    this._isReporting = true;
    try {
      const captured: CapturedError = {
        id: this._nextId++,
        timestamp: input.timestamp ?? new Date(),
        kind: input.kind,
        severity: input.severity,
        message: input.message || "(no message)",
        stack: input.stack,
        componentStack: input.componentStack,
        source: input.source,
        category: input.category,
      };

      // Run categorizers first so filters can see the assigned tag if they
      // want to. The first categorizer to return a non-undefined value wins;
      // explicit input.category takes precedence over any categorizer.
      if (!captured.category) {
        for (const categorizer of this._categorizers) {
          try {
            const tag = categorizer(captured);
            if (tag) {
              captured.category = tag;
              break;
            }
          } catch {
            // Ignore categorizer errors — they should never block reporting.
          }
        }
      }

      // Run filters; any throwing filter is treated as "do not suppress".
      for (const filter of this._filters) {
        try {
          if (filter(captured)) {
            return undefined;
          }
        } catch {
          // Ignore filter errors — better to over-report than to drop signal.
        }
      }

      this._errors.push(captured);

      // Mirror to Log so it shows up alongside other diagnostics.
      try {
        Log.error(
          `[ErrorService] ${captured.kind}: ${captured.message}` + (captured.stack ? "\n" + captured.stack : "")
        );
      } catch {
        // ignore
      }

      // Telemetry — same shape as App.setHomeWithError.
      try {
        const exception =
          input.stack && typeof Error !== "undefined"
            ? Object.assign(new Error(captured.message), { stack: captured.stack })
            : new Error(captured.message);

        telemetryService.trackException({
          exception,
          properties: {
            [TelemetryProperties.ERROR_MESSAGE]: captured.message,
            [TelemetryProperties.LOCATION]: "ErrorService.report",
            [TelemetryProperties.ACTION_SOURCE]: captured.kind,
            ...(captured.category ? { [TelemetryProperties.ERROR_CODE]: captured.category } : {}),
          },
          severityLevel:
            captured.severity === ErrorSeverity.fatal ? TelemetrySeverity.CRITICAL : TelemetrySeverity.ERROR,
        });
      } catch {
        // ignore telemetry failures
      }

      // Fan out to the React overlay.
      try {
        this._onErrorReported.dispatch(this, captured);
      } catch {
        // ignore subscriber failures
      }

      return captured;
    } finally {
      this._isReporting = false;
    }
  }

  /** Remove a single error from the list. */
  public dismiss(id: number): void {
    const idx = this._errors.findIndex((e) => e.id === id);
    if (idx >= 0) {
      this._errors.splice(idx, 1);
    }
  }

  /** Clear every captured error. */
  public dismissAll(): void {
    if (this._errors.length === 0) {
      return;
    }
    this._errors = [];
    try {
      this._onErrorsCleared.dispatch(this, undefined);
    } catch {
      // ignore
    }
  }

  /**
   * Build a rich text payload suitable for the "Report this error" clipboard
   * action. Includes app version + host so issue reports are self-contained.
   */
  public formatForReport(error: CapturedError): string {
    // Resolve version lazily to avoid a hard dep on Constants in tests.
    let version = "unknown";
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const constants = require("./Constants").constants;
      if (constants?.version) {
        version = constants.version;
      }
    } catch {
      // ignore
    }

    const lines: string[] = [
      "Minecraft Creator Tools — error report",
      `Version: ${version}`,
      `Host:    ${HostType[CreatorToolsHost.hostType] ?? CreatorToolsHost.hostType}`,
      `Kind:    ${error.kind}`,
      `Time:    ${error.timestamp.toISOString()}`,
      `Message: ${error.message}`,
    ];
    if (error.source) {
      lines.push(`Source:  ${error.source}`);
    }
    if (error.componentStack) {
      lines.push("", "Component stack:", error.componentStack);
    }
    if (error.stack) {
      lines.push("", "Stack:", error.stack);
    }
    return lines.join("\n");
  }

  /**
   * Build a URL that opens a prefilled GitHub issue against the public Minecraft
   * Creator Tools repo. The body is composed as a Markdown report with
   * collapsed <details> sections for the long stack traces. The total URL is
   * truncated to a safe length (~7.5 KB) because most browsers and GitHub
   * itself cap query strings around 8 KB — if the report is longer, we trim the
   * stack and append a notice telling the user to paste the full report (which
   * the overlay copies to the clipboard at the same time) into the issue body.
   */
  public buildGitHubIssueUrl(error: CapturedError): string {
    const base = "https://github.com/Mojang/minecraft-creator-tools/issues/new";

    // Resolve version lazily (same approach as formatForReport).
    let version = "unknown";
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const constants = require("./Constants").constants;
      if (constants?.version) {
        version = constants.version;
      }
    } catch {
      // ignore
    }

    const host = HostType[CreatorToolsHost.hostType] ?? String(CreatorToolsHost.hostType);
    // `navigator` only exists in browser/webview hosts. The library build
    // (tsconfig.lib.json) targets Node and does not pull in the DOM lib, so
    // reach for the global indirectly to avoid a TS2304 in those configs.
    const navAny: { userAgent?: unknown } | undefined = (globalThis as any).navigator;
    const userAgent = navAny && typeof navAny.userAgent === "string" ? navAny.userAgent : "n/a";

    // Title kept short — GitHub displays only ~80 chars in lists.
    const titleRaw = `Uncaught error (${error.kind}): ${error.message}`;
    const title = titleRaw.length > 120 ? titleRaw.slice(0, 117) + "…" : titleRaw;

    const sections: string[] = [
      "### What happened",
      "_(please describe what you were doing when this error appeared)_",
      "",
      "### Environment",
      `- **Version:** ${version}`,
      `- **Host:** ${host}`,
      `- **Kind:** ${error.kind}`,
      `- **Severity:** ${error.severity}`,
      `- **Time:** ${error.timestamp.toISOString()}`,
      `- **User agent:** ${userAgent}`,
      "",
      "### Error message",
      "```",
      error.message,
      "```",
    ];

    if (error.source) {
      sections.push("", `**Source:** \`${error.source}\``);
    }

    if (error.componentStack) {
      sections.push("", "### Component stack", "```", error.componentStack.trim(), "```");
    }

    if (error.stack) {
      sections.push("", "### Stack trace", "```", error.stack.trim(), "```");
    }

    const buildUrl = (body: string) =>
      `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;

    let body = sections.join("\n");
    let url = buildUrl(body);

    // Most browsers cap URLs around 8 KB; GitHub itself rejects very long ones.
    // Strip the stack/component-stack sections first if we're over the limit, then hard-trim.
    const MAX_URL = 7500;
    if (url.length > MAX_URL) {
      const truncationNote =
        "\n\n> _Stack trace was too long to fit in the URL. Please paste the full report (copied to your clipboard) here._";
      // Drop the stack sections (everything from the first ### Stack/Component header onward).
      const stripStacks = (text: string) => text.replace(/\n*### (?:Stack trace|Component stack)[\s\S]*$/m, "");
      body = stripStacks(body) + truncationNote;
      url = buildUrl(body);
      if (url.length > MAX_URL) {
        const overflow = url.length - MAX_URL;
        const trimmedBody = body.slice(0, Math.max(0, body.length - overflow - 32)) + "\n\n> _(truncated)_";
        url = buildUrl(trimmedBody);
      }
    }

    return url;
  }
}

const ErrorService = new ErrorServiceImpl();
export default ErrorService;
