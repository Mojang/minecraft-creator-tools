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
      sx={{
        border: "2px dashed",
        borderColor: isDragging ? "primary.main" : "grey.400",
        borderRadius: 2,
        p: 1,
        textAlign: "center",
        bgcolor: isDragging ? "action.hover" : "background.paper",
        transition: "all 0.2s ease-in-out",
        // cursor: "pointer",
      }}
    >
      {children}
    </Box>
  );
}
