'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Moon, Sun, Rss, Github, CalendarDays as Calendar,
  Search, ChevronLeft, ChevronRight, Sparkles, Newspaper,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** ---------- Types ---------- */
type Entry = {
  date: string;            // "YYYY-MM-DD"
  title: string;
  summary?: string;
  tags?: string[];
  url?: string;            // e.g. "ai/2025/09/03.md"
  content?: string;        // inline markdown (alternative to url)
  slug?: string;
};
type Manifest = {
  site: { title: string; description?: string; baseUrl?: string };
  categories: Record<string, string>;
  months: Record<string, Record<string, Entry[]>>; // months[cat][YYYY-MM] -> Entry[]
};

/** ---------- Seed manifest (fallback if /manifest.json missing) ---------- */
const seedManifest: Manifest = {
  site: {
    title: "AI / 游戏 日报",
    description: "每天 10 分钟，跟上 AI 与游戏进展",
    baseUrl: "",
  },
  categories: { ai: "AI 日报", game: "游戏日报" },
  months: {
    ai: {
      "2025-09": [
        {
          date: "2025-09-03",
          title: "AI 日报 · 2025-09-03",
          summary: "模型/产品/论文要闻 10 条。",
          tags: ["AI", "Daily"],
          content:
            "## 今日要闻\n1. ……\n2. ……\n\n### 简评\n- 节奏趋于周更，注意评测口径统一。",
        },
        {
          date: "2025-09-02",
          title: "AI 日报 · 2025-09-02",
          summary: "监管与开源动态。",
          tags: ["AI"],
          content: "## 速读\n- ……",
        },
      ],
      "2025-08": [
        {
          date: "2025-08-31",
          title: "AI 日报 · 2025-08-31",
          summary: "月末观察：推理成本与评测基线。",
          tags: ["AI"],
          content: "…",
        },
      ],
    },
    game: {
      "2025-09": [
        {
          date: "2025-09-03",
          title: "游戏日报 · 2025-09-03",
          summary: "新品、买量、版本更新与节点观察。",
          tags: ["Game", "Daily"],
          content: "## 今日焦点\n- ……",
        },
      ],
    },
  },
};

