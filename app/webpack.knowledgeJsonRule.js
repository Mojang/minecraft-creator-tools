// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Webpack rule for the Bedrock Knowledge snapshots (src/knowledge/data/*.json), which are about 1 MB
// each. In production mode, webpack tracks which properties of a JSON module are used at every depth,
// which costs a lot of memory for a file this large. The snapshot is always used whole, so this rule
// limits that tracking to the top level. Every config whose entry reaches
// src/knowledge/BedrockKnowledge.ts must include this rule.
module.exports = {
  test: /[\\/]knowledge[\\/]data[\\/][^\\/]+\.json$/,
  type: "json",
  parser: { exportsDepth: 1 },
};
