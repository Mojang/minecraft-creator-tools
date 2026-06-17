import { TaskType } from "./ClUtils";
import IProjectStartInfo from "./IProjectStartInfo";

/**
 * Profile mode requested for a worker task. Set to wrap task execution in
 * V8 inspector profiling so that allocations / time inside the worker can be
 * analyzed. See ProfilerWrapper for the output formats.
 *
 * - "cpu"    : capture a .cpuprofile
 * - "memory" : capture an allocation sampling .heapprofile + memstats JSON +
 *              peak .heapsnapshot
 * - "all"    : both
 */
export type ProfileMode = "cpu" | "memory" | "all";

export default interface ITask {
  project?: IProjectStartInfo;
  outputFolder?: string;
  inputFolder?: string;
  arguments: { [argumentname: string]: number | string | boolean | undefined };
  task: TaskType;
  displayInfo: boolean;
  displayVerbose: boolean;
  force?: boolean;
  /** When set, wrap execution of this task in a V8 inspector profile. */
  profileMode?: ProfileMode;
  /** Friendly name appended to profile output files. */
  profileName?: string;
}
