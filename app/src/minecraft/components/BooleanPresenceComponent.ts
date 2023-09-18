import IComponent from "./../IComponent";

export default class BooleanPresenceComponent implements IComponent {
  id?: string;
  [propertyId: string]: string | number | number[] | bigint | bigint[] | boolean | object | undefined;
}
