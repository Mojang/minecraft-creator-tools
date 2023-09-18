import { Component } from "react";
import IAppProps from "./IAppProps";
import Project from "../app/Project";
import "./ProjectDisplay.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Button, Accordion } from "@fluentui/react-northstar";

import { faMap } from "@fortawesome/free-solid-svg-icons";

import ProjectExporter from "../app/ProjectExporter";
import AppServiceProxy from "../core/AppServiceProxy";

interface IProjectDisplayProps extends IAppProps {
  project: Project;
  heightOffset: number;
}

interface IProjectDisplayState {}

export default class ProjectDisplay extends Component<IProjectDisplayProps, IProjectDisplayState> {
  constructor(props: IProjectDisplayProps) {
    super(props);

    this._update = this._update.bind(this);
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
    if (this.props.project !== undefined) {
      this.props.project.onPropertyChanged.subscribe(this._update);
    }
  }

  _update() {
    this.forceUpdate();
  }

  _pushGameTestReferenceMap() {
    ProjectExporter.generateAndInvokeFlatPackRefMCWorld(this.props.carto, this.props.project);
  }

  render() {
    const localTools = [];

    if (this.props === undefined) {
      return <></>;
    }

    if (this.props.carto.workingStorage !== null && AppServiceProxy.hasAppServiceOrDebug) {
      localTools.push(
        <Button
          content="Open GameTest test world"
          icon={<FontAwesomeIcon icon={faMap} className="fa-lg" />}
          onClick={this._pushGameTestReferenceMap}
          iconPosition="before"
          primary
        />
      );
    }

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

    return (
      <div className="pdisp-outer">
        <div className="pdisp-header">{this.props.project.title}</div>
        <div
          className="pdisp-grid"
          style={{
            minHeight: height,
            maxHeight: height,
          }}
        >
          <div className="pdisp-descriptionlabel">Description</div>
          <div className="pdisp-descriptioninput">
            <div>{this.props.project.description}</div>
          </div>
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
                  title: "Advanced stuff",
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
