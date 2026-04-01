import React, { Component } from "react";
import "./StatusList.css";
import IAppProps from "./IAppProps";
import Log, { LogItem } from "../../core/Log";
import Project from "../../app/Project";
import IStatus from "../../app/Status";
import GridEditor from "../shared/components/inputs/gridEditor/GridEditor";
import { DataUxColumn } from "../types/DataUx";
import { getThemeColors } from "../hooks/theme/useThemeColors";
import IProjectTheme from "../types/IProjectTheme";

interface IStatusListProps extends IAppProps {
  project?: Project;
  status: IStatus[];
  theme: IProjectTheme;
}

interface IStatusListState {
  activeOperations: number;
}

export default class StatusList extends Component<IStatusListProps, IStatusListState> {
  scrollArea: React.RefObject<HTMLDivElement>;
  private _isMountedInternal: boolean = false;

  constructor(props: IStatusListProps) {
    super(props);

    this.scrollArea = React.createRef();

    this._handleLogItemAdded = this._handleLogItemAdded.bind(this);
    this._update = this._update.bind(this);
    this.scrollToListBottom = this.scrollToListBottom.bind(this);

    this.state = {
      activeOperations: 0,
    };
  }

  _handleLogItemAdded(log: Log, item: LogItem) {
    this._update();
  }

  private _update() {
    if (this._isMountedInternal) {
      this.forceUpdate();

      window.setTimeout(this.scrollToListBottom, 1);
    }
  }

  componentDidMount(): void {
    this._isMountedInternal = true;
  }

  componentWillUnmount(): void {
    this._isMountedInternal = false;
  }

  scrollToListBottom() {
    if (this.scrollArea && this.scrollArea.current) {
      this.scrollArea.current.scrollTop = this.scrollArea.current.scrollHeight;
    }
  }

  render() {
    let interior = <></>;

    const columns: DataUxColumn[] | undefined = [
      {
        header: "Message",
        name: "message",
        sortable: true,
        resizable: true,
        filter: {
          type: "text",
        },
      },
      {
        header: "Context",
        name: "context",
        sortable: true,
        resizable: true,
        filter: {
          type: "text",
        },
      },
      {
        header: "Operation",
        name: "operation",
        sortable: true,
        resizable: true,
        filter: {
          type: "text",
        },
      },
      {
        header: "Time",
        name: "time",
        sortable: true,
        resizable: true,
        filter: {
          type: "date",
        },
      },
    ];

    const data = [];

    for (let i = 0; i < this.props.status.length; i++) {
      const statusItem = this.props.status[i];

      data.push({
        time: statusItem.time,
        message: statusItem.message,
        operation: statusItem.operation,
        context: statusItem.context,
      });
    }

    interior = (
      <div className="sl-gridOuter">
        <div
          className="sl-grid"
          ref={this.scrollArea}
          style={{
            borderColor: getThemeColors().background2,
            backgroundColor: getThemeColors().background4,
            color: getThemeColors().foreground2,
          }}
        >
          <GridEditor
            theme={this.props.theme}
            data={data}
            columns={columns}
            height={500}
            creatorTools={this.props.creatorTools}
            readOnly={true}
          />
        </div>
      </div>
    );

    return (
      <div className="sl-outer">
        <div className="sl-messageOuter">{interior}</div>
      </div>
    );
  }
}
