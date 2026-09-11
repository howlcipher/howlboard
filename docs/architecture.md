# Architecture

## Shape

```
Browser
  frontend/app.howl ─┬─(HowlFrame JS backend)──>  frontend/app.js
  frontend/mission_view.howl  (module, shared)
  docs/demo.howl    ─┴─(HowlFrame JS backend)──>  docs/demo.js  (published, read-only)
        |  fetch, JSON bodies only
        v
HowlFrame bytecode VM   -allow-caps network,database,filesystem
  backend/server.howl  --(-compile-bc)-->  backend/server.hfbc
        |
        v
Native record store
  file://howlboard_missions.json     mission:<id> records, _seq
  file://howlboard_timeline.json     one append-only audit feed
        ^
        |  offline projection
tools/ledger_import/ledger_import.howl  (cli_app)
        ^
        |
HowlPlane control plane   logs/control_plane/evidence_ledger.jsonl
                          schema ai.evidence_entry/v1
```

Nothing in this diagram is hand-written Go or JavaScript. `howlframe_bin` is
the compiler; `server.hfbc` and `app.js` are its output.

## Decisions

**One backend file, but not one frontend file.** The bytecode target does not
support `module`, `use` or `export`, so `server.howl` is a single file by
necessity. The JavaScript backend *does* support modules, so the browser tier is
split: `mission_view.howl` exports the mission renderers and is imported by both
the application and the published showcase. That the published demo renders
through the same module as the product is the reason it cannot drift from it —
which is exactly how the previous demo drifted.

**Authority is computed, not stored.** `envelope_status` runs on every read and
compares the approval's `expires_at` against the clock. Storing a frozen
authority string would let the interface repeat an assertion that has since
become false — which is precisely the failure mode the product exists to
prevent. The cost is that authority cannot be cached; at this scale that is
irrelevant.

**Two independent gates on execution.** `can_transition` enforces lifecycle
ordering. Separately, entering `EXECUTING` requires `envelope_status` to be
`DELEGATED_AUTHORITY_ALLOW`. A legal transition with dead authority returns
`403 AUTHORITY_DENIED`. Collapsing these into one check would let a state
machine edit imply an authority grant.

**A single append-only audit feed.** Timeline events live in one insertion-
ordered list rather than individually keyed records. The language has no sort
primitive, and string-sorted keys order `event:10` before `event:9`, so
insertion order is the only reliable chronology available. Per-mission history
is that feed filtered by `mission_id`.

**Enumeration through `store_keys`.** Missions are keyed `mission:<id>` and
listed by enumerating the store and filtering the prefix. Earlier HowlFrame
applications, including HowlBoard itself, maintained a parallel index record
that could silently diverge from the records it indexed. `store_keys` was added
to HowlFrame during this work specifically to remove that class of bug.

**Ledger import is offline and separate.** 232,000 ledger entries cannot be
parsed inside a 100,000-instruction request budget, and pretending otherwise
would misrepresent what the VM can do. `ledger_import` is a `cli_app` run
against a slice with a raised instruction ceiling. It writes the same
`file://` stores the server reads, so the server must be stopped first.

**RPC-shaped endpoints, not REST.** Routing is literal-path-only and no opcode
exposes query parameters, path parameters or request headers. Every addressable
operation is therefore a POST carrying a JSON body, including reads:
`/api/missions/get` takes `{"id": "..."}`. `req_method` is available and is used
for OPTIONS preflight.

**Escaping is explicit, and context decides whether it is enough.** The JS
backend's `set_html` writes `innerHTML` and there is no escaping primitive, so
`esc` is built from `str_split`/`str_join` and applied to every interpolated
value. It escapes `&`, `<`, `>`, `"` and `'`.

Applying it everywhere is necessary and was not sufficient. Mission rows used to
carry `onclick="window.open_mission('<esc id>')"`, which places the value inside
a JavaScript string literal. The HTML parser decodes entities in an attribute
before JavaScript parses it, so an escaped quote becomes a real quote, closes the
string, and the rest of the identifier is executed as code. Escaping the double
quote stops an attacker leaving the attribute; nothing about HTML escaping stops
them leaving the string.

HowlProof demonstrated this against the compiled interface in a real browser, by
seeding a mission whose identifier carried a quote and observing the injected
expression run (HP-SEC-0007). Identifiers minted by `/api/missions/create` are
server assigned and never carried it; `/api/seed` and the offline ledger importer
keep whatever identifier their source document held, and the importer's source is
projected control-plane telemetry.

No value is placed inside a handler now. Identifiers live in `data-mission-id`,
an attribute-value context where escaping the quote characters is sufficient, and
each handler is a constant that reads the value back with `this.dataset` at click
time. `TestHandlerAttributesInterpolateNoValues` and
`TestEscapeFunctionCoversQuoteCharacters` fail if either half regresses.

## Capabilities

| Capability | Why the server needs it |
|---|---|
| `network` | `http_server`, `route`, `res`, `res_json` |
| `database` | every `store_*` operation |
| `filesystem` | `file://` store persistence and reading `data/fixtures/missions.json` |

The importer needs only `filesystem,database`. Removing `database` from the
server produces `CAPABILITY_DENIED` on the first store access, which since the
fail-closed fix reaches the client as a 500 carrying that code — regression
tested in `TestDeniedCapabilityFailsClosed`.

## Boundaries

HowlBoard is the visualization and interaction layer and does not duplicate its
neighbours. It does not decide authority policy (HowlChangeOps), route work to
executors (HowlPlane), or own continuity and handoff (HowlRelay). It reads
their vocabulary and renders it.

Two boundaries are currently ambiguous and worth stating plainly:

1. **Approval issuance.** `/api/missions/approve` mints an approval with an
   expiry but no HMAC signature, whereas HowlChangeOps' `Approval` carries
   `nonce` and `signature` and is verified against a decision digest. HowlBoard's
   approval is therefore a *local* grant suitable for demonstration, not a
   ChangeOps-equivalent authority token. Wiring the real signing path is
   roadmap work.
2. **Mission origination.** HowlBoard can create missions directly. In the
   intended end state HowlPlane originates and routes work and HowlBoard
   observes and authorizes it. The create endpoint is a v0.1 convenience and
   marks its records `provenance: OPERATOR` to keep them distinguishable.

## Repository placement

HowlBoard stays a separate repository. It was already one, is already published,
and is already referenced by HowlChangeOps as the ecosystem's operational
visibility component. It also has a different release cadence and a different
audience from the compiler. Folding it into `howlframe/apps/` would couple a
user-facing product to compiler releases for no benefit.

The dependency runs one way: HowlBoard consumes HowlFrame. CI builds the
compiler from `howlcipher/howlframe` main, so framework changes must land there
before HowlBoard can rely on them.
