export interface IJsonUIScreen {
  [name: string]: IJsonUIControl | string;
}

export interface IJsonUIControl {
  type?: string;
  size?: number[];
  texture?: string;
}
