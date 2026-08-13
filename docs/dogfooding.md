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
