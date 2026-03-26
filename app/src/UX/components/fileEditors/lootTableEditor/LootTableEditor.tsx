import { useCallback, useEffect, useRef, useState } from "react";
import Project from "../../../../app/Project";
import IPersistable from "../../../types/IPersistable";
import { materialRenderer } from "../../../shared/components/SchemaForm/renderers/MaterialRenderer";
import SchemaEditor, { SchemaEditorHandle } from "../../../shared/components/SchemaForm/SchemaEditor";
import IFile from "../../../../storage/IFile";
import FlexBox from "../../../shared/components/layout/FlexBox";
import { DynamicObject } from "../../../shared/components/SchemaForm/SchemaParser";

type LootTableEditorProps = {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  heightOffset?: number;
  readOnly?: boolean;
};

const lootSchemaPath = "schemas/loot/loot_table.schema.json";

export default function LootTableEditor({ file, setActivePersistable, heightOffset }: LootTableEditorProps) {
  const schemaEditorRef = useRef<SchemaEditorHandle>(null);
  const [parsedData, setParsedData] = useState<DynamicObject | undefined>(undefined);
  const [contentKey, setContentKey] = useState<string>("");

  /*
    Note that because of the 'persist' logic this doesn't necessarily save to disk, 
    just to the IFile object. Although, persist is called before saving to disk. 
  */
  const writeFormToFile = useCallback((file: IFile) => {
    const formJson = schemaEditorRef.current?.getJson();
    file.setContent(JSON.stringify(formJson));
  }, []);

  const onPersist = useCallback((): Promise<boolean> => {
    writeFormToFile(file);

    file?.manager?.persist();
    return Promise.resolve(true);
  }, [file, writeFormToFile]);

  useEffect(() => {
    const parsedContent = file.content && typeof file.content === "string" ? JSON.parse(file.content) : undefined;
    const lootTableData = parsedContent;

    setParsedData(lootTableData);

    const newKey = `${file.storageRelativePath}-${file.latestModified?.getTime() || 0}`;
    setContentKey(newKey);
  }, [file, file.name]);

  useEffect(() => {
    // we need to pass the write logic (as an object) back up to the parent to satisfy the expected pattern
    setActivePersistable?.({ persist: onPersist });
  }, [onPersist, setActivePersistable]);

  return (
    /* the height offset calculation is necessary because of the way the parent components are designed - relative positioning doesn't work as expected */
    <FlexBox sx={{ height: `calc(100vh - ${heightOffset ?? 0}px)`, overflowY: "auto" }} column>
      {parsedData && contentKey && (
        <SchemaEditor
          key={contentKey}
          ref={schemaEditorRef}
          schemaPath={lootSchemaPath}
          renderer={materialRenderer}
          initialState={parsedData}
        />
      )}
    </FlexBox>
  );
}
