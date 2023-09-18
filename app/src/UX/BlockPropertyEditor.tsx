import { Component } from "react";
import IAppProps from "./IAppProps";
import Block from "../minecraft/Block";
import "./BlockPropertyEditor.css";
import DataForm, { IDataFormProps } from "../dataform/DataForm";
import { BlockPropertyType } from "../minecraft/IBlockTypePropertyData";
import { ICommander } from "./ICommand";
import IFormDefinition from "../dataform/IFormDefinition";
import IField, { FieldDataType, FieldExperienceType } from "../dataform/IField";
import IProperty from "../dataform/IProperty";
import Utilities from "../core/Utilities";

interface IBlockPropertyEditorProps extends IAppProps {
  blocks: Block[];
  commander: ICommander;
}

interface IBlockPropertyEditorState {}

export default class BlockPropertyEditor extends Component<IBlockPropertyEditorProps, IBlockPropertyEditorState> {
  constructor(props: IBlockPropertyEditorProps) {
    super(props);

    this._handleBlockChanged = this._handleBlockChanged.bind(this);
    this._handlePropertyChanged = this._handlePropertyChanged.bind(this);
  }

  componentDidUpdate(prevProps: IBlockPropertyEditorProps, prevState: IBlockPropertyEditorState) {
    if (prevProps !== undefined) {
      for (let i = 0; i < prevProps.blocks.length; i++) {
        prevProps.blocks[i].onPropertyChanged.unsubscribe(this._handleBlockChanged);
        prevProps.blocks[i].onTypeChanged.unsubscribe(this._handleBlockChanged);
      }
    }

    if (this.props !== undefined) {
      for (let i = 0; i < this.props.blocks.length; i++) {
        this.props.blocks[i].onPropertyChanged.subscribe(this._handleBlockChanged);
        this.props.blocks[i].onTypeChanged.subscribe(this._handleBlockChanged);
      }
    }
  }

  _handleBlockChanged() {
    this.forceUpdate();
  }

  _handlePropertyChanged(props: IDataFormProps, property: IProperty, newValue: any) {
    const protoBlock = this.props.blocks[0];

    if (protoBlock === undefined || property.id === undefined) {
      return;
    }

    protoBlock.getProperty(property.id).value = newValue;
  }

  render() {
    const protoBlock = this.props.blocks[0];

    const blockType = protoBlock.bedrockType;

    const formDef: IFormDefinition = {
      title: "Block Editor",
      id: "blockEditor",
      fields: [],
    };

    if (blockType !== undefined) {
      const baseType = blockType.baseType;

      if (baseType.data.properties !== undefined) {
        for (let i = 0; i < baseType.data.properties.length; i++) {
          const propData = baseType.data.properties[i];
          const propName = propData.name;

          const property = baseType.getProperty(propName);
          let title = Utilities.humanifyMinecraftName(propData.name);

          if (property !== undefined) {
            if (property.title !== undefined) {
              title = property.title;
            }

            if (
              (property.type === BlockPropertyType.stringEnum ||
                property.type === BlockPropertyType.intEnum ||
                property.type === BlockPropertyType.boolean) &&
              property.values !== undefined
            ) {
              let propType = FieldDataType.string;

              if (property.type === BlockPropertyType.boolean) {
                propType = FieldDataType.boolean;
              }

              if (property.type === BlockPropertyType.intEnum) {
                propType = FieldDataType.intEnum;
              }

              const field: IField = {
                title: title,
                id: propName,
                dataType: propType,
                experienceType: FieldExperienceType.dropdown,
                choices: [],
              };

              for (let i = 0; i < property.values.length; i++) {
                const propVal = property.values[i];

                if (propVal.id !== null && field.choices) {
                  field.choices.push({
                    id: propVal.id,
                    title: propVal.title,
                  });
                }
              }

              formDef.fields.push(field);
            } else if (
              (property.type === BlockPropertyType.intBoolean || property.type === BlockPropertyType.boolean) &&
              property.values !== undefined
            ) {
              const field: IField = {
                title: title,
                id: propName,
                dataType: FieldDataType.boolean,
                experienceType: FieldExperienceType.text,
                choices: [],
              };

              // const bool = protoBlock.getPropertyBoolean(propName, false);

              formDef.fields.push(field);
            } else {
              const field: IField = {
                title: title,
                id: propName,
                dataType: FieldDataType.boolean,
                experienceType: FieldExperienceType.text,
                choices: [],
              };

              // const bool = protoBlock.getPropertyBoolean(propName, false);

              formDef.fields.push(field);
            }
          }
        }
      }
    }

    return (
      <div className="bpe-outer">
        <DataForm
          definition={formDef}
          dataPropertyObject={protoBlock}
          readOnly={false}
          objectKey={protoBlock.x + "." + protoBlock.y + "." + protoBlock.z + protoBlock.typeName}
          onPropertyChanged={this._handlePropertyChanged}
        ></DataForm>
      </div>
    );
  }
}
