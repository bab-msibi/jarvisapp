#!/usr/bin/env python3
"""daily-digest.py — once-a-day Jarvis digest.

Pulls live data from the local Jarvis server (/api/*) and writes a dated
markdown digest to jarvisapp/digests/. Uses the warm local model for a short
natural-language summary, but the digest is written even if the model is busy.

Scheduled by ai.jarvis.dailydigest.plist. Safe to run manually:
    python3 scripts/daily-digest.py
"""
import json, os, sys, urllib.request, datetime

APP = os.environ.get("JARVIS_URL", "http://127.0.0.1:3000")
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("JARVIS_MODEL", "qwen2.5:3b")
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "digests")


def get(path, timeout=15):
    try:
        with urllib.request.urlopen(f"{APP}{path}", timeout=timeout) as r:
            return json.load(r)
    except Exception as e:
        return {"_error": str(e)}


def llm_summary(facts, timeout=120):
    """Ask the warm local model for a 2-sentence summary. Small prompt = fast."""
    prompt = (
        "You are Jarvis. In 2 short sentences, give a friendly status summary "
        "of this Mac based on these facts. Be concise.\n\n" + facts + "\n\nSummary:"
    )
    body = json.dumps({
        "model": MODEL, "prompt": prompt, "stream": False,
        "keep_alive": -1, "options": {"num_predict": 90, "temperature": 0.4},
    }).encode()
    try:
        req = urllib.request.Request(f"{OLLAMA}/api/generate", data=body,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r).get("response", "").strip()
    except Exception as e:
        return f"_(local model summary unavailable: {e})_"


def main():
    now = datetime.datetime.now()
    sysd = get("/api/system")
    tasks = get("/api/tasks")
    sessions = get("/api/sessions")
    agents = get("/api/agents")

    # Normalize
    task_list = tasks if isinstance(tasks, list) else tasks.get("tasks", []) if isinstance(tasks, dict) else []
    sess_list = sessions if isinstance(sessions, list) else sessions.get("sessions", []) if isinstance(sessions, dict) else []
    agent_list = agents.get("agents", []) if isinstance(agents, dict) else []
    by_col = {}
    for t in task_list:
        st = t.get("status", "?")
        by_col[st] = by_col.get(st, 0) + 1

    facts = (
        f"Date: {now:%A %d %B %Y}\n"
        f"Mac: {sysd.get('model','?')} · {sysd.get('osVersion','?')} · up {sysd.get('uptime','?')}\n"
        f"CPU {sysd.get('cpuPct','?')}% · RAM {sysd.get('ramPct','?')}% "
        f"({sysd.get('ramUsedGb','?')}/{sysd.get('ramTotalGb','?')}GB) · Disk {sysd.get('diskPct','?')}%\n"
        f"Battery: {sysd.get('battStatus','?')} · Load {sysd.get('load1','?')}\n"
        f"Agents: {len(agent_list)} · Tasks: {len(task_list)} ({by_col}) · Sessions: {len(sess_list)}"
    )
    summary = llm_summary(facts)

    md = [
        f"# Jarvis Daily Digest — {now:%A, %d %B %Y}",
        f"_Generated {now:%H:%M}_\n",
        f"> {summary}\n",
        "## System",
        f"- **{sysd.get('model','Mac')}** · {sysd.get('osVersion','')} · up {sysd.get('uptime','?')}",
        f"- CPU **{sysd.get('cpuPct','?')}%** · RAM **{sysd.get('ramPct','?')}%** "
        f"({sysd.get('ramUsedGb','?')}/{sysd.get('ramTotalGb','?')} GB) · Disk **{sysd.get('diskPct','?')}%**",
        f"- Battery: {sysd.get('battStatus','?')} · Load {sysd.get('load1','?')} · IP {sysd.get('ip','?')}\n",
        "## Activity",
        f"- Agents deployed: **{len(agent_list)}**",
        f"- Tasks: **{len(task_list)}** " + (f"({', '.join(f'{k}: {v}' for k,v in by_col.items())})" if by_col else ""),
        f"- Sessions: **{len(sess_list)}**\n",
    ]
    if task_list:
        md.append("### Recent tasks")
        for t in sorted(task_list, key=lambda x: x.get("lastEventAt", 0), reverse=True)[:8]:
            title = (t.get("task") or "(untitled)").replace("\n", " ")
            if len(title) > 90:
                title = title[:90] + "…"
            md.append(f"- [{t.get('status','?')}] {title} — {t.get('agentId','?')}")

    os.makedirs(OUT_DIR, exist_ok=True)
    dated = os.path.join(OUT_DIR, f"{now:%Y-%m-%d}.md")
    latest = os.path.join(OUT_DIR, "latest.md")
    text = "\n".join(md) + "\n"
    for p in (dated, latest):
        with open(p, "w") as f:
            f.write(text)
    print(f"{now:%Y-%m-%d %H:%M} wrote digest -> {dated}")


if __name__ == "__main__":
    sys.exit(main())
