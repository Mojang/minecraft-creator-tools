// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * GlobalErrorOverlay — user-facing surface for uncaught errors.
 *
 * Two presentation modes:
 *   - Fatal: Rendered directly by GlobalErrorBoundary in place of the broken
 *            React subtree. Full-screen, non-dismissible until the user takes
 *            an explicit action.
 *   - Recoverable: Rendered as a sibling next to <App />. Listens to
 *                  ErrorService.onErrorReported and pops up an MUI Dialog for
 *                  window "error" / "unhandledrejection" events.
 *
 * Both modes share the same content layout:
 *   - Title + summary
 *   - "Show details" expando (message, stack, component stack, kind, timestamp)
 *   - Three actions:
 *       1. Save all          — calls ErrorService.runSaveAll()
 *       2. Continue (dismiss) — fatal: calls onReset; recoverable: hides dialog
 *       3. Report this error  — copies a self-contained payload to clipboard.
 *                               If clipboard isn't available, surfaces a failure
 *                               state and the user can use the GitHub report
 *                               button instead.
 *
 * All form controls are MUI components per repo standards.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faChevronUp, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import ErrorService, { CapturedError, ErrorSeverity } from "../../../core/ErrorService";
import { mcColors } from "../../hooks/theme/mcColors";

interface GlobalErrorOverlayProps {
  /** When provided, the overlay renders in fatal/full-screen mode for this error. */
  fatalError?: CapturedError;
  /** Called when the user dismisses a fatal error (boundary resets the subtree). */
  onReset?: () => void;
}

type SaveStatus = "idle" | "saving" | "success" | "failed";
type ReportStatus = "idle" | "copied" | "failed" | "github";

const ERROR_RED = "#c0392b";

/**
 * Categories for which we suppress the user-facing overlay (errors still flow
 * to telemetry — we just don't interrupt the user with a dialog the user
 * cannot meaningfully act on). Categorizers are registered in src/index.tsx.
 */
const BENIGN_CATEGORIES = new Set<string>([
  "browser-resizeobserver-loop",
]);

