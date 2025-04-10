import IProjectVariant from "./IProjectVariant";
import Project from "./Project";

export default class ProjectVariant {
  private _data: IProjectVariant;

  private _isDefault: boolean;
  private _project: Project;

  constructor(parent: Project, data: IProjectVariant) {
    this._project = parent;
    this._data = data;

    this._isDefault = this._data.label === "";
  }
}
