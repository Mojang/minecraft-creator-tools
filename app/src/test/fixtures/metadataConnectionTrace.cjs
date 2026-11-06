// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Test-only preload, inherited by workers. Observe real socket origins and forbid external traffic.
const net = require("node:net");
const fs = require("node:fs");
const { isMainThread, threadId } = require("node:worker_threads");
const connect = net.Socket.prototype.connect;

net.Socket.prototype.connect = function (...args) {
  const [options] = net._normalizeArgs(Array.isArray(args[0]) ? args[0] : args);
  if (options.host !== "127.0.0.1" || Number(options.port) !== Number(process.env.MCT_TEST_PROXY_PORT)) {
    throw new Error("The metadata fixture forbids connections outside its owned loopback proxy.");
  }
  fs.appendFileSync(process.env.MCT_TEST_CONNECTION_TRACE, JSON.stringify({ isMainThread, threadId }) + "\n");
  return connect.apply(this, args);
};
