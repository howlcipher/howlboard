# Domain model

Every term below already existed somewhere in the Howl ecosystem. HowlBoard
reuses the vocabulary rather than inventing a parallel one, so a value shown in
the interface can be traced to the component that defines it.

## Mission

Stored at `mission:<id>` in `file://howlboard_missions.json`.

| Field | Source |
|---|---|
| `id`, `title`, `description`, `project`, `priority` | HowlBoard |
| `risk_level` | HowlPlane `EvidenceEntry.risk_level` — `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| `task_class` | HowlPlane `EvidenceEntry.task_class` — e.g. `bug_fix`, `infrastructure` |
| `state` | HowlBoard lifecycle (below) |
| `executor`, `recommended_executor`, `is_override`, `override_reason` | HowlPlane `EvidenceEntry.actual_agent` / `recommended_agent` / `is_override` |
| `provenance` | HowlBoard — `DEMO`, `LEDGER`, or `OPERATOR` |
| `origin` | HowlBoard — `control_plane` or `test_fixture`, set on import |
| `outcome` | HowlPlane ledger terminal actions |
| `depends_on` | HowlBoard — optional list of mission ID strings; informational and navigable in the shared mission view (not ordering, blocking, approval, or scheduling) |

## Lifecycle

```
CREATED ──> ROUTED ──> AWAITING_APPROVAL ──> EXECUTING ──> VERIFYING ──> COMPLETED
                │                │              │  ▲           │
                └──> EXECUTING   └──> CLOSED    │  └─ REMEDIATING ─┐
                                                │                  │
                                       BLOCKED ─┘         FAILED ──┘
