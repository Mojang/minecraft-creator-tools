import Box from "@mui/material/Box";
import { ReactNode, useState } from "react";

interface FileDropAreaProps {
  children: ReactNode;
  onFileDrop: (files: File[], e: React.DragEvent<HTMLDivElement>) => void;
}

export default function FileDropArea({ children, onFileDrop }: FileDropAreaProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // needed so `onDrop` will fire
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFileDrop(files, e);
    }
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      sx={(theme) => {
        const isDark = theme.palette.mode === "dark";
        return {
          border: "3px dashed",
          borderColor: isDragging
            ? isDark
              ? "#5cff5c"
              : "#2e7d32"
            : isDark
            ? "rgba(255,255,255,0.3)"
            : "rgba(0,0,0,0.2)",
          borderRadius: 1,
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
      {children}
    </Box>
  );
}
