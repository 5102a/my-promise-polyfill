var Promise = require("./index.js"),
  globalNS = (function () {
    if ("undefined" != typeof self) return self;
    if ("undefined" != typeof window) return window;
    if ("undefined" != typeof global) return global;
    throw new Error("unable to locate global object");
  })();
"function" != typeof globalNS.Promise && (globalNS.Promise = Promise);
