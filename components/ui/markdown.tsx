// Small, safe Markdown for agent replies: builds React elements only (no HTML injection).
// Covers what models actually send: paragraphs, headings, lists, quotes, code blocks,
// inline code, **bold**, *italic*, ~~strike~~ and links (http/https only).
import { Fragment, type ReactNode } from "react";

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_|\[[^\]\n]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function link(href: string, label: ReactNode, key: number) {
  if (!/^https?:\/\//i.test(href)) return <Fragment key={key}>{label}</Fragment>;
  return <a key={key} href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline", overflowWrap: "anywhere" }}>{label}</a>;
}

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((t, i) => {
    if (!t) return null;
    if (t.startsWith("`") && t.endsWith("`") && t.length > 2)
      return <code key={i} className="mono" style={{ fontSize: "0.88em", padding: "1px 5px", borderRadius: 5, background: "var(--surface-2)" }}>{t.slice(1, -1)}</code>;
    if ((t.startsWith("**") && t.endsWith("**")) || (t.startsWith("__") && t.endsWith("__")))
      return <strong key={i}>{inline(t.slice(2, -2))}</strong>;
    if (t.startsWith("~~") && t.endsWith("~~")) return <s key={i}>{inline(t.slice(2, -2))}</s>;
    if ((t.startsWith("*") && t.endsWith("*")) || (t.startsWith("_") && t.endsWith("_"))) return <em key={i}>{inline(t.slice(1, -1))}</em>;
    const md = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (md) return link(md[2], inline(md[1]), i);
    if (/^https?:\/\//.test(t)) return link(t, t, i);
    return <Fragment key={i}>{t}</Fragment>;
  });
}

type Block =
  | { kind: "p" | "quote"; lines: string[] }
  | { kind: "h"; level: number; text: string }
  | { kind: "code"; text: string }
  | { kind: "ul" | "ol"; items: string[]; start: number }
  | { kind: "hr" };

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i]);
      blocks.push({ kind: "code", text: body.join("\n") });
      continue;
    }
    if (!line.trim()) continue;
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ kind: "h", level: h[1].length, text: h[2] }); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({ kind: "hr" }); continue; }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    const last = blocks.at(-1);
    if (ul) { if (last?.kind === "ul") last.items.push(ul[1]); else blocks.push({ kind: "ul", items: [ul[1]], start: 1 }); continue; }
    if (ol) { if (last?.kind === "ol") last.items.push(ol[2]); else blocks.push({ kind: "ol", items: [ol[2]], start: +ol[1] }); continue; }
    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) { if (last?.kind === "quote") last.lines.push(q[1]); else blocks.push({ kind: "quote", lines: [q[1]] }); continue; }
    // A non-blank line right after a paragraph or list item continues it
    if (last?.kind === "p" && lines[i - 1]?.trim()) last.lines.push(line);
    else if ((last?.kind === "ul" || last?.kind === "ol") && lines[i - 1]?.trim() && /^\s+/.test(line)) last.items[last.items.length - 1] += " " + line.trim();
    else blocks.push({ kind: "p", lines: [line] });
  }
  return blocks;
}

const withBreaks = (lines: string[]) => lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l)}</Fragment>);

export function Markdown({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowWrap: "anywhere" }}>
      {parse(text).map((b, i) => {
        switch (b.kind) {
          case "h": return <div key={i} style={{ fontWeight: 700, fontSize: b.level <= 2 ? "1.08em" : "1em", marginTop: i ? 2 : 0 }}>{inline(b.text)}</div>;
          case "code": return (
            <pre key={i} className="mono" style={{ margin: 0, padding: "9px 11px", borderRadius: 10, background: "var(--surface-2)", fontSize: 12.5, lineHeight: 1.45,
              overflowX: "auto", whiteSpace: "pre" }}>{b.text}</pre>
          );
          case "ul": return <ul key={i} style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 }}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>;
          case "ol": return <ol key={i} start={b.start} style={{ margin: 0, paddingLeft: 22, display: "flex", flexDirection: "column", gap: 3 }}>{b.items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>;
          case "quote": return <div key={i} style={{ borderLeft: "3px solid var(--border-strong)", paddingLeft: 10, color: "var(--text-dim)" }}>{withBreaks(b.lines)}</div>;
          case "hr": return <hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "2px 0", width: "100%" }} />;
          default: return <div key={i}>{withBreaks(b.lines)}</div>;
        }
      })}
    </div>
  );
}
