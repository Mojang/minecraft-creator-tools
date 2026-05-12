// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * GlobalErrorBoundary — top-level React error boundary.
 *
 * Catches render/lifecycle errors anywhere in the React tree, reports them to
 * ErrorService with severity=fatal, and replaces the broken subtree with the
 * full-screen GlobalErrorOverlay. This is the *only* way to safely recover
 * from a React render error: the broken subtree must not be rendered again
 * until reset() is called (otherwise React will throw on every render).
 *
 * For non-render errors (window "error" / "unhandledrejection") we use the
 * lighter dialog mode of GlobalErrorOverlay rendered as a sibling to App,
 * not via this boundary.
 *
 * reset():
 *   - Clears the boundary's hasFatalError flag.
 *   - Bumps a `resetKey` so children remount with a fresh subtree (avoiding
 *     stale state that may have triggered the original throw).
 *   - Dismisses the captured error from ErrorService.
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import ErrorService, { CapturedError, ErrorKind, ErrorSeverity } from "../../../core/ErrorService";
import GlobalErrorOverlay from "./GlobalErrorOverlay";

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

interface GlobalErrorBoundaryState {
  hasFatalError: boolean;
  capturedError?: CapturedError;
  /** Bumped on reset() so children remount with fresh state. */
  resetKey: number;
}

export default class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  constructor(props: GlobalErrorBoundaryProps) {
    super(props);
    this.state = { hasFatalError: false, resetKey: 0 };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(): Partial<GlobalErrorBoundaryState> {
    // Flag the boundary immediately so the broken subtree is not re-rendered
    // before componentDidCatch runs.
    return { hasFatalError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const captured = ErrorService.report({
      kind: ErrorKind.reactRender,
      severity: ErrorSeverity.fatal,
      message: error?.message ?? "React render error",
      stack: error?.stack,
      componentStack: errorInfo?.componentStack ?? undefined,
    });

    if (captured) {
      this.setState({ capturedError: captured });
    }
  }

  reset(): void {
    const id = this.state.capturedError?.id;
    if (id !== undefined) {
      ErrorService.dismiss(id);
    }
    this.setState((prev) => ({
      hasFatalError: false,
      capturedError: undefined,
      resetKey: prev.resetKey + 1,
    }));
  }

  render(): ReactNode {
    if (this.state.hasFatalError) {
      return <GlobalErrorOverlay fatalError={this.state.capturedError} onReset={this.reset} />;
    }

    // Use the resetKey to force a fresh mount of the subtree after reset(),
    // so we don't re-throw against stale state.
    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}
