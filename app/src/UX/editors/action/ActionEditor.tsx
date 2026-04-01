import { Component } from "react";
import "./ActionEditor.css";
import Action from "../../../actions/Action";
import DataForm from "../../../dataformux/DataForm";
import Database from "../../../minecraft/Database";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { getThemeColors } from "../../hooks/theme/useThemeColors";
import Project from "../../../app/Project";
import IProjectTheme from "../../types/IProjectTheme";

interface IActionEditorProps {
  action: Action;
  project: Project;
  theme: IProjectTheme;
  ambientSelectedPoint?: number[] | undefined;
  onRemove?: (action: Action) => void;
}

interface IActionEditorState {
  actionToEdit: Action;
  isLoaded: boolean;
}

export default class ActionEditor extends Component<IActionEditorProps, IActionEditorState> {
  constructor(props: IActionEditorProps) {
    super(props);

    this._handleCloseClick = this._handleCloseClick.bind(this);
  }

  componentDidMount() {
    if (this.state && !this.state.isLoaded) {
      this.doLoad();
    }
  }

  static getDerivedStateFromProps(props: IActionEditorProps, state: IActionEditorState) {
    if (state === undefined || state === null) {
      state = {
        actionToEdit: props.action,
        isLoaded: false,
      };

      return state;
    }

    if (props.action !== state.actionToEdit) {
      state.actionToEdit = props.action;
      state.isLoaded = false;

      return state;
    }

    return null; // No change to state
  }

  async doLoad() {
    await Database.ensureFormLoaded("action", this.props.action.type);

    this.setState({
      actionToEdit: this.state.actionToEdit,
      isLoaded: true,
    });
  }

  _handleCloseClick() {
    if (this.props.onRemove) {
      this.props.onRemove(this.props.action);
    }
  }

  render() {
    if (!this.state || !this.state.isLoaded) {
      return <div>Loading...</div>;
    }

    const formDef = Database.getForm("action", this.props.action.type);

    if (!formDef) {
      return <div>(error: could not find form for {this.props.action.typeId})</div>;
    }

    const colors = getThemeColors();

    return (
      <div className="asae-area">
        <div
          className="asae-areaInner"
          style={{
            backgroundColor: colors.background2,
            color: colors.foreground2,
          }}
        >
          <div
            className="asae-actionsHeader"
            style={{
              backgroundColor: colors.background3,
              color: colors.foreground3,
            }}
          >
            {this.props.action.typeId}
          </div>
          <div
            className="asae-actionsClose"
            style={{
              backgroundColor: colors.background3,
              color: colors.foreground3,
            }}
            onClick={this._handleCloseClick}
          >
            <FontAwesomeIcon icon={faTimes} />
          </div>
        </div>
        <div className="asae-actionsForm">
          <DataForm
            definition={formDef}
            readOnly={false}
            project={this.props.project}
            lookupProvider={this.props.project}
            theme={this.props.theme}
            getsetPropertyObject={this.props.action}
            ambientSelectedPoint={this.props.ambientSelectedPoint}
          />
        </div>
      </div>
    );
  }
}
