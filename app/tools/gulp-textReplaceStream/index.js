// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const TextReplaceStream = require("./TextReplaceStream");
const through2 = require("through2");

module.exports = (targetFilePath, fromRegEx) => {
  const textReplace = TextReplaceStream.create(targetFilePath, fromRegEx);

  return through2.obj((chunk, encoding, callback) => {
    try {
      const content = textReplace.resolve(chunk.history[0], chunk.contents.toString("utf-8"));

      chunk.contents = Buffer.from(content);

      callback(null, chunk);
    } catch (err) {
      callback(err);
    }
  });
};
