#!/bin/bash
# jarvis-service.sh — manage the Jarvis background service
# Usage: scripts/jarvis-service.sh install|uninstall|restart|status|logs

set -euo pipefail
LABEL=ai.jarvis.server
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"

case "${1:-status}" in
  install)
    cp "$DIR/$LABEL.plist" "$PLIST"
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Installed. Jarvis now starts at login and restarts if it stops."
    ;;
  uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed. Start Jarvis manually with: npm start"
    ;;
  restart)
    launchctl kickstart -k "$DOMAIN/$LABEL"
    echo "Restarting (rebuilds first if the code changed)."
    ;;
  status)
    launchctl print "$DOMAIN/$LABEL" 2>/dev/null | grep -E "^\t(state|pid|last exit code) " || echo "Not installed."
    curl -s -m 3 -o /dev/null -w "HTTP %{http_code} from http://127.0.0.1:3000/api/health\n" http://127.0.0.1:3000/api/health || echo "Server not responding."
    ;;
  logs)
    tail -n 50 -f "$DIR/jarvis-server.log"
    ;;
  *)
    echo "Usage: $0 install|uninstall|restart|status|logs"; exit 1 ;;
esac
