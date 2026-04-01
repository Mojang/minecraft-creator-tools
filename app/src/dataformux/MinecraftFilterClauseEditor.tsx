import { Component, ChangeEvent } from "react";
import "./MinecraftFilterClauseEditor.css";
import { Button, TextField, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import Database from "../minecraft/Database";
import Utilities from "../core/Utilities";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import MinecraftUtilities from "../minecraft/MinecraftUtilities";
import DataFormUtilities from "./../dataform/DataFormUtilities";
import { FieldDataType } from "./../dataform/IField";
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
        operator: "=",
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

  async _handleOperatorChange(event: SelectChangeEvent<string>) {
    if (!this.state || !event.target.value) {
      return;
    }

    this._updateProp(this.state.test, this.state.subject, this.state.value, event.target.value);
  }

  async _handleSubjectChange(event: SelectChangeEvent<string>) {
    if (!this.state || !event.target.value) {
      return;
    }

    this._updateProp(this.state.test, event.target.value, this.state.value, this.state.operator);
  }

  async _handleTestChange(event: SelectChangeEvent<string>) {
    if (!this.state || !event.target.value) {
      return;
    }

    this._updateProp(event.target.value, this.state.subject, this.state.value, this.state.operator);
  }

  _handleValueChange(event: ChangeEvent<HTMLInputElement>) {
    if (!this.state) {
      return;
    }

    let newMin: string | number = event.target.value;

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
              newMin = parseFloat(event.target.value);
            } catch (e) {}
          } else if (valueField.dataType === FieldDataType.int) {
            try {
              newMin = parseInt(event.target.value);
            } catch (e) {}
          }

          if (newMin !== undefined && typeof newMin === "number" && isNaN(newMin)) {
            newMin = event.target.value;
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

    let prefix = "mificl-";

    if (this.props.displayNarrow) {
      prefix = "mificln-";
    }

    if (this.props.displayCloseButton) {
      const closeCellClass = this.props.displayNarrow ? "mificln-closeCell" : prefix + "cell";
      closeButtonSpace = (
        <div className={closeCellClass}>
          <Button className="mificl-closeButton" onClick={this._handleCloseClick}>
            <FontAwesomeIcon icon={faXmark} className="fa-md" />
          </Button>
        </div>
      );
    }

    const form = Database.getForm("entityfilters", this.state.test);

    let eq = <></>;

    if (!form || !form.tags || !form.tags.includes("standalone")) {
      eq = (
        <div className={prefix + "cell"}>
          <Select
            size="small"
            value={this.state.operator === "==" ? "=" : this.state.operator || "="}
            onChange={this._handleOperatorChange}
          >
            <MenuItem value="!=">!= (not equals)</MenuItem>
            <MenuItem value="<">&lt; (less than)</MenuItem>
            <MenuItem value="<=">&lt;= (less than or equals)</MenuItem>
            <MenuItem value="=">= (equals)</MenuItem>
            <MenuItem value=">">&gt; (greater than)</MenuItem>
            <MenuItem value=">=">&gt;= (greater than or equals)</MenuItem>
          </Select>
        </div>
      );
    }
    let val = <></>;

    if (!form || !form.tags || !form.tags.includes("standalone")) {
      val = (
        <div className={prefix + "cell"}>
          <TextField
            id="value"
            className="mificl-input"
            size="small"
            variant="outlined"
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

    const narrowClose = this.props.displayNarrow ? closeButtonSpace : <></>;
    const inlineClose = this.props.displayNarrow ? <></> : closeButtonSpace;

    return (
      <div className={prefix + "outer"}>
        {narrowClose}
        <div className={prefix + "inner"}>
          <div className={prefix + "cell"}>
            <Select size="small" value={this.state.subject || "self"} onChange={this._handleSubjectChange}>
              <MenuItem value="self">Self</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </div>
          <div className={prefix + "cell " + prefix + "test"}>
            <Select size="small" value={this.state.test || ""} onChange={this._handleTestChange}>
              {filterItems.map((item) => (
                <MenuItem key={item.key} value={item.key}>
                  {item.content}
                </MenuItem>
              ))}
            </Select>
            <div className={prefix + "descript"}>{descript}</div>
          </div>
          {eq}
          {val}
          {inlineClose}
        </div>
      </div>
    );
  }
}
