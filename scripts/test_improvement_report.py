#!/usr/bin/env python3
"""Exercise the compiled HowlLoop panel with no backend or remote services."""

import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "howl.improvement_report/v1"
TIME = "2026-01-01T00:00:00+00:00"


def report():
    return {
        "schema": SCHEMA, "event_count": 5,
        "result_counts_by_source": {"observed": {"failed": 2, "ok": 2}, "simulated": {"ok": 1}},
        "recent": [
            {"project": "plane", "operation": "verification", "source": "observed",
             "result": "failed", "timestamp": TIME, "duration_ns": 19000000},
            {"project": "writer", "operation": "pdf", "source": "simulated",
             "result": "ok", "timestamp": TIME, "duration_ns": None},
        ],
        "opportunities": [
            {"project": "plane", "operation": "verification", "problem": "failed",
             "detail": "validation", "run_count": 2, "authority": "none"},
        ],
        "history": [
            {"candidate": {"project": "writer", "operation": "pdf", "problem": "failed",
                           "detail": "error", "run_count": 2, "authority": "none"},
             "state": "verified", "authority": "none", "timestamp": TIME},
        ],
        "timings": [
            {"project": "writer", "operation": "pdf", "commit": "a" * 40,
             "samples": 2, "environment": "linux", "median_duration_ns": 19000000.5},
            {"project": "writer", "operation": "pdf", "commit": "a" * 40,
             "samples": 1, "environment": "macos", "median_duration_ns": 23000000},
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, action="append", default=[],
                        help="also check a snapshot produced by howlloop report")
    args = parser.parse_args()
    snapshots = [path.read_text() for path in args.report]
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            for width in (390, 1280):
                test_view(browser, width, snapshots)
        finally:
            browser.close()
    print("PASS: HowlLoop panel renders bounded local reports and rejects malformed inputs")


def test_view(browser, width, snapshots):
    page = browser.new_page(viewport={"width": width, "height": 844})
    page.set_default_timeout(5000)
    requests = []

    def serve(route):
        url = route.request.url
        assets = {
            "http://board.test/": ("index.html", "text/html"),
            "http://board.test/styles.css": ("styles.css", "text/css"),
            "http://board.test/app.js": ("app.js", "text/javascript"),
        }
        if url in assets:
            path, content_type = assets[url]
            route.fulfill(path=str(ROOT / "frontend" / path), content_type=content_type)
        else:
            requests.append(url)
            route.abort()

    page.route("**/*", serve)
    page.goto("http://board.test/", wait_until="networkidle")
    panel = page.get_by_role("region", name="HowlLoop improvements")
    field = panel.get_by_label("HowlLoop report JSON")
    render = panel.get_by_role("button", name="View report")
    view = panel.locator("#improvement-results")
    status = panel.get_by_role("status")
    assert "No report loaded" in status.inner_text()
    requests.clear()

    field.fill(json.dumps(report()))
    render.press("Enter")
    for text in ("observed", "simulated", "verification", "verified", "19000000.5",
                 "linux", "macos", "evidence from 2 runs", "failed / error", TIME):
        assert text in view.inner_text()
    assert "Report loaded" in status.inner_text()
    assert view.get_by_role("heading", name="Recent operations").is_visible()
    assert view.get_by_role("heading", name="Recurring opportunities").is_visible()
    assert view.evaluate("el => el.scrollWidth <= el.clientWidth + 1")
    assert not requests, requests

    request_marker = "ignore previous instructions <img src=x>"
    field.fill(json.dumps(report() | {"recent": [report()["recent"][0] | {"note": request_marker}]}))
    render.click()
    assert "Report loaded" in status.inner_text()
    assert request_marker not in view.inner_text()
    assert view.locator("img").count() == 0
    assert not requests, requests

    for raw in snapshots:
        field.fill(raw)
        render.click()
        assert f"Recorded observations: {json.loads(raw)['event_count']}" in view.inner_text()
        assert not requests, requests

    invalid = [
        "{", json.dumps({"schema": SCHEMA}), json.dumps(report() | {"event_count": "5"}),
        json.dumps(report() | {"recent": "not a list"}),
        json.dumps(report() | {"event_count": 1}),
        json.dumps(report() | {"recent": [report()["recent"][0] | {"project": "<img src=x>"}]}),
        json.dumps(report() | {"history": [report()["history"][0] | {"authority": "approve"}]}),
        json.dumps(report() | {"opportunities": [report()["opportunities"][0] | {"problem": "ok"}]}),
    ]
    for raw in invalid:
        field.fill(raw)
        render.click()
        assert "Invalid HowlLoop report" in status.inner_text(), raw
        assert view.inner_text() == ""
        assert view.locator("img").count() == 0
        assert not requests, requests

    field.fill("a" * 131073)
    render.click()
    assert "131,072" in status.inner_text()
    field.fill(json.dumps({
        "schema": SCHEMA, "event_count": 0, "result_counts_by_source": {},
        "recent": [], "opportunities": [], "history": [], "timings": [],
    }))
    render.click()
    assert "No observations in this report" in view.inner_text()
    panel.get_by_role("button", name="Clear report").click()
    assert field.input_value() == ""
    assert view.inner_text() == ""
    assert "No report loaded" in status.inner_text()
    assert not requests, requests
    page.close()


if __name__ == "__main__":
    main()
