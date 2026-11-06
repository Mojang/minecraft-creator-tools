// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Test-only browser for Playwright's pipe transport, run with node. Like Edge with its updater, it
// starts a detached child that inherits its stdout and stderr. It exits when Playwright closes it and
// leaves that child running. Arguments: <info file> <child lifetime in ms>.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");

const [infoPath, childLifetimeMs] = process.argv.slice(2);
const child = spawn(process.execPath, ["-e", `setTimeout(() => {}, ${Number(childLifetimeMs)})`], {
  detached: true,
  stdio: ["ignore", "inherit", "inherit"],
  windowsHide: true,
});
const info = { browser: process.pid, child: child.pid, closedOnRequest: false };
fs.writeFileSync(infoPath, JSON.stringify(info));

// Playwright writes protocol requests to fd 3 and reads replies from fd 4, each ending in a NUL.
const requests = new net.Socket({ fd: 3, readable: true, writable: false });
const replies = new net.Socket({ fd: 4, readable: false, writable: true });
let buffered = "";
requests.setEncoding("utf8");
requests.on("data", (data) => {
  buffered += data;
  for (let end = buffered.indexOf("\0"); end !== -1; end = buffered.indexOf("\0")) {
    const { id, method } = JSON.parse(buffered.slice(0, end));
    buffered = buffered.slice(end + 1);
    if (method === "Browser.close") {
      fs.writeFileSync(infoPath, JSON.stringify({ ...info, closedOnRequest: true }));
      process.exit(0);
    }
    const result =
      method === "Browser.getVersion" ? { product: "HeadlessChrome/1.0", userAgent: "HeadlessChrome/1.0" } : {};
    replies.write(JSON.stringify({ id, result }) + "\0");
  }
});
