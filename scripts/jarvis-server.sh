#!/bin/bash
# jarvis-server.sh — runs the Jarvis server under launchd (see ai.jarvis.server.plist).
# Rebuilds first when the source is newer than the last build, then serves on
# 127.0.0.1 while holding a keep-awake assertion so remote access keeps working.
# `caffeinate -s` only applies on AC power: on battery the Mac sleeps normally.

set -euo pipefail
cd "$(dirname "$0")/.."

# launchd starts jobs with a minimal PATH; node, npm and openclaw live here
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export PORT="${PORT:-3000}"

BUILD_ID=.next/BUILD_ID
if [ ! -f "$BUILD_ID" ] || [ -n "$(find app components lib proxy.ts instrumentation.ts next.config.ts package.json pairing.html public -newer "$BUILD_ID" -print -quit)" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') source changed — building"
  npm run build
fi

echo "$(date '+%Y-%m-%d %H:%M:%S') starting Jarvis on 127.0.0.1:$PORT"
exec /usr/bin/caffeinate -s ./node_modules/.bin/next start -H 127.0.0.1 -p "$PORT"
