#!/usr/bin/env bash
set -euo pipefail

if ! python3 -m pip --version >/dev/null 2>&1; then
  if command -v curl >/dev/null 2>&1; then
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3 -
  else
    echo "pip is not available and curl is missing; cannot install dependencies." >&2
    exit 1
  fi
fi

python3 -m pip install -r requirements.txt
python3 Run.py
