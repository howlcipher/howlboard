HOWLFRAME_BIN ?= $(shell if [ -x ./howlframe_bin ]; then echo ./howlframe_bin; elif command -v howlframe >/dev/null 2>&1; then command -v howlframe; else echo ./howlframe_bin; fi)
FETCH_CAPS ?= network:fetch=raw.githubusercontent.com,network:fetch=github.com
PORT ?= 8080
FRONTEND_PORT ?= 3000

.PHONY: build test run run-frontend seed import pages-data clean

## Compile both tiers plus the ledger import tool through HowlFrame.
build:
	mkdir -p build
	$(HOWLFRAME_BIN) build frontend/app.howl --target=js -o frontend
	$(HOWLFRAME_BIN) -compile-bc backend/server.howl -o backend/server.hfbc
	$(HOWLFRAME_BIN) -compile-bc tools/ledger_import/ledger_import.howl -o build/ledger_import.hfbc
	@# The published showcase is compiled from .howl too, importing the same
	@# rendering module as the interface. The JS backend names its output
	@# app.js, so it is renamed to sit beside the site's own script.js.
	$(HOWLFRAME_BIN) build docs/demo.howl --target=js -o docs
	mv docs/app.js docs/demo.js

## Black-box contract tests against the real compiled bytecode server.
test: build
	cd backend && go test -count=1 ./...

## Run the mission API. Capabilities are explicit and minimal.
run: build
	$(HOWLFRAME_BIN) -run-bc -allow-caps network,database,filesystem,environment,$(FETCH_CAPS) backend/server.hfbc

## Serve the compiled interface.
run-frontend:
	python3 -m http.server $(FRONTEND_PORT) -d frontend

## Load the demo missions into a running server.
seed:
	@test -n "$$HOWLBOARD_WRITE_TOKEN" || { echo 'HOWLBOARD_WRITE_TOKEN is required' >&2; exit 1; }
	@printf 'Authorization: Bearer %s\n' "$$HOWLBOARD_WRITE_TOKEN" | curl --fail --silent --show-error --header @- -X POST http://localhost:$(PORT)/api/seed

## Project a HowlPlane evidence-ledger slice into missions. Stop the server
## first: it holds the store in memory and would overwrite the import.
##   make import LEDGER=/path/to/slice.jsonl MAX=3000
## The slice is validated whole before anything is written; MAX is an exact
## ceiling and the file may be at most 3 MiB. The memory budget is the VM's
## cumulative allocation charge, sized so a 3 MiB slice of ordinary records fits.
LEDGER ?= data/fixtures/ledger_sample.jsonl
MAX ?= 2000
import: build
	$(HOWLFRAME_BIN) -run-bc -allow-caps filesystem,database \
		-max-instructions 200000000 -max-memory-bytes 268435456 \
		build/ledger_import.hfbc $(LEDGER) $(MAX)

## Sync the published demo's data with the fixtures the application loads, so
## the GitHub Pages showcase cannot drift from the product it illustrates.
pages-data:
	cp data/fixtures/missions.json docs/missions.json

clean:
	rm -f frontend/app.js frontend/app.test.js backend/server.hfbc docs/demo.js docs/app.js
	rm -rf build
	rm -f howlboard_missions.json howlboard_timeline.json
