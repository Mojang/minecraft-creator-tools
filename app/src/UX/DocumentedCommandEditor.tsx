import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./DocumentedCommandEditor.css";
import DocumentedCommand from "../minecraft/docs/DocumentedCommand";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import Database from "../minecraft/Database";
import CartoApp from "../app/CartoApp";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";
import StorageUtilities from "../storage/StorageUtilities";
import IField, { FieldDataType } from "../dataform/IField";
import IProperty from "../dataform/IProperty";
import IFormDefinition from "../dataform/IFormDefinition";

interface IDocumentedCommandEditorProps extends IFileProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  typesReadOnly: boolean;
  docsReadOnly: boolean;
  docCommand: DocumentedCommand;
  carto: CartoApp;
  project: Project;
}

interface IDocumentedCommandEditorState {
  docCommandToEdit: DocumentedCommand;
  isLoaded: boolean;
}

export default class DocumentedCommandEditor extends Component<
  IDocumentedCommandEditorProps,
  IDocumentedCommandEditorState
> {
  constructor(props: IDocumentedCommandEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
  }

  async persist() {
    await this.props.docCommand.persist();
  }

  static getDerivedStateFromProps(props: IDocumentedCommandEditorProps, state: IDocumentedCommandEditorState) {
    if (state === undefined || state === null) {
      state = {
        docCommandToEdit: props.docCommand,
        isLoaded: false,
      };

      return state;
    }

    if (props.docCommand !== state.docCommandToEdit) {
      state.docCommandToEdit = props.docCommand;
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
    await this.props.docCommand.load();

    await Database.ensureFormLoaded("documented_command");
    await Database.ensureFormLoaded("command_overload");
    await Database.ensureFormLoaded("command_argument");
    await Database.ensureFormLoaded("command_value");

    this.setState({
      docCommandToEdit: this.state.docCommandToEdit,
      isLoaded: true,
    });
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      const newData = JSON.stringify(props.directObject, null, 2);

      file.setContent(newData);
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

    const dcommand = this.props.docCommand;
    const form = Database.getForm("documented_command");

    const coreForms: any[] = [];
    const localEnumForms: any[] = [];
    const overloadSubfields: { [keyName: string]: IField } = {};
    const argumentSubfields: { [keyName: string]: IField } = {};
    const infoJsons = dcommand.infoJsonFiles;

    const overloads = dcommand.getOverloads();

    for (const overload of overloads) {
      let strDescrip = "";

      for (const param of overload.params) {
        if (param.name && param.type && param.type.name) {
          if (strDescrip.length > 0) {
            strDescrip += " ";
          }

          strDescrip += param.name + "(" + param.type.name + ")";
        }
      }

      if (overload.name && strDescrip.length > 0) {
        overloadSubfields[overload.name] = {
          id: overload.name,
          title: strDescrip,
          dataType: FieldDataType.string,
        };
      }
    }

    const allCommandArgs = dcommand.getArguments();
    for (const argName in allCommandArgs) {
      const arg = allCommandArgs[argName];

      if (arg && argName) {
        argumentSubfields[arg.name] = {
          id: arg.name,
          title: arg.name + " (" + arg.type.name + ")",
          dataType: FieldDataType.string,
        };
      }
    }

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
        let indentLevel = 0;

        let addFormToCollection: any[] = coreForms;

        if (infoJsonName === "_command") {
          title = "Command Description";

          indentLevel = 0;

          infoForm.fields.push({
            id: "overloads",
            title: "Overloads",
            subForm: Database.getForm("command_overload"),
            subFields: overloadSubfields,
            objectArrayToSubFieldKey: "id",
            matchObjectArrayToSubFieldKey: true,
            dataType: FieldDataType.objectArray,
          });

          infoForm.fields.push({
            id: "arguments",
            title: "Arguments",
            subForm: Database.getForm("command_argument"),
            subFields: argumentSubfields,
            objectArrayToSubFieldKey: "name",
            matchObjectArrayToSubFieldKey: true,
            dataType: FieldDataType.objectArray,
          });
        } else {
          addFormToCollection = localEnumForms;
          const param = dcommand.getParam(infoJsonName);
          if (param) {
            title += " (" + param.type + ")";

            if (param.is_optional) {
              title += " (optional)";
            }
          }

          const enumItem = dcommand.commandSet.getEnum(infoJsonName);

          if (enumItem) {
            const valueSubfields: { [keyName: string]: IField } = {};
            const vals = enumItem.values;

            for (const val of vals) {
              valueSubfields[val.value] = {
                id: val.value,
                title: val.value,
                dataType: FieldDataType.string,
              };
            }

            infoForm.fields.push({
              id: "values",
              title: "Values",
              subForm: Database.getForm("command_value"),
              subFields: valueSubfields,
              objectArrayToSubFieldKey: "name",
              matchObjectArrayToSubFieldKey: true,
              dataType: FieldDataType.objectArray,
            });
          }
        }

        addFormToCollection.push(
          <div
            key={infoJsonName + "form"}
            className="dcomme-commandCard"
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            <DataForm
              tagData={infoJsonFile}
              displayTitle={true}
              title={title}
              indentLevel={indentLevel}
              definition={infoForm}
              theme={this.props.theme}
              objectKey={infoJsonFile.storageRelativePath}
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
        className="dcomme-area"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <div className="dcomme-header">{dcommand.id}</div>
        <div className="dcomme-commandProps">
          <DataForm
            definition={form}
            directObject={dcommand}
            readOnly={this.props.typesReadOnly}
            objectKey={dcommand.id}
            theme={this.props.theme}
            onPropertyChanged={this._handleDataFormPropertyChange}
          ></DataForm>
        </div>
        <div className="dcomme-commandProps">{coreForms}</div>
        <div className="dcomme-section">Enums specific to this type</div>
        <div className="dcomme-commandProps">{localEnumForms}</div>
      </div>
    );
  }
}
