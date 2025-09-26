// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class CommandStructure {
  public fullName: string;
  public commandArguments: string[];

  constructor(commandFullName: string, commandArguments: string[]) {
    this.fullName = commandFullName;
    this.commandArguments = commandArguments;
  }

  get isNamespaced() {
    const namespaceColon = this.fullName.indexOf(":");

    return namespaceColon > 0;
  }

  get namespace() {
    const namespaceColon = this.fullName.indexOf(":");

    if (namespaceColon > 0) {
      return this.fullName.substring(0, namespaceColon);
    }

    return undefined;
  }

  static parse(commandText: string) {
    let commandName = undefined;

    commandText = commandText.trim();

    if (commandText.startsWith("/")) {
      commandText = commandText.substring(1, commandText.length);
    }

    const firstSpace = commandText.indexOf(" ");

    let parseArgs: string[] = [];

    if (firstSpace < 0) {
      commandName = commandText.toLowerCase();
    } else {
      commandName = commandText.substring(0, firstSpace).toLowerCase();

      const argumentStr = commandText.substring(firstSpace + 1);

      let nextSpace = argumentStr.indexOf(" ");
      let nextDoubleQuote = argumentStr.indexOf('"');
      let nextSingleQuote = argumentStr.indexOf("'");
      let startIndex = 0;

      while (nextSpace >= 0 && startIndex < argumentStr.length) {
        let processedNextSegment = false;

        if (
          nextDoubleQuote >= 0 &&
          nextDoubleQuote < nextSpace &&
          (nextSingleQuote < 0 || nextSingleQuote > nextDoubleQuote)
        ) {
          let nextNextDoubleQuote = argumentStr.indexOf('"', nextDoubleQuote + 1);

          if (nextNextDoubleQuote > nextDoubleQuote) {
            parseArgs.push(argumentStr.substring(startIndex + 1, nextNextDoubleQuote));
            startIndex = nextNextDoubleQuote + 1;

            if (startIndex < argumentStr.length) {
              nextSpace = argumentStr.indexOf(" ", startIndex);
              nextDoubleQuote = argumentStr.indexOf('"', startIndex);
              nextSingleQuote = argumentStr.indexOf("'", startIndex);
            }
            processedNextSegment = true;
          }
        } else if (nextSingleQuote >= 0 && nextSingleQuote < nextSpace) {
          const nextNextSingleQuote = argumentStr.indexOf("'", nextSingleQuote + 1);

          if (nextNextSingleQuote > nextSingleQuote) {
            parseArgs.push(argumentStr.substring(startIndex + 1, nextNextSingleQuote));
            startIndex = nextNextSingleQuote + 1;

            if (startIndex < argumentStr.length) {
              nextSpace = argumentStr.indexOf(" ", startIndex);
              nextDoubleQuote = argumentStr.indexOf('"', startIndex);
              nextSingleQuote = argumentStr.indexOf("'", startIndex);
            }
            processedNextSegment = true;
          }
        }

        // consider space as the next element
        if (!processedNextSegment) {
          parseArgs.push(argumentStr.substring(startIndex, nextSpace));

          startIndex = nextSpace + 1;

          if (startIndex < argumentStr.length) {
            nextSpace = argumentStr.indexOf(" ", startIndex);
            nextDoubleQuote = argumentStr.indexOf('"', startIndex);
            nextSingleQuote = argumentStr.indexOf("'", startIndex);
          }
        }
      }

      parseArgs.push(argumentStr.substring(startIndex));
    }

    // if the command is a comment, push the comment into args and identify this command
    // consistently as a comment ("#").
    if (commandName.indexOf("#") >= 0) {
      let newArgs = [];

      newArgs.push(commandName);

      for (let i = 0; i < parseArgs.length; i++) {
        newArgs.push(parseArgs[i]);
      }

      parseArgs = newArgs;
      commandName = "#";
    }

    return new CommandStructure(
      commandName,
      parseArgs // arguments is a keyword, so commandArguments here.
    );
  }
}
