# Roadmap

Ordered by what most limits the product today.

## Next

**Read the published Factory artifact from Git.** The status panel reads a
local drop of `factory/status/remote-snapshot.json`. Once the Factory host
publishes that file, Board can fetch the Plane copy directly. That is still a
read. It is not a second Factory and it is not a new admit path.



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

**Dependencies beyond navigable informational links.** `depends_on` can be set
on create and is rendered in the shared mission view as navigable informational
controls. Still out of scope: execution ordering, cross-mission authority,
cycle detection, HowlPlane scheduling, completion gates, ChangeOps approval
propagation, and graph visualization.

## Framework work this depends on

From [the dogfooding findings](dogfooding.md), in order of impact:

1. **Module support in the bytecode target.** The single largest constraint.
   `backend/server.howl` is one 665-line file because `module`/`use`/`export`
   are unsupported there. The browser tier does not have this problem — modules
   work for the JavaScript backend, and the interface is split across
   `app.howl` and `mission_view.howl` — which makes the gap on the bytecode
   target, the tier the security story rests on, the more conspicuous.
2. **Dict key enumeration (`map_keys`).** Frame now has it. Factory status
   uses it to copy allowlisted blocker and text fields and drop the rest.
   `/api/projects` is still a list of records; that public shape was not
   changed in the factory dogfood.
3. **One absence idiom.** `map_get` returns `""` for a missing key while
   `store_get` returns a nil sentinel. Factory status uses `blank` for the
   `""` / JSON-null case and leaves `is_nil` on store reads. Mission code
   still has both checks inline.
4. **Chained accessors.** `(map_get (map_get doc "commit") "sha")` works.
   Factory tip lock uses it after an absence check. The rest of the program
   still binds intermediate dicts with `let`.
5. **`html_escape` / `attr_escape`.** The Factory panel uses them. Mission
   rendering still uses the hand-rolled `esc`. HTML encoding is still not a
   JavaScript encoder; handler bodies stay constant strings.
6. **Date/time primitives.** Blocking the ledger timestamp work above.
7. **A sort primitive.** Needed for any ordering not achievable by key sort or
   insertion order.
