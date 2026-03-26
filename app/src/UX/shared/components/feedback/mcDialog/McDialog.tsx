/**
 * McDialog - Material UI Dialog wrapper for Northstar migration
 *
 * This component provides a similar API to Northstar's Dialog component
 * while using Material UI under the hood.
 *
 * @see docs/NorthstarToMuiMigration.md
 *
 * Migration from Northstar:
 * ```tsx
 * // Before (Northstar)
 * import { Dialog } from "@fluentui/react-northstar";
 * <Dialog
 *   open={isOpen}
 *   header="Title"
 *   content={<Content />}
 *   cancelButton="Cancel"
 *   confirmButton="OK"
 *   onCancel={handleCancel}
 *   onConfirm={handleConfirm}
 * />
 *
 * // After (McDialog)
 * import McDialog from "./McDialog";
 * <McDialog
 *   open={isOpen}
 *   title="Title"
 *   cancelButton="Cancel"
 *   confirmButton="OK"
 *   onCancel={handleCancel}
 *   onConfirm={handleConfirm}
 * >
 *   <Content />
 * </McDialog>
 * ```
 */

import React, { ReactNode } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, IconButton, useTheme, Box } from "@mui/material";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { mcColors } from "../../../../hooks/theme/mcColors";
import McButton from "../../inputs/mcButton/McButton";

interface McDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Dialog title/header */
  title?: ReactNode;
  /** Dialog content (children) */
  children?: ReactNode;
  /** Cancel button text (set to empty string to hide) */
  cancelButton?: string;
  /** Confirm button text (set to empty string to hide) */
  confirmButton?: string;
  /** Callback when cancel button is clicked or dialog is closed */
  onCancel?: () => void;
  /** Callback when confirm button is clicked */
  onConfirm?: () => void;
  /** Whether to show the close (X) button in the title */
  showCloseButton?: boolean;
  /** Whether clicking the backdrop closes the dialog */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes the dialog */
  closeOnEscape?: boolean;
  /** Dialog max width */
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  /** Whether the dialog should be full width up to maxWidth */
  fullWidth?: boolean;
  /** Whether the confirm button is disabled */
  confirmDisabled?: boolean;
  /** Whether the cancel button is disabled */
  cancelDisabled?: boolean;
  /** Additional actions to render in the footer */
  additionalActions?: ReactNode;
  /** Footer content (replaces default buttons if provided) */
  footer?: ReactNode;
  /** Header content (added after title) */
  headerContent?: ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Custom styles for the dialog paper */
  sx?: object;
  /** Aria describedby for accessibility */
  "aria-describedby"?: string;
}

/**
 * McDialog - A Material UI-based dialog component
 *
 * Replaces Northstar's Dialog with a similar API.
 */
export default function McDialog({
  open,
  title,
  children,
  cancelButton = "Cancel",
  confirmButton = "OK",
  onCancel,
  onConfirm,
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  maxWidth = "sm",
  fullWidth = true,
  confirmDisabled = false,
  cancelDisabled = false,
  additionalActions,
  footer,
  headerContent,
  className,
  sx,
  "aria-describedby": ariaDescribedBy,
}: McDialogProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const handleClose = (event: object, reason: "backdropClick" | "escapeKeyDown") => {
    if (reason === "backdropClick" && !closeOnBackdropClick) {
      return;
    }
    if (reason === "escapeKeyDown" && !closeOnEscape) {
      return;
    }
    onCancel?.();
  };

  const hasFooter = footer || cancelButton || confirmButton || additionalActions;

  const titleId = "mc-dialog-title";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      className={className}
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={ariaDescribedBy}
      slotProps={{
        backdrop: {
          sx: { backgroundColor: "rgba(0, 0, 0, 0.85)" },
        },
      }}
      PaperProps={{
        sx: {
          backgroundColor: isDark ? mcColors.gray5 : mcColors.white,
          border: `1px solid ${isDark ? mcColors.gray4 : mcColors.gray3}`,
          ...sx,
        },
      }}
    >
      {(title || showCloseButton || headerContent) && (
        <DialogTitle
          id={titleId}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${isDark ? mcColors.gray4 : mcColors.gray3}`,
            py: 1.5,
            px: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
            {title}
            {headerContent}
          </Box>
          {showCloseButton && (
            <IconButton
              onClick={onCancel}
              size="small"
              aria-label="Close dialog"
              sx={{
                color: isDark ? mcColors.gray3 : mcColors.gray4,
                "&:hover": {
                  color: isDark ? mcColors.white : mcColors.gray6,
                },
              }}
            >
              <FontAwesomeIcon icon={faTimes} />
            </IconButton>
          )}
        </DialogTitle>
      )}

      <DialogContent
        sx={{
          py: 2,
          px: 2,
        }}
      >
        {children}
      </DialogContent>

      {hasFooter && (
        <DialogActions
          sx={{
            borderTop: `1px solid ${isDark ? mcColors.gray4 : mcColors.gray3}`,
            px: 2,
            py: 1.5,
          }}
        >
          {footer ? (
            footer
          ) : (
            <>
              {additionalActions}
              {cancelButton && (
                <McButton variant="stone" onClick={onCancel} disabled={cancelDisabled}>
                  {cancelButton}
                </McButton>
              )}
              {confirmButton && (
                <McButton variant="green" onClick={onConfirm} disabled={confirmDisabled}>
                  {confirmButton}
                </McButton>
              )}
            </>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}
