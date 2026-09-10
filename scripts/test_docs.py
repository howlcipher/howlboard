#!/usr/bin/env python3
"""Guards the published documentation against drifting from the implementation.

The published site previously documented a `can_transition` policy function
that did not exist, with a transition table that contradicted the backend on
three edges, and referenced CSS classes that were never defined. Each check
here corresponds to a defect that actually shipped.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAILURES = []


def check(name, condition, detail=""):
    if condition:
        print(f"PASS  {name}")
    else:
        print(f"FAIL  {name}{': ' + detail if detail else ''}")
        FAILURES.append(name)


def main():
    index = (ROOT / "docs" / "index.html").read_text()
    style = (ROOT / "docs" / "style.css").read_text()
    server = (ROOT / "backend" / "server.howl").read_text()

    # 1. Every transition shown in the docs must exist in the backend.
    pattern = r'\(= from "(\w+)"\) \(= to "(\w+)"\)'
    documented = set(re.findall(pattern, index))
    implemented = set(re.findall(pattern, server))
    check(
        "documented transitions exist in backend/server.howl",
        documented and documented <= implemented,
        f"not implemented: {sorted(documented - implemented)}",
    )

    # 2. Functions the docs name must exist in the source they attribute them to.
    for fn in re.findall(r"<code>(\w+)</code> policy function", index):
        check(
            f"documented function {fn!r} exists in backend/server.howl",
            f"(defun {fn} " in server,
        )

    # 3. Section tags must balance; an unclosed section silently nests the rest.
    check(
        "section tags balance in docs/index.html",
        index.count("<section") == index.count("</section>"),
        f'{index.count("<section")} open vs {index.count("</section>")} close',
    )

    # 4. Every class used in the markup must be defined in the stylesheet.
    used = set()
    for attr in re.findall(r'class="([^"]+)"', index):
        used.update(attr.split())
    undefined = sorted(
        name for name in used
        if f".{name}" not in style and not name.startswith("sec-")
    )
    check("all markup classes are styled", not undefined, f"undefined: {undefined}")

    # 5. The published demo must read the same fixtures the application loads.
    fixtures = ROOT / "data" / "fixtures" / "missions.json"
    published = ROOT / "docs" / "missions.json"
    check("published demo data exists", published.exists())
    if published.exists() and fixtures.exists():
        check(
            "published demo data matches the application fixtures",
            published.read_bytes() == fixtures.read_bytes(),
            "run `make pages-data`",
        )

    # 6. The demo must not claim to be live.
    check(
        "published demo is labelled read-only",
        "read-only" in index.lower() or "static" in index.lower(),
    )

    print()
    if FAILURES:
        print(f"{len(FAILURES)} documentation check(s) failed")
        return 1
    print("All documentation checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
