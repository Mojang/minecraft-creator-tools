import useJsonFile from "../../../hooks/io/UseJsonFile";
import FlexBox from "../layout/FlexBox";
import FormAccordian from "../../../components/formEditor/FormAccordion";
import useSchemaForm from "./UseSchemaForm";
import Box from "@mui/material/Box";
import LoadingSpinner from "../async/loadingSpinner/LoadingSpinner";
import { JsonSchema } from "./SchemaParser";
import { UISchema } from "./UISchema";
import { useState, forwardRef, useImperativeHandle } from "react";
import DynamicObject from "./DynamicObject";

//force either schema or schemaPath but not both
type SchemaEditorProps =
  | ({
      schema: JsonSchema;
      schemaPath?: never;
    } & Common)
  | ({
      schemaPath: string | URL;
      schema?: never;
    } & Common);

type Common = {
  renderer: any;
  uiSchema?: UISchema;
  uiSchemaPath?: string;
  initialState?: DynamicObject;
};

export interface SchemaEditorHandle {
  getJson: () => any;
}

const SchemaEditor = forwardRef<SchemaEditorHandle, SchemaEditorProps>(
  ({ renderer, initialState, ...props }: SchemaEditorProps, ref) => {
    const [showDebugOutput] = useState(false);
    //prefer using the provided uischema, avoid reading in new schema if one is provided
    if (!!props.uiSchema) {
      props.uiSchemaPath = undefined;
    }

    const [loadingSchema, schemaFromFile, schemaError] = useJsonFile(props.schemaPath);
    const [loadingUISchema, uiSchemaFromFile, uiSchemaError] = useJsonFile(props.uiSchemaPath);

    const schema = props.schema || (schemaFromFile as JsonSchema);
    const uiSchema = props.uiSchema || uiSchemaFromFile;

    const [json, showEditor] = useSchemaForm(schema, uiSchema, renderer, initialState);

    // Expose getJson method to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        getJson: () => json.root,
      }),
      [json]
    );

    if (schemaError || uiSchemaError) {
      return (
        <Box sx={{ padding: 2 }}>
          {schemaError ? (
            <Box sx={{ marginBottom: 2, padding: 2, backgroundColor: '#fff3cd', borderRadius: 1 }}>
              <Box sx={{ fontWeight: 'bold', marginBottom: 1 }}>Schema unavailable — editing raw JSON</Box>
              <details style={{ fontSize: '0.875rem', color: '#666' }}>
                <summary style={{ cursor: 'pointer' }}>Details (for reporting)</summary>
                <pre style={{ marginTop: '8px', fontSize: '0.75rem', overflow: 'auto' }}>
                  {typeof schemaError === 'string' ? schemaError : JSON.stringify(schemaError, null, 2)}
                </pre>
              </details>
            </Box>
          ) : null}
          {uiSchemaError ? (
            <Box sx={{ padding: 2, backgroundColor: '#fff3cd', borderRadius: 1 }}>
              <Box sx={{ fontWeight: 'bold', marginBottom: 1 }}>UI schema unavailable</Box>
              <details style={{ fontSize: '0.875rem', color: '#666' }}>
                <summary style={{ cursor: 'pointer' }}>Details (for reporting)</summary>
                <pre style={{ marginTop: '8px', fontSize: '0.75rem', overflow: 'auto' }}>
                  {typeof uiSchemaError === 'string' ? uiSchemaError : JSON.stringify(uiSchemaError, null, 2)}
                </pre>
              </details>
            </Box>
          ) : null}
        </Box>
      );
    }

    if (loadingSchema || loadingUISchema) {
      return <LoadingSpinner />;
    }

    return (
      <FlexBox column>
        <Box>{showEditor()}</Box>
        <Box hidden={!showDebugOutput}>
          <FlexBox column mt={6}>
            <FormAccordian hideByDefault hierarchy={[{ key: "debug", title: "Output" }]}>
              <FlexBox p={2}>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{JSON.stringify(json, null, 2)}</pre>
              </FlexBox>
            </FormAccordian>
          </FlexBox>
        </Box>
      </FlexBox>
    );
  }
);

export default SchemaEditor;
