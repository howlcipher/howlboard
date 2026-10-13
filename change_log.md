# Changelog

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
