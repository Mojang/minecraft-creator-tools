import Box from "@mui/material/Box";

interface TabPanelProps {
  children?: React.ReactNode;
  id: string | number;
  current: string | number;
}

export default function TabPanel({ id, current, children, ...props }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={current !== id} id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} {...props}>
      {current === id && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );
}
