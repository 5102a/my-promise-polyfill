var PENDING = "pending";
var FULFILLED = "fulfilled";
var REJECTED = "rejected";

function isObjOrFunc(result) {
  return result && (typeof result === "object" || typeof result === "function");
}

function _resolvePromise(handler, result) {
  if (result === handler.newPromise) {
    return handler.newReject(
      new TypeError("A promise cannot be resolved with itself")
    );
  }

  if (isObjOrFunc(result)) {
    try {
      var then = result.then;
    } catch (error) {
      return handler.newReject(error);
    }
    if (result instanceof MyPromise) {
      result.then(function (value) {
        _resolvePromise(handler, value);
      }, handler.newReject);
      return;
    } else if (typeof then === "function") {
      var called = false;
      try {
        then.call(
          result,
          function (value) {
            if (called || ((called = true), false)) return;
            _resolvePromise(handler, value);
          },
          function (reason) {
            if (called || ((called = true), false)) return;
            handler.newReject(reason);
          }
        );
      } catch (error) {
        if (called) return;
        handler.newReject(error);
      }
      return;
    }
  }
  handler.newResolve(result);
}

function _handlePending(handler) {
  this._handlers.push(handler);
}

function _handleFulfilled(handler) {
  var onFulfilled = handler.onFulfilled;
  if (onFulfilled === null) {
    return handler.newResolve(this.result);
  }
  try {
    var res = onFulfilled(this.result);
    _resolvePromise(handler, res);
  } catch (error) {
    handler.newReject(error);
  }
}

function _handleRejected(handler) {
  var onRejected = handler.onRejected;
  if (onRejected === null) {
    return handler.newReject(this.result);
  }
  try {
    var res = onRejected(this.result);
    _resolvePromise(handler, res);
  } catch (error) {
    handler.newReject(error);
  }
}

function _handle(handler) {
  if (this.state === FULFILLED) {
    _handleFulfilled.call(this, handler);
  } else if (this.state === REJECTED) {
    _handleRejected.call(this, handler);
  }
}

function _createHandler(that, state, cb) {
  return function (result) {
    MyPromise._immediateFn(function () {
      if (that.state === PENDING) {
        that.state = state;
        that.result = result;
        var handlerLen = that._handlers.length;
        if (handlerLen === 0 && cb) {
          cb(result);
        } else {
          for (var i = 0; i < that._handlers.length; i++) {
            var handler = that._handlers[i];
            _handle.call(that, handler);
          }
        }
        delete that._handlers;
      }
    });
  };
}

function Handler(onFulfilled, onRejected, newResolve, newReject, newPromise) {
  this.onFulfilled = typeof onFulfilled === "function" ? onFulfilled : null;
  this.onRejected = typeof onRejected === "function" ? onRejected : null;
  this.newResolve = newResolve;
  this.newReject = newReject;
  this.newPromise = newPromise;
}

function MyPromise(executer) {
  if (!(this instanceof MyPromise)) {
    throw new TypeError("Promises must be constructed via new");
  }

  if (typeof executer !== "function") {
    throw new TypeError("not a function");
  }

  this.state = PENDING;
  this.result = undefined;
  this._handlers = [];

  var resolve = _createHandler(this, FULFILLED);
  var reject = _createHandler(this, REJECTED, function (reason) {
    MyPromise._unhandledRejectionFn(reason);
  });

  try {
    executer(resolve, reject);
  } catch (error) {
    reject(error);
  }
}

MyPromise.prototype.then = function (onFulfilled, onRejected) {
  var handler;
  var newPromise = new this.constructor(function (resolve, reject) {
    handler = new Handler(onFulfilled, onRejected, resolve, reject);
  });
  handler.newPromise = newPromise;
  if (this.state === PENDING) {
    _handlePending.call(this, handler);
  } else if (this.state === FULFILLED) {
    MyPromise._immediateFn(_handleFulfilled.bind(this, handler));
  } else if (this.state === REJECTED) {
    MyPromise._immediateFn(_handleRejected.bind(this, handler));
  }
  return newPromise;
};

MyPromise.prototype.catch = function (onRejected) {
  return this.then(null, onRejected);
};

MyPromise.prototype.finally = function (cb) {
  return this.then(
    function (value) {
      return MyPromise.resolve(cb()).then(function () {
        return value;
      });
    },
    function (reason) {
      return MyPromise.resolve(cb()).then(function () {
        return MyPromise.reject(reason);
      });
    }
  );
};

MyPromise._immediateFn = function (fn) {
  if (typeof setImmediate === "function") {
    setImmediate(fn);
  } else {
    setTimeout(fn, 0);
  }
};

MyPromise._unhandledRejectionFn = function (err) {
  if (typeof console !== "undefined" && console) {
    console.warn("Possible Unhandled MyPromise Rejection:", err);
  }
};

MyPromise.resolve = function (value) {
  if (value instanceof MyPromise) {
    return value;
  }
  return new MyPromise(function (resolve) {
    resolve(value);
  });
};

MyPromise.reject = function (reason) {
  return new MyPromise(function (resolve, reject) {
    reject(reason);
  });
};

MyPromise.race = function (iterable) {
  return new MyPromise(function (resolve, reject) {
    if (typeof iterable[Symbol.iterator] !== "function") {
      throw new TypeError("MyPromise.race accepts an iterable");
    }
    var iterator = iterable[Symbol.iterator]();
    for (var ret; (ret = iterator.next()), ret.done === false; ) {
      MyPromise.resolve(ret.value).then(resolve, reject);
    }
  });
};

MyPromise.all = function (iterable) {
  return new MyPromise(function (resolve, reject) {
    if (typeof iterable[Symbol.iterator] !== "function") {
      throw new TypeError("MyPromise.all accepts an iterable");
    }
    var iterator = iterable[Symbol.iterator]();
    var count = 0,
      result = [];
    for (var i = 0, ret; (ret = iterator.next()), ret.done === false; i++) {
      (function (i) {
        count++;
        MyPromise.resolve(ret.value).then(function (value) {
          result[i] = value;
          if (--count === 0) resolve(result);
        }, reject);
      })(i);
    }
    if (i === 0 && ret.done === true) resolve(result);
  });
};

MyPromise.allSettled = function (iterable) {
  return new MyPromise(function (resolve, reject) {
    if (typeof iterable[Symbol.iterator] !== "function") {
      throw new TypeError("MyPromise.allSettled accepts an iterable");
    }
    var iterator = iterable[Symbol.iterator]();
    var count = 0,
      result = [];
    for (var i = 0, ret; (ret = iterator.next()), ret.done === false; i++) {
      (function (i) {
        count++;
        MyPromise.resolve(ret.value).then(
          function (value) {
            result[i] = { status: FULFILLED, value: value };
            if (--count === 0) resolve(result);
          },
          function (reason) {
            result[i] = { status: REJECTED, reason: reason };
            if (--count === 0) resolve(result);
          }
        );
      })(i);
    }
    if (i === 0 && ret.done === true) resolve(result);
  });
};

module.exports = MyPromise;