/** ---------- Utils ---------- */
function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}
function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const weekday = "日一二三四五六"[d.getDay()];
  return `${y}-${m}-${dd}（周${weekday}）`;
}
function readingTime(md?: string): number {
  const words = String(md || "")
    .replace(/[#>*`\-\[\]()]|\d+\.|\n/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 260));
}
function stripFrontmatter(md: string = ""): string {
  return md.replace(/^---[\s\S]*?---\n?/, "");
}

function detectBase(): string {
  if (typeof window === "undefined") return "";
  return window.location.pathname.startsWith("/daily-site") ? "/daily-site" : "";
}

/** ---------- Component ---------- */
export default function ElegantDaily() {
  const [manifest, setManifest] = useState<Manifest>(seedManifest);
  const [cat, setCat] = useState<"ai" | "game">("ai");
  const [month, setMonth] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [detail, setDetail] = useState<(Entry & { _md?: string }) | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("theme") as "dark" | "light" | null;
    return saved ?? "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (typeof window !== "undefined") localStorage.setItem("theme", theme);
  }, [theme]);

  // Load external manifest.json if exists
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const base = manifest.site?.baseUrl || detectBase();
        const res = await fetch(`${base}/manifest.json`, {
          cache: "no-store",
        });
        if (res.ok) {
          const j: Partial<Manifest> = await res.json();
          if (!canceled)
            setManifest((m) => ({ ...m, ...j, site: { ...m.site, ...j.site, baseUrl: base } }));
        }
      } catch (_e) {
        // keep seedManifest
      }
    })();
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Months for current category, sorted desc
  const monthKeys = useMemo<string[]>(() => {
    const data = manifest.months?.[cat] || {};
    return Object.keys(data).sort().reverse();
  }, [manifest, cat]);

  // Default month = latest
  useEffect(() => {
    if (!month && monthKeys[0]) setMonth(monthKeys[0]);
  }, [month, monthKeys]);

  const entries = useMemo<Entry[]>(() => {
    const list = (manifest.months?.[cat]?.[month] || []).slice();
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const q = (query || "").toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.title, p.summary, (p.tags || []).join(" ")].join(" ").toLowerCase().includes(q)
    );
  }, [manifest, cat, month, query]);

  const curCatLabel = manifest.categories?.[cat] || cat;
  const monthScrollerRef = useRef<HTMLDivElement | null>(null);

  function scrollMonths(dir: number = 1) {
    const el = monthScrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 240, behavior: "smooth" });
  }

  async function openDetail(p: Entry) {
    let md = p.content || "";
    if (!md && p.url) {
      try {
        const res = await fetch(p.url, { cache: "no-store" });
        md = await res.text();
      } catch (_e) {
        md = "（加载 Markdown 失败）";
      }
    }
    setDetail({ ...p, _md: stripFrontmatter(md) });
  }

  function exportRSS() {
    const now = new Date().toUTCString();
    const items = (manifest.months?.[cat]?.[month] || [])
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map(
        (p) => `
        <item>
          <title><![CDATA[${p.title || ""}]]></title>
          <link>${location.origin + location.pathname}#/p/${cat}/${month}/${String(p.date).slice(-2)}</link>
          <guid>${p.slug || p.date}</guid>
          <pubDate>${new Date(p.date + "T00:00:00").toUTCString()}</pubDate>
          <description><![CDATA[${p.summary || ""}]]></description>
        </item>`
      )
      .join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n  <channel>\n    <title><![CDATA[${curCatLabel} ${month}]]></title>\n    <link>${location.origin + location.pathname}</link>\n    <description><![CDATA[${manifest.site?.description || ""}]]></description>\n    <lastBuildDate>${now}</lastBuildDate>\n    ${items}\n  </channel>\n</rss>`;
    const blob = new Blob([xml], { type: "application/rss+xml;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cat}-${month}-rss.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 dark:text-slate-100">
      {/* background orbs */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-violet-600/30 to-teal-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[420px] w-[420px] rotate-12 rounded-full bg-gradient-to-tr from-fuchsia-500/20 to-indigo-500/10 blur-3xl" />

      {/* header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-slate-900/50 border-b border-white/10"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="group flex cursor-pointer items-center gap-3" onClick={() => setDetail(null)}>
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-teal-500 shadow-lg shadow-violet-800/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm uppercase tracking-widest text-slate-300">Daily • {manifest.categories?.[cat]}</div>
              <div className="-mt-0.5 font-semibold">{manifest.site?.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span>主题</span>
            </button>
            <button onClick={exportRSS} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
              <Rss className="h-4 w-4" /> RSS
            </button>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
          </div>
        </div>
      </motion.header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pb-2 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Category segmented control */}
            <div className="relative isolate inline-flex rounded-full bg-slate-950/40 p-1 ring-1 ring-white/10">
              {(["ai", "game"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setCat(k);
                    // switch to latest month of that cat
                    const months = Object.keys(manifest.months?.[k] || {}).sort().reverse();
                    if (months[0]) setMonth(months[0]);
                    setDetail(null);
                  }}
                  className={classNames(
                    "relative z-10 px-4 py-2 text-sm font-medium transition",
                    cat === k ? "text-slate-900" : "text-slate-300"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {k === "ai" ? <Newspaper className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    {manifest.categories?.[k]}
                  </span>
                </button>
              ))}
              {/* active pill */}
              <motion.span
                aria-hidden
                className="absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-tr from-violet-400 to-teal-300 shadow-inner"
                animate={{ x: cat === "ai" ? "0%" : "100%" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            </div>

            {/* Search */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题/标签/摘要…"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-400 shadow-inner outline-none ring-1 ring-transparent focus:border-white/20 focus:ring-white/10"
              />
            </div>
          </div>

          {/* month scroller */}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => scrollMonths(-1)} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
            <div ref={monthScrollerRef} className="flex w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
              {monthKeys.map((m) => (
                <motion.button
                  key={m}
                  onClick={() => setMonth(m)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={classNames(
                    "snap-start rounded-2xl border px-4 py-2 text-sm",
                    m === month
                      ? "border-violet-400/40 bg-gradient-to-tr from-violet-500/20 to-teal-400/10 text-slate-50"
                      : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  )}
                >
                  {m}
                </motion.button>
              ))}
            </div>
            <button onClick={() => scrollMonths(1)} className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </motion.div>
      </section>

      {/* list */}
      <section className="mx-auto max-w-6xl px-4 pb-10">
        <AnimatePresence mode="popLayout">
          {entries.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-6 grid place-items-center rounded-3xl border border-white/10 bg-white/5 p-12 text-slate-300"
            >
              本月暂无数据或被搜索过滤。
            </motion.div>
          ) : (
            <motion.div key="grid" layout className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {entries.map((p) => (
                <motion.article
                  key={p.date + p.title}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.25 }}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-slate-950/60 p-5 shadow-xl"
                >
                  {/* card glow */}
                  <div className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
                    <div className="absolute -inset-px rounded-[22px] bg-gradient-to-r from-violet-500/30 via-teal-400/20 to-fuchsia-400/20 blur-xl" />
                  </div>

                  <div className="mb-2 flex items-center gap-2 text-xs text-slate-300/80">
                    <Calendar className="h-4 w-4" />
                    <span className="font-medium tabular-nums">{formatDate(p.date)}</span>
                    <span>·</span>
                    <span>{readingTime(p.content) || 1} 分钟</span>
                  </div>

                  <h3 className="line-clamp-1 text-lg font-semibold tracking-tight text-slate-50">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-300/90">{p.summary}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(p.tags || []).map((t) => (
                      <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                        # {t}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <motion.button
                      onClick={() => openDetail(p)}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-slate-50 backdrop-blur hover:bg-white/20"
                    >
                      阅读全文 <ChevronRight className="h-4 w-4" />
                    </motion.button>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Drawer Detail */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="absolute right-0 top-0 h-full w-full overflow-y-auto border-l border-white/10 bg-slate-950/95 shadow-2xl sm:w-[640px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/70 px-5 py-3 backdrop-blur">
                <div className="flex items-center gap-2 text-xs text-slate-300/90">
                  <Calendar className="h-4 w-4" />
                  <span className="tabular-nums">{formatDate(detail.date)}</span>
                  <span>· {readingTime(detail._md)} 分钟</span>
                </div>
                <button
                  onClick={() => setDetail(null)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
                >
                  关闭
                </button>
              </div>

              <div className="mx-auto w/full max-w-3xl px-5 py-6">
                <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-50">{detail.title}</h1>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(detail.tags || []).map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                      # {t}
                    </span>
                  ))}
                </div>
                <article className="prose prose-invert prose-slate max-w-none prose-pre:rounded-xl prose-pre:bg-slate-900/70 prose-code:text-teal-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {detail._md || "（暂无内容）"}
                  </ReactMarkdown>
                </article>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer */}
      <footer className="border-t border-white/10 px-4 py-8 text-center text-sm text-slate-400">
        <div className="mx-auto max-w-6xl">
          <p>
            本示例：<strong>React + Tailwind + Framer Motion</strong>（零后端）。
            数据来自 <code>manifest.json</code> 或内置种子；条目可用 <code>url</code> 指向独立 Markdown 文件。
          </p>
        </div>
      </footer>
    </div>
  );
}
