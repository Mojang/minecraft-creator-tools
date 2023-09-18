export enum UpdateResultType {
  updatedFile = 1,
  noChange = 0,
  internalProcessingError = 99,
}

export default interface IUpdateResult {
  resultType: UpdateResultType;
  updaterId: string;
  updaterIndex: number;
  message: string;
  itemStoragePath: string | null | undefined;
  data: string | boolean | number | object | number[] | undefined;
  itemId: string | undefined;
  content: string | undefined;
}
