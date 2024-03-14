// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export default class UrlUtilities {
  static ensureProtocol(sourceUrl: string, protocolFrom: string, protocolValue: string) {
    if (sourceUrl.indexOf("?") <= 0) {
      return sourceUrl + "?" + protocolFrom + "=" + protocolValue;
    }

    let clauseStart = sourceUrl.indexOf(protocolFrom + "=");

    if (clauseStart > 0) {
      let clauseEnd = sourceUrl.indexOf("&", clauseStart + protocolFrom.length);

      if (clauseEnd < clauseStart) {
        clauseEnd = sourceUrl.length;
      }

      if (sourceUrl[clauseStart - 1] === "&") {
        clauseStart--;
      }

      sourceUrl = sourceUrl.substring(0, clauseStart) + sourceUrl.substring(clauseEnd);
    }

    if (!sourceUrl.endsWith("?")) {
      sourceUrl += "&";
    }
    sourceUrl += protocolFrom + "=" + protocolValue;

    return sourceUrl;
  }
}
