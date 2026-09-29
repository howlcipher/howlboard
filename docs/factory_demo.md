# Factory surface demo

HowlBoard reads a redacted Factory snapshot and previews one exact `Pending`
backlog row. It does not start Factory, take the supervisor lock, or write a
queue. `owner_direction` is not an admit path.

## Status, including the missing file

1. `make build && make run`, then `make run-frontend` in another terminal.
2. Open http://localhost:3000 and find the Factory panel.
3. With nothing at `data/factory/status/remote-snapshot.json`, the panel
   reports provenance `ABSENT` and reason `SNAPSHOT_ABSENT`. State is unknown.
   That is the state until the Factory host publishes Plane's
   `factory/status/remote-snapshot.json` (`howlplane.factory.status/v1`).
4. Click **Preview fixture snapshot** to render
   `data/fixtures/factory/remote-snapshot.json`. The badge says `FIXTURE`.
   This is not a host publish.
5. To show a real projection, copy a redacted snapshot to
   `data/factory/status/remote-snapshot.json` and click **Refresh factory
   status**. A file that is not marked redacted, or that uses another schema,
   is refused.

## Pending row

The form is filled with Plane's example row. Click **Preview Pending row**.
The status cell is exactly `Pending`:

```
| 91011 | [Publish redacted factory status](#91011-publish-redacted-factory-status) | Pending | 2.0 (4x1/2) | Remote operators cannot see the live campaign. |
```

Paste that row under the first `## Ranked Backlog` heading in `issues.md`,
`bugs.md`, or `improvements.md` of a repository the campaign already watches,
then open a pull request. Factory discovers it only after the host checkout
contains the commit. A score below `0.5` is previewed and marked ineligible.
`Pending — blocked on #88` is not what this helper emits, and BacklogSource
would not admit it.
