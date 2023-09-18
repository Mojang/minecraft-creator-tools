export interface IVsCodeConfiguration {
  type?: string;
  request?: string;
  name?: string;
  mode?: string;
  preLaunchTask?: string;
  sourceMapRoot?: string;
  generatedSourceRoot?: string;
  port: number;
}

export default interface IVsCodeLaunch {
  version?: string;
  configurations?: IVsCodeConfiguration[];
}
