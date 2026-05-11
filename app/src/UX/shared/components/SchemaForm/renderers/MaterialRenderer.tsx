import FormControl from "@mui/material/FormControl";
import FlexBox from "../../layout/FlexBox";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import {
  Box,
  Button,
  FormHelperText,
  IconButton,
  Input,
  MenuItem,
  Modal,
  Paper,
  Slider,
  Switch,
  TextField,
} from "@mui/material";
import FormAccordian from "../../../../components/formEditor/FormAccordion";
import { Context, Definition, Property } from "../SchemaParser";
import { UIDefinition } from "../UISchema";
import { PropertyOptions } from "../UseSchemaForm";
import * as formatter from "../../../../../formEditor/FormFormatting";
import LoadingSpinner from "../../async/loadingSpinner/LoadingSpinner";
import { ReactNode } from "react";
import mcColors from "../../../../hooks/theme/mcColors";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faXmark } from "@fortawesome/free-solid-svg-icons";
import "../SchemaForm.css";

const PropertyPaddingH = 2;

type ValidationEvent = (newValue: string, key: string) => void;
type PropertyGeneratorEvent = (p: Property, c: Context, options?: PropertyOptions) => ReactNode;
type SelectRenderArgs = {
  element: ElementDef;
  options: unknown[];
  onChange: (value: unknown) => void;
};
type SchemaRenderArgs = {
  title: string;
  properties: Property[];
  context: Context;
  generateProperty: PropertyGeneratorEvent;
  isExporting: boolean;
  exportToJsonFile: () => Promise<void>;
  hideRootTitle?: boolean;
};
type PropRenderArgs = {
  element: ElementDef;
  type: string;
  handleValidation: ValidationEvent;
  uiDef?: UIDefinition | null;
};
type ObjectRenderArgs = {
  properties: Property[];
  uiDef: UIDefinition | null;
  context: Context;
  generateProperty: PropertyGeneratorEvent;
};

type ArrayRenderArgs = {
  element: ElementDef;
  itemsDefinition: Definition;
  rows: unknown[];
  definition: UIDefinition | null;
  context: Context;
  generateProperty: PropertyGeneratorEvent;
  addArrayValue: () => void;
  removeArrayValue: (index: number) => void;
  rowTransformer: (index: number, definition: Definition, context: Context) => { index: number; context: Context };
};

type CheckBoxRenderArgs = {
  element: ElementDef;
  value: boolean;
  onChange: (value: boolean) => void;
};

export type ElementDef = {
  key: string;
  title: string;
  description?: string;
  hidden?: boolean;
  isRequired?: boolean;
  validationErrorMessage?: string | null;
  min?: number;
  max?: number;
  default?: unknown;
  value?: unknown;
};

/* Helper: renders the default value hint below a field */
function renderDefaultValue(element: ElementDef) {
  if (element.default === undefined || element.default === null) return null;
  const display = typeof element.default === "object" ? JSON.stringify(element.default) : String(element.default);
  return <div className="sf-defaultValue">Default Value: {display}</div>;
}

/* Helper: renders description text below a field */
function renderDescription(text?: string) {
  if (!text) return null;
  return <div className="sf-fieldDescription">{text}</div>;
}

/* Helper: determines whether a numeric field should render as a slider */
function shouldRenderSlider(element: ElementDef, uiDef?: UIDefinition | null): boolean {
  if (uiDef?.displayAs === "slider") return true;
  // Auto-detect: if both min and max are defined and finite, use a slider
  return element.min !== undefined && element.max !== undefined && isFinite(element.min) && isFinite(element.max);
}

export type Renderer = typeof materialRenderer;

