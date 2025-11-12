import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ProjectDisplay.css";
import { Accordion, ThemeInput } from "@fluentui/react-northstar";

import ProjectExporter from "../app/ProjectExporter";
import StatusList from "./StatusList";

interface IProjectDisplayProps extends IAppProps {
  project: Project;
  theme: ThemeInput<any>;
  heightOffset: number;
}

interface IProjectDisplayState {}

export default class ProjectDisplay extends Component<IProjectDisplayProps, IProjectDisplayState> {
  constructor(props: IProjectDisplayProps) {
    super(props);

    this._update = this._update.bind(this);
    this._updateEvent = this._updateEvent.bind(this);
    this._pushGameTestReferenceMap = this._pushGameTestReferenceMap.bind(this);

    this._connectToProps();
  }

  componentDidUpdate(prevProps: IProjectDisplayProps, prevState: IProjectDisplayState) {
    if (prevProps !== undefined && prevProps.project !== undefined) {
      prevProps.project.onPropertyChanged.unsubscribe(this._update);
    }

    this._connectToProps();
  }

  _connectToProps() {
    if (this.props.project !== undefined && !this.props.project.onPropertyChanged.has(this._updateEvent)) {
      this.props.project.onPropertyChanged.subscribe(this._updateEvent);
    }
  }

  _updateEvent(project: Project, propertyName: string) {
    this.forceUpdate();
  }

  _update() {
    this.forceUpdate();
  }

  _pushGameTestReferenceMap() {
    ProjectExporter.generateAndInvokeFlatPackRefMCWorld(this.props.creatorTools, this.props.project);
  }

  render() {
    if (this.props === undefined) {
      return <></>;
    }

    let statusArea = <></>;

    let versionMajor = this.props.project.versionMajor;

    if (versionMajor === undefined) {
      versionMajor = 0;
    }

    let versionMinor = this.props.project.versionMinor;

    if (versionMinor === undefined) {
      versionMinor = 0;
    }

    let versionPatch = this.props.project.versionPatch;

    if (versionPatch === undefined) {
      versionPatch = 1;
    }

    const height = "calc(100vh - " + (this.props.heightOffset + 120) + "px)";

    if (this.props.project.messages) {
      statusArea = (
        <div className="pdisp-statusArea">
          <StatusList
            theme={this.props.theme}
            creatorTools={this.props.creatorTools}
            status={this.props.project.messages}
          />
        </div>
      );
    }

    return (
      <div
        className="pdisp-outer"
        style={{
          backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background2,
          color: this.props.theme.siteVariables?.colorScheme.brand.foreground2,
        }}
      >
        <div
          className="pdisp-header"
          style={{
            backgroundColor: this.props.theme.siteVariables?.colorScheme.brand.background1,
            color: this.props.theme.siteVariables?.colorScheme.brand.foreground1,
          }}
        >
          {this.props.project.title}
        </div>
        <div
          className="pdisp-grid"
          style={{
            maxHeight: height,
          }}
        >
          <div className="pdisp-descriptionlabel">Description</div>
          <div className="pdisp-descriptioninput">
            <div>{this.props.project.description}</div>
          </div>
          {statusArea}
          <div className="pdisp-versionlabel">Version</div>
          <div className="pdisp-versioninput">
            <div className="pdisp-versioninputline">
              <span>{versionMajor + "."}</span>
              <span>{versionMinor + "."}</span>
              <span>{versionPatch + ""}</span>
            </div>
          </div>

          <div className="pdisp-advancedArea">
            <Accordion
              defaultActiveIndex={[-1]}
              panels={[
                {
                  title: "Advanced",
                  content: (
                    <div key="adv" className="pdisp-advgrid">
                      <div className="pdisp-bpuniqueidlabel">Behavior Pack Unique Id</div>
                      <div className="pdisp-bpuniqueidinput">
                        <div>{this.props.project.defaultBehaviorPackUniqueId}</div>
                      </div>
                      <div className="pdisp-rpuniqueidlabel">Resource Pack Unique Id</div>
                      <div className="pdisp-rpuniqueidinput">
                        <div>{this.props.project.defaultResourcePackUniqueId}</div>
                      </div>
                      <div className="pdisp-datauniqueidlabel">Data Unique Id</div>
                      <div className="pdisp-datauniqueidinput">
                        <div>{this.props.project.defaultDataUniqueId}</div>
                      </div>
                      <div className="pdisp-scriptuniqueidlabel">Script Unique Id</div>
                      <div className="pdisp-scriptuniqueidinput">
                        <div>{this.props.project.defaultScriptModuleUniqueId}</div>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
        <div className="pdisp-bedrock">&#160;</div>
      </div>
    );
  }
}
