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

const renderLeafTitle = (hierarchy: Hierarchy) => {
  const leaf = hierarchy[hierarchy.length - 1];
  if (!leaf) return null;
  return <span>{formatter.normalizeTitle(leaf.title)}</span>;
};

interface FormAccordianProps {
  children?: ReactNode;
  onRemove?: () => void;
  onAdd?: () => void;
  hierarchy: Hierarchy;
  hideByDefault?: boolean;
  titleSize?: "default" | "small";
  /** When true, show full breadcrumb trail. When false (default), show only the leaf title. */
  showBreadcrumbs?: boolean;
}
export default function FormAccordian(props: FormAccordianProps) {
  const { children, hierarchy, onRemove, onAdd, hideByDefault, titleSize, showBreadcrumbs } = props;
  const [isExpanded, setIsExpanded] = useState(!hideByDefault);

  const titleContent = showBreadcrumbs ? renderHierarchyTitles(hierarchy) : renderLeafTitle(hierarchy);
  const isSmall = titleSize === "small";

  return (
    <Accordion id={getFullKey(hierarchy)} expanded={isExpanded} sx={{ m: 0, pr: 0, boxShadow: 1 }}>
      <FlexBox m={0} justifyContent="space-between" borderRadius={1} bgcolor={mcColors.gray4}>
        <FlexBox pl={2} m={0} alignItems="center">
          {onRemove && (
            <Box>
              <Button color="warning" variant="outlined" onClick={onRemove} size="small">
                -
              </Button>
            </Box>
          )}
          <Box py={1}>
            <Typography
              component="div"
              sx={{
                fontSize: isSmall ? "11pt" : "12pt",
                fontWeight: 600,
                letterSpacing: "0.2px",
                color: mcColors.white,
              }}
            >
              {titleContent}
            </Typography>
          </Box>
        </FlexBox>

        <Box px={2} mt={1.5} mr={0} onClick={() => setIsExpanded((prev) => !prev)} sx={{ cursor: "pointer" }}>
          <FontAwesomeIcon icon={isExpanded ? faChevronCircleUp : faChevronCircleDown} size="lg" />
        </Box>
      </FlexBox>
      <AccordionDetails sx={{ px: 0 }}>
        <FlexBox column>
          <Box>{children}</Box>{" "}
          {onAdd && (
            <FlexBox px={2} py={0.5}>
              <Button
                size="small"
                variant="contained"
                startIcon={<FontAwesomeIcon icon={faPlus} />}
                onClick={onAdd}
                sx={{
                  backgroundColor: "#3d7a2a",
                  "&:hover": { backgroundColor: "#4a9432" },
                  "&:active": { backgroundColor: "#2a641c" },
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "12px",
                  px: 2,
                }}
              >
                Add
              </Button>
            </FlexBox>
          )}
        </FlexBox>
      </AccordionDetails>
    </Accordion>
  );
}
