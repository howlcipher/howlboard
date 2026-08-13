# External Consumer Maturation
- Diagnosed contract mismatch: backend was returning a list of tasks while the frontend expected a JSON object with a "tasks" array.
- Solved the mismatch by rewriting the backend in HowlFrame to return `{"tasks": [...]}` and setting up CORS.
- Developed a functionally complete `web_app` frontend logic for tasks using native HowlFrame DOM queries.
- Bypassed HowlFrame bytecode VM bug involving `res` argument popping count by using `res_json` for 204 OPTIONS.
- Added GitHub Actions CI workflow to check HowlFrame scripts.

## Test Results
- `howlframe check backend/server.howl` -> OK
- `howlframe check frontend/app.howl` -> OK
- Curl test to create a task -> {"id":"1","status":"open","title":"Test Task"}
- Curl test to fetch tasks -> {"tasks":[{"id":"1","status":"open","title":"Test Task"}]}
- Curl test for OPTIONS request -> Returns 204 with CORS headers.
- Curl test to complete task -> {"id":"1","status":"done","title":"Test Task"}
