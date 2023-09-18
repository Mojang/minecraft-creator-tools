import Utilities from "./../core/Utilities";
import Log from "./../core/Log";
import { EventDispatcher } from "ste-events";
import CartoApp from "../app/CartoApp";

export enum MessageProxyCommands {
  fsExists = "fsExists",
  fsFolderExists = "fsFolderExists",
  fsMkdir = "fsMkdir",
  fsReadUtf8File = "fsReadUtf8File",
  fsReadFile = "fsReadFile",
  fsWriteUtf8File = "fsWriteUtf8File",
  fsWriteFile = "fsWriteFile",
  fsReaddir = "fsReaddir",
  fsStat = "fsStat",
  fsDeleteItem = "fsDeleteItem",
  getDirname = "getDirname",
  notifyFileAdded = "notifyFileAdded",
  notifyFileContentsUpdated = "notifyFileContentsUpdated",
  notifyFileRemoved = "notifyFileRemoved",
}

export default class MessageProxy {
  static _pendingPromiseResolvers: ((value: any | PromiseLike<any>) => void)[] = [];
  static _pendingPromiseRejecters: ((reason?: any) => void)[] = [];

  private static _onMessage = new EventDispatcher<string, any>();

  public static get onMessage() {
    return MessageProxy._onMessage.asEvent();
  }

  static init() {
    CartoApp.onMessage.subscribe(MessageProxy._handleNewMessage);
  }

  static send(commandName: MessageProxyCommands | string, channelId: string, data: any) {
    if (!CartoApp.postMessage) {
      throw new Error("Post message is not specified");
    }

    if (commandName === MessageProxyCommands.fsWriteFile) {
      let content = data.content;

      if (content instanceof Uint8Array) {
        content = Utilities.uint8ArrayToBase64(content);
      } else if (data instanceof ArrayBuffer) {
        content = Utilities.arrayBufferToBase64(content);
      } else if (
        data instanceof Uint16Array ||
        data instanceof Uint32Array ||
        data instanceof Uint8ClampedArray ||
        data instanceof BigUint64Array
      ) {
        Log.fail("Unsupported binary type encountered." + data);
      }

      data.content = content;
    }

    let result = undefined;

    try {
      CartoApp.postMessage({ command: commandName, id: channelId, data: data });
    } catch (e) {
      let dataStr = data;

      if (typeof data === "object") {
        dataStr = JSON.stringify(data);
      }

      throw new Error("Error running command " + commandName + ", data: " + dataStr + ", error: " + e);
    }

    if (commandName === MessageProxyCommands.fsReadFile) {
      /* if (result === undefined || result.length === 0) {
        return undefined;
      }*/

      return Utilities.base64ToArrayBuffer(""); //result);
    }

    return result;
  }

  static sendAsync(commandName: MessageProxyCommands | string, channelId: string, data: any): Promise<any> {
    if (CartoApp.postMessage === undefined) {
      throw new Error("Not an post message API");
    }

    const promise = new Promise<string>(MessageProxy._stringPromiseHandler);
    const position = MessageProxy._pendingPromiseResolvers.length - 1;

    const commandStr = "async" + (commandName as string) + "|" + position;

    // Log.verbose("Sending message proxy async command '" + commandStr + "'");

    CartoApp.postMessage({ command: commandStr, id: channelId, data: data });

    return promise;
  }

  private static _stringPromiseHandler(
    resolve: (value: string | PromiseLike<string>) => void,
    reject: (reason?: any) => void
  ) {
    const position = MessageProxy._pendingPromiseResolvers.length;

    MessageProxy._pendingPromiseResolvers[position] = resolve;
    MessageProxy._pendingPromiseRejecters[position] = reject;
  }

  private static _handleNewMessage(source: any, message: any) {
    if (message.command && message.command.length > 0) {
      if (message.command.startsWith("async")) {
        const argSplit = message.command.split("|");

        if (argSplit.length >= 2) {
          const index = parseInt(argSplit[1]);

          if (index >= 0) {
            const promiseResolver = MessageProxy._pendingPromiseResolvers[index];

            promiseResolver(message.data);
          }
        }
      } else {
        MessageProxy._onMessage.dispatch("messageproxy", message);
      }
    }
  }
}
