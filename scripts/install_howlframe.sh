#!/usr/bin/env bash
# Install the HowlFrame release HowlBoard compiles against as ./howlframe_bin.
#
# The archive is checked against the SHA-256 pinned below, not only against the
# release's SHA256SUMS, which is published beside the archive and would change
# with it. The version and checksums live only here; CI and the README call
# this script.
set -euo pipefail

VERSION=v0.2.0
RELEASE_URL="https://github.com/howlcipher/howlframe/releases/download/${VERSION}"

case "$(uname -s)/$(uname -m)" in
  Linux/x86_64)        TARGET=linux_amd64;  SHA256=692c7130588422240eb84ee9682c26efc2d0fb9b0f1519bcc7c84b45bff83205 ;;
  Linux/aarch64|Linux/arm64)
                       TARGET=linux_arm64;  SHA256=e64e3131165c279efe56be72547aec234bbe13bce34d9bad2e0c0b90e82714e4 ;;
  Darwin/x86_64)       TARGET=darwin_amd64; SHA256=c88caf30767110409196c4ce36583f136e5c32e1065d70ea694f6faae6c968f9 ;;
  Darwin/arm64)        TARGET=darwin_arm64; SHA256=e592637a84df248d511e0c394497b209d3adaa04b37d786ad02301c4ab786d9d ;;
  *)
    echo "install_howlframe.sh: no HowlFrame ${VERSION} archive for $(uname -s)/$(uname -m); build it from source (README)" >&2
    exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${ROOT}/howlframe_bin"
ARCHIVE="howlframe_${VERSION}_${TARGET}.tar.gz"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

curl -fsSL -o "${WORK}/${ARCHIVE}" "${RELEASE_URL}/${ARCHIVE}"

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL="$(sha256sum "${WORK}/${ARCHIVE}" | cut -d' ' -f1)"
else
  ACTUAL="$(shasum -a 256 "${WORK}/${ARCHIVE}" | cut -d' ' -f1)"
fi
if [ "$ACTUAL" != "$SHA256" ]; then
  echo "install_howlframe.sh: ${ARCHIVE} has SHA-256 ${ACTUAL}, expected ${SHA256}; nothing installed" >&2
  exit 1
fi

tar -xzf "${WORK}/${ARCHIVE}" -C "$WORK" howlframe
REPORTED="$("${WORK}/howlframe" version | head -n 1)"
if [ "$REPORTED" != "HowlFrame ${VERSION#v}" ]; then
  echo "install_howlframe.sh: archive reports '${REPORTED}', expected 'HowlFrame ${VERSION#v}'; nothing installed" >&2
  exit 1
fi

install -m 0755 "${WORK}/howlframe" "$DEST"
echo "Installed ${REPORTED} (${TARGET}) as ${DEST}"
