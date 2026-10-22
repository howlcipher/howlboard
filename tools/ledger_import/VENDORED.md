# Vendored: EvidenceDesk ledger module

`evidence_ledger.howl` is a byte-identical copy of HowlFrame's EvidenceDesk
ledger module. Do not edit it here; change it upstream and re-vendor.

| Field | Value |
|---|---|
| Upstream repository | https://github.com/howlcipher/howlframe |
| Upstream path | `milestone3/evidencedesk/app/ledger.howl` |
| Upstream commit | `9dbd8175` (branch `feat/evidencedesk-ledger-parse-within`, adds `parse_within`) |
| SHA-256 | `aacde2501430bf7b34a05a36e3de468bc667af757a37a78cd5328c8498e52d55` |

`backend/ledger_import_test.go` (`TestVendoredLedgerModuleUnchanged`) fails if
the file's SHA-256 differs from the value above. When re-vendoring, update the
commit and hash together, and rerun the ledger import tests.

`ledger_import.howl` uses `parse_within` with HowlBoard's own ceilings (`MAX`
entries, 3 MiB). EvidenceDesk itself keeps `parse` and its frozen 262144-byte
ceiling. The module's validation is a bounded subset of the HowlPlane schema
(`schema`, the four identifiers, unique `entry_id`); it does not validate the
other fields.
