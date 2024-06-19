// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const ImportTransform = require("./ImportTransform");
const through2 = require("through2");

module.exports = () => {
  const importTransform = ImportTransform.create();

  return through2.obj((chunk, encoding, callback) => {
    try {
      const content = importTransform.resolve(chunk.history[0], chunk.contents.toString("utf-8"));

      chunk.contents = Buffer.from(content);

      callback(null, chunk);
    } catch (err) {
      callback(err);
    }
  });
};
