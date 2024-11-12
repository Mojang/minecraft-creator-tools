export enum ServerMessageType {
  general,
  info = 1,
  error = 2,
}

export enum ServerMessageCategory {
  general = 0,
}

export default class ServerMessage {
  #fullMessage: string;
  #message: string;
  #type: ServerMessageType = ServerMessageType.general;
  #date: Date;
  #category: ServerMessageCategory = ServerMessageCategory.general;

  get fullMessage() {
    return this.#fullMessage;
  }

  get message() {
    return this.#message;
  }

  get type() {
    return this.#type;
  }

  get category() {
    return this.#category;
  }

  get date() {
    return this.#date;
  }

  constructor(message: string) {
    this.#fullMessage = message;
    this.#date = new Date(0);

    const firstBracket = message.indexOf("[");

    if (firstBracket === 0) {
      const lastBracket = message.indexOf("] ", firstBracket);

      if (lastBracket > firstBracket && lastBracket > 10) {
        this.#message = message.substring(lastBracket + 2);

        if (message.substring(lastBracket - 4, lastBracket) === "INFO") {
          this.#type = ServerMessageType.info;
        } else if (message.substring(lastBracket - 5, lastBracket) === "ERROR") {
          this.#type = ServerMessageType.error;
        }

        const lastSpace = message.lastIndexOf(" ", lastBracket);

        const dateTime = message.substring(firstBracket + 1, lastSpace);

        this.#date = new Date(dateTime);
      } else {
        this.#message = this.#fullMessage;
      }
    } else {
      this.#message = this.#fullMessage;
    }

    this.#message = this.#message.trim();
  }
}
