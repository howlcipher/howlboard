function howlFrameGrantHas(name) {
  var raw = "";
  if (typeof process !== "undefined" && process.env) {
    raw = process.env.HOWLFRAME_ALLOW_CAPS || "";
  } else if (typeof globalThis !== "undefined") {
    raw = globalThis.HOWLFRAME_ALLOW_CAPS;
  }
  if (typeof raw !== "string") return false;
  var parts = raw.split(",");
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].trim() === name) return true;
  }
  return false;
}

var howlFrameSpecialPrefixes = [
  [[0,0,0,0,0,0,0,0,0,0,255,255,0,0,0,0], 104], // 0.0.0.0/8
  [[0,0,0,0,0,0,0,0,0,0,255,255,10,0,0,0], 104], // 10.0.0.0/8
  [[0,0,0,0,0,0,0,0,0,0,255,255,100,64,0,0], 106], // 100.64.0.0/10
  [[0,0,0,0,0,0,0,0,0,0,255,255,127,0,0,0], 104], // 127.0.0.0/8
  [[0,0,0,0,0,0,0,0,0,0,255,255,169,254,0,0], 112], // 169.254.0.0/16
  [[0,0,0,0,0,0,0,0,0,0,255,255,172,16,0,0], 108], // 172.16.0.0/12
  [[0,0,0,0,0,0,0,0,0,0,255,255,192,0,0,0], 120], // 192.0.0.0/24
  [[0,0,0,0,0,0,0,0,0,0,255,255,192,0,2,0], 120], // 192.0.2.0/24
  [[0,0,0,0,0,0,0,0,0,0,255,255,192,88,99,0], 120], // 192.88.99.0/24
  [[0,0,0,0,0,0,0,0,0,0,255,255,192,168,0,0], 112], // 192.168.0.0/16
  [[0,0,0,0,0,0,0,0,0,0,255,255,198,18,0,0], 111], // 198.18.0.0/15
  [[0,0,0,0,0,0,0,0,0,0,255,255,198,51,100,0], 120], // 198.51.100.0/24
  [[0,0,0,0,0,0,0,0,0,0,255,255,203,0,113,0], 120], // 203.0.113.0/24
  [[0,0,0,0,0,0,0,0,0,0,255,255,224,0,0,0], 100], // 224.0.0.0/4
  [[0,0,0,0,0,0,0,0,0,0,255,255,240,0,0,0], 100], // 240.0.0.0/4
  [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 128], // ::/128
  [[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], 128], // ::1/128
  [[0,100,255,155,0,0,0,0,0,0,0,0,0,0,0,0], 96], // 64:ff9b::/96
  [[0,100,255,155,0,1,0,0,0,0,0,0,0,0,0,0], 48], // 64:ff9b:1::/48
  [[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 64], // 100::/64
  [[32,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 32], // 2001::/32
  [[32,1,13,184,0,0,0,0,0,0,0,0,0,0,0,0], 32], // 2001:db8::/32
  [[63,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 20], // 3fff::/20
  [[95,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 16], // 5f00::/16
  [[252,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 7], // fc00::/7
  [[254,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 10], // fe80::/10
  [[254,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 10], // fec0::/10
  [[255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], 8], // ff00::/8
];

var howlFrameRedirectSafeHeaders = ["accept", "accept-encoding", "accept-language", "content-type", "content-length", "content-encoding", "user-agent"];

function howlFrameGrantList() {
  var raw = "";
  if (typeof process !== "undefined" && process.env) {
    raw = process.env.HOWLFRAME_ALLOW_CAPS || "";
  } else if (typeof globalThis !== "undefined") {
    raw = globalThis.HOWLFRAME_ALLOW_CAPS;
  }
  if (typeof raw !== "string") return [];
  return raw.split(",").map(function (p) { return p.trim(); });
}

// Mirrors capability.Grants.AuthorizeFetch: exact host (WHATWG-canonical,
// so IP literals compare in canonical form) and port; an omitted grant port
// means the scheme default. The coarse network grant never fetches.
// howlFrameCanonHost mirrors capability's canonicalIP: an IPv4-mapped IPv6
// literal ([::ffff:a.b.c.d]) is the same host as a.b.c.d (#177).
function howlFrameCanonHost(hostname) {
  var h = String(hostname).toLowerCase();
  if (h.charAt(0) !== "[") return h;
  var b = howlFrameAddrBytes(h);
  if (b && b.slice(0, 12).join(",") === "0,0,0,0,0,0,0,0,0,0,255,255") return b.slice(12).join(".");
  return h;
}

function howlFrameFetchOrigin(u) {
  return u.protocol + "//" + howlFrameCanonHost(u.hostname) + ":" + (u.port || (u.protocol === "https:" ? "443" : "80"));
}

function howlFrameFetchAllowed(u) {
  if (!u || (u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname) return false;
  if (u.hostname.charAt(u.hostname.length - 1) === ".") return false;
  var def = u.protocol === "https:" ? "443" : "80";
  var port = u.port || def;
  var grants = howlFrameGrantList();
  for (var i = 0; i < grants.length; i++) {
    if (grants[i].indexOf("network:fetch=") !== 0) continue;
    var spec = grants[i].slice("network:fetch=".length);
    if (spec === "" || /[\/@?#*%\s\\]/.test(spec) || spec.charAt(spec.length - 1) === ":") continue;
    var g;
    try { g = new URL("http://" + spec); } catch (e) { continue; }
    var writtenHost = spec.charAt(0) === "[" ? spec.slice(0, spec.indexOf("]") + 1) : spec.split(":")[0].toLowerCase();
    if (writtenHost.charAt(0) !== "[" && /(^|\.)[0-9][^.]*$/.test(writtenHost) && writtenHost !== g.hostname) continue;
    if (howlFrameCanonHost(g.hostname) !== howlFrameCanonHost(u.hostname)) continue;
    var gport = /:\d+$/.test(spec) ? spec.slice(spec.lastIndexOf(":") + 1) : def;
    if (String(Number(gport)) === gport && gport === port) return true;
  }
  return false;
}

function howlFrameFetchURL(raw, base) {
  var written = String(raw);
  if (written.indexOf("\\") >= 0 || /^https?:/i.test(written) && !/^https?:\/\/[^/]/i.test(written)) howlFrameFetchDeny();
  var u = new URL(written, base);
  // WHATWG rewrites short, octal and hexadecimal IPv4 before grant matching.
  var authority = /^(?:[a-z][a-z0-9+.-]*:)?\/\/([^/?#]*)/i.exec(written);
  if (authority) {
    var host = authority[1].slice(authority[1].lastIndexOf("@") + 1).split(":")[0].toLowerCase();
    if (host.charAt(0) !== "[" && /(^|\.)[0-9][^.]*$/.test(host) && host !== u.hostname) howlFrameFetchDeny();
  }
  return u;
}

function howlFrameFetchDeny() {
  throw new Error("CAPABILITY_DENIED: capability denied: network");
}

// Node checks private and metadata DNS results and pins the connection. A
// browser cannot inspect DNS, so its own network policy governs named hosts.
function howlFrameAddrBytes(a) {
  a = String(a).toLowerCase().replace(/^\[|\]$/g, "");
  var v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(a);
  if (v4) {
    var out4 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255];
    for (var k = 1; k <= 4; k++) { var n4 = Number(v4[k]); if (n4 > 255) return null; out4.push(n4); }
    return out4;
  }
  if (a.indexOf(":") < 0 || a.indexOf("%") >= 0) return null;
  var tail = /^(.*:)(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (tail) {
    var t = howlFrameAddrBytes(tail[2]);
    if (!t) return null;
    a = tail[1] + ((t[12] << 8) | t[13]).toString(16) + ":" + ((t[14] << 8) | t[15]).toString(16);
  }
  var halves = a.split("::");
  if (halves.length > 2) return null;
  var head = halves[0] ? halves[0].split(":") : [];
  var rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  var fill = 8 - head.length - rest.length;
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null;
  var groups = head.concat(new Array(halves.length === 2 ? fill : 0).fill("0"), rest);
  var out = [];
  for (var g = 0; g < groups.length; g++) {
    if (!/^[0-9a-f]{1,4}$/.test(groups[g])) return null;
    var n = parseInt(groups[g], 16);
    out.push(n >> 8, n & 255);
  }
  return out;
}

// howlFrameIsSpecial mirrors capability.ForbiddenDestination over the shared table.
function howlFrameIsSpecial(b) {
  var mapped = function (x) { return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 255].concat(x); };
  if (b[0] === 0x20 && b[1] === 0x02 && howlFrameIsSpecial(mapped(b.slice(2, 6)))) return true;
  var compat = b.slice(0, 12).every(function (x) { return x === 0; });
  if (compat && !(b[12] === 0 && b[13] === 0 && b[14] === 0)) return howlFrameIsSpecial(mapped(b.slice(12, 16)));
  var translated = b.slice(0, 8).every(function (x) { return x === 0; }) && b[8] === 255 && b[9] === 255 && b[10] === 0 && b[11] === 0;
  if (translated) return howlFrameIsSpecial(mapped(b.slice(12, 16)));
  for (var i = 0; i < howlFrameSpecialPrefixes.length; i++) {
    var p = howlFrameSpecialPrefixes[i][0], bits = howlFrameSpecialPrefixes[i][1], ok = true;
    for (var k = 0; k < 16 && ok && bits > 0; k++, bits -= 8) {
      var mask = bits >= 8 ? 255 : (0xff << (8 - bits)) & 255;
      ok = (b[k] & mask) === (p[k] & mask);
    }
    if (ok) return true;
  }
  return false;
}

function howlFrameIsLoopback(b) {
  if (!b) return false;
  var v4 = b.slice(0, 12).join(",") === "0,0,0,0,0,0,0,0,0,0,255,255";
  return v4 && b[12] === 127 || b.slice(0, 15).every(function (x) { return x === 0; }) && b[15] === 1;
}

function howlFrameForbiddenAddress(address, explicit) {
  var b = howlFrameAddrBytes(address);
  if (!b) return true;
  var v4 = b.slice(0, 12).join(",") === "0,0,0,0,0,0,0,0,0,0,255,255";
  if (v4 && b[12] >= 224 && b[12] <= 239 || b[0] === 0xff) return true;
  if (explicit) return false;
  return howlFrameIsSpecial(b);
}

async function howlFrameFetchResolvedOk(u) {
  var host = u.hostname.replace(/^\[|\]$/g, "");
  var literal = /^\[.*\]$/.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(host);
  if (literal) return !howlFrameForbiddenAddress(host, true);
  if (typeof require !== "function") return true;
  var addrs = await require("dns").promises.lookup(host, { all: true });
  if (!addrs.length) return false;
  var localhost = host === "localhost";
  for (var i = 0; i < addrs.length; i++) {
    if (howlFrameForbiddenAddress(addrs[i].address, localhost)) return false;
    // The localhost opt-out reaches loopback only (127/8, ::1).
    if (localhost && !howlFrameIsLoopback(howlFrameAddrBytes(addrs[i].address))) return false;
  }
  // Pin this request to the full vetted set; never resolve again at connect time.
  u.howlFrameAddresses = addrs.map(function (a) { return { address: a.address, family: a.family }; });
  return true;
}

function howlFrameFetchRequest(u, init) {
  if (typeof require !== "function") return fetch(u.href, init);
  // Native requests ignore proxy environment variables, including Node 24's
  // NODE_USE_ENV_PROXY. agent:false also prevents pooled connections bypassing lookup.
  return new Promise(function (resolve, reject) {
    var options = { method: init.method, headers: init.headers, agent: false };
    if (u.howlFrameAddresses) options.lookup = function (host, opts, cb) {
      if (typeof opts === "function") { cb = opts; opts = {}; }
      var all = u.howlFrameAddresses.filter(function (a) {
        return !opts || !opts.family || opts.family === a.family || opts.family === "IPv" + a.family;
      });
      if (!all.length) return cb(new Error("CAPABILITY_DENIED: capability denied: network"));
      if (opts && opts.all) return cb(null, all.map(function (a) { return { address: a.address, family: a.family }; }));
      cb(null, all[0].address, all[0].family);
    };
    var req = require(u.protocol === "https:" ? "https" : "http").request(u, options, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("error", reject);
      res.on("end", function () { resolve({
        status: res.statusCode,
        headers: { get: function (name) { return res.headers[name.toLowerCase()]; } },
        text: async function () {
          var data = Buffer.concat(chunks);
          var encoding = String(res.headers["content-encoding"] || "").toLowerCase();
          if (encoding === "gzip") data = require("zlib").gunzipSync(data);
          else if (encoding === "deflate") data = require("zlib").inflateSync(data);
          else if (encoding === "br") data = require("zlib").brotliDecompressSync(data);
          return data.toString("utf8").replace(/^\uFEFF/, "");
        }
      }); });
    });
    req.on("error", reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

async function howlFrameFetch(url, method, body, headers) {
  var u;
  // Browser-relative URLs resolve against the host page, then face the same
  // exact destination grant checks as absolute URLs. Node has no implicit base.
  var base = typeof process === "undefined" && typeof location !== "undefined" ? location.href : undefined;
  try { u = howlFrameFetchURL(url, base); } catch (e) { howlFrameFetchDeny(); }
  if (base && (u.username !== "" || u.password !== "")) howlFrameFetchDeny();
  if (!howlFrameFetchAllowed(u)) howlFrameFetchDeny();
  var init = { method: method, redirect: "manual", headers: Object.assign({}, headers || {}) };
  if (arguments.length >= 3) {
    init.body = body;
  }
  var first = u;
  for (var hop = 0; ; hop++) {
    if (!(await howlFrameFetchResolvedOk(u))) howlFrameFetchDeny();
    var pending = howlFrameFetchRequest(u, init);
    var r = await pending;
    if (r && r.type === "opaqueredirect") howlFrameFetchDeny();
    var loc = r && r.status >= 300 && r.status < 400 && r.headers && r.headers.get ? r.headers.get("location") : null;
    if (!loc) return r.text();
    if (hop >= 10) howlFrameFetchDeny();
    var previous = u;
    try { u = howlFrameFetchURL(loc, u); } catch (e) { howlFrameFetchDeny(); }
    if (previous.protocol === "https:" && u.protocol === "http:") howlFrameFetchDeny();
    var optHost = u.hostname.replace(/^\[|\]$/g, "");
    if ((/^\[.*\]$/.test(u.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(optHost) || optHost === "localhost") && howlFrameCanonHost(u.hostname) !== howlFrameCanonHost(first.hostname)) howlFrameFetchDeny();
    if (u.username !== "" || u.password !== "") howlFrameFetchDeny();
    if (howlFrameFetchOrigin(previous) !== howlFrameFetchOrigin(u)) {
      Object.keys(init.headers || {}).forEach(function (name) {
        if (howlFrameRedirectSafeHeaders.indexOf(String(name).toLowerCase()) < 0) delete init.headers[name];
      });
    }
    if (!howlFrameFetchAllowed(u)) howlFrameFetchDeny();
    if (r.status === 303 || (r.status === 301 || r.status === 302) && init.method === "POST") {
      init = { method: "GET", redirect: "manual" };
    }
  }
}

function howlFrameToInt(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + v + " to int");
    }
    var t = Math.trunc(v);
    if (t < Number.MIN_SAFE_INTEGER || t > Number.MAX_SAFE_INTEGER) {
      throw new Error("CONVERSION_ERROR: cannot convert " + v + " to int");
    }
    return t;
  }
  if (typeof v === "string") {
    var s = v.trim();
    if (!/^[+-]?\d+$/.test(s)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + JSON.stringify(v) + " to int");
    }
    var n = Number(s);
    if (!Number.isInteger(n) || n < Number.MIN_SAFE_INTEGER || n > Number.MAX_SAFE_INTEGER) {
      throw new Error("CONVERSION_ERROR: cannot convert " + JSON.stringify(v) + " to int");
    }
    return n;
  }
  throw new Error("CONVERSION_ERROR: cannot convert " + (typeof v) + " to int");
}
function howlFrameSafeInt(v) {
  if (!Number.isSafeInteger(v)) {
    throw new Error("RUNTIME_ERROR: integer result is outside the exact JavaScript integer range");
  }
  return v;
}
function howlFrameArith(op, a, b) {
  var v = op === "+" ? a + b : op === "-" ? a - b : a * b;
  if (typeof v === "number" && !Number.isSafeInteger(v) && Number.isInteger(a) && Number.isInteger(b)) {
    throw new Error("RUNTIME_ERROR: integer result is outside the exact JavaScript integer range");
  }
  return v;
}
function howlFrameParseJSON(text) {
  // JavaScript numbers cannot hold every int64. When the engine exposes the
  // token source, reject only integer tokens that would lose precision. Without
  // it, fail closed on any integer-valued number outside the exact range:
  // an integer beyond 2^53 always decodes to such a value.
  return JSON.parse(text, function (key, value, context) {
    if (typeof value === "number" && !Number.isSafeInteger(value)) {
      var unsafe = context && typeof context.source === "string" ? /^-?\d+$/.test(context.source) : Number.isInteger(value);
      if (unsafe) {
        throw new Error("CONVERSION_ERROR: integer is outside the exact JavaScript integer range");
      }
    }
    return value;
  });
}
function howlFrameToFloat(v) {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + v + " to float");
    }
    return v;
  }
  if (typeof v === "string") {
    var s = v.trim();
    if (s === "") {
      throw new Error("CONVERSION_ERROR: cannot convert \"\" to float");
    }
    var n = Number(s);
    if (Number.isNaN(n) || !Number.isFinite(n)) {
      throw new Error("CONVERSION_ERROR: cannot convert " + JSON.stringify(v) + " to float");
    }
    return n;
  }
  throw new Error("CONVERSION_ERROR: cannot convert " + (typeof v) + " to float");
}
function howlFrameDiv(a, b) {
  var af = howlFrameToFloat(a);
  var bf = howlFrameToFloat(b);
  if (bf === 0) {
    throw new Error("RUNTIME_ERROR: division by zero");
  }
  var res = af / bf;
  if (!Number.isFinite(res)) {
    throw new Error("RUNTIME_ERROR: division produced an invalid floating-point result");
  }
  return res;
}
function howlFrameValueKind(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "list";
  return typeof v;
}
function howlFrameIsDict(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
function howlFrameMapGet(dict, key) {
  if (!howlFrameIsDict(dict)) {
    throw new Error("TYPE_ERROR: map_get expected dict, got " + howlFrameValueKind(dict));
  }
  return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : null;
}
function howlFrameMapSet(dict, key, val) {
  if (!howlFrameIsDict(dict)) {
    throw new Error("TYPE_ERROR: map_set expected dict, got " + howlFrameValueKind(dict));
  }
  dict[key] = val;
}
function howlFrameMapDelete(dict, key) {
  if (!howlFrameIsDict(dict)) {
    throw new Error("TYPE_ERROR: map_delete expected dict, got " + howlFrameValueKind(dict));
  }
  delete dict[key];
}
function howlFrameAppend(list, item) {
  if (!Array.isArray(list)) {
    throw new Error("TYPE_ERROR: append expected list, got " + howlFrameValueKind(list));
  }
  // Lists are values: append returns a copy, matching the VM.
  var out = list.slice();
  out.push(item);
  return out;
}
function howlFrameListIndex(idx) {
  if (typeof idx === "number" && Number.isInteger(idx)) return idx;
  if (typeof idx === "string" && /^[+-]?\d+$/.test(idx.trim())) return parseInt(idx.trim(), 10);
  throw new Error("TYPE_ERROR: list_get index must be a number, got " + howlFrameValueKind(idx));
}
function howlFrameListGet(list, idx) {
  if (!Array.isArray(list)) {
    throw new Error("TYPE_ERROR: list_get expected list, got " + howlFrameValueKind(list));
  }
  var i = howlFrameListIndex(idx);
  if (i < 0 || i >= list.length) return "";
  return list[i] ?? "";
}
function howlFrameListLen(list) {
  if (!Array.isArray(list)) {
    throw new Error("TYPE_ERROR: list_len expected list, got " + howlFrameValueKind(list));
  }
  return list.length;
}
async function view_envelope_status(mission) {
//line mission_view.howl:21
{
let status = "ENVELOPE_ABSENT";
//line mission_view.howl:22
{
//line mission_view.howl:23
{
let auth = howlFrameMapGet(mission, "authority");
//line mission_view.howl:24
if ((((_v) => _v == null ? "" : String(_v))(auth) === "")) {
//line mission_view.howl:25
{
}
} else {
//line mission_view.howl:26
{
let decision = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(auth, "decision"));
let approval = howlFrameMapGet(auth, "approval");
//line mission_view.howl:28
{
//line mission_view.howl:29
if ((decision === "ALLOW")) {
//line mission_view.howl:29
status = "DELEGATED_AUTHORITY_ALLOW"
} else {
//line mission_view.howl:29
{
}
};
//line mission_view.howl:30
if ((decision === "DENY")) {
//line mission_view.howl:30
status = "DENIED_BY_ENVELOPE"
} else {
//line mission_view.howl:30
{
}
};
//line mission_view.howl:31
if ((((_v) => _v == null ? "" : String(_v))(approval) === "")) {
//line mission_view.howl:32
{
}
} else {
//line mission_view.howl:33
{
let expires = 0;
//line mission_view.howl:34
{
//line mission_view.howl:35
{
let absolute = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(approval, "expires_at"));
//line mission_view.howl:36
if ((absolute === "")) {
//line mission_view.howl:37
{
let relative = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(approval, "expires_in"));
//line mission_view.howl:38
if ((relative === "")) {
//line mission_view.howl:39
{
}
} else {
//line mission_view.howl:40
expires = howlFrameSafeInt(Math.floor(Date.now() / 1000) + howlFrameToInt(relative))
}
}
} else {
//line mission_view.howl:43
expires = howlFrameToInt(absolute)
}
};
//line mission_view.howl:46
if ((expires < Math.floor(Date.now() / 1000))) {
//line mission_view.howl:47
status = "ENVELOPE_EXPIRED"
} else {
//line mission_view.howl:48
if ((decision === "DENY")) {
//line mission_view.howl:49
status = "DENIED_BY_ENVELOPE"
} else {
//line mission_view.howl:50
status = "DELEGATED_AUTHORITY_ALLOW"
}
};
}
}
};
}
}
}
};
//line mission_view.howl:61
return status;;
}
}
}

async function view_esc(s) {
//line mission_view.howl:69
{
let out = ((_v) => _v == null ? "" : String(_v))(s);
//line mission_view.howl:70
{
//line mission_view.howl:71
out = ((out).split("&")).join("&amp;");
//line mission_view.howl:72
out = ((out).split("<")).join("&lt;");
//line mission_view.howl:73
out = ((out).split(">")).join("&gt;");
//line mission_view.howl:74
out = ((out).split("\"")).join("&quot;");
//line mission_view.howl:75
out = ((out).split("'")).join("&#39;");
//line mission_view.howl:76
return out;;
}
}
}

async function view_ago(ts) {
//line mission_view.howl:85
{
let raw = ((_v) => _v == null ? "" : String(_v))(ts);
//line mission_view.howl:86
if (((raw === "") || ((raw === "0") || (raw === "<nil>")))) {
//line mission_view.howl:87
return "not recorded";
} else {
//line mission_view.howl:88
{
let delta = howlFrameSafeInt(Math.floor(Date.now() / 1000) - howlFrameToInt(raw));
let out = "just now";
//line mission_view.howl:90
{
//line mission_view.howl:91
if ((delta < 0)) {
//line mission_view.howl:91
delta = 0
} else {
//line mission_view.howl:91
{
}
};
//line mission_view.howl:92
if ((delta < 60)) {
//line mission_view.howl:93
out = "just now"
} else {
//line mission_view.howl:94
if ((delta < 3600)) {
//line mission_view.howl:95
out = ([((_v) => _v == null ? "" : String(_v))(howlFrameToInt(howlFrameDiv(delta, 60))), "m ago"]).join("")
} else {
//line mission_view.howl:96
if ((delta < 86400)) {
//line mission_view.howl:97
out = ([((_v) => _v == null ? "" : String(_v))(howlFrameToInt(howlFrameDiv(delta, 3600))), "h ago"]).join("")
} else {
//line mission_view.howl:98
out = ([((_v) => _v == null ? "" : String(_v))(howlFrameToInt(howlFrameDiv(delta, 86400))), "d ago"]).join("")
}
}
};
//line mission_view.howl:102
return out;;
}
}
}
}
}

async function view_recorded_time(ts, ledger_stamp) {
//line mission_view.howl:116
{
let stamp = ((_v) => _v == null ? "" : String(_v))(ledger_stamp);
//line mission_view.howl:117
if ((stamp === "")) {
//line mission_view.howl:117
return (await view_ago(ts));
} else {
//line mission_view.howl:117
return (["recorded ", (await view_esc(stamp))]).join("");
}
}
}

async function view_state_pill(st) {
//line mission_view.howl:124
return (["<span class=\"state state-", (await view_esc(st)), "\">", (await view_esc(st)), "</span>"]).join("");
}

async function view_provenance_badge(p) {
//line mission_view.howl:130
{
let cls = "badge";
let out = "";
//line mission_view.howl:132
{
//line mission_view.howl:133
if ((p === "DEMO")) {
//line mission_view.howl:133
cls = "badge demo"
} else {
//line mission_view.howl:133
{
}
};
//line mission_view.howl:134
if ((p === "LEDGER")) {
//line mission_view.howl:134
cls = "badge ledger"
} else {
//line mission_view.howl:134
{
}
};
//line mission_view.howl:135
if ((((_v) => _v == null ? "" : String(_v))(p) === "")) {
//line mission_view.howl:136
out = ""
} else {
//line mission_view.howl:137
out = (["<span class=\"", cls, "\">", (await view_esc(p)), "</span>"]).join("")
};
//line mission_view.howl:139
return out;;
}
}
}

async function view_render_row(m) {
//line mission_view.howl:149
{
let id = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "id"));
let st = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "state"));
let html = "";
//line mission_view.howl:152
{
//line mission_view.howl:153
html = (["<button type=\"button\" class=\"mission-row s-", (await view_esc(st)), "\"", " data-mission-id=\"", (await view_esc(id)), "\"", " onclick=\"window.open_mission(this.dataset.missionId)\">"]).join("");
//line mission_view.howl:157
html = ([html, "<span class=\"row-top\"><span class=\"mid\">", (await view_esc(id)), "</span>", (await view_state_pill(st)), "</span>"]).join("");
//line mission_view.howl:160
html = ([html, "<span class=\"title\">", (await view_esc(howlFrameMapGet(m, "title"))), "</span>"]).join("");
//line mission_view.howl:162
html = ([html, "<span class=\"row-meta\">"]).join("");
//line mission_view.howl:163
html = ([html, "<span class=\"tag\">", (await view_esc(howlFrameMapGet(m, "project"))), "</span>"]).join("");
//line mission_view.howl:165
html = ([html, "<span class=\"tag\">", (await view_esc(howlFrameMapGet(m, "priority"))), "</span>"]).join("");
//line mission_view.howl:167
{
let ex = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "executor"));
//line mission_view.howl:168
if ((ex === "")) {
//line mission_view.howl:169
html = ([html, "<span class=\"tag\">unassigned</span>"]).join("")
} else {
//line mission_view.howl:170
html = ([html, "<span class=\"tag\">", (await view_esc(ex)), "</span>"]).join("")
}
};
//line mission_view.howl:173
html = ([html, "<span class=\"status status-", (await view_esc(howlFrameMapGet(m, "envelope_status"))), "\">", (await view_esc(howlFrameMapGet(m, "envelope_status"))), "</span>"]).join("");
//line mission_view.howl:176
html = ([html, (await view_provenance_badge(howlFrameMapGet(m, "provenance")))]).join("");
//line mission_view.howl:177
html = ([html, "</span></button>"]).join("");
//line mission_view.howl:178
return html;;
}
}
}

