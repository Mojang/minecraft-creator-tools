import Box from "@mui/material/Box";
import { ReactNode, useState } from "react";

interface FileDropAreaProps {
  children: ReactNode;
  onFileDrop: (files: File[], e: React.DragEvent<HTMLDivElement>) => void;
  ariaLabel?: string;
}

export default function FileDropArea({ children, onFileDrop, ariaLabel }: FileDropAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  const hasDraggedFiles = (e: React.DragEvent<HTMLDivElement>): boolean => {
    const dataTransfer = e.dataTransfer;

    if (!dataTransfer) {
      return false;
    }

    const dataTypes: any = dataTransfer.types;
    const hasFilesType =
      !!dataTypes &&
      ((typeof dataTypes.contains === "function" && dataTypes.contains("Files")) ||
        (typeof dataTypes.includes === "function" && dataTypes.includes("Files")));

    if (!hasFilesType) {
      return false;
    }

    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        if (dataTransfer.items[i]?.kind === "file") {
          return true;
        }
      }
      return false;
    }

    return !!(dataTransfer.files && dataTransfer.files.length > 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Only activate for actual file drags; ignore text selections and internal drags.
    if (!hasDraggedFiles(e)) {
      if (isDragging) {
        setIsDragging(false);
      }
      return;
    }

    e.preventDefault(); // needed so `onDrop` will fire
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(e)) {
      setIsDragging(false);
      return;
    }

    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFileDrop(files, e);
    }
  };

  return (
    <Box
      role={ariaLabel ? "region" : undefined}
      aria-label={ariaLabel}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={(theme) => {
        const isDark = theme.palette.mode === "dark";
        return {
          position: "relative",
          border: "2px dashed",
          borderColor: isDragging
            ? isDark
              ? "#5cff5c"
              : "#2e7d32"
            : isDark
              ? "rgba(82, 165, 53, 0.3)"
              : "rgba(62, 136, 40, 0.3)",
          borderRadius: "2px",
          p: 2,
          textAlign: "center",
          bgcolor: isDragging
            ? isDark
              ? "rgba(92, 255, 92, 0.1)"
              : "rgba(46, 125, 50, 0.1)"
            : isDark
              ? "rgba(0,0,0,0.2)"
              : "rgba(0,0,0,0.03)",
          transition: "all 0.15s ease-in-out",
          cursor: "pointer",
          imageRendering: "pixelated",
          backgroundImage: isDragging
            ? "none"
            : `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                ${isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)"} 2px,
                ${isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)"} 4px
              )`,
          "&:hover": {
            borderColor: isDark ? "#5cff5c" : "#2e7d32",
            bgcolor: isDark ? "rgba(92, 255, 92, 0.05)" : "rgba(46, 125, 50, 0.05)",
          },
        };
      }}
    >
      {isDragging && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            pointerEvents: "none",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark" ? "rgba(0, 0, 0, 0.72)" : "rgba(255, 255, 255, 0.86)",
            fontSize: "1.1rem",
            fontWeight: 600,
            color: (theme) => (theme.palette.mode === "dark" ? "#5cff5c" : "#2e7d32"),
          }}
        >
          Drop files here
        </Box>
      )}
      <Box sx={{ visibility: isDragging ? "hidden" : "visible" }}><Box sx={{ opacity: isDragging ? 0.2 : 1, transition: "opacity 0.1s ease-out" }}>{children}</Box></Box>
    </Box>
  );
}
