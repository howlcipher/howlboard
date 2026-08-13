#!/usr/bin/env bash
set -euo pipefail

howlframe_bin="${HOWLFRAME_BIN:-howlframe}"
artifact_dir="$(mktemp -d)"
artifact="$artifact_dir/howlboard.hfbc"
server_log="$artifact_dir/server.log"

cleanup() {
  if [[ -n "${server_pid:-}" ]] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid"
    wait "$server_pid" || true
  fi
}
trap cleanup EXIT

"$howlframe_bin" check backend/server.howl
"$howlframe_bin" build backend/server.howl -o "$artifact"
"$howlframe_bin" check frontend/app.howl
"$howlframe_bin" frontend/app.howl -o frontend
node --check frontend/app.js

"$howlframe_bin" run --allow-caps network,database "$artifact" >"$server_log" 2>&1 &
server_pid=$!

for _ in $(seq 1 40); do
  if curl --silent --fail http://127.0.0.1:8080/api/tasks >/dev/null; then
    break
  fi
  sleep 0.1
done

initial_tasks="$(curl --silent --fail http://127.0.0.1:8080/api/tasks)"
node -e 'const body = JSON.parse(process.argv[1]); if (!Array.isArray(body.tasks) || body.tasks.length !== 2 || body.tasks[0].status !== "open") process.exit(1)' "$initial_tasks"

created_task="$(curl --silent --fail --request POST http://127.0.0.1:8080/api/tasks --data '{"title":"Ship v0.1.1"}')"
node -e 'const body = JSON.parse(process.argv[1]); if (body.id !== "3" || body.title !== "Ship v0.1.1" || body.status !== "open") process.exit(1)' "$created_task"

completed_task="$(curl --silent --fail --request POST http://127.0.0.1:8080/api/tasks/complete --data '{"id":"3"}')"
node -e 'const body = JSON.parse(process.argv[1]); if (body.id !== "3" || body.status !== "done") process.exit(1)' "$completed_task"

listed_tasks="$(curl --silent --fail http://127.0.0.1:8080/api/tasks)"
node -e 'const body = JSON.parse(process.argv[1]); const task = body.tasks.find((item) => item.id === "3"); if (!task || task.status !== "done") process.exit(1)' "$listed_tasks"

malformed_status="$(curl --silent --output "$artifact_dir/malformed.json" --write-out '%{http_code}' --request POST http://127.0.0.1:8080/api/tasks --data '{bad json}')"
[[ "$malformed_status" == "400" ]]
node -e 'const body = JSON.parse(process.argv[1]); if (body.error !== "invalid_json") process.exit(1)' "$(<"$artifact_dir/malformed.json")"

missing_title_status="$(curl --silent --output "$artifact_dir/missing-title.json" --write-out '%{http_code}' --request POST http://127.0.0.1:8080/api/tasks --data '{}')"
[[ "$missing_title_status" == "400" ]]
node -e 'const body = JSON.parse(process.argv[1]); if (body.error !== "title_required") process.exit(1)' "$(<"$artifact_dir/missing-title.json")"

unknown_task_status="$(curl --silent --output "$artifact_dir/unknown-task.json" --write-out '%{http_code}' --request POST http://127.0.0.1:8080/api/tasks/complete --data '{"id":"999"}')"
[[ "$unknown_task_status" == "404" ]]
node -e 'const body = JSON.parse(process.argv[1]); if (body.error !== "not_found") process.exit(1)' "$(<"$artifact_dir/unknown-task.json")"

method_status="$(curl --silent --output "$artifact_dir/method.json" --write-out '%{http_code}' --request DELETE http://127.0.0.1:8080/api/tasks)"
[[ "$method_status" == "405" ]]
node -e 'const body = JSON.parse(process.argv[1]); if (body.error !== "method_not_allowed") process.exit(1)' "$(<"$artifact_dir/method.json")"

options_headers="$(curl --silent --include --request OPTIONS http://127.0.0.1:8080/api/tasks)"
[[ "$options_headers" == *"Access-Control-Allow-Origin: *"* ]]
[[ "$options_headers" == *"Access-Control-Allow-Methods: GET, POST, OPTIONS"* ]]
