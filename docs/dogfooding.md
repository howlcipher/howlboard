# HowlBoard Dogfooding Journal

HowlBoard is an external consumer test of HowlFrame to discover genuine missing primitives, compiler bugs, and usability friction when building full-stack web applications.

## Initial Maturation
- Diagnosed contract mismatch: backend was returning a list of tasks while the frontend expected a JSON object with a "tasks" array.
- Solved the mismatch by rewriting the backend in HowlFrame to return `{"tasks": [...]}` and setting up CORS.
- Developed a functionally complete `web_app` frontend logic for tasks using native HowlFrame DOM queries.
- Bypassed HowlFrame bytecode VM bug involving `res` argument popping count by using `res_json` for 204 OPTIONS.

## Board Upgrade (Part 2)

During the expansion of HowlBoard from a simple list into a full 5-column deterministic board (BACKLOG, READY, IN_PROGRESS, BLOCKED, DONE), several new limitations were discovered and resolved.

### 1. Missing DOM HTML Mutability
* **Requirement:** The frontend `web_app` needs to generate HTML structures (task cards) dynamically and inject them into the DOM board columns.
* **Limitation:** The HowlFrame JS backend only provided `set_text`, which sets `.textContent` and escapes HTML. There was no way to inject raw HTML or create elements, making UI composition impossible.
* **Classification:** A (Legitimate missing primitive)
* **Resolution:** Added `set_html` to HowlFrame's IR, type checker, and JavaScript generator (mapping to `.innerHTML`).

### 2. Missing CSS Class Manipulation
* **Requirement:** A theme toggle for switching between dark and light modes.
* **Limitation:** There was no way to cleanly add or remove CSS classes on an element (like the `body` tag) from HowlFrame.
* **Classification:** A (Legitimate missing primitive)
* **Resolution:** Added `toggle_class` to HowlFrame's IR, type checker, and JavaScript generator (mapping to `.classList.toggle()`).

### 3. Deep String Concatenation Parens (Ergonomics)
* **Requirement:** Constructing JSON requests from 5+ DOM fields in a single string.
* **Limitation:** The strict Lisp-like AST grammar means `(+ A (+ B (+ C D)))` nests very quickly. When generating JSON manually via strings, counting closing parenthesis (`))))))))`) became a major developer friction point and caused multiple syntax errors.
* **Classification:** B (Ergonomics problem)
* **Workaround:** Just manually counted the correct number of closing parens. A multi-arity `concat` or string interpolation would drastically improve this.

### 4. Deterministic State Transitions
* **Requirement:** Enforce board transitions on the backend (e.g. BACKLOG -> READY).
* **Implementation:** Wrote a `can_transition` policy function in `server.howl` using nested `if` statements. It cleanly rejects invalid mutations before writing to `store_put`. This validates HowlFrame's "intent is not authority" principle perfectly.

## Verification
- HowlFrame changes for `set_html` and `toggle_class` successfully applied.
- `app.howl` now natively handles the DOM for the entire HowlBoard UI without handwritten JS.

## Persistence, Filters, and Activity History

HowlBoard now persists task records and records every creation, valid state transition, and deletion in an activity history. It also adds client-side filtering by title, status, priority, and labels.

### 5. Response Context Does Not Cross Bytecode Function Calls

* **Requirement:** Apply the same CORS headers to each HTTP route through a reusable function.
* **Limitation:** A `res_header` call inside a `defun` cannot access the response writer captured by the route and the VM panics with `no response writer`.
* **Classification:** A (Runtime context propagation bug)
* **Workaround:** Set CORS headers directly in each route body.

### 6. Bytecode Boolean Literals Are Not Values

* **Requirement:** Track whether a requested state transition matches the allowed state machine.
* **Limitation:** In bytecode, `true` and `false` are resolved as identifiers instead of boolean values.
* **Classification:** A (Bytecode compiler bug)
* **Workaround:** Use equality expressions to construct boolean values.

### 7. Empty Bytecode Lists Serialize as JSON Null

* **Requirement:** Return an empty task or activity list as a JSON array.
* **Limitation:** An empty HowlFrame list serializes to `null` in bytecode responses.
* **Classification:** A (Runtime serialization bug)
* **Workaround:** The generated frontend treats a missing or null list as empty; the contract test records this behavior explicitly.

---

# Mission Control (v0.1)

