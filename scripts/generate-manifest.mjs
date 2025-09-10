// Build-time manifest generator
// Scans public/{ai,game}/YYYY/MM/DD.md and emits public/manifest.json
// No external deps; tolerant frontmatter parser.

import { promises as fs } from 'fs';
import path from 'path';

const PUB_DIR = path.resolve('public');
const CATS = ['ai', 'game'];

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function toPosix(p) { return p.split(path.sep).join('/'); }

function parseFrontmatter(text) {
  const fm = { title: undefined, date: undefined, tags: undefined, summary: undefined };
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return fm;
  let i = 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') { i++; break; }
    const m = /^(\w+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (['title', 'date', 'summary'].includes(key)) {
      fm[key] = val.replace(/^"|"$/g, '');
    } else if (key === 'tags') {
      // tags: [a, b] | or multiline list - a\n- b
      if (val.startsWith('[')) {
        fm.tags = val.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
      } else {
        const arr = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim().startsWith('-')) { arr.push(lines[j].replace(/^\s*-\s*/, '')); j++; }
        if (arr.length) fm.tags = arr;
      }
    }
  }
  return fm;
}

function firstParagraph(md) {
  const lines = md.split(/\r?\n/);
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) continue;
    if (/^#{1,6}\s/.test(t)) continue; // heading
    if (/^>/.test(t)) continue; // blockquote
    if (/^(\-|\*|\+|\d+\.)\s/.test(t)) continue; // list
    const plain = t.replace(/[`*_#>\[\]\(\)!]/g, '').replace(/\s+/g, ' ');
    if (plain) return plain.slice(0, 160);
  }
  return '';
}

async function readSiteDefaults() {
  // prefer root manifest for site meta if exists
  const rootManifest = path.resolve('manifest.json');
  if (await fileExists(rootManifest)) {
    try { return JSON.parse(await fs.readFile(rootManifest, 'utf8')).site || {}; } catch {}
  }
  return { title: 'AI / 游戏 日报', description: '每天 10 分钟，跟上进展', baseUrl: '' };
}

async function main() {
  const months = { ai: {}, game: {} };
  for (const cat of CATS) {
    const base = path.join(PUB_DIR, cat);
    if (!(await fileExists(base))) continue;
    const years = await fs.readdir(base).catch(() => []);
    for (const y of years) {
      const yDir = path.join(base, y);
      const statY = await fs.stat(yDir).catch(() => null);
      if (!statY?.isDirectory()) continue;
      const mDirs = await fs.readdir(yDir).catch(() => []);
      for (const m of mDirs) {
        const mDir = path.join(yDir, m);
        const statM = await fs.stat(mDir).catch(() => null);
        if (!statM?.isDirectory()) continue;
        const files = await fs.readdir(mDir).catch(() => []);
        for (const f of files) {
          if (!f.endsWith('.md')) continue;
          const d = f.replace(/\.md$/, '');
          const date = `${y}-${m}-${d}`;
          const abs = path.join(mDir, f);
          const rel = toPosix(path.relative(PUB_DIR, abs)); // e.g. game/2025/09/09.md
          const raw = await fs.readFile(abs, 'utf8');
          const fm = parseFrontmatter(raw);
          // title
          let title = fm.title;
          if (!title) {
            const m1 = raw.match(/^#\s+(.+)$/m);
            title = m1 ? m1[1].trim() : `${cat === 'game' ? '游戏行业速递' : 'AI 日报'} - ${y}年${m}月${d}日`;
          }
          // summary
          let summary = fm.summary || firstParagraph(raw);
          const tags = Array.isArray(fm.tags) ? fm.tags : (cat === 'game' ? ['Game','Daily'] : ['AI','Daily']);
          const monthKey = `${y}-${m}`;
          months[cat][monthKey] ||= [];
          months[cat][monthKey].push({ date, title, summary, tags, url: rel });
        }
      }
    }
    // sort month entries desc by date
    for (const key of Object.keys(months[cat])) {
      months[cat][key].sort((a,b)=> String(b.date).localeCompare(String(a.date)));
    }
  }

  const site = await readSiteDefaults();
  const manifest = {
    site,
    categories: { ai: 'AI 日报', game: '游戏日报' },
    months,
  };

  const out = path.join(PUB_DIR, 'manifest.json');
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[generate-manifest] wrote ${toPosix(path.relative(process.cwd(), out))}`);
}

main().catch((e) => { console.error('[generate-manifest] failed', e); process.exit(1); });

