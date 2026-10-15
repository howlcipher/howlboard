# Changelog

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
