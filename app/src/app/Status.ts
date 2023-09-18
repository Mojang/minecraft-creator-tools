
export enum StatusType
{
    OperationStarted,
    OperationEnded,
    Message
} 

export default class Status
{    
    type : StatusType = StatusType.Message;
    time : Date = new Date();
    operationId : number | null = null;
    message : string = "";
}