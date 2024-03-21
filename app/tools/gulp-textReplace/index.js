// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const TextReplace = require("./TextReplace");
const through2 = require("through2");

module.exports = (fromRegEx, toStr) => {
  const textReplace = TextReplace.create(fromRegEx, toStr);

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
