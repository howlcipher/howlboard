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

Requires Go (to build the HowlFrame compiler) and Python 3 (to serve the
static frontend).

```bash
# 1. Build the HowlFrame compiler this repository compiles against.
git clone https://github.com/howlcipher/howlframe /tmp/howlframe
cd /tmp/howlframe && go build -o /path/to/howlboard/howlframe_bin howlframe.go

# 2. Compile both tiers plus the ledger import tool.
cd /path/to/howlboard
make build

# 3. Run the mission API (port 8080).
make run

# 4. In a second terminal, serve the interface (port 3000).
make run-frontend

# 5. Load the demo missions.
make seed
```

Open http://localhost:3000 and select a mission.

`make build` produces `backend/server.hfbc`, `frontend/app.js`, and
`build/ledger_import.hfbc`. The server runs as
`howlframe_bin -run-bc -allow-caps network,database,filesystem
backend/server.hfbc` — those three capabilities and nothing else.

---

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
head -n 5000 /path/to/evidence_ledger.jsonl > /tmp/slice.jsonl

make import LEDGER=/tmp/slice.jsonl MAX=5000
make run
```

Stop the server before importing: it holds the store in memory and would
overwrite the result. Imported records get `provenance: LEDGER`, and any entry
whose artifact path shows it came from a test run is marked
`origin=test_fixture`.

A 72-record sanitized sample ships at `data/fixtures/ledger_sample.jsonl` and is
exercised by CI.

---

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
