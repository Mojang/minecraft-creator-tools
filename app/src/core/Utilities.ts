// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import CartoApp, { HostType } from "../app/CartoApp";
import { IErrorable } from "./IErrorable";
import Log from "./Log";

const singleComment = Symbol("singleComment");
const multiComment = Symbol("multiComment");

export default class Utilities {
  static _isDebug?: boolean;
  static _isAppSim?: boolean;
  static defaultEncoding = "UTF-8";
  static replacementChar = 0xfffd;

  static async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  static get isPreview(): boolean {
    return false;
  }

  static get isAppSim(): boolean {
    return false;
  }

  static get isDebug(): boolean {
    if (Utilities._isDebug === undefined) {
      Utilities._isDebug = false;
    }

    return Utilities._isDebug;
  }

  static removeItemInArray(objToRemove: any, stringArr: any[]) {
    const nextArray: any[] = [];

    for (const candStr of stringArr) {
      if (candStr !== objToRemove) {
        nextArray.push(candStr);
      }
    }

    return nextArray;
  }

  static isArrayNonNegative(arr: number[]) {
    for (const val of arr) {
      if (val < 0) {
        return false;
      }
    }

    return true;
  }

  static arrayHasNegativeAndIsNumeric(arr: any[]) {
    let foundNegative = false;
    for (const val of arr) {
      if (typeof val !== "number") {
        return false;
      } else if (val < 0) {
        foundNegative = true;
      }
    }

    return foundNegative;
  }

  static encodeObjectWithSequentialRunLengthEncodeUsingNegative(obj: { [key: string]: any }) {
    for (const key in obj) {
      const val: any = obj[key];
      if (val !== undefined) {
        if (typeof val === "object" && !Array.isArray(val)) {
          this.encodeObjectWithSequentialRunLengthEncodeUsingNegative(val);
        } else if (Array.isArray(val)) {
          let isNumericArray = true;
          for (const arrVal of val) {
            if (typeof arrVal !== "number") {
              isNumericArray = false;
              break;
            }
          }

          if (isNumericArray) {
            obj[key] = this.encodeSequentialRunLengthUsingNegative(val);
          }
        }
      }
    }
  }

