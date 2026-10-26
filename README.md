# HowlBoard

**Mission control for AI engineering work — and the canonical reference
application for [HowlFrame](https://github.com/howlcipher/howlframe).**

Website: https://howlcipher.github.io/howlboard/

HowlBoard answers one question about autonomous engineering work: *should I
believe this happened?* For any mission it shows what the AI intended, what
evidence supports it, whether it had authority to act, who executed it, what
actually changed, what was independently verified, and what outcome was
reached — as one page you read top to bottom.

Both tiers are written in HowlFrame. The backend is `.howl` compiled to
standalone bytecode and run under the HowlFrame VM with explicit capability
grants. The browser interface is `.howl` compiled through the HowlFrame
JavaScript backend. There is no hand-written server code and no hand-written
client code.

---

## Why it is not a task board

A task board tells you an item is `DONE`. That is a claim. HowlBoard is built
around the distinction between a claim and a verified fact:

- **Authority is derived on every read, never replayed from storage.** An
  approval that was valid when it was written presents as `ENVELOPE_EXPIRED`
  once it lapses, and a mission cannot enter `EXECUTING` without live delegated
  authority. The state machine and the authority envelope are independent gates.
- **Verification distinguishes `passed` from `claimed`.** A `claimed` result is
  one the agent asserted and nothing independently confirmed. It is rendered as
  its own status with an explicit note, never folded into `passed`.
- **Demo data is labelled.** Every record carries `provenance`. Hand-authored
  scenarios are `DEMO`; records projected from real HowlPlane telemetry are
  `LEDGER`, and those produced by a test run are additionally marked
  `origin=test_fixture`. Nothing is presented as a production execution unless
  it was one.

---

## Quickstart

Requires Go 1.26 (to build the HowlFrame compiler) and Python 3 (to serve the
static frontend).

```bash
# 1. Build the HowlFrame compiler this repository compiles against.
git clone https://github.com/howlcipher/howlframe /tmp/howlframe
git -C /tmp/howlframe checkout --detach e77e008f7eb944f286414f4a5725b306fcc02d31
cd /tmp/howlframe && go build -o /path/to/howlboard/howlframe_bin howlframe.go

# 2. Compile both tiers plus the ledger import tool.
cd /path/to/howlboard
make build

# 3. For writes, supply HOWLBOARD_WRITE_TOKEN through your secret channel.
#    Without it the API is read-only. Run on port 8080.
make run

# 4. In a second terminal, serve the interface (port 3000).
make run-frontend

# 5. Load the demo missions.
make seed
```

Open http://localhost:3000 and select a mission.

The documented build and CI use the same reviewed compatible Frame source
candidate, `e77e008f7eb944f286414f4a5725b306fcc02d31` (through merged Frame #222; incorporates #212 checker tightening, #219, and #221 capability restrictions). A moving compiler default branch
is not a compatibility guarantee. The old known-good pin
`7631ce5d4008534ef681f35c3436922507d3f441` remains recorded for rollback together
with Board3b1e007; mixing that older runtime with this source is not supported.
This is source-candidate compatibility, not a published release assertion.

`make build` produces `backend/server.hfbc`, `frontend/app.js`, and
`build/ledger_import.hfbc`. `make run` grants serving network, database,
filesystem and environment plus exactly the existing public Factory destinations
`network:fetch=raw.githubusercontent.com` and `network:fetch=github.com`.
The server declares the corresponding explicit handler subset. Coarse `network`
authorizes serving and does not authorize outbound fetches. Custom Factory URL
hosts require matching reviewed caller and handler scopes; denied requests return
`FACTORY_FETCH_DENIED`, rather than claiming a missing snapshot.

The local browser host grants only `network:fetch=localhost:8080`; the read-only
showcase grants only its own page host. These host grants do not start Factory
or approve any operation.

---

## Approvals and origins

Every state-changing route requires POST and an explicit bearer credential,
including `/api/seed`. Configure `HOWLBOARD_WRITE_TOKEN` with a random 64-character
lowercase hexadecimal value supplied through your deployment's secret channel.
Missing/malformed configuration disables writes. Give authorized API/CLI clients
that token in the `Authorization` header; `make seed` reads the environment and
passes the header on stdin, avoiding a secret in curl's argument list. Enter the
same token into the frontend password field; it stays in the page input and is
not placed in URLs or persistent browser storage. Serve remotely only over TLS.

Unsupported mutation methods return405; missing/wrong authorization returns401.
OPTIONS is nonmutating preflight. Configured frontend origins remain an additional
browser restriction; foreign/opaque origins are rejected even with a valid token.
Missing Origin is allowed only when explicit token authentication succeeds.
CORS is not authentication. Browser forms have no ambient credential to attach.
Read-only projections and the offline validated ledger import remain unchanged.

This shared application credential does not establish human identity or ModelB.
Approval names remain caller assertions, `authenticated` stays false, and records
label `authorization_guarantee=shared_api_token` and no independent identity.
Protected ChangeOps operations still require the separate protected authority.
See [the HTTP route/access inventory](docs/http_authorization.md) for scope and
verification limits, including the restricted browser reproduction.

## Testing

```bash
make test                       # contract tests against the real bytecode server
python3 scripts/test_docs.py    # documentation matches implementation
python3 scripts/test_seo.py     # published site metadata
```

`make test` drives the compiled bytecode server as a subprocess and exercises
the mission lifecycle, every invalid state transition, authority expiry,
approval gating, the `passed`/`claimed` distinction, evidence provenance, store
enumeration after deletes, and a capability-denied server returning 500 rather
than an empty 200.

`scripts/test_docs.py` exists because the published site once documented a
policy function that did not exist, with a transition table that contradicted
the backend. It now fails if that recurs.

---

## Ingesting real telemetry

`tools/ledger_import` is a HowlFrame `cli_app` that projects
`ai.evidence_entry/v1` records — the format written by HowlPlane's control
plane — into missions.

```bash
# The VM reads the whole file into memory, so consume a slice.
head -n 2000 /path/to/evidence_ledger.jsonl > /tmp/slice.jsonl

make import LEDGER=/tmp/slice.jsonl MAX=2000
make run
```

The whole slice is validated before anything is written, using EvidenceDesk's
ledger module from HowlFrame (`tools/ledger_import/evidence_ledger.howl`,
vendored; see `tools/ledger_import/VENDORED.md`). Each nonblank line must be a
JSON object with schema `ai.evidence_entry/v1`, nonempty string `entry_id`,
`task_id`, `agent_id` and `action`, and a unique `entry_id`; `entry_id`,
`task_id` and `agent_id` may be at most 120 characters (HowlPlane's schema sets
no maximum; real ledger IDs are far shorter). A malformed, duplicated or
over-limit line fails the import with its line number (exit 3), and the
existing stores are left exactly as they were: no line is skipped or truncated
silently. That guarantee covers validation. If writing fails after validation
(for example the existing timeline store is corrupt, or a narrower grant denies
its write), missions can already be updated while the timeline is not; the
previous importer behaved the same way. `MAX` (default 2000) is an exact ceiling on nonblank lines
and must be a positive integer (otherwise exit 2); the file may be at most
3 MiB, about 3,000 typical HowlPlane records. Slices with many verification
records per task cost more and can exceed `make import`'s memory budget sooner.

The importer creates verification checks only for verification events with a non-null summary. It preserves the recorded result and summary; missing exit codes and check times stay absent. A result such as `passed` does not imply exit code 0.

Ledger recording timestamps and `metadata.recording_mode` remain visible as source provenance. A manual coordinator projection is not automatic live telemetry. Recording a start event does not establish the execution start time; missing times display as **not recorded**. No approval envelope is inferred from ledger completion or owner conversation.

Stop the server before importing: it holds the store in memory and would
overwrite the result. Imported records get `provenance: LEDGER`, and any entry
whose artifact path shows it came from a test run is marked
`origin=test_fixture`.

A 72-record sanitized sample ships at `data/fixtures/ledger_sample.jsonl` and is
exercised by CI.

---

## Factory surface

HowlBoard can show the redacted Factory snapshot and preview the exact
`Pending` row Plane's `BacklogSource` admits. It does not start Factory.

```bash
make run
make run-frontend
```

Open http://localhost:3000. With no snapshot dropped at
`data/factory/status/remote-snapshot.json`, the Factory panel says status is
unknown. **Refresh factory status** requests `GET /api/factory/status/published`.
**Preview fixture snapshot** loads the committed contract fixture from
`GET /api/factory/status/fixture`. **Preview Pending row** prints a row whose
status cell is exactly `Pending`, for paste into `issues.md`, `bugs.md`, or
`improvements.md`.

The short walkthrough is [docs/factory_demo.md](docs/factory_demo.md).

## Layout

| Path | What it is |
|---|---|
| `backend/server.howl` | Mission API. One file: the bytecode target has no module system. |
| `backend/contract_test.go` | Black-box tests against the running bytecode server. |
| `frontend/app.howl` | Browser interface, compiled to `frontend/app.js`. |
| `frontend/index.html`, `styles.css` | Static shell and the mission-control stylesheet. |
| `tools/ledger_import/` | HowlFrame CLI projecting real ledger records into missions. |
| `data/fixtures/missions.json` | The five demo missions. |
| `data/fixtures/ledger_sample.jsonl` | Sanitized real control-plane records. |
| `docs/` | GitHub Pages site and project documentation. |
| `scripts/` | Documentation and SEO gates. |

## Documentation

- [Architecture](docs/architecture.md) — how the tiers fit together and why
- [Domain model](docs/domain_model.md) — every field mapped to its ecosystem source
- [Dogfooding findings](docs/dogfooding.md) — what building this revealed about HowlFrame
- [Limitations](docs/limitations.md) — what v0.1 does not do
- [Roadmap](docs/roadmap.md)

## Ecosystem

HowlBoard is the human-facing surface. It deliberately does not reimplement its
neighbours: **HowlFrame** provides the language, VM and capability boundary;
**HowlChangeOps** owns authority, approval and execution safety;
**HowlPlane** owns coordination, routing and the evidence ledger;
**HowlRelay** owns continuity, handoffs and evidence provenance. HowlBoard
reuses their vocabulary rather than inventing a parallel one — see
[the domain model](docs/domain_model.md).

## License

MIT. See [LICENSE](LICENSE).

## Browser compatibility and smoke check

The frontend and published demo compile with `build --target=js`; bare-path
compilation in current HowlFrame selects standalone bytecode. The hosting page
grants only the API destination through `globalThis.HOWLFRAME_ALLOW_CAPS` before loading
the compiled frontend. This requires the HowlFrame browser host-grant fix;
older binaries can compile but cannot complete browser network calls.

For a read-only browser check, run an isolated API and frontend using the
quickstart above. Optionally load demo missions with `make seed`. With Python
Playwright and its Chromium runtime installed, run:

```bash
python3 scripts/test_browser.py --output /tmp/howlboard-browser-evidence
```

The check verifies real API loading, desktop/mobile overflow, keyboard focus,
and browser errors, and saves screenshots. It creates no missions or approvals.
It is a smoke check, not a complete accessibility audit. Backend contract
tests remain the gate for state transitions and authority.

Verification jobs explicitly set `HOWL_FORBID_LOCAL_INFERENCE=1`; these source checks do not authorize local model inference.

## Audit detail layout regression

Audit timelines wrap long publication URLs and artifact digests while preserving their full text. Run the shared-renderer browser regression with the documented compiler and Chromium:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
HOWLFRAME_BIN=./howlframe_bin python3 scripts/test_timeline_layout.py
```
