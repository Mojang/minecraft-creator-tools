import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildObjectFromSchema, buildProperty } from "../../../../jsonschema/SchemaObjectBuilder";
import Log from "../../../../core/Log";
import {
  arrayToLookup,
  Context,
  Definition,
  pickBestOneOf,
  DynamicObject,
  expandContext,
  FullDefinition,
  getFullKey,
  getValueByHierarchy,
  Hierarchy,
  insertIntoObjectByHierarchy,
  JsonSchema,
  KeyedDefinition,
  minimize,
  Property,
  resolveDefinition,
  resolveReferences,
  updateObjectByHierarchy,
} from "./SchemaParser";
import { Renderer } from "./renderers/MaterialRenderer";
import { getUIDefinition, UIDefinition, UISchema } from "./UISchema";
import OneOfModal from "./OneOfModal";

type InputType = "text" | "number" | "object" | "array" | "boolean" | "enum";

export type PropertyOptions = {
  isArrayItem?: boolean;
  arrayParentKey?: string;
};

const SchemaTypeToInputType: Record<string, InputType> = {
  string: "text",
  number: "number",
  integer: "number",
  object: "object",
  array: "array",
  boolean: "boolean",
} as const;

type OneOfOptions = {
  options: FullDefinition[];
  context: Context;
  uiDef: UIDefinition;
  optionSelect: (selected: Definition) => void;
};

// A transformation callback to expand context for array items,
// Allows the renderer to get proper context without directly handling non-rendering logic.
const ArrayContextTransformer = (index: number, definition: Definition, context: Context) => ({
  index,
  context: expandContext(context, {
    entry: { key: index.toString(), title: `${definition.title || "Item"} #${index + 1}`, isArrayItem: true },
  }),
});

