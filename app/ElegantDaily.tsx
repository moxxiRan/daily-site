/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Moon, Sun, Rss, Github, CalendarDays as Calendar,
  Search, ChevronLeft, ChevronRight, Sparkles, Newspaper, Menu, X,
  ExternalLink, Lightbulb, ArrowUp, FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import hljs from "highlight.js";

// 鏀惧湪 import 涔嬪悗
function getTextFromChildren(children: any): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(getTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    return getTextFromChildren((children as any).props.children);
  }
  return "";
}

// 娓呯悊鍗＄墖鎽樿寮€澶寸殑鈥滒煄?娓告垙琛屼笟閫熼€?+ 鏃ユ湡鈥濆墠缂€
function cleanSummary(input?: string): string | undefined {
  if (!input) return input;
  const s = String(input);
  const cleaned = s
    // 鍘绘帀鍙€夌殑鎵嬫焺 emoji銆佺┖鏍笺€佸垎闅旂鍜屾棩鏈燂紝濡傦細馃幃 娓告垙琛屼笟閫熼€?2025骞?9鏈?9鏃?    .replace(/^[\u{1F3AE}\s]*娓告垙琛屼笟閫熼€抃s*[-鈥?锛歖*\s*\d{4}骞碶d{2}鏈圽d{2}鏃??:\s*\([^\)]*\))?\s*/u, "")
    .trimStart();
  return cleaned;
}

