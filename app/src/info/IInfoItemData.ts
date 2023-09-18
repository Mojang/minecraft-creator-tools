export enum InfoItemType {
  testCompleteSuccess = 0,
  testCompleteFail = 1,
  info = 2,
  error = 3,
  warning = 4,
  internalProcessingError = 5,
  recommendation = 5,
}

export default interface IInfoItemData {
  itemType: InfoItemType;
  generatorId: string;
  generatorIndex: number;
  message: string;
  itemStoragePath: string | null | undefined;
  data: string | boolean | number | object | number[] | undefined;
  itemId: string | undefined;
  content: string | undefined;
  features: { [featureName: string]: number | undefined } | undefined;
}
