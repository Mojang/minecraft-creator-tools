import { Box, BoxProps } from "@mui/material";
import { ReactNode } from "react";

interface FlexBoxProps extends BoxProps {
  column?: boolean;
  children?: ReactNode;
}

export default function FlexBox({ column, children, ...props }: FlexBoxProps) {
  props = {
    display: "flex",
    flexDirection: !!column ? "column" : "row",
    flexGrow: 1,
    alignContent: "center",
    gap: "1em",
    ...props,
  };

  return <Box {...props}>{children}</Box>;
}