export default function GlobalErrorOverlay({ fatalError, onReset }: GlobalErrorOverlayProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Recoverable error currently shown in the dialog (driven by ErrorService events).
  const [recoverableError, setRecoverableError] = useState<CapturedError | undefined>();

  // Subscribe to non-fatal errors. Fatal errors arrive via the boundary, not this listener.
  useEffect(() => {
    if (fatalError) {
      // In fatal mode we don't also pop dialogs — the overlay owns the screen.
      return;
    }
    const handler = (_sender: unknown, err: CapturedError) => {
      if (err.severity === ErrorSeverity.recoverable) {
        // Skip the user-facing overlay for categories we know are benign vendor
        // / browser noise (still flow to telemetry via ErrorService.report —
        // the category is forwarded as the `errorCode` property). Add new
        // entries here when a categorizer in index.tsx tags something the user
        // cannot meaningfully act on.
        if (err.category && BENIGN_CATEGORIES.has(err.category)) {
          return;
        }
        // Only show one dialog at a time; newer errors replace older ones.
        setRecoverableError(err);
      }
    };
    ErrorService.onErrorReported.subscribe(handler);
    return () => {
      ErrorService.onErrorReported.unsubscribe(handler);
    };
  }, [fatalError]);

  // The error currently being displayed (fatal takes precedence).
  const activeError = fatalError ?? recoverableError;
  const isFatal = !!fatalError;

  if (!activeError) {
    return null;
  }

  const handleDismiss = () => {
    if (isFatal) {
      onReset?.();
    } else if (recoverableError) {
      ErrorService.dismiss(recoverableError.id);
      setRecoverableError(undefined);
    }
  };

  if (isFatal) {
    return (
      <Box
        role="alertdialog"
        aria-labelledby="global-error-title"
        aria-describedby="global-error-summary"
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 2000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isDark ? mcColors.gray6 : mcColors.gray1,
          color: isDark ? mcColors.white : mcColors.gray6,
          p: 3,
          overflow: "auto",
          "@media (forced-colors: active)": {
            backgroundColor: "Canvas",
            color: "CanvasText",
          },
        }}
      >
        <Box
          sx={{
            maxWidth: 720,
            width: "100%",
            backgroundColor: isDark ? mcColors.gray5 : mcColors.white,
            border: `1px solid ${isDark ? mcColors.gray4 : mcColors.gray3}`,
            p: 3,
            "@media (forced-colors: active)": {
              border: "1px solid CanvasText",
            },
          }}
        >
          <ErrorOverlayBody error={activeError} isDark={isDark} isFatal onDismiss={handleDismiss} />
        </Box>
      </Box>
    );
  }

  return (
    <Dialog
      open
      onClose={handleDismiss}
      maxWidth="sm"
      fullWidth
      aria-labelledby="global-error-title"
      aria-describedby="global-error-summary"
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            "@media (forced-colors: active)": { backgroundColor: "Canvas" },
          },
        },
      }}
      PaperProps={{
        sx: {
          backgroundColor: isDark ? mcColors.gray5 : mcColors.white,
          border: `1px solid ${isDark ? mcColors.gray4 : mcColors.gray3}`,
        },
      }}
    >
      <DialogTitle
        id="global-error-title"
        // Theme sets DialogTitle padding-bottom to 6px and MUI zeroes the
        // following DialogContent's padding-top with higher specificity than
        // sx — so we add the breathing room here on the title itself.
        sx={{ display: "flex", alignItems: "center", gap: 1, pb: 2 }}
      >
        <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: ERROR_RED }} />
        <Typography variant="h6" component="span" sx={{ flex: 1 }}>
          Something went wrong
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <ErrorOverlayBody
          error={activeError}
          isDark={isDark}
          isFatal={false}
          onDismiss={handleDismiss}
          renderActionsInline={false}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <ErrorOverlayActions error={activeError} isFatal={false} onDismiss={handleDismiss} />
      </DialogActions>
    </Dialog>
  );
}

/**
 * Shared body content used by both fatal and recoverable presentations.
 * In fatal mode the actions are part of the body so the layout flows naturally
 * inside the full-screen container; in recoverable mode the parent <Dialog>
 * places actions in <DialogActions> for proper MUI styling.
 */
function ErrorOverlayBody({
  error,
  isDark,
  isFatal,
  onDismiss,
  renderActionsInline = true,
}: {
  error: CapturedError;
  isDark: boolean;
  isFatal: boolean;
  onDismiss: () => void;
  renderActionsInline?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Stack spacing={2}>
      {isFatal && (
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FontAwesomeIcon icon={faTriangleExclamation} style={{ color: ERROR_RED, fontSize: 28 }} />
          <Typography id="global-error-title" variant="h5" component="h1">
            Something went wrong
          </Typography>
        </Stack>
      )}

      <Typography id="global-error-summary" variant="body1">
        {isFatal
          ? "An unexpected error stopped Minecraft Creator Tools from continuing. You can try to save your work and then continue, or copy the error details to help us investigate."
          : "Minecraft Creator Tools ran into an unexpected error. Your work should still be safe — you can save now to be sure, or dismiss this message and continue."}
      </Typography>

      <Box>
        <IconButton
          size="small"
          onClick={() => setShowDetails((v) => !v)}
          aria-expanded={showDetails}
          aria-controls="global-error-details"
          sx={{ p: 0.5, gap: 1, borderRadius: 0 }}
        >
          <FontAwesomeIcon icon={showDetails ? faChevronUp : faChevronDown} style={{ fontSize: 12 }} />
          <Typography variant="body2" component="span">
            {showDetails ? "Hide details" : "Show details"}
          </Typography>
        </IconButton>
        <Collapse in={showDetails} unmountOnExit>
          <Box
            id="global-error-details"
            component="pre"
            sx={{
              mt: 1,
              p: 1.5,
              backgroundColor: isDark ? mcColors.gray6 : mcColors.gray1,
              border: `1px solid ${isDark ? mcColors.gray4 : mcColors.gray3}`,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 12,
              maxHeight: 320,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              "@media (forced-colors: active)": {
                border: "1px solid CanvasText",
              },
            }}
          >
            {ErrorService.formatForReport(error)}
          </Box>
        </Collapse>
      </Box>

      {renderActionsInline && <ErrorOverlayActions error={error} isFatal={isFatal} onDismiss={onDismiss} />}
    </Stack>
  );
}

