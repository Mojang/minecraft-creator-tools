export default class ComponentBase {
  id?: string;
  [propertyId: string]: string | number | number[] | bigint | bigint[] | boolean | object | undefined;
}
