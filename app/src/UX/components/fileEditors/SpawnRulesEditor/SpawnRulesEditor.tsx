import { useCallback, useEffect, useRef, useState } from "react";
import Project from "../../../../app/Project";
import { SpawnRulesUISchema } from "../../../../data/uischemas/spawnrules/SpawnRules.uischema";
import IPersistable from "../../../types/IPersistable";
import { materialRenderer } from "../../../shared/components/SchemaForm/renderers/MaterialRenderer";
import SchemaEditor, { SchemaEditorHandle } from "../../../shared/components/SchemaForm/SchemaEditor";
import IFile from "../../../../storage/IFile";
import FlexBox from "../../../shared/components/layout/FlexBox";
import { DynamicObject } from "../../../shared/components/SchemaForm/SchemaParser";

type SpawnRulesEditorProps = {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  readOnly?: boolean;
  heightOffset?: number;
};

const spawnUiSchema = SpawnRulesUISchema;
const spawnSchemaPath = "schemas/spawn/spawn_rules.schema.json";

export default function SpawnRulesEditor({ project, file, setActivePersistable, heightOffset }: SpawnRulesEditorProps) {
  const schemaEditorRef = useRef<SchemaEditorHandle>(null);
  const [parsedData, setParsedData] = useState<DynamicObject | undefined>(undefined);
  const [contentKey, setContentKey] = useState<string>("");

  /*
    Note that because of the 'persist' logic this doesn't necessarily save to disk, 
    just to the IFile object. Although, persist is called before saving to disk. 
  */
  const writeFormToFile = useCallback((file: IFile) => {
    if (!file.content || typeof file.content !== "string") {
      return;
    }

    // The schema file from the engine doesn't quite match the file structure expected by creator tools.
    // So we have to extract the 'minecraft:spawn_rules' property, update that, and then 'persist' it back to the file.
    const fileContent = JSON.parse(file.content);
    const spawnDataFromForm = schemaEditorRef.current?.getJson();
    fileContent["minecraft:spawn_rules"] = spawnDataFromForm;

    file.setObjectContentIfSemanticallyDifferent(fileContent);
  }, []);

  const onPersist = useCallback(
    (file: IFile): Promise<boolean> => {
      writeFormToFile(file);

      return Promise.resolve(true);
    },
    [writeFormToFile]
  );

  useEffect(() => {
    const parsedContent = file.content && typeof file.content === "string" ? JSON.parse(file.content) : undefined;

    const spawnData = parsedContent?.["minecraft:spawn_rules"];
    setParsedData(spawnData);

    /* 
      `initialState` in schema editor is intended to be just that - initial, but the parent component unmounts and remounts the entire editor which can cause 
      rerender to occurs where the editor holds on to the old initialState.
      We need to ensure key is fully unique so that SchemaEditor remounts/rerenders with the updated initialState. 
    */
    const newKey = `${file.storageRelativePath}-${file.modified}`;
    setContentKey(newKey);
  }, [file, file.name]);

  useEffect(() => {
    setActivePersistable?.({ persist: () => onPersist(file) });
  }, [onPersist, setActivePersistable, file]);

  return (
    /* the height offset calculation is necessary because of the way the parent components are designed - relative positioning doesn't work as expected */
    <FlexBox sx={{ height: `calc(100vh - ${heightOffset ?? 0}px)`, overflowY: "auto" }} column>
      {parsedData && contentKey && (
        <SchemaEditor
          key={contentKey}
          ref={schemaEditorRef}
          schemaPath={spawnSchemaPath}
          uiSchema={spawnUiSchema}
          renderer={materialRenderer}
          initialState={parsedData}
        />
      )}
    </FlexBox>
  );
}
