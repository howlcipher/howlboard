function howlFrameGrantHas(name) {
  var raw = process.env.HOWLFRAME_ALLOW_CAPS || "";
  var parts = raw.split(",");
  for (var i = 0; i < parts.length; i++) {
    if (parts[i].trim() === name) return true;
  }
  return false;
}

function howlFrameFetch(url, method, body) {
  if (!howlFrameGrantHas("network")) {
    throw new Error("CAPABILITY_DENIED: capability denied: network");
  }
  var init = { method: method };
  if (arguments.length >= 3) {
    init.body = body;
  }
  return fetch(url, init).then(function (r) { return r.text(); });
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
  return dict[key] ?? "";
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
  list.push(item);
  return list;
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
if ((String(auth) === "")) {
//line mission_view.howl:25
{
}
} else {
//line mission_view.howl:26
{
let decision = String(howlFrameMapGet(auth, "decision"));
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
if ((String(approval) === "")) {
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
let absolute = String(howlFrameMapGet(approval, "expires_at"));
//line mission_view.howl:36
if ((absolute === "")) {
//line mission_view.howl:37
{
let relative = String(howlFrameMapGet(approval, "expires_in"));
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
let out = String(s);
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
let raw = String(ts);
//line mission_view.howl:86
if ((raw === "")) {
//line mission_view.howl:87
return "never";
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
out = ([String(howlFrameToInt(howlFrameDiv(delta, 60))), "m ago"]).join("")
} else {
//line mission_view.howl:96
if ((delta < 86400)) {
//line mission_view.howl:97
out = ([String(howlFrameToInt(howlFrameDiv(delta, 3600))), "h ago"]).join("")
} else {
//line mission_view.howl:98
out = ([String(howlFrameToInt(howlFrameDiv(delta, 86400))), "d ago"]).join("")
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

async function view_state_pill(st) {
//line mission_view.howl:113
return (["<span class=\"state state-", (await view_esc(st)), "\">", (await view_esc(st)), "</span>"]).join("");
}

async function view_provenance_badge(p) {
//line mission_view.howl:119
{
let cls = "badge";
let out = "";
//line mission_view.howl:121
{
//line mission_view.howl:122
if ((p === "DEMO")) {
//line mission_view.howl:122
cls = "badge demo"
} else {
//line mission_view.howl:122
{
}
};
//line mission_view.howl:123
if ((p === "LEDGER")) {
//line mission_view.howl:123
cls = "badge ledger"
} else {
//line mission_view.howl:123
{
}
};
//line mission_view.howl:124
if ((String(p) === "")) {
//line mission_view.howl:125
out = ""
} else {
//line mission_view.howl:126
out = (["<span class=\"", cls, "\">", (await view_esc(p)), "</span>"]).join("")
};
//line mission_view.howl:128
return out;;
}
}
}

async function view_render_row(m) {
//line mission_view.howl:138
{
let id = String(howlFrameMapGet(m, "id"));
let st = String(howlFrameMapGet(m, "state"));
let html = "";
//line mission_view.howl:141
{
//line mission_view.howl:142
html = (["<button type=\"button\" class=\"mission-row s-", (await view_esc(st)), "\"", " data-mission-id=\"", (await view_esc(id)), "\"", " onclick=\"window.open_mission(this.dataset.missionId)\">"]).join("");
//line mission_view.howl:146
html = ([html, "<span class=\"row-top\"><span class=\"mid\">", (await view_esc(id)), "</span>", (await view_state_pill(st)), "</span>"]).join("");
//line mission_view.howl:149
html = ([html, "<span class=\"title\">", (await view_esc(howlFrameMapGet(m, "title"))), "</span>"]).join("");
//line mission_view.howl:151
html = ([html, "<span class=\"row-meta\">"]).join("");
//line mission_view.howl:152
html = ([html, "<span class=\"tag\">", (await view_esc(howlFrameMapGet(m, "project"))), "</span>"]).join("");
//line mission_view.howl:154
html = ([html, "<span class=\"tag\">", (await view_esc(howlFrameMapGet(m, "priority"))), "</span>"]).join("");
//line mission_view.howl:156
{
let ex = String(howlFrameMapGet(m, "executor"));
//line mission_view.howl:157
if ((ex === "")) {
//line mission_view.howl:158
html = ([html, "<span class=\"tag\">unassigned</span>"]).join("")
} else {
//line mission_view.howl:159
html = ([html, "<span class=\"tag\">", (await view_esc(ex)), "</span>"]).join("")
}
};
//line mission_view.howl:162
html = ([html, "<span class=\"status status-", (await view_esc(howlFrameMapGet(m, "envelope_status"))), "\">", (await view_esc(howlFrameMapGet(m, "envelope_status"))), "</span>"]).join("");
//line mission_view.howl:165
html = ([html, (await view_provenance_badge(howlFrameMapGet(m, "provenance")))]).join("");
//line mission_view.howl:166
html = ([html, "</span></button>"]).join("");
//line mission_view.howl:167
return html;;
}
}
}

async function view_stage_mission(m) {
//line mission_view.howl:178
{
let html = "<div class=\"stage\"><h3 data-step=\"01\">Mission</h3>";
//line mission_view.howl:179
{
//line mission_view.howl:180
html = ([html, "<p class=\"detail-title\">", (await view_esc(howlFrameMapGet(m, "title"))), "</p>"]).join("");
//line mission_view.howl:182
html = ([html, "<p class=\"detail-desc\">", (await view_esc(howlFrameMapGet(m, "description"))), "</p>"]).join("");
//line mission_view.howl:184
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:185
html = ([html, "<dt>Identifier</dt><dd>", (await view_esc(howlFrameMapGet(m, "id"))), "</dd>"]).join("");
//line mission_view.howl:186
html = ([html, "<dt>Workstream</dt><dd>", (await view_esc(howlFrameMapGet(m, "project"))), "</dd>"]).join("");
//line mission_view.howl:187
html = ([html, "<dt>State</dt><dd>", (await view_state_pill(String(howlFrameMapGet(m, "state")))), "</dd>"]).join("");
//line mission_view.howl:188
html = ([html, "<dt>Priority</dt><dd>", (await view_esc(howlFrameMapGet(m, "priority"))), "</dd>"]).join("");
//line mission_view.howl:189
html = ([html, "<dt>Risk</dt><dd>", (await view_esc(howlFrameMapGet(m, "risk_level"))), "</dd>"]).join("");
//line mission_view.howl:190
html = ([html, "<dt>Class</dt><dd>", (await view_esc(howlFrameMapGet(m, "task_class"))), "</dd>"]).join("");
//line mission_view.howl:191
html = ([html, "<dt>Updated</dt><dd>", (await view_ago(howlFrameMapGet(m, "updated_at"))), "</dd>"]).join("");
//line mission_view.howl:192
html = ([html, "<dt>Provenance</dt><dd>", (await view_provenance_badge(howlFrameMapGet(m, "provenance"))), "</dd>"]).join("");
//line mission_view.howl:193
html = ([html, "</dl>"]).join("");
//line mission_view.howl:197
{
let deps = howlFrameMapGet(m, "depends_on");
//line mission_view.howl:198
if ((String(deps) === "")) {
//line mission_view.howl:199
{
}
} else {
//line mission_view.howl:200
if ((howlFrameListLen(deps) === 0)) {
//line mission_view.howl:201
{
}
} else {
//line mission_view.howl:202
{
//line mission_view.howl:203
html = ([html, "<div class=\"depends-block\">", "<p class=\"depends-label\">Depends on</p>", "<p class=\"item-sub\">Informational only â\u0080\u0094 does not imply ordering, blocking, approval, or scheduling.</p>", "<ul class=\"depends-list\">"]).join("");
//line mission_view.howl:208
for (let dep of deps) {
//line mission_view.howl:209
{
//line mission_view.howl:210
html = ([html, "<li><button type=\"button\" class=\"depends-link\"", " data-mission-id=\"", (await view_esc(dep)), "\"", " onclick=\"window.open_mission(this.dataset.missionId)\">", (await view_esc(dep)), "</button></li>"]).join("");
}
};
//line mission_view.howl:217
html = ([html, "</ul></div>"]).join("");
}
}
}
};
//line mission_view.howl:222
html = ([html, "</div>"]).join("");
//line mission_view.howl:223
return html;;
}
}
}

async function view_stage_evidence(m) {
//line mission_view.howl:232
{
let items = howlFrameMapGet(m, "evidence");
let html = "<div class=\"stage\"><h3 data-step=\"02\">Evidence</h3>";
//line mission_view.howl:234
{
//line mission_view.howl:235
if ((String(items) === "")) {
//line mission_view.howl:236
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:237
if ((howlFrameListLen(items) === 0)) {
//line mission_view.howl:238
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:239
for (let e of items) {
//line mission_view.howl:240
{
let block = "<div class=\"item\">";
//line mission_view.howl:241
{
//line mission_view.howl:242
block = ([block, "<span class=\"item-head\"><span class=\"tag\">", (await view_esc(howlFrameMapGet(e, "type"))), "</span><strong>", (await view_esc(howlFrameMapGet(e, "ref"))), "</strong></span>"]).join("");
//line mission_view.howl:245
block = ([block, "<span class=\"item-sub\">", (await view_esc(howlFrameMapGet(e, "description"))), "</span>"]).join("");
//line mission_view.howl:247
block = ([block, "<span class=\"item-sub\">source ", (await view_esc(howlFrameMapGet(e, "source"))), " &middot; ", (await view_esc(howlFrameMapGet(e, "fingerprint"))), " &middot; ", (await view_ago(howlFrameMapGet(e, "collected_at"))), "</span>"]).join("");
//line mission_view.howl:251
html = ([html, block, "</div>"]).join("");
}
}
}
}
};
//line mission_view.howl:257
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_reasoning(m) {
//line mission_view.howl:267
{
let r = howlFrameMapGet(m, "reasoning");
let html = "<div class=\"stage\"><h3 data-step=\"03\">Decision</h3>";
//line mission_view.howl:269
{
//line mission_view.howl:270
if ((String(r) === "")) {
//line mission_view.howl:271
html = ([html, "<p class=\"item-sub\">No decision record.</p>"]).join("")
} else {
//line mission_view.howl:272
{
//line mission_view.howl:273
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:274
html = ([html, "<dt>Problem</dt><dd>", (await view_esc(howlFrameMapGet(r, "problem"))), "</dd>"]).join("");
//line mission_view.howl:275
{
let obs = howlFrameMapGet(r, "observations");
//line mission_view.howl:276
if ((String(obs) === "")) {
//line mission_view.howl:277
{
}
} else {
//line mission_view.howl:278
{
let acc = "";
//line mission_view.howl:279
{
//line mission_view.howl:280
for (let o of obs) {
//line mission_view.howl:280
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(o)), "</div>"]).join("")
};
//line mission_view.howl:281
html = ([html, "<dt>Observations</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:286
{
let asm = howlFrameMapGet(r, "assumptions");
//line mission_view.howl:287
if ((String(asm) === "")) {
//line mission_view.howl:288
{
}
} else {
//line mission_view.howl:289
{
let acc = "";
//line mission_view.howl:290
{
//line mission_view.howl:291
for (let a of asm) {
//line mission_view.howl:291
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(a)), "</div>"]).join("")
};
//line mission_view.howl:292
html = ([html, "<dt>Assumptions</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:297
{
let opts = howlFrameMapGet(r, "options");
//line mission_view.howl:298
if ((String(opts) === "")) {
//line mission_view.howl:299
{
}
} else {
//line mission_view.howl:300
{
let acc = "";
//line mission_view.howl:301
{
//line mission_view.howl:302
for (let o of opts) {
//line mission_view.howl:303
acc = ([acc, "<div class=\"item\"><strong>", (await view_esc(howlFrameMapGet(o, "option"))), "</strong>", "<span class=\"item-sub\">", (await view_esc(howlFrameMapGet(o, "assessment"))), "</span></div>"]).join("")
};
//line mission_view.howl:307
html = ([html, "<dt>Options</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:312
html = ([html, "<dt>Selected</dt><dd><strong>", (await view_esc(howlFrameMapGet(r, "selected"))), "</strong></dd>"]).join("");
//line mission_view.howl:313
html = ([html, "<dt>Rationale</dt><dd>", (await view_esc(howlFrameMapGet(r, "rationale"))), "</dd>"]).join("");
//line mission_view.howl:314
html = ([html, "<dt>Confidence</dt><dd>", (await view_esc(howlFrameMapGet(r, "confidence"))), "</dd>"]).join("");
//line mission_view.howl:315
html = ([html, "<dt>Decided by</dt><dd>", (await view_esc(howlFrameMapGet(r, "decided_by"))), "</dd>"]).join("");
//line mission_view.howl:316
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:319
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_authority(m) {
//line mission_view.howl:329
{
let a = howlFrameMapGet(m, "authority");
let env = String(howlFrameMapGet(m, "envelope_status"));
let html = "<div class=\"stage\"><h3 data-step=\"04\">Authority</h3>";
//line mission_view.howl:332
{
//line mission_view.howl:333
html = ([html, "<p class=\"authority-banner env-", (await view_esc(env)), "\">", (await view_esc(env)), "</p>"]).join("");
//line mission_view.howl:335
if ((String(a) === "")) {
//line mission_view.howl:336
html = ([html, "<p class=\"item-sub\">No authority record.</p>"]).join("")
} else {
//line mission_view.howl:337
{
//line mission_view.howl:338
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:339
html = ([html, "<dt>Decision</dt><dd>", (await view_esc(howlFrameMapGet(a, "decision"))), "</dd>"]).join("");
//line mission_view.howl:340
html = ([html, "<dt>Reason</dt><dd>", (await view_esc(howlFrameMapGet(a, "reason"))), "</dd>"]).join("");
//line mission_view.howl:341
html = ([html, "<dt>Digest</dt><dd>", (await view_esc(howlFrameMapGet(a, "digest"))), "</dd>"]).join("");
//line mission_view.howl:342
{
let gates = howlFrameMapGet(a, "gates");
//line mission_view.howl:343
if ((String(gates) === "")) {
//line mission_view.howl:344
{
}
} else {
//line mission_view.howl:345
{
let acc = "";
//line mission_view.howl:346
{
//line mission_view.howl:347
for (let g of gates) {
//line mission_view.howl:348
acc = ([acc, "<div class=\"item-head\"><span>", (await view_esc(howlFrameMapGet(g, "name"))), "</span>", "<span class=\"status status-", (await view_esc(howlFrameMapGet(g, "status"))), "\">", (await view_esc(howlFrameMapGet(g, "status"))), "</span></div>"]).join("")
};
//line mission_view.howl:353
html = ([html, "<dt>Gates</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:358
{
let ap = howlFrameMapGet(a, "approval");
//line mission_view.howl:359
if ((String(ap) === "")) {
//line mission_view.howl:360
html = ([html, "<dt>Approval</dt><dd class=\"item-sub\">No approval on record.</dd>"]).join("")
} else {
//line mission_view.howl:362
{
//line mission_view.howl:363
html = ([html, "<dt>Approver</dt><dd>", (await view_esc(howlFrameMapGet(ap, "approver"))), "</dd>"]).join("");
//line mission_view.howl:365
html = ([html, "<dt>Issued</dt><dd>", (await view_ago(howlFrameMapGet(ap, "issued_at"))), "</dd>"]).join("");
//line mission_view.howl:367
if ((env === "ENVELOPE_EXPIRED")) {
//line mission_view.howl:368
html = ([html, "<dt>Expiry</dt><dd class=\"status status-EXPIRED\">Lapsed ", (await view_ago(howlFrameMapGet(ap, "expires_at"))), "</dd>"]).join("")
} else {
//line mission_view.howl:371
{
let raw_exp = String(howlFrameMapGet(ap, "expires_at"));
let exp_ts = 0;
//line mission_view.howl:373
{
//line mission_view.howl:374
if ((raw_exp !== "")) {
//line mission_view.howl:375
exp_ts = howlFrameToInt(raw_exp)
} else {
//line mission_view.howl:376
{
}
};
//line mission_view.howl:378
html = ([html, "<dt>Expiry</dt><dd>Valid, expires in ", String(howlFrameToInt(howlFrameDiv(howlFrameSafeInt(exp_ts - Math.floor(Date.now() / 1000)), 60))), " min</dd>"]).join("");
}
}
};
}
}
};
//line mission_view.howl:389
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:392
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_plan(m) {
//line mission_view.howl:403
{
let steps = howlFrameMapGet(m, "plan");
let html = "<div class=\"stage\"><h3 data-step=\"05\">Plan</h3>";
//line mission_view.howl:405
{
//line mission_view.howl:406
if ((String(steps) === "")) {
//line mission_view.howl:407
html = ([html, "<p class=\"item-sub\">No plan recorded.</p>"]).join("")
} else {
//line mission_view.howl:408
for (let s of steps) {
//line mission_view.howl:409
{
let st = String(howlFrameMapGet(s, "state"));
let marker = "[ ]";
//line mission_view.howl:411
{
//line mission_view.howl:412
if ((st === "complete")) {
//line mission_view.howl:412
marker = "[x]"
} else {
//line mission_view.howl:412
{
}
};
//line mission_view.howl:413
if ((st === "active")) {
//line mission_view.howl:413
marker = "[>]"
} else {
//line mission_view.howl:413
{
}
};
//line mission_view.howl:414
if ((st === "failed")) {
//line mission_view.howl:414
marker = "[!]"
} else {
//line mission_view.howl:414
{
}
};
//line mission_view.howl:415
if ((st === "skipped")) {
//line mission_view.howl:415
marker = "[-]"
} else {
//line mission_view.howl:415
{
}
};
//line mission_view.howl:416
html = ([html, "<div class=\"plan-step p-", (await view_esc(st)), "\">", "<span class=\"marker\">", marker, "</span>", "<span><span>", (await view_esc(howlFrameMapGet(s, "action"))), "</span>", "<span class=\"item-sub\"> ", (await view_esc(howlFrameMapGet(s, "owner"))), " &middot; ", (await view_esc(st)), "</span></span></div>"]).join("");
}
}
}
};
//line mission_view.howl:427
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_executor(m) {
//line mission_view.howl:437
{
let html = "<div class=\"stage\"><h3 data-step=\"06\">Executor</h3><dl class=\"kv\">";
//line mission_view.howl:438
{
//line mission_view.howl:439
{
let ex = String(howlFrameMapGet(m, "executor"));
//line mission_view.howl:440
if ((ex === "")) {
//line mission_view.howl:441
html = ([html, "<dt>Assigned</dt><dd class=\"item-sub\">None; work has not been dispatched.</dd>"]).join("")
} else {
//line mission_view.howl:442
html = ([html, "<dt>Assigned</dt><dd>", (await view_esc(ex)), "</dd>"]).join("")
}
};
//line mission_view.howl:445
html = ([html, "<dt>Recommended</dt><dd>", (await view_esc(howlFrameMapGet(m, "recommended_executor"))), "</dd>"]).join("");
//line mission_view.howl:447
{
let ov = howlFrameMapGet(m, "is_override");
//line mission_view.howl:448
if ((String(ov) === "true")) {
//line mission_view.howl:449
html = ([html, "<dt>Override</dt><dd class=\"status status-PENDING\">Yes &mdash; ", (await view_esc(howlFrameMapGet(m, "override_reason"))), "</dd>"]).join("")
} else {
//line mission_view.howl:452
html = ([html, "<dt>Override</dt><dd>No</dd>"]).join("")
}
};
//line mission_view.howl:455
return ([html, "</dl></div>"]).join("");;
}
}
}

async function view_stage_execution(m) {
//line mission_view.howl:464
{
let x = howlFrameMapGet(m, "execution");
let html = "<div class=\"stage\"><h3 data-step=\"07\">Execution</h3>";
//line mission_view.howl:466
{
//line mission_view.howl:467
if ((String(x) === "")) {
//line mission_view.howl:468
html = ([html, "<p class=\"item-sub\">Execution has not started.</p>"]).join("")
} else {
//line mission_view.howl:469
{
//line mission_view.howl:470
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:471
{
let raw_start = String(howlFrameMapGet(x, "started_at"));
let started = 0;
//line mission_view.howl:473
{
//line mission_view.howl:474
if ((raw_start !== "")) {
//line mission_view.howl:475
started = howlFrameToInt(raw_start)
} else {
//line mission_view.howl:476
{
}
};
//line mission_view.howl:478
if ((started === 0)) {
//line mission_view.howl:479
html = ([html, "<dt>Started</dt><dd class=\"item-sub\">Never started.</dd>"]).join("")
} else {
//line mission_view.howl:480
html = ([html, "<dt>Started</dt><dd>", (await view_ago(started)), "</dd>"]).join("")
};
}
};
//line mission_view.howl:485
{
let op = String(howlFrameMapGet(x, "current_operation"));
//line mission_view.howl:486
if ((op === "")) {
//line mission_view.howl:487
{
}
} else {
//line mission_view.howl:488
html = ([html, "<dt>Current</dt><dd>", (await view_esc(op)), "</dd>"]).join("")
}
};
//line mission_view.howl:491
html = ([html, "<dt>Retries</dt><dd>", String(howlFrameMapGet(x, "retries")), "</dd>"]).join("");
//line mission_view.howl:492
{
let rec = howlFrameMapGet(x, "delta");
//line mission_view.howl:493
if ((String(rec) === "")) {
//line mission_view.howl:494
{
}
} else {
//line mission_view.howl:495
{
//line mission_view.howl:496
{
let mods = howlFrameMapGet(rec, "files_modified");
let acc = "";
//line mission_view.howl:498
{
//line mission_view.howl:499
if ((String(mods) === "")) {
//line mission_view.howl:500
{
}
} else {
//line mission_view.howl:501
for (let f of mods) {
//line mission_view.howl:501
acc = ([acc, "<div class=\"item-sub\">", (await view_esc(f)), "</div>"]).join("")
}
};
//line mission_view.howl:503
if ((acc === "")) {
//line mission_view.howl:503
acc = "<span class=\"item-sub\">none</span>"
} else {
//line mission_view.howl:503
{
}
};
//line mission_view.howl:504
html = ([html, "<dt>Files changed</dt><dd>", acc, "</dd>"]).join("");
}
};
//line mission_view.howl:508
html = ([html, "<dt>Diff</dt><dd>+", String(howlFrameMapGet(rec, "insertions")), " / -", String(howlFrameMapGet(rec, "deletions")), "</dd>"]).join("");
//line mission_view.howl:511
{
let unexpected = howlFrameMapGet(rec, "unexpected");
let n = 0;
//line mission_view.howl:513
{
//line mission_view.howl:514
if ((String(unexpected) === "")) {
//line mission_view.howl:514
{
}
} else {
//line mission_view.howl:514
n = howlFrameListLen(unexpected)
};
//line mission_view.howl:515
if ((n === 0)) {
//line mission_view.howl:516
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-passed\">None detected</dd>"]).join("")
} else {
//line mission_view.howl:518
{
let acc = "";
//line mission_view.howl:519
{
//line mission_view.howl:520
for (let f of unexpected) {
//line mission_view.howl:520
acc = ([acc, "<div>", (await view_esc(f)), "</div>"]).join("")
};
//line mission_view.howl:521
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-failed\">", acc, "</dd>"]).join("");
}
}
};
}
};
}
}
};
//line mission_view.howl:532
{
let receipt = howlFrameMapGet(x, "receipt");
//line mission_view.howl:533
if ((String(receipt) === "")) {
//line mission_view.howl:534
{
}
} else {
//line mission_view.howl:535
{
//line mission_view.howl:536
{
let err = String(howlFrameMapGet(receipt, "error_message"));
//line mission_view.howl:537
if ((err === "")) {
//line mission_view.howl:538
{
}
} else {
//line mission_view.howl:539
html = ([html, "<dt>Error</dt><dd class=\"status status-failed\">", (await view_esc(err)), "</dd>"]).join("")
}
};
//line mission_view.howl:543
{
let rb = String(howlFrameMapGet(receipt, "rollback_status"));
//line mission_view.howl:544
if ((rb === "")) {
//line mission_view.howl:545
{
}
} else {
//line mission_view.howl:546
html = ([html, "<dt>Rollback</dt><dd>", (await view_esc(rb)), "</dd>"]).join("")
}
};
}
}
};
//line mission_view.howl:552
{
let recovery = howlFrameMapGet(x, "recovery_actions");
//line mission_view.howl:553
if ((String(recovery) === "")) {
//line mission_view.howl:554
{
}
} else {
//line mission_view.howl:555
if ((howlFrameListLen(recovery) === 0)) {
//line mission_view.howl:556
{
}
} else {
//line mission_view.howl:557
{
let acc = "";
//line mission_view.howl:558
{
//line mission_view.howl:559
for (let r of recovery) {
//line mission_view.howl:559
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(r)), "</div>"]).join("")
};
//line mission_view.howl:560
html = ([html, "<dt>Recovery</dt><dd>", acc, "</dd>"]).join("");
}
}
}
}
};
//line mission_view.howl:566
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:569
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_verification(m) {
//line mission_view.howl:579
{
let vs = howlFrameMapGet(m, "verification");
let html = "<div class=\"stage\"><h3 data-step=\"08\">Verification</h3>";
//line mission_view.howl:581
{
//line mission_view.howl:582
if ((String(vs) === "")) {
//line mission_view.howl:583
html = ([html, "<p class=\"item-sub\">No verification has run.</p>"]).join("")
} else {
//line mission_view.howl:584
if ((howlFrameListLen(vs) === 0)) {
//line mission_view.howl:585
html = ([html, "<p class=\"item-sub\">No verification has run.</p>"]).join("")
} else {
//line mission_view.howl:586
for (let v of vs) {
//line mission_view.howl:587
{
let st = String(howlFrameMapGet(v, "status"));
let block = "";
//line mission_view.howl:589
{
//line mission_view.howl:590
block = (["<div class=\"verification-row v-", (await view_esc(st)), "\">", "<span><span>", (await view_esc(howlFrameMapGet(v, "name"))), "</span>"]).join("");
//line mission_view.howl:593
if ((st === "claimed")) {
//line mission_view.howl:594
block = ([block, "<span class=\"claim-warning\">Claimed by the agent; not independently verified.</span>"]).join("")
} else {
//line mission_view.howl:596
{
}
};
//line mission_view.howl:597
{
let digest = String(howlFrameMapGet(v, "output_digest"));
//line mission_view.howl:598
if ((digest === "")) {
//line mission_view.howl:599
{
}
} else {
//line mission_view.howl:600
block = ([block, "<span class=\"item-sub\">", (await view_esc(digest)), "</span>"]).join("")
}
};
//line mission_view.howl:604
block = ([block, "</span><span class=\"status status-", (await view_esc(st)), "\">", (await view_esc(st)), " (exit ", String(howlFrameMapGet(v, "exit_code")), ")</span></div>"]).join("");
//line mission_view.howl:607
html = ([html, block]).join("");
}
}
}
}
};
//line mission_view.howl:614
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_outcome(m) {
//line mission_view.howl:624
{
let o = String(howlFrameMapGet(m, "outcome"));
let html = "<div class=\"stage\"><h3 data-step=\"09\">Outcome</h3>";
//line mission_view.howl:626
{
//line mission_view.howl:627
if ((o === "")) {
//line mission_view.howl:628
html = ([html, "<p class=\"outcome-line outcome-pending\">Not yet reached</p>"]).join("")
} else {
//line mission_view.howl:630
html = ([html, "<p class=\"outcome-line outcome-", (await view_esc(o)), "\">", (await view_esc(o)), "</p>"]).join("")
};
//line mission_view.howl:633
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_timeline(m) {
//line mission_view.howl:643
{
let events = howlFrameMapGet(m, "timeline");
let html = "<div class=\"stage\"><h3 data-step=\"10\">Audit timeline</h3><div class=\"timeline\">";
//line mission_view.howl:645
{
//line mission_view.howl:646
if ((String(events) === "")) {
//line mission_view.howl:647
html = ([html, "<p class=\"item-sub\">No recorded history.</p>"]).join("")
} else {
//line mission_view.howl:648
for (let e of events) {
//line mission_view.howl:649
{
let action = String(howlFrameMapGet(e, "action"));
let cls = "timeline-row";
//line mission_view.howl:651
{
//line mission_view.howl:652
if ((action === "human_approval")) {
//line mission_view.howl:652
cls = "timeline-row t-human"
} else {
//line mission_view.howl:652
{
}
};
//line mission_view.howl:653
if ((action === "human_rejection")) {
//line mission_view.howl:653
cls = "timeline-row t-human"
} else {
//line mission_view.howl:653
{
}
};
//line mission_view.howl:654
if ((action === "human_decision_requested")) {
//line mission_view.howl:654
cls = "timeline-row t-human"
} else {
//line mission_view.howl:654
{
}
};
//line mission_view.howl:655
if ((action === "human_boundary_triggered")) {
//line mission_view.howl:655
cls = "timeline-row t-human"
} else {
//line mission_view.howl:655
{
}
};
//line mission_view.howl:656
if ((action === "task_failed")) {
//line mission_view.howl:656
cls = "timeline-row t-fail"
} else {
//line mission_view.howl:656
{
}
};
//line mission_view.howl:657
if ((action === "task_completed")) {
//line mission_view.howl:657
cls = "timeline-row t-done"
} else {
//line mission_view.howl:657
{
}
};
//line mission_view.howl:658
html = ([html, "<div class=\"", cls, "\"><span class=\"at\">", (await view_ago(howlFrameMapGet(e, "timestamp"))), "</span>", "<span><span class=\"what\">", (await view_esc(action)), "</span>", "<span class=\"who\"> ", (await view_esc(howlFrameMapGet(e, "actor"))), "</span>"]).join("");
//line mission_view.howl:662
{
let detail = String(howlFrameMapGet(e, "detail"));
//line mission_view.howl:663
if ((detail === "")) {
//line mission_view.howl:664
{
}
} else {
//line mission_view.howl:665
html = ([html, "<span class=\"item-sub\">", (await view_esc(detail)), "</span>"]).join("")
}
};
//line mission_view.howl:669
html = ([html, "</span></div>"]).join("");
}
}
}
};
//line mission_view.howl:675
return ([html, "</div></div>"]).join("");;
}
}
}

async function view_render_detail(m) {
//line mission_view.howl:685
{
let html = "";
//line mission_view.howl:686
{
//line mission_view.howl:687
html = ([html, (await view_stage_mission(m))]).join("");
//line mission_view.howl:688
html = ([html, (await view_stage_evidence(m))]).join("");
//line mission_view.howl:689
html = ([html, (await view_stage_reasoning(m))]).join("");
//line mission_view.howl:690
html = ([html, (await view_stage_authority(m))]).join("");
//line mission_view.howl:691
html = ([html, (await view_stage_plan(m))]).join("");
//line mission_view.howl:692
html = ([html, (await view_stage_executor(m))]).join("");
//line mission_view.howl:693
html = ([html, (await view_stage_execution(m))]).join("");
//line mission_view.howl:694
html = ([html, (await view_stage_verification(m))]).join("");
//line mission_view.howl:695
html = ([html, (await view_stage_outcome(m))]).join("");
//line mission_view.howl:696
html = ([html, (await view_stage_timeline(m))]).join("");
//line mission_view.howl:697
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
if ((String(howlFrameMapGet(m, "id")) === id)) {
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
if ((String(howlFrameMapGet(e, "mission_id")) === id)) {
howlFrameAppend(mine, e)
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
(await open_mission(String(howlFrameMapGet(first, "id"))))
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
  process.exit(1);
});
