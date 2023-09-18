export enum ItemAnnotationType {
  warning = 1,
  error = 2,
}

export default interface ItemAnnotation {
  path?: string;
  type: ItemAnnotationType;
  message: string;
}
