export interface IErrorable {
  isInErrorState?: boolean;
  errorMessages?: IErrorMessage[];
}

export interface IErrorMessage {
  message: string;
  context?: string;
}
