import { CardContent, Typography, CardActions, Button } from "@mui/material";
import Box from "@mui/material/Box/Box";
import Card from "@mui/material/Card/Card";
import Modal from "@mui/material/Modal/Modal";
import { useState } from "react";
import { Definition, FullDefinition, isSchemaDefinition } from "./SchemaParser";
import { OneOfChoice } from "./UISchema";
import { normalizeTitle } from "../../../../formEditor/FormFormatting";
import FlexBox from "../layout/FlexBox";

interface OneOfModalProps {
  title?: string;
  options: FullDefinition[];
  optionDefinitions?: OneOfChoice[];
  onSelect: (selected: Definition) => void;
}

export default function OneOfModal({ title, options, optionDefinitions, onSelect }: OneOfModalProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Modal open={isOpen}>
      <Box sx={style}>
        <Card>
          <CardContent>
            <Typography variant="h2" color="secondary" gutterBottom>
              {title || "Select Option:"}
            </Typography>
            <FlexBox column>
              {options
                .filter(isSchemaDefinition)
                .map((option, i) => [option, optionDefinitions?.[i]] as const)
                .filter(([, uiDef]) => uiDef?.hidden !== true)
                .map(([option, uiDef], i) => (
                  <FlexBox key={i}>
                    <Box>
                      <Button
                        variant="outlined"
                        color="secondary"
                        onClick={() => {
                          onSelect(option);
                          setIsOpen(false);
                        }}
                      >
                        Select
                      </Button>
                    </Box>
                    <Box>
                      {uiDef?.title ||
                        (option.title && normalizeTitle(option.title)) ||
                        (typeof option.type === "string" && normalizeTitle(option.type))}
                    </Box>
                  </FlexBox>
                ))}
            </FlexBox>
          </CardContent>
          <CardActions>
            <FlexBox justifyContent="flex-end" pr={8}>
              <Button color="warning" variant="outlined" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
            </FlexBox>
          </CardActions>
        </Card>
      </Box>
    </Modal>
  );
}

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
