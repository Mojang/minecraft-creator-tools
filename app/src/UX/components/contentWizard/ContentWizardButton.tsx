import Box from "@mui/material/Box";
import IGalleryItem from "../../../app/IGalleryItem";

interface ContentWizardButtonProps {
  children?: React.ReactNode;
  enabled?: boolean;
  item: IGalleryItem | undefined;
  onNewItem: () => void;
  onExistingItem: (item: IGalleryItem) => void;
}

export default function ContentWizardButton(props: ContentWizardButtonProps) {
  const { children, enabled = true, item, onNewItem, onExistingItem } = props;

  return (
    <Box
      sx={{ opacity: enabled ? 1 : 0.25, cursor: enabled ? "pointer" : "not-allowed" }}
      role="button"
      tabIndex={enabled ? 0 : -1}
      className="cwiz-main-option"
      onClick={() => enabled && (item ? onExistingItem(item) : onNewItem())}
    >
      {children}
    </Box>
  );
}
