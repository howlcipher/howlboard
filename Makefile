HOWLFRAME_BIN ?= ./howlframe_bin
PORT ?= 8080
FRONTEND_PORT ?= 3000

.PHONY: build test run run-frontend seed import pages-data clean

## Compile both tiers plus the ledger import tool through HowlFrame.
build:
	mkdir -p build
	$(HOWLFRAME_BIN) frontend/app.howl -o frontend
	$(HOWLFRAME_BIN) -compile-bc backend/server.howl -o backend/server.hfbc
	$(HOWLFRAME_BIN) -compile-bc tools/ledger_import/ledger_import.howl -o build/ledger_import.hfbc

## Black-box contract tests against the real compiled bytecode server.
test: build
	cd backend && go test -count=1 ./...

## Run the mission API. Capabilities are explicit and minimal.
run: build
	$(HOWLFRAME_BIN) -run-bc -allow-caps network,database,filesystem backend/server.hfbc

## Serve the compiled interface.
run-frontend:
	python3 -m http.server $(FRONTEND_PORT) -d frontend

## Load the demo missions into a running server.
seed:
	curl -s -X POST http://localhost:$(PORT)/api/seed

## Project a HowlPlane evidence-ledger slice into missions. Stop the server
## first: it holds the store in memory and would overwrite the import.
##   make import LEDGER=/path/to/slice.jsonl MAX=3000
LEDGER ?= data/fixtures/ledger_slice.jsonl
MAX ?= 2000
import: build
	$(HOWLFRAME_BIN) -run-bc -allow-caps filesystem,database \
		-max-instructions 200000000 build/ledger_import.hfbc $(LEDGER) $(MAX)

## Sync the published demo's data with the fixtures the application loads, so
## the GitHub Pages showcase cannot drift from the product it illustrates.
pages-data:
	cp data/fixtures/missions.json docs/missions.json

clean:
	rm -f frontend/app.js frontend/app.test.js backend/server.hfbc
	rm -rf build
	rm -f howlboard_missions.json howlboard_timeline.json
