/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Moon, Sun, Rss, Github, CalendarDays as Calendar,
  Search, ChevronLeft, ChevronRight, Sparkles, Newspaper,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import hljs from "highlight.js";

// 放在 import 之后
const mdComponents = {
  blockquote: ({ children, ...rest }: any) => (
    <div
      {...rest}
      className="my-4 rounded-xl border-l-4 border-teal-400/60 bg-teal-400/5 px-4 py-3 text-slate-200"
    >
      <div className="mb-1 text-[12px] font-medium uppercase tracking-wide text-teal-300/80">Note</div>
      <blockquote className="[&>*:last-child]:mb-0">{children}</blockquote>
    </div>
  ),
  code: ({ inline, className, children, ...props }: any) => {
    const code = String(children).replace(/\n$/, "");
    if (inline) {
      return (
        <code className="rounded bg-slate-900/70 px-1.5 py-0.5 text-[92%] text-teal-300" {...props}>
          {children}
        </code>
      );
    }
    const language = /language-(\w+)/.exec(className || "")?.[1];
    const html = language
      ? hljs.highlight(code, { language }).value
      : hljs.highlightAuto(code).value;
    return (
      <code
        dangerouslySetInnerHTML={{ __html: html }}
        className={`hljs ${className || ""}`}
        {...props}
      />
    );
  },
  pre: ({ children, ...props }: any) => (
    <pre
      {...props}
      className="my-4 overflow-auto rounded-xl bg-slate-900/70 p-4 text-sm leading-6 shadow-inner"
    >
      {children}
    </pre>
  ),
};

/** ---------- Types ---------- */
type Entry = {
  date: string;            // "YYYY-MM-DD"
  title: string;
  summary?: string;
  tags?: string[];
  url?: string;            // 相对路径 md 文件，如 "game/2025/09/08.md"
  content?: string;        // 也可直接内联 md
  _md?: string;            // 运行期解析后的 md 文本
};
type Manifest = {
  site: {
    title: string;
    description: string;
    baseUrl: string;
  };
  categories: Record<string, string>;
  months: Record<string, Record<string, Entry[]>>;
};

/** ---------- Utils ---------- */
function cx(...xs: Array<string | false | null | undefined>) {
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

function stripFirstHeading(md: string = "", title: string): string {
  const safe = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^#\\s*${safe}\\s*\n`);
  return md.replace(re, "");
}

function normalizeMarkdown(md: string = ""): string {
  return (md || "")
    .replace(/\uFEFF/g, "")      // 去 BOM/零宽
    .replace(/\r\n/g, "\n")      // 统一换行
    // 引用后若下一行不是 '>' 或空行，补一行空行，避免 lazy continuation
    .replace(/(^>.*\n)(?!>|\n)/gm, "$1\n")
    // 段落/标题/引用 之后若直接开始列表，则补空行，确保识别列表
    .replace(/([^\n>])\n(- |\* |\d+[.)、] )/g, "$1\n\n$2");
}

