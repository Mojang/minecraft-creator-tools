import { faChevronCircleDown, faChevronCircleUp, faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Accordion, AccordionDetails, Box, Button, Link, Typography } from "@mui/material";
import { ReactNode, useState } from "react";
import { getFullKey, Hierarchy } from "../../shared/components/SchemaForm/SchemaParser";
import FlexBox from "../../shared/components/layout/FlexBox";
import mcColors from "../../hooks/theme/mcColors";
import * as formatter from "../../../formEditor/FormFormatting";

const renderHierarchyTitles = (hierarchy: Hierarchy, seperator: string = ">") => {
  return hierarchy.map((entry, index) => (
    <span key={index}>
      <Link color={mcColors.white} href={"#" + getFullKey(hierarchy, index)}>
        {" "}
        {formatter.normalizeTitle(entry.title)}
      </Link>{" "}
      {index !== hierarchy.length - 1 && seperator}{" "}
    </span>
  ));
};

interface FormAccordianProps {
  children?: ReactNode;
  onRemove?: () => void;
  onAdd?: () => void;
  hierarchy: Hierarchy;
  hideByDefault?: boolean;
  titleSize?: "default" | "small";
}
export default function FormAccordian(props: FormAccordianProps) {
  const { children, hierarchy, onRemove, onAdd, hideByDefault, titleSize } = props;
  const [isExpanded, setIsExpanded] = useState(!hideByDefault);
  return (
    <Accordion id={getFullKey(hierarchy)} expanded={isExpanded} sx={{ m: 0, pr: 0, boxShadow: 1 }}>
      <FlexBox m={0} justifyContent="space-between" borderRadius={1} bgcolor={mcColors.gray4}>
        <FlexBox pl={2} m={0} alignItems="center">
          {onRemove && (
            <Box>
              <Button color="warning" variant="outlined" onClick={onRemove}>
                -
              </Button>
            </Box>
          )}
          <Box py={1.5}>
            {titleSize === "small" ? (
              <Typography variant="h4" color={mcColors.white}>
                {renderHierarchyTitles(hierarchy)}
              </Typography>
            ) : (
              <Typography variant="h3">{renderHierarchyTitles(hierarchy)}</Typography>
            )}
          </Box>
        </FlexBox>

        <Box px={2} mt={2} mr={0} onClick={() => setIsExpanded((prev) => !prev)}>
          <FontAwesomeIcon icon={isExpanded ? faChevronCircleUp : faChevronCircleDown} size="lg" />
        </Box>
      </FlexBox>
      <AccordionDetails sx={{ px: 0 }}>
        <FlexBox column>
          <Box>{children}</Box>{" "}
          {onAdd && (
            <FlexBox justifyContent="center" px={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<FontAwesomeIcon icon={faPlus} size="lg" />}
                onClick={onAdd}
              >
                Add Item to {hierarchy[hierarchy.length - 1]?.title || "list"}
              </Button>
            </FlexBox>
          )}
        </FlexBox>
      </AccordionDetails>
    </Accordion>
  );
}
