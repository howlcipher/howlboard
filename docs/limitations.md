# Limitations

What HowlBoard v0.1 does not do. Stated plainly so nothing here is discovered
by surprise.

## Not a multi-user system

The native record store is a single-process, file-backed store. There is no
authentication, no authorization, no per-user identity, and no session. Anyone
who can reach port 8080 can approve, reject and transition any mission. It is a
local operator tool.

The `_seq` counter is a read-then-write pair across two opcodes, not an atomic
operation, so concurrent creates can collide on an id. This is the same
non-atomic counter limitation HowlFrame's own `task_api` documented; the store
has no compare-and-swap primitive.

## Approvals are local, not ChangeOps-equivalent

`/api/missions/approve` mints an approval with an approver and an expiry. It
does **not** produce an HMAC-SHA256 signature over a decision digest the way
HowlChangeOps does. The expiry is enforced honestly and `ENVELOPE_EXPIRED` is
computed correctly, but the approval is a local grant and should not be read as
a cryptographically bound authority token.

Consequently `ENVELOPE_TAMPERED` is never produced — nothing is verified — and
`OUTSIDE_ENVELOPE_SCOPE` is never produced, because HowlBoard has no scope
model of its own.

## Read-mostly relationship with the ecosystem

HowlBoard observes. It does not dispatch work to HowlPlane, does not execute
anything through HowlChangeOps, and does not write to HowlRelay. Ledger import
is one-way and offline. The intended flow where a mission originates in
HowlBoard and travels out through the control plane is not built; the interfaces
are shaped so it could be, and that is all.

## Ledger import is a projection, and a lossy one

- It consumes a **slice**. The VM reads the whole file into memory and each line
  costs instructions; a 220MB ledger is not viable in-process.
- Timestamps are set to `0`. The ledger's ISO-8601 strings would need date
  parsing, which the language does not have, so imported missions show no
  meaningful times and their relative-time display is wrong.
- Evidence is capped at 25 items per mission. One real task carried 672. The
  true count is preserved in `evidence_total` so the trim is visible rather than
  silent, but the detail is gone.
- Reasoning, plans, gates and approvals are not reconstructed. The ledger does
  not carry them in a form that maps cleanly, so imported missions show empty
  decision and plan sections.
- Titles are the task id. The ledger has no title field.

Imported missions are honest but thin. They demonstrate that the real schema
flows through the real interface; they are not a rich view of past work.

## Interface constraints inherited from the framework

- Every endpoint is a POST with a JSON body, including reads, because routing
  is literal-path-only and no opcode exposes query or path parameters.
- The server port is a compile-time literal in `server.howl`; it cannot be set
  from the environment.
- There is no pagination. The mission list and the audit feed are returned
  whole. At demo scale this is fine; at ledger scale the feed is already large.
- Filtering is client-side, over the full list.

## Interface gaps

- No mission editing beyond state, approval and rejection. Fields other than
  `state`, `authority` and `outcome` are set at creation or import.
- No search.
- The audit feed is capped only by what the server returns.
- Dependencies between missions (`depends_on`) are in the model but are neither
  populated nor rendered.
- The dashboard aggregates agent activity but does not display it; the data is
  in `/api/dashboard` under `agents`.

## Verified scope

The contract suite covers the mission lifecycle, invalid transitions, authority
gating and expiry, the `passed`/`claimed` distinction, evidence provenance,
store enumeration across deletes, input validation, and fail-closed capability
denial. It does not cover concurrency, load, or browser behaviour across
engines. The interface was verified by executing the compiled `app.js` against
the live API through a DOM shim and inspecting the rendered output; it has not
been opened in a real browser as part of this work.
