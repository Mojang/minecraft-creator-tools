import { useCallback, useEffect, useRef, useState } from "react";
import Project from "../../../../app/Project";
import { SpawnRulesUISchema } from "../../../../data/uischemas/spawnrules/SpawnRules.uischema";
import IPersistable from "../../../types/IPersistable";
import { materialRenderer } from "../../../shared/components/SchemaForm/renderers/MaterialRenderer";
import SchemaEditor, { SchemaEditorHandle } from "../../../shared/components/SchemaForm/SchemaEditor";
import IFile from "../../../../storage/IFile";
import FlexBox from "../../../shared/components/layout/FlexBox";
import Alert from "@mui/material/Alert";
import DynamicObject from "../../../shared/components/SchemaForm/DynamicObject";
import Log from "../../../../core/Log";
import StorageUtilities from "../../../../storage/StorageUtilities";

type SpawnRulesEditorProps = {
  project: Project;
  file: IFile;
  setActivePersistable?: (persistable: IPersistable) => void;
  readOnly?: boolean;
  heightOffset?: number;
};

const spawnUiSchema = SpawnRulesUISchema;
const spawnSchemaPath = "data/editor-schemas/spawn/spawn_rules.schema.json";

export default function SpawnRulesEditor({ project, file, setActivePersistable, heightOffset }: SpawnRulesEditorProps) {
  const schemaEditorRef = useRef<SchemaEditorHandle>(null);
  const [parsedData, setParsedData] = useState<DynamicObject | undefined>(undefined);
  const [contentKey, setContentKey] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const onPersist = useCallback((file: IFile): Promise<boolean> => {
    try {
      writeFormToFile(file);

      return Promise.resolve(true);
    } catch (e) {
      setError("Failed to save spawn rules file. Please ensure the file is correctly formatted.");
      Log.error(`Error persisting spawn rules file: ${e}`);
      return Promise.resolve(false);
    }
  }, []);

  useEffect(() => {
    setError(null);
    try {
      readSpawnRulesFile(file);
    } catch (e) {
      setError("Failed to parse spawn rules file. Please ensure the file is correctly formatted.");
      Log.error(`Error parsing spawn rules file: ${e}`);
    }
  }, [file, file.name]);

  useEffect(() => {
    setActivePersistable?.({ persist: () => onPersist(file) });
  }, [onPersist, setActivePersistable, file]);

  const readSpawnRulesFile = (file: IFile) => {
    const parsedContent = StorageUtilities.getJsonObject(file);
    if (file.isInErrorState) {
      throw new Error(file.errorStateMessage);
    }

    const spawnData = parsedContent?.["minecraft:spawn_rules"];
    setParsedData(spawnData);

    /*
      `initialState` in schema editor is intended to be just that - initial, but the parent component unmounts and remounts the entire editor which can cause
      rerenders to occur where the editor holds on to the old initialState.
      We need to ensure key is fully unique so that SchemaEditor remounts/rerenders with the updated initialState.
    */
    const newKey = `${file.storageRelativePath}-${file.modified}`;
    setContentKey(newKey);
  };

  /*
    Note that because of the 'persist' logic this doesn't necessarily save to disk, 
    just to the IFile object. Although, persist is called before saving to disk. 
  */
  const writeFormToFile = (file: IFile) => {
    if (!file.content || typeof file.content !== "string") {
      return;
    }

    // The schema file from the engine doesn't quite match the file structure expected by creator tools.
    // So we have to extract the 'minecraft:spawn_rules' property, update that, and then 'persist' it back to the file.
    const fileContent = StorageUtilities.getJsonObject(file);
    if (file.isInErrorState) {
      throw new Error(file.errorStateMessage);
    }
    const spawnDataFromForm = schemaEditorRef.current?.getJson();
    fileContent["minecraft:spawn_rules"] = spawnDataFromForm;

    file.setObjectContentIfSemanticallyDifferent(fileContent);
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
            schemaPath={spawnSchemaPath}
            uiSchema={spawnUiSchema}
            renderer={materialRenderer}
            initialState={parsedData}
          />
        )}
      </FlexBox>
    </>
  );
}