export default function useSchemaForm(
  schema: JsonSchema | undefined | null,
  uiSchema: UISchema | undefined | null,
  renderer: Renderer,
  initialState?: DynamicObject
) {
  const initialStateRef = useRef(initialState);
  // backing field for output
  // allows us to build up changes without triggering re-renders on every change
  // and batch transforms before applying updates to output
  const value = useRef<DynamicObject>(initialStateRef.current || (schema ? buildObjectFromSchema(schema) : {}));
  // output is the object we're building with user input
  const [output, setOutput] = useState(value.current);

  const [isReady, setIsReady] = useState<boolean>(!!schema);
  //used to save choices made. e.g. when the user selects a OneOf options
  const uiChoices = useRef<DynamicObject>({});

  const uiHints = uiSchema ?? null;

  //todo: validation currently the only supports a single string error message, may want to expand as a future feature
  const [validation, setValidation] = useState<Record<string, string | null>>({});
  // Mirror of validation state for use in memoized generators without making validation a memo dependency.
  // Keeps validation errors up-to-date without triggering expensive JSX regeneration on every keystroke.
  // The ref is synced via useEffect below to always read current validation.
  const validationRef = useRef<Record<string, string | null>>({});
  const [oneOfOptions, setOneOfOptions] = useState<OneOfOptions | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  // preserving for future 'additional properties' feature
  //const [showAdditionalPropertiesModal, setShowAdditionalPropertiesModal] = useState(false);
  const documentTitle = useRef("document");

  // this is mostly intended to handle the case where the schema is initially null/undefined and then
  // a true value comes in after a delay (i.e. async loading),
  // I wouldn't neccessarily recommend swapping out the schema mid-stream in most other cases
  useEffect(() => {
    if (!!schema) {
      value.current = buildObjectFromSchema(schema, initialStateRef.current);
      setOutput(value.current);
      setIsReady(true);
    }
  }, [schema, initialStateRef]);

  // Keep validationRef in sync with validation state.
  // This allows the memoized generators to read current validation without being invalidated
  // on every keystroke (which would trigger expensive JSX regeneration). The ref pattern lets us:
  // - Update validation state (triggers re-render for display)
  // - Generators stay memoized (validation not in dependency array)
  // - generateSimpleProperty reads validationRef.current (always current, no stale closure)
  useEffect(() => {
    validationRef.current = validation;
  }, [validation]);

  /*
    downloads the json data as a .json file
  */
  const exportToJsonFile = useCallback(async () => {
    setIsExporting(true);

    await new Promise<void>((resolve) => {
      const content = JSON.stringify(minimize(value.current), null, 2);
      const blob = new Blob([content], { type: "application/json;charset=utf-8;" });

      saveAs(blob, documentTitle.current + ".json");

      resolve();
    });

    setIsExporting(false);
  }, []);

  const displayUpdate = useCallback(() => {
    const minimized = minimize(value.current);
    setOutput({ ...minimized });
  }, []);

  const updateObjectValue = useCallback(
    (newValue: unknown, hierarchy: Hierarchy) => {
      updateObjectByHierarchy(value.current, newValue, hierarchy);
      displayUpdate();
    },
    [displayUpdate]
  );

  /*
    Memoize all property generators to avoid expensive tree-building on every render.
    Validation is intentionally excluded from dependencies - see validationRef pattern above.
    All generator functions are bundled to solve circular dependencies:
    - generateProperty calls specific generators (generateSimpleProperty, generateObject, etc.)
    - Specific generators recursively call generateProperty for nested structures
    Keeping them in one memo with a single dependency array prevents stale closures.
  */
  const { generateProperty } = useMemo(() => {
    /*
    Generates ui for "simple" property types. 
    
    Simple types are generally primitives such as  string and numbers and not types that 
    include more complex and/or recursive elements such as objects and selects
  */
    const generateSimpleProperty = (key: string, definition: Definition, type: string, context: Context) => {
      const uiDef = getUIDefinition(uiHints, context.hierarchy, { key });

      const title = uiDef?.title || definition.title || key;
      const fullKey = getFullKey([...context.hierarchy, { key, title }]);

      context = expandContext(context, { entry: { key, title } });

      const validationErrorMessage =
        validationRef.current[fullKey] && (uiDef?.regexErrorMessage || validationRef.current[fullKey]);
      const element = {
        key: fullKey,
        title,
        description: uiDef?.description ?? definition.description ?? "",
        isRequired: context.required.has(key),
        validationErrorMessage,
        hidden: uiDef?.hideFromUI,
        min: definition.minimum,
        max: definition.maximum,
        default: getValueByHierarchy(value.current, context.hierarchy) ?? definition.default ?? definition.minimum,
      };
      const validationCallback = (val: string, key: string) => {
        handleValidation(val, key, definition, uiDef);
        updateObjectValue(val, context.hierarchy);
      };

      return renderer.renderSimpleProperty({ element, type, handleValidation: validationCallback });
    };

    /* generates ui for a checkbox */
    const generateCheckBox = (property: Property, context: Context) => {
      const [key, definition] = property;

      const uiDef = getUIDefinition(uiHints, context.hierarchy, { key });

      const title = uiDef?.title || definition.title || key;

      const parentRef = (getValueByHierarchy(value.current, context.hierarchy) ?? {}) as DynamicObject;
      const boolValue = parentRef?.[key];
      const element = { key, title, default: definition.default };

      return renderer.renderCheckBox({
        element,
        value: !!boolValue,
        onChange: (newValue) => {
          parentRef[key] = newValue;
          displayUpdate();
        },
      });
    };

    /* generates ui select */
    const generateSelect = (property: Property, context: Context, options?: PropertyOptions) => {
      const [key, definition] = property;

      const uiDef = getUIDefinition(uiHints, context.hierarchy, { key, isArrayItem: options?.isArrayItem });

      const title = uiDef?.title || definition.title || key;
      let selectChoices: unknown[] = uiDef?.select || definition.enum || [];

      context = expandContext(context, { entry: { key, title } });

      const update = (selectValue: unknown) => updateObjectValue(selectValue, context.hierarchy);
      const element = { key, title, hidden: uiDef?.hideFromUI, default: definition.default };
      return renderer.renderSelect({ element, options: selectChoices, onChange: update });
    };

    const buildNewArrayItem = (
      array: unknown[],
      parentDefinition: Definition,
      itemsDefinition: Definition,
      context: Context,
      uiDef: UIDefinition | null
    ) => {
      const key = array.length.toString();
      const itemContext = expandContext(context, { entry: { key, isArrayItem: true } });
      let { oneOfs } = resolveReferences(itemsDefinition, context.references);

      const itemUiDef = uiDef?.items;

      //if uichoice is selected then instead of generating item defer to user choice
      if (itemUiDef?.oneOf === "uichoice") {
        //check is user has already decided
        const choice = getValueByHierarchy(uiChoices.current, itemContext.hierarchy);

        // if no previous choice, build modal with callback
        if (!choice) {
          setOneOfOptions({
            options: oneOfs,
            uiDef: itemUiDef,
            context: itemContext,
            optionSelect: (selected: Definition) => {
              //on user select, remember choice (insert into uiChoices) and add new item to array
              insertIntoObjectByHierarchy(uiChoices.current, selected, itemContext.hierarchy);
              addArrayValue(array, buildProperty(selected, context.references, parentDefinition, uiDef));
            },
          });
        }
      } else {
        //default case - build object/value and insert to array
        const newItem = buildProperty(itemsDefinition, context.references, parentDefinition, uiDef);
        addArrayValue(array, newItem);
      }
    };

    const addArrayValue = (array: unknown[], newValue: unknown) => {
      array.push(newValue);
      displayUpdate();
    };

    const removeArrayValue = (array: unknown[], index: number) => {
      if (index < 0 || index >= array.length) {
        Log.debug(`trying to remove index ${index} from array of length: ${array.length}`);
      }

      array.splice(index, 1);
      displayUpdate();
    };

    /* 
      generates ui for an object
    */
    const generateObject = (property: Property, context: Context, options?: PropertyOptions): JSX.Element => {
      const [key, definition] = property;
      const nextEntry = {
        key,
        title: definition.title,
        schemaKey: options?.arrayParentKey || (options?.isArrayItem && "items") || undefined,
      };

      const uiDef = options?.isArrayItem
        ? getUIDefinition(uiHints, context.hierarchy)
        : getUIDefinition(uiHints, context.hierarchy, nextEntry);

      const title = uiDef?.title || definition.title || key;

      // Ensure the object exists at this hierarchy level before rendering its properties
      let objectValue = getValueByHierarchy(value.current, context.hierarchy);
      if (objectValue === undefined || objectValue === null) {
        // Initialize the object if it doesn't exist
        objectValue = {};
        updateObjectByHierarchy(value.current, objectValue, context.hierarchy);
      }

      if (!options?.isArrayItem) {
        context = expandContext(context, { entry: { key, title }, required: definition.required });
      }
      const properties = Object.entries(definition.properties || []);

      if (!!uiDef?.isObjectAsBool) {
        const boolValue = getValueByHierarchy(value.current, context.hierarchy);
        return renderer.renderCheckBox({
          element: { key, title },
          value: !!boolValue,
          onChange: (newValue) => {
            const objectBool = newValue ? {} : undefined;
            updateObjectByHierarchy(value.current, objectBool, context.hierarchy);
            displayUpdate();
          },
        });
      }

      return renderer.renderObject({ properties, uiDef, context, generateProperty });
    };

    /* generates ui for an array */
    const generateArray = (property: Property, context: Context): JSX.Element => {
      const [key, OriginalDefinition] = property;
      const { definition } = resolveDefinition(OriginalDefinition, context.references);

      const uiDef = getUIDefinition(uiHints, context.hierarchy, { key });

      const title: string = uiDef?.title || definition.title || key;

      context = expandContext(context, { entry: { key, title } });

      const itemsDefinition = definition.items;

      if (!itemsDefinition) {
        throw new Error("No item definition found for array. This is not supported.");
      }
      if (Array.isArray(itemsDefinition)) {
        // itemsDefinition should only be an array if items in the actual array are mixed types
        // otherwise, for now, we only supports array items of a single type
        throw new Error("Arrays of Mixed Types not currently supported");
      }
      if (typeof itemsDefinition === "boolean") {
        throw new Error("bools not supported");
      }

      let { definition: resolvedItemDef, oneOfs } = resolveReferences(itemsDefinition, context.references);

      const itemUiDef = uiDef?.items || null;

      const resolvedOneOf = resolveOneOfs(key, itemUiDef, oneOfs) || resolvedItemDef;
      if (resolvedOneOf !== "uichoice") {
        resolvedItemDef = resolvedOneOf;
      }

      //a reference to the actual array of the object
      let rows: unknown[] = getValueByHierarchy(value.current, context.hierarchy);

      // Initialize array if it doesn't exist or isn't actually an array
      if (!Array.isArray(rows)) {
        rows = [];
        insertIntoObjectByHierarchy(value.current, rows, context.hierarchy);
      }

      const element = { key, title, description: uiDef?.description || definition.description };

      return renderer.renderArray({
        element,
        itemsDefinition: resolvedItemDef,
        rows,
        definition: itemUiDef,
        context,
        generateProperty,
        addArrayValue: () => buildNewArrayItem(rows, definition, itemsDefinition, context, uiDef),
        removeArrayValue: (index) => removeArrayValue(rows, index),
        rowTransformer: ArrayContextTransformer,
      });
    };

    /* 
    generates ui for object property

    the type of the property is determine and a specific ui for that type is generated/rendered
  */
    const generateProperty = (property: Property, context: Context, options?: PropertyOptions): JSX.Element => {
      const [key, originalDefinition] = property;
      const uiDef = getUIDefinition(uiHints, context.hierarchy, { key, isArrayItem: options?.isArrayItem });

      if (!!uiDef?.select?.length) {
        return generateSelect(property, context, options);
      }

      let { definition, oneOfs } = resolveReferences(originalDefinition, context.references);
      const oneOfResult = resolveOneOfs(key, uiDef, oneOfs) || definition;

      if (oneOfResult === "uichoice") {
        const itemContext = expandContext(context, { entry: { key, isArrayItem: options?.isArrayItem } });

        const choice = getValueByHierarchy(uiChoices.current, itemContext.hierarchy);
        if (choice) {
          definition = choice;
        }
      } else {
        definition = oneOfResult;
      }

      const inputType = getInputTypeForProp(definition, context);
      if (!inputType) {
        return (
          <div>
            Unknown type: {definition.type} | {key}
          </div>
        );
      }

      property = [key, definition];

      switch (inputType) {
        case "enum":
          return generateSelect(property, context);
        case "boolean":
          return generateCheckBox(property, context);
        case "object":
          return generateObject(property, context, options);
        case "array":
          return generateArray(property, context);
        default:
          return generateSimpleProperty(key, definition, inputType, context);
      }
    };

    return { generateObject, generateArray, generateProperty };
  }, [displayUpdate, renderer, uiHints, updateObjectValue]);

  /*
    Primary main entry point where the schema rendering starts
  */
  const generateSchema = useCallback(
    (schema: JsonSchema): JSX.Element => {
      const required = arrayToLookup<string>(schema.required || []);
      const properties = Object.entries(schema.properties || []);
      const definitions: KeyedDefinition[] = Object.entries(schema.definitions || schema.$defs || []);
      const title = schema.title || "UNNAMED_OBJECT";
      documentTitle.current = title;

      const context: Context = {
        hierarchy: [],
        required,
        references: definitions,
      };

      if (!isReady) {
        return renderer.renderLoading();
      }

      try {
        return (
          <>{renderer.renderSchema({ title, properties, context, generateProperty, isExporting, exportToJsonFile })}</>
        );
      } catch (error) {
        return renderer.renderError(error);
      }
    },
    [exportToJsonFile, generateProperty, isExporting, isReady, renderer]
  );

  /* updates validation data based on the `newValue` supplied */
  function handleValidation(newValue: string, key: string, definition: Definition, uiDef: UIDefinition | null): void {
    let isValid = true;
    const pattern = uiDef?.pattern || definition.pattern;
    if (pattern) {
      const regex = new RegExp(pattern);
      isValid = regex.test(newValue);
    }

    setValidation((validation) => {
      validation[key] = isValid ? null : `Must adhere to pattern: ${pattern}`;

      return { ...validation };
    });
  }

  const renderModal = useCallback(() => {
    return (
      oneOfOptions && (
        <OneOfModal
          options={oneOfOptions.options}
          optionDefinitions={oneOfOptions.uiDef.choices}
          onSelect={(selected) => {
            oneOfOptions.optionSelect(selected);
            setOneOfOptions(null);
          }}
        />
      )
    );
  }, [oneOfOptions]);

  const render = useCallback(() => {
    if (!schema) return <></>;

    return (
      <>
        {renderModal()}
        {generateSchema(schema)}
      </>
    );
  }, [schema, renderModal, generateSchema]);

  return [output, render] as const;
}

