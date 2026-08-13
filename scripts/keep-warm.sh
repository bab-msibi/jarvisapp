#!/bin/bash
# keep-warm.sh — keep the local Jarvis model resident in RAM so OpenClaw agent
# calls don't pay the ~90s cold-load on this CPU-only Mac.
#
# Run periodically (see ai.jarvis.warmkeeper.plist). Each ping pins the model
# with keep_alive:-1, so it stays loaded forever and re-pins after any Ollama
# restart (reboot, app relaunch).

MODEL="${JARVIS_MODEL:-qwen2.5:3b}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"

curl -s --max-time 120 "$OLLAMA_URL/api/generate" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"ok\",\"stream\":false,\"keep_alive\":-1,\"options\":{\"num_predict\":1}}" \
  >/dev/null 2>&1

echo "$(date '+%Y-%m-%d %H:%M:%S') warmed $MODEL"
