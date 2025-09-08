'use client';

import { useEffect, useMemo, useState } from 'react';

type Entry = { date: string; title: string; url: string; summary?: string; tags?: string[] };
type MonthsByCategory = Record<string, Entry[]>;
type Manifest = {
  site?: { baseUrl?: string };
  months?: { ai?: MonthsByCategory; game?: MonthsByCategory };
};

// 既能在本地开发（无 basePath），又能在 GitHub Pages（/daily-site）跑
function detectBase() {
  if (typeof window === 'undefined') return '';
  // 如果路径里包含 /daily-site，说明在 GitHub Pages 的项目页
  return window.location.pathname.startsWith('/daily-site') ? '/daily-site' : '';
}

export default function GameDailyPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = useMemo(() => detectBase(), []);

  useEffect(() => {
    // 先按环境猜测 base，去取 manifest.json
    fetch(`${base}/manifest.json`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Manifest) => setManifest(data))
      .catch((e) => setError(`读取 manifest 失败：${String(e)}`));
  }, [base]);

  if (error) {
    return <main className="p-6">
      <h1>游戏日报</h1>
      <p>{error}</p>
      <p>请确认仓库里存在 <code>public/manifest.json</code>，并已成功部署。</p>
    </main>;
  }

  if (!manifest) {
    return <main className="p-6">加载中…</main>;
  }

  const gameMonths = manifest.months?.game || {};
  const months = Object.keys(gameMonths).sort().reverse(); // 例如：2025-09, 2025-08 …

  if (months.length === 0) {
    return <main className="p-6">
      <h1>游戏日报</h1>
      <p>还没有任何内容。请先用 <code>dify_publisher.py</code> 推送一篇“🎮/游戏行业速递”分类的 Markdown。</p>
    </main>;
  }

  return (
    <main className="prose mx-auto p-6">
      <h1>游戏日报</h1>
      {months.map(m => (
        <section key={m}>
          <h2>{m}</h2>
          <ul>
            {gameMonths[m].map((e) => (
              <li key={`${e.date}-${e.url}`}>
                {/* 直接链接到静态 .md 文件；先实现“能看见”，之后再做精美渲染 */}
                <a href={`${base}/${e.url}`}>{e.title}</a>
                <small>（{e.date}）</small>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
