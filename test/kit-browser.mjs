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
const info = await page.evaluate(() => ({ problems: window.deckView.kitProblems, layouts: window.deckView.slides().map((s) => s.dataset.layout), kit: window.deckView.kit.name, overflow: [...document.querySelectorAll('.deck-stage .deck-slide[data-overflow]')].length,
  // The logo each slide shows, the light one or the dark, small or big.
  // The art a layout draws, read and shown.
  art: window.deckView.slides().filter((s) => s.classList.contains('has-art')).map((s) => [s.dataset.layout, [...s.querySelectorAll('img.deck-art')].every((img) => img.complete && img.naturalWidth > 0)]),
  logos: window.deckView.slides().map((s) => { const shown = [...s.querySelectorAll('.deck-logo')].find((one) => getComputedStyle(one).display !== 'none'); return shown ? `${shown.classList.contains('is-dark') ? 'dark' : 'light'} ${shown.dataset.size}` : 'none' }) }))
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
  // PptxGenJS's masters are PowerPoint's slide layouts.
  const masters = await Promise.all(Object.keys(zip.files).filter((p) => /slideLayouts\/_rels\/slideLayout\d+\.xml\.rels$/.test(p)).map((p) => zip.file(p).async('string')))
  // The banner's slide layout holds its art as a picture.
  const banner = Object.keys(zip.files).find((p) => /slideLayouts\/slideLayout\d+\.xml$/.test(p) && names[Object.keys(zip.files).filter((q) => /slideLayouts\/slideLayout\d+\.xml$/.test(q)).indexOf(p)] === 'Banner')
  const bannerArt = banner ? /relationships\/image"/.test(await zip.file(banner.replace(/([^/]+)$/, '_rels/$1.rels')).async('string')) : false
  return { report, names, data: btoa(text), withLogo: masters.filter((rels) => /relationships\/image"/.test(rels)).length, bannerArt }
})
await writeFile(join(here, 'out', 'kit.pptx'), Buffer.from(made.data, 'base64'))
console.log(JSON.stringify({ ...info, report: made.report, pptxLayouts: made.names, withLogo: made.withLogo, bannerArt: made.bannerArt, errors }))
// Big on the cover, the dark one on the cover's dark orange and the section's ink, small elsewhere; on PowerPoint's layouts too.
const logos = info.layouts.map((layout, i) => [layout, info.logos[i]])
const logoWrong = !logos.some(([layout, logo]) => layout === 'cover' && logo === 'dark big') || !logos.some(([layout, logo]) => layout === 'section' && logo === 'dark small')
  || !logos.some(([layout, logo]) => layout === 'default' && logo === 'light small') || made.withLogo < 3
const wanted = ['Three numbers', 'Banner', 'Big question']
const artWrong = JSON.stringify(info.art) !== JSON.stringify([['banner', true]]) || !made.bannerArt
if (errors.length || info.problems.length || info.overflow || logoWrong || artWrong || !wanted.every((name) => made.names.includes(name))) { console.log('FAIL kit deck'); process.exitCode = 1 } else console.log('kit deck passed')
await browser.close()