Rebuilding HowlBoard from a task board into an interface for governed
autonomous work was a much harder stress test than the board ever was. A
mission record is a nested, heterogeneous document with ten sections; a board
task was eight flat string fields. Almost everything below was found by trying
to express that one shape.

Every claim here was checked against current source or a running process. Where
this journal previously recorded something that is no longer true, the entry is
corrected rather than left to mislead.

## Corrections to earlier findings

Three of the seven findings above are stale. They were real when written; they
are not real now, and the workarounds they justified are no longer needed.

**#5, "Response context does not cross bytecode function calls" — fixed.**
`res_header` inside a `defun` called from a route works. The VM parents a call
environment to the calling environment (`OpCall` in `internal/vm/vm.go`), so
the response writer resolves through the chain, and HowlFrame's own
`TestHTTPFunctionContextIsRequestScoped` asserts exactly this across concurrent
requests. HowlBoard now sets CORS through a single `(defun cors ())` instead of
repeating three headers in every route.

**#6, "Bytecode boolean literals are not values" — fixed.** `true` and `false`
compile and round-trip correctly, including inside dicts serialized to JSON.
The `(= "valid" "valid")` workaround has been removed; `can_transition` returns
a real `bool`.

**#7, "Empty bytecode lists serialize as JSON null" — fixed.** An empty list
serializes as `[]`. Verified against a freshly reset server: `/api/missions`
returns `{"missions":[]}` and `/api/timeline` returns `{"events":[]}`.

A fourth correction is not a HowlFrame bug but is worth recording: the
`apps/task_api/DEVELOPMENT_NOTES.md` claim that no opcode exposes the HTTP
method is also stale. `OpHttpReqMethod` exists and `(req_method req)` works;
HowlBoard uses it for OPTIONS preflight in every route.

## Worked well

**Capability enforcement is real and cheap to reason about.** The server runs
with exactly `network,database,filesystem` and nothing else. Dropping
`database` produces an immediate, specific denial rather than a degraded mode.
This is the single most convincing thing about the platform in daily use.

**Per-request VM isolation is correct.** Each HTTP request runs in a fresh
child VM sharing one mutex-protected store registry, so the instruction ceiling
is per-request rather than a lifetime budget, and state is shared correctly
across requests without any application effort.

**The native store is genuinely adequate for a real application.** Records are
`map[string]any` and persist nested lists and dicts through `file://` without
ceremony. A ten-section mission document round-trips intact.

**Fail-closed target checking caught a real mistake.** Using `not` produced
`HFIR_TARGET_INFEASIBLE` naming the construct, the target, and the source
location. That is the contract working as designed.

**Decomposition works, once you know the annotations.** `(type_hint x "dict")`
on parameters and `(type_hint return "dict")` on results make helper functions
that consume and produce records viable. The mission detail view is ten
separate stage functions because of it. Without those annotations the entire
view would have had to be one expression.

## Framework changes made

Each was forced by building this application, and each is independently tested
in the HowlFrame repository.

### 1. Dict values may mix types (blocker)

**Requirement.** A mission record is
`(dict ("id" "HF-412") ("insertions" 7) ("evidence" (list ...)) ("authority" (dict ...)))`.

**Limitation.** The analyzer modelled a dict as a homogeneous `map[string]T`,
inferring the element type from the first value and rejecting the rest:
`dict value 3 has type list, want string`. `map_set` enforced the same rule.
Dicts are the language's record literal, so this rejected the shape every real
application needs.

**The runtime never had this restriction.** A heterogeneous record built by
`parse_json` round-trips through `store_put`/`store_get` and `res_json`
perfectly — verified before changing anything. Only the checker refused to let
you write one down.

**Classification.** A (analyzer strictly more restrictive than the runtime).

**Resolution.** Heterogeneous dict literals and `map_set` writes now widen the
element type to `any` through the existing `join` helper. Key checks,
target-kind checks, and list element homogeneity are unchanged. Two test
assertions encoding the old rule were removed, with positive coverage added.

Without this change HowlBoard could not have been written at all: the only
alternative was building JSON by string concatenation and parsing it back,
which would have been a damning result rather than a workaround.

### 2. `store_keys` (missing primitive)

**Requirement.** List every mission.

**Limitation.** The store exposed only open/put/get/delete. The keys existed in
`bcMemoryStore.records` and were simply unreachable from `.howl`, so every
prior application invented a parallel index: `kv_cli`, `todo_cli` and
`task_api` probed a monotonic counter, and HowlBoard maintained an `_all_ids`
record it had to keep in step by hand on every create and delete.

