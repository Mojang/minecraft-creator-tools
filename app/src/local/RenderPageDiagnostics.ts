// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * RenderPageDiagnostics - says what a render page was doing when it didn't become ready in time.
 *
 * PlaywrightPageRenderer watches each render page with one of these. While the page loads, it
 * records the requests still pending, the requests that failed (network errors and HTTP error
 * statuses), and the latest console errors and uncaught exceptions. When a Playwright wait times
 * out, explain() appends them to the error, with any error the presentation scene reported through
 * `window.mctPresentationError` (RenderPresentation.ts). Other errors, and successful renders, are
 * unchanged.
 *
 * explain() copies what it reports at the moment it's called, right after the wait timed out,
 * and then asks the page for its viewer error, which can take up to a second. Events in that
 * second don't change the report. If the page doesn't answer, the report says so, rather than
 * reporting no errors.
 *
 * The text never includes headers or response bodies. URLs keep only their origin and path, so
 * query strings, fragments, credentials, and the contents of data: and blob: URLs are dropped.
 * Page text is put on one line, URLs in it are shortened the same way, terminal control
 * characters are escaped, and each list and line is capped. See docs/PlaywrightBrowserManagement.md.
 *
 * Playwright colors the call log in its messages on Windows, and wherever TERM or TERM_PROGRAM
 * names a color terminal, even when output is piped. So explain() removes those color codes from
 * the message it extends and escapes its other control characters, keeping only line breaks.
 */

import type { Page } from "playwright";
import Utilities from "../core/Utilities";

/** The most requests or errors listed of each kind. */
export const MAX_LISTED = 5;
/** The longest URL shown, in characters. */
export const MAX_URL_LENGTH = 120;
/** The longest error message shown, in characters. */
export const MAX_MESSAGE_LENGTH = 200;
/** How much of each console error is kept until the timeout, when the listed ones are described. */
const MAX_RECORDED_LENGTH = 4000;
/** The most hosts the connection hint names. */
const MAX_HINT_HOSTNAMES = 3;
/** How long to wait for the page to report its viewer error, before saying it didn't answer. */
const VIEWER_ERROR_WAIT_MS = 1000;
/** How Chromium fails a request that the page, or a new navigation, canceled. */
const CANCELED = "net::ERR_ABORTED";
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
/**
 * A URL in page text. A data: or blob: URL comes first, because a blob URL contains another URL,
 * and it runs to the next space, so none of its content is left over. Other URLs need a host.
 */
