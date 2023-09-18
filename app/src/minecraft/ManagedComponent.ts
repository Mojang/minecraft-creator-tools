import { EventDispatcher } from "ste-events";
import IComponent from "./IComponent";
import IManagedComponent from "./IManagedComponent";

export class ManagedComponent implements IManagedComponent {
  private _data: IComponent | string | number | undefined;
  id: string;

  private _onPropertyChanged = new EventDispatcher<ManagedComponent, string>();

  public get onPropertyChanged() {
    return this._onPropertyChanged.asEvent();
  }

  constructor(id: string, data: IComponent | string | number) {
    this._data = data;
    this.id = id;
  }

  getData() {
    return this._data;
  }

  getProperty(id: string) {
    return (this._data as any)[id] as any;
  }

  setProperty(id: string, value: any) {
    (this._data as any)[id] = value;
  }
}