**Classification.** A (legitimate missing primitive).

**Resolution.** Added `store_keys` / `STORE_KEYS`, returning keys as a **sorted**
list. Sorting is not incidental: Go randomizes map iteration, so unsorted
enumeration would make every listing endpoint nondeterministic in a platform
whose value proposition is determinism. HowlBoard's `_all_ids` index is gone.

A prefix argument was deliberately not added. Filtering `mission:` from the
returned list is the application's business, and the smallest correct
abstraction is the one worth adding.

### 3. Route handlers fail closed (safety bug)

**Requirement.** A denied capability should be visible to the client.

**Limitation.** `OpHttpRoute` recovered from handler panics and only printed to
stdout. Nothing was written to the `ResponseWriter`, so Go sent **200 with an
empty body**. A `CAPABILITY_DENIED` denial — the platform's core safety
mechanism — was indistinguishable from a completed request.

**Classification.** A (fail-open behaviour in a fail-closed platform).

**Resolution.** A handler that fails before responding now returns 500 carrying
the structured `VMError` JSON, with its code preserved, logged to the VM error
stream rather than process stdout. A handler that already committed a response
is left untouched. `TestDeniedCapabilityFailsClosed` in HowlBoard's contract
suite is a regression test for this against a real capability-denied server.

This one paid for itself within the hour: the first broken seed route returned
a precise `TYPE_ERROR` instead of a silent empty 200.

### 4. `for` over an expression silently miscompiled (codegen bug)

**Requirement.** `(for m (map_get d "missions") ...)` in the browser tier.

**Limitation.** Both the JavaScript and Go backends read the iterable's raw
node value, which is empty for anything but a bound symbol. The emitted output
was `for (let m of )` and `for _, m := range {`. **Invalid code was generated
with no diagnostic at all**, which is worse than refusing to compile.

**Classification.** A (silent miscompilation).

**Resolution.** Both backends now generate the iterable expression. The
bytecode target was always correct, which is why this survived: the backends
disagree and nothing compared them.

### 5. `web_app` output could not run in a browser (codegen bugs)

Two defects that together made every generated interface fail to load. Neither
is exotic; both were invisible because nothing executed the generated file.

**`on_event` emitted no trailing semicolon.** Automatic semicolon insertion does
not apply before `(`, so the next top-level statement was parsed as a call of
the `addEventListener` result.

**Top-level statements were emitted at the top level.** They routinely contain
awaited calls, and a classic `<script>` has no top-level await. Loading the file
as a module would fix the parse but stop function declarations from being
reachable as globals, which inline handlers depend on. They are now wrapped in
an async IIFE, with function declarations left at top level.

**Classification.** A (generated artifact never executed by any test).

The lesson generalizes beyond these two bugs: **successful compilation was
being treated as success.** HowlBoard's build now parses `app.js` as a classic
script and executes it against a DOM shim.

### 6. `time_now` in the JavaScript backend (missing lowering)

Supported by the bytecode VM and the Go backend, rejected as an unknown
statement for `web_app`. A browser interface had no way to read the clock, so
relative timestamps were impossible. Added to both the checker's JS statement
allowlist and the generator.

## Rejected changes

**`middleware` in the bytecode target.** The obvious candidate: `middleware` is
Go-backend-only, and CORS was repeated in every route. It was not implemented,
because finding #5's correction removed the need — a plain `(defun cors ())`
called from each route works. Adding an opcode to solve a problem a function
already solves would have been framework growth for its own sake.

**A prefix argument on `store_keys`.** Convenient, but filtering belongs to the
caller.

**Module support in the bytecode target.** This is the largest real gap (see
below) and it was deliberately left alone. It is a substantial compiler change
with real regression risk, and the correct response to finding it in a dogfood
pass is to report it with evidence, not to attempt it opportunistically.

## Remaining gaps, not fixed

Ordered by how much they cost.

**1. No module system in the bytecode target.** `module`, `use`, `import` and
`export` are all unsupported, so `backend/server.howl` is necessarily one
665-line file. This is the single biggest limit on building anything larger.
The frontend is worse at 824 lines. Splitting by concern is impossible, so the
only available structure is `defun` ordering within one file.

**2. No dict key enumeration.** `store_keys` solved enumeration for stores;
dicts have no equivalent `map_keys`. This is not cosmetic: it changed the
public API. `/api/projects` returns a list of `{name, count}` records rather
than the natural `{name: count}` object, purely because a client written in
HowlFrame could not iterate the keys of the object it received.

