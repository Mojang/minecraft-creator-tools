import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./DocumentedClassEditor.css";
import DocumentedClass from "../minecraft/docs/DocumentedClass";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import CartoApp from "../app/CartoApp";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";
import StorageUtilities from "../storage/StorageUtilities";
import IField, { FieldVisualExperience, FieldDataType } from "../dataform/IField";
import IProperty from "../dataform/IProperty";
import Log from "../core/Log";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import IFormDefinition from "../dataform/IFormDefinition";

interface IDocumentedClassEditorProps extends IFileProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  typesReadOnly: boolean;
  docsReadOnly: boolean;
  docClass: DocumentedClass;
  carto: CartoApp;
  project: Project;
  onDocumentedClassUpdate?: (docClass: DocumentedClass) => void;
}

interface IDocumentedClassEditorState {
  docClassToEdit: DocumentedClass;
  isLoaded: boolean;
}

export default class DocumentedClassEditor extends Component<IDocumentedClassEditorProps, IDocumentedClassEditorState> {
  constructor(props: IDocumentedClassEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
  }

  async persist() {
    await this.props.docClass.persist();
  }

  static getDerivedStateFromProps(props: IDocumentedClassEditorProps, state: IDocumentedClassEditorState) {
    if (state === undefined || state === null) {
      state = {
        docClassToEdit: props.docClass,
        isLoaded: false,
      };

      return state;
    }

    if (props.docClass !== state.docClassToEdit) {
      state.docClassToEdit = props.docClass;
      state.isLoaded = false;

      return state;
    }

    return null; // No change to state
  }

  componentDidMount() {
    if (this.state && !this.state.isLoaded) {
      this.doLoad();
    }
  }

  async doLoad() {
    await this.props.docClass.load();

    await Database.ensureFormLoaded("documented_class");
    await Database.ensureFormLoaded("simple_info_json");

    this.setState({
      docClassToEdit: this.state.docClassToEdit,
      isLoaded: true,
    });
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      const newData = JSON.stringify(props.directObject, null, 2);

      file.setContent(newData);

      this.props.docClass.generateUndocumentedCount();

      if (this.props.onDocumentedClassUpdate) {
        this.props.onDocumentedClassUpdate(this.props.docClass);
      }
    }
  }

  render() {
    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    if (Database.uxCatalog === null) {
      return <div>Loading...</div>;
    }

    if (this.state && !this.state.isLoaded) {
      this.doLoad();
    }

    const dclass = this.props.docClass;

    const form = Database.getForm("documented_class");

    const memberForms = [];

    const infoJsons = dclass.infoJsonFiles;

    if (infoJsons) {
      for (const infoJsonName in infoJsons) {
        const infoJsonFile = infoJsons[infoJsonName];

        let jsonObject = StorageUtilities.getJsonObject(infoJsonFile);

        if (jsonObject === undefined) {
          jsonObject = {};
        }

        const infoForm: IFormDefinition = {
          id: "field",
          fields: [
            {
              id: "description",
              title: "Description",
              dataType: FieldDataType.longFormString,
              validity: [{ comparison: "nonempty" }],
            },
          ],
        };

        const readOnly = this.props.docsReadOnly;

        let title = infoJsonName;
        let subTitle = undefined;
        let indentLevel = 0;

        if (infoJsonName === "_class") {
          title = "Class Description";

          if (this.props.docClass.docClass.raw_tsdoc_text) {
            subTitle =
              "Default Description: " +
              MinecraftUtilities.cleanUpScriptDescription(this.props.docClass.docClass.raw_tsdoc_text);
          }

          indentLevel = 0;
        } else {
          const func = dclass.getFunction(infoJsonName);

          if (func) {
            if (func.raw_tsdoc_text) {
              subTitle = "Default Description: " + MinecraftUtilities.cleanUpScriptDescription(func.raw_tsdoc_text);
            }

            if (func.arguments && func.arguments.length > 0) {
              const argsField: IField = {
                id: "arguments",
                title: "Arguments",
                subForm: Database.getForm("simple_info_json"),
                dataType: FieldDataType.keyedObjectCollection,
              };
              infoForm.fields.push(argsField);

              const allowedKeys = [];
              const subFields: { [name: string]: IField } = {};

              for (const arg of func.arguments) {
                allowedKeys.push(arg.name);

                subFields[arg.name] = {
                  id: arg.name,
                  title: arg.name + " (" + arg.type.name + ")",
                  dataType: FieldDataType.object,
                };
              }

              argsField.allowedKeys = allowedKeys;
              argsField.subFields = subFields;
            }

            if (func.return_type) {
              if (func.return_type.is_errorable) {
                const throwsField: IField = {
                  id: "throws",
                  title: "Throws",
                  subForm: Database.getForm("simple_info_json"),
                  visualExperience: FieldVisualExperience.deemphasized,
                  dataType: FieldDataType.object,
                  undefinedIfEmpty: true,
                };

                infoForm.fields.push(throwsField);
              }

              let returnTypeName = func.return_type.name;

              if (returnTypeName !== undefined && returnTypeName !== "undefined") {
                if (returnTypeName === "promise" && func.return_type.promise_type) {
                  returnTypeName = "Promise<" + func.return_type.promise_type.name + ">";
                }

                const argsField: IField = {
                  id: "returns",
                  title: "Returns (" + returnTypeName + ")",
                  undefinedIfEmpty: true,
                  subForm: Database.getForm("simple_info_json"),
                  visualExperience: FieldVisualExperience.deemphasized,
                  dataType: FieldDataType.object,
                };

                infoForm.fields.push(argsField);
              }
            }
          } else {
            const prop = dclass.getProperty(infoJsonName);

            if (prop) {
              if (prop.raw_tsdoc_text) {
                subTitle = "Default Description: " + MinecraftUtilities.cleanUpScriptDescription(prop.raw_tsdoc_text);
              }
            }
          }
        }

        Log.assert(jsonObject !== undefined && jsonObject !== null, "Could not find data object");

        memberForms.push(
          <div
            className="dce-classCard"
            key={"DCEC" + infoJsonFile.storageRelativePath}
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            <DataForm
              tagData={infoJsonFile}
              displayTitle={true}
              title={title}
              displaySubTitle={subTitle !== undefined}
              theme={this.props.theme}
              subTitle={subTitle}
              objectKey={infoJsonFile.storageRelativePath}
              indentLevel={indentLevel}
              definition={infoForm}
              directObject={jsonObject}
              readOnly={readOnly}
              onPropertyChanged={this._handleDataFormPropertyChange}
            ></DataForm>
          </div>
        );
      }
    }

    return (
      <div
        className="dce-area"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <div className="dce-header">{dclass.id}</div>
        <div className="dce-classProps">
          <DataForm
            definition={form}
            directObject={dclass}
            theme={this.props.theme}
            readOnly={this.props.typesReadOnly}
            objectKey={dclass.id}
          ></DataForm>
        </div>
        <div className="dce-classProps">{memberForms}</div>
      </div>
    );
  }
}