```

The complete whitelist is `can_transition` in `backend/server.howl`. Anything
absent returns `400 INVALID_TRANSITION` naming both states.

Entering `EXECUTING` additionally requires live authority. A legal transition
with a lapsed or absent envelope returns `403 AUTHORITY_DENIED` carrying the
computed `envelope_status`.

## Authority

`authority.decision` — HowlChangeOps `Decision.Result`
(`adapter/main.go`): `ALLOW`, `DENY`, `REQUIRE_APPROVAL`.

`envelope_status` — HowlPlane `AuthorityDecision`
(`src/control_plane/authority_envelope.py`), **derived on every read**:

| Value | When |
|---|---|
| `DELEGATED_AUTHORITY_ALLOW` | decision permits action and any approval is unexpired |
| `REQUIRE_APPROVAL` → `ENVELOPE_ABSENT` | approval required, none on record |
| `ENVELOPE_EXPIRED` | an approval exists and `expires_at` has passed |
| `DENIED_BY_ENVELOPE` | decision is `DENY` |

`OUTSIDE_ENVELOPE_SCOPE` and `ENVELOPE_TAMPERED` are part of the same enum and
are rendered if present, but HowlBoard does not yet compute them — it has no
scope model and does not verify signatures.

`authority.gates[]` — HowlChangeOps `Gate` `{name, status}`.
`authority.approval` — HowlChangeOps `Approval`. HowlBoard populates
`approver`, `issued_at` and `expires_at`; `nonce`, `signature` and
`decision_digest` are part of the schema but are not minted here (see
[architecture](architecture.md#boundaries)).

## Evidence

`evidence[].type` — HowlRelay `EvidenceType` (`src/howlrelay/model.py`):
`git_commit`, `git_diff`, `git_branch`, `git_status`, `test_run`,
`continuity_doc`, `howlframe_policy`, `decision_record`, `custom`.

Fields mirror HowlRelay `Evidence`: `type`, `ref`, `source`, `description`,
`fingerprint`, `collected_at`.

**Surveillance constraint.** HowlRelay raises `SurveillanceSignalError` for
prohibited metadata keys, on the principle *measure the work system, not the
worker*. HowlBoard honours it: there are no keystroke, presence, session-
duration or active-hours fields anywhere in the model. One of the five demo
missions is a rejected request for exactly such a feature, with that rationale
recorded.

## Decision record

`reasoning` mirrors HowlRelay `Decision`: `problem`, `observations[]`,
`assumptions[]`, `options[]` (`{option, assessment}`), `selected`, `rationale`,
`confidence` (`high`/`medium`/`low`/`unknown`), `decided_by`.

These are structured decision summaries — problem, evidence, options
considered, and why one was chosen. They are not model chain-of-thought and no
provider's internal reasoning is stored or displayed.

## Plan

`plan[]` mirrors HowlRelay `NextAction`: `action`, `owner`,
`priority` (`IMMEDIATE`/`NEXT`/`LATER`), `command`, plus a HowlBoard `state` of
`pending`, `active`, `complete`, `failed` or `skipped`.

## Execution

`execution.receipt` mirrors HowlChangeOps `ExecutionReceipt`: `executed_at`,
`verification`, `rollback_status`, `error_message`.

`execution.delta` mirrors the HowlPlane ledger's `repository_delta_captured`
metadata: `files_added[]`, `files_modified[]`, `files_deleted[]`, `insertions`,
`deletions`, plus `unexpected[]` for changes outside the declared scope —
corresponding to the ledger's `out_of_scope_edits_reverted` action.

Also `executor`, `started_at`, `ended_at`, `current_operation`, `retries`,
`recovery_actions[]`.

## Verification

`verification[]` mirrors HowlChangeOps `ValidationResult`: `name`, `status`,
`exit_code`, `output_digest`, `started_at`, `finished_at`.

Status values come from the real ledger's `verification_summary`, which
distinguishes three outcomes:

| Status | Meaning |
|---|---|
| `passed` | ran and succeeded |
| `failed` | ran and failed |
| `claimed` | asserted by the agent; nothing independently confirmed it |

`claimed` is rendered as its own status with an explicit "not independently
verified" note. This is the load-bearing honesty feature of the product, and it
is contract-tested: `claimed` must never be reported as `passed`.

## Outcome

The ledger's terminal actions: `task_completed`, `task_failed`, `task_closed`.
Set automatically when a mission reaches `COMPLETED`, `FAILED` or `CLOSED`.

**A note on vocabulary.** The v0.1 brief proposed
`PURSUE` / `REJECT` / `DEFER` / `REQUIRES_HUMAN` / `NO_VALUABLE_ACTION`. None of
those strings exist anywhere in the ecosystem. Introducing them would have
created a vocabulary no other Howl component recognizes, so the ledger's real
terminals are used instead. If a value judgment distinct from "did it finish"
is wanted later, it belongs upstream in HowlPlane first.

## Factory status

Read-only projection of HowlPlane `howlplane.factory.status/v1`. The Plane
artifact is `factory/status/remote-snapshot.json`. HowlBoard reads an operator
drop of that file at `data/factory/status/remote-snapshot.json`. Until the
host publishes one, `/api/factory/status` returns `present=false`,
`reason=SNAPSHOT_ABSENT`, and `state=unknown`.

`POST {"source":"fixture"}` reads `data/fixtures/factory/remote-snapshot.json`
and labels the result `provenance=FIXTURE`. A file that is missing, invalid
JSON, the wrong schema, or not `redacted: true` is not rendered as live
status. Fields outside the public snapshot (task output, workspace paths,
provider inventory) are dropped. Obvious token shapes in free text are
replaced with `[redacted]`.

Displayed fields are the published contract: `campaign_id`,
`mission_campaign_id`, `repository`, `state`, `current_dispatch`, blockers
(`OWNER_REQUIRED`, `BLOCKED`, `DEFERRED`), `owner_required`, `last_tick_at`,
and `last_error`.

## Pending backlog row

`/api/factory/pending-row` previews one row for HowlPlane `BacklogSource`.
The status cell is always exactly `Pending`. The shape matches the ranked
table in `issues.md`, `bugs.md`, or `improvements.md`:

```
| # | Title | Status | Score | Rationale |
| --- | --- | --- | --- | --- |
| 91011 | [Publish redacted factory status](#91011-publish-redacted-factory-status) | Pending | 2.0 (4x1/2) | Remote operators cannot see the live campaign. |
```

`bugs.md` and `issues.md` are bug ledgers. `improvements.md` is the
improvement ledger. A score below the BacklogSource floor of `0.5` is still
previewed and marked ineligible. The endpoint does not write those files,
does not set `owner_direction`, and does not start Factory. Admission is a
pull request that adds the row under the first `## Ranked Backlog` heading
on a repository the campaign already watches.

## Timeline

`{mission_id, action, actor, detail, timestamp}` in one append-only feed.

`action` uses the vocabulary observed in HowlPlane's evidence ledger:
`task_created`, `project_discovered`, `route_selected`,
`implementation_started` / `_completed` / `_failover` / `_recovered`,
`review_started` / `_completed`, `verification_started` / `_completed`,
`remediation_started` / `_completed`, `human_boundary_triggered`,
`human_decision_requested`, `human_approval`, `human_rejection`,
`out_of_scope_edits_reverted`, `repository_delta_captured`, `task_completed`,
`task_failed`, `task_resumed`, `task_closed`.

Transitions performed through the API are recorded as `state:<NEW_STATE>`,
which is HowlBoard's own addition and is deliberately distinguishable from a
ledger action.

`actor` uses HowlPlane `agent_id` values: `control_plane`, `agy`, `howlframe`,
`devin_cli`, `claude_code`, `codex`, `gemini_cli`, `human_operator`,
`local_ollama`.
