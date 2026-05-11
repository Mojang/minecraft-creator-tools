import { useCallback, useEffect, useRef, useState } from "react";
import Project from "../../../../app/Project";
import IPersistable from "../../../types/IPersistable";
import { materialRenderer } from "../../../shared/components/SchemaForm/renderers/MaterialRenderer";
import SchemaEditor, { SchemaEditorHandle } from "../../../shared/components/SchemaForm/SchemaEditor";
import IFile from "../../../../storage/IFile";
import FlexBox from "../../../shared/components/layout/FlexBox";
import DynamicObject from "../../../shared/components/SchemaForm/DynamicObject";
import Alert from "@mui/material/Alert/Alert";
import Log from "../../../../core/Log";
import StorageUtilities from "../../../../storage/StorageUtilities";

type LootTableEditorProps = {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  heightOffset?: number;
  readOnly?: boolean;
};

const lootSchemaPath = "data/editor-schemas/loot/loot_table.schema.json";
const lootUISchemaPath = "data/editor-schemas/loot/loot_table.uischema.json";

export default function LootTableEditor({ file, setActivePersistable, heightOffset }: LootTableEditorProps) {
  const schemaEditorRef = useRef<SchemaEditorHandle>(null);
  const [parsedData, setParsedData] = useState<DynamicObject | undefined>(undefined);
  const [contentKey, setContentKey] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const onPersist = useCallback((): Promise<boolean> => {
    try {
      writeFormToFile(file);

      file?.manager?.persist();
      return Promise.resolve(true);
    } catch (e) {
      setError("Failed to save loot table file. Please ensure the file is correctly formatted.");
      Log.error(`Error persisting loot table file: ${e}`);
      return Promise.resolve(false);
    }
  }, [file]);

  useEffect(() => {
    try {
      readFileContent();
    } catch (e) {
      setError("Failed to parse loot table file. Please ensure the file is correctly formatted.");
      Log.error(`Error parsing loot table file: ${e}`);
    }
  }, [file, file.name]);

  useEffect(() => {
    // we need to pass the write logic (as an object) back up to the parent to satisfy the expected pattern
    setActivePersistable?.({ persist: onPersist });
  }, [onPersist, setActivePersistable]);

  const readFileContent = () => {
    const parsedContent = StorageUtilities.getJsonObject(file);
    if (file.isInErrorState) {
      throw new Error(file.errorStateMessage);
    }

    setParsedData(parsedContent);

    const newKey = `${file.storageRelativePath}-${file.latestModified?.getTime() || 0}`;
    setContentKey(newKey);
  };

  /*
    Note that because of the 'persist' logic this doesn't necessarily save to disk, 
    just to the IFile object. Although, persist is called before saving to disk. 
  */
  const writeFormToFile = (file: IFile) => {
    const formJson = schemaEditorRef.current?.getJson();
    file.setContent(JSON.stringify(formJson));
  };

  return (
    <>
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      {/* the height offset calculation is necessary because of the way the parent components are designed - relative
      positioning doesn't work as expected */}
      <FlexBox sx={{ height: `calc(100vh - ${heightOffset ?? 0}px)`, overflowY: "auto" }} column>
        {parsedData && contentKey && (
          <SchemaEditor
            key={contentKey}
            ref={schemaEditorRef}
            schemaPath={lootSchemaPath}
            uiSchemaPath={lootUISchemaPath}
            renderer={materialRenderer}
            initialState={parsedData}
          />
        )}
      </FlexBox>
    </>
  );
}
