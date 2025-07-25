import { Component, SyntheticEvent } from "react";
import "./MinecraftFilterClauseEditor.css";
import { Button, Dropdown, DropdownProps, FormInput, InputProps } from "@fluentui/react-northstar";
import Database from "../minecraft/Database";
import Utilities from "../core/Utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClose } from "@fortawesome/free-solid-svg-icons";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import DataFormUtilities from "./DataFormUtilities";
import { FieldDataType } from "./IField";
import { MinecraftFilterClause } from "../minecraft/jsoncommon/MinecraftFilterClause";

export interface IMinecraftFilterClauseEditorProps {
  data: MinecraftFilterClause;
  displayCloseButton: boolean;
  displayNarrow?: boolean;
  filterContextId: string;
  onChange?: (data: IMinecraftFilterClauseEditorProps) => void;
  onClose?: (data: IMinecraftFilterClauseEditorProps) => void;
}

interface IMinecraftFilterClauseEditorState {
  test: string;
  subject: string;
  value: string | number | boolean;
  operator?: string;
  filterIds?: string[];
}

export default class MinecraftFilterClauseEditor extends Component<
  IMinecraftFilterClauseEditorProps,
  IMinecraftFilterClauseEditorState
> {
  constructor(props: IMinecraftFilterClauseEditorProps) {
    super(props);

    this._handleOperatorChange = this._handleOperatorChange.bind(this);
    this._handleSubjectChange = this._handleSubjectChange.bind(this);
    this._handleTestChange = this._handleTestChange.bind(this);
    this._handleValueChange = this._handleValueChange.bind(this);
    this._handleCloseClick = this._handleCloseClick.bind(this);
    this._load = this._load.bind(this);

    if (props.data) {
      this.state = {
        operator: props.data.operator,
        test: props.data.test,
        subject: props.data.subject,
        value: props.data.value,
      };
    } else {
      this.state = {
        operator: "==",
        test: "",
        subject: "",
        value: "",
      };
    }
  }

  componentDidMount(): void {
    this._load();
  }

  async _load() {
    const formsFolder = await Database.getFormsFolder("entityfilters");

    const filterTypes: string[] = [];

    for (const fileName in formsFolder.files) {
      if (fileName.endsWith(".form.json")) {
        const baseName = fileName.substring(0, fileName.length - 10);

        await Database.ensureFormLoaded("entityfilters", baseName);

        filterTypes.push(baseName);
      }
    }

    this.setState({
      test: this.state.test,
      subject: this.state.subject,
      value: this.state.value,
      filterIds: filterTypes,
    });
  }

  async _handleOperatorChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data === null || data === undefined || !this.state || data.value === null || !(data.value as any).key) {
      return;
    }

    this._updateProp(this.state.test, this.state.subject, this.state.value, (data.value as any).key);
  }

  async _handleSubjectChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data === null || data === undefined || !this.state || !data.value || !(data.value as any).key) {
      return;
    }

    this._updateProp(this.state.test, (data.value as any).key, this.state.value, this.state.operator);
  }

  async _handleTestChange(
    event: React.MouseEvent<Element, MouseEvent> | React.KeyboardEvent<Element> | null,
    data: DropdownProps
  ) {
    if (data === null || data === undefined || !this.state || data.value === null || !(data.value as any).key) {
      return;
    }

    this._updateProp((data.value as any).key, this.state.subject, this.state.value, this.state.operator);
  }

  _handleValueChange(
    event: SyntheticEvent<HTMLElement, Event> | React.KeyboardEvent<Element> | null,
    data: (InputProps & { value: string }) | undefined
  ) {
    if (event === null || data === null || data === undefined || !this.state) {
      return;
    }

    let newMin: string | number = data.value;

    if (this.state.test) {
      let test = this.state.test;

      if (test.startsWith("minecraft:")) {
        test = test.substring(10);
      }

      const form = Database.getForm("entityfilters", test);

      if (form) {
        const valueField = DataFormUtilities.getFieldById(form, "value");

        if (valueField) {
          if (valueField.dataType === FieldDataType.float) {
            try {
              newMin = parseFloat(data.value);
            } catch (e) {}
          } else if (valueField.dataType === FieldDataType.int) {
            try {
              newMin = parseInt(data.value);
            } catch (e) {}
          }

          if (newMin !== undefined && typeof newMin === "number" && isNaN(newMin)) {
            newMin = data.value;
          }
        }
      }
    }

    this._updateProp(this.state.test, this.state.subject, newMin, this.state.operator);
  }

  _updateProp(test: string, subject: string, value: string | number | boolean, operator?: string) {
    if (this.props.onChange) {
      const newProps = {
        data: {
          test: test,
          subject: subject,
          value: value,
          operator: operator,
        },
        displayCloseButton: this.props.displayCloseButton,
        filterContextId: this.props.filterContextId,
      };

      this.props.onChange(newProps);
    }

    this.props.data.operator = operator;
    this.props.data.subject = subject;
    this.props.data.value = value;
    this.props.data.test = test;

    this.setState({
      test: test,
      subject: subject,
      value: value,
      operator: operator,
      filterIds: this.state.filterIds,
    });
  }

  _handleCloseClick() {
    if (this.props.onClose) {
      this.props.onClose(this.props);
    }
  }

  render() {
    let curValue: string = "";

    if (!this.state.filterIds) {
      return <div>Loading...</div>;
    }

    if (this.state) {
      if (this.state.value) {
        curValue = this.state.value.toString();
      }
    } else if (this.props && this.props.data) {
      curValue = this.props.data.value.toString();
    }

    const filterItems: { key: string; content: any }[] = [];

    if (this.state.filterIds) {
      for (const filter of this.state.filterIds) {
        const form = Database.getForm("entityfilters", filter);

        let descript = Utilities.humanifyMinecraftName(filter);

        if (form && form.description) {
          descript = MinecraftUtilities.shortenFilterDescription(descript);
        }

        filterItems.push({
          key: filter,
          content: (
            <div title={filter + " - " + descript} className="mificl-choice">
              <b>{filter}</b>
              <span> - {descript}</span>
            </div>
          ),
        });
      }
    }
    let closeButtonSpace = <></>;

    if (this.props.displayCloseButton) {
      closeButtonSpace = (
        <div className="mificl-cell">
          <Button className="mificl-closeButton" onClick={this._handleCloseClick}>
            <FontAwesomeIcon icon={faClose} className="fa-md" />
          </Button>
        </div>
      );
    }

    const form = Database.getForm("entityfilters", this.state.test);

    let eq = <></>;

    if (!form || !form.tags || !form.tags.includes("standalone")) {
      eq = (
        <div className="mificl-cell">
          <Dropdown
            items={[
              {
                key: "!=",
                content: "!= (not equals)",
              },
              {
                key: "<",
                content: "<  (less than)",
              },
              {
                key: "<=",
                content: "<= (less than or equals)",
              },
              {
                key: "=",
                content: "= (equals)",
              },
              {
                key: ">",
                content: "> (greater than)",
              },
              {
                key: ">=",
                content: ">= (greater than or equals)",
              },
            ]}
            defaultValue="=="
            value={this.state.operator}
            placeholder="=="
            onChange={this._handleOperatorChange}
          />
        </div>
      );
    }
    let val = <></>;

    if (!form || !form.tags || !form.tags.includes("standalone")) {
      val = (
        <div className="mificl-cell">
          <FormInput
            id="value"
            className="mificl-input"
            defaultValue={curValue}
            value={curValue}
            onChange={this._handleValueChange}
          />
        </div>
      );
    }

    let descript = "";

    if (form && form.description) {
      descript = MinecraftUtilities.shortenFilterDescription(form.description);
    }

    let prefix = "mificl-";

    if (this.props.displayNarrow) {
      prefix = "mificln-";
    }

    return (
      <div className={prefix + "outer"}>
        <div className={prefix + "inner"}>
          <div className={prefix + "cell"}>
            <Dropdown
              items={[
                {
                  key: "self",
                  content: "Self",
                },
                {
                  key: "other",
                  content: "Other",
                },
              ]}
              value={this.state.subject}
              defaultValue={this.state.subject}
              placeholder="Self"
              onChange={this._handleSubjectChange}
            />
          </div>
          <div className={prefix + "cell " + prefix + "test"}>
            <Dropdown
              items={filterItems}
              defaultValue={this.state.test}
              value={this.state.test}
              onChange={this._handleTestChange}
            />
            <div className={prefix + "descript"}>{descript}</div>
          </div>
          {eq}
          {val}
          {closeButtonSpace}
        </div>
      </div>
    );
  }
}