/** ---------- Component ---------- */
export default function ElegantDaily() {
  const [manifest, setManifest] = useState<Manifest>({
    site: { title: "每日精选", description: "", baseUrl: "" },
    categories: { ai: "AI", game: "Game" },
    months: {},
  });
  const [cat, setCat] = useState<keyof Manifest["months"]>("game");
  const [month, setMonth] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [detail, setDetail] = useState<Entry | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // 主题切换（简单示例）
  useEffect(() => {
    if (theme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [theme]);

  // 拉取 manifest（优先根目录 ./manifest.json）
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("./manifest.json", { cache: "no-store" });
        const raw = (await res.json()) as any;
        const m: Manifest = {
          site: {
            title: raw.site?.title ?? raw.title ?? "每日精选",
            description: raw.site?.description ?? raw.description ?? "",
            baseUrl: raw.site?.baseUrl ?? raw.baseUrl ?? "",
          },
          categories: raw.categories || {},
          months: raw.months || {},
        };
        setManifest(m);
        // 默认选第一个有内容的分类+最近月份
        const firstCat = Object.keys(m.months)[0] as keyof Manifest["months"];
        setCat(firstCat || "game");
        const months = Object.keys(m.months[firstCat] || {}).sort().reverse();
        setMonth(months[0] || "");
      } catch {
        // 兜底：内置一些示例数据（如果 manifest 拉失败）
        setManifest({
          site: { title: "每日精选", description: "", baseUrl: "" },
          categories: { ai: "AI", game: "Game" },
          months: {
            ai: {
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
                  content: "…",
                },
              ],
            },
          },
        });
        setCat("game");
        setMonth("2025-09");
      }
    }
    load();
  }, []);

  // 月份列表
  const months = useMemo(() => {
    const mm = Object.keys(manifest.months?.[cat] || {});
    return mm.sort().reverse();
  }, [manifest, cat]);

  // 当前月份的条目（倒序，支持搜索）
  const entries = useMemo(() => {
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
        // p.url已经是相对路径 'ai/2024/01/01.md'，浏览器会自动处理
        const res = await fetch(p.url, { cache: "no-store" });
        md = await res.text();
      } catch {
        md = "（加载 Markdown 失败）";
      }
    }
    const cleaned = stripFirstHeading(md, p.title);
    setDetail({ ...p, _md: normalizeMarkdown(stripFrontmatter(cleaned)) });
  }

  function exportRSS() {
    const now = new Date().toUTCString();
    const items = (manifest.months?.[cat]?.[month] || [])
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map(
        (p) => `
<item>
  <title>${p.title}</title>
  <link>${location.href.split("#")[0]}</link>
  <pubDate>${new Date(`${p.date}T00:00:00`).toUTCString()}</pubDate>
  <description><![CDATA[${p.summary || ""}]]></description>
</item>`
      )
      .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${manifest.site.title} · ${curCatLabel} · ${month}</title>
  <link>${location.href.split("#")[0]}</link>
  <description>导出自 daily-site</description>
  <lastBuildDate>${now}</lastBuildDate>
  ${items}
</channel>
</rss>`;

    const blob = new Blob([rss], { type: "application/rss+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-${cat}-${month}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <span className="text-2xl">🎮</span>
          <h1 className="mr-auto text-xl font-bold tracking-tight">
            {manifest.site.title} · {formatDate(month + "-01")}
          </h1>

          <div className="hidden items-center rounded-full bg-white/5 p-1 sm:flex">
            {Object.entries(manifest.categories || {}).map(([k, v]) => {
              const Icon = k === "ai" ? Newspaper : Calendar;
              const active = cat === k;
              return (
                <button
                  key={k}
                  onClick={() => setCat(k as any)}
                  className={cx(
                    "relative flex items-center gap-1 rounded-full px-3 py-1 text-sm transition-colors",
                    active ? "text-white" : "text-slate-300 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {v}
                  {active && (
                    <motion.span
                      layoutId="cat-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-teal-500 to-sky-500"
                      transition={{ type: "spring", duration: 0.4 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative ml-2 hidden md:block">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-64 rounded-lg border border-white/10 bg-slate-900 px-7 py-2 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-teal-400/40"
              placeholder="搜索标题/摘要/标签…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <button
            className="ml-2 hidden rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 md:block"
            onClick={exportRSS}
            title="导出当前分类&月份 RSS"
          >
            <Rss className="mr-1 inline h-4 w-4" />
            RSS
          </button>

          <a
            className="ml-2 hidden rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10 md:block"
            href="https://github.com/moxxiran/daily-site"
            target="_blank"
            rel="noreferrer"
            title="GitHub"
          >
            <Github className="mr-1 inline h-4 w-4" />
            GitHub
          </a>

          <button
            className="ml-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title="切换主题"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* months scroller */}
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2">
            <button
              onClick={() => scrollMonths(-1)}
              className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"
              title="向左"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div
              ref={monthScrollerRef}
              className="no-scrollbar -mx-1 flex flex-1 snap-x snap-mandatory gap-2 overflow-x-auto px-1"
            >
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  className={cx(
                    "snap-start rounded-lg border px-3 py-2 text-sm",
                    "border-white/10 text-slate-300 hover:bg-white/10",
                    month === m && "bg-white/15 text-white"
                  )}
                >
                  <Calendar className="mr-1 inline h-4 w-4" />
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={() => scrollMonths(1)}
              className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"
              title="向右"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-8 text-center text-slate-400">
            暂无内容
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {entries.map((p) => (
              <article
                key={`${p.date}-${p.title}`}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/50 p-5 hover:border-white/20"
              >
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    <Newspaper className="mr-1 h-3 w-3" />
                    {curCatLabel}
                  </span>
                  <span>{formatDate(p.date)}</span>
                  <span>·</span>
                  <span>{readingTime(p.content || p.url ? "500" : p.summary) || 1} 分钟</span>
                </div>

                <h3 className="mb-1 line-clamp-1 text-lg font-semibold tracking-tight">
                  {p.title}
                </h3>

                {!!(p.tags || []).length && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {(p.tags || []).map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300"
                      >
                        # {t}
                      </span>
                    ))}
                  </div>
                )}

                {!!p.summary && (
                  <p className="line-clamp-3 text-sm text-slate-300/90">{p.summary}</p>
                )}

                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => openDetail(p)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
                  >
                    查看详情
                  </button>
                  {!!p.url && (
                    <a
                      href={p.url}
                      className="text-sm text-teal-300 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看原文 MD
                    </a>
                  )}
                </div>

                {/* 背景装饰 */}
                <Sparkles className="absolute -right-8 -top-6 h-24 w-24 text-white/5 transition-transform group-hover:rotate-12" />
              </article>
            ))}
          </div>
        )}
      </main>

      {/* detail drawer */}
      <AnimatePresence>
        {detail && (
          <motion.div
            className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-2 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDetail(null)}
          >
            <motion.div
              className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-white/10 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">
                    <span className="mr-2 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                      <Newspaper className="mr-1 h-3 w-3" />
                      {curCatLabel}
                    </span>
                    <span>{formatDate(detail.date)}</span>
                  </div>
                  <button
                    onClick={() => setDetail(null)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-slate-300 hover:bg-white/10"
                    aria-label="关闭"
                  >
                    关闭
                  </button>
                </div>
                <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-50">{detail.title}</h1>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(detail.tags || []).map((t) => (
                    <span key={t} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                      # {t}
                    </span>
                  ))}
                </div>
                <article className="markdown-body p-5">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={mdComponents}
                  >
                    {detail._md || "（暂无内容）"}
                  </ReactMarkdown>
                </article>
              </div>
            </motion.div>
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
