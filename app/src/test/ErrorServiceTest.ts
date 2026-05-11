// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { expect } from "chai";
import ErrorService, { ErrorKind, ErrorSeverity } from "../core/ErrorService";

describe("ErrorService", function () {
  // Snapshot/restore filter list and save handler so tests don't pollute one another.
  // ErrorService is a module-level singleton, so we have to be defensive between specs.
  const _serviceAny = ErrorService as any;
  let _filterBackup: unknown[];
  let _saveBackup: unknown;

  beforeEach(function () {
    _filterBackup = [..._serviceAny._filters];
    _saveBackup = _serviceAny._saveAllHandler;
    _serviceAny._filters.length = 0;
    _serviceAny._saveAllHandler = undefined;
    ErrorService.dismissAll();
  });

  afterEach(function () {
    _serviceAny._filters.length = 0;
    _serviceAny._filters.push(...(_filterBackup as any[]));
    _serviceAny._saveAllHandler = _saveBackup;
    ErrorService.dismissAll();
  });

  describe("report()", function () {
    it("captures the error and assigns id + timestamp", function () {
      const captured = ErrorService.report({
        kind: ErrorKind.windowError,
        severity: ErrorSeverity.recoverable,
        message: "boom",
      });
      expect(captured).to.exist;
      expect(captured!.id).to.be.a("number");
      expect(captured!.timestamp).to.be.instanceOf(Date);
      expect(captured!.message).to.equal("boom");
      expect(ErrorService.errors).to.have.lengthOf(1);
    });

    it("dispatches onErrorReported to subscribers", function () {
      let received: any = undefined;
      const handler = (_s: unknown, e: any) => {
        received = e;
      };
      ErrorService.onErrorReported.subscribe(handler);
      try {
        ErrorService.report({
          kind: ErrorKind.unhandledRejection,
          severity: ErrorSeverity.recoverable,
          message: "rejected",
        });
        expect(received).to.exist;
        expect(received.message).to.equal("rejected");
        expect(received.kind).to.equal(ErrorKind.unhandledRejection);
      } finally {
        ErrorService.onErrorReported.unsubscribe(handler);
      }
    });

    it("substitutes a placeholder message when none provided", function () {
      const captured = ErrorService.report({
        kind: ErrorKind.windowError,
        severity: ErrorSeverity.recoverable,
        message: "",
      });
      expect(captured).to.exist;
      expect(captured!.message).to.equal("(no message)");
    });
  });

  describe("filters", function () {
    it("suppresses errors that match a filter", function () {
      ErrorService.addFilter((e) => e.message.includes("ignore-me"));
      const captured = ErrorService.report({
        kind: ErrorKind.windowError,
        severity: ErrorSeverity.recoverable,
        message: "please ignore-me",
      });
      expect(captured).to.equal(undefined);
      expect(ErrorService.errors).to.have.lengthOf(0);
    });

    it("treats a throwing filter as 'do not suppress' (over-report rather than drop)", function () {
      ErrorService.addFilter(() => {
        throw new Error("filter blew up");
      });
      const captured = ErrorService.report({
        kind: ErrorKind.windowError,
        severity: ErrorSeverity.recoverable,
        message: "still important",
      });
      expect(captured).to.exist;
      expect(ErrorService.errors).to.have.lengthOf(1);
    });
  });

  describe("recursion guard", function () {
    it("does not re-enter report() if a subscriber throws and re-reports", function () {
      let dispatchCount = 0;
      const handler = () => {
        dispatchCount++;
        // Try to re-enter; the guard should refuse this nested call.
        ErrorService.report({
          kind: ErrorKind.windowError,
          severity: ErrorSeverity.recoverable,
          message: "nested",
        });
      };
      ErrorService.onErrorReported.subscribe(handler);
      try {
        ErrorService.report({
          kind: ErrorKind.windowError,
          severity: ErrorSeverity.recoverable,
          message: "outer",
        });
        // Outer is captured + dispatched once. Nested call returns undefined, so no
        // additional dispatch occurs.
        expect(dispatchCount).to.equal(1);
        expect(ErrorService.errors).to.have.lengthOf(1);
      } finally {
        ErrorService.onErrorReported.unsubscribe(handler);
      }
    });
  });

  describe("save handler", function () {
    it("returns false when no handler is registered", async function () {
      const ok = await ErrorService.runSaveAll();
      expect(ok).to.equal(false);
      expect(ErrorService.hasSaveAllHandler).to.equal(false);
    });

    it("invokes the registered handler and reports success", async function () {
      let called = false;
      ErrorService.setSaveAllHandler(async () => {
        called = true;
      });
      expect(ErrorService.hasSaveAllHandler).to.equal(true);
      const ok = await ErrorService.runSaveAll();
      expect(called).to.equal(true);
      expect(ok).to.equal(true);
    });

    it("swallows handler exceptions and returns false", async function () {
      ErrorService.setSaveAllHandler(async () => {
        throw new Error("disk full");
      });
      const ok = await ErrorService.runSaveAll();
      expect(ok).to.equal(false);
    });
  });

  describe("dismiss / dismissAll", function () {
    it("removes a single error by id", function () {
      const a = ErrorService.report({ kind: ErrorKind.windowError, severity: ErrorSeverity.recoverable, message: "a" });
      const b = ErrorService.report({ kind: ErrorKind.windowError, severity: ErrorSeverity.recoverable, message: "b" });
      expect(ErrorService.errors).to.have.lengthOf(2);
      ErrorService.dismiss(a!.id);
      expect(ErrorService.errors).to.have.lengthOf(1);
      expect(ErrorService.errors[0].id).to.equal(b!.id);
    });

    it("clears all errors", function () {
      ErrorService.report({ kind: ErrorKind.windowError, severity: ErrorSeverity.recoverable, message: "a" });
      ErrorService.report({ kind: ErrorKind.windowError, severity: ErrorSeverity.recoverable, message: "b" });
      ErrorService.dismissAll();
      expect(ErrorService.errors).to.have.lengthOf(0);
    });
  });

  describe("formatForReport()", function () {
    it("includes the kind, message, and stack when present", function () {
      const captured = ErrorService.report({
        kind: ErrorKind.reactRender,
        severity: ErrorSeverity.fatal,
        message: "React went sideways",
        stack: "Error: React went sideways\n  at Component (file.tsx:1:1)",
        componentStack: "in <Foo>\n  in <Bar>",
      });
      expect(captured).to.exist;
      const text = ErrorService.formatForReport(captured!);
      expect(text).to.include("Kind:    reactRender");
      expect(text).to.include("Message: React went sideways");
      expect(text).to.include("Component stack:");
      expect(text).to.include("Stack:");
    });
  });

  describe("buildGitHubIssueUrl()", function () {
    it("targets the public Mojang/minecraft-creator-tools repo", function () {
      const captured = ErrorService.report({
        kind: ErrorKind.windowError,
        severity: ErrorSeverity.recoverable,
        message: "boom",
      });
      const url = ErrorService.buildGitHubIssueUrl(captured!);
      expect(url).to.match(/^https:\/\/github\.com\/Mojang\/minecraft-creator-tools\/issues\/new\?/);
      expect(url).to.include("title=");
      expect(url).to.include("body=");
    });

    it("URL-encodes the title and body so special characters survive", function () {
      const captured = ErrorService.report({
        kind: ErrorKind.windowError,
        severity: ErrorSeverity.recoverable,
        message: "Error & < > #1",
      });
      const url = ErrorService.buildGitHubIssueUrl(captured!);
      // & must be encoded in the title (it's a query separator).
      expect(url).to.include(encodeURIComponent("Error & < > #1"));
    });

    it("trims oversized stacks so the URL stays under the safe length cap", function () {
      const hugeStack = "Error: huge\n" + "  at frame (file.ts:1:1)\n".repeat(2000);
      const captured = ErrorService.report({
        kind: ErrorKind.reactRender,
        severity: ErrorSeverity.fatal,
        message: "huge",
        stack: hugeStack,
      });
      const url = ErrorService.buildGitHubIssueUrl(captured!);
      expect(url.length).to.be.at.most(7500);
      // Truncation note should be in the body when the stack was dropped.
      expect(decodeURIComponent(url)).to.include("Stack trace was too long");
    });
  });
});