**3. `map_get` on a missing key returns `""`, not the nil sentinel.** Only
`store_get` pushes a real nil. So `is_nil` is the correct absence test for
store reads and the *incorrect* one for dict reads, where `(= x "")` is
required. Two different absence idioms for two lookups that read identically at
the call site. This produced the single hardest bug of the build: the fixture
loader failed with `map_get expected dict, got string` because a missing
`approval` key returned `""` and `is_nil` reported false.

**4. `map_get` and `list_get` require a symbol, not an expression.** Nested
access cannot chain: `(map_get (map_get m "authority") "decision")` is rejected
with `map_get requires a symbol for dict`. Every level of nesting costs a `let`.
This is the dominant source of indentation depth in both tiers.

**5. Branch type unification forbids the early-return idiom.**
`(if c (return "x") (do))` fails with
`if branches have incompatible types string and void`. Every helper must
therefore accumulate into a variable and return once at the end. This is
survivable and is what `release_authority.howl` already does, but it is a
pattern the language forces rather than one you choose.

**6. No string length.** There is `list_len` but no `str_len`, so padding a
sequence number for sortable keys is not expressible without splitting the
string. HowlBoard sidesteps it by keeping the audit feed as one insertion-
ordered list rather than individually keyed events.

**7. No sort primitive.** With `store_keys` sorted at the VM level this is
survivable, but any ordering not achievable by key sort or insertion order is
out of reach. It is why the timeline is a single append-only list rather than
per-mission records merged on read.

**8. No HTML escaping primitive**, in a language whose JS backend is built
around `set_html`. HowlBoard implements `esc` from `str_split`/`str_join`,
which works and is verified against an injection attempt, but every `web_app`
author has to know to do this, and the obvious code is unsafe. Given that
`set_text` escapes and `set_html` does not, an `escape_html` builtin would be
a proportionate addition.

**9. HTTP request surface is body-only.** No query parameters, no path
parameters, and no `req_header` opcode — despite the `howlframe-app-development`
skill documenting `(req_header req "Header-Name")` as available. Combined with
literal-path-only routing, every addressable operation must be a POST carrying
JSON, including reads. `/api/missions/get` takes an id in a body.

**10. `http_server`'s port is a compile-time literal.** It cannot be read from
`env`, so the port is fixed in source and tests must agree with it.

**11. `to_string` of a JSON null yields `"<nil>"`.** The ledger importer has to
filter that string explicitly, because recording it as a verification status
would invent a result that never existed.

**12. `/` is float division.** `(/ 7325 3600)` is `2.0347...`, so every integer
division needs an explicit `to_int`.

**13. `export` does not do what its name suggests in a `web_app`.** It is a
module construct expecting two children; `(export "name" fn)` is silently
dropped. Inline handlers work only because top-level function declarations in a
classic script are already globals. Silently discarding a three-child `export`
is a trap.

**14. The committed `codegen` binary at the HowlFrame repository root is
stale.** Running it regenerates `docs/reference/*` *without* `encode_json` and
`time_now`, silently reverting the published construct matrix. The working tree
was in that state when this work started. `go run ./cmd/codegen` is correct;
the stale binary should not be committed.

## Honest assessment

HowlFrame supported this application, but not comfortably, and not without
being changed first. One of the six framework changes was a hard blocker: the
mission model was inexpressible until dicts could hold mixed values. Two more
were bugs that made generated browser code fail to load — which means, plainly,
that **no `web_app` had been executed end to end before now**. Compilation was
being mistaken for correctness.

What holds up well is the part the project claims as its thesis. Capability
boundaries are real, enforced, and pleasant to reason about. Per-request
isolation is correct. The store is sufficient. Fail-closed target checking
works. After the handler fix, failures are visible instead of silent.

What does not hold up is the ergonomics of expressing a non-trivial data model.
The absence of modules, chained accessors, and dict enumeration are not
polish items; they set a practical ceiling on application size that HowlBoard
is already pressing against at roughly 1,500 lines across two files. The two-idiom
absence check (`is_nil` for stores, `= ""` for dicts) is a correctness trap
rather than an inconvenience.

The honest summary is that HowlFrame is a credible bounded-execution platform
with a language that is not yet comfortable for application-sized programs.
This exercise made it meaningfully better in both respects, and the reason it
could is that the application was real enough to fail against.