export const materialRenderer = {
  renderSelect: ({ element, options, onChange }: SelectRenderArgs) => (
    <Box hidden={!!element.hidden} className="sf-fieldWrap" px={PropertyPaddingH}>
      <FormControl variant="standard" fullWidth>
        <InputLabel id={`select-label-${element.key}`}>
          {formatter.normalizeTitle(element.title)}
        </InputLabel>
        <Select
          labelId={`select-label-${element.key}`}
          id={`form-editor-select-${element.key}`}
          defaultValue={element.default || options[0]}
          onChange={(e) => onChange(e.target.value)}
          label={element.key}
          sx={{
            "&:before": { borderBottomColor: "rgba(107, 101, 98, 0.3)" },
            "&:after": { borderBottomColor: mcColors.green4 },
          }}
        >
          {options.map((option, index) => (
            <MenuItem key={index} value={option?.toString()}>
              {formatter.normalizeSelectItem(option)}
            </MenuItem>
          ))}
        </Select>
        {renderDescription(element.description)}
        {renderDefaultValue(element)}
      </FormControl>
    </Box>
  ),
  renderSimpleProperty: ({ element, type, handleValidation, uiDef }: PropRenderArgs) => {
    // Numeric slider rendering
    if (type === "number" && shouldRenderSlider(element, uiDef)) {
      const numericValue = element.value !== undefined && element.value !== null && element.value !== ""
        ? Number(element.value)
        : (element.default !== undefined ? Number(element.default) : element.min ?? 0);

      return (
        <Box hidden={!!element.hidden} className="sf-fieldWrap">
          <div className="sf-sliderSet">
            <div className="sf-sliderTitle">
              {formatter.normalizeTitle(element.title)} {element.isRequired && "*"}
            </div>
            <Slider
              className="sf-slider"
              size="small"
              min={element.min}
              max={element.max}
              step={1}
              value={numericValue}
              onChange={(_, val) => handleValidation(String(val), element.key)}
              sx={{
                color: mcColors.green4,
                "& .MuiSlider-thumb": { backgroundColor: mcColors.green4 },
                "& .MuiSlider-track": { backgroundColor: mcColors.green4 },
              }}
            />
            <TextField
              className="sf-sliderInput"
              size="small"
              variant="outlined"
              value={element.value ?? element.default ?? ""}
              onChange={(e) => handleValidation(e.target.value, element.key)}
              inputProps={{ min: element.min, max: element.max, type: "number" }}
              sx={{ width: 80 }}
            />
          </div>
          {renderDescription(element.description)}
          {element.validationErrorMessage && (
            <FormHelperText error>{element.validationErrorMessage}</FormHelperText>
          )}
          {renderDefaultValue(element)}
        </Box>
      );
    }

    // Standard text/number input
    return (
      <Box hidden={!!element.hidden} className="sf-fieldWrap">
        <FormControl fullWidth variant="standard">
          <InputLabel htmlFor={element.key}>
            {formatter.normalizeTitle(element.title)} {element.isRequired && "*"}
          </InputLabel>
          <Input
            id={element.key}
            type={type}
            required={element.isRequired}
            name={element.title}
            value={element.value ?? element.default ?? ""}
            inputProps={{ min: element.min, max: element.max }}
            onChange={(e) => handleValidation(e.target.value, element.key)}
            error={!!element.validationErrorMessage}
            sx={{
              "&:after": { borderBottomColor: mcColors.green4 },
            }}
          />
          {element.validationErrorMessage && (
            <FormHelperText error id={`${element.key}-val`}>
              {element.validationErrorMessage}
            </FormHelperText>
          )}
          {renderDescription(element.description)}
          {renderDefaultValue(element)}
        </FormControl>
      </Box>
    );
  },
  renderObject: ({ properties, uiDef, context, generateProperty }: ObjectRenderArgs) => {
    return (
      <>
        <FormAccordian hierarchy={context.hierarchy} titleSize={context.size}>
          <FlexBox column={!uiDef?.displayHorizontal} justifyContent="space-evenly" gap={0.8}>
            {properties
              .map((property) => [property, getUIDefForChild(property, uiDef)] as const)
              .sort(([, uiA], [, uiB]) => getOrder(uiA) - getOrder(uiB))
              .map(([property], index) => (
                <Box flexGrow={1} key={index}>
                  {generateProperty(property, context)}
                </Box>
              ))}
          </FlexBox>
        </FormAccordian>
      </>
    );

    function getUIDefForChild(property: Property, uiHints: UIDefinition | null) {
      const [key] = property;

      return uiHints?.children?.[key];
    }

    function getOrder(uiDef?: UIDefinition | null) {
      return uiDef?.order ?? 0;
    }
  },
  renderArray: ({
    element,
    itemsDefinition,
    rows,
    context,
    definition,
    generateProperty,
    addArrayValue,
    removeArrayValue,
    rowTransformer,
  }: ArrayRenderArgs) => {
    //use smaller fonts for array items
    context = { ...context, size: "small" };
    const rowData = rows.map((_, index) => rowTransformer(index, itemsDefinition, context));
    const rowOptions = {
      isArrayItem: true,
    };

    return (
      <Box sx={{ mb: 1 }}>
        <div className="sf-elementBinTitle">{formatter.normalizeTitle(element.title)}</div>
        <div className="sf-elementBin">
          <div className="sf-binToolbar">
            <Button
              className="sf-addButton"
              size="small"
              onClick={addArrayValue}
              startIcon={<FontAwesomeIcon icon={faPlus} />}
            >
              Add
            </Button>
          </div>
          {rowData.map((row) => (
            <div className="sf-arrayItemCard" key={row.index}>
              <div className="sf-arrayItemHeader">
                <span className="sf-arrayItemIndex">{row.index + 1}</span>
                <IconButton
                  size="small"
                  onClick={() => removeArrayValue(row.index)}
                  title="Remove item"
                  sx={{ color: "inherit", opacity: 0.7, "&:hover": { opacity: 1 } }}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </IconButton>
              </div>
              {generateProperty([row.index.toString(), itemsDefinition], row.context, rowOptions)}
            </div>
          ))}
        </div>
      </Box>
    );
  },
  renderCheckBox: (args: CheckBoxRenderArgs) => {
    const { element, value, onChange } = args;

    return (
      <Box className="sf-fieldWrap">
        <div className="sf-checkboxRow">
          <Switch
            checked={value}
            onChange={(_, val) => onChange(val)}
            size="small"
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: mcColors.green4 },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: mcColors.green4 },
            }}
          />
          <span className="sf-checkboxLabel">{formatter.normalizeTitle(element.title)}</span>
        </div>
        {renderDescription(element.description)}
        {renderDefaultValue(element)}
      </Box>
    );
  },
  renderError: (error: unknown) => <FlexBox>{error?.toString()}</FlexBox>,
  renderSchema: (args: SchemaRenderArgs) => {
    const { title, properties, context, generateProperty, hideRootTitle } = args;

    return (
      <Box className="sf-root">
        <Paper sx={{ p: 1.5, display: "flex", flexDirection: "column", backgroundColor: "transparent", boxShadow: "none" }}>
          {!hideRootTitle && (
            <Box sx={{ fontSize: "15pt", fontWeight: 600, letterSpacing: "0.3px", py: 1 }}>
              {formatter.normalizeTitle(title)}
            </Box>
          )}
          <FlexBox column gap={0.5}>
            {properties.map((prop, index) => (
              <Box key={index}>{generateProperty(prop, context)}</Box>
            ))}
          </FlexBox>
        </Paper>
      </Box>
    );
  },
  renderAdditionalProperties: (showModal: () => void) => {
    return (
      <Box px={PropertyPaddingH} py={1}>
        <div className="sf-elementBinTitle">Additional Properties</div>
        <Box>
          <Button
            className="sf-addButton"
            size="small"
            onClick={showModal}
            startIcon={<FontAwesomeIcon icon={faPlus} />}
          >
            Add Property
          </Button>
        </Box>
      </Box>
    );
  },
  renderAdditionalPropertiesModal: (open: boolean, onClose: () => void) => {
    return (
      <Modal open={open} onClose={onClose}>
        <Box>Hello, Modal</Box>
      </Modal>
    );
  },
  renderLoading: () => {
    return (
      <Box>
        <LoadingSpinner />
      </Box>
    );
  },
} as const;
