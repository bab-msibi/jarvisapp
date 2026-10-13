"use client";

const EMOJI_BG: Record<string, string> = { blue: "#1e3a5f", purple: "#2d1f4e", cyan: "#0e3340", green: "#1a3320", amber: "#3d2800", pink: "#3d1a2e", slate: "#1e2230" };

export function AgentEmoji({ emoji, name, color, size }: { emoji: string | null; name: string; color: string; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: EMOJI_BG[color] || "#1e2230", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.46 }}>
      {emoji || name?.charAt(0) || "?"}
    </div>
  );
}
