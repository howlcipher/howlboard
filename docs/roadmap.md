# Roadmap

Ordered by what most limits the product today.

## Next

**Real ChangeOps approvals.** Replace HowlBoard's local grant with the
HowlChangeOps approval path: an HMAC-SHA256 signature over a decision digest,
with verification on read. This makes `ENVELOPE_TAMPERED` meaningful and turns
the authority display from an honest local claim into a verifiable one.

**Timestamps on imported missions.** The ledger carries ISO-8601 strings and the
language has no date parsing, so imported missions currently have no usable
times. Either add a date primitive to HowlFrame or have the importer accept
pre-normalized epoch seconds.

**Richer ledger projection.** Reconstruct plans, gates and decision records
where the ledger supports it, and lift the 25-item evidence cap with pagination
rather than truncation.

## After that

**Streaming updates.** The interface polls on demand. A long-lived connection
would make it genuinely live, and is the difference between a board and a
console.

**Mission origination through HowlPlane.** Today HowlBoard can create a mission
locally. The intended flow is human mission → HowlBoard → HowlPlane → agent
selection → HowlChangeOps → execution → verification → HowlRelay → HowlBoard.
Building the outbound leg is the first real step toward that.

**Pagination and search.** Required before the interface can face a real ledger
rather than a slice.

**Dependencies.** `depends_on` exists in the model and is neither populated nor
rendered.

## Framework work this depends on

From [the dogfooding findings](dogfooding.md), in order of impact:

1. **Module support in the bytecode target.** The single largest constraint.
   `backend/server.howl` is one 665-line file and `frontend/app.howl` is 824,
   because `module`/`use`/`import`/`export` are all unsupported there. Nothing
   about HowlBoard grows comfortably until this exists.
2. **Dict key enumeration (`map_keys`).** Its absence changed a public API
   shape: `/api/projects` returns a list of records rather than a keyed object
   purely because a HowlFrame client cannot iterate an object's keys.
3. **One absence idiom.** `map_get` returns `""` for a missing key while
   `store_get` returns a nil sentinel, so `is_nil` is correct for one and wrong
   for the other. This produced the hardest bug of the build and will produce
   more.
4. **Chained accessors.** `(map_get (map_get m "a") "b")` is rejected; every
   level of nesting costs a `let`. This is the dominant source of indentation
   in both tiers.
5. **`escape_html`.** The JS backend is built around `set_html`, which does not
   escape. The obvious code is unsafe and every author must know to write their
   own escaper.
6. **Date/time primitives.** Blocking the ledger timestamp work above.
7. **A sort primitive.** Needed for any ordering not achievable by key sort or
   insertion order.
