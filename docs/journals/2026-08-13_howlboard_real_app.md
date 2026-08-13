# HowlBoard real application journal

## 2026-08-13

- Started from HowlBoard commit `6d9b67cd1e59665494c96f651591cf5da934c6a7` on branch `feat/real-v01-consumer`.
- Initial inspection found a contract mismatch: the backend returned a top-level JSON list while the frontend attempted to read a `tasks` property. The frontend also never rendered the loaded data.
- The initial Makefile used legacy HowlFrame flags. Validation will use the coordinator-provided candidate built from the verified HowlFrame baseline.
- No HowlFrame source changes are permitted from this worktree. Any mutation blocker will be demonstrated as a minimal standalone HowlFrame source reproduction before reporting it.

## Candidate validation

- Coordinator supplied `/tmp/howlframe-candidate`, built from HowlFrame
  `628066d2e86ae7991cd491b0832547ff55123725`. It reports `HowlFrame 0.1.0`,
  HFBC format `1`, and SHA256
  `407978c986eaf4f6a9fc6eaf5f3f84d58dbaa16719a44a818b2bd4473af743e6`.
- `howlframe check backend/server.howl` and `howlframe build
  backend/server.howl -o /tmp/howlboard-server.hfbc` passed with that exact
  binary. `howlframe run --allow-caps network,database` served the compiled
  artifact successfully.
- The read contract is now `{"tasks":[...]}`. The initial API mismatch was
  an application defect, not a HowlFrame defect: the prototype returned a
  top-level list while its frontend read `tasks`.
- Real `curl` validation against the candidate proved: initial tasks renderable
  as JSON; task creation returns `201`; completion returns `200`; a subsequent
  list shows the completed state; malformed JSON and a missing title return
  `400` without a task mutation; and OPTIONS responses carry the required CORS
  headers.

## Request-body investigation

- The hypothesized missing `req_body` primitive is **not a blocker** on this
  candidate. Existing HowlFrame application source at
  `apps/task_api/task_api.howl` uses `(parse_json TaskInput req.body)`, and
  this board independently proved that form with valid JSON and `try_let`
  malformed-JSON handling over HTTP.
- The implementation is currently a special `req.body` path inside the VM's
  `PARSE_JSON` handling, not a registered `req_body` construct. It reads via
  `io.ReadAll`, so body-size safety is a core-runtime conformance concern, not
  a reason to add a second request-body accessor from the application.

## Frontend build and browser evidence

- `howlframe check frontend/app.howl` passes. The current public `howlframe
  build` command is HFBC-only: `howlframe build frontend/app.howl -o
  /tmp/howlboard-app.hfbc` correctly fails with `HFIR_TARGET_INFEASIBLE`
  because `web_app` is a JavaScript target. The documented compatibility
  generator, `howlframe frontend/app.howl -o frontend`, emits `frontend/app.js`
  and that output passes `node --check`.
- This is recorded as a CLI/documentation boundary, not worked around in
  HowlFrame. The Makefile uses public `check`, `build`, and `run` for the
  standalone backend plus the documented JavaScript compatibility generator.
- A Playwright browser-flow test was authored, but the environment provides
  the Python package without its Chromium executable; launch fails before a
  page opens. The available evidence is therefore HTTP integration and
  generated-JavaScript syntax inspection, not an executed browser interaction.

## Final local validation

- `HOWLFRAME_BIN=/tmp/howlframe-candidate make test` passed after the final
  method-boundary check. The test starts and stops its own compiled backend;
  it does not rely on a pre-existing server.
- `git diff --check` passed. Generated artifacts were removed with `make
  clean`; no generated output is intended for version control.
