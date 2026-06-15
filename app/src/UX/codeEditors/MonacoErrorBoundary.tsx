import { Component, ErrorInfo, ReactNode } from "react";
import Log from "../../core/Log";

interface MonacoErrorBoundaryProps {
  children: ReactNode;
}

interface MonacoErrorBoundaryState {
  hasError: boolean;
  retryKey: number;
  retryCount: number;
  giveUp: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

/**
 * Lightweight error boundary for Monaco Editor components.
 *
 * Monaco can crash internally (e.g. "G.create is not a function" in
 * PieceTreeTextBuffer, AMD loader failures, or circular-init issues in
 * the production Vite bundle) and those errors propagate through
 * @monaco-editor/react as React render errors. Without a local boundary
 * they reach GlobalErrorBoundary and take down the entire app.
 *
 * This boundary silently absorbs the crash, logs it once, and auto-retries
 * after a short delay so the editor has a second chance to mount once the
 * Monaco AMD loader has finished initialising.
 *
 * Retries are capped at MAX_RETRIES to avoid an infinite re-throw → setTimeout
 * loop on deterministic failures (corrupt model state, permanent AMD load
 * failure). After the cap is hit a visible fallback is rendered so the user
 * knows the editor failed and can reopen the file.
 *
 * The non-error render uses a block-level <div> wrapper (not <span>): Monaco
 * editors are block-level and size to their container, so an inline parent
 * is invalid HTML and risks layout regressions (especially for DiffEditor).
 */
export default class MonacoErrorBoundary extends Component<MonacoErrorBoundaryProps, MonacoErrorBoundaryState> {
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: MonacoErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryKey: 0, retryCount: 0, giveUp: false };
  }

  static getDerivedStateFromError(): Partial<MonacoErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const nextRetryCount = this.state.retryCount + 1;
    const willGiveUp = nextRetryCount > MAX_RETRIES;

    Log.debug(
      "MonacoErrorBoundary: Code editor crashed" +
        (willGiveUp ? " (giving up after " + MAX_RETRIES + " retries)" : " (will auto-retry)") +
        ": " +
        (error?.message ?? "unknown") +
        (errorInfo?.componentStack ? "\nComponent stack: " + errorInfo.componentStack : "")
    );

    if (willGiveUp) {
      this.setState({ giveUp: true });
      return;
    }

    // Auto-retry after a short delay — gives Monaco's AMD loader time to
    // finish if the crash was a timing/init-order issue.
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.setState((prev) => ({
        hasError: false,
        retryKey: prev.retryKey + 1,
        retryCount: prev.retryCount + 1,
      }));
    }, RETRY_DELAY_MS);
  }

  componentWillUnmount(): void {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
    }
  }

  render(): ReactNode {
    if (this.state.giveUp) {
      return (
        <div
          style={{
            width: "100%",
            minHeight: 100,
            padding: "12px 16px",
            fontStyle: "italic",
            opacity: 0.75,
          }}
        >
          Editor failed to load — please close and reopen this file.
        </div>
      );
    }

    if (this.state.hasError) {
      // Render an empty placeholder the same size as the editor area.
      // The auto-retry in componentDidCatch will re-mount the children shortly.
      return <div style={{ width: "100%", minHeight: 100 }} />;
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
