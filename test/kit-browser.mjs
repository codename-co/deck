// The kit deck: each slide photographed, its kit's problems, its PowerPoint's layouts by name.
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = fileURLToPath(new URL('..', import.meta.url))
await mkdir(join(here, 'out'), { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`file://${join(here, 'examples', 'kit.deck.html')}`)
await page.waitForSelector('.deck-slide.is-shown')
await page.waitForTimeout(800)
const info = await page.evaluate(() => ({ problems: window.deckView.kitProblems, layouts: window.deckView.slides().map((s) => s.dataset.layout), kit: window.deckView.kit.name, overflow: [...document.querySelectorAll('.deck-stage .deck-slide[data-overflow]')].length }))
for (let i = 0; i < info.layouts.length; i++) {
  await page.evaluate((i) => window.deckView.go(i, 99), i)
  await page.waitForTimeout(500)
  await page.locator('.deck-stage').screenshot({ path: join(here, 'out', `kit-${String(i + 1).padStart(2, '0')}.png`) })
}
const made = await page.evaluate(async () => {
  const { PptxGenJS, JSZip } = await window.deckTools.libraries()
  const { blob, report } = await window.deckTools.toPptx(window.deckView, { PptxGenJS, JSZip })
  const zip = await JSZip.loadAsync(blob)
  const names = []
  for (const path of Object.keys(zip.files).filter((p) => /slideLayouts\/slideLayout\d+\.xml$/.test(p))) names.push(/<p:cSld name="([^"]*)"/.exec(await zip.file(path).async('string'))?.[1])
  const bytes = new Uint8Array(await blob.arrayBuffer()); let text = ''
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { report, names, data: btoa(text) }
})
await writeFile(join(here, 'out', 'kit.pptx'), Buffer.from(made.data, 'base64'))
console.log(JSON.stringify({ ...info, report: made.report, pptxLayouts: made.names, errors }))
const wanted = ['Three numbers', 'Big question']
if (errors.length || info.problems.length || info.overflow || !wanted.every((name) => made.names.includes(name))) { console.log('FAIL kit deck'); process.exitCode = 1 } else console.log('kit deck passed')
await browser.close()
