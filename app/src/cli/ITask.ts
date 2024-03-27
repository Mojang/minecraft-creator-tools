import { TaskType } from "./ClUtils";
import IProjectStartInfo from "./IProjectStartInfo";

export default interface ITask {
  project?: IProjectStartInfo;
  outputFolder?: string;
  inputFolder?: string;
  arguments: { [argumentname: string]: string | undefined };
  task: TaskType;
  displayInfo: boolean;
  displayVerbose: boolean;
  force?: boolean;
}
