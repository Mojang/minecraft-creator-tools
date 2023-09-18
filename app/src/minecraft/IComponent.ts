export default interface IComponent {
  [propertyId: string]: string | number | number[] | bigint | bigint[] | boolean | object | undefined;
}
