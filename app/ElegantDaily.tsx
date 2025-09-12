/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Moon, Sun, Rss, Github, CalendarDays as Calendar,
  Search, ChevronLeft, ChevronRight, Sparkles, Newspaper,
  ExternalLink, ArrowUp, FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import hljs from "highlight.js";

// 放在 import 之后
function getTextFromChildren(children: any): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(getTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return getTextFromChildren((children as any).props.children);
  }
  return "";
}

// 清理卡片摘要开头的“🎮 游戏行业速递 + 日期”前缀
function cleanSummary(input?: string): string | undefined {
  if (!input) return input;
  const s = String(input);
  const cleaned = s
    // 去掉可选的手柄 emoji、空格、分隔符和日期，如：🎮 游戏行业速递 2025年09月09日
    .replace(/^[\u{1F3AE}\s]*游戏行业速递\s*[-—:：]*\s*\d{4}年\d{2}月\d{2}日(?:\s*\([^\)]*\))?\s*/u, "")
    .trimStart();
  return cleaned;
}

const mdComponents = {
  // 隐藏分类/来源的引用块，因为我们会在 H2 中显示
  blockquote: ({ children, ...rest }: any) => {
    const textContent = getTextFromChildren(children);
    const isMetaBlock = textContent.includes('分类：') || textContent.includes('来源：');
    if (isMetaBlock) {
      return null; // 隐藏 meta 引用块
    }
    return (
      <blockquote
        {...rest}
        className="my-4 rounded-lg border-l-2 border-sky-400/30 bg-white/40 px-4 py-3 text-slate-700 dark:border-sky-300/30 dark:bg-white/5 dark:text-[#C0C0C0]"
      >
        {children}
      </blockquote>
    );
  },

  a: ({ href, children, ...props }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-teal-400/60 underline-offset-4 hover:text-teal-600 dark:hover:text-teal-300"
      {...props}
    >
      {children}
    </a>
  ),
  
  code: ({ inline, className, children, ...props }: any) => {
    const code = String(children).replace(/\n$/, "");
    if (inline) {
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[92%] text-teal-600 dark:bg-slate-900/70 dark:text-teal-300" {...props}>
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
      className="my-4 overflow-auto rounded-xl bg-slate-100 p-4 text-sm leading-6 shadow-inner dark:bg-slate-900/70"
    >
      {children}
    </pre>
  ),
  h2: ({ children, ...props }: any) => {
    const text = getTextFromChildren(children);
    const id = slugify(text);
    
    // 从原始 Markdown（未经过 parseMetaAndToc 处理的）中提取 meta 信息
    const extractMetaForH2 = (h2Title: string) => {
      const rawMarkdown = (window as any).__rawMarkdown || '';
      if (!rawMarkdown) return null;
      
      // 找到这个 H2 标题的位置
      const titlePattern = `## ${h2Title}`;
      const titleIndex = rawMarkdown.indexOf(titlePattern);
      if (titleIndex === -1) return null;
      
      // 从标题位置开始，找到下一个 ## 或文档结束
      const nextH2Index = rawMarkdown.indexOf('\n## ', titleIndex + titlePattern.length);
      const sectionEnd = nextH2Index === -1 ? rawMarkdown.length : nextH2Index;
      const section = rawMarkdown.slice(titleIndex, sectionEnd);
      
      // 提取分类和来源
      // 兼容多种写法（是否加粗、中文/英文冒号等）
      const catRegs = [
        />\s*\*\*\s*分类\s*[：:]\s*\*\*\s*([^\n\r]+)/,
        />\s*\*\*\s*分类\s*\*\*\s*[：:]\s*([^\n\r]+)/,
        />\s*分类\s*[：:]\s*([^\n\r]+)/,
      ];
      const srcRegs = [
        />\s*\*\*\s*来源\s*[：:]\s*\*\*\s*([^\n\r]+)/,
        />\s*\*\*\s*来源\s*\*\*\s*[：:]\s*([^\n\r]+)/,
        />\s*来源\s*[：:]\s*([^\n\r]+)/,
      ];
      let categoryMatch: RegExpMatchArray | null = null;
      for (const re of catRegs) { const m = section.match(re); if (m) { categoryMatch = m as any; break; } }
      let sourceMatch: RegExpMatchArray | null = null;
      for (const re of srcRegs) { const m = section.match(re); if (m) { sourceMatch = m as any; break; } }
      
      const result: { category?: string; sources?: { label: string; href: string }[] } = {};
      
      if (categoryMatch) {
        result.category = categoryMatch[1].trim();
      }
      
      if (sourceMatch) {
        const sourceText = sourceMatch[1].trim();
        const sources: { label: string; href: string }[] = [];
        
        // 解析链接格式 [文本](链接)
        const linkMatches = [...sourceText.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
        linkMatches.forEach(match => {
          sources.push({ label: match[1], href: match[2] });
        });
        
        result.sources = sources;
      }
      
      return result;
    };
    
    const metaInfo = extractMetaForH2(text);
    
    return (
      <div>
        <h2 id={id} {...props}>
          {children}
        </h2>
        {metaInfo && (metaInfo.category || (metaInfo.sources && metaInfo.sources.length > 0)) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {metaInfo.category && (
              <span className="chip chip--meta">
                <Newspaper className="h-3.5 w-3.5" />
                {metaInfo.category}
              </span>
            )}
            {(metaInfo.sources || []).map((source, idx) => (
              <a key={idx} href={source.href} target="_blank" rel="noreferrer" className="chip chip--link">
                {source.label}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  },
  h3: ({ children, ...props }: any) => {
    const text = getTextFromChildren(children);
    const id = slugify(text);
    return (
      <h3 id={id} {...props}>
        {children}
      </h3>
    );
  },
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
  _meta?: {
    category?: string;
    sources?: { label: string; href: string }[];
  };
  _toc?: { id: string; text: string }[];
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
// 处理静态资源前缀（GitHub Pages basePath）
function asset(path: string): string {
  try {
    let prefix = '';
    if (typeof window !== 'undefined') {
      // 优先使用 __NEXT_DATA__.assetPrefix
      prefix = (window as any).__NEXT_DATA__?.assetPrefix || '';
      // 如果没有 assetPrefix，但在 GitHub Pages 环境下，使用 /daily-site
      if (!prefix && window.location.hostname === 'moxxiran.github.io') {
        prefix = '/daily-site';
      }
    }
    const p = path.startsWith('/') ? path : '/' + path;
    return (prefix ? prefix.replace(/\/$/, '') : '') + p;
  } catch {
    return path;
  }
}
// 附加构建版本参数，避免 CDN/浏览器缓存
function withBuildTag(u: string): string {
  try {
    const id = (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.buildId) || '';
    if (!id) return u;
    return u + (u.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(id);
  } catch {
    return u;
  }
}
function makeExcerpt(md: string): string {
  const lines = md.split('\n');
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (/^#{1,6}\s/.test(t)) continue;
    if (/^>/.test(t)) continue;
    if (/^(\-|\*|\+|\d+\.)\s/.test(t)) continue;
    const plain = t.replace(/[`*_#>\[\]\(\)!]/g, '').replace(/\s+/g, ' ');
    return plain.slice(0, 120);
  }
  return md.replace(/\s+/g, ' ').slice(0, 120);
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
    .replace(/([^\n>])\n(- |\* |\d+[.)、] )/g, "$1\n\n$2")
    // 将粗体提示转为小标题，提升可读性
    .replace(/^\*\*核心洞察：\*\*\s*/gm, "## 核心洞察\n\n")
    .replace(/^\*\*内容简介：\*\*\s*/gm, "## 内容简介\n\n");
}
function extractLinks(markdown: string): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
    links.push({ label: m[1], href: m[2] });
  }
  return links;
}
function slugify(text: string): string {
  const s = String(text).trim().toLowerCase();
  return (
    "h2-" +
    encodeURIComponent(
      s
        .replace(/\s+/g, "-")
        .replace(/\./g, "-")
        .replace(/[^a-z0-9\-\u4e00-\u9fa5]+/g, "-")
    )
  );
}
function parseMetaAndToc(md: string): { md: string; meta: Entry["_meta"]; toc: Entry["_toc"]; } {
  let out = md;
  const meta: Entry["_meta"] = { category: undefined, sources: [] };
  // 提取分类
  const catMatch = out.match(/^>\s*\*\*分类：\*\*\s*([^\n]+)$/m);
  if (catMatch) {
    meta.category = catMatch[1].trim();
    out = out.replace(catMatch[0] + "\n", "");
  }
  // 提取来源（可能有多个链接，以顿号/逗号分隔）
  const srcMatch = out.match(/^>\s*\*\*来源：\*\*\s*([^\n]+)$/m);
  if (srcMatch) {
    meta.sources = extractLinks(srcMatch[1]);
    out = out.replace(srcMatch[0] + "\n", "");
  }
  // 生成 TOC（H2，仅保留新闻标题，过滤“核心洞察/内容简介”，并去重、限量）
  const toc: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  out.split("\n").forEach((line) => {
    const m = /^##\s+(.+)$/.exec(line);
    if (!m) return;
    const text = m[1].trim();
    if (text === "核心洞察" || text === "内容简介") return;
    let id = slugify(text);
    let idx = 1;
    while (seen.has(id)) {
      id = `${id}-${idx++}`;
    }
    seen.add(id);
    if (toc.length < 12) toc.push({ id, text });
  });
  return { md: out, meta, toc };
}
function stripLeadingTocAndIntro(md: string): string {
  // 只在确实存在"人工目录"时才移除（检测是否有连续的链接列表）
  const lines = md.split('\n');
  let firstH2Index = -1;
  let hasLinkList = false;
  
  // 找到第一个 H2 的位置
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^##\s+/)) {
      firstH2Index = i;
      break;
    }
  }
  
  if (firstH2Index > 5) { // 只有当 H1 和第一个 H2 之间有足够内容时才检查
    // 检查是否有连续的链接列表（人工目录的特征）
    let linkCount = 0;
    for (let i = 1; i < firstH2Index; i++) {
      if (lines[i].includes('](') && (lines[i].includes('《') || lines[i].includes('【'))) {
        linkCount++;
      }
    }
    hasLinkList = linkCount >= 3; // 至少3个链接才认为是人工目录
  }
  
  if (hasLinkList && firstH2Index > -1) {
    return lines.slice(firstH2Index).join('\n');
  }
  return md;
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
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [mounted, setMounted] = useState(false);

  const [summaryCache, setSummaryCache] = useState<Record<string, string>>({});
  const [rawMd, setRawMd] = useState<string>("");
  const [tocOpen, setTocOpen] = useState(false);
  // 仅用于首次根据 URL 参数打开详情，避免重复触发
  const didOpenFromUrlRef = useRef(false);

  // 今日日期（本地时区）
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);
  
  // 客户端挂载后初始化主题，避免 hydration 错误
  useEffect(() => {
    setMounted(true);
    // 从 DOM 读取实际的主题状态
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);
  // 主题切换并同步样式
  useEffect(() => {
    const root = document.documentElement;
    // 只有当主题真的改变时才更新 DOM
    if (root.classList.contains('dark') !== (theme === 'dark')) {
      root.classList.toggle("dark", theme === "dark");
      root.style.colorScheme = theme;
    }

    // 代码高亮主题
    const hlId = "hljs-theme";
    let hlLink = document.getElementById(hlId) as HTMLLinkElement | null;
    if (!hlLink) {
      hlLink = document.createElement("link");
      hlLink.rel = "stylesheet";
      hlLink.id = hlId;
      document.head.appendChild(hlLink);
    }
    hlLink.href = `hljs/github${theme === "dark" ? "-dark" : ""}.css`;
    // Markdown 样式
    const mdId = "md-theme";
    let mdLink = document.getElementById(mdId) as HTMLLinkElement | null;
    if (!mdLink) {
      mdLink = document.createElement("link");
      mdLink.rel = "stylesheet";
      mdLink.id = mdId;
      document.head.appendChild(mdLink);
    }
  mdLink.href = `https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-${theme}.min.css`;
    localStorage.setItem("theme", theme);
  }, [theme, manifest.site.baseUrl]);
  // 监听抽屉内部滚动，控制返回顶部按钮显隐
  useEffect(() => {
    const el = detailScrollRef.current;
    if (!el) {
      setShowBackToTop(false);
      return;
    }
    const onScroll = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    // 初始计算
    onScroll();
    return () => {
      el.removeEventListener('scroll', onScroll as any);
    };
  }, [detail]);
  // 拉取 manifest（优先根目录 ./manifest.json）
  useEffect(() => {
    async function load() {
      try {
        let res = await fetch(withBuildTag(asset('/manifest.json')), { cache: 'no-store', signal: AbortController && new AbortController().signal });
        if (!res.ok) {
          try { res = await fetch(withBuildTag('./manifest.json'), { cache: 'no-store' }); } catch {}
        }
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
        const cats = Object.keys(m.months) as (keyof Manifest["months"])[];
        const pickCat = cats.find((c) => Object.keys(m.months[c] || {}).length > 0) || (cats[0] as any) || "game";
        setCat(pickCat);
        const months = Object.keys(m.months[pickCat] || {}).sort().reverse();
        setMonth(months[0] || "");
      } catch {
        // 使用空结构兜底并提前返回，避免注入演示数据
        setManifest({ site: { title: "", description: "", baseUrl: "" }, categories: { ai: "AI", game: "Game" }, months: { ai: {}, game: {} } });
        setCat("game");
        setMonth("");
        return;
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

  // 根据 URL 参数（如 ?date=2025-09-10&cat=game）在加载完 manifest 后自动打开详情
  useEffect(() => {
    if (didOpenFromUrlRef.current) return;
    const hasData = Object.keys(manifest.months || {}).length > 0;
    if (!hasData) return; // 等待 manifest 就绪

    try {
      const url = new URL(window.location.href);
      const dateParam = url.searchParams.get('date');
      const catParam = url.searchParams.get('cat');
      const titleParam = url.searchParams.get('title');
      if (!dateParam && !titleParam) return;

      // 在所有分类与月份中查找匹配项
      const cats = Object.keys(manifest.months) as (keyof Manifest['months'])[];
      const searchCats = catParam && cats.includes(catParam as any) ? [catParam as any] : cats;
      for (const c of searchCats) {
        const monthsMap = manifest.months[c] || {};
        for (const m of Object.keys(monthsMap)) {
          const entry = (monthsMap[m] || []).find((p) => {
            const dateOk = dateParam ? p.date === dateParam : true;
            const titleOk = titleParam ? p.title === decodeURIComponent(titleParam) : true;
            return dateOk && titleOk;
          });
          if (entry) {
            // 同步 UI 的当前分类与月份（可选）
            setCat(c);
            setMonth(m);
            // 打开详情抽屉
            openDetail(entry);
            didOpenFromUrlRef.current = true;
            return;
          }
        }
      }
    } catch {}
  }, [manifest]);
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
  // 懒加载摘要：若清单中缺失 summary，则抓取对应 Markdown 提取首段
  useEffect(() => {
    let aborted = false;
    async function loadExcerpts() {
      const targets = (manifest.months?.[cat]?.[month] || []).filter((p) => !p.summary && p.url);
      await Promise.allSettled(
        targets.map(async (p) => {
          const key = `${p.date}-${p.title}`;
          if (summaryCache[key]) return;
          try {
            const res = await fetch(withBuildTag(asset('/' + String(p.url).replace(/^\//,''))), { cache: "no-store" });
            if (!res.ok) return; // 文件不存在时不要写入摘要
            const md = await res.text();
            const cleaned = stripLeadingTocAndIntro(stripFirstHeading(md, p.title));
            const normalized = normalizeMarkdown(stripFrontmatter(cleaned));
            const excerpt = makeExcerpt(normalized);
            if (!aborted && excerpt) setSummaryCache((prev) => ({ ...prev, [key]: excerpt }));
          } catch {}
        })
      );
    }
    loadExcerpts();
    return () => {
      aborted = true;
    };
  }, [manifest, cat, month, summaryCache]);
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
        const res = await fetch(asset('/' + String(p.url).replace(/^\//,'')), { cache: "no-store" });
        md = await res.text();
      } catch {
        md = "（加载 Markdown 失败）";
      }
    }
    
    // 保存原始 Markdown 供 H2 组件使用
    (window as any).__rawMarkdown = md;
    setRawMd(md);
    
    const cleaned = stripLeadingTocAndIntro(stripFirstHeading(md, p.title));
    const normalized = normalizeMarkdown(stripFrontmatter(cleaned));
    const { md: finalMd, meta, toc } = parseMetaAndToc(normalized);
    setDetail({ ...p, _md: finalMd, _meta: meta, _toc: toc });
    setTocOpen(false);
  }

  // 构造当前页面的带参数 URL，并在新标签页中打开
  function openEntryInNewTab(p: Entry) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('date', p.date);
      if (p.title) url.searchParams.set('title', encodeURIComponent(p.title));
      // 当前分类参数，便于定位
      if (cat) url.searchParams.set('cat', String(cat));
      // 月份不是必须，但提供更快的定位
      if (month) url.searchParams.set('month', month);
      window.open(url.toString(), '_blank', 'noopener');
    } catch {
      // 回退：若 URL API 不可用，直接打开原始 md（若存在）
      if (p.url) {
        const u = asset('/' + String(p.url).replace(/^\//,''));
        window.open(u, '_blank', 'noopener');
      }
    }
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
  
  // ---------------- Mobile Drawer: section cards (target.html-alike) ----------------
  type Section = { title: string; body: string };
  function splitByH2(md: string): Section[] {
    const lines = String(md || '').split('\n');
    const out: Section[] = [];
    let curTitle: string | null = null;
    let buf: string[] = [];
    for (const line of lines) {
      const m = /^##\s+(.+)$/.exec(line);
      if (m) {
        if (curTitle) out.push({ title: curTitle, body: buf.join('\n').trim() });
        curTitle = m[1].trim();
        buf = [];
      } else {
        if (curTitle) buf.push(line);
      }
    }
    if (curTitle) out.push({ title: curTitle, body: buf.join('\n').trim() });
    return out;
  }
  function parseDocMeta(md: string): { category?: string; sources: { label: string; href: string }[] } {
    const head = md.split('\n').slice(0, 30).join('\n');
    const meta = parseSectionMeta(head);
    return meta;
  }
  function stripMdInline(s: string): string {
    return String(s || '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
      .replace(/[#>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function parseSectionMeta(sectionMd: string): { category?: string; sources: { label: string; href: string }[] } {
    // 更宽松：逐行扫描前 12 行，仅找以 '>' 开头的引文行；
    // 兼容是否加粗、冒号缺失/错位、奇怪字符（如 U+FFFD）
    const lines = sectionMd.split('\n').slice(0, 12);
    let category: string | undefined;
    let srcText: string | undefined;
    for (const raw of lines) {
      const t = raw.trim();
      if (!t.startsWith('>')) continue;
      // 去掉引文起始和装饰符
      const s = t.replace(/^>\s*/, '').replace(/\*\*/g, '').trim();
      // 若包含“分类”，截取“分类”之后所有字符作为值
      if (s.includes('分类') && category === undefined) {
        const idx = s.indexOf('分类');
        let v = s.slice(idx + 2); // 跳过“分类”二字
        v = v.replace(/^[：:，、\-\|\s]+/, '').trim();
        if (v) category = v;
      }
      // 若包含“来源”，截取其后内容为源文本
      if (s.includes('来源') && srcText === undefined) {
        const idx = s.indexOf('来源');
        let v = s.slice(idx + 2);
        v = v.replace(/^[：:，、\-\|\s]+/, '').trim();
        if (v) srcText = v;
      }
    }
    // 从源文本提取链接或纯文本源
    const sources: { label: string; href: string }[] = [];
    if (srcText) {
      const links = extractLinks(srcText);
      if (links.length) {
        links.forEach(l => sources.push(l));
      } else {
        srcText.split(/[，、,\s]+/).filter(Boolean).forEach(label => sources.push({ label, href: '#' }));
      }
    }
    return { category, sources };
  }
  function parseSectionBody(body: string): { insight?: string; bullets: string[] } {
    const lines = String(body || '').split('\n');
    let insight: string | undefined;
    const bullets: string[] = [];
    let inSummary = false;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const t = raw.trim();
      if (!t) continue;
      if (t.startsWith('>')) continue; // skip meta quotes
      // 宽松识别“核心洞察”
      if (!insight && t.includes('核心洞察')) {
        let seg = t.slice(t.indexOf('核心洞察') + '核心洞察'.length);
        // 清理分隔符与标记
        seg = seg.replace(/^[\s\*:_：�，、\-\|]+/, '').replace(/\*\*/g, '');
        // 若同一行还有“内容简介”，分割并进入简介模式
        const cut = seg.indexOf('内容简介');
        if (cut >= 0) {
          const left = seg.slice(0, cut).trim();
          if (left) insight = stripMdInline(left);
          inSummary = true;
        } else if (seg) {
          insight = stripMdInline(seg);
        } else {
          // 下一段作为洞察
          const buf: string[] = [];
          for (let j = i + 1; j < lines.length; j++) {
            const s = lines[j].trim();
            if (!s) break;
            if (s.includes('内容简介') || s.includes('核心洞察')) break;
            if (s.startsWith('>')) break;
            buf.push(s);
          }
          if (buf.length) insight = stripMdInline(buf.join(' '));
        }
        continue;
      }
      // 宽松识别“内容简介”行
      if (t.includes('内容简介')) { inSummary = true; continue; }
      if (inSummary) {
        if (/^(\-|\*|\+|\d+[.)])\s+/.test(t)) {
          const b = t.replace(/^(\-|\*|\+|\d+[.)])\s+/, '');
          bullets.push(stripMdInline(b));
        }
      }
    }
    // 回退：若没有显式“内容简介：”，则抓取整段中的前几条列表
    if (bullets.length === 0) {
      for (const raw of lines) {
        const t = raw.trim();
        if (/^(\-|\*|\+|\d+[.)])\s+/.test(t)) {
          bullets.push(stripMdInline(t.replace(/^(\-|\*|\+|\d+[.)])\s+/, '')));
        }
      }
    }
    return { insight, bullets };
  }
  function MobileNewsCard({ title, category, sources, insight, bullets }: { title: string; category?: string; sources?: { label: string; href: string }[]; insight?: string; bullets: string[]; }) {
    const [expanded, setExpanded] = useState(false);
    const showBullets = bullets && bullets.length > 0;
    return (
      <article className="news-item overflow-hidden rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-[#2E2E2E] dark:shadow-[0_2px_8px_rgba(0,0,0,0.30)]">
        <h2 className="news-title mb-3 text-[18px] font-semibold leading-snug text-slate-900 dark:text-white">{title}</h2>
        {(category || (sources && sources.length)) && (
          <div className="news-meta mb-4 flex flex-wrap gap-2">
            {category && (
              <span className="tag inline-flex items-center rounded-full border-0 bg-[#E2F0FA] px-2.5 py-1 text-xs font-medium text-[#488DD7]">{category}</span>
            )}
            {(sources || []).map((s, idx) => (
              <a key={idx} href={s.href} target="_blank" rel="noreferrer" className="tag inline-flex items-center rounded-full border-0 bg-[#F2E4F2] px-2.5 py-1 text-xs font-medium text-[#7A2B94] hover:underline">
                {s.label}
              </a>
            ))}
          </div>
        )}
        {insight && (
          <div className="insight-section mb-4 rounded-xl p-4 bg-gradient-to-br from-indigo-500 to-purple-600 text-white dark:bg-gradient-to-br dark:from-indigo-500/35 dark:via-purple-500/35 dark:to-fuchsia-500/35 dark:text-white dark:ring-1 dark:ring-purple-400/20">
            <div className="insight-label mb-1.5 text-[12px] font-semibold text-white/90">💡 核心洞察</div>
            <div className="insight-content text-[14px] leading-6 text-white">{insight}</div>
          </div>
        )}
        <div className="summary-section rounded-xl bg-slate-50 p-4 dark:bg-[#404040]">
          <div className="summary-label mb-2 text-[12px] font-semibold text-slate-600 dark:text-white">📝 内容简介</div>
          {showBullets ? (
            <div className={expanded ? '' : 'relative max-h-[200px] overflow-hidden'}>
              <ul className="summary-list list-none space-y-2">
                {bullets.map((b, i) => (
                  <li key={i} className="relative pl-5 text-[14px] leading-6 text-slate-800 dark:text-[#C0C0C0]">
                    <span className="absolute left-0 text-[#557FFF]">•</span>
                    {b}
                  </li>
                ))}
              </ul>
              {!expanded && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-b from-transparent to-slate-50 dark:to-[#404040]" />
              )}
            </div>
          ) : (
            <div className="text-[14px] leading-6 text-slate-700 dark:text-white">暂无简介</div>
          )}
          {showBullets && (
            <button onClick={() => setExpanded(!expanded)} className={"expand-btn mt-3 inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-[13px] text-slate-600 active:scale-95 dark:bg-[#4F4F4F] dark:text-white"}>
              {expanded ? '收起' : '展开更多'}
            </button>
          )}
        </div>
      </article>
    );
  }
  function MobileRelatedSection({ body }: { body: string }) {
    const links = extractLinks(body);
    if (!links.length) return null;
    return (
      <section className="mt-6 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-[#2E2E2E] dark:shadow-[0_2px_8px_rgba(0,0,0,0.30)]">
        <h3 className="mb-4 flex items-center text-[16px] font-semibold text-slate-900 dark:text-slate-100">
          <span className="mr-2">🔗</span> 其他相关资讯
        </h3>
        <ul className="space-y-2.5">
          {links.map((l, i) => (
            <li key={i} className="related-item rounded-xl bg-slate-50 px-3 py-2.5 text-[14px] leading-6 ring-1 ring-black/5 transition-colors dark:bg-[#404040] dark:ring-white/5 dark:hover:bg-[#474747]">
              <a className="related-link block text-[#1976d2] hover:underline dark:text-[#64b5f6]" href={l.href} target="_blank" rel="noreferrer">
                {l.label || l.href}
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  }
  function MobileNewsSectionList({ rawMd }: { rawMd: string; md: string }) {
    const rawSections = useMemo(() => splitByH2(rawMd || ''), [rawMd]);
    const docMeta = useMemo(() => parseDocMeta(rawMd || ''), [rawMd]);
    if (!rawSections.length) return null;
    const relatedIndex = rawSections.findIndex(s => /^其他相关资讯/.test(String(s.title).trim()));
    const newsSections = relatedIndex >= 0 ? rawSections.filter((_, idx) => idx !== relatedIndex) : rawSections;
    const relatedBody = relatedIndex >= 0 ? rawSections[relatedIndex].body : '';
    return (
      <div className="news-container space-y-4 px-0 py-3">
        {newsSections.map((s, i) => {
          const meta = parseSectionMeta(s.title + '\\n' + s.body);
          if (!meta.category && docMeta.category) meta.category = docMeta.category;
          if ((!meta.sources || meta.sources.length === 0) && docMeta.sources?.length) meta.sources = docMeta.sources;
          const parsed = parseSectionBody(s.body);
          return (
            <MobileNewsCard
              key={`${i}-${s.title}`}
              title={s.title}
              category={meta.category}
              sources={meta.sources}
              insight={parsed.insight}
              bullets={parsed.bullets}
            />
          );
        })}
        {relatedIndex >= 0 && <MobileRelatedSection body={relatedBody} />}
      </div>
    );
  }
  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:text-slate-100">
      {/* background orbs (dark only) */}
      <div className="pointer-events-none absolute -top-32 left-1/2 hidden h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-violet-600/30 to-teal-500/20 blur-3xl dark:block" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 hidden h-[420px] w-[420px] rotate-12 rounded-full bg-gradient-to-tr from-fuchsia-500/20 to-indigo-500/10 blur-3xl dark:block" />
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-white/10 dark:bg-slate-900/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <div className="group flex cursor-pointer items-center gap-3" onClick={() => setDetail(null)}>
            <div className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-teal-500 shadow-lg shadow-violet-800/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="hidden text-xs uppercase tracking-widest text-slate-500 dark:text-white sm:block">Daily • {manifest.categories?.[cat]}</div>
              <div className="-mt-0.5 font-semibold">日报精选 · {formatDate(todayIso)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-[#C0C0C0] dark:hover:bg-white/10"
            >
              {!mounted ? (
                // 服务器端和客户端挂载前显示占位符，避免 hydration 错误
                <div className="h-4 w-4" />
              ) : theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">主题</span>
            </button>
            <button onClick={exportRSS} className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-[#C0C0C0] dark:hover:bg-white/10">
              <Rss className="h-4 w-4" /> <span className="hidden sm:inline">RSS</span>
            </button>
            <a
              href="https://github.com/moxxiran/daily-site"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-[#C0C0C0] dark:hover:bg-white/10"
            >
              <Github className="h-4 w-4" /> <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>
      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pb-2 pt-6 sm:pt-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/60 p-4 shadow-xl dark:border-white/10 dark:bg-white/5 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Category segmented control */}
            <div className="relative isolate flex w-full overflow-hidden rounded-full bg-slate-100 p-1 ring-1 ring-slate-200 dark:bg-slate-950/40 dark:ring-white/10">
              {Object.keys(manifest.categories || {}).map((k) => (
                <button
                  key={k}
                  onClick={() => {
                    setCat(k as any);
                    const mm = Object.keys(manifest.months?.[k as keyof Manifest["months"]] || {}).sort().reverse();
                    if (mm[0]) setMonth(mm[0]);
                    setDetail(null);
                  }}
                  className={cx(
                    "relative z-10 flex-1 min-w-0 px-3 py-2 text-center text-sm font-medium transition sm:px-4",
                    cat === k ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-white"
                  )}
                >
                  <span className="flex items-center justify-center gap-2">
                    {(k as string) === "ai" ? <Newspaper className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    {manifest.categories?.[k]}
                  </span>
                </button>
              ))}
              {/* active pill */}
              <motion.span
                aria-hidden
                className="absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-tr from-violet-400 to-teal-300 shadow-inner"
                animate={{ x: cat === 'ai' ? '0%' : '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
          </div>
            {/* Search */}
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题/标签/摘要…"
                className="w-full rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 shadow-inner outline-none ring-1 ring-transparent focus:border-slate-300 focus:ring-slate-200 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-white/20 dark:focus:ring-white/10"
                aria-label="搜索文章"
                role="searchbox"
            />
            </div>
          </div>
          {/* month scroller */}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={() => scrollMonths(-1)} className="rounded-xl border border-slate-200 bg-white/70 p-2 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
            <div ref={monthScrollerRef} className="flex w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-2">
              {months.map((m) => (
                <motion.button
                  key={m}
                  onClick={() => setMonth(m)}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cx(
                    "snap-start rounded-2xl border px-4 py-2 text-sm",
                    m === month
                      ? "border-violet-400/40 bg-gradient-to-tr from-violet-500/20 to-teal-400/10 text-slate-900 dark:text-slate-50"
                      : "border-slate-200 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  )}
                >
                  {m}
                </motion.button>
              ))}
            </div>
            <button onClick={() => scrollMonths(1)} className="rounded-xl border border-slate-200 bg-white/70 p-2 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </motion.div>
      </section>
      {/* content */}
      <main className="mx-auto max-w-6xl px-4 pb-10 pt-2 sm:pt-4">
        <AnimatePresence mode="popLayout">
        {entries.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-6 grid place-items-center rounded-3xl border border-slate-200 bg-white/60 p-12 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              本月暂无数据或被搜索过滤。
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              layout
              className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
            >
            {entries.map((p) => (
                <motion.article
                key={`${p.date}-${p.title}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.25 }}
                  className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-lg dark:border-white/10 dark:from-slate-900/60 dark:to-slate-950/60"
                >
                  {/* card glow */}
                  <div className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden>
                    <div className="absolute -inset-px rounded-[22px] bg-gradient-to-r from-violet-500/15 via-teal-400/10 to-fuchsia-400/10 blur-xl" />
                  </div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs dark:text-white/80">
                    <Calendar className="h-4 w-4" />
                    <span className="tabular-nums">{formatDate(p.date)}</span>
                  <span>·</span>
                    <span>{readingTime(p.content || p.summary) || 1} 分钟</span>
                </div>
                  <h3 className="line-clamp-1 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-lg">
                    {p.title}
                  </h3>
                  {(cleanSummary(p.summary) || summaryCache[`${p.date}-${p.title}`]) && (
                    <p className="mt-2 sm:mt-2.5 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-white/90">
                      {cleanSummary(p.summary) || summaryCache[`${p.date}-${p.title}`]}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-end">
                    <motion.button
                    onClick={() => openEntryInNewTab(p)}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:hover:bg-white/20"
                    >
                      阅读全文 <ChevronRight className="h-4 w-4" />
                    </motion.button>
                </div>
                </motion.article>
            ))}
            </motion.div>
        )}
        </AnimatePresence>
      </main>
      {/* detail drawer */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              ref={detailScrollRef}
              className="relative h-screen w-full overflow-y-auto scroll-smooth rounded-none border-0 bg-white shadow-none dark:bg-[#1E1E1E] sm:h-[92vh] sm:max-w-[1200px] sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-2xl sm:dark:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-3 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/70 sm:px-5">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/90">
                  <Calendar className="h-4 w-4" />
                  <span className="tabular-nums">{formatDate(detail.date)}</span>
                  {/* 去掉阅读时长以缩窄宽度 */}
                  </div>
                  <button
                    onClick={() => setDetail(null)}
                  className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-[#C0C0C0] dark:hover:bg-white/10"
                  >
                    关闭
                  </button>
                </div>
              <div className="w-full px-2 py-3 sm:mx-auto sm:max-w-[1100px] sm:px-6 sm:py-8">
                {/* H1 */}
                <h1 className="mb-3 whitespace-nowrap text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">{detail.title}</h1>
                {/* meta row - 显示日报整体信息而非单条新闻信息 */}
                <div className="mb-4 flex flex-wrap items-center gap-2 detail-meta">
                  <span className="chip chip--meta">
                    <Newspaper className="h-3.5 w-3.5" /> 
                    游戏行业日报
                  </span>
                  <span className="chip chip--meta">
                    <Calendar className="h-3.5 w-3.5" /> 
                    {formatDate(detail.date)}
                  </span>
                  <span className="chip chip--meta">
                    <FileText className="h-3.5 w-3.5" /> 
                    {detail._toc?.length || 0} 条资讯
                  </span>
                </div>
                {/* mini TOC */}
                {Array.isArray(detail._toc) && detail._toc.length > 0 ? (
                  <div className="hidden sm:block mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 mini-toc dark:border-white/10 dark:bg-white/5">
                    <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-white flex items-center">
                      <span aria-hidden="true" className="mr-1">📋</span>
                      <span>本期内容</span>
                    </h3>
                    <button onClick={() => setTocOpen((v)=>!v)} className="mb-2 rounded-full px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10">{tocOpen ? '收起' : '展开'}</button>
                    <div className="flex justify-center">
                      <button onClick={() => setTocOpen((v)=>!v)} aria-label={tocOpen ? '收起目录' : '展开目录'} className="mt-1 mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-white dark:hover:bg-white/10">
                        <span className={cx('transition-transform', tocOpen ? 'rotate-180' : '')}>▾</span>
                      </button>
                    </div>
                    <div className={cx('grid gap-2 mt-2', tocOpen ? '' : 'hidden')}>
                      {detail._toc.map((item, idx) => (
                        <a
                          key={`toc-${idx}-${item.id}`}
                          href={`#${item.id}`}
                          className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-teal-600 dark:text-white dark:hover:bg-white/5 dark:hover:text-teal-300"
                        >
                          <span className="flex-1 leading-5">{item.text}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {/* Mobile section cards */}
                <div className="block sm:hidden">
                  {detail._md ? (
                    <MobileNewsSectionList rawMd={rawMd} md={detail._md || ''} />
                  ) : null}
                </div>
                <article className="markdown-body p-2 sm:p-5 hidden sm:block">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
                    {detail._md || "（暂无内容）"}
                  </ReactMarkdown>
                </article>
                {/* footer actions (removed copy button as requested) */}
              </div>
              {/* 抽屉内悬浮返回顶部（随抽屉滚动视口固定） */}
              <AnimatePresence>
                {showBackToTop && (
                  <div className="sticky bottom-5 z-20 flex w-full justify-end px-5 pointer-events-none">
                    <motion.button
                      key="back-to-top"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      onClick={() => detailScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                      aria-label="返回顶部"
                      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-md backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:hover:bg-white/20"
                    >
                      <ArrowUp className="h-4 w-4" /> 顶部
                    </motion.button>
                  </div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* footer */}
      <footer className="border-t border-slate-200 px-4 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:text-slate-400">
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


