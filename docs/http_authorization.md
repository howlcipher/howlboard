# HTTP route access and F1 verification scope

Board is a local mission projection with explicit application write access. Its
token is not owner identity and is not a Model B approval credential. Browser
and nonbrowser clients send the same non-ambient Authorization bearer header.
Server configuration must contain a random 64-character lowercase hexadecimal
HOWLBOARD_WRITE_TOKEN; absent or malformed configuration disables every write.
The frontend keeps the token in its password input for the page lifetime only.
Remote deployments require TLS and trusted frontend hosting; a compromised
frontend can read credentials entered into that frontend.

| Route | Classification | Method/access |
|---|---|---|
| /api/missions | Read-only projection | Existing read contract; no write token |
| /api/missions/get | Read-only detail/query | Existing POST body lookup; no write token |
| /api/dashboard | Read-only projection | Existing read contract; no write token |
| /api/projects | Read-only projection | Existing read contract; no write token |
| /api/timeline | Read-only projection | Existing read contract; no write token |
| /api/factory/status | Read-only projection/fetch | Existing read contract and fetch capability |
| /api/factory/status/{source} | Read-only projection/fetch | Existing read contract and fetch capability |
| /api/factory/pending-row | Read-only paste preview | Existing POST query; does not admit work |
| /api/missions/create | State-changing | POST plus bearer token and Origin constraint |
| /api/missions/state | State-changing | POST plus bearer token and Origin constraint |
| /api/missions/delete | State-changing | POST plus bearer token and Origin constraint |
| /api/seed | State-changing fixture import | POST plus bearer token and Origin constraint |
| /api/missions/approve | Approval-related metadata | Same write gate; not protected execution authority |
| /api/missions/reject | Approval-related metadata | Same write gate; not protected execution authority |

All six mutation routes return405 for unsupported methods, including GET and
HEAD. OPTIONS is a nonmutating CORS preflight. Foreign or opaque Origin values
return403; absent Origin never replaces credential verification. Missing/wrong
credentials return401 even for an allowed frontend origin or no Origin. CORS
permits the Authorization header for the configured frontend allowlist only.
No cookies or other automatically attached browser credentials authorize writes.
The token is compared using the existing secure_equal primitive and is never
included in errors, audit records, URL parameters or curl command arguments.

Board approval names remain caller assertions. Records retain authenticated=false
and explicitly describe shared_api_token access with no independently verified
identity. Board must not be used as the Model B protected signer or executor.
Existing offline ledger validation/import and read-only projections are retained.

## Evidence and limits

Affected baseline is merged Board #20, commit24c5917. New HTTP contract tests run
against real compiled bytecode, using synthetic credentials and synthetic store
files in isolated worktrees. The same tests/harness on the original application
fail method/authentication/no-effect expectations; corrected targeted tests pass.
Store assertions compare both existence and exact bytes after denied requests.
Positive cases cover explicit CLI-style credentials and an allowed Origin header;
the latter is HTTP protocol evidence, not a completed browser security test.

The original Chromium reproduction remains BLOCKED by the prior cybersecurity
restriction and is not retried through another agent, tool or environment.
No restricted test is marked passed. Full F1 security acceptance therefore
remains incomplete pending an authorized browser/security review, even after
source and ordinary regression gates pass. This change is a source mitigation;
it does not justify an unrestricted READY verdict.

The old Frame source pin lacked frontend fetch headers. CI now pins the already
merged Frame #211 revision a154ddac2cddb20c75965ba5d5e9dfefcc6ad2ac, preserving
its ledger validator and using existing header/secure_equal primitives. No Frame
language changes, #212 development or #214 owner decisions are included here.
