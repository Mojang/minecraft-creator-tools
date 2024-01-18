export interface IMaterialWrapper {
  materials: { [identifierOrVersion: string]: string | { [identifierOrVersion: string]: string[] | IMaterial[] } };
}

export interface IMaterial {
  samplerIndex?: number;
  texterWrap?: string;
  field?: string;
}
