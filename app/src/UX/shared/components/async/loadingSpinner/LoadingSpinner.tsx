import Box, { BoxProps } from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

export default function LoadingSpinner(props: BoxProps) {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" {...props}>
      <CircularProgress color="inherit" />
    </Box>
  );
}
