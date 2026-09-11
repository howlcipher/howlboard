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
html = ([html, "</dl></div>"]).join("");
//line mission_view.howl:185
return html;;
}
}
}

async function view_stage_evidence(m) {
//line mission_view.howl:194
{
let items = (m["evidence"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"02\">Evidence</h3>";
//line mission_view.howl:196
{
//line mission_view.howl:197
if ((String(items) === "")) {
//line mission_view.howl:198
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:199
if (((items).length === 0)) {
//line mission_view.howl:200
html = ([html, "<p class=\"item-sub\">No evidence recorded.</p>"]).join("")
} else {
//line mission_view.howl:201
for (let e of items) {
//line mission_view.howl:202
{
let block = "<div class=\"item\">";
//line mission_view.howl:203
{
//line mission_view.howl:204
block = ([block, "<span class=\"item-head\"><span class=\"tag\">", (await view_esc((e["type"] ?? ""))), "</span><strong>", (await view_esc((e["ref"] ?? ""))), "</strong></span>"]).join("");
//line mission_view.howl:207
block = ([block, "<span class=\"item-sub\">", (await view_esc((e["description"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:209
block = ([block, "<span class=\"item-sub\">source ", (await view_esc((e["source"] ?? ""))), " &middot; ", (await view_esc((e["fingerprint"] ?? ""))), " &middot; ", (await view_ago((e["collected_at"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:213
html = ([html, block, "</div>"]).join("");
}
}
}
}
};
//line mission_view.howl:219
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_reasoning(m) {
//line mission_view.howl:229
{
let r = (m["reasoning"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"03\">Decision</h3>";
//line mission_view.howl:231
{
//line mission_view.howl:232
if ((String(r) === "")) {
//line mission_view.howl:233
html = ([html, "<p class=\"item-sub\">No decision record.</p>"]).join("")
} else {
//line mission_view.howl:234
{
//line mission_view.howl:235
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:236
html = ([html, "<dt>Problem</dt><dd>", (await view_esc((r["problem"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:237
{
let obs = (r["observations"] ?? "");
//line mission_view.howl:238
if ((String(obs) === "")) {
//line mission_view.howl:239
{
}
} else {
//line mission_view.howl:240
{
let acc = "";
//line mission_view.howl:241
{
//line mission_view.howl:242
for (let o of obs) {
//line mission_view.howl:242
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(o)), "</div>"]).join("")
};
//line mission_view.howl:243
html = ([html, "<dt>Observations</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:248
{
let asm = (r["assumptions"] ?? "");
//line mission_view.howl:249
if ((String(asm) === "")) {
//line mission_view.howl:250
{
}
} else {
//line mission_view.howl:251
{
let acc = "";
//line mission_view.howl:252
{
//line mission_view.howl:253
for (let a of asm) {
//line mission_view.howl:253
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(a)), "</div>"]).join("")
};
//line mission_view.howl:254
html = ([html, "<dt>Assumptions</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:259
{
let opts = (r["options"] ?? "");
//line mission_view.howl:260
if ((String(opts) === "")) {
//line mission_view.howl:261
{
}
} else {
//line mission_view.howl:262
{
let acc = "";
//line mission_view.howl:263
{
//line mission_view.howl:264
for (let o of opts) {
//line mission_view.howl:265
acc = ([acc, "<div class=\"item\"><strong>", (await view_esc((o["option"] ?? ""))), "</strong>", "<span class=\"item-sub\">", (await view_esc((o["assessment"] ?? ""))), "</span></div>"]).join("")
};
//line mission_view.howl:269
html = ([html, "<dt>Options</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:274
html = ([html, "<dt>Selected</dt><dd><strong>", (await view_esc((r["selected"] ?? ""))), "</strong></dd>"]).join("");
//line mission_view.howl:275
html = ([html, "<dt>Rationale</dt><dd>", (await view_esc((r["rationale"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:276
html = ([html, "<dt>Confidence</dt><dd>", (await view_esc((r["confidence"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:277
html = ([html, "<dt>Decided by</dt><dd>", (await view_esc((r["decided_by"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:278
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:281
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_authority(m) {
//line mission_view.howl:291
{
let a = (m["authority"] ?? "");
let env = String((m["envelope_status"] ?? ""));
let html = "<div class=\"stage\"><h3 data-step=\"04\">Authority</h3>";
//line mission_view.howl:294
{
//line mission_view.howl:295
html = ([html, "<p class=\"authority-banner env-", (await view_esc(env)), "\">", (await view_esc(env)), "</p>"]).join("");
//line mission_view.howl:297
if ((String(a) === "")) {
//line mission_view.howl:298
html = ([html, "<p class=\"item-sub\">No authority record.</p>"]).join("")
} else {
//line mission_view.howl:299
{
//line mission_view.howl:300
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:301
html = ([html, "<dt>Decision</dt><dd>", (await view_esc((a["decision"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:302
html = ([html, "<dt>Reason</dt><dd>", (await view_esc((a["reason"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:303
html = ([html, "<dt>Digest</dt><dd>", (await view_esc((a["digest"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:304
{
let gates = (a["gates"] ?? "");
//line mission_view.howl:305
if ((String(gates) === "")) {
//line mission_view.howl:306
{
}
} else {
//line mission_view.howl:307
{
let acc = "";
//line mission_view.howl:308
{
//line mission_view.howl:309
for (let g of gates) {
//line mission_view.howl:310
acc = ([acc, "<div class=\"item-head\"><span>", (await view_esc((g["name"] ?? ""))), "</span>", "<span class=\"status status-", (await view_esc((g["status"] ?? ""))), "\">", (await view_esc((g["status"] ?? ""))), "</span></div>"]).join("")
};
//line mission_view.howl:315
html = ([html, "<dt>Gates</dt><dd>", acc, "</dd>"]).join("");
}
}
}
};
//line mission_view.howl:320
{
let ap = (a["approval"] ?? "");
//line mission_view.howl:321
if ((String(ap) === "")) {
//line mission_view.howl:322
html = ([html, "<dt>Approval</dt><dd class=\"item-sub\">No approval on record.</dd>"]).join("")
} else {
//line mission_view.howl:324
{
//line mission_view.howl:325
html = ([html, "<dt>Approver</dt><dd>", (await view_esc((ap["approver"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:327
html = ([html, "<dt>Issued</dt><dd>", (await view_ago((ap["issued_at"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:329
if ((env === "ENVELOPE_EXPIRED")) {
//line mission_view.howl:330
html = ([html, "<dt>Expiry</dt><dd class=\"status status-EXPIRED\">Lapsed ", (await view_ago((ap["expires_at"] ?? ""))), "</dd>"]).join("")
} else {
//line mission_view.howl:333
html = ([html, "<dt>Expiry</dt><dd>Valid, expires in ", String(parseInt(((parseInt((ap["expires_at"] ?? ""), 10) - Math.floor(Date.now() / 1000)) / 60), 10)), " min</dd>"]).join("")
};
}
}
};
//line mission_view.howl:341
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:344
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_plan(m) {
//line mission_view.howl:355
{
let steps = (m["plan"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"05\">Plan</h3>";
//line mission_view.howl:357
{
//line mission_view.howl:358
if ((String(steps) === "")) {
//line mission_view.howl:359
html = ([html, "<p class=\"item-sub\">No plan recorded.</p>"]).join("")
} else {
//line mission_view.howl:360
for (let s of steps) {
//line mission_view.howl:361
{
let st = String((s["state"] ?? ""));
let marker = "[ ]";
//line mission_view.howl:363
{
//line mission_view.howl:364
if ((st === "complete")) {
//line mission_view.howl:364
marker = "[x]"
} else {
//line mission_view.howl:364
{
}
};
//line mission_view.howl:365
if ((st === "active")) {
//line mission_view.howl:365
marker = "[>]"
} else {
//line mission_view.howl:365
{
}
};
//line mission_view.howl:366
if ((st === "failed")) {
//line mission_view.howl:366
marker = "[!]"
} else {
//line mission_view.howl:366
{
}
};
//line mission_view.howl:367
if ((st === "skipped")) {
//line mission_view.howl:367
marker = "[-]"
} else {
//line mission_view.howl:367
{
}
};
//line mission_view.howl:368
html = ([html, "<div class=\"plan-step p-", (await view_esc(st)), "\">", "<span class=\"marker\">", marker, "</span>", "<span><span>", (await view_esc((s["action"] ?? ""))), "</span>", "<span class=\"item-sub\"> ", (await view_esc((s["owner"] ?? ""))), " &middot; ", (await view_esc(st)), "</span></span></div>"]).join("");
}
}
}
};
//line mission_view.howl:379
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_executor(m) {
//line mission_view.howl:389
{
let html = "<div class=\"stage\"><h3 data-step=\"06\">Executor</h3><dl class=\"kv\">";
//line mission_view.howl:390
{
//line mission_view.howl:391
{
let ex = String((m["executor"] ?? ""));
//line mission_view.howl:392
if ((ex === "")) {
//line mission_view.howl:393
html = ([html, "<dt>Assigned</dt><dd class=\"item-sub\">None; work has not been dispatched.</dd>"]).join("")
} else {
//line mission_view.howl:394
html = ([html, "<dt>Assigned</dt><dd>", (await view_esc(ex)), "</dd>"]).join("")
}
};
//line mission_view.howl:397
html = ([html, "<dt>Recommended</dt><dd>", (await view_esc((m["recommended_executor"] ?? ""))), "</dd>"]).join("");
//line mission_view.howl:399
{
let ov = (m["is_override"] ?? "");
//line mission_view.howl:400
if ((String(ov) === "true")) {
//line mission_view.howl:401
html = ([html, "<dt>Override</dt><dd class=\"status status-PENDING\">Yes &mdash; ", (await view_esc((m["override_reason"] ?? ""))), "</dd>"]).join("")
} else {
//line mission_view.howl:404
html = ([html, "<dt>Override</dt><dd>No</dd>"]).join("")
}
};
//line mission_view.howl:407
return ([html, "</dl></div>"]).join("");;
}
}
}

async function view_stage_execution(m) {
//line mission_view.howl:416
{
let x = (m["execution"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"07\">Execution</h3>";
//line mission_view.howl:418
{
//line mission_view.howl:419
if ((String(x) === "")) {
//line mission_view.howl:420
html = ([html, "<p class=\"item-sub\">Execution has not started.</p>"]).join("")
} else {
//line mission_view.howl:421
{
//line mission_view.howl:422
html = ([html, "<dl class=\"kv\">"]).join("");
//line mission_view.howl:423
{
let started = parseInt((x["started_at"] ?? ""), 10);
//line mission_view.howl:424
if ((started === 0)) {
//line mission_view.howl:425
html = ([html, "<dt>Started</dt><dd class=\"item-sub\">Never started.</dd>"]).join("")
} else {
//line mission_view.howl:426
html = ([html, "<dt>Started</dt><dd>", (await view_ago(started)), "</dd>"]).join("")
}
};
//line mission_view.howl:429
{
let op = String((x["current_operation"] ?? ""));
//line mission_view.howl:430
if ((op === "")) {
//line mission_view.howl:431
{
}
} else {
//line mission_view.howl:432
html = ([html, "<dt>Current</dt><dd>", (await view_esc(op)), "</dd>"]).join("")
}
};
//line mission_view.howl:435
html = ([html, "<dt>Retries</dt><dd>", String((x["retries"] ?? "")), "</dd>"]).join("");
//line mission_view.howl:436
{
let rec = (x["delta"] ?? "");
//line mission_view.howl:437
if ((String(rec) === "")) {
//line mission_view.howl:438
{
}
} else {
//line mission_view.howl:439
{
//line mission_view.howl:440
{
let mods = (rec["files_modified"] ?? "");
let acc = "";
//line mission_view.howl:442
{
//line mission_view.howl:443
if ((String(mods) === "")) {
//line mission_view.howl:444
{
}
} else {
//line mission_view.howl:445
for (let f of mods) {
//line mission_view.howl:445
acc = ([acc, "<div class=\"item-sub\">", (await view_esc(f)), "</div>"]).join("")
}
};
//line mission_view.howl:447
if ((acc === "")) {
//line mission_view.howl:447
acc = "<span class=\"item-sub\">none</span>"
} else {
//line mission_view.howl:447
{
}
};
//line mission_view.howl:448
html = ([html, "<dt>Files changed</dt><dd>", acc, "</dd>"]).join("");
}
};
//line mission_view.howl:452
html = ([html, "<dt>Diff</dt><dd>+", String((rec["insertions"] ?? "")), " / -", String((rec["deletions"] ?? "")), "</dd>"]).join("");
//line mission_view.howl:455
{
let unexpected = (rec["unexpected"] ?? "");
let n = 0;
//line mission_view.howl:457
{
//line mission_view.howl:458
if ((String(unexpected) === "")) {
//line mission_view.howl:458
{
}
} else {
//line mission_view.howl:458
n = (unexpected).length
};
//line mission_view.howl:459
if ((n === 0)) {
//line mission_view.howl:460
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-passed\">None detected</dd>"]).join("")
} else {
//line mission_view.howl:462
{
let acc = "";
//line mission_view.howl:463
{
//line mission_view.howl:464
for (let f of unexpected) {
//line mission_view.howl:464
acc = ([acc, "<div>", (await view_esc(f)), "</div>"]).join("")
};
//line mission_view.howl:465
html = ([html, "<dt>Unexpected changes</dt><dd class=\"status status-failed\">", acc, "</dd>"]).join("");
}
}
};
}
};
}
}
};
//line mission_view.howl:476
{
let receipt = (x["receipt"] ?? "");
//line mission_view.howl:477
if ((String(receipt) === "")) {
//line mission_view.howl:478
{
}
} else {
//line mission_view.howl:479
{
//line mission_view.howl:480
{
let err = String((receipt["error_message"] ?? ""));
//line mission_view.howl:481
if ((err === "")) {
//line mission_view.howl:482
{
}
} else {
//line mission_view.howl:483
html = ([html, "<dt>Error</dt><dd class=\"status status-failed\">", (await view_esc(err)), "</dd>"]).join("")
}
};
//line mission_view.howl:487
{
let rb = String((receipt["rollback_status"] ?? ""));
//line mission_view.howl:488
if ((rb === "")) {
//line mission_view.howl:489
{
}
} else {
//line mission_view.howl:490
html = ([html, "<dt>Rollback</dt><dd>", (await view_esc(rb)), "</dd>"]).join("")
}
};
}
}
};
//line mission_view.howl:496
{
let recovery = (x["recovery_actions"] ?? "");
//line mission_view.howl:497
if ((String(recovery) === "")) {
//line mission_view.howl:498
{
}
} else {
//line mission_view.howl:499
if (((recovery).length === 0)) {
//line mission_view.howl:500
{
}
} else {
//line mission_view.howl:501
{
let acc = "";
//line mission_view.howl:502
{
//line mission_view.howl:503
for (let r of recovery) {
//line mission_view.howl:503
acc = ([acc, "<div class=\"item-sub\">&bull; ", (await view_esc(r)), "</div>"]).join("")
};
//line mission_view.howl:504
html = ([html, "<dt>Recovery</dt><dd>", acc, "</dd>"]).join("");
}
}
}
}
};
//line mission_view.howl:510
html = ([html, "</dl>"]).join("");
}
};
//line mission_view.howl:513
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_verification(m) {
//line mission_view.howl:523
{
let vs = (m["verification"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"08\">Verification</h3>";
//line mission_view.howl:525
{
//line mission_view.howl:526
if ((String(vs) === "")) {
//line mission_view.howl:527
html = ([html, "<p class=\"item-sub\">No verification has run.</p>"]).join("")
} else {
//line mission_view.howl:528
if (((vs).length === 0)) {
//line mission_view.howl:529
html = ([html, "<p class=\"item-sub\">No verification has run.</p>"]).join("")
} else {
//line mission_view.howl:530
for (let v of vs) {
//line mission_view.howl:531
{
let st = String((v["status"] ?? ""));
let block = "";
//line mission_view.howl:533
{
//line mission_view.howl:534
block = (["<div class=\"verification-row v-", (await view_esc(st)), "\">", "<span><span>", (await view_esc((v["name"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:537
if ((st === "claimed")) {
//line mission_view.howl:538
block = ([block, "<span class=\"claim-warning\">Claimed by the agent; not independently verified.</span>"]).join("")
} else {
//line mission_view.howl:540
{
}
};
//line mission_view.howl:541
{
let digest = String((v["output_digest"] ?? ""));
//line mission_view.howl:542
if ((digest === "")) {
//line mission_view.howl:543
{
}
} else {
//line mission_view.howl:544
block = ([block, "<span class=\"item-sub\">", (await view_esc(digest)), "</span>"]).join("")
}
};
//line mission_view.howl:548
block = ([block, "</span><span class=\"status status-", (await view_esc(st)), "\">", (await view_esc(st)), " (exit ", String((v["exit_code"] ?? "")), ")</span></div>"]).join("");
//line mission_view.howl:551
html = ([html, block]).join("");
}
}
}
}
};
//line mission_view.howl:558
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_outcome(m) {
//line mission_view.howl:568
{
let o = String((m["outcome"] ?? ""));
let html = "<div class=\"stage\"><h3 data-step=\"09\">Outcome</h3>";
//line mission_view.howl:570
{
//line mission_view.howl:571
if ((o === "")) {
//line mission_view.howl:572
html = ([html, "<p class=\"outcome-line outcome-pending\">Not yet reached</p>"]).join("")
} else {
//line mission_view.howl:574
html = ([html, "<p class=\"outcome-line outcome-", (await view_esc(o)), "\">", (await view_esc(o)), "</p>"]).join("")
};
//line mission_view.howl:577
return ([html, "</div>"]).join("");;
}
}
}

async function view_stage_timeline(m) {
//line mission_view.howl:587
{
let events = (m["timeline"] ?? "");
let html = "<div class=\"stage\"><h3 data-step=\"10\">Audit timeline</h3><div class=\"timeline\">";
//line mission_view.howl:589
{
//line mission_view.howl:590
if ((String(events) === "")) {
//line mission_view.howl:591
html = ([html, "<p class=\"item-sub\">No recorded history.</p>"]).join("")
} else {
//line mission_view.howl:592
for (let e of events) {
//line mission_view.howl:593
{
let action = String((e["action"] ?? ""));
let cls = "timeline-row";
//line mission_view.howl:595
{
//line mission_view.howl:596
if ((action === "human_approval")) {
//line mission_view.howl:596
cls = "timeline-row t-human"
} else {
//line mission_view.howl:596
{
}
};
//line mission_view.howl:597
if ((action === "human_rejection")) {
//line mission_view.howl:597
cls = "timeline-row t-human"
} else {
//line mission_view.howl:597
{
}
};
//line mission_view.howl:598
if ((action === "human_decision_requested")) {
//line mission_view.howl:598
cls = "timeline-row t-human"
} else {
//line mission_view.howl:598
{
}
};
//line mission_view.howl:599
if ((action === "human_boundary_triggered")) {
//line mission_view.howl:599
cls = "timeline-row t-human"
} else {
//line mission_view.howl:599
{
}
};
//line mission_view.howl:600
if ((action === "task_failed")) {
//line mission_view.howl:600
cls = "timeline-row t-fail"
} else {
//line mission_view.howl:600
{
}
};
//line mission_view.howl:601
if ((action === "task_completed")) {
//line mission_view.howl:601
cls = "timeline-row t-done"
} else {
//line mission_view.howl:601
{
}
};
//line mission_view.howl:602
html = ([html, "<div class=\"", cls, "\"><span class=\"at\">", (await view_ago((e["timestamp"] ?? ""))), "</span>", "<span><span class=\"what\">", (await view_esc(action)), "</span>", "<span class=\"who\"> ", (await view_esc((e["actor"] ?? ""))), "</span>"]).join("");
//line mission_view.howl:606
{
let detail = String((e["detail"] ?? ""));
//line mission_view.howl:607
if ((detail === "")) {
//line mission_view.howl:608
{
}
} else {
//line mission_view.howl:609
html = ([html, "<span class=\"item-sub\">", (await view_esc(detail)), "</span>"]).join("")
}
};
//line mission_view.howl:613
html = ([html, "</span></div>"]).join("");
}
}
}
};
//line mission_view.howl:619
return ([html, "</div></div>"]).join("");;
}
}
}

async function view_render_detail(m) {
//line mission_view.howl:629
{
let html = "";
//line mission_view.howl:630
{
//line mission_view.howl:631
html = ([html, (await view_stage_mission(m))]).join("");
//line mission_view.howl:632
html = ([html, (await view_stage_evidence(m))]).join("");
//line mission_view.howl:633
html = ([html, (await view_stage_reasoning(m))]).join("");
//line mission_view.howl:634
html = ([html, (await view_stage_authority(m))]).join("");
//line mission_view.howl:635
html = ([html, (await view_stage_plan(m))]).join("");
//line mission_view.howl:636
html = ([html, (await view_stage_executor(m))]).join("");
//line mission_view.howl:637
html = ([html, (await view_stage_execution(m))]).join("");
//line mission_view.howl:638
html = ([html, (await view_stage_verification(m))]).join("");
//line mission_view.howl:639
html = ([html, (await view_stage_outcome(m))]).join("");
//line mission_view.howl:640
html = ([html, (await view_stage_timeline(m))]).join("");
//line mission_view.howl:641
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
//line demo.howl:43
for (let m of (doc["missions"] ?? "")) {
//line demo.howl:44
if ((String((m["id"] ?? "")) === id)) {
//line demo.howl:45
{
let mine = [];
//line demo.howl:46
{
//line demo.howl:47
for (let e of events) {
//line demo.howl:48
if ((String((e["mission_id"] ?? "")) === id)) {
mine.push(e)
} else {
//line demo.howl:48
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
//line demo.howl:55
{
}
}
}
}
	}
}
	}
}
}

async function load_demo() {
//line demo.howl:65
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
		//line demo.howl:67
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
		//line demo.howl:69
{
//line demo.howl:70
(await show_missions(doc));
//line demo.howl:71
{
let missions = (doc["missions"] ?? "");
//line demo.howl:72
if (((missions).length > 0)) {
//line demo.howl:73
{
let first = (missions[0] ?? "");
//line demo.howl:74
(await open_mission(String((first["id"] ?? ""))))
}
} else {
//line demo.howl:76
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
//line demo.howl:84
(await load_demo())

})();
