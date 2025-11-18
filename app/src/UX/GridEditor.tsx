import { Component } from "react";
import IFile from "../storage/IFile";
import "./GridEditor.css";
import React from "react";
import IPersistable from "./IPersistable";
import CreatorTools from "../app/CreatorTools";
import { ThemeInput } from "@fluentui/react-northstar";
import TuiGrid from "tui-grid";
import "tui-grid/dist/tui-grid.css";
import { OptColumn } from "tui-grid/types/options";

interface IGridEditorProps {
  file?: IFile;
  theme: ThemeInput<any>;
  initialContent?: Uint8Array;
  placeholder?: string;
  setActivePersistable?: (persistObject: IPersistable) => void;
  heightOffset?: number;
  height?: number;
  readOnly: boolean;
  columns?: OptColumn[];
  data?: any[];
  creatorTools: CreatorTools;
  onCellClick?: (newRowKey: number, columnName: string) => void;
  onCellDoubleClick?: (newRowKey: number, columnName: string) => void;
  onUpdateContent?: (newContent: Uint8Array) => void;
  onCommit?: (newContent: Uint8Array) => void;
}

interface IGridEditorState {
  fileToEdit?: IFile;
  content?: Uint8Array;
  isView: boolean;
}

export default class GridEditor extends Component<IGridEditorProps, IGridEditorState> {
  private rootElt: React.RefObject<HTMLDivElement>;
  private grid: TuiGrid | null = null;
  private gridElement: HTMLDivElement | null = null;

  constructor(props: IGridEditorProps) {
    super(props);
    this.rootElt = React.createRef();

    this._handleGridClick = this._handleGridClick.bind(this);
    this._handleGridDoubleClick = this._handleGridDoubleClick.bind(this);

    this.state = {
      fileToEdit: props.file,
      content: this.props.initialContent,
      isView: true,
    };

    this._updateGrid = this._updateGrid.bind(this);
  }

  componentDidMount() {
    this._addGrid();
  }

  _addGrid() {
    if (this.rootElt !== null && this.rootElt.current !== null) {
      if (this.grid) {
        this.disposeGrid();
      }

      while (this.rootElt.current.childNodes.length > 0) {
        this.rootElt.current.removeChild(this.rootElt.current.childNodes[0]);
      }

      this.gridElement = null;
      this.grid = null;

      TuiGrid.applyTheme("default", {
        area: {
          body: {
            background: this.props.theme.siteVariables?.colorScheme.brand.background2,
          },
        },
        selection: {
          background: this.props.theme.siteVariables?.colorScheme.brand.background3,
          border: this.props.theme.siteVariables?.colorScheme.brand.background2,
        },
        scrollbar: {
          background: this.props.theme.siteVariables?.colorScheme.brand.background1,
          thumb: this.props.theme.siteVariables?.colorScheme.brand.background3,
          emptySpace: this.props.theme.siteVariables?.colorScheme.brand.background2,
          border: this.props.theme.siteVariables?.colorScheme.brand.background3,
          active: this.props.theme.siteVariables?.colorScheme.brand.background4,
        },
        row: {
          even: {
            background: this.props.theme.siteVariables?.colorScheme.brand.background1,
          },
          hover: {
            background: "#ccc",
          },
        },
        cell: {
          normal: {
            background: this.props.theme.siteVariables?.colorScheme.brand.background2,
            border: this.props.theme.siteVariables?.colorScheme.brand.background4,
            showVerticalBorder: true,
            text: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
          },
          header: {
            background: this.props.theme.siteVariables?.colorScheme.brand.background4,
            border: this.props.theme.siteVariables?.colorScheme.brand.background3,
            showVerticalBorder: true,
            text: this.props.theme.siteVariables?.colorScheme.brand.foreground4,
          },
          rowHeader: {
            border: this.props.theme.siteVariables?.colorScheme.brand.background3,
            showVerticalBorder: true,
          },
          editable: {
            background: this.props.theme.siteVariables?.colorScheme.brand.background1,
          },
          selectedHeader: {
            background: this.props.theme.siteVariables?.colorScheme.brand.background4,
          },
          focused: {
            border: "#418ed4",
          },
          disabled: {
            text: this.props.theme.siteVariables?.colorScheme.brand.foreground3,
          },
        },
      });

      this.grid = new TuiGrid({
        usageStatistics: false,
        scrollX: true,
        scrollY: true,
        width: "auto",
        bodyHeight: "fitToParent",
        el: this.rootElt.current,
        columns: this.props.columns ? this.props.columns : [],
        data: this.props.data ? this.props.data : [],
      });

      this.grid.on("click", this._handleGridClick);
      this.grid.on("dblclick", this._handleGridDoubleClick);

      window.setTimeout(this._updateGrid, 1000);
    }
  }

  _handleGridClick(ev: any) {
    if (this.props.onCellClick) {
      this.props.onCellClick(ev.rowKey, ev.columnName);
    }
  }

  _handleGridDoubleClick(ev: any) {
    if (this.props.onCellDoubleClick) {
      this.props.onCellDoubleClick(ev.rowKey, ev.columnName);
    }
  }

  componentDidUpdate(prevProps: IGridEditorProps, prevState: IGridEditorState) {
    if (this.props.file !== prevProps.file) {
      if (this.grid && this.props.file) {
      } else if (this.gridElement && this.props.file) {
      } else {
        this._addGrid();
      }
    } else if (
      this.props.data &&
      this.props.columns &&
      this.props.data !== prevProps.data &&
      this.props.columns !== prevProps.columns
    ) {
      this._addGrid();
    } else if (this.props.data && this.props.data !== prevProps.data) {
      if (this.grid && this.props.data) {
        this.grid.resetData(this.props.data);
      } else if (this.gridElement && this.props.file) {
      } else {
        this._addGrid();
      }
    } else if (this.state.isView !== prevState.isView) {
      this._addGrid();
    }
  }

  _updateGrid() {
    if (this.grid === null) {
      return;
    }
  }

  componentWillUnmount() {
    this.disposeGrid();
  }

  disposeGrid() {
    if (this.grid) {
      this.grid.destroy();
      this.grid = null;
    }
  }

  static getDerivedStateFromProps(props: IGridEditorProps, state: IGridEditorState) {
    if (state === undefined || state === null) {
      state = {
        fileToEdit: props.file,
        isView: true,
      };

      return state;
    }
    if (props.file !== state.fileToEdit) {
      state.fileToEdit = props.file;
      return state;
    }

    return null; // No change to state
  }

  async persist(): Promise<boolean> {
    return false;
  }

  render() {
    let height = "500px";

    if (this.props.heightOffset) {
      height = "calc(100vh - " + this.props.heightOffset + "px)";
    } else if (this.props.height) {
      height = this.props.height + "px";
    }

    return (
      <div className="ge-outer">
        <div
          className="ge-contents"
          style={{
            height: height,
          }}
          ref={this.rootElt}
        ></div>
      </div>
    );
  }
}