function ErrorOverlayActions({
  error,
  isFatal,
  onDismiss,
}: {
  error: CapturedError;
  isFatal: boolean;
  onDismiss: () => void;
}) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");
  const reportTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (reportTimeoutRef.current !== undefined) {
        window.clearTimeout(reportTimeoutRef.current);
      }
    };
  }, []);

  const handleSaveAll = useCallback(async () => {
    setSaveStatus("saving");
    const ok = await ErrorService.runSaveAll();
    setSaveStatus(ok ? "success" : "failed");
  }, []);

  const handleReport = useCallback(async () => {
    const payload = ErrorService.formatForReport(error);
    let copied = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        copied = true;
      }
    } catch {
      copied = false;
    }
    // No mailto fallback: there is no public-facing recipient address yet, so
    // opening the user's mail client without a target would not be actionable.
    // If clipboard isn't available we surface "failed" so the user can fall back
    // to the GitHub report button (which carries the payload via URL).
    setReportStatus(copied ? "copied" : "failed");
    if (reportTimeoutRef.current !== undefined) {
      window.clearTimeout(reportTimeoutRef.current);
    }
    reportTimeoutRef.current = window.setTimeout(() => setReportStatus("idle"), 3000);
  }, [error]);

  const handleReportOnGitHub = useCallback(async () => {
    // Copy the full payload to the clipboard first so the user can paste it
    // into the issue if the URL had to be truncated to fit GitHub's length cap.
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ErrorService.formatForReport(error));
      }
    } catch {
      // best-effort; opening the issue is the primary action
    }
    const url = ErrorService.buildGitHubIssueUrl(error);
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    setReportStatus("github");
    if (reportTimeoutRef.current !== undefined) {
      window.clearTimeout(reportTimeoutRef.current);
    }
    reportTimeoutRef.current = window.setTimeout(() => setReportStatus("idle"), 4000);
  }, [error]);

  const saveDisabled = !ErrorService.hasSaveAllHandler || saveStatus === "saving";

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ width: "100%", justifyContent: "flex-end", alignItems: { sm: "center" } }}
    >
      <Box sx={{ flex: 1, minHeight: 24 }}>
        {saveStatus === "saving" && <Typography variant="body2">Saving…</Typography>}
        {saveStatus === "success" && <Typography variant="body2">Saved.</Typography>}
        {saveStatus === "failed" && (
          <Typography variant="body2" sx={{ color: ERROR_RED }}>
            Save failed — see Log for details.
          </Typography>
        )}
        {reportStatus === "copied" && <Typography variant="body2">Error details copied to clipboard.</Typography>}
        {reportStatus === "github" && (
          <Typography variant="body2">Opened GitHub issue (full details also copied to your clipboard).</Typography>
        )}
        {reportStatus === "failed" && (
          <Typography variant="body2" sx={{ color: ERROR_RED }}>
            Could not copy error details.
          </Typography>
        )}
      </Box>
      <Button onClick={handleSaveAll} disabled={saveDisabled} variant="outlined">
        Save all
      </Button>
      <Button onClick={handleReport} variant="outlined">
        Copy details
      </Button>
      <Button
        onClick={handleReportOnGitHub}
        variant="outlined"
        startIcon={<FontAwesomeIcon icon={faGithub} />}
      >
        Report on GitHub
      </Button>
      <Button onClick={onDismiss} variant="contained" color="primary" autoFocus>
        {isFatal ? "Continue" : "Dismiss"}
      </Button>
    </Stack>
  );
}
