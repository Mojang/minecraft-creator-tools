export interface IVsCodeTask {
  label: string;
  dependsOrder: string;
  dependsOn?: string[];
}

export default interface IVsCodeTasks {
  version?: string;
  tasks?: IVsCodeTask[];
}
