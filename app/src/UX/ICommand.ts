
export interface ICommander
{
    runCommand(command : ICommand, trackCommand : boolean) : void;
}

export default interface ICommand
{
    command : string;
    undo? : ICommand;
}