const URL_IN_TEXT = /\b(?:(data|blob):\S+|[a-z][a-z0-9+.-]*:\/\/[^\s"'`<>\p{Cc}]+)/giu;
/** Punctuation that ends a sentence or clause after a URL. */
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
/** The closing character for each bracket or quote that can wrap a URL in text. */
const CLOSERS: Partial<Record<string, string>> = { "(": ")", "[": "]", "<": ">", '"': '"', "'": "'", "`": "`" };
const CREDENTIALS = /^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i;
/** The color codes Playwright puts around its call log. */
const COLOR_CODE = /\u001b\[[0-9;]*m/g;

interface IRequestRecord {
  url: string;
  hostname: string;
  started: number;
  status?: number;
  /** When the response status arrived. */
  statusAt?: number;
}

interface IFailedRequest {
  url: string;
  error: string;
  /** When the failure was known: when an HTTP error status arrived, or when the request failed. */
  at: number;
}

/** Whether the server answered `record` with an HTTP error status. */
function hasErrorStatus(record: IRequestRecord): boolean {
  return record.status !== undefined && record.status >= 400;
}

/** `text` on one line, with control characters escaped, cut to `max` characters. */
function sanitize(text: string, max: number, keepEnd = false): string {
  const line = Utilities.escapeControlCharacters(text.replace(/\s+/g, " ").trim());
  if (line.length <= max) {
    return line;
  }
  if (!keepEnd) {
    return line.substring(0, max - 3) + "...";
  }
  const head = Math.ceil((max - 3) / 2);
  return line.substring(0, head) + "..." + line.substring(line.length - (max - 3 - head));
}

/** `url` without its query string, fragment, credentials, or data, and its host name. */
function summarizeUrl(url: string): { url: string; hostname: string } {
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1].toLowerCase();
  if (scheme === "data" || scheme === "blob") {
    return { url: `${scheme}:...`, hostname: "" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    const path = url.replace(/[?#][\s\S]*$/, "").replace(CREDENTIALS, "$1");
    return { url: sanitize(path + (/[?#]/.test(url) ? "?..." : ""), MAX_URL_LENGTH, true), hostname: "" };
  }

  if (!parsed.host) {
    return { url: `${parsed.protocol}...`, hostname: "" };
  }
  const query = parsed.search ? "?..." : "";
  return {
    url: sanitize(`${parsed.protocol}//${parsed.host}${parsed.pathname}${query}`, MAX_URL_LENGTH, true),
    hostname: parsed.hostname,
  };
}

/** How a URL appears in the diagnostics: its origin and path, cut to a readable length. */
export function describeUrl(url: string): string {
  return summarizeUrl(url).url;
}

/**
 * Text from the page on one line, with the URLs in it shortened as describeUrl() does. A data: or
 * blob: URL keeps only its scheme, and the bracket, quote, or punctuation after it.
 */
function describeText(text: string): string {
  const shortened = text.replace(URL_IN_TEXT, (url: string, opaqueScheme: string | undefined, offset: number) => {
    if (!opaqueScheme) {
      return describeUrl(url);
    }
    const punctuation = TRAILING_PUNCTUATION.exec(url)?.[0] ?? "";
    const closer = CLOSERS[text[offset - 1]];
    const closed = closer !== undefined && url.endsWith(closer + punctuation);
    return `${opaqueScheme.toLowerCase()}:...${closed ? closer : ""}${punctuation}`;
  });
  return sanitize(shortened, MAX_MESSAGE_LENGTH);
}

/**
 * An error `message` from Playwright, without color codes or trailing line breaks. Its other
 * control characters, including tabs and carriage returns that don't end a line, are escaped, so
 * only the line breaks between its lines remain.
 */
function describeMessage(message: string): string {
  return message
    .replace(COLOR_CODE, "")
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => Utilities.escapeControlCharacters(line))
    .join("\n");
}

function heading(label: string, count: number, shown: string): string {
  return count > MAX_LISTED ? `  ${label} (${count}, showing ${shown}):` : `  ${label} (${count}):`;
}

/** What the viewer said when asked for its error: the error, none, or nothing in time. */
export type ViewerAnswer = { error: string } | "no error" | "no answer";

/** What a page was doing at one moment, copied so that later page events can't change it. */
interface IPageSnapshot {
  failed: IFailedRequest[];
  failedCount: number;
  /** The requests that had waited longest, with how long, in milliseconds. */
  pending: { url: string; waited: number }[];
  pendingCount: number;
  errors: string[];
  errorCount: number;
  /** Other hosts whose requests hadn't finished, for the connection hint. */
  remoteHostnames: string[];
}

/** Lines that say what the page was doing in `snapshot`, to follow an error message. */
function describeSnapshot(snapshot: IPageSnapshot, viewer: ViewerAnswer): string {
  const lines: string[] = [];

  if (snapshot.failedCount > 0) {
    lines.push(heading("Requests that failed", snapshot.failedCount, `the first ${MAX_LISTED}`));
    lines.push(...snapshot.failed.map((failure) => `    - ${failure.url}: ${failure.error}`));
  }

  if (snapshot.pendingCount > 0) {
    lines.push(heading("Requests still pending", snapshot.pendingCount, `the ${MAX_LISTED} longest`));
    lines.push(...snapshot.pending.map((request) => `    - ${request.url} (${(request.waited / 1000).toFixed(1)}s)`));
  }

  if (snapshot.errorCount > 0) {
    lines.push(heading("Console errors", snapshot.errorCount, `the last ${MAX_LISTED}`));
    lines.push(...snapshot.errors.map((text) => `    - ${describeText(text)}`));
  }

  if (lines.length === 0 && viewer === "no answer") {
    return (
      "At the timeout, the render page had no pending or failed requests and no console errors, " +
      "but it didn't respond when asked for its viewer error."
    );
  }
  if (viewer === "no answer") {
    lines.push("  Viewer error: unknown, because the page didn't respond in time.");
  } else if (viewer !== "no error") {
    lines.push(`  Viewer error: ${describeText(viewer.error)}`);
  }

  if (lines.length === 0) {
    return "At the timeout, the render page had no pending or failed requests and no errors.";
  }

  lines.unshift("At the timeout, the render page had:");
  if (snapshot.remoteHostnames.length > 0) {
    const hostnames = snapshot.remoteHostnames.join(", ");
    lines.push(`Check your internet connection: requests to ${hostnames} didn't finish.`);
  }
  return lines.join("\n");
}

export default class RenderPageDiagnostics {
  private readonly _pageHostname: string;
  private readonly _now: () => number;
  private readonly _pending = new Map<object, IRequestRecord>();
  private readonly _failed: IFailedRequest[] = [];
  private _failedCount = 0;
  /** Other hosts whose requests failed in the network, kept apart from the listed failures. */
  private readonly _remoteFailureHostnames = new Set<string>();
  private readonly _errors: string[] = [];
  private _errorCount = 0;
  private _page: Page | undefined;

  /**
   * @param pageUrl - The render page's server. Requests to it, or to this computer, don't point
   * to a connection problem.
   * @param now - Clock in milliseconds, which tests replace.
   */
  constructor(pageUrl: string, now: () => number = Date.now) {
    this._pageHostname = summarizeUrl(pageUrl).hostname;
    this._now = now;
  }

  /** Records what `page` loads and reports, from now until it closes. */
  static watch(page: Page, pageUrl: string, now: () => number = Date.now): RenderPageDiagnostics {
    const diagnostics = new RenderPageDiagnostics(pageUrl, now);
    diagnostics._page = page;
    page.on("request", (request) => diagnostics.requestStarted(request, request.url()));
    page.on("response", (response) => diagnostics.responseReceived(response.request(), response.status()));
    page.on("requestfinished", (request) => diagnostics.requestFinished(request));
    page.on("requestfailed", (request) => diagnostics.requestFailed(request, request.failure()?.errorText ?? ""));
    page.on("console", (message) => {
      // Chromium also logs each failed request, without its URL. The request lists cover those.
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
        diagnostics.pageError(message.text());
      }
    });
    page.on("pageerror", (error) => diagnostics.pageError(`Uncaught ${error.name || "Error"}: ${error.message}`));
    return diagnostics;
  }

  /**
   * When `error` is a Playwright timeout, `message` without its color codes and other control
   * characters, followed by what the page was doing when it timed out. Otherwise, or without
   * diagnostics, `message` unchanged.
   */
  static async explain(
    diagnostics: RenderPageDiagnostics | null | undefined,
    message: string,
    error: unknown
  ): Promise<string> {
    if (!diagnostics || !(error instanceof Error) || error.name !== "TimeoutError") {
      return message;
    }
    // Copy the page's state before asking the viewer, because the page keeps loading meanwhile.
    const snapshot = diagnostics.snapshot();
    const viewer = await diagnostics.askViewer();
    return `${describeMessage(message)}\n${describeSnapshot(snapshot, viewer)}`;
  }

  /** Forgets what was recorded, so that the next navigation is described on its own. */
  reset(): void {
    this._pending.clear();
    this._failed.length = 0;
    this._failedCount = 0;
    this._remoteFailureHostnames.clear();
    this._errors.length = 0;
    this._errorCount = 0;
  }

  requestStarted(request: object, url: string): void {
    this._pending.set(request, { ...summarizeUrl(url), started: this._now() });
  }

  responseReceived(request: object, status: number): void {
    const record = this._pending.get(request);
    if (record) {
      record.status = status;
      record.statusAt = this._now();
    }
  }

  requestFinished(request: object): void {
    this.settle(request);
  }

  requestFailed(request: object, error: string): void {
    this.settle(request, error);
  }

  /** Records a console error or an uncaught exception, keeping the latest few. */
  pageError(text: string): void {
    this._errorCount++;
    this._errors.push(text.substring(0, MAX_RECORDED_LENGTH));
    if (this._errors.length > MAX_LISTED) {
      this._errors.shift();
    }
  }

  /** Lines that say what the page is doing now, and what `viewer` said, to follow an error message. */
  describe(viewer: ViewerAnswer = "no error"): string {
    return describeSnapshot(this.snapshot(), viewer);
  }

  /**
   * A copy of what the page is doing now. A request whose HTTP error status has arrived counts as
   * failed, even while its body still loads. Once it finishes, it's recorded as failed instead.
   */
  private snapshot(): IPageSnapshot {
    const now = this._now();
    const records = [...this._pending.values()];
    const loadingErrors = records.filter(hasErrorStatus).map(
      (record): IFailedRequest => ({
        url: record.url,
        error: `HTTP ${record.status} (still loading after ${(Math.max(0, now - record.started) / 1000).toFixed(1)}s)`,
        at: record.statusAt ?? now,
      })
    );
    const failed = [...this._failed, ...loadingErrors].sort((a, b) => a.at - b.at);
    const pending = records.filter((record) => !hasErrorStatus(record)).sort((a, b) => a.started - b.started);
    const remoteHostnames = new Set([
      ...pending.map((request) => request.hostname).filter((hostname) => this.isRemote(hostname)),
      ...this._remoteFailureHostnames,
    ]);

    return {
      failed: failed.slice(0, MAX_LISTED),
      failedCount: this._failedCount + loadingErrors.length,
      pending: pending.slice(0, MAX_LISTED).map((request) => ({
        url: request.url,
        waited: Math.max(0, now - request.started),
      })),
      pendingCount: pending.length,
      errors: [...this._errors],
      errorCount: this._errorCount,
      remoteHostnames: [...remoteHostnames].slice(0, MAX_HINT_HOSTNAMES),
    };
  }

  /**
   * Stops tracking `request`, and records a failure if it got an HTTP error status or, without
   * one, a network `error`. Chromium also fails an HTTP error response whose body the page never
   * reads as canceled, so the status comes first. Other canceled requests, and requests that
   * started before the last reset(), are ignored.
   */
  private settle(request: object, error?: string): void {
    const record = this._pending.get(request);
    if (!record) {
      return;
    }
    this._pending.delete(request);
    if (hasErrorStatus(record)) {
      this.addFailure(record, `HTTP ${record.status}`, false, record.statusAt ?? this._now());
    } else if (error !== undefined && error !== CANCELED) {
      this.addFailure(record, describeText(error || "failed"), true, this._now());
    }
  }

  /** Records a failure, and the host of one in the network, for the connection hint. */
  private addFailure(record: IRequestRecord, error: string, network: boolean, at: number): void {
    // The hint covers every listed or unlisted network failure, up to the hosts it can name.
    if (network && this.isRemote(record.hostname) && this._remoteFailureHostnames.size < MAX_HINT_HOSTNAMES) {
      this._remoteFailureHostnames.add(record.hostname);
    }
    // Keep the first failures, because later ones often follow from them.
    this._failedCount++;
    this._failed.push({ url: record.url, error, at });
    this._failed.sort((a, b) => a.at - b.at);
    this._failed.length = Math.min(this._failed.length, MAX_LISTED);
  }

  /** Whether `hostname` is neither the render server nor this computer. */
  private isRemote(hostname: string): boolean {
    return hostname !== "" && hostname !== this._pageHostname && !LOOPBACK_HOSTNAMES.has(hostname);
  }

  /**
   * What the viewer reports through `window.mctPresentationError`. A page that's closed, can't
   * run script, or doesn't answer within a second gives "no answer", because its error is
   * unknown. Without a page, as in tests that record events directly, there's nothing to ask.
   */
  private async askViewer(): Promise<ViewerAnswer> {
    const page = this._page;
    if (!page) {
      return "no error";
    }
    if (page.isClosed()) {
      return "no answer";
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        page
          .evaluate(() => (globalThis as { mctPresentationError?: unknown }).mctPresentationError)
          .then(
            (value): ViewerAnswer =>
              value === undefined || value === null || value === "" ? "no error" : { error: String(value) },
            (): ViewerAnswer => "no answer"
          ),
        new Promise<ViewerAnswer>((resolve) => (timer = setTimeout(() => resolve("no answer"), VIEWER_ERROR_WAIT_MS))),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
