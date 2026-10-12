#!/usr/bin/env python3
"""Read-only browser smoke against an already running isolated HowlBoard."""

import argparse
import json
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:3000")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if urlsplit(args.url).hostname not in {"localhost", "127.0.0.1", "::1"}:
        parser.error("use a local isolated application URL")
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            viewports = [("desktop", 1280, 900), ("mobile", 390, 844)]
            for label, width, height in viewports:
                page = browser.new_page(
                    viewport={"width": width, "height": height}
                )
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                with page.expect_response(
                    lambda response: "/api/missions" in response.url,
                    timeout=15000,
                ) as response:
                    page.goto(args.url, wait_until="networkidle")
                assert response.value.status == 200, "mission API failed"
                missions = response.value.json()["missions"]
                if missions:
                    page.locator(".mission-row").first.wait_for()
                    row_count = page.locator(".mission-row").count()
                    assert row_count == len(missions)
                else:
                    assert page.locator("#mission-list").inner_text().strip()
                error_text = page.locator("#error").inner_text()
                assert error_text == "", error_text
                assert not errors, errors
                assert not page.evaluate(
                    "document.documentElement.scrollWidth > innerWidth"
                ), "horizontal overflow"
                page.keyboard.press("Tab")
                assert page.evaluate(
                    "document.activeElement.tagName !== 'BODY'"
                ), "keyboard focus did not reach a control"
                page.screenshot(
                    path=str(args.output / f"{label}.png"), full_page=True
                )
                results.append({
                    "viewport": [width, height], "api_status": 200,
                    "missions_rendered": len(missions),
                    "page_errors": errors,
                    "mission_text": page.locator("#mission-list").inner_text(),
                })
                page.close()
        finally:
            browser.close()
    report = json.dumps(results, indent=2) + "\n"
    (args.output / "result.json").write_text(report)
    print("PASS: desktop/mobile API loading, keyboard focus, and layout")


if __name__ == "__main__":
    main()
