#!/usr/bin/env python3
"""Exercise the browser flow against a candidate HowlFrame binary."""

import os
import signal
import subprocess
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
HOWLFRAME = os.environ.get("HOWLFRAME_BIN", "howlframe")
ARTIFACT = ROOT / "build" / "howlboard.hfbc"


def wait_for(url: str) -> None:
    for _ in range(40):
        try:
            with urllib.request.urlopen(url, timeout=0.25):
                return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError(f"server did not become ready: {url}")


def main() -> None:
    backend = subprocess.Popen(
        [HOWLFRAME, "run", "--allow-caps", "network,database", str(ARTIFACT)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    frontend = subprocess.Popen(
        ["python3", "-m", "http.server", "3000", "-d", "frontend"],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        wait_for("http://127.0.0.1:8080/api/tasks")
        wait_for("http://127.0.0.1:3000")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page()
            errors: list[str] = []
            page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
            page.goto("http://127.0.0.1:3000", wait_until="networkidle")
            assert "Learn HowlFrame" in page.locator("#tasks").inner_text()
            page.locator("#new-task-title").fill("Ship browser flow")
            page.locator("#create-btn").click()
            page.locator("#tasks").get_by_text("Ship browser flow").wait_for()
            page.locator("#task-id").fill("3")
            page.locator("#complete-btn").click()
            page.locator("#tasks").get_by_text("Ship browser flow (done)").wait_for()
            assert not errors, errors
            browser.close()
    finally:
        for process in (frontend, backend):
            if process.poll() is None:
                process.send_signal(signal.SIGTERM)
                process.wait(timeout=5)


if __name__ == "__main__":
    main()
