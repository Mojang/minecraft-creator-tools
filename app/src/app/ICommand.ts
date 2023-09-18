export enum CommandStatus {
  completed = 100,
  invalidEnvironment = 2,
  invalidArguments = 1,
  fail = 0,
}

export interface ICommandResult {
  status: CommandStatus;
  data?: any;
}
