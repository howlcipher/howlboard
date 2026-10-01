async function view_envelope_status(mission) {
//line mission_view.howl:21
{
let status = "ENVELOPE_ABSENT";
//line mission_view.howl:22
{
//line mission_view.howl:23
{
let auth = (mission["authority"] ?? "");
//line mission_view.howl:24
if ((String(auth) === "")) {
//line mission_view.howl:25
{
}
} else {
//line mission_view.howl:26
{
let decision = String((auth["decision"] ?? ""));
let approval = (auth["approval"] ?? "");
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
let absolute = (approval["expires_at"] ?? "");
//line mission_view.howl:36
if ((String(absolute) === "")) {
//line mission_view.howl:37
{
let relative = (approval["expires_in"] ?? "");
//line mission_view.howl:38
expires = (Math.floor(Date.now() / 1000) + parseInt(relative, 10))
}
} else {
//line mission_view.howl:40
expires = parseInt(absolute, 10)
}
};
//line mission_view.howl:43
if ((expires < Math.floor(Date.now() / 1000))) {
//line mission_view.howl:44
status = "ENVELOPE_EXPIRED"
} else {
//line mission_view.howl:45
if ((decision === "DENY")) {
//line mission_view.howl:46
status = "DENIED_BY_ENVELOPE"
} else {
//line mission_view.howl:47
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
//line mission_view.howl:57
return status;;
}
}
}

async function view_esc(s) {
//line mission_view.howl:65
{
let out = String(s);
//line mission_view.howl:66
{
//line mission_view.howl:67
out = ((out).split("&")).join("&amp;");
//line mission_view.howl:68
out = ((out).split("<")).join("&lt;");
//line mission_view.howl:69
out = ((out).split(">")).join("&gt;");
//line mission_view.howl:70
out = ((out).split("\"")).join("&quot;");
//line mission_view.howl:71
out = ((out).split("'")).join("&#39;");
//line mission_view.howl:72
return out;;
}
}
}

async function view_ago(ts) {
//line mission_view.howl:81
{
let delta = (Math.floor(Date.now() / 1000) - parseInt(ts, 10));
let out = "just now";
//line mission_view.howl:83
{
//line mission_view.howl:84
if ((delta < 0)) {
//line mission_view.howl:84
delta = 0
} else {
//line mission_view.howl:84
{
}
};
//line mission_view.howl:85
if ((delta < 60)) {
//line mission_view.howl:86
out = "just now"
} else {
//line mission_view.howl:87
if ((delta < 3600)) {
//line mission_view.howl:88
out = ([String(parseInt((delta / 60), 10)), "m ago"]).join("")
} else {
//line mission_view.howl:89
if ((delta < 86400)) {
//line mission_view.howl:90
out = ([String(parseInt((delta / 3600), 10)), "h ago"]).join("")
} else {
//line mission_view.howl:91
out = ([String(parseInt((delta / 86400), 10)), "d ago"]).join("")
}
}
};
//line mission_view.howl:95
return out;;
}
}
}

async function view_state_pill(st) {
//line mission_view.howl:104
return (["<span class=\"state state-", (await view_esc(st)), "\">", (await view_esc(st)), "</span>"]).join("");
}

async function view_provenance_badge(p) {
//line mission_view.howl:110
{
let cls = "badge";
let out = "";
//line mission_view.howl:112
{
//line mission_view.howl:113
if ((p === "DEMO")) {
//line mission_view.howl:113
cls = "badge demo"
} else {
//line mission_view.howl:113
{
}
};
//line mission_view.howl:114
if ((p === "LEDGER")) {
//line mission_view.howl:114
cls = "badge ledger"
} else {
//line mission_view.howl:114
{
}
};
//line mission_view.howl:115
if ((String(p) === "")) {
//line mission_view.howl:116
out = ""
} else {
//line mission_view.howl:117
out = (["<span class=\"", cls, "\">", (await view_esc(p)), "</span>"]).join("")
};
//line mission_view.howl:119
return out;;
}
}
}

async function view_render_row(m) {
//line mission_view.howl:129
{
let id = String((m["id"] ?? ""));
let st = String((m["state"] ?? ""));
let html = "";
//line mission_view.howl:132
{
//line mission_view.howl:133
html = (["<button type=\"button\" class=\"mission-row s-", (await view_esc(st)), "\"", " data-mission-id=\"", (await view_esc(id)), "\"", " onclick=\"window.open_mission(this.dataset.missionId)\">"]).join("");
//line mission_view.howl:137
html = ([html, "<span class=\"row-top\"><span class=\"mid\">", (await view_esc(id)), "</span>", (await view_state_pill(st)), "</span>"]).join("");
//line mission_view.howl:140
html = ([html, "<span class=\"title\">", (await view_esc((m["title"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:142
html = ([html, "<span class=\"row-meta\">"]).join("");
//line mission_view.howl:143
html = ([html, "<span class=\"tag\">", (await view_esc((m["project"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:145
html = ([html, "<span class=\"tag\">", (await view_esc((m["priority"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:147
{
let ex = String((m["executor"] ?? ""));
//line mission_view.howl:148
if ((ex === "")) {
//line mission_view.howl:149
html = ([html, "<span class=\"tag\">unassigned</span>"]).join("")
} else {
//line mission_view.howl:150
html = ([html, "<span class=\"tag\">", (await view_esc(ex)), "</span>"]).join("")
}
};
//line mission_view.howl:153
html = ([html, "<span class=\"status status-", (await view_esc((m["envelope_status"] ?? ""))), "\">", (await view_esc((m["envelope_status"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:156
html = ([html, (await view_provenance_badge((m["provenance"] ?? "")))]).join("");
//line mission_view.howl:157
html = ([html, "</span></button>"]).join("");
//line mission_view.howl:158
return html;;
}
}
}

async function view_stage_mission(m) {
//line mission_view.howl:169
{
let html = "<div class=\"stage\"><h3 data-step=\"01\">Mission</h3>";
//line mission_view.howl:170
{
//line mission_view.howl:171
html = ([html, "<p class=\"detail-title\">", (await view_esc((m["title"] ?? ""))), "</p>"]).join("");
//line mission_view.howl:173
html = ([html, "<p class=\"detail-desc\">", (await view_esc((m["description"] ?? ""))), "</p>"]).join("");
//line mission_view.howl:175
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:176
html = ([html, "<dt>Identifier</dt><dd>", (await view_esc((m["id"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:177
html = ([html, "<dt>Workstream</dt><dd>", (await view_esc((m["project"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:178
html = ([html, "<dt>State</dt><dd>", (await view_state_pill(String((m["state"] ?? "")))), "</dd>"]).join("");
//line mission_view.howl:179
html = ([html, "<dt>Priority</dt><dd>", (await view_esc((m["priority"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:180
html = ([html, "<dt>Risk</dt><dd>", (await view_esc((m["risk_level"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:181
html = ([html, "<dt>Class</dt><dd>", (await view_esc((m["task_class"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:182
html = ([html, "<dt>Updated</dt><dd>", (await view_ago((m["updated_at"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:183
html = ([html, "<dt>Provenance</dt><dd>", (await view_provenance_badge((m["provenance"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:184
html = ([html, "</dl>"]).join("");
//line mission_view.howl:188
{
let deps = (m["depends_on"] ?? "");
//line mission_view.howl:189
if ((String(deps) === "")) {
//line mission_view.howl:190
{
}
} else {
//line mission_view.howl:191
if (((deps).length === 0)) {
//line mission_view.howl:192
{
}
} else {
//line mission_view.howl:193
{
//line mission_view.howl:194
html = ([html, "<div class=\"depends-block\">", "<p class=\"depends-label\">Depends on</p>", "<p class=\"item-sub\">Informational only â\u0080\u0094 does not imply ordering, blocking, approval, or scheduling.</p>", "<ul class=\"depends-list\">"]).join("");
//line mission_view.howl:199
for (let dep of deps) {
//line mission_view.howl:200
{
//line mission_view.howl:201
html = ([html, "<li><button type=\"button\" class=\"depends-link\"", " data-mission-id=\"", (await view_esc(dep)), "\"", " onclick=\"window.open_mission(this.dataset.missionId)\">", (await view_esc(dep)), "</button></li>"]).join("");
}
};
//line mission_view.howl:208
html = ([html, "</ul></div>"]).join("");
}
}
}
};
//line mission_view.howl:213
html = ([html, "</div>"]).join("");
//line mission_view.howl:214
return html;;
}
}
}

async function view_stage_evidence(m) {
//line mission_view.howl:223
{
let items = (m["evidence"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"02\">Evidence</h3>";
//line mission_view.howl:225
{
//line mission_view.howl:226
if ((String(items) === "")) {
//line mission_view.howl:227
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:228
if (((items).length === 0)) {
//line mission_view.howl:229
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:230
for (let e of items) {
//line mission_view.howl:231
{
let block = "<div class=\"item\">";
//line mission_view.howl:232
{
//line mission_view.howl:233
block = ([block, "<span class=\"item-head\"><span class=\"tag\">", (await view_esc((e["type"] ?? ""))), "</span><strong>", (await view_esc((e["ref"] ?? ""))), "</strong></span>"]).join("");
//line mission_view.howl:236
block = ([block, "<span class=\"item-sub\">", (await view_esc((e["description"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:238
block = ([block, "<span class=\"item-sub\">source ", (await view_esc((e["source"] ?? ""))), " &middot; ", (await view_esc((e["fingerprint"] ?? ""))), " &middot; ", (await view_ago((e["collected_at"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:242
html = ([html, block, "</div>"]).join("");
}
}
}
}
};
//line mission_view.howl:248
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_reasoning(m) {
//line mission_view.howl:258
{
let r = (m["reasoning"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"03\">Decision</h3>";
//line mission_view.howl:260
{
//line mission_view.howl:261
if ((String(r) === "")) {
//line mission_view.howl:262
html = ([html, "<p class=\"item-sub\">No decision record.</p>"]).join("")
} else {
//line mission_view.howl:263
{
//line mission_view.howl:264
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:265
html = ([html, "<dt>Problem</dt><dd>", (await view_esc((r["problem"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:266
{
let obs = (r["observations"] ?? "");
//line mission_view.howl:267
if ((String(obs) === "")) {
//line mission_view.howl:268
{
}
} else {
//line mission_view.howl:269
{
let acc = "";
//line mission_view.howl:270
{
//line mission_view.howl:271
for (let o of obs) {
//line mission_view.howl:271
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(o)), "</div>"]).join("")
};
//line mission_view.howl:272
html = ([html, "<dt>Observations</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:277
{
let asm = (r["assumptions"] ?? "");
//line mission_view.howl:278
if ((String(asm) === "")) {
//line mission_view.howl:279
{
}
} else {
//line mission_view.howl:280
{
let acc = "";
//line mission_view.howl:281
{
//line mission_view.howl:282
for (let a of asm) {
//line mission_view.howl:282
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(a)), "</div>"]).join("")
};
//line mission_view.howl:283
html = ([html, "<dt>Assumptions</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:288
{
let opts = (r["options"] ?? "");
//line mission_view.howl:289
if ((String(opts) === "")) {
//line mission_view.howl:290
{
}
} else {
//line mission_view.howl:291
{
let acc = "";
//line mission_view.howl:292
{
//line mission_view.howl:293
for (let o of opts) {
//line mission_view.howl:294
acc = ([acc, "<div class=\"item\"><strong>", (await view_esc((o["option"] ?? ""))), "</strong>", "<span class=\"item-sub\">", (await view_esc((o["assessment"] ?? ""))), "</span></div>"]).join("")
};
//line mission_view.howl:298
html = ([html, "<dt>Options</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:303
html = ([html, "<dt>Selected</dt><dd><strong>", (await view_esc((r["selected"] ?? ""))), "</strong></dd>"]).join("");
//line mission_view.howl:304
html = ([html, "<dt>Rationale</dt><dd>", (await view_esc((r["rationale"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:305
html = ([html, "<dt>Confidence</dt><dd>", (await view_esc((r["confidence"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:306
html = ([html, "<dt>Decided by</dt><dd>", (await view_esc((r["decided_by"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:307
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:310
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_authority(m) {
//line mission_view.howl:320
{
let a = (m["authority"] ?? "");
let env = String((m["envelope_status"] ?? ""));
let html = "<div class=\"stage\"><h3 data-step=\"04\">Authority</h3>";
//line mission_view.howl:323
{
//line mission_view.howl:324
html = ([html, "<p class=\"authority-banner env-", (await view_esc(env)), "\">", (await view_esc(env)), "</p>"]).join("");
//line mission_view.howl:326
if ((String(a) === "")) {
//line mission_view.howl:327
html = ([html, "<p class=\"item-sub\">No authority record.</p>"]).join("")
} else {
//line mission_view.howl:328
{
//line mission_view.howl:329
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:330
html = ([html, "<dt>Decision</dt><dd>", (await view_esc((a["decision"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:331
html = ([html, "<dt>Reason</dt><dd>", (await view_esc((a["reason"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:332
html = ([html, "<dt>Digest</dt><dd>", (await view_esc((a["digest"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:333
{
let gates = (a["gates"] ?? "");
//line mission_view.howl:334
if ((String(gates) === "")) {
//line mission_view.howl:335
{
}
} else {
//line mission_view.howl:336
{
let acc = "";
//line mission_view.howl:337
{
//line mission_view.howl:338
for (let g of gates) {
//line mission_view.howl:339
acc = ([acc, "<div class=\"item-head\"><span>", (await view_esc((g["name"] ?? ""))), "</span>", "<span class=\"status status-", (await view_esc((g["status"] ?? ""))), "\">", (await view_esc((g["status"] ?? ""))), "</span></div>"]).join("")
};
//line mission_view.howl:344
html = ([html, "<dt>Gates</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:349
{
let ap = (a["approval"] ?? "");
//line mission_view.howl:350
if ((String(ap) === "")) {
//line mission_view.howl:351
html = ([html, "<dt>Approval</dt><dd class=\"item-sub\">No approval on record.</dd>"]).join("")
} else {
//line mission_view.howl:353
{
//line mission_view.howl:354
html = ([html, "<dt>Approver</dt><dd>", (await view_esc((ap["approver"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:356
html = ([html, "<dt>Issued</dt><dd>", (await view_ago((ap["issued_at"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:358
if ((env === "ENVELOPE_EXPIRED")) {
//line mission_view.howl:359
html = ([html, "<dt>Expiry</dt><dd class=\"status status-EXPIRED\">Lapsed ", (await view_ago((ap["expires_at"] ?? ""))), "</dd>"]).join("")
} else {
//line mission_view.howl:362
html = ([html, "<dt>Expiry</dt><dd>Valid, expires in ", String(parseInt(((parseInt((ap["expires_at"] ?? ""), 10) - Math.floor(Date.now() / 1000)) / 60), 10)), " min</dd>"]).join("")
};
}
}
};
//line mission_view.howl:370
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:373
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_plan(m) {
//line mission_view.howl:384
{
let steps = (m["plan"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"05\">Plan</h3>";
//line mission_view.howl:386
{
//line mission_view.howl:387
if ((String(steps) === "")) {
//line mission_view.howl:388
html = ([html, "<p class=\"item-sub\">No plan recorded.</p>"]).join("")
} else {
//line mission_view.howl:389
for (let s of steps) {
//line mission_view.howl:390
{
let st = String((s["state"] ?? ""));
let marker = "[ ]";
//line mission_view.howl:392
{
//line mission_view.howl:393
if ((st === "complete")) {
//line mission_view.howl:393
marker = "[x]"
} else {
//line mission_view.howl:393
{
}
};
//line mission_view.howl:394
if ((st === "active")) {
//line mission_view.howl:394
marker = "[>]"
} else {
//line mission_view.howl:394
{
}
};
//line mission_view.howl:395
if ((st === "failed")) {
//line mission_view.howl:395
marker = "[!]"
} else {
//line mission_view.howl:395
{
}
};
//line mission_view.howl:396
if ((st === "skipped")) {
//line mission_view.howl:396
marker = "[-]"
} else {
//line mission_view.howl:396
{
}
};
//line mission_view.howl:397
html = ([html, "<div class=\"plan-step p-", (await view_esc(st)), "\">", "<span class=\"marker\">", marker, "</span>", "<span><span>", (await view_esc((s["action"] ?? ""))), "</span>", "<span class=\"item-sub\"> ", (await view_esc((s["owner"] ?? ""))), " &middot; ", (await view_esc(st)), "</span></span></div>"]).join("");
}
}
}
};
//line mission_view.howl:408
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_executor(m) {
//line mission_view.howl:418
{
let html = "<div class=\"stage\"><h3 data-step=\"06\">Executor</h3><dl class=\"kv\">";
//line mission_view.howl:419
{
//line mission_view.howl:420
{
let ex = String((m["executor"] ?? ""));
//line mission_view.howl:421
if ((ex === "")) {
//line mission_view.howl:422
html = ([html, "<dt>Assigned</dt><dd class=\"item-sub\">None; work has not been dispatched.</dd>"]).join("")
} else {
//line mission_view.howl:423
html = ([html, "<dt>Assigned</dt><dd>", (await view_esc(ex)), "</dd>"]).join("")
}
};
//line mission_view.howl:426
html = ([html, "<dt>Recommended</dt><dd>", (await view_esc((m["recommended_executor"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:428
{
let ov = (m["is_override"] ?? "");
//line mission_view.howl:429
if ((String(ov) === "true")) {
//line mission_view.howl:430
html = ([html, "<dt>Override</dt><dd class=\"status status-PENDING\">Yes &mdash; ", (await view_esc((m["override_reason"] ?? ""))), "</dd>"]).join("")
} else {
//line mission_view.howl:433
html = ([html, "<dt>Override</dt><dd>No</dd>"]).join("")
}
};
//line mission_view.howl:436
return ([html, "</dl></div>"]).join("");;
}
}
}

async function view_stage_execution(m) {
//line mission_view.howl:445
{
let x = (m["execution"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"07\">Execution</h3>";
//line mission_view.howl:447
{
//line mission_view.howl:448
if ((String(x) === "")) {
//line mission_view.howl:449
html = ([html, "<p class=\"item-sub\">Execution has not started.</p>"]).join("")
} else {
//line mission_view.howl:450
{
//line mission_view.howl:451
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:452
{
let started = parseInt((x["started_at"] ?? ""), 10);
//line mission_view.howl:453
if ((started === 0)) {
//line mission_view.howl:454
html = ([html, "<dt>Started</dt><dd class=\"item-sub\">Never started.</dd>"]).join("")
} else {
//line mission_view.howl:455
html = ([html, "<dt>Started</dt><dd>", (await view_ago(started)), "</dd>"]).join("")
}
};
//line mission_view.howl:458
{
let op = String((x["current_operation"] ?? ""));
//line mission_view.howl:459
if ((op === "")) {
//line mission_view.howl:460
{
}
} else {
//line mission_view.howl:461
html = ([html, "<dt>Current</dt><dd>", (await view_esc(op)), "</dd>"]).join("")
}
};
//line mission_view.howl:464
html = ([html, "<dt>Retries</dt><dd>", String((x["retries"] ?? "")), "</dd>"]).join("");
//line mission_view.howl:465
{
let rec = (x["delta"] ?? "");
//line mission_view.howl:466
if ((String(rec) === "")) {
//line mission_view.howl:467
{
}
} else {
//line mission_view.howl:468
{
//line mission_view.howl:469
{
let mods = (rec["files_modified"] ?? "");
let acc = "";
//line mission_view.howl:471
{
//line mission_view.howl:472
if ((String(mods) === "")) {
//line mission_view.howl:473
{
}
} else {
//line mission_view.howl:474
for (let f of mods) {
//line mission_view.howl:474
acc = ([acc, "<div class=\"item-sub\">", (await view_esc(f)), "</div>"]).join("")
}
};
//line mission_view.howl:476
if ((acc === "")) {
//line mission_view.howl:476
acc = "<span class=\"item-sub\">none</span>"
} else {
//line mission_view.howl:476
{
}
};
//line mission_view.howl:477
html = ([html, "<dt>Files changed</dt><dd>", acc, "</dd>"]).join("");
}
};
//line mission_view.howl:481
html = ([html, "<dt>Diff</dt><dd>+", String((rec["insertions"] ?? "")), " / -", String((rec["deletions"] ?? "")), "</dd>"]).join("");
//line mission_view.howl:484
{
let unexpected = (rec["unexpected"] ?? "");
let n = 0;
//line mission_view.howl:486
{
//line mission_view.howl:487
if ((String(unexpected) === "")) {
//line mission_view.howl:487
{
}
} else {
//line mission_view.howl:487
n = (unexpected).length
};
//line mission_view.howl:488
if ((n === 0)) {
//line mission_view.howl:489
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-passed\">None detected</dd>"]).join("")
} else {
//line mission_view.howl:491
{
let acc = "";
//line mission_view.howl:492
{
//line mission_view.howl:493
for (let f of unexpected) {
//line mission_view.howl:493
acc = ([acc, "<div>", (await view_esc(f)), "</div>"]).join("")
};
//line mission_view.howl:494
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-failed\">", acc, "</dd>"]).join("");
}
}
};
}
};
}
}
};
//line mission_view.howl:505
{
let receipt = (x["receipt"] ?? "");
//line mission_view.howl:506
if ((String(receipt) === "")) {
//line mission_view.howl:507
{
}
} else {
//line mission_view.howl:508
{
//line mission_view.howl:509
{
let err = String((receipt["error_message"] ?? ""));
//line mission_view.howl:510
if ((err === "")) {
//line mission_view.howl:511
{
}
} else {
//line mission_view.howl:512
html = ([html, "<dt>Error</dt><dd class=\"status status-failed\">", (await view_esc(err)), "</dd>"]).join("")
}
};
//line mission_view.howl:516
{
let rb = String((receipt["rollback_status"] ?? ""));
//line mission_view.howl:517
if ((rb === "")) {
//line mission_view.howl:518
{
}
} else {
//line mission_view.howl:519
html = ([html, "<dt>Rollback</dt><dd>", (await view_esc(rb)), "</dd>"]).join("")
}
};
}
}
};
//line mission_view.howl:525
{
let recovery = (x["recovery_actions"] ?? "");
//line mission_view.howl:526
if ((String(recovery) === "")) {
//line mission_view.howl:527
{
}
} else {
//line mission_view.howl:528
if (((recovery).length === 0)) {
//line mission_view.howl:529
{
}
} else {
//line mission_view.howl:530
{
let acc = "";
//line mission_view.howl:531
{
//line mission_view.howl:532
for (let r of recovery) {
//line mission_view.howl:532
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(r)), "</div>"]).join("")
};
//line mission_view.howl:533
html = ([html, "<dt>Recovery</dt><dd>", acc, "</dd>"]).join("");
}
}
}
}
};
//line mission_view.howl:539
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:542
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_verification(m) {
//line mission_view.howl:552
{
let vs = (m["verification"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"08\">Verification</h3>";
//line mission_view.howl:554
{
//line mission_view.howl:555
if ((String(vs) === "")) {
//line mission_view.howl:556
html = ([html, "<p class=\"item-sub\">No verification has run.</p>"]).join("")
} else {
//line mission_view.howl:557
if (((vs).length === 0)) {
//line mission_view.howl:558
html = ([html, "<p class=\"item-sub\">No verification has run.</p>"]).join("")
} else {
//line mission_view.howl:559
for (let v of vs) {
//line mission_view.howl:560
{
let st = String((v["status"] ?? ""));
let block = "";
//line mission_view.howl:562
{
//line mission_view.howl:563
block = (["<div class=\"verification-row v-", (await view_esc(st)), "\">", "<span><span>", (await view_esc((v["name"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:566
if ((st === "claimed")) {
//line mission_view.howl:567
block = ([block, "<span class=\"claim-warning\">Claimed by the agent; not independently verified.</span>"]).join("")
} else {
//line mission_view.howl:569
{
}
};
//line mission_view.howl:570
{
let digest = String((v["output_digest"] ?? ""));
//line mission_view.howl:571
if ((digest === "")) {
//line mission_view.howl:572
{
}
} else {
//line mission_view.howl:573
block = ([block, "<span class=\"item-sub\">", (await view_esc(digest)), "</span>"]).join("")
}
};
//line mission_view.howl:577
block = ([block, "</span><span class=\"status status-", (await view_esc(st)), "\">", (await view_esc(st)), " (exit ", String((v["exit_code"] ?? "")), ")</span></div>"]).join("");
//line mission_view.howl:580
html = ([html, block]).join("");
}
}
}
}
};
//line mission_view.howl:587
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_outcome(m) {
//line mission_view.howl:597
{
let o = String((m["outcome"] ?? ""));
let html = "<div class=\"stage\"><h3 data-step=\"09\">Outcome</h3>";
//line mission_view.howl:599
{
//line mission_view.howl:600
if ((o === "")) {
//line mission_view.howl:601
html = ([html, "<p class=\"outcome-line outcome-pending\">Not yet reached</p>"]).join("")
} else {
//line mission_view.howl:603
html = ([html, "<p class=\"outcome-line outcome-", (await view_esc(o)), "\">", (await view_esc(o)), "</p>"]).join("")
};
//line mission_view.howl:606
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_timeline(m) {
//line mission_view.howl:616
{
let events = (m["timeline"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"10\">Audit timeline</h3><div class=\"timeline\">";
//line mission_view.howl:618
{
//line mission_view.howl:619
if ((String(events) === "")) {
//line mission_view.howl:620
html = ([html, "<p class=\"item-sub\">No recorded history.</p>"]).join("")
} else {
//line mission_view.howl:621
for (let e of events) {
//line mission_view.howl:622
{
let action = String((e["action"] ?? ""));
let cls = "timeline-row";
//line mission_view.howl:624
{
//line mission_view.howl:625
if ((action === "human_approval")) {
//line mission_view.howl:625
cls = "timeline-row t-human"
} else {
//line mission_view.howl:625
{
}
};
//line mission_view.howl:626
if ((action === "human_rejection")) {
//line mission_view.howl:626
cls = "timeline-row t-human"
} else {
//line mission_view.howl:626
{
}
};
//line mission_view.howl:627
if ((action === "human_decision_requested")) {
//line mission_view.howl:627
cls = "timeline-row t-human"
} else {
//line mission_view.howl:627
{
}
};
//line mission_view.howl:628
if ((action === "human_boundary_triggered")) {
//line mission_view.howl:628
cls = "timeline-row t-human"
} else {
//line mission_view.howl:628
{
}
};
//line mission_view.howl:629
if ((action === "task_failed")) {
//line mission_view.howl:629
cls = "timeline-row t-fail"
} else {
//line mission_view.howl:629
{
}
};
//line mission_view.howl:630
if ((action === "task_completed")) {
//line mission_view.howl:630
cls = "timeline-row t-done"
} else {
//line mission_view.howl:630
{
}
};
//line mission_view.howl:631
html = ([html, "<div class=\"", cls, "\"><span class=\"at\">", (await view_ago((e["timestamp"] ?? ""))), "</span>", "<span><span class=\"what\">", (await view_esc(action)), "</span>", "<span class=\"who\"> ", (await view_esc((e["actor"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:635
{
let detail = String((e["detail"] ?? ""));
//line mission_view.howl:636
if ((detail === "")) {
//line mission_view.howl:637
{
}
} else {
//line mission_view.howl:638
html = ([html, "<span class=\"item-sub\">", (await view_esc(detail)), "</span>"]).join("")
}
};
//line mission_view.howl:642
html = ([html, "</span></div>"]).join("");
}
}
}
};
//line mission_view.howl:648
return ([html, "</div></div>"]).join("");;
}
}
}

async function view_render_detail(m) {
//line mission_view.howl:658
{
let html = "";
//line mission_view.howl:659
{
//line mission_view.howl:660
html = ([html, (await view_stage_mission(m))]).join("");
//line mission_view.howl:661
html = ([html, (await view_stage_evidence(m))]).join("");
//line mission_view.howl:662
html = ([html, (await view_stage_reasoning(m))]).join("");
//line mission_view.howl:663
html = ([html, (await view_stage_authority(m))]).join("");
//line mission_view.howl:664
html = ([html, (await view_stage_plan(m))]).join("");
//line mission_view.howl:665
html = ([html, (await view_stage_executor(m))]).join("");
//line mission_view.howl:666
html = ([html, (await view_stage_execution(m))]).join("");
//line mission_view.howl:667
html = ([html, (await view_stage_verification(m))]).join("");
//line mission_view.howl:668
html = ([html, (await view_stage_outcome(m))]).join("");
//line mission_view.howl:669
html = ([html, (await view_stage_timeline(m))]).join("");
//line mission_view.howl:670
return html;;
}
}
}

async function show_missions(doc) {
//line demo.howl:18
{
let missions = (doc["missions"] ?? "");
let html = "";
//line demo.howl:20
{
//line demo.howl:21
for (let m of missions) {
//line demo.howl:22
{
m["envelope_status"] = (await view_envelope_status(m));
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
		raw = (await fetch("missions.json", { method: "GET" }).then(r => r.text()));
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
		doc = JSON.parse(raw);
	} catch (e) {
		perr = e;
	}
	if (perr !== null) {
		document.querySelector("#demo-detail").textContent = "Demo data was not valid JSON."
	} else {
		//line demo.howl:42
{
let events = (doc["events"] ?? "");
let found = "";
//line demo.howl:44
{
//line demo.howl:45
for (let m of (doc["missions"] ?? "")) {
//line demo.howl:46
if ((String((m["id"] ?? "")) === id)) {
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
if ((String((e["mission_id"] ?? "")) === id)) {
mine.push(e)
} else {
//line demo.howl:51
{
}
}
};
m["timeline"] = mine;
m["envelope_status"] = (await view_envelope_status(m));
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
		raw = (await fetch("missions.json", { method: "GET" }).then(r => r.text()));
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
		doc = JSON.parse(raw);
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
let missions = (doc["missions"] ?? "");
//line demo.howl:83
if (((missions).length > 0)) {
//line demo.howl:84
{
let first = (missions[0] ?? "");
//line demo.howl:85
(await open_mission(String((first["id"] ?? ""))))
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

})();
