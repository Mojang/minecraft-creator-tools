import { IEvent } from "ste-events";

export default interface IGetSetPropertyObject {
  onPropertyChanged: IEvent<IGetSetPropertyObject, string>;

  getProperty(id: string): any;
  setProperty(id: string, value: any): void;
}
