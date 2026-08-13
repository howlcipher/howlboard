HOWLFRAME_BIN ?= howlframe
BACKEND_ARTIFACT ?= build/howlboard.hfbc

.PHONY: all check build backend frontend run run-frontend test browser-test clean

all: build

check:
	$(HOWLFRAME_BIN) check backend/server.howl
	$(HOWLFRAME_BIN) check frontend/app.howl

build: backend frontend

backend:
	mkdir -p build
	$(HOWLFRAME_BIN) build backend/server.howl -o $(BACKEND_ARTIFACT)

frontend:
	# v0.1's documented JavaScript compatibility backend emits app.js. Its
	# public `build` subcommand is intentionally HFBC-only.
	$(HOWLFRAME_BIN) frontend/app.howl -o frontend

run: backend
	$(HOWLFRAME_BIN) run --allow-caps network,database $(BACKEND_ARTIFACT)

run-frontend: frontend
	python3 -m http.server 3000 -d frontend

test:
	HOWLFRAME_BIN=$(HOWLFRAME_BIN) ./tests/http_integration.sh

browser-test: build
	HOWLFRAME_BIN=$(HOWLFRAME_BIN) python3 tests/browser_flow.py

clean:
	rm -rf build frontend/app.js frontend/app.test.js
