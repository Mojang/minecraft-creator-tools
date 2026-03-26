import Box from "@mui/material/Box";

interface TabPanelProps {
  children?: React.ReactNode;
  id: string | number;
  current: string | number;
  keepMounted?: boolean;
}

export default function TabPanel({ id, current, children, keepMounted, ...props }: TabPanelProps) {
  const active = current === id;
  const isMounted = active || keepMounted;
  return (
    <div role="tabpanel" hidden={!active} id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`} {...props}>
      {isMounted && <Box sx={{ p: 0 }}>{children}</Box>}
    </div>
  );
}