/* determines what ui input type to use, based on the schema data  */
function getInputTypeForProp(prop: Definition, context: Context): InputType | null {
  if (!!prop.enum) {
    return "enum";
  }
  if (Array.isArray(prop.type)) {
    Log.debug("prop type of an array is not currently supported: " + prop.type);
    return null;
  }

  const type = prop.type && SchemaTypeToInputType[prop.type];

  //this is necessary because of a case in the minecraft-specific schema where "object as bool" flags aren't given a type
  if (type === undefined) {
    return "object";
  }

  return type ?? null;
}

/* 
  Resolves which definition to use from among supplied `oneOf` definitions 
  
  If applicable, will use hints from the ui definition to determine which definition to use.
  */
const resolveOneOfs = (key: string, uiDef: UIDefinition | undefined | null, oneOfs: Definition[]) => {
  let oneOfChooser = uiDef?.oneOf;
  let definition: Definition | undefined;

  if (!oneOfs?.length) {
    return undefined;
  }

  if (oneOfChooser === "uichoice") {
    // defer decision to the ui
    return "uichoice";
  } else if (oneOfChooser !== undefined) {
    // find schema oneOf option that matches the hint from the ui definition.
    if (typeof oneOfChooser === "string") {
      const found = oneOfs.find((candidate) => candidate.type === oneOfChooser);
      if (!found) {
        throw new Error(`UI Schema error. Could not find match for ${oneOfChooser} on ${key}`);
      }
      definition = found;
    } else if (oneOfChooser < oneOfs.length) definition = oneOfs[oneOfChooser];
    else Log.debug(`can't assign uischema choice [${oneOfChooser}] from [${oneOfs.length}] oneOf options`);
  } else {
    // no hints - use default logic to pick our definition
    definition = pickBestOneOf(oneOfs);
  }

  return definition;
};
