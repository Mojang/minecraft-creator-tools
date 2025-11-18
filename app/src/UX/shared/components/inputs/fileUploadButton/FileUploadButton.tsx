import * as React from "react";
import { styled } from "@mui/material/styles";
import Button from "@mui/material/Button";
import { ChangeEvent, ReactNode } from "react";

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});

interface FileUploadButtonProps {
  children?: ReactNode;
  onFileSelect?: (event: ChangeEvent<HTMLInputElement>) => void;
}
export default function FileUploadButton({ children, onFileSelect }: FileUploadButtonProps) {
  return (
    <Button component="label" role={undefined} variant="contained" tabIndex={-1}>
      {children}
      <VisuallyHiddenInput onChange={onFileSelect} type="file" className="file-upload" />
    </Button>
  );
}