const mdComponents = {
  // 闅愯棌鍒嗙被/鏉ユ簮鐨勫紩鐢ㄥ潡锛屽洜涓烘垜浠細鍦?H2 涓樉绀?  blockquote: ({ children, ...rest }: any) => {
    const textContent = getTextFromChildren(children);
    const isMetaBlock = textContent.includes('鍒嗙被锛?) || textContent.includes('鏉ユ簮锛?);

    if (isMetaBlock) {
      return null; // 闅愯棌 meta 寮曠敤鍧?    }

    return (
      <blockquote
        {...rest}
        className="my-4 rounded-lg border-l-2 border-sky-400/30 bg-white/40 px-4 py-3 text-slate-700 dark:border-sky-300/30 dark:bg-white/5 dark:text-slate-200"
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
    
    // 浠庡師濮?Markdown锛堟湭缁忚繃 parseMetaAndToc 澶勭悊鐨勶級涓彁鍙?meta 淇℃伅
    const extractMetaForH2 = (h2Title: string) => {
      const rawMarkdown = (window as any).__rawMarkdown || '';
      if (!rawMarkdown) return null;
      
      // 鎵惧埌杩欎釜 H2 鏍囬鐨勪綅缃?      const titlePattern = `## ${h2Title}`;
      const titleIndex = rawMarkdown.indexOf(titlePattern);
      if (titleIndex === -1) return null;
      
      // 浠庢爣棰樹綅缃紑濮嬶紝鎵惧埌涓嬩竴涓?## 鎴栨枃妗ｇ粨鏉?      const nextH2Index = rawMarkdown.indexOf('\n## ', titleIndex + titlePattern.length);
      const sectionEnd = nextH2Index === -1 ? rawMarkdown.length : nextH2Index;
      const section = rawMarkdown.slice(titleIndex, sectionEnd);
      
      // 鎻愬彇鍒嗙被鍜屾潵婧?      const categoryMatch = section.match(/>\s*\*\*鍒嗙被锛歕*\*\s*([^\n\r]+)/);
      const sourceMatch = section.match(/>\s*\*\*鏉ユ簮锛歕*\*\s*([^\n\r]+)/);
      
      const result: { category?: string; sources?: { label: string; href: string }[] } = {};
      
      if (categoryMatch) {
        result.category = categoryMatch[1].trim();
      }
      
      if (sourceMatch) {
        const sourceText = sourceMatch[1].trim();
        const sources: { label: string; href: string }[] = [];
        
        // 瑙ｆ瀽閾炬帴鏍煎紡 [鏂囨湰](閾炬帴)
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
  url?: string;            // 鐩稿璺緞 md 鏂囦欢锛屽 "game/2025/09/08.md"
  content?: string;        // 涔熷彲鐩存帴鍐呰仈 md
  _md?: string;            // 杩愯鏈熻В鏋愬悗鐨?md 鏂囨湰
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
  const weekday = "鏃ヤ竴浜屼笁鍥涗簲鍏?[d.getDay()];
  return `${y}-${m}-${dd}锛堝懆${weekday}锛塦;
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
// 澶勭悊闈欐€佽祫婧愬墠缂€锛圙itHub Pages basePath锛?function asset(path: string): string {
  try {
    const prefix = (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.assetPrefix) || '';
    const p = path.startsWith('/') ? path : '/' + path;
    return (prefix ? prefix.replace(/\/$/, '') : '') + p;
  } catch {
    return path;
  }
}
// 闄勫姞鏋勫缓鐗堟湰鍙傛暟锛岄伩鍏?CDN/娴忚鍣ㄧ紦瀛?function withBuildTag(u: string): string {
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
    .replace(/\uFEFF/g, "")      // 鍘?BOM/闆跺
    .replace(/\r\n/g, "\n")      // 缁熶竴鎹㈣
    // 寮曠敤鍚庤嫢涓嬩竴琛屼笉鏄?'>' 鎴栫┖琛岋紝琛ヤ竴琛岀┖琛岋紝閬垮厤 lazy continuation
    .replace(/(^>.*\n)(?!>|\n)/gm, "$1\n")
    // 娈佃惤/鏍囬/寮曠敤 涔嬪悗鑻ョ洿鎺ュ紑濮嬪垪琛紝鍒欒ˉ绌鸿锛岀‘淇濊瘑鍒垪琛?    .replace(/([^\n>])\n(- |\* |\d+[.)銆乚 )/g, "$1\n\n$2")
    // 灏嗙矖浣撴彁绀鸿浆涓哄皬鏍囬锛屾彁鍗囧彲璇绘€?    .replace(/^\*\*鏍稿績娲炲療锛歕*\*\s*/gm, "## 鏍稿績娲炲療\n\n")
    .replace(/^\*\*鍐呭绠€浠嬶細\*\*\s*/gm, "## 鍐呭绠€浠媆n\n");
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

  // 鎻愬彇鍒嗙被
  const catMatch = out.match(/^>\s*\*\*鍒嗙被锛歕*\*\s*([^\n]+)$/m);
  if (catMatch) {
    meta.category = catMatch[1].trim();
    out = out.replace(catMatch[0] + "\n", "");
  }
  // 鎻愬彇鏉ユ簮锛堝彲鑳芥湁澶氫釜閾炬帴锛屼互椤垮彿/閫楀彿鍒嗛殧锛?  const srcMatch = out.match(/^>\s*\*\*鏉ユ簮锛歕*\*\s*([^\n]+)$/m);
  if (srcMatch) {
    meta.sources = extractLinks(srcMatch[1]);
    out = out.replace(srcMatch[0] + "\n", "");
  }

  // 鐢熸垚 TOC锛圚2锛屼粎淇濈暀鏂伴椈鏍囬锛岃繃婊も€滄牳蹇冩礊瀵?鍐呭绠€浠嬧€濓紝骞跺幓閲嶃€侀檺閲忥級
  const toc: { id: string; text: string }[] = [];
  const seen = new Set<string>();
  out.split("\n").forEach((line) => {
    const m = /^##\s+(.+)$/.exec(line);
    if (!m) return;
    const text = m[1].trim();
    if (text === "鏍稿績娲炲療" || text === "鍐呭绠€浠?) return;
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
  // 鍙湪纭疄瀛樺湪"浜哄伐鐩綍"鏃舵墠绉婚櫎锛堟娴嬫槸鍚︽湁杩炵画鐨勯摼鎺ュ垪琛級
  const lines = md.split('\n');
  let firstH2Index = -1;
  let hasLinkList = false;
  
  // 鎵惧埌绗竴涓?H2 鐨勪綅缃?  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^##\s+/)) {
      firstH2Index = i;
      break;
    }
  }
  
  if (firstH2Index > 5) { // 鍙湁褰?H1 鍜岀涓€涓?H2 涔嬮棿鏈夎冻澶熷唴瀹规椂鎵嶆鏌?    // 妫€鏌ユ槸鍚︽湁杩炵画鐨勯摼鎺ュ垪琛紙浜哄伐鐩綍鐨勭壒寰侊級
    let linkCount = 0;
    for (let i = 1; i < firstH2Index; i++) {
      if (lines[i].includes('](') && (lines[i].includes('銆?) || lines[i].includes('銆?))) {
        linkCount++;
      }
    }
    hasLinkList = linkCount >= 3; // 鑷冲皯3涓摼鎺ユ墠璁や负鏄汉宸ョ洰褰?  }
  
  if (hasLinkList && firstH2Index > -1) {
    return lines.slice(firstH2Index).join('\n');
  }
  return md;
}

/** ---------- Component ---------- */
export default function ElegantDaily() {
  const [manifest, setManifest] = useState<Manifest>({
    site: { title: "姣忔棩绮鹃€?, description: "", baseUrl: "" },
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [summaryCache, setSummaryCache] = useState<Record<string, string>>({});

  // 浠婃棩鏃ユ湡锛堟湰鍦版椂鍖猴級
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // 瀹㈡埛绔寕杞藉悗鍒濆鍖栦富棰橈紝閬垮厤 hydration 閿欒
  useEffect(() => {
    setMounted(true);
    // 浠?DOM 璇诲彇瀹為檯鐨勪富棰樼姸鎬?    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  // 涓婚鍒囨崲骞跺悓姝ユ牱寮?  useEffect(() => {
    const root = document.documentElement;
    // 鍙湁褰撲富棰樼湡鐨勬敼鍙樻椂鎵嶆洿鏂?DOM
    if (root.classList.contains('dark') !== (theme === 'dark')) {
      root.classList.toggle("dark", theme === "dark");
      root.style.colorScheme = theme;
    }

    const base = ""; // 浣跨敤鐩稿璺緞锛屽吋瀹?dev 涓?GitHub Pages 瀛愯矾寰?
    // 浠ｇ爜楂樹寒涓婚
    const hlId = "hljs-theme";
    let hlLink = document.getElementById(hlId) as HTMLLinkElement | null;
    if (!hlLink) {
      hlLink = document.createElement("link");
      hlLink.rel = "stylesheet";
      hlLink.id = hlId;
      document.head.appendChild(hlLink);
    }
    hlLink.href = `hljs/github${theme === "dark" ? "-dark" : ""}.css`;

    // Markdown 鏍峰紡
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

  // 鐩戝惉鎶藉眽鍐呴儴婊氬姩锛屾帶鍒惰繑鍥為《閮ㄦ寜閽樉闅?  useEffect(() => {
    const el = detailScrollRef.current;
    if (!el) {
      setShowBackToTop(false);
      return;
    }
    const onScroll = () => setShowBackToTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    // 鍒濆璁＄畻
    onScroll();
    return () => {
      el.removeEventListener('scroll', onScroll as any);
    };
  }, [detail]);

  // 鎷夊彇 manifest锛堜紭鍏堟牴鐩綍 ./manifest.json锛?  useEffect(() => {
    async function load() {
      try {
        let res = await fetch(withBuildTag('./manifest.json'), { cache: 'no-store', signal: AbortController && new AbortController().signal });
        if (!res.ok) {
          try { res = await fetch(withBuildTag(asset('/manifest.json')), { cache: 'no-store' }); } catch {}
        }
        const raw = (await res.json()) as any;
        const m: Manifest = {
          site: {
            title: raw.site?.title ?? raw.title ?? "姣忔棩绮鹃€?,
            description: raw.site?.description ?? raw.description ?? "",
            baseUrl: raw.site?.baseUrl ?? raw.baseUrl ?? "",
          },
          categories: raw.categories || {},
          months: raw.months || {},
        };
        setManifest(m);
        // 榛樿閫夌涓€涓湁鍐呭鐨勫垎绫?鏈€杩戞湀浠?        const cats = Object.keys(m.months) as (keyof Manifest["months"])[];
        const pickCat = cats.find((c) => Object.keys(m.months[c] || {}).length > 0) || (cats[0] as any) || "game";
        setCat(pickCat);
        const months = Object.keys(m.months[pickCat] || {}).sort().reverse();
        setMonth(months[0] || "");
      } catch {
        // 浣跨敤绌虹粨鏋勫厹搴曞苟鎻愬墠杩斿洖锛岄伩鍏嶆敞鍏ユ紨绀烘暟鎹?        setManifest({ site: { title: "", description: "", baseUrl: "" }, categories: { ai: "AI", game: "Game" }, months: { ai: {}, game: {} } });
        setCat("game");
        setMonth("");
        return;
        // 鍏滃簳锛氬唴缃竴浜涚ず渚嬫暟鎹紙濡傛灉 manifest 鎷夊け璐ワ級
        setManifest({
          site: { title: "姣忔棩绮鹃€?, description: "", baseUrl: "" },
          categories: { ai: "AI", game: "Game" },
          months: {
            ai: {
              "2025-08": [
                {
                  date: "2025-08-31",
                  title: "AI 鏃ユ姤 路 2025-08-31",
                  summary: "鏈堟湯瑙傚療锛氭帹鐞嗘垚鏈笌璇勬祴鍩虹嚎銆?,
                  tags: ["AI"],
                  content: "鈥?,
                },
              ],
            },
            game: {
              "2025-09": [
                {
                  date: "2025-09-03",
                  title: "娓告垙鏃ユ姤 路 2025-09-03",
                  summary: "鏂板搧銆佷拱閲忋€佺増鏈洿鏂颁笌鑺傜偣瑙傚療銆?,
                  tags: ["Game", "Daily"],
                  content: "鈥?,
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

  // 鏈堜唤鍒楄〃
  const months = useMemo(() => {
    const mm = Object.keys(manifest.months?.[cat] || {});
    return mm.sort().reverse();
  }, [manifest, cat]);

  // 褰撳墠鏈堜唤鐨勬潯鐩紙鍊掑簭锛屾敮鎸佹悳绱級
  const entries = useMemo(() => {
    const list = (manifest.months?.[cat]?.[month] || []).slice();
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const q = (query || "").toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.title, p.summary, (p.tags || []).join(" ")].join(" ").toLowerCase().includes(q)
    );
  }, [manifest, cat, month, query]);

  // 鎳掑姞杞芥憳瑕侊細鑻ユ竻鍗曚腑缂哄け summary锛屽垯鎶撳彇瀵瑰簲 Markdown 鎻愬彇棣栨
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
            if (!res.ok) return; // 鏂囦欢涓嶅瓨鍦ㄦ椂涓嶈鍐欏叆鎽樿
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
  }, [manifest, cat, month]);

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
        // p.url宸茬粡鏄浉瀵硅矾寰?'ai/2024/01/01.md'锛屾祻瑙堝櫒浼氳嚜鍔ㄥ鐞?        const res = await fetch(asset('/' + String(p.url).replace(/^\//,'')), { cache: "no-store" });
        md = await res.text();
      } catch {
        md = "锛堝姞杞?Markdown 澶辫触锛?;
      }
    }
    
    // 淇濆瓨鍘熷 Markdown 渚?H2 缁勪欢浣跨敤
    (window as any).__rawMarkdown = md;
    
    const cleaned = stripLeadingTocAndIntro(stripFirstHeading(md, p.title));
    const normalized = normalizeMarkdown(stripFrontmatter(cleaned));
    const { md: finalMd, meta, toc } = parseMetaAndToc(normalized);
    setDetail({ ...p, _md: finalMd, _meta: meta, _toc: toc });
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
  <title>${manifest.site.title} 路 ${curCatLabel} 路 ${month}</title>
  <link>${location.href.split("#")[0]}</link>
  <description>瀵煎嚭鑷?daily-site</description>
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
              <div className="hidden text-xs uppercase tracking-widest text-slate-500 dark:text-slate-300 sm:block">Daily 鈥?{manifest.categories?.[cat]}</div>
              <div className="-mt-0.5 font-semibold">鏃ユ姤绮鹃€?路 {formatDate(todayIso)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              {!mounted ? (
                // 鏈嶅姟鍣ㄧ鍜屽鎴风鎸傝浇鍓嶆樉绀哄崰浣嶇锛岄伩鍏?hydration 閿欒
                <div className="h-4 w-4" />
              ) : theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">涓婚</span>
            </button>
            <button onClick={exportRSS} className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
              <Rss className="h-4 w-4" /> <span className="hidden sm:inline">RSS</span>
            </button>
            <a
              href="https://github.com/moxxiran/daily-site"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
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
                    cat === k ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-300"
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
                placeholder="鎼滅储鏍囬/鏍囩/鎽樿鈥?
                className="w-full rounded-2xl border border-slate-200 bg-white/80 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 shadow-inner outline-none ring-1 ring-transparent focus:border-slate-300 focus:ring-slate-200 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-white/20 dark:focus:ring-white/10"
                aria-label="鎼滅储鏂囩珷"
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
                      : "border-slate-200 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
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
              className="mt-6 grid place-items-center rounded-3xl border border-slate-200 bg-white/60 p-12 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              鏈湀鏆傛棤鏁版嵁鎴栬鎼滅储杩囨护銆?            </motion.div>
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

                  <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-500 sm:text-xs dark:text-slate-300/80">
                    <Calendar className="h-4 w-4" />
                    <span className="tabular-nums">{formatDate(p.date)}</span>
                  <span>路</span>
                    <span>{readingTime(p.content || p.summary) || 1} 鍒嗛挓</span>
                </div>

                  <h3 className="line-clamp-1 text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-lg">
                    {p.title}
                  </h3>
                  {(cleanSummary(p.summary) || summaryCache[`${p.date}-${p.title}`]) && (
                    <p className="mt-2 sm:mt-2.5 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300/90">
                      {cleanSummary(p.summary) || summaryCache[`${p.date}-${p.title}`]}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-end">
                    <motion.button
                    onClick={() => openDetail(p)}
                      whileTap={{ scale: 0.98 }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-medium text-slate-700 backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:hover:bg-white/20"
                    >
                      闃呰鍏ㄦ枃 <ChevronRight className="h-4 w-4" />
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
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 24, stiffness: 260 }}
              ref={detailScrollRef}
              className="relative h-[92vh] w-full max-w-[1200px] overflow-y-auto scroll-smooth rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-5 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/70">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300/90">
                  <Calendar className="h-4 w-4" />
                  <span className="tabular-nums">{formatDate(detail.date)}</span>
                  <span>路 {readingTime(detail._md)} 鍒嗛挓</span>
                  </div>
                  <button
                    onClick={() => setDetail(null)}
                  className="rounded-xl border border-slate-200 bg-white/70 px-3 py-1.5 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    鍏抽棴
                  </button>
                </div>
              <div className="mx-auto w-full max-w-[1100px] px-6 py-8">
                {/* H1 */}
                <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{detail.title}</h1>

                {/* meta row - 鏄剧ず鏃ユ姤鏁翠綋淇℃伅鑰岄潪鍗曟潯鏂伴椈淇℃伅 */}
                <div className="mb-4 flex flex-wrap items-center gap-2 detail-meta">
                  <span className="chip chip--meta">
                    <Newspaper className="h-3.5 w-3.5" /> 
                    娓告垙琛屼笟鏃ユ姤
                  </span>
                  <span className="chip chip--meta">
                    <Calendar className="h-3.5 w-3.5" /> 
                    {formatDate(detail.date)}
                  </span>
                  <span className="chip chip--meta">
                    <FileText className="h-3.5 w-3.5" /> 
                    {detail._toc?.length || 0} 鏉¤祫璁?                  </span>
                </div>

                {/* mini TOC */}
                {Array.isArray(detail._toc) && detail._toc.length > 0 ? (
                  <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 mini-toc dark:border-white/10 dark:bg-white/5">
                    <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                      馃搵 鏈湡鍐呭 ({detail._toc.length} 鏉?
                    </h3>
                    <div className="grid gap-2">
                      {detail._toc.map((item, idx) => (
                        <a
                          key={`toc-${idx}-${item.id}`}
                          href={`#${item.id}`}
                          className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-teal-600 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-teal-300"
                        >
                          <span className="mt-1 text-xs text-slate-400 dark:text-slate-500 group-hover:text-teal-500">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="flex-1 leading-5">{item.text}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                <article className="markdown-body p-2 sm:p-5">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={mdComponents}>
                    {detail._md || "锛堟殏鏃犲唴瀹癸級"}
                  </ReactMarkdown>
                </article>

                {/* footer actions */}
                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    onClick={() => {
                      const text = `${detail.title} - ${location.href.split('#')[0]}`;
                      navigator.clipboard?.writeText(text);
                    }}
                    className="rounded-lg border border-slate-200 bg-white/70 px-3 py-1.5 text-sm hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    澶嶅埗鏍囬+閾炬帴
                  </button>
                </div>
              </div>

              {/* 鎶藉眽鍐呮偓娴繑鍥為《閮紙闅忔娊灞夋粴鍔ㄨ鍙ｅ浐瀹氾級 */}
              <AnimatePresence>
                {showBackToTop && (
                  <div className="sticky bottom-5 z-20 flex w-full justify-end px-5 pointer-events-none">
                    <motion.button
                      key="back-to-top"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      onClick={() => detailScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                      aria-label="杩斿洖椤堕儴"
                      className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-md backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:hover:bg-white/20"
                    >
                      <ArrowUp className="h-4 w-4" /> 椤堕儴
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
            鏈ず渚嬶細<strong>React + Tailwind + Framer Motion</strong>锛堥浂鍚庣锛夈€?            鏁版嵁鏉ヨ嚜 <code>manifest.json</code> 鎴栧唴缃瀛愶紱鏉＄洰鍙敤 <code>url</code> 鎸囧悜鐙珛 Markdown 鏂囦欢銆?          </p>
        </div>
      </footer>
    </div>
  );
}
