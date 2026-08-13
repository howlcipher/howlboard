# HowlBoard

HowlBoard is a small task board built with HowlFrame. It demonstrates a
HowlFrame bytecode HTTP service and a generated JavaScript browser client.

Tasks are held in HowlFrame's in-memory native store. They persist across
requests while the backend process runs and are discarded when it stops.

## Requirements

- A HowlFrame binary compatible with the v0.1 public CLI.
- Node.js for generated JavaScript syntax checking.
- `curl` for the HTTP integration test.

## Run locally

Build and run the API in one terminal:

```bash
make HOWLFRAME_BIN=/path/to/howlframe run
```

Serve the generated frontend in another:

```bash
make HOWLFRAME_BIN=/path/to/howlframe run-frontend
```

Open <http://localhost:3000>. The frontend calls the API at
`http://localhost:8080` and the API permits that local cross-origin flow.

## API contract

`GET /api/tasks` returns the board payload:

```json
{
  "tasks": [
    {"id": "1", "title": "Learn HowlFrame", "status": "open"}
  ]
}
```

`POST /api/tasks` accepts `{"title":"..."}` and returns the created task
with status `201`. `POST /api/tasks/complete` accepts `{"id":"..."}` and
returns the updated task. Malformed JSON and missing required fields return a
JSON error with status `400`; an unknown task ID returns `404`; unsupported
methods return `405`.

The generated client limits titles to letters, numbers, spaces, and basic
punctuation. This is an application-level safety boundary while the current
JavaScript backend has no JSON-serialization construct: it prevents raw input
from being interpolated into an invalid JSON request body.

## Validation

```bash
make HOWLFRAME_BIN=/path/to/howlframe test
```

The integration test checks source, builds the standalone backend with
`howlframe build`, starts it with `howlframe run`, validates the browser source
with `howlframe check`, generates the JavaScript compatibility output, checks
that output with Node, and exercises the read, create, completion, malformed
JSON, missing-field, CORS, and clean-shutdown paths.

The v0.1 public `check`, `build`, and `run` commands are used for the
standalone backend. The public `build` command deliberately emits HFBC only;
the documented JavaScript compatibility generation path remains
`howlframe frontend/app.howl -o frontend`, which emits `frontend/app.js`.

`make browser-test` is available for environments with Python Playwright and
an installed Chromium browser. This development environment has the Python
package but no browser executable, so the recorded validation uses the HTTP
suite and generated-JavaScript inspection instead.
