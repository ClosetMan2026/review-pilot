var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// .wrangler/tmp/bundle-tBCHhU/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// node_modules/unenv/dist/runtime/_internal/utils.mjs
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
__name(PerformanceEntry, "PerformanceEntry");
var PerformanceMark = /* @__PURE__ */ __name(class PerformanceMark2 extends PerformanceEntry {
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
}, "PerformanceMark");
var PerformanceMeasure = class extends PerformanceEntry {
  entryType = "measure";
};
__name(PerformanceMeasure, "PerformanceMeasure");
var PerformanceResourceTiming = class extends PerformanceEntry {
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
__name(PerformanceResourceTiming, "PerformanceResourceTiming");
var PerformanceObserverEntryList = class {
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
__name(PerformanceObserverEntryList, "PerformanceObserverEntryList");
var Performance = class {
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
__name(Performance, "Performance");
var PerformanceObserver = class {
  __unenv__ = true;
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
__name(PerformanceObserver, "PerformanceObserver");
__publicField(PerformanceObserver, "supportedEntryTypes", []);
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
import { Socket } from "node:net";
var ReadStream = class extends Socket {
  fd;
  constructor(fd) {
    super();
    this.fd = fd;
  }
  isRaw = false;
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
  isTTY = false;
};
__name(ReadStream, "ReadStream");

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
import { Socket as Socket2 } from "node:net";
var WriteStream = class extends Socket2 {
  fd;
  constructor(fd) {
    super();
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  columns = 80;
  rows = 24;
  isTTY = false;
};
__name(WriteStream, "WriteStream");

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class extends EventEmitter {
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return "";
  }
  get versions() {
    return {};
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  ref() {
  }
  unref() {
  }
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: () => 0 });
  mainModule = void 0;
  domain = void 0;
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};
__name(Process, "Process");

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var { exit, platform, nextTick } = getBuiltinModule(
  "node:process"
);
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  nextTick
});
var {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  finalization,
  features,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  on,
  off,
  once,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// src/index.js
var src_default = {
  async fetch(request, env2, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (url.pathname === "/api/generate" && request.method === "POST") {
      try {
        const body = await request.json();
        const { rating, comment, category, locationName } = body;
        const replies = await generateRepliesWithGemini(env2, { rating, comment, category, locationName });
        return new Response(JSON.stringify({ success: true, replies }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }
    if (url.pathname === "/api/action/reply") {
      const token = url.searchParams.get("token");
      if (!token) {
        return new Response("Invalid Token", { status: 400 });
      }
      const result = await handleMagicLinkReply(env2, token);
      if (result.success) {
        return Response.redirect(`${url.origin}/reply.html?status=success`, 302);
      } else {
        return new Response(`Error: ${result.error}`, { status: 400 });
      }
    }
    if (url.pathname === "/api/webhook/google-pubsub" && request.method === "POST") {
      try {
        const message = await request.json();
        ctx.waitUntil(handlePubSubNotification(env2, message));
        return new Response(JSON.stringify({ status: "ok" }), { headers: { "Content-Type": "application/json" } });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }
    if (env2.ASSETS) {
      return env2.ASSETS.fetch(request);
    }
    return new Response("ReviewPilot API Running", { status: 200 });
  },
  // 5. 定期実行 Cron (新着差分巡回バックアップ)
  async scheduled(event, env2, ctx) {
    ctx.waitUntil(pollNewReviews(env2));
  }
};
async function generateRepliesWithGemini(env2, { rating, comment, category, locationName }) {
  const apiKey = env2.GEMINI_API_KEY;
  if (!apiKey) {
    return getFallbackReplies(rating, comment, category);
  }
  const prompt = `
\u3042\u306A\u305F\u306F\u5E97\u8217\u300C${locationName || "\u5F53\u5E97"}\u300D\uFF08\u696D\u7A2E: ${category || "\u5E97\u8217"}\uFF09\u306E\u30AA\u30FC\u30CA\u30FC\u3067\u3059\u3002
Google\u30DE\u30C3\u30D7\u306B\u304A\u5BA2\u69D8\u304B\u3089\u4EE5\u4E0B\u306E\u53E3\u30B3\u30DF\uFF08\u8A55\u4FA1: \u2605${rating}\uFF09\u304C\u6295\u7A3F\u3055\u308C\u307E\u3057\u305F\u3002

\u3010\u304A\u5BA2\u69D8\u306E\u53E3\u30B3\u30DF\u3011
"${comment}"

\u3010\u6307\u793A\u3011
1. \u53E3\u30B3\u30DF\u306E\u8A00\u8A9E\u3092\u81EA\u52D5\u691C\u77E5\u3057\u3066\u304F\u3060\u3055\u3044\u3002
2. \u53E3\u30B3\u30DF\u304C\u5916\u56FD\u8A9E\uFF08\u82F1\u8A9E\u30FB\u4E2D\u56FD\u8A9E\u30FB\u97D3\u56FD\u8A9E\u306A\u3069\uFF09\u306E\u5834\u5408\u306F\u3001\u5E97\u8217\u30AA\u30FC\u30CA\u30FC\u5411\u3051\u306B\u65E5\u672C\u8A9E\u8A33\uFF08"translated_comment"\uFF09\u3092\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002\u65E5\u672C\u8A9E\u306E\u5834\u5408\u306F null \u307E\u305F\u306F\u540C\u3058\u6587\u7AE0\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002
3. \u53E3\u30B3\u30DF\u306B\u5BFE\u3059\u308B\u8FD4\u4FE1\u6587\u3092\u3001\u4EE5\u4E0B\u306E3\u3064\u306E\u30C8\u30FC\u30F3\u3067\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002
   - \u53E3\u30B3\u30DF\u304C\u5916\u56FD\u8A9E\u306E\u5834\u5408:
     - \u5B9F\u969B\u306BGoogle\u30DE\u30C3\u30D7\u306B\u6295\u7A3F\u3059\u308B\u6587\u7AE0\uFF08"reply_a", "reply_b", "reply_c"\uFF09\u306F\u3010\u53E3\u30B3\u30DF\u3068\u540C\u3058\u8A00\u8A9E\uFF08\u81EA\u7136\u306A\u30CD\u30A4\u30C6\u30A3\u30D6\u8868\u73FE\uFF09\u3011\u3067\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002
     - \u5E97\u8217\u30AA\u30FC\u30CA\u30FC\u304C\u610F\u5473\u3092\u78BA\u8A8D\u3067\u304D\u308B\u3088\u3046\u3001\u305D\u308C\u305E\u308C\u306E\u65E5\u672C\u8A9E\u8A33\uFF08"reply_a_ja", "reply_b_ja", "reply_c_ja"\uFF09\u3082\u4F5C\u6210\u3057\u3066\u304F\u3060\u3055\u3044\u3002
   - \u53E3\u30B3\u30DF\u304C\u65E5\u672C\u8A9E\u306E\u5834\u5408:
     - "reply_a", "reply_b", "reply_c" \u3092\u65E5\u672C\u8A9E\u3067\u4F5C\u6210\u3057\u3001"_ja" \u306E\u30D5\u30A3\u30FC\u30EB\u30C9\u306F\u540C\u3058\u5024\u306B\u3057\u3066\u304F\u3060\u3055\u3044\u3002

\u3010\u30C8\u30FC\u30F3\u306E\u5B9A\u7FA9\u3011
- "reply_a" (\u738B\u9053\u30FB\u4E01\u5BE7): \u8AA0\u5B9F\u306A\u611F\u8B1D\u3068\u3001\u6B21\u56DE\u3078\u306E\u6765\u5E97\u4FC3\u9032\u3092\u542B\u3080\u738B\u9053\u306E\u63A5\u5BA2\u30C8\u30FC\u30F3\u3002
- "reply_b" (\u89AA\u3057\u307F\u30FB\u30D5\u30EC\u30F3\u30C9\u30EA\u30FC): \u7D75\u6587\u5B57\u306A\u3069\u3092\u9069\u5EA6\u306B\u4EA4\u3048\u3001\u89AA\u3057\u307F\u3084\u3059\u304F\u6E29\u304B\u307F\u306E\u3042\u308B\u30A2\u30C3\u30C8\u30DB\u30FC\u30E0\u306A\u30C8\u30FC\u30F3\u3002
- "reply_c" (\u771F\u646F\u30FB\u6539\u5584 / \u304A\u8A6B\u3073): \u26051\u301C3\u306E\u4F4E\u8A55\u4FA1\u6642\u306F\u771F\u646F\u306A\u8B1D\u7F6A\u3068\u5177\u4F53\u7684\u306A\u6539\u5584\u59FF\u52E2\u3002\u26054\u301C5\u306E\u9AD8\u8A55\u4FA1\u6642\u306F\u3053\u3060\u308F\u308A\u3084\u601D\u3044\u3092\u4F1D\u3048\u308B\u30C8\u30FC\u30F3\u3002

\u203B\u51FA\u529B\u30D5\u30A9\u30FC\u30DE\u30C3\u30C8 (JSON\u306E\u307F\u51FA\u529B\u3057\u3066\u304F\u3060\u3055\u3044):
{
  "detected_language": "en" | "ja" | "zh" | "ko" | "other",
  "translated_comment": "\u53E3\u30B3\u30DF\u306E\u65E5\u672C\u8A9E\u8A33\uFF08\u5916\u56FD\u8A9E\u306E\u5834\u5408\u306E\u307F\uFF09",
  "reply_a": "Google\u30DE\u30C3\u30D7\u6295\u7A3F\u7528\u8FD4\u4FE1\u6587\uFF08\u53E3\u30B3\u30DF\u8A00\u8A9E\uFF09",
  "reply_a_ja": "\u8FD4\u4FE1\u6848A\u306E\u65E5\u672C\u8A9E\u610F\u5473",
  "reply_b": "Google\u30DE\u30C3\u30D7\u6295\u7A3F\u7528\u8FD4\u4FE1\u6587\uFF08\u53E3\u30B3\u30DF\u8A00\u8A9E\uFF09",
  "reply_b_ja": "\u8FD4\u4FE1\u6848B\u306E\u65E5\u672C\u8A9E\u610F\u5473",
  "reply_c": "Google\u30DE\u30C3\u30D7\u6295\u7A3F\u7528\u8FD4\u4FE1\u6587\uFF08\u53E3\u30B3\u30DF\u8A00\u8A9E\uFF09",
  "reply_c_ja": "\u8FD4\u4FE1\u6848C\u306E\u65E5\u672C\u8A9E\u610F\u5473"
}
`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json" }
    })
  });
  const data = await response.json();
  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawJson);
}
__name(generateRepliesWithGemini, "generateRepliesWithGemini");
function getFallbackReplies(rating, comment, category) {
  const isEnglish = /^[A-Za-z0-9\s.,!?'"()-]+$/.test(comment);
  if (isEnglish) {
    if (parseInt(rating) >= 4) {
      return {
        detected_language: "en",
        translated_comment: "\u300C\u30C8\u30EA\u30E5\u30D5\u30D1\u30B9\u30BF\u304C\u672C\u5F53\u306B\u7D76\u54C1\u3067\u3057\u305F\uFF01\u96F0\u56F2\u6C17\u3082\u5C45\u5FC3\u5730\u304C\u826F\u304F\u3001\u30B9\u30BF\u30C3\u30D5\u3082\u6C17\u914D\u308A\u304C\u884C\u304D\u5C4A\u3044\u3066\u3044\u307E\u3057\u305F\u3002\u6771\u4EAC\u306B\u6765\u305F\u969B\u306F\u307E\u305F\u4F3A\u3044\u307E\u3059\uFF01\u300D",
        reply_a: "Thank you very much for visiting us and sharing your kind feedback! We are thrilled to hear that you enjoyed our truffle pasta. We look forward to welcoming you back on your next trip to Tokyo!",
        reply_a_ja: "\u5F53\u5E97\u3092\u3054\u5229\u7528\u3044\u305F\u3060\u304D\u3001\u307E\u305F\u6E29\u304B\u3044\u3054\u611F\u60F3\u3092\u304A\u5BC4\u305B\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u30C8\u30EA\u30E5\u30D5\u30D1\u30B9\u30BF\u3092\u304A\u697D\u3057\u307F\u3044\u305F\u3060\u3051\u3066\u5927\u5909\u5149\u6804\u3067\u3059\u3002\u6B21\u56DE\u6771\u4EAC\u306B\u304A\u8D8A\u3057\u306E\u969B\u3082\u3001\u5FC3\u3088\u308A\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\uFF01",
        reply_b: "Thank you so much! \u{1F60A} We are super happy you loved the pasta and cozy vibe. Have a wonderful stay in Japan and see you next time!",
        reply_b_ja: "\u5B09\u3057\u3044\u304A\u8A00\u8449\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u{1F60A} \u30D1\u30B9\u30BF\u3068\u5C45\u5FC3\u5730\u3092\u6C17\u306B\u5165\u3063\u3066\u3044\u305F\u3060\u3051\u3066\u30B9\u30BF\u30C3\u30D5\u4E00\u540C\u3068\u3066\u3082\u5B09\u3057\u3044\u3067\u3059\u3002\u65E5\u672C\u3067\u306E\u3054\u6EDE\u5728\u3092\u305C\u3072\u697D\u3057\u3093\u3067\u304F\u3060\u3055\u3044\u306D\u3002\u307E\u305F\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\uFF01",
        reply_c: "Thank you for dining with us. We take great pride in our authentic cuisine and attentive hospitality. We hope to serve you again on your next visit.",
        reply_c_ja: "\u3054\u6765\u5E97\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u3053\u3060\u308F\u308A\u306E\u304A\u6599\u7406\u3068\u63A5\u5BA2\u3092\u3054\u4F53\u611F\u3044\u305F\u3060\u3051\u3066\u5149\u6804\u3067\u3059\u3002\u6B21\u56DE\u306E\u304A\u8D8A\u3057\u3092\u5FC3\u3088\u308A\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\u3002"
      };
    } else {
      return {
        detected_language: "en",
        translated_comment: "\u300C\u6599\u7406\u306F\u7F8E\u5473\u3057\u304B\u3063\u305F\u306E\u3067\u3059\u304C\u3001\u6DF7\u3093\u3067\u3044\u3066\u6599\u7406\u304C\u51FA\u3066\u304F\u308B\u307E\u306730\u5206\u4EE5\u4E0A\u5F85\u305F\u3055\u308C\u307E\u3057\u305F\u3002\u300D",
        reply_a: "Thank you for visiting our restaurant. We sincerely apologize for the long wait during our busy hours. We will improve our kitchen workflow to serve our guests faster.",
        reply_a_ja: "\u3054\u6765\u5E97\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u6DF7\u96D1\u6642\u306B\u304A\u5F85\u305F\u305B\u3057\u3066\u3057\u307E\u3044\u3001\u6DF1\u304F\u304A\u8A6B\u3073\u7533\u3057\u4E0A\u3052\u307E\u3059\u3002\u3088\u308A\u8FC5\u901F\u306B\u3054\u63D0\u4F9B\u3067\u304D\u308B\u3088\u3046\u30AA\u30DA\u30EC\u30FC\u30B7\u30E7\u30F3\u3092\u6539\u5584\u3044\u305F\u3057\u307E\u3059\u3002",
        reply_b: "We are truly sorry for keeping you waiting! We really appreciate your patience and will work hard to make your next experience much smoother.",
        reply_b_ja: "\u304A\u5F85\u305F\u305B\u3057\u3066\u3057\u307E\u3044\u672C\u5F53\u306B\u7533\u3057\u8A33\u3042\u308A\u307E\u305B\u3093\u3067\u3057\u305F\uFF01\u3044\u305F\u3060\u3044\u305F\u3054\u610F\u898B\u3092\u3082\u3068\u306B\u3001\u6B21\u56DE\u306F\u3088\u308A\u30B9\u30E0\u30FC\u30BA\u306B\u3054\u6848\u5185\u3067\u304D\u308B\u3088\u3046\u52AA\u3081\u307E\u3059\u3002",
        reply_c: "Please accept our sincere apologies for not meeting your expectations regarding service speed. We take your feedback seriously and are actively restructuring our service flow.",
        reply_c_ja: "\u63D0\u4F9B\u30B9\u30D4\u30FC\u30C9\u306B\u3064\u3044\u3066\u3054\u671F\u5F85\u306B\u6CBF\u3048\u305A\u3001\u6DF1\u304F\u304A\u8A6B\u3073\u7533\u3057\u4E0A\u3052\u307E\u3059\u3002\u3054\u6307\u6458\u3092\u771F\u646F\u306B\u53D7\u3051\u6B62\u3081\u3001\u65E9\u6025\u306B\u30B5\u30FC\u30D3\u30B9\u4F53\u5236\u306E\u518D\u69CB\u7BC9\u3092\u884C\u3044\u307E\u3059\u3002"
      };
    }
  }
  if (parseInt(rating) >= 4) {
    return {
      detected_language: "ja",
      translated_comment: null,
      reply_a: `\u3053\u306E\u5EA6\u306F\u5F53\u5E97\u3092\u3054\u5229\u7528\u3044\u305F\u3060\u304D\u3001\u307E\u305F\u5FC3\u6E29\u307E\u308B\u53E3\u30B3\u30DF\u3092\u3054\u6295\u7A3F\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u300C${comment.slice(0, 15)}...\u300D\u3068\u306E\u304A\u8A00\u8449\u3001\u5927\u5909\u52B1\u307F\u306B\u306A\u308A\u307E\u3059\u3002\u307E\u305F\u306E\u3054\u6765\u5E97\u3092\u5FC3\u3088\u308A\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\u3002`,
      reply_a_ja: `\u3053\u306E\u5EA6\u306F\u5F53\u5E97\u3092\u3054\u5229\u7528\u3044\u305F\u3060\u304D\u3001\u307E\u305F\u5FC3\u6E29\u307E\u308B\u53E3\u30B3\u30DF\u3092\u3054\u6295\u7A3F\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\u300C${comment.slice(0, 15)}...\u300D\u3068\u306E\u304A\u8A00\u8449\u3001\u5927\u5909\u52B1\u307F\u306B\u306A\u308A\u307E\u3059\u3002\u307E\u305F\u306E\u3054\u6765\u5E97\u3092\u5FC3\u3088\u308A\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\u3002`,
      reply_b: `\u5B09\u3057\u3044\u304A\u8A00\u8449\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u6C17\u306B\u5165\u3063\u3066\u3044\u305F\u3060\u3051\u3066\u30B9\u30BF\u30C3\u30D5\u4E00\u540C\u3068\u3066\u3082\u559C\u3093\u3067\u304A\u308A\u307E\u3059\u{1F60A} \u6B21\u56DE\u3082\u305C\u3072\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\uFF01`,
      reply_b_ja: `\u5B09\u3057\u3044\u304A\u8A00\u8449\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\uFF01\u6C17\u306B\u5165\u3063\u3066\u3044\u305F\u3060\u3051\u3066\u30B9\u30BF\u30C3\u30D5\u4E00\u540C\u3068\u3066\u3082\u559C\u3093\u3067\u304A\u308A\u307E\u3059\u{1F60A} \u6B21\u56DE\u3082\u305C\u3072\u304A\u5F85\u3061\u3057\u3066\u304A\u308A\u307E\u3059\uFF01`,
      reply_c: `\u3054\u6765\u5E97\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u5F53\u5E97\u3053\u3060\u308F\u308A\u306E\u30B5\u30FC\u30D3\u30B9\u3092\u3054\u4F53\u611F\u3044\u305F\u3060\u3051\u3066\u5149\u6804\u3067\u3059\u3002\u6B21\u56DE\u3082\u3088\u308A\u826F\u3044\u6642\u9593\u3092\u3054\u63D0\u4F9B\u3067\u304D\u308B\u3088\u3046\u52AA\u3081\u3066\u307E\u3044\u308A\u307E\u3059\u3002`,
      reply_c_ja: `\u3054\u6765\u5E97\u3044\u305F\u3060\u304D\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u5F53\u5E97\u3053\u3060\u308F\u308A\u306E\u30B5\u30FC\u30D3\u30B9\u3092\u3054\u4F53\u611F\u3044\u305F\u3060\u3051\u3066\u5149\u6804\u3067\u3059\u3002\u6B21\u56DE\u3082\u3088\u308A\u826F\u3044\u6642\u9593\u3092\u3054\u63D0\u4F9B\u3067\u304D\u308B\u3088\u3046\u52AA\u3081\u3066\u307E\u3044\u308A\u307E\u3059\u3002`
    };
  } else {
    return {
      reply_a: `\u3053\u306E\u5EA6\u306F\u5F53\u5E97\u3092\u3054\u5229\u7528\u3044\u305F\u3060\u3044\u305F\u306B\u3082\u304B\u304B\u308F\u3089\u305A\u3001\u3054\u4E0D\u5FEB\u306A\u601D\u3044\u3092\u3055\u305B\u3066\u3057\u307E\u3044\u8AA0\u306B\u7533\u3057\u8A33\u3054\u3056\u3044\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u3044\u305F\u3060\u3044\u305F\u3054\u6307\u6458\u3092\u771F\u646F\u306B\u53D7\u3051\u6B62\u3081\u3001\u6539\u5584\u306B\u52AA\u3081\u3066\u307E\u3044\u308A\u307E\u3059\u3002`,
      reply_b: `\u3054\u6765\u5E97\u8AA0\u306B\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3057\u305F\u3002\u305B\u3063\u304B\u304F\u304A\u8D8A\u3057\u3044\u305F\u3060\u3044\u305F\u306E\u306B\u3054\u671F\u5F85\u306B\u6CBF\u3048\u305A\u5927\u5909\u7533\u3057\u8A33\u3042\u308A\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30B9\u30BF\u30C3\u30D5\u4E00\u540C\u3067\u5171\u6709\u3057\u3001\u518D\u767A\u9632\u6B62\u3092\u5FB9\u5E95\u3057\u307E\u3059\u3002`,
      reply_c: `\u3053\u306E\u5EA6\u306F\u3054\u6E80\u8DB3\u3044\u305F\u3060\u3051\u308B\u304A\u6642\u9593\u3092\u3054\u63D0\u4F9B\u3067\u304D\u305A\u3001\u6DF1\u304F\u304A\u8A6B\u3073\u7533\u3057\u4E0A\u3052\u307E\u3059\u3002\u30AA\u30DA\u30EC\u30FC\u30B7\u30E7\u30F3\u306E\u898B\u76F4\u3057\u3092\u65E9\u6025\u306B\u884C\u3044\u3001\u3088\u308A\u5FEB\u9069\u306B\u304A\u904E\u3054\u3057\u3044\u305F\u3060\u3051\u308B\u3088\u3046\u6539\u5584\u3044\u305F\u3057\u307E\u3059\u3002`
    };
  }
}
__name(getFallbackReplies, "getFallbackReplies");
async function handleMagicLinkReply(env2, token) {
  return { success: true };
}
__name(handleMagicLinkReply, "handleMagicLinkReply");
async function handlePubSubNotification(env2, message) {
}
__name(handlePubSubNotification, "handlePubSubNotification");
async function pollNewReviews(env2) {
}
__name(pollNewReviews, "pollNewReviews");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-tBCHhU/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-tBCHhU/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
