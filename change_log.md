# Changelog

## Compile against the published HowlFrame v0.2.0 release

- CI and the README quickstart install the published HowlFrame v0.2.0 binary with `scripts/install_howlframe.sh` instead of cloning HowlFrame and building commit `e77e008f`. The script checks the archive against a SHA-256 pinned in this repository, confirms the binary reports `HowlFrame 0.2.0`, and installs nothing otherwise. v0.2.0 contains `e77e008f`; HowlBoard's sources, tests and grants are unchanged.
- Go is now needed only for `make test`. Building from source remains documented for other platforms and for rollback (`v0.2.0`, `e77e008f`, `7631ce5d`).
- `scripts/test_docs.py` checks that CI, the README and the published page use the installer, and that the README names its release version.

## Ledger import validates with EvidenceDesk's ledger module

- `tools/ledger_import` now validates the whole slice with EvidenceDesk's ledger module, vendored byte-identical from HowlFrame (`tools/ledger_import/evidence_ledger.howl`, provenance and hash in `VENDORED.md`), before writing anything. The projection into missions and timeline events is unchanged: on valid input both stores are identical to the previous importer's, including the 72-record sanitized sample.
- Behavior changes on input the previous importer accepted: `entry_id`, `task_id` and `agent_id` longer than 120 characters are refused (EvidenceDesk's limit; HowlPlane's schema sets no maximum, and the longest `task_id` in a local 443,371-record ledger is 41 characters).
- Behavior changes on input the previous importer mishandled: malformed JSON, non-object lines, a wrong or missing schema, a missing or empty `entry_id`/`task_id`/`agent_id`/`action`, and duplicate `entry_id`s now fail the import with the line number (exit 3) instead of being skipped or counted twice; an empty or blank file fails instead of replacing the existing timeline with an empty one; more nonblank lines than `MAX` fail instead of importing `MAX + 1` and dropping the rest; `MAX` must be a positive integer (exit 2); files over 3 MiB fail with a diagnostic. On every validation failure the existing stores are byte-identical afterwards. Not changed: if a write fails after validation (a corrupt existing timeline store, or a grant that denies its write), missions can already be updated while the timeline is not, as with the previous importer.
- Fixes: an entry without `metadata` (optional in `ai.evidence_entry/v1`) or with non-object `metadata` no longer aborts the import with a raw `TYPE_ERROR`.
- `make import` raises the VM's cumulative memory charge to 256 MiB so a 3 MiB slice of typical records fits (slices with many verification records per task can still exceed it); the documented 5000-line slice exceeded the previous default at typical record sizes. Grants are unchanged (`filesystem,database`).

## Audit detail layout

- Wrap long audit timeline URLs and digests within mobile and desktop viewports without truncating evidence. Add a Chromium regression against the compiled shared renderer.

## Verified current Frame integration

- Pin README and CI to reviewed Frame `88e49597bf121ad1ea2ff05aabf3d9c4cc2ccfef`, integrating PR183–187. The relative-store fix keeps atomic temporary files beside the destination across filesystem mounts; stable opcode decoding preserves older artifacts. Full native lifecycle/race and browser consumption are verified separately from released installations.

## HOWL-E2E-UX-001

- Compile browser targets explicitly and declare only the frontend network grant.
- Keep malformed dependency inputs at HTTP 400 under the current runtime.
- Wrap long Factory blocker reasons on mobile.
- Add a read-only desktop/mobile browser smoke that detects real API failures.

## Actual mission telemetry integrity

- Ignore null/missing verification summaries and non-verification actions; preserve genuine results, summary details and explicitly recorded exit codes without inventing successful exits.
- Preserve ledger recording timestamps and methods separately from execution timestamps; show missing times and observed start events honestly.
- Add a typed native-import/generated-renderer regression for null/missing summaries, passed/claimed/failed distinctions, explicit exit0/7, manual provenance and unrecorded execution time.

Pin the documented and CI compiler to tested HowlFrame7631ce5d, with Go1.26.
Floating upstream builds failed the existing demo seed contract after a null
semantics change; newer compiler compatibility remains explicitly unverified.

## Current Frame consumer compatibility

* Explicit server/handler scopes retain the existing two-host public Factory read integration and fail closed on ungranted destinations. Local browser and static showcase host grants match the current scoped contract.
* Missing authority, approval, TTL, verification and agent-count values use explicit nil checks. Scope errors are displayed as failures, not absent snapshots or completed work.
* Test fixtures use exact ephemeral host/port grants in isolated artifacts; ordinary lifecycle tests use the shipped artifact. Runtime denied fetches make zero requests.
* Compatible reviewed Frame candidate pin replaces the old pin only in this reviewable branch; the old Frame/Board pair is documented for rollback. Source-candidate desktop/mobile and historical real-ledger consumption pass; publication and merge are separate.

* Verification jobs forbid local inference, and the compatible candidate source pin includes that verified configuration.

## Mission007 F1 defensive maintenance

Require POST plus explicit constant-time bearer authorization for all six write routes, including seed; retain Origin restrictions as additional browser protection, never authentication. Default missing/malformed token disables writes. Frontend supplies Authorization from a nonpersistent password field; seed CLI uses header stdin. Approval records explicitly disclaim independent identity. Pin already-merged Frame211 for existing frontend fetch-header support. HTTP contract/no-effect regressions fail on merged Board20 baseline; Chromium exploit reproduction remains BLOCKED and is not counted as passed.