async function view_stage_mission(m) {
//line mission_view.howl:189
{
let html = "<div class=\"stage\"><h3 data-step=\"01\">Mission</h3>";
//line mission_view.howl:190
{
//line mission_view.howl:191
html = ([html, "<p class=\"detail-title\">", (await view_esc(howlFrameMapGet(m, "title"))), "</p>"]).join("");
//line mission_view.howl:193
html = ([html, "<p class=\"detail-desc\">", (await view_esc(howlFrameMapGet(m, "description"))), "</p>"]).join("");
//line mission_view.howl:195
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:196
html = ([html, "<dt>Identifier</dt><dd>", (await view_esc(howlFrameMapGet(m, "id"))), "</dd>"]).join("");
//line mission_view.howl:197
html = ([html, "<dt>Workstream</dt><dd>", (await view_esc(howlFrameMapGet(m, "project"))), "</dd>"]).join("");
//line mission_view.howl:198
html = ([html, "<dt>State</dt><dd>", (await view_state_pill(((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "state")))), "</dd>"]).join("");
//line mission_view.howl:199
html = ([html, "<dt>Priority</dt><dd>", (await view_esc(howlFrameMapGet(m, "priority"))), "</dd>"]).join("");
//line mission_view.howl:200
html = ([html, "<dt>Risk</dt><dd>", (await view_esc(howlFrameMapGet(m, "risk_level"))), "</dd>"]).join("");
//line mission_view.howl:201
html = ([html, "<dt>Class</dt><dd>", (await view_esc(howlFrameMapGet(m, "task_class"))), "</dd>"]).join("");
//line mission_view.howl:202
html = ([html, "<dt>Updated</dt><dd>", (await view_ago(howlFrameMapGet(m, "updated_at"))), "</dd>"]).join("");
//line mission_view.howl:203
html = ([html, "<dt>Provenance</dt><dd>", (await view_provenance_badge(howlFrameMapGet(m, "provenance"))), "</dd>"]).join("");
//line mission_view.howl:204
{
let recorded = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "ledger_recorded_at"));
//line mission_view.howl:205
if ((recorded === "")) {
//line mission_view.howl:205
{
}
} else {
//line mission_view.howl:206
html = ([html, "<dt>Ledger recorded</dt><dd>", (await view_esc(recorded)), "</dd>"]).join("")
}
};
//line mission_view.howl:209
{
let mode = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "recording_mode"));
//line mission_view.howl:210
if ((mode === "")) {
//line mission_view.howl:210
{
}
} else {
//line mission_view.howl:211
html = ([html, "<dt>Recording method</dt><dd>", (await view_esc(mode)), "</dd>"]).join("")
}
};
//line mission_view.howl:214
html = ([html, "</dl>"]).join("");
//line mission_view.howl:218
{
let deps = howlFrameMapGet(m, "depends_on");
//line mission_view.howl:219
if ((((_v) => _v == null ? "" : String(_v))(deps) === "")) {
//line mission_view.howl:220
{
}
} else {
//line mission_view.howl:221
if ((howlFrameListLen(deps) === 0)) {
//line mission_view.howl:222
{
}
} else {
//line mission_view.howl:223
{
//line mission_view.howl:224
html = ([html, "<div class=\"depends-block\">", "<p class=\"depends-label\">Depends on</p>", "<p class=\"item-sub\">Informational only â\u0080\u0094 does not imply ordering, blocking, approval, or scheduling.</p>", "<ul class=\"depends-list\">"]).join("");
//line mission_view.howl:229
for (let dep of deps) {
//line mission_view.howl:230
{
//line mission_view.howl:231
html = ([html, "<li><button type=\"button\" class=\"depends-link\"", " data-mission-id=\"", (await view_esc(dep)), "\"", " onclick=\"window.open_mission(this.dataset.missionId)\">", (await view_esc(dep)), "</button></li>"]).join("");
}
};
//line mission_view.howl:238
html = ([html, "</ul></div>"]).join("");
}
}
}
};
//line mission_view.howl:243
html = ([html, "</div>"]).join("");
//line mission_view.howl:244
return html;;
}
}
}

