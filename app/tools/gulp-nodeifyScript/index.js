const NodeifyScript = require("./NodeifyScript");
const through2 = require("through2");

module.exports = (root = ".", aliases = {}) => {
  const nodeifyScript = NodeifyScript.create(root, aliases);

  return through2.obj((chunk, encoding, callback) => {
    try {
      const content = nodeifyScript.resolve(chunk.history[0], chunk.contents.toString("utf-8"));

      chunk.contents = Buffer.from(content);

      callback(null, chunk);
    } catch (err) {
      callback(err);
    }
  });
};
