import { Component } from "react";
import IFileProps from "./IFileProps";
import IFile from "../storage/IFile";
import "./DocumentedScriptEnumEditor.css";
import DocumentedScriptEnum from "../minecraft/docs/DocumentedScriptEnum";
import DataForm, { IDataFormProps } from "../dataformux/DataForm";
import Database from "../minecraft/Database";
import Project from "../app/Project";
import { ThemeInput } from "@fluentui/react-northstar";
import StorageUtilities from "../storage/StorageUtilities";
import { FieldDataType } from "../dataform/IField";
import IProperty from "../dataform/IProperty";
import Log from "../core/Log";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import CreatorTools from "../app/CreatorTools";

interface IDocumentedScriptEnumEditorProps extends IFileProps {
  heightOffset: number;
  theme: ThemeInput<any>;
  typesReadOnly: boolean;
  docsReadOnly: boolean;
  docScriptEnum: DocumentedScriptEnum;
  creatorTools: CreatorTools;
  project: Project;
  onDocumentedScriptEnumUpdate?: (docEnum: DocumentedScriptEnum) => void;
}

interface IDocumentedScriptEnumEditorState {
  docScriptEnumToEdit: DocumentedScriptEnum;
  isLoaded: boolean;
}

export default class DocumentedScriptEnumEditor extends Component<
  IDocumentedScriptEnumEditorProps,
  IDocumentedScriptEnumEditorState
> {
  constructor(props: IDocumentedScriptEnumEditorProps) {
    super(props);

    this._handleDataFormPropertyChange = this._handleDataFormPropertyChange.bind(this);
  }

  async persist(): Promise<boolean> {
    return await this.props.docScriptEnum.persist();
  }

  static getDerivedStateFromProps(props: IDocumentedScriptEnumEditorProps, state: IDocumentedScriptEnumEditorState) {
    if (state === undefined || state === null) {
      state = {
        docScriptEnumToEdit: props.docScriptEnum,
        isLoaded: false,
      };

      return state;
    }

    if (props.docScriptEnum !== state.docScriptEnumToEdit) {
      state.docScriptEnumToEdit = props.docScriptEnum;
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
    await this.props.docScriptEnum.load();

    await Database.ensureFormLoaded("documentation", "script_enum");

    this.setState({
      docScriptEnumToEdit: this.state.docScriptEnumToEdit,
      isLoaded: true,
    });
  }

  _handleDataFormPropertyChange(props: IDataFormProps, property: IProperty, newValue: any) {
    if (props.tagData && props.directObject) {
      const file = props.tagData as IFile;

      file.setObjectContentIfSemanticallyDifferent(props.directObject);

      this.props.docScriptEnum.generateUndocumentedCount();

      if (this.props.onDocumentedScriptEnumUpdate) {
        this.props.onDocumentedScriptEnumUpdate(this.props.docScriptEnum);
      }
    }
  }

  render() {
    if (this.props.setActivePersistable !== undefined) {
      this.props.setActivePersistable(this);
    }

    if (this.state && !this.state.isLoaded) {
      this.doLoad();
      return <div>Loading...</div>;
    }

    const form = Database.getForm("documentation", "script_enum");

    if (!form) {
      return <div>Loading...</div>;
    }

    const denum = this.props.docScriptEnum;

    const memberForms = [];

    const infoJsons = denum.infoJsonFiles;

    if (infoJsons) {
      for (const infoJsonName in infoJsons) {
        const infoJsonFile = infoJsons[infoJsonName];

        let jsonObject = StorageUtilities.getJsonObject(infoJsonFile);

        if (jsonObject === undefined) {
          jsonObject = {};
        }

        const infoForm = {
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
        const indentLevel = 0;

        if (infoJsonName === "_enum") {
          title = "Enum Description";

          if (
            this.props.docScriptEnum.docEnum.raw_tsdoc_text &&
            this.props.docScriptEnum.docEnum.raw_tsdoc_text.length > 2
          ) {
            subTitle =
              "Default Description: " +
              MinecraftUtilities.cleanUpScriptDescription(this.props.docScriptEnum.docEnum.raw_tsdoc_text);
          }
        } else {
          const constant = this.props.docScriptEnum.getConstant(infoJsonName);

          if (constant && constant.raw_tsdoc_text && constant.raw_tsdoc_text.length > 2) {
            subTitle = "Default Description: " + MinecraftUtilities.cleanUpScriptDescription(constant.raw_tsdoc_text);
          }
        }

        Log.assert(jsonObject !== undefined && jsonObject !== null, "Could not find data object");

        memberForms.push(
          <div
            className="dsee-enumCard"
            key={"DSEEC" + infoJsonFile.storageRelativePath}
            style={{
              backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
              color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
            }}
          >
            <DataForm
              tagData={infoJsonFile}
              displayTitle={true}
              title={title}
              subTitle={subTitle}
              theme={this.props.theme}
              displaySubTitle={subTitle !== undefined}
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
        className="dsee-area"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
        }}
      >
        <div className="dsee-header">{denum.id}</div>
        <div className="dsee-enumProps">
          <DataForm
            definition={form}
            directObject={denum}
            theme={this.props.theme}
            readOnly={this.props.typesReadOnly}
            objectKey={denum.id}
          ></DataForm>
        </div>
        <div className="dsee-enumProps">{memberForms}</div>
      </div>
    );
  }
}
