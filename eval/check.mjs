// Each reply: its deck found (strictly, then with Jean's repairs), read, drawn in Chromium, and
// checked: slides, layouts, slots where a two-column layout needs them, steps, charts that parse
// and draw, diagrams that draw, HTML or classes the skill forbids, its language, slides that don't fit.
import { chromium } from 'playwright'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deckIn } from '../src/repair.js'
import { parseDeck } from '../src/parse.js'

const here = fileURLToPath(new URL('..', import.meta.url))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' }
const server = createServer((req, res) => {
  try { const p = join(here, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const b = readFileSync(p); res.writeHead(200, { 'Content-Type': types[extname(p)] ?? 'text/plain' }); res.end(b) } catch { res.writeHead(404); res.end() }
}).listen(4592)
const SCRIPT = { en: /[a-z]/i, fr: /[a-zàâçéèêëîïôûùüÿœ]/i, ar: /[؀-ۿ]/, ja: /[぀-ヿ一-鿿]/ }
const browser = await chromium.launch()
const rows = []
for (const model of readdirSync(join(here, 'eval/replies'))) {
  for (const file of readdirSync(join(here, 'eval/replies', model)).sort()) {
    const id = file.replace('.md', '')
    const answer = readFileSync(join(here, 'eval/replies', model, file), 'utf8').replace(/<think>[\s\S]*?<\/think>/g, '')
    const strictBlock = /^````deck\n([\s\S]*?)\n````\s*$/m.exec(answer)
    const found = deckIn(answer)
    if (!found) { rows.push({ model, id, found: false }); continue }
    const deck = parseDeck(found.source)
    const layouts = deck.slides.map((s) => String(s.settings.layout ?? (s.index === 0 ? 'cover' : 'default')))
    const twoCols = deck.slides.filter((s) => /^two-cols/.test(String(s.settings.layout ?? '')))
    const slotted = twoCols.filter((s) => s.slots.some((slot) => slot.name === 'right' && slot.text.trim()))
    const html = [...found.source.replace(/^```[\s\S]*?^```/gm, '').matchAll(/<(?!\/?v-clicks?\b|!--)[a-z][^>]*>/gi)].map((m) => m[0])
    const classes = (found.source.match(/\bclass\s*[:=]/g) ?? []).length
    const charts = [...found.source.matchAll(/^```echarts\n([\s\S]*?)^```/gm)].map((m) => { try { JSON.parse(m[1]); return true } catch { return false } })
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('http://localhost:4592/eval/draw.html')
    const drawn = await page.evaluate(async (source) => window.draw(source), found.source)
    await page.close()
    const words = deck.slides.map((s) => s.slots.map((x) => x.text).join(' ')).join(' ').replace(/```[\s\S]*?```/g, '')
    rows.push({ model, id, found: true, strict: Boolean(strictBlock), mended: found.mended, slides: deck.slides.length, layouts: [...new Set(layouts)].join(' '),
      twoCols: `${slotted.length}/${twoCols.length}`, steps: (found.source.match(/<v-clicks>/g) ?? []).length, charts: `${charts.filter(Boolean).length}/${charts.length}`, chartsDrawn: drawn.charts, diagrams: drawn.diagrams,
      notes: deck.slides.filter((s) => s.notes).length, html: html.length, classes, language: SCRIPT[id]?.test(words) ?? true, overflow: drawn.overflow, errors: errors.length })
  }
}
await browser.close()
server.close()
writeFileSync(join(here, 'eval/results.json'), JSON.stringify(rows, null, 1))
for (const r of rows) console.log(JSON.stringify(r))
