# Factory surface demo

HowlBoard reads a redacted Factory snapshot and previews one exact `Pending`
backlog row. It does not start Factory, take the supervisor lock, or write a
queue. `owner_direction` is not an admit path.

## Status, including the live Plane tip

1. `make build && make run`, then `make run-frontend` in another terminal.
2. Open http://localhost:3000 and find the Factory panel.
3. Click **Refresh factory status** (or load the page). Published status prefers
   the optional local drop at `data/factory/status/remote-snapshot.json`. When
   that file is absent, Board fetches Plane's Git tip:

   `https://raw.githubusercontent.com/howlcipher/howlplane/main/factory/status/remote-snapshot.json`

   Provenance is `PUBLISHED`, `read_channel` is `plane_git`, and `tip_sha` is
   the howlplane `main` tip (JSON `sha` or commits page scrape; override with `HOWLBOARD_FACTORY_TIP_URL`). Schema must be
   `howlplane.factory.status/v1` with `redacted: true`.
4. If both the local drop and the Plane tip are missing or unreadable, the
   panel reports provenance `ABSENT` and reason `SNAPSHOT_ABSENT`. State is
   unknown. Nothing was started.
5. Click **Preview fixture snapshot** to render
   `data/fixtures/factory/remote-snapshot.json`. The badge says `FIXTURE`.
   This is not a host publish.
6. An operator may still copy a redacted snapshot into the local drop to
   override the Git tip for offline work. A file that is not marked redacted,
   or that uses another schema, is refused.

Override URLs for tests (optional, needs `environment` capability):

- `HOWLBOARD_FACTORY_SNAPSHOT_URL`
- `HOWLBOARD_FACTORY_TIP_URL` (JSON object with a `sha` field)

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
