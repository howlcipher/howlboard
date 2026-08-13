HOWLFRAME_BIN ?= ./howlframe_bin

.PHONY: all build run run-frontend clean

all: build

build:
	@echo "Building frontend..."
	$(HOWLFRAME_BIN) frontend/app.howl -o frontend
	@echo "Building backend..."
	$(HOWLFRAME_BIN) -compile-bc backend/server.howl -o backend/server.hfbc

run:
	@echo "Running backend on port 8080..."
	$(HOWLFRAME_BIN) -run-bc -allow-caps network,database backend/server.hfbc

run-frontend:
	@echo "Serving frontend on port 3000..."
	python3 -m http.server 3000 -d frontend

clean:
	rm -f frontend/app.js frontend/app.test.js backend/server.hfbc
