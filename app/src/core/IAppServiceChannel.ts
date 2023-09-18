export default interface IAppServiceChannel {
  send(channelName: string, commandName: string, data: string): any;
  receive(channelName: string, eventCallback: (args: any) => void): void;
}