  static decodeSequentialRunLengthUsingNegative(arr: number[]) {
    if (this.isArrayNonNegative(arr)) {
      return arr;
    }

    const newArr: number[] = [];

    newArr.push(arr[0]);

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < 0) {
        let startVal = arr[i - 1];

        for (let j = 0; j < Math.abs(arr[i]); j++) {
          startVal++;

          newArr.push(startVal);
        }
      } else {
        newArr.push(arr[i]);
      }
    }
    return newArr;
  }

  /* Convert a numeric array from:
     [1, 2, 3, 7, 9, 10, 15, 16, 17, 18]
     to a "sequential run length encode", where negative numbers are used to indicate a "run"
     so the above becomes 
     [1, -2, 7, 9, -1, 15, -3]
  */
  static encodeSequentialRunLengthUsingNegative(arr: number[]) {
    if (!this.isArrayNonNegative(arr)) {
      return arr;
    }

    arr.sort();

    const newArr: number[] = [];

    newArr.push(arr[0]);

    let streak = -1;

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === arr[i - 1] + 1) {
        if (streak < 1) {
          streak = 1;
        } else {
          streak++;
        }
      } else {
        if (streak >= 1) {
          newArr.push(-streak);
          streak = -1;
        }

        newArr.push(arr[i]);
      }
    }

    if (streak >= 1) {
      newArr.push(-streak);
      streak = -1;
    }

    return newArr;
  }

  static trimEllipsis(text: string, length: number) {
    if (text.length > length) {
      text = text.substring(0, length - 1) + "…";
    }

    return text;
  }

  static makeHashFileSafe(hash: string) {
    hash = hash.replace(/\//gi, "-S");
    hash = hash.replace(/\+/gi, "-P");
    hash = hash.replace(/\\/gi, "-B");
    hash = hash.replace(/=/gi, "-E");
    hash = hash.replace(/,/gi, "-C");

    return hash;
  }

  static getSimpleNumeric(num: number | undefined) {
    if (num === undefined) {
      return "";
    }

    if (num < 1000) {
      return num.toString();
    }

    if (num < 1000) {
      return Math.floor(num / 100) / 10 + "k";
    }

    if (num > 1000000) {
      return Math.floor(num / 100000) / 10 + "m";
    }

    return Math.floor(num / 1000) + "k";
  }

  static humanifyJsName(name: string | boolean | number) {
    if (typeof name === "boolean" || typeof name === "number") {
      return name.toString();
    }

    let retVal = "";

    for (let i = 0; i < name.length; i++) {
      if (i === 0) {
        retVal += name[i].toUpperCase();
      } else {
        if (name[i] >= "A" && name[i] <= "Z") {
          retVal += " ";
        }

        retVal += name[i];
      }
    }

    retVal = retVal.replace("Java Script", "JavaScript");

    return retVal;
  }

  static humanifyMinecraftName(name: string | boolean | number) {
    if (typeof name === "boolean" || typeof name === "number") {
      return name.toString();
    }

    if (name.endsWith(".behavior")) {
      name = name.substring(0, name.length - 9);
    } else if (name.endsWith(".geo")) {
      name = name.substring(0, name.length - 4);
    } else if (name.endsWith(".entity")) {
      name = name.substring(0, name.length - 7);
    }

    const colon = name.indexOf(":");

    if (colon >= 0) {
      name = name.substring(colon + 1);
    }

    name = name.replace(/[_]/gi, " ");

    if (name.endsWith("_bit")) {
      name = name.substring(0, name.length - 4);
    }

    const lastPeriod = name.indexOf(".");

    if (lastPeriod >= 4) {
      name = name.substring(lastPeriod + 1) + " " + name.substring(0, lastPeriod);
    }

    /*
    if (name.length > 1) {
      if (name[0] >= "a" && name[0] <= "z") {
        name = name[0].toUpperCase() + name.substring(1, name.length);
      }
    }*/

    let lastCharWasSpace = false;

    for (let i = 0; i < name.length; i++) {
      if (name[i] === " ") {
        lastCharWasSpace = true;
      } else {
        if ((lastCharWasSpace || i === 0) && name[i] >= "a" && name[i] <= "z") {
          name = name.substring(0, i) + name[i].toUpperCase() + name.substring(i + 1);
        }
        lastCharWasSpace = false;
      }
    }

    return name;
  }

  static convertToHexString(byteArray: number[]) {
    return Array.from(byteArray, function (byte) {
      return ("0" + (byte & 0xff).toString(16)).slice(-2);
    }).join("");
  }

  static countSignificantLines(content: string) {
    if (content.length <= 0) {
      return 0;
    }
    let lineCount = 1;
    let curStart = 0;
    let nextNewline = content.indexOf("\n");

    while (nextNewline >= curStart) {
      let curContent = content.substring(curStart, nextNewline).trim();

      if (curContent.length > 1) {
        lineCount++;
      }
      curStart = nextNewline + 1;
      nextNewline = content.indexOf("\n", curStart);
    }

    return lineCount;
  }

  static stripLinesContaining(content: string, lineContains: string) {
    let i = content.indexOf(lineContains);

    while (i >= 0) {
      let prevNewLine = content.lastIndexOf("\n", i);
      if (prevNewLine < 0) {
        prevNewLine = 0;
      }

      let nextNewLine = content.indexOf("\n", i);

      if (nextNewLine < 0) {
        nextNewLine = content.length;
      }

      content = content.substring(0, prevNewLine) + content.substring(nextNewLine, content.length);

      i = content.indexOf(lineContains);
    }

    return content;
  }

  static stripWithoutWhitespace = () => "";
  static stripWithWhitespace = (str: string, start: number | undefined, end: number | undefined) =>
    str.slice(start, end).replace(/\S/g, " ");

  static replaceJsonValue(jsonContent: string, attributeName: string, newValue: string) {
    let nextAttribute = jsonContent.indexOf('"' + attributeName + '":');

    while (nextAttribute >= 0) {
      const subsequentOpenQuote = jsonContent.indexOf('"', nextAttribute + attributeName.length + 3);

      if (
        subsequentOpenQuote > nextAttribute + attributeName.length + 2 &&
        subsequentOpenQuote < nextAttribute + attributeName.length + 7
      ) {
        const subsequentEndQuote = jsonContent.indexOf('"', subsequentOpenQuote + 1);

        if (subsequentEndQuote > subsequentOpenQuote) {
          jsonContent =
            jsonContent.substring(0, subsequentOpenQuote + 1) + newValue + jsonContent.substring(subsequentEndQuote);
        }
      }

      nextAttribute = jsonContent.indexOf('"' + attributeName + '":', nextAttribute + attributeName.length + 2);
    }

    return jsonContent;
  }

  public static makeJsonVersionAgnostic(jsonContent: string) {
    jsonContent = Utilities.replaceJsonValue(jsonContent, "generatorVersion", "TESTSUB");
    jsonContent = Utilities.replaceJsonValue(jsonContent, "uuid", "TESTSUB");

    return jsonContent;
  }

  static isEscaped(jsonString: string, quotePosition: number) {
    let index = quotePosition - 1;
    let backslashCount = 0;

    while (jsonString[index] === "\\") {
      index -= 1;
      backslashCount += 1;
    }

    return Boolean(backslashCount % 2);
  }

  static fixJsonContent(jsonString: string, { whitespace = true, trailingCommas = false } = {}) {
    if (typeof jsonString !== "string") {
      throw new TypeError(`Expected argument \`jsonString\` to be a \`string\`, got \`${typeof jsonString}\``);
    }

    const strip = whitespace ? Utilities.stripWithWhitespace : Utilities.stripWithoutWhitespace;

    let isInsideString = false;
    let isInsideComment: boolean | symbol = false;
    let offset = 0;
    let buffer = "";
    let result = "";
    let commaIndex = -1;

    for (let index = 0; index < jsonString.length; index++) {
      const currentCharacter = jsonString[index];
      const nextCharacter = jsonString[index + 1];

      if (!isInsideComment && currentCharacter === '"') {
        // Enter or exit string
        const escaped = Utilities.isEscaped(jsonString, index);
        if (!escaped) {
          isInsideString = !isInsideString;
        }
      }

      if (isInsideString) {
        // fix control characters inside of strings, if they exist
        if (currentCharacter === "\r" || currentCharacter === "\n" || currentCharacter === "\t") {
          jsonString = jsonString.substring(0, index) + " " + jsonString.substring(index + 1);
        }
        continue;
      }

      if (!isInsideComment && currentCharacter + nextCharacter === "//") {
        // Enter single-line comment
        buffer += jsonString.slice(offset, index);
        offset = index;
        isInsideComment = singleComment;
        index++;
      } else if (isInsideComment === singleComment && currentCharacter + nextCharacter === "\r\n") {
        // Exit single-line comment via \r\n
        index++;
        isInsideComment = false;
        buffer += strip(jsonString, offset, index);
        offset = index;
        continue;
      } else if (isInsideComment === singleComment && currentCharacter === "\n") {
        // Exit single-line comment via \n
        isInsideComment = false;
        buffer += strip(jsonString, offset, index);
        offset = index;
      } else if (!isInsideComment && currentCharacter + nextCharacter === "/*") {
        // Enter multiline comment
        buffer += jsonString.slice(offset, index);
        offset = index;
        isInsideComment = multiComment;
        index++;
        continue;
      } else if (isInsideComment === multiComment && currentCharacter + nextCharacter === "*/") {
        // Exit multiline comment
        index++;
        isInsideComment = false;
        buffer += strip(jsonString, offset, index + 1);
        offset = index + 1;
        continue;
      } else if (trailingCommas && !isInsideComment) {
        if (commaIndex !== -1) {
          if (currentCharacter === "}" || currentCharacter === "]") {
            // Strip trailing comma
            buffer += jsonString.slice(offset, index);
            result += strip(buffer, 0, 1) + buffer.slice(1);
            buffer = "";
            offset = index;
            commaIndex = -1;
          } else if (
            currentCharacter !== " " &&
            currentCharacter !== "\t" &&
            currentCharacter !== "\r" &&
            currentCharacter !== "\n"
          ) {
            // Hit non-whitespace following a comma; comma is not trailing
            buffer += jsonString.slice(offset, index);
            offset = index;
            commaIndex = -1;
          }
        } else if (currentCharacter === ",") {
          // Flush buffer prior to this point, and save new comma index
          result += buffer + jsonString.slice(offset, index);
          buffer = "";
          offset = index;
          commaIndex = index;
        }
      }
    }

    let results =
      result +
      buffer +
      (isInsideComment ? strip(jsonString.slice(offset), undefined, undefined) : jsonString.slice(offset));

    results = results.replace(/,(\s*)]/g, "]"); // ["a", "b", ] => ["a", "b"]
    results = results.replace(/,(\s*)}/g, "}"); // { "foo": "bar", } => { "foo": "bar"}

    return results;
  }

  static setIsDebug(boolVal: boolean) {
    Utilities._isDebug = boolVal;
  }

  static getBaseUrl(url: string) {
    if (url.length < 8) {
      return url;
    }

    const slashIndex = url.indexOf("/", 9);

    if (slashIndex < 0) {
      return url;
    }

    return url.substring(0, slashIndex);
  }

  static getDateStr(date: Date) {
    let dateStr = Utilities.frontPadToLength(date.getFullYear(), 4, "0");

    dateStr += Utilities.frontPadToLength(date.getMonth() + 1, 2, "0");
    dateStr += Utilities.frontPadToLength(date.getDate(), 2, "0");
    dateStr += Utilities.frontPadToLength(date.getHours(), 2, "0");
    dateStr += Utilities.frontPadToLength(date.getMinutes(), 2, "0");
    dateStr += Utilities.frontPadToLength(date.getSeconds(), 2, "0");

    return dateStr;
  }

  static getDateFromStr(dateStr: string) {
    if (!Utilities.isNumeric(dateStr) || dateStr.length !== 14) {
      throw new Error("Improperly formatted date string: " + dateStr);
    }

    const year = parseInt(dateStr.substring(0, 4)),
      month = parseInt(dateStr.substring(4, 6)),
      day = parseInt(dateStr.substring(6, 8)),
      hours = parseInt(dateStr.substring(8, 10)),
      minutes = parseInt(dateStr.substring(10, 12)),
      seconds = parseInt(dateStr.substring(12, 14));

    Log.assert(year >= 2022, "Invalid year: " + dateStr);
    Log.assert(month >= 1 && month <= 12, "Invalid month: " + dateStr);
    Log.assert(day >= 0 && day <= 31, "Invalid day: " + dateStr);
    Log.assert(hours >= 0 && hours <= 23, "Invalid hours: " + dateStr);
    Log.assert(minutes >= 0 && minutes <= 59, "Invalid minutes: " + dateStr);
    Log.assert(seconds >= 0 && seconds <= 59, "Invalid seconds: " + dateStr);

    return new Date(year, month - 1, day, hours, minutes, seconds);
  }

  static monthNames: string[] = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  static monthShortNames: string[] = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  static lengthOfDictionary(d: any) {
    let c = 0;

    for (const i in d) {
      if (i) {
        ++c;
      }
    }

    return c;
  }

  static makeSafeForJson(content: string) {
    content = content.replace(/\\/g, "/");
    content = content.replace(/"/gi, "'"); // this isn't the full way to do it, but for now...

    return content;
  }

  static isAlphaNumeric(candidate: string) {
    for (let i = 0; i < candidate.length; i++) {
      const charCode = candidate[i];

      if (
        !(
          (charCode >= "0" && charCode <= "9") ||
          (charCode >= "a" && charCode <= "z") ||
          (charCode >= "A" && charCode <= "Z")
        )
      ) {
        return false;
      }
    }

    return true;
  }

  public static getJsonObject(contents: string): any | undefined {
    let jsonObject = undefined;

    contents = Utilities.fixJsonContent(contents);

    try {
      jsonObject = JSON.parse(contents);
    } catch (e: any) {
      Log.fail("Could not parse JSON: " + e.message);
    }

    return jsonObject;
  }

  static appendErrors(source: IErrorable, add: IErrorable, context?: string) {
    if (!add.isInErrorState) {
      return;
    }

    source.isInErrorState = true;

    if (add.errorMessages) {
      if (source.errorMessages === undefined) {
        source.errorMessages = [];
      }

      for (const err of add.errorMessages) {
        let newContext = undefined;

        if (context) {
          newContext = err.context ? context + ": " + err.context : context;
        } else {
          newContext = err.context;
        }

        source.errorMessages.push({
          message: err.message,
          context: newContext,
        });
      }
    }
  }

  static isNumeric(candidate: string) {
    for (let i = 0; i < candidate.length; i++) {
      const charCode = candidate[i];

      if ((charCode < "0" || charCode > "9") && charCode !== "." && (i > 0 || charCode !== "-")) {
        return false;
      }
    }

    return true;
  }

  static isNumericIsh(candidate: string) {
    for (let i = 0; i < candidate.length; i++) {
      const charCode = candidate[i];

      if (
        (charCode < "0" || charCode > "9") &&
        charCode !== "e" &&
        charCode !== "+" &&
        charCode !== "," &&
        charCode !== "." &&
        charCode !== "-"
      ) {
        return false;
      }
    }

    return true;
  }

  static isAlpha(candidate: string) {
    for (let i = 0; i < candidate.length; i++) {
      const charCode = candidate[i];

      if (!((charCode >= "a" && charCode <= "z") || (charCode >= "A" && charCode <= "Z"))) {
        return false;
      }
    }

    return true;
  }

  static shallowCloneArray(source: any[]) {
    const newArr: any[] = new Array(source.length);

    for (let i = 0; i < source.length; i++) {
      newArr[i] = source[i];
    }

    return newArr;
  }

  static uint8ArrayToBase64(bytes: Uint8Array) {
    let binary = "";

    const len = bytes.byteLength;

    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    if (
      CartoApp.isWeb ||
      CartoApp.hostType === HostType.vsCodeMainWeb ||
      CartoApp.hostType === HostType.vsCodeWebService
    ) {
      return btoa(binary);
    }

    return Buffer.from(binary).toString("base64"); //btoa(binary);
  }

  static arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);

    const len = bytes.byteLength;

    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    if (
      CartoApp.isWeb ||
      CartoApp.hostType === HostType.vsCodeMainWeb ||
      CartoApp.hostType === HostType.vsCodeWebService
    ) {
      return btoa(binary);
    }

    return Buffer.from(binary).toString("base64"); // btoa(binary);
  }

  static base64ToArrayBuffer(base64buffer: string) {
    const start = base64buffer.indexOf(";base64,");

    if (start > 0 && start < 50) {
      base64buffer = base64buffer.substring(start + 8);
    }

    const binary = atob(base64buffer);

    const arrayBuffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(arrayBuffer);

    const len = binary.length;

    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return arrayBuffer;
  }

  static base64ToUint8Array(base64buffer: string) {
    const start = base64buffer.indexOf(";base64,");

    if (start > 0 && start < 50) {
      base64buffer = base64buffer.substring(start + 8);
    }

    const binary = atob(base64buffer);

    const arrayBuffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(arrayBuffer);

    const len = binary.length;

    for (var i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
  }

  // UTF8 related string functions adapted from StrangelyTyped/StringView.
  static _utf8ReadChar = function (
    charStruct: { bytesRead: number; charVal: number },
    buf: DataView,
    readPos: number,
    maxBytes: number
  ) {
    const firstByte = buf.getUint8(readPos);

    charStruct.bytesRead = 1;
    charStruct.charVal = 0;

    if (firstByte & 0x80) {
      var numBytes = 0;
      var aByte = firstByte;

      while (aByte & 0x80) {
        numBytes++;
        aByte <<= 1;
      }
      if (numBytes === 1) {
        charStruct.charVal = Utilities.replacementChar;
        return;
      }
      if (numBytes > maxBytes) {
        charStruct.charVal = Utilities.replacementChar;
        return;
      }

      //2 bytes means 3 bits reserved for UTF8 byte encoding, 5 bytes remaining for codepoint, and so on
      charStruct.charVal = firstByte & (0xff >> (numBytes + 1));

      for (var i = 1; i < numBytes; i++) {
        aByte = buf.getUint8(readPos + i);

        //0xC0 should isolate the continuation flag which should be 0x80
        if ((aByte & 0xc0) !== 0x80) {
          console.error(
            "UTF-8 read - attempted to read " + numBytes + " byte character, found non-continuation at byte " + i
          );
          charStruct.charVal = Utilities.replacementChar;

          charStruct.bytesRead = 1;
          return;
        }

        charStruct.charVal <<= 6;
        charStruct.charVal |= aByte & 0x3f;

        if (i === 1) {
          const rshift = 8 - (numBytes + 1) - 1;
          if (charStruct.charVal >> rshift === 0) {
            charStruct.charVal = Utilities.replacementChar;
            charStruct.bytesRead = 1;
            return;
          }
        }
        charStruct.bytesRead++;
      }

      if (charStruct.charVal > 0x10ffff) {
        console.error("UTF-8 read - found illegally high code point " + charStruct.charVal);
        charStruct.charVal = Utilities.replacementChar;
        charStruct.bytesRead = 1;
        return;
      }
    } else {
      charStruct.charVal = firstByte;
    }
  };

  static canonicalizeId(id: string) {
    return id.toLowerCase();
  }

  static readStringUTF8(buf: DataView, byteOffset: number, bytesToRead: number) {
    const nullTerm = typeof bytesToRead === "undefined";
    var readPos = byteOffset || 0;

    if (!nullTerm && readPos + bytesToRead > buf.byteLength) {
      throw new Error("Attempted to read " + (readPos + bytesToRead - buf.byteLength) + " bytes past end of buffer");
    }

    var str = "";

    const charStruct: { bytesRead: number; charVal: number } = { bytesRead: 0, charVal: 0 };

    while (readPos < buf.byteLength && (nullTerm || bytesToRead > readPos - byteOffset)) {
      Utilities._utf8ReadChar(
        charStruct,
        buf,
        readPos,
        nullTerm ? buf.byteLength - (readPos + byteOffset) : bytesToRead - (readPos - byteOffset)
      );
      readPos += charStruct.bytesRead;

      if (nullTerm && !charStruct.charVal) {
        break;
      }
      str += String.fromCharCode(charStruct.charVal);
    }
    return {
      str: str,
      byteLength: readPos - byteOffset,
    };
  }

  static readStringASCII(buf: DataView, byteOffset: number, bytesToRead: number) {
    var str = "";
    var byteLength = 0;
    byteOffset = byteOffset || 0;
    var nullTerm = false;

    if (typeof bytesToRead === "undefined") {
      nullTerm = true;
      bytesToRead = buf.byteLength - buf.byteOffset;
    }

    var charCode;

    for (var i = 0; i < bytesToRead; i++) {
      charCode = buf.getUint8(i + byteOffset);
      if (charCode === 0 && nullTerm) {
        break;
      }

      str += String.fromCharCode(charCode);
      byteLength++;
    }

    return {
      str: str,
      byteLength: byteLength + (nullTerm ? 1 : 0),
    };
  }

  static readStringASCIIBuffer(buf: Uint8Array, byteOffset: number, bytesToRead: number) {
    var str = "";

    byteOffset = byteOffset || 0;

    var nullTerm = false;

    if (typeof bytesToRead === "undefined") {
      nullTerm = true;
      bytesToRead = buf.byteLength - buf.byteOffset;
    }

    var charCode;

    for (var i = 0; i < bytesToRead; i++) {
      charCode = buf[i + byteOffset];
      if (charCode === 0 && nullTerm) {
        break;
      }

      str += String.fromCharCode(charCode);
    }

    return str;
  }

  static _createUtf8Char(charCode: number, arr: number[]) {
    if (charCode < 0x80) {
      arr.push(charCode);
    } else {
      const limits = [0x7f, 0x07ff, 0xffff, 0x1fffff];
      let i = 0;

      while (true) {
        i++;

        if (i === limits.length) {
          Utilities._createUtf8Char(Utilities.replacementChar, arr);

          return;
        }

        if (charCode <= limits[i]) {
          i += 1;

          var aByte = 0;
          var j;

          for (j = 0; j < i; j++) {
            aByte <<= 1;
            aByte |= 1;
          }

          aByte <<= 8 - i;

          aByte |= charCode >> (6 * (i - 1));
          arr.push(aByte);

          for (j = 1; j < i; j++) {
            aByte = 0x80;

            aByte |= (charCode >> (6 * (i - (j + 1)))) & 0xbf;
            arr.push(aByte);
          }

          return;
        }
      }
    }
  }

  static convertStringToBytes(str: string, encoding: string) {
    if (encoding === "UTF-8") {
      const arr: number[] = [];

      for (let i = 0; i < str.length; i++) {
        Utilities._createUtf8Char(str.charCodeAt(i), arr);
      }

      return arr;
    } else if (encoding === "ASCII") {
      const arr = [];

      for (let i = 0; i < str.length; i++) {
        let chr = str.charCodeAt(i);

        if (chr > 255) {
          chr = "?".charCodeAt(0);
        }

        arr.push(chr);
      }

      return arr;
    }

    throw new Error();
  }

  static ensureNotStartsWithSlash(pathSegment: string) {
    while (pathSegment.startsWith("/")) {
      pathSegment = pathSegment.substring(1);
    }

    return pathSegment;
  }

  static ensureStartsWithSlash(pathSegment: string) {
    if (!pathSegment.startsWith("/")) {
      pathSegment = "/" + pathSegment;
    }

    return pathSegment;
  }

  static ensureEndsWithSlash(pathSegment: string) {
    if (!pathSegment.endsWith("/")) {
      pathSegment += "/";
    }

    return pathSegment;
  }

  static ensureNotEndsWithSlash(pathSegment: string) {
    while (pathSegment.length > 0 && pathSegment.endsWith("/")) {
      pathSegment = pathSegment.substring(0, pathSegment.length - 1);
    }

    return pathSegment;
  }

  static ensureStartsWithBackSlash(pathSegment: string) {
    if (!pathSegment.startsWith("\\")) {
      pathSegment = "\\" + pathSegment;
    }

    return pathSegment;
  }

  static ensureEndsWithBackSlash(pathSegment: string) {
    if (!pathSegment.endsWith("\\")) {
      pathSegment += "\\";
    }

    return pathSegment;
  }

  static replaceAll(content: string, fromToken: string, toToken: string) {
    let nextIndex = content.indexOf(fromToken);

    while (nextIndex >= 0) {
      content = content.substring(0, nextIndex) + toToken + content.substring(nextIndex + fromToken.length);

      nextIndex = content.indexOf(fromToken, nextIndex + toToken.length);
    }

    return content;
  }

  static replaceAllExceptInLines(content: string, fromToken: string, toToken: string, exceptInLinesWith: string[]) {
    let nextIndex = content.indexOf(fromToken);

    while (nextIndex >= 0) {
      let doReplace = true;

      let previousNewLine = content.lastIndexOf("\n", nextIndex);
      if (previousNewLine >= 0) {
        const previousPreviousNewLine = content.lastIndexOf("\n", previousNewLine - 1);

        if (previousPreviousNewLine >= 0) {
          previousNewLine = previousPreviousNewLine;
        }

        const lineSegment = content.substring(previousNewLine, nextIndex);
        for (const exceptIn of exceptInLinesWith) {
          if (lineSegment.indexOf(exceptIn) > 0) {
            doReplace = false;
          }
        }
      }

      if (doReplace) {
        content = content.substring(0, nextIndex) + toToken + content.substring(nextIndex + fromToken.length);

        nextIndex = content.indexOf(fromToken, nextIndex + toToken.length);
      } else {
        nextIndex = content.indexOf(fromToken, nextIndex + 1);
      }
    }

    return content;
  }
  static createRandomId(length: number) {
    let id = "";

    for (let i = 0; i < length; i++) {
      const main = Math.random() * 6;

      if (main < 1) {
        id += String.fromCharCode(Math.floor(Math.random() * 10) + 48);
      } else if (main < 4) {
        id += String.fromCharCode(Math.floor(Math.random() * 26) + 65);
      } else {
        id += String.fromCharCode(Math.floor(Math.random() * 26) + 97);
      }
    }

    return id;
  }

  static canonicalizeUuid(uuidString: string) {
    return uuidString.trim().toLowerCase();
  }

  static isValidUuid(uuidString: string) {
    return uuidString.length === 36;
  }

  static uuidEqual(uuidStringA: string, uuidStringB: string) {
    return Utilities.canonicalizeId(uuidStringA) === Utilities.canonicalizeId(uuidStringB);
  }

  static createUuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      let val = CartoApp.generateCryptoRandomNumber(16);

      const r = val | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8;

      return v.toString(16);
    });
  }

  static uint8ArraysAreEqual(arrayA: Uint8Array, arrayB: Uint8Array) {
    if (arrayA.length !== arrayB.length) {
      return false;
    }

    for (let i = 0; i < arrayA.length; i++) {
      if (arrayA[i] !== arrayB[i]) {
        return false;
      }
    }

    return true;
  }

  static throwIfUint8ArraysNotEqual(arrayA: Uint8Array, arrayB: Uint8Array) {
    if (arrayA.length !== arrayB.length) {
      throw new Error("Arrays are of mismatched length.");
    }

    for (let i = 0; i < arrayA.length; i++) {
      if (arrayA[i] !== arrayB[i]) {
        throw new Error("Mismatch at position " + i + " value A: " + arrayA[i] + " value B:" + arrayB[i]);
      }
    }
  }

  static getString(view: DataView, byteOffset: number, byteLength: number, encoding?: string) {
    if (encoding === "UTF8" || encoding === undefined) {
      const result = Utilities.readStringUTF8(view, byteOffset, byteLength);
      Log.assert(result.byteLength === byteLength, "UTGS");
      return result.str;
    } else if (encoding === "ASCII") {
      const result = Utilities.readStringASCII(view, byteOffset, byteLength);

      return result.str;
    }

    return undefined;
  }

  static getSimpleString(str: string) {
    str = str.trim();
    str = str.replace(/ /gi, "");
    str = str.replace(/=/gi, "");
    str = str.replace(/\?/gi, "");

    return str;
  }

  static getAsciiString(view: DataView, byteOffset: number, byteLength: number, encoding?: string) {
    const result = Utilities.readStringASCII(view, byteOffset, byteLength);

    return result.str;
  }

  static getAsciiStringFromBytes(bytes: number[]) {
    let str = "";
    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }

    return str;
  }

  static getAsciiStringFromUint8Array(bytes: Uint8Array) {
    let str = "";

    for (let i = 0; i < bytes.length; i++) {
      str += String.fromCharCode(bytes[i]);
    }

    return str;
  }

  static writeString(view: DataView, byteOffset: number, value: string, encoding: string) {
    const arr = Utilities.convertStringToBytes(value, encoding);

    if (arr === undefined) {
      return byteOffset;
    }

    let i = 0;

    for (i = 0; i < arr.length && byteOffset + i < view.byteLength; i++) {
      view.setUint8(byteOffset + i, arr[i]);
    }

    return byteOffset + i;
  }

  static frontPadToLength(val: string | number, length: number, pad: string): string {
    val = val + "";

    while (val.length < length) {
      val = pad + val;
    }

    return val;
  }

  static getShortYear(year: number) {
    let short = year + ""; // cast to string

    if (short.length === 4) {
      short = short.substring(2, 4);
    }

    return short;
  }

  static getFriendlySummary(date: Date) {
    if (date === undefined || !(date instanceof Date)) {
      Log.fail("Empty/wrong-typed date passed in.");
    }

    let returnValue = this.monthShortNames[date.getMonth()] + " " + Utilities.frontPadToLength(date.getDate(), 2, "0");

    const now = new Date();

    if (date.getFullYear() !== now.getFullYear()) {
      returnValue += " " + this.getShortYear(date.getFullYear());
    } else {
      let hours = date.getHours() % 12;

      if (hours === 0) {
        hours = 12;
      }

      returnValue +=
        " " + Utilities.frontPadToLength(hours, 2, "0") + ":" + Utilities.frontPadToLength(date.getMinutes(), 2, "0");
    }

    return returnValue;
  }

  static getFriendlySummarySeconds(date: Date) {
    if (date === undefined || !(date instanceof Date)) {
      Log.fail("Empty/wrong-typed date passed in.");
    }

    return (
      this.monthShortNames[date.getMonth()] +
      " " +
      Utilities.frontPadToLength(date.getDate(), 2, "0") +
      " " +
      this.getShortYear(date.getFullYear()) +
      " " +
      Utilities.frontPadToLength(date.getHours(), 2, "0") +
      Utilities.frontPadToLength(date.getMinutes(), 2, "0") +
      "." +
      Utilities.frontPadToLength(date.getSeconds(), 2, "0")
    );
  }

  static getFileFriendlySummarySeconds(date: Date) {
    if (date === undefined || !(date instanceof Date)) {
      Log.fail("Empty/wrong-typed date passed in.");
    }

    return (
      Utilities.frontPadToLength(date.getMonth() + 1, 2, "0") +
      "-" +
      Utilities.frontPadToLength(date.getDate(), 2, "0") +
      "-" +
      Utilities.frontPadToLength(date.getHours(), 2, "0") +
      Utilities.frontPadToLength(date.getMinutes(), 2, "0") +
      Utilities.frontPadToLength(date.getSeconds(), 2, "0")
    );
  }

  static getDateSummary(date: Date) {
    return (
      date.getMonth() +
      1 +
      "." +
      date.getDate() +
      "." +
      (date.getFullYear() - 2000) +
      "." +
      date.getHours() +
      "." +
      date.getMinutes() +
      "." +
      date.getSeconds()
    );
  }

  static countChar(source: string, find: string) {
    let count = 0;

    let index = source.indexOf(find);

    while (index >= 0) {
      count++;

      index = source.indexOf(find, index + find.length);
    }

    return count;
  }

  static isString(obj: any) {
    return typeof obj == "string";
  }

  static isNullOrUndefined<T>(object: T | undefined | null): object is T {
    return (object as T) === undefined || (object as T) === null;
  }
}
