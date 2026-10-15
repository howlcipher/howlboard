#!/usr/bin/env python3
"""Render real audit details and require readable, untruncated narrow layouts."""

import json
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent


def main():
    mission = json.loads((ROOT / 'data/fixtures/missions.json').read_text())['missions'][0]
    details = [
        'Published https://github.com/howlcipher/howlchangeops/releases/tag/v0.1.0',
        'Artifact sha256:' + 'a' * 128,
    ]
    mission['timeline'] = [
        {'action': 'release_publication_recorded', 'actor': 'test_fixture',
         'timestamp': 1788791852, 'detail': detail}
        for detail in details
    ]
    compiler = os.environ.get('HOWLFRAME_BIN', str(ROOT / 'howlframe_bin'))
    with tempfile.TemporaryDirectory() as directory:
        subprocess.run(
            [compiler, 'build', str(ROOT / 'frontend/render_harness.howl'),
             '--target=js', '-o', directory], check=True, cwd=ROOT,
        )
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                for width in (390, 1280):
                    page = browser.new_page(viewport={'width': width, 'height': 844})
                    page.set_content('<main><div id="mission-detail"></div></main>')
                    page.add_style_tag(path=str(ROOT / 'frontend/styles.css'))
                    page.add_script_tag(path=str(Path(directory) / 'app.js'))
                    page.evaluate('''async mission => {
                        document.querySelector('#mission-detail').innerHTML =
                            await render_detail_html(mission);
                    }''', mission)
                    rendered = page.locator('.timeline-row .item-sub')
                    assert rendered.all_text_contents() == details
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (
                        f'audit detail overflows at {width}px'
                    )
                    for element in rendered.all():
                        assert element.evaluate('''element => {
                            const rect = element.getBoundingClientRect();
                            if (rect.width <= 0 || rect.left < 0 || rect.right > innerWidth
                                || getComputedStyle(element).textOverflow === 'ellipsis') return false;
                            const range = document.createRange();
                            range.selectNodeContents(element);
                            const lines = Array.from(range.getClientRects());
                            for (const line of lines) {
                                if (line.left < 0 || line.right > innerWidth) return false;
                                for (let node = element; node; node = node.parentElement) {
                                    const style = getComputedStyle(node);
                                    const box = node.getBoundingClientRect();
                                    if (/(hidden|clip|scroll|auto)/.test(style.overflowX)
                                        && (line.left < box.left || line.right > box.right)) return false;
                                    if (/(hidden|clip|scroll|auto)/.test(style.overflowY)
                                        && (line.top < box.top || line.bottom > box.bottom)) return false;
                                }
                            }
                            return lines.length > 0;
                        }'''), 'audit detail clipped or outside viewport'
                    page.close()
            finally:
                browser.close()
    print('PASS: shared audit renderer preserves long URLs/digests at mobile and desktop widths')


if __name__ == '__main__':
    main()
