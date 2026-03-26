import { Box, Button, Card, CardActions, CardContent, Modal, Typography } from "@mui/material";
import { ReactNode, useState } from "react";

const style = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "80%",
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  pt: 2,
  px: 4,
  pb: 3,
};

interface ConfirmModalProps {
  children: ReactNode;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (() => void) | (() => Promise<void>);
}

export function ConfirmModal(props: ConfirmModalProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { children, title, onConfirm } = props;
  const cancelText = props.cancelText || "Cancel";
  const confirmText = props.confirmText || "Confirm";

  return (
    <Modal open={isOpen}>
      <Box sx={style}>
        <Card>
          <CardContent>
            {title && (
              <Typography variant="h2" color="secondary" gutterBottom>
                {title}
              </Typography>
            )}
            <Box>{children}</Box>
          </CardContent>
          <CardActions>
            <Button color="warning" variant="outlined" onClick={() => setIsOpen(false)}>
              {cancelText}
            </Button>
            <Button
              color="secondary"
              variant="outlined"
              onClick={() => {
                onConfirm();
                setIsOpen(false);
              }}
            >
              {confirmText}
            </Button>
          </CardActions>
        </Card>
      </Box>
    </Modal>
  );
}
