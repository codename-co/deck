// The brains' decks as .deck.html files, each slide photographed in Chromium.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deckIn } from '../src/repair.js'
import { writeDeckFile } from '../src/file.js'
import { parseDeck } from '../src/parse.js'
const here = fileURLToPath(new URL('..', import.meta.url))
mkdirSync(join(here, 'eval/decks'), { recursive: true })
const browser = await chromium.launch()
for (const [model, id] of process.argv.slice(2).map((a) => a.split(':'))) {
  const { source } = /** @type {any} */ (deckIn(readFileSync(join(here, 'eval/replies', model, `${id}.md`), 'utf8').replace(/<think>[\s\S]*?<\/think>/g, '')))
  const settings = parseDeck(source).settings
  const file = join(here, 'eval/decks', `${model}-${id}.deck.html`)
  writeFileSync(file, writeDeckFile(source, { title: String(settings.title ?? ''), lang: String(settings.lang ?? id), dir: id === 'ar' ? 'rtl' : 'ltr', renderer: { src: '../../dist/deck.js' } }))
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(`file://${file}`)
  await page.waitForSelector('.deck-slide.is-shown')
  await page.waitForTimeout(2500)
  const n = await page.evaluate(() => window.deckView.slides().length)
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => window.deckView.go(i, 99), i)
    await page.waitForTimeout(700)
    await page.locator('.deck-stage').screenshot({ path: join(here, 'eval/decks', `${model}-${id}-${String(i + 1).padStart(2, '0')}.png`) })
  }
  console.log(model, id, n)
  await page.close()
}
await browser.close()
