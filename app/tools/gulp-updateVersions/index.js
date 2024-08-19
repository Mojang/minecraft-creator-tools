// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

const UpdateVersions = require("./UpdateVersions");
const through2 = require("through2");

module.exports = (updateFiles = []) => {
  const updateVersions = new UpdateVersions(updateFiles);

  return through2.obj((chunk, encoding, callback) => {
    try {
      const content = updateVersions.resolve(chunk.history[0], chunk.contents.toString("utf-8"), callback);

      chunk.contents = Buffer.from(content);
    } catch (err) {
      callback(err);
    }
  });
};