async function view_stage_evidence(m) {
//line mission_view.howl:253
{
let items = howlFrameMapGet(m, "evidence");
let html = "<div class=\"stage\"><h3 data-step=\"02\">Evidence</h3>";
//line mission_view.howl:255
{
//line mission_view.howl:256
if ((((_v) => _v == null ? "" : String(_v))(items) === "")) {
//line mission_view.howl:257
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:258
if ((howlFrameListLen(items) === 0)) {
//line mission_view.howl:259
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:260
for (let e of items) {
//line mission_view.howl:261
{
let block = "<div class=\"item\">";
//line mission_view.howl:262
{
//line mission_view.howl:263
block = ([block, "<span class=\"item-head\"><span class=\"tag\">", (await view_esc(howlFrameMapGet(e, "type"))), "</span><strong>", (await view_esc(howlFrameMapGet(e, "ref"))), "</strong></span>"]).join("");
//line mission_view.howl:266
block = ([block, "<span class=\"item-sub\">", (await view_esc(howlFrameMapGet(e, "description"))), "</span>"]).join("");
//line mission_view.howl:268
block = ([block, "<span class=\"item-sub\">source ", (await view_esc(howlFrameMapGet(e, "source"))), " &middot; ", (await view_esc(howlFrameMapGet(e, "fingerprint"))), " &middot; ", (await view_recorded_time(howlFrameMapGet(e, "collected_at"), howlFrameMapGet(e, "ledger_recorded_at"))), "</span>"]).join("");
//line mission_view.howl:272
html = ([html, block, "</div>"]).join("");
}
}
}
}
};
//line mission_view.howl:278
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_reasoning(m) {
//line mission_view.howl:288
{
let r = howlFrameMapGet(m, "reasoning");
let html = "<div class=\"stage\"><h3 data-step=\"03\">Decision</h3>";
//line mission_view.howl:290
{
//line mission_view.howl:291
if ((((_v) => _v == null ? "" : String(_v))(r) === "")) {
//line mission_view.howl:292
html = ([html, "<p class=\"item-sub\">No decision record.</p>"]).join("")
} else {
//line mission_view.howl:293
{
//line mission_view.howl:294
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:295
html = ([html, "<dt>Problem</dt><dd>", (await view_esc(howlFrameMapGet(r, "problem"))), "</dd>"]).join("");
//line mission_view.howl:296
{
let obs = howlFrameMapGet(r, "observations");
//line mission_view.howl:297
if ((((_v) => _v == null ? "" : String(_v))(obs) === "")) {
//line mission_view.howl:298
{
}
} else {
//line mission_view.howl:299
{
let acc = "";
//line mission_view.howl:300
{
//line mission_view.howl:301
for (let o of obs) {
//line mission_view.howl:301
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(o)), "</div>"]).join("")
};
//line mission_view.howl:302
html = ([html, "<dt>Observations</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:307
{
let asm = howlFrameMapGet(r, "assumptions");
//line mission_view.howl:308
if ((((_v) => _v == null ? "" : String(_v))(asm) === "")) {
//line mission_view.howl:309
{
}
} else {
//line mission_view.howl:310
{
let acc = "";
//line mission_view.howl:311
{
//line mission_view.howl:312
for (let a of asm) {
//line mission_view.howl:312
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(a)), "</div>"]).join("")
};
//line mission_view.howl:313
html = ([html, "<dt>Assumptions</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:318
{
let opts = howlFrameMapGet(r, "options");
//line mission_view.howl:319
if ((((_v) => _v == null ? "" : String(_v))(opts) === "")) {
//line mission_view.howl:320
{
}
} else {
//line mission_view.howl:321
{
let acc = "";
//line mission_view.howl:322
{
//line mission_view.howl:323
for (let o of opts) {
//line mission_view.howl:324
acc = ([acc, "<div class=\"item\"><strong>", (await view_esc(howlFrameMapGet(o, "option"))), "</strong>", "<span class=\"item-sub\">", (await view_esc(howlFrameMapGet(o, "assessment"))), "</span></div>"]).join("")
};
//line mission_view.howl:328
html = ([html, "<dt>Options</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:333
html = ([html, "<dt>Selected</dt><dd><strong>", (await view_esc(howlFrameMapGet(r, "selected"))), "</strong></dd>"]).join("");
//line mission_view.howl:334
html = ([html, "<dt>Rationale</dt><dd>", (await view_esc(howlFrameMapGet(r, "rationale"))), "</dd>"]).join("");
//line mission_view.howl:335
html = ([html, "<dt>Confidence</dt><dd>", (await view_esc(howlFrameMapGet(r, "confidence"))), "</dd>"]).join("");
//line mission_view.howl:336
html = ([html, "<dt>Decided by</dt><dd>", (await view_esc(howlFrameMapGet(r, "decided_by"))), "</dd>"]).join("");
//line mission_view.howl:337
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:340
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_authority(m) {
//line mission_view.howl:350
{
let a = howlFrameMapGet(m, "authority");
let env = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "envelope_status"));
let html = "<div class=\"stage\"><h3 data-step=\"04\">Authority</h3>";
//line mission_view.howl:353
{
//line mission_view.howl:354
html = ([html, "<p class=\"authority-banner env-", (await view_esc(env)), "\">", (await view_esc(env)), "</p>"]).join("");
//line mission_view.howl:356
if ((((_v) => _v == null ? "" : String(_v))(a) === "")) {
//line mission_view.howl:357
html = ([html, "<p class=\"item-sub\">No authority record.</p>"]).join("")
} else {
//line mission_view.howl:358
{
//line mission_view.howl:359
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:360
html = ([html, "<dt>Decision</dt><dd>", (await view_esc(howlFrameMapGet(a, "decision"))), "</dd>"]).join("");
//line mission_view.howl:361
html = ([html, "<dt>Reason</dt><dd>", (await view_esc(howlFrameMapGet(a, "reason"))), "</dd>"]).join("");
//line mission_view.howl:362
html = ([html, "<dt>Digest</dt><dd>", (await view_esc(howlFrameMapGet(a, "digest"))), "</dd>"]).join("");
//line mission_view.howl:363
{
let gates = howlFrameMapGet(a, "gates");
//line mission_view.howl:364
if ((((_v) => _v == null ? "" : String(_v))(gates) === "")) {
//line mission_view.howl:365
{
}
} else {
//line mission_view.howl:366
{
let acc = "";
//line mission_view.howl:367
{
//line mission_view.howl:368
for (let g of gates) {
//line mission_view.howl:369
acc = ([acc, "<div class=\"item-head\"><span>", (await view_esc(howlFrameMapGet(g, "name"))), "</span>", "<span class=\"status status-", (await view_esc(howlFrameMapGet(g, "status"))), "\">", (await view_esc(howlFrameMapGet(g, "status"))), "</span></div>"]).join("")
};
//line mission_view.howl:374
html = ([html, "<dt>Gates</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:379
{
let ap = howlFrameMapGet(a, "approval");
//line mission_view.howl:380
if ((((_v) => _v == null ? "" : String(_v))(ap) === "")) {
//line mission_view.howl:381
html = ([html, "<dt>Approval</dt><dd class=\"item-sub\">No approval on record.</dd>"]).join("")
} else {
//line mission_view.howl:383
{
//line mission_view.howl:384
html = ([html, "<dt>Approver</dt><dd>", (await view_esc(howlFrameMapGet(ap, "approver"))), "</dd>"]).join("");
//line mission_view.howl:386
html = ([html, "<dt>Issued</dt><dd>", (await view_ago(howlFrameMapGet(ap, "issued_at"))), "</dd>"]).join("");
//line mission_view.howl:388
if ((env === "ENVELOPE_EXPIRED")) {
//line mission_view.howl:389
html = ([html, "<dt>Expiry</dt><dd class=\"status status-EXPIRED\">Lapsed ", (await view_ago(howlFrameMapGet(ap, "expires_at"))), "</dd>"]).join("")
} else {
//line mission_view.howl:392
{
let raw_exp = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(ap, "expires_at"));
let exp_ts = 0;
//line mission_view.howl:394
{
//line mission_view.howl:395
if ((raw_exp !== "")) {
//line mission_view.howl:396
exp_ts = howlFrameToInt(raw_exp)
} else {
//line mission_view.howl:397
{
}
};
//line mission_view.howl:399
html = ([html, "<dt>Expiry</dt><dd>Valid, expires in ", ((_v) => _v == null ? "" : String(_v))(howlFrameToInt(howlFrameDiv(howlFrameSafeInt(exp_ts - Math.floor(Date.now() / 1000)), 60))), " min</dd>"]).join("");
}
}
};
}
}
};
//line mission_view.howl:410
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:413
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_plan(m) {
//line mission_view.howl:424
{
let steps = howlFrameMapGet(m, "plan");
let html = "<div class=\"stage\"><h3 data-step=\"05\">Plan</h3>";
//line mission_view.howl:426
{
//line mission_view.howl:427
if ((((_v) => _v == null ? "" : String(_v))(steps) === "")) {
//line mission_view.howl:428
html = ([html, "<p class=\"item-sub\">No plan recorded.</p>"]).join("")
} else {
//line mission_view.howl:429
for (let s of steps) {
//line mission_view.howl:430
{
let st = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(s, "state"));
let marker = "[ ]";
//line mission_view.howl:432
{
//line mission_view.howl:433
if ((st === "complete")) {
//line mission_view.howl:433
marker = "[x]"
} else {
//line mission_view.howl:433
{
}
};
//line mission_view.howl:434
if ((st === "active")) {
//line mission_view.howl:434
marker = "[>]"
} else {
//line mission_view.howl:434
{
}
};
//line mission_view.howl:435
if ((st === "failed")) {
//line mission_view.howl:435
marker = "[!]"
} else {
//line mission_view.howl:435
{
}
};
//line mission_view.howl:436
if ((st === "skipped")) {
//line mission_view.howl:436
marker = "[-]"
} else {
//line mission_view.howl:436
{
}
};
//line mission_view.howl:437
html = ([html, "<div class=\"plan-step p-", (await view_esc(st)), "\">", "<span class=\"marker\">", marker, "</span>", "<span><span>", (await view_esc(howlFrameMapGet(s, "action"))), "</span>", "<span class=\"item-sub\"> ", (await view_esc(howlFrameMapGet(s, "owner"))), " &middot; ", (await view_esc(st)), "</span></span></div>"]).join("");
}
}
}
};
//line mission_view.howl:448
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_executor(m) {
//line mission_view.howl:458
{
let html = "<div class=\"stage\"><h3 data-step=\"06\">Executor</h3><dl class=\"kv\">";
//line mission_view.howl:459
{
//line mission_view.howl:460
{
let ex = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "executor"));
//line mission_view.howl:461
if ((ex === "")) {
//line mission_view.howl:462
html = ([html, "<dt>Assigned</dt><dd class=\"item-sub\">None; work has not been dispatched.</dd>"]).join("")
} else {
//line mission_view.howl:463
html = ([html, "<dt>Assigned</dt><dd>", (await view_esc(ex)), "</dd>"]).join("")
}
};
//line mission_view.howl:466
html = ([html, "<dt>Recommended</dt><dd>", (await view_esc(howlFrameMapGet(m, "recommended_executor"))), "</dd>"]).join("");
//line mission_view.howl:468
{
let ov = howlFrameMapGet(m, "is_override");
//line mission_view.howl:469
if ((((_v) => _v == null ? "" : String(_v))(ov) === "true")) {
//line mission_view.howl:470
html = ([html, "<dt>Override</dt><dd class=\"status status-PENDING\">Yes &mdash; ", (await view_esc(howlFrameMapGet(m, "override_reason"))), "</dd>"]).join("")
} else {
//line mission_view.howl:473
html = ([html, "<dt>Override</dt><dd>No</dd>"]).join("")
}
};
//line mission_view.howl:476
return ([html, "</dl></div>"]).join("");;
}
}
}

async function view_stage_execution(m) {
//line mission_view.howl:485
{
let x = howlFrameMapGet(m, "execution");
let html = "<div class=\"stage\"><h3 data-step=\"07\">Execution</h3>";
//line mission_view.howl:487
{
//line mission_view.howl:488
if ((((_v) => _v == null ? "" : String(_v))(x) === "")) {
//line mission_view.howl:489
html = ([html, "<p class=\"item-sub\">Execution details not recorded.</p>"]).join("")
} else {
//line mission_view.howl:490
{
//line mission_view.howl:491
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:492
{
let raw_start = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(x, "started_at"));
let started = 0;
//line mission_view.howl:494
{
//line mission_view.howl:495
if ((raw_start !== "")) {
//line mission_view.howl:496
started = howlFrameToInt(raw_start)
} else {
//line mission_view.howl:497
{
}
};
//line mission_view.howl:499
if ((started === 0)) {
//line mission_view.howl:500
if ((howlFrameMapGet(x, "start_recorded") === true)) {
//line mission_view.howl:501
html = ([html, "<dt>Started</dt><dd class=\"item-sub\">Start event recorded; start time not recorded.</dd>"]).join("")
} else {
//line mission_view.howl:502
html = ([html, "<dt>Started</dt><dd class=\"item-sub\">Start time not recorded.</dd>"]).join("")
}
} else {
//line mission_view.howl:504
html = ([html, "<dt>Started</dt><dd>", (await view_ago(started)), "</dd>"]).join("")
};
}
};
//line mission_view.howl:509
{
let op = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(x, "current_operation"));
//line mission_view.howl:510
if ((op === "")) {
//line mission_view.howl:511
{
}
} else {
//line mission_view.howl:512
html = ([html, "<dt>Current</dt><dd>", (await view_esc(op)), "</dd>"]).join("")
}
};
//line mission_view.howl:515
html = ([html, "<dt>Retries</dt><dd>", ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(x, "retries")), "</dd>"]).join("");
//line mission_view.howl:516
{
let rec = howlFrameMapGet(x, "delta");
//line mission_view.howl:517
if ((((_v) => _v == null ? "" : String(_v))(rec) === "")) {
//line mission_view.howl:518
{
}
} else {
//line mission_view.howl:519
{
//line mission_view.howl:520
{
let mods = howlFrameMapGet(rec, "files_modified");
let acc = "";
//line mission_view.howl:522
{
//line mission_view.howl:523
if ((((_v) => _v == null ? "" : String(_v))(mods) === "")) {
//line mission_view.howl:524
{
}
} else {
//line mission_view.howl:525
for (let f of mods) {
//line mission_view.howl:525
acc = ([acc, "<div class=\"item-sub\">", (await view_esc(f)), "</div>"]).join("")
}
};
//line mission_view.howl:527
if ((acc === "")) {
//line mission_view.howl:527
acc = "<span class=\"item-sub\">none</span>"
} else {
//line mission_view.howl:527
{
}
};
//line mission_view.howl:528
html = ([html, "<dt>Files changed</dt><dd>", acc, "</dd>"]).join("");
}
};
//line mission_view.howl:532
html = ([html, "<dt>Diff</dt><dd>+", ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(rec, "insertions")), " / -", ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(rec, "deletions")), "</dd>"]).join("");
//line mission_view.howl:535
{
let unexpected = howlFrameMapGet(rec, "unexpected");
let n = 0;
//line mission_view.howl:537
{
//line mission_view.howl:538
if ((((_v) => _v == null ? "" : String(_v))(unexpected) === "")) {
//line mission_view.howl:538
{
}
} else {
//line mission_view.howl:538
n = howlFrameListLen(unexpected)
};
//line mission_view.howl:539
if ((n === 0)) {
//line mission_view.howl:540
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-passed\">None detected</dd>"]).join("")
} else {
//line mission_view.howl:542
{
let acc = "";
//line mission_view.howl:543
{
//line mission_view.howl:544
for (let f of unexpected) {
//line mission_view.howl:544
acc = ([acc, "<div>", (await view_esc(f)), "</div>"]).join("")
};
//line mission_view.howl:545
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-failed\">", acc, "</dd>"]).join("");
}
}
};
}
};
}
}
};
//line mission_view.howl:556
{
let receipt = howlFrameMapGet(x, "receipt");
//line mission_view.howl:557
if ((((_v) => _v == null ? "" : String(_v))(receipt) === "")) {
//line mission_view.howl:558
{
}
} else {
//line mission_view.howl:559
{
//line mission_view.howl:560
{
let err = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(receipt, "error_message"));
//line mission_view.howl:561
if ((err === "")) {
//line mission_view.howl:562
{
}
} else {
//line mission_view.howl:563
html = ([html, "<dt>Error</dt><dd class=\"status status-failed\">", (await view_esc(err)), "</dd>"]).join("")
}
};
//line mission_view.howl:567
{
let rb = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(receipt, "rollback_status"));
//line mission_view.howl:568
if ((rb === "")) {
//line mission_view.howl:569
{
}
} else {
//line mission_view.howl:570
html = ([html, "<dt>Rollback</dt><dd>", (await view_esc(rb)), "</dd>"]).join("")
}
};
}
}
};
//line mission_view.howl:576
{
let recovery = howlFrameMapGet(x, "recovery_actions");
//line mission_view.howl:577
if ((((_v) => _v == null ? "" : String(_v))(recovery) === "")) {
//line mission_view.howl:578
{
}
} else {
//line mission_view.howl:579
if ((howlFrameListLen(recovery) === 0)) {
//line mission_view.howl:580
{
}
} else {
//line mission_view.howl:581
{
let acc = "";
//line mission_view.howl:582
{
//line mission_view.howl:583
for (let r of recovery) {
//line mission_view.howl:583
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(r)), "</div>"]).join("")
};
//line mission_view.howl:584
html = ([html, "<dt>Recovery</dt><dd>", acc, "</dd>"]).join("");
}
}
}
}
};
//line mission_view.howl:590
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:593
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_verification(m) {
//line mission_view.howl:603
{
let vs = howlFrameMapGet(m, "verification");
let html = "<div class=\"stage\"><h3 data-step=\"08\">Verification</h3>";
//line mission_view.howl:605
{
//line mission_view.howl:606
if ((((_v) => _v == null ? "" : String(_v))(vs) === "")) {
//line mission_view.howl:607
html = ([html, "<p class=\"item-sub\">No verification details recorded.</p>"]).join("")
} else {
//line mission_view.howl:608
if ((howlFrameListLen(vs) === 0)) {
//line mission_view.howl:609
html = ([html, "<p class=\"item-sub\">No verification details recorded.</p>"]).join("")
} else {
//line mission_view.howl:610
for (let v of vs) {
//line mission_view.howl:611
{
let st = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(v, "status"));
let block = "";
//line mission_view.howl:613
{
//line mission_view.howl:614
block = (["<div class=\"verification-row v-", (await view_esc(st)), "\">", "<span><span>", (await view_esc(howlFrameMapGet(v, "name"))), "</span>"]).join("");
//line mission_view.howl:617
if ((st === "claimed")) {
//line mission_view.howl:618
block = ([block, "<span class=\"claim-warning\">Claimed by the agent; not independently verified.</span>"]).join("")
} else {
//line mission_view.howl:620
{
}
};
//line mission_view.howl:621
{
let digest = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(v, "output_digest"));
//line mission_view.howl:622
if ((digest === "")) {
//line mission_view.howl:623
{
}
} else {
//line mission_view.howl:624
block = ([block, "<span class=\"item-sub\">", (await view_esc(digest)), "</span>"]).join("")
}
};
//line mission_view.howl:628
{
let summary = howlFrameMapGet(v, "summary");
//line mission_view.howl:629
if ((((_v) => _v == null ? "" : String(_v))(summary) === "")) {
//line mission_view.howl:629
{
}
} else {
//line mission_view.howl:630
block = ([block, "<span class=\"item-sub\">", (await view_esc(JSON.stringify(summary))), "</span>"]).join("")
}
};
//line mission_view.howl:633
{
let exit_text = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(v, "exit_code"));
//line mission_view.howl:634
{
//line mission_view.howl:635
if (((exit_text === "") || (exit_text === "<nil>"))) {
//line mission_view.howl:635
exit_text = "not recorded"
} else {
//line mission_view.howl:635
{
}
};
//line mission_view.howl:636
block = ([block, "</span><span class=\"status status-", (await view_esc(st)), "\">", (await view_esc(st)), " (exit ", (await view_esc(exit_text)), ")</span></div>"]).join("");
}
};
//line mission_view.howl:641
html = ([html, block]).join("");
}
}
}
}
};
//line mission_view.howl:648
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_outcome(m) {
//line mission_view.howl:658
{
let o = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "outcome"));
let html = "<div class=\"stage\"><h3 data-step=\"09\">Outcome</h3>";
//line mission_view.howl:660
{
//line mission_view.howl:661
if ((o === "")) {
//line mission_view.howl:662
html = ([html, "<p class=\"outcome-line outcome-pending\">Not yet reached</p>"]).join("")
} else {
//line mission_view.howl:664
html = ([html, "<p class=\"outcome-line outcome-", (await view_esc(o)), "\">", (await view_esc(o)), "</p>"]).join("")
};
//line mission_view.howl:667
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_timeline(m) {
//line mission_view.howl:677
{
let events = howlFrameMapGet(m, "timeline");
let html = "<div class=\"stage\"><h3 data-step=\"10\">Audit timeline</h3><div class=\"timeline\">";
//line mission_view.howl:679
{
//line mission_view.howl:680
if ((((_v) => _v == null ? "" : String(_v))(events) === "")) {
//line mission_view.howl:681
html = ([html, "<p class=\"item-sub\">No recorded history.</p>"]).join("")
} else {
//line mission_view.howl:682
for (let e of events) {
//line mission_view.howl:683
{
let action = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(e, "action"));
let cls = "timeline-row";
//line mission_view.howl:685
{
//line mission_view.howl:686
if ((action === "human_approval")) {
//line mission_view.howl:686
cls = "timeline-row t-human"
} else {
//line mission_view.howl:686
{
}
};
//line mission_view.howl:687
if ((action === "human_rejection")) {
//line mission_view.howl:687
cls = "timeline-row t-human"
} else {
//line mission_view.howl:687
{
}
};
//line mission_view.howl:688
if ((action === "human_decision_requested")) {
//line mission_view.howl:688
cls = "timeline-row t-human"
} else {
//line mission_view.howl:688
{
}
};
//line mission_view.howl:689
if ((action === "human_boundary_triggered")) {
//line mission_view.howl:689
cls = "timeline-row t-human"
} else {
//line mission_view.howl:689
{
}
};
//line mission_view.howl:690
if ((action === "task_failed")) {
//line mission_view.howl:690
cls = "timeline-row t-fail"
} else {
//line mission_view.howl:690
{
}
};
//line mission_view.howl:691
if ((action === "task_completed")) {
//line mission_view.howl:691
cls = "timeline-row t-done"
} else {
//line mission_view.howl:691
{
}
};
//line mission_view.howl:692
html = ([html, "<div class=\"", cls, "\"><span class=\"at\">", (await view_recorded_time(howlFrameMapGet(e, "timestamp"), howlFrameMapGet(e, "ledger_recorded_at"))), "</span>", "<span><span class=\"what\">", (await view_esc(action)), "</span>", "<span class=\"who\"> ", (await view_esc(howlFrameMapGet(e, "actor"))), "</span>"]).join("");
//line mission_view.howl:696
{
let detail = ((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(e, "detail"));
//line mission_view.howl:697
if ((detail === "")) {
//line mission_view.howl:698
{
}
} else {
//line mission_view.howl:699
html = ([html, "<span class=\"item-sub\">", (await view_esc(detail)), "</span>"]).join("")
}
};
//line mission_view.howl:703
html = ([html, "</span></div>"]).join("");
}
}
}
};
//line mission_view.howl:709
return ([html, "</div></div>"]).join("");;
}
}
}

async function view_render_detail(m) {
//line mission_view.howl:719
{
let html = "";
//line mission_view.howl:720
{
//line mission_view.howl:721
html = ([html, (await view_stage_mission(m))]).join("");
//line mission_view.howl:722
html = ([html, (await view_stage_evidence(m))]).join("");
//line mission_view.howl:723
html = ([html, (await view_stage_reasoning(m))]).join("");
//line mission_view.howl:724
html = ([html, (await view_stage_authority(m))]).join("");
//line mission_view.howl:725
html = ([html, (await view_stage_plan(m))]).join("");
//line mission_view.howl:726
html = ([html, (await view_stage_executor(m))]).join("");
//line mission_view.howl:727
html = ([html, (await view_stage_execution(m))]).join("");
//line mission_view.howl:728
html = ([html, (await view_stage_verification(m))]).join("");
//line mission_view.howl:729
html = ([html, (await view_stage_outcome(m))]).join("");
//line mission_view.howl:730
html = ([html, (await view_stage_timeline(m))]).join("");
//line mission_view.howl:731
return html;;
}
}
}

async function show_missions(doc) {
//line demo.howl:18
{
let missions = howlFrameMapGet(doc, "missions");
let html = "";
//line demo.howl:20
{
//line demo.howl:21
for (let m of missions) {
//line demo.howl:22
{
howlFrameMapSet(m, "envelope_status", (await view_envelope_status(m)));
//line demo.howl:24
html = ([html, (await view_render_row(m))]).join("");
}
};
document.querySelector("#demo-list").innerHTML = html;
}
}
}

async function open_mission(id) {
//line demo.howl:38
{
	let raw;
	let err = null;
	try {
		raw = (await howlFrameFetch("missions.json", "GET"));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		document.querySelector("#demo-detail").textContent = "Demo data could not be loaded."
	} else {
		//line demo.howl:40
{
	let doc;
	let perr = null;
	try {
		doc = howlFrameParseJSON(raw);
	} catch (e) {
		perr = e;
	}
	if (perr !== null) {
		document.querySelector("#demo-detail").textContent = "Demo data was not valid JSON."
	} else {
		//line demo.howl:42
{
let events = howlFrameMapGet(doc, "events");
let found = "";
//line demo.howl:44
{
//line demo.howl:45
for (let m of howlFrameMapGet(doc, "missions")) {
//line demo.howl:46
if ((((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(m, "id")) === id)) {
//line demo.howl:47
{
let mine = [];
//line demo.howl:48
{
//line demo.howl:49
found = "1";
//line demo.howl:50
for (let e of events) {
//line demo.howl:51
if ((((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(e, "mission_id")) === id)) {
mine = howlFrameAppend(mine, e)
} else {
//line demo.howl:51
{
}
}
};
howlFrameMapSet(m, "timeline", mine);
howlFrameMapSet(m, "envelope_status", (await view_envelope_status(m)));
document.querySelector("#demo-detail").innerHTML = (await view_render_detail(m));
}
}
} else {
//line demo.howl:58
{
}
}
};
//line demo.howl:62
if ((found === "")) {
document.querySelector("#demo-detail").innerHTML = (["<p class=\"item-sub\">Mission not found: ", (await view_esc(id)), "</p>"]).join("")
} else {
//line demo.howl:65
{
}
};
}
}
	}
}
	}
}
}

async function load_demo() {
//line demo.howl:76
{
	let raw;
	let err = null;
	try {
		raw = (await howlFrameFetch("missions.json", "GET"));
	} catch (e) {
		err = e;
	}
	if (err !== null) {
		document.querySelector("#demo-list").textContent = "Demo data could not be loaded."
	} else {
		//line demo.howl:78
{
	let doc;
	let perr = null;
	try {
		doc = howlFrameParseJSON(raw);
	} catch (e) {
		perr = e;
	}
	if (perr !== null) {
		document.querySelector("#demo-list").textContent = "Demo data was not valid JSON."
	} else {
		//line demo.howl:80
{
//line demo.howl:81
(await show_missions(doc));
//line demo.howl:82
{
let missions = howlFrameMapGet(doc, "missions");
//line demo.howl:83
if ((howlFrameListLen(missions) > 0)) {
//line demo.howl:84
{
let first = howlFrameListGet(missions, 0);
//line demo.howl:85
(await open_mission(((_v) => _v == null ? "" : String(_v))(howlFrameMapGet(first, "id"))))
}
} else {
//line demo.howl:87
{
}
}
};
}
	}
}
	}
}
}

;(async () => {
//line demo.howl:95
(await load_demo())

})().catch((err) => {
  console.error(err && err.message ? err.message : err);
  if (typeof process !== "undefined" && typeof process.exit === "function") {
    process.exit(1);
  } else {
    throw err;
  }
});
