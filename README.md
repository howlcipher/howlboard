# HowlBoard

**HowlBoard** is the flagship external consumer and reference application for **HowlFrame**.

It is a full-stack, deterministic board application (Task Manager/Kanban) entirely built using HowlFrame for both the frontend (`web_app`) and the backend (`server`).

**[View the GitHub Pages Documentation & Demo](https://howlcipher.github.io/howlboard/)**

## Purpose

The goal is **not** to create just another generic task-management application. 

The real goal is to use HowlBoard to prove how much of a legitimate full-stack application can be built with HowlFrame. We use HowlBoard to discover genuine missing primitives, compiler bugs, and usability friction, and we use that feedback loop to improve HowlFrame itself.

See `docs/dogfooding.md` for a running journal of how HowlBoard has exposed bugs and limitations, and how they were resolved in HowlFrame.

## Architecture

HowlBoard enforces a strict, deterministic state machine policy for tasks (`BACKLOG` -> `READY` -> `IN_PROGRESS` -> `BLOCKED`/`DONE`). This deterministic policy is implemented in the backend `server.howl` file using HowlFrame's native AST and HTTP capabilities.

* **Frontend:** `frontend/app.howl` compiles via HowlFrame's JS backend into `frontend/app.js`, making native DOM calls.
* **Backend:** `backend/server.howl` compiles into `server.hfbc` and runs on the HowlFrame Bytecode VM using the `memory://howlboard` native store.

## Getting Started

To build and run the live application:

1. You must have the [HowlFrame](https://github.com/howlcipher/howlframe) repository cloned alongside this one.
2. Build the HowlFrame binary:
   ```bash
   cd ../howlframe
   go build -o ../howlboard/howlframe_bin howlframe.go
   ```
3. Build the frontend and backend:
   ```bash
   cd ../howlboard
   make build
   ```
4. Run the backend VM:
   ```bash
   make run
   ```
5. In a separate terminal, serve the frontend:
   ```bash
   make run-frontend
   ```

The application will be accessible via localhost.
