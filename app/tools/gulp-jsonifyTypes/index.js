// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const jsonTypeDefsBuilder = require("./JsonTypeDefsBuilder");
const through2 = require("through2");

module.exports = (targetFile = "./public/data/typedefs.beta.json") => {
  const typeDefsObj = jsonTypeDefsBuilder.create(targetFile);

  return through2.obj((chunk, encoding, callback) => {
    try {
      let content = typeDefsObj.resolve(chunk.history[0], chunk.contents.toString("utf-8"));

      chunk.contents = Buffer.from(content);

      callback(null, chunk);
    } catch (err) {
      callback(err);
    }
  });
};
