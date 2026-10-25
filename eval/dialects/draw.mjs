// What deck makes of every zero-shot reply, whatever dialect it was asked in: read liberally (repairs,
// Pandoc's divs, remark's and reveal's notes, headings as slides), drawn in Chromium, then counted:
// slides, the layouts it ended up with, notes found, steps, slides over their box, errors.
import { chromium } from 'playwright'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deckIn } from '../../src/repair.js'
import { parseDeck } from '../../src/parse.js'

const root = fileURLToPath(new URL('../..', import.meta.url))
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' }
const server = createServer((req, res) => {
  try { const p = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)); res.writeHead(200, { 'Content-Type': types[extname(p)] ?? 'text/plain' }); res.end(readFileSync(p)) } catch { res.writeHead(404); res.end() }
}).listen(4596)
const browser = await chromium.launch()
const rows = []
const base = join(root, 'eval/dialects/replies')
for (const dialect of readdirSync(base)) for (const model of readdirSync(join(base, dialect))) for (const file of readdirSync(join(base, dialect, model)).sort()) {
  const answer = readFileSync(join(base, dialect, model, file), 'utf8').replace(/<think>[\s\S]*?<\/think>/g, '')
  const found = deckIn(answer) ?? (() => { const m = /^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^\1\s*$/m.exec(answer); return m ? { source: m[2], mended: ['any fence'] } : null })()
  if (!found) { rows.push({ dialect, model: model.slice(0, 14), id: file.replace('.md', ''), slides: 0, empty: !answer.trim() }); continue }
  const deck = parseDeck(found.source)
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://localhost:4596/eval/draw.html')
  const drawn = await page.evaluate(async (source) => {
    const r = await window.draw(source)
    const slides = [...document.querySelectorAll('#root .deck-stage .deck-slide')]
    return { ...r, layouts: [...new Set(slides.map((s) => s.getAttribute('data-layout')))], steps: document.querySelectorAll('#root .deck-stage .deck-step').length, raw: [...document.querySelectorAll('#root .deck-stage p')].filter((p) => /^(:::|\?\?\?|layout:|<)/.test(p.textContent.trim())).length }
  }, found.source)
  await page.close()
  rows.push({ dialect, model: model.slice(0, 14), id: file.replace('.md', ''), slides: deck.slides.length, notes: deck.slides.filter((s) => s.notes).length, ...drawn, errors: errors.length })
}
await browser.close()
server.close()
writeFileSync(join(root, 'eval/dialects/drawn.json'), JSON.stringify(rows, null, 1))
const groups = Object.groupBy(rows, (r) => `${r.dialect} · ${r.model}`)
for (const [key, list] of Object.entries(groups)) {
  const sum = (/** @type {(r: any) => number} */ f) => list.reduce((a, r) => a + f(r), 0)
  console.log(key.padEnd(30), `decks ${list.filter((r) => r.slides > 1).length}/${list.length}`, `| slides ${sum((r) => r.slides)}`, `| with notes ${sum((r) => r.notes ?? 0)}`, `| steps ${sum((r) => r.steps ?? 0)}`, `| over ${sum((r) => r.overflow?.length ?? 0)}`, `| syntax left as text ${sum((r) => r.raw ?? 0)}`, `| layouts ${[...new Set(list.flatMap((r) => r.layouts ?? []))].join(' ')}`, `| errors ${sum((r) => r.errors ?? 0)}`)
}
