import FormControl from "@mui/material/FormControl";
import FlexBox from "../../layout/FlexBox";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Input,
  MenuItem,
  Modal,
  Paper,
  Typography,
} from "@mui/material";
import FormAccordian from "../../../../components/formEditor/FormAccordion";
import { Context, Definition, Property } from "../SchemaParser";
import { UIDefinition } from "../UISchema";
import { PropertyOptions } from "../UseSchemaForm";
import * as formatter from "../../../../../formEditor/FormFormatting";
import LoadingSpinner from "../../async/loadingSpinner/LoadingSpinner";
import { ReactNode } from "react";

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
};
type PropRenderArgs = {
  element: ElementDef;
  type: string;
  handleValidation: ValidationEvent;
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
};

export type Renderer = typeof materialRenderer;

export const materialRenderer = {
  renderSelect: ({ element, options, onChange }: SelectRenderArgs) => (
    <FlexBox hidden={!!element.hidden} column px={PropertyPaddingH}>
      <FormControl variant="standard" color="secondary">
        <InputLabel color="secondary" id="demo-simple-select-label">
          {formatter.normalizeTitle(element.title)}
        </InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id={`form-editor-select-${element.key}`}
          defaultValue={element.default || options[0]}
          onChange={(e) => onChange(e.target.value)}
          label={element.key}
        >
          {options.map((option, index) => (
            <MenuItem key={index} value={option?.toString()}>
              {formatter.normalizeSelectItem(option)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </FlexBox>
  ),
  renderSimpleProperty: ({ element, type, handleValidation }: PropRenderArgs) => (
    <Box px={PropertyPaddingH} hidden={!!element.hidden}>
      <FormControl fullWidth color="secondary" variant="standard">
        <InputLabel htmlFor={element.key}>
          {formatter.normalizeTitle(element.title)} {element.isRequired && "*"}
        </InputLabel>
        <Input
          id={element.key}
          type={type}
          required={element.isRequired}
          name={element.title}
          defaultValue={element.default}
          inputProps={{ min: element.min, max: element.max }}
          onChange={(e) => handleValidation(e.target.value, element.key)}
          error={!!element.validationErrorMessage}
        />
        <FormHelperText error={true} hidden={!element.validationErrorMessage} id={`${element.key}-val`}>
          {element.validationErrorMessage}
        </FormHelperText>
        <FormHelperText id={element.key + "-desc"}> {element.description}</FormHelperText>
      </FormControl>
    </Box>
  ),
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
    const titleSize = context.size;
    //use smaller fonts for array items
    context = { ...context, size: "small" };
    const rowData = rows.map((_, index) => rowTransformer(index, itemsDefinition, context));
    const rowOptions = {
      isArrayItem: true,
    };

    return (
      <>
        <FormAccordian hierarchy={context.hierarchy} titleSize={titleSize} onAdd={addArrayValue}>
          <FlexBox column gap={0.2}>
            <FlexBox justifyContent="center">
              <Box>{element.description}</Box>
            </FlexBox>
            <FlexBox column gap={1.2}>
              {rowData.map((row) => (
                <FormAccordian
                  hierarchy={row.context.hierarchy}
                  onRemove={() => removeArrayValue(row.index)}
                  titleSize={context.size}
                  key={row.index}
                >
                  {generateProperty([row.index.toString(), itemsDefinition], row.context, rowOptions)}
                </FormAccordian>
              ))}
            </FlexBox>
          </FlexBox>
        </FormAccordian>
      </>
    );
  },
  renderCheckBox: (args: CheckBoxRenderArgs) => {
    const { element, value, onChange } = args;

    return (
      <FlexBox px={PropertyPaddingH}>
        <FormGroup>
          <FormControlLabel
            checked={value}
            onChange={(e, val) => onChange(val)}
            control={<Checkbox color="secondary" name={element.title} />}
            label={formatter.normalizeTitle(element.title)}
          />
        </FormGroup>
      </FlexBox>
    );
  },
  renderError: (error: unknown) => <FlexBox>{error?.toString()}</FlexBox>,
  renderSchema: (args: SchemaRenderArgs) => {
    const { title, properties, context, generateProperty, exportToJsonFile, isExporting } = args;

    return (
      <>
        <Box>
          <Paper sx={{ p: 1.5, display: "flex", flexDirection: "column" }}>
            <FlexBox column gap={2}>
              {properties.map((prop, index) => (
                <Box key={index}>{generateProperty(prop, context)}</Box>
              ))}
            </FlexBox>
          </Paper>
        </Box>
      </>
    );
  },
  renderAdditionalProperties: (showModal: () => void) => {
    return (
      <Box px={PropertyPaddingH} py={2}>
        <Paper sx={{ p: 1.5, display: "flex", flexDirection: "column" }}>
          <FlexBox column gap={2}>
            <Box>
              <Typography variant="h2">Additional Properties</Typography>
            </Box>
            <Box>
              <Button onClick={showModal}>Add Property</Button>
            </Box>
          </FlexBox>
        </Paper>
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
