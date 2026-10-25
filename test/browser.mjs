// Phase 0 in real browsers: each example opened from disk (file://) in Chromium and WebKit, its
// slides photographed, steps, morph, editing in place and as text, saving as PowerPoint; the file
// with scripts off; and the renderer in a host page under a strict policy with Trusted Types.
import { chromium, webkit } from 'playwright'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname, join } from 'node:path'

const here = fileURLToPath(new URL('..', import.meta.url))
const out = join(here, 'out')
await mkdir(out, { recursive: true })
const only = process.argv[2]
const results = []
const log = (...a) => { console.log(...a); results.push(a.join(' ')) }
/** What went wrong, so the run fails. */
const failures = []
const fail = (/** @type {string} */ what) => { failures.push(what); console.log(`FAIL ${what}`) }

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.md': 'text/markdown', '.svg': 'image/svg+xml' }
const server = createServer(async (req, res) => {
  try {
    const path = join(here, decodeURIComponent(new URL(req.url, 'http://x').pathname))
    const body = await readFile(path)
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end() }
}).listen(4591)

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  if (only && only !== name) continue
  const browser = await engine.launch()
  for (const deck of ['en', 'ar', 'ja', 'tricky', 'en.embedded']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true })
    const errors = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
    const t0 = Date.now()
    await page.goto(`file://${join(here, 'examples', `${deck}.deck.html`)}`)
    await page.waitForSelector('.deck-slide.is-shown')
    const firstSlide = Date.now() - t0
    const count = await page.evaluate(() => window.deckView.slides().length)
    // Charts and diagrams come from the CDN the first time: wait for them, a while at most.
    const charts = await page.evaluate(() => document.querySelectorAll('.deck-echarts').length)
    const diagrams = await page.evaluate(() => document.querySelectorAll('.deck-mermaid').length)
    const t1 = Date.now()
    await page.waitForFunction(([c, d]) => document.querySelectorAll('.deck-chart svg').length >= c && document.querySelectorAll('.deck-diagram img').length >= d, [charts, diagrams], { timeout: 30000 }).catch(() => errors.push('charts or diagrams not drawn in 30 s'))
    const drawnIn = Date.now() - t1
    await page.evaluate(() => document.fonts.ready.then(() => window.deckView.fitAll()))
    const overflow = await page.evaluate(() => [...document.querySelectorAll('.deck-slide[data-overflow]')].map((s) => s.getAttribute('data-index')))
    for (let i = 0; i < count; i++) {
      await page.evaluate((i) => window.deckView.go(i, 99), i)
      await page.waitForTimeout(i === 0 ? 300 : 650)
      await page.locator('.deck-stage').screenshot({ path: join(out, `${name}-${deck}-${String(i + 1).padStart(2, '0')}.png`) })
    }
    if (errors.length || overflow.length) fail(`${name} ${deck}: ${errors.join(' | ')} overflow [${overflow}]`)
    log(`${name} ${deck}: ${count} slides, first slide in ${firstSlide} ms, ${charts} charts + ${diagrams} diagrams drawn in ${drawnIn} ms, overflowing: [${overflow}], errors: ${errors.length ? errors.join(' | ') : 'none'}`)

    if (deck === 'en') {
      // Steps: the list shows one item a click, then the next slide.
      await page.evaluate(() => window.deckView.go(1, 0))
      await page.waitForTimeout(600)
      await page.locator('.deck-stage').focus()
      const shown = []
      for (let k = 0; k < 4; k++) {
        shown.push(await page.evaluate(() => `${window.deckView.at}:${document.querySelectorAll('.deck-slide.is-shown .deck-step.is-on').length}`))
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(150)
      }
      log(`${name} steps (slide:shown) ${shown.join(' → ')} → ${await page.evaluate(() => window.deckView.at)}`)
      // Morph: from slide 5 to 6, the heading shared; the transition finishes without an error.
      await page.evaluate(() => window.deckView.go(4, 0))
      await page.waitForTimeout(700)
      const morph = await page.evaluate(async () => {
        const named = []
        const start = document.startViewTransition?.bind(document)
        if (!start) return 'no View Transitions'
        let finished = 'none'
        document.startViewTransition = (cb) => { const t = start(cb); t.finished.then(() => { finished = 'finished' }, (e) => { finished = `failed ${e}` }); return t }
        window.deckView.go(5, 0)
        await new Promise((r) => requestAnimationFrame(() => r()))
        named.push(...[...document.querySelectorAll('[data-morph]')].map((el) => `${el.tagName}`))
        await new Promise((r) => setTimeout(r, 900))
        document.startViewTransition = start
        return `${finished}; shared: ${named.join(',') || 'nothing'}`
      })
      if (!String(morph).startsWith('finished') && morph !== 'no View Transitions') fail(`${name} morph: ${morph}`)
      log(`${name} morph 5 → 6: ${morph}`)
      // Changed in place: a double click on a heading, words typed, Enter.
      await page.evaluate(() => window.deckView.go(3, 0))
      await page.waitForTimeout(700)
      await page.locator('.deck-slide.is-shown h2').dblclick()
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A')
      await page.keyboard.type('What it really costs')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(200)
      const edited = await page.evaluate(() => ({ line: window.deckView.source.split('\n').find((l) => l.includes('really')), shown: document.querySelector('.deck-slide.is-shown h2')?.textContent, at: window.deckView.at }))
      if (edited.line !== '## What it really costs') fail(`${name} in place: ${edited.line}`)
      log(`${name} in place: source line ${JSON.stringify(edited.line)}, slide says ${JSON.stringify(edited.shown)}, still on slide ${edited.at + 1}`)
      // Changed as text: E opens the Markdown; what is typed is drawn.
      await page.locator('.deck-stage').focus()
      await page.keyboard.press('e')
      const box = page.locator('.deck-source')
      await box.click()
      await page.evaluate(() => { const t = document.querySelector('.deck-source'); const at = t.value.indexOf('# Thank you'); t.setSelectionRange(at + 2, at + 11) })
      await page.keyboard.type('Merci')
      await page.waitForTimeout(400)
      const typed = await page.evaluate(() => ({ at: window.deckView.at, shown: document.querySelector('.deck-slide.is-shown h1')?.textContent }))
      if (typed.shown !== 'Merci') fail(`${name} as text: ${typed.shown}`)
      log(`${name} as text: typed in the Markdown, slide ${typed.at + 1} shows ${JSON.stringify(typed.shown)}`)
      await page.locator('.deck-stage').screenshot({ path: join(out, `${name}-en-editing.png`) })
      await page.screenshot({ path: join(out, `${name}-en-editing-page.png`) })
      await page.keyboard.press('Escape')
      await page.locator('.deck-stage').focus()
      await page.keyboard.press('e')
      // The presenter's view.
      await page.evaluate(() => window.deckView.go(1, 3))
      await page.keyboard.press('p')
      await page.waitForTimeout(700)
      await page.screenshot({ path: join(out, `${name}-en-presenter.png`) })
      await page.keyboard.press('p')
      await page.keyboard.press('o')
      await page.waitForTimeout(500)
      await page.screenshot({ path: join(out, `${name}-en-overview.png`), fullPage: true })
      await page.keyboard.press('o')
    }

    // Saved as PowerPoint, in each scheme for the English deck.
    if (deck !== 'tricky' && deck !== 'en.embedded') for (const scheme of deck === 'en' ? ['light', 'dark'] : ['shown']) {
      if (scheme !== 'shown') { await page.evaluate((s) => window.deckView.setScheme(s), scheme); await page.waitForTimeout(500) }
      // A fresh copy of the source, as the English deck was edited above.
      const t2 = Date.now()
      const made = await page.evaluate(async () => {
        const { PptxGenJS, JSZip } = await window.deckTools.libraries()
        const { blob, report } = await window.deckTools.toPptx(window.deckView, { PptxGenJS, JSZip })
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let text = ''
        for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
        return { report, data: btoa(text) }
      }).catch((e) => ({ error: String(e) }))
      if (made.error) { fail(`${name} ${deck} pptx (${scheme}): ${made.error}`); continue }
      const file = join(out, `${name}-${deck}-${scheme}.pptx`)
      await writeFile(file, Buffer.from(made.data, 'base64'))
      log(`${name} ${deck} pptx (${scheme}) in ${Date.now() - t2} ms: ${JSON.stringify(made.report)}, ${(Buffer.from(made.data, 'base64').length / 1024).toFixed(0)} KB`)
    }
    await page.close()
  }

  // Over http, where a page reads its own pictures back as a file from disk can't: each slide that shows a picture (one alone
  // on its line, one beside the words, a diagram) holds it in PowerPoint, at its size.
  const served = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  await served.goto('http://localhost:4591/examples/en.deck.html')
  await served.waitForFunction(() => document.querySelectorAll('.deck-diagram img').length > 0, null, { timeout: 30000 }).catch(() => {})
  const pictureless = await served.evaluate(async () => {
    const { PptxGenJS, JSZip } = await window.deckTools.libraries()
    const zip = await JSZip.loadAsync((await window.deckTools.toPptx(window.deckView, { PptxGenJS, JSZip })).blob)
    const out = []
    for (const [i, slide] of window.deckView.slides().entries()) {
      if (!slide.querySelector('.deck-picture img, .deck-image, .deck-diagram img')) continue
      const pictures = (await zip.file(`ppt/slides/slide${i + 1}.xml`).async('string')).match(/<p:pic>[\s\S]*?<\/p:pic>/g) ?? []
      if (!pictures.length || pictures.some((one) => /<a:ext cx="0"|<a:ext cx="\d+" cy="0"/.test(one))) out.push(i + 1)
    }
    return out
  })
  if (pictureless.length) fail(`${name} en pptx over http: no picture, or one without a size, on slides ${pictureless}`)
  log(`${name} en pptx over http: ${pictureless.length ? `no picture on slides ${pictureless}` : 'a picture on each slide that shows one'}`)
  await served.close()

  // Scripts off: the Markdown, readable as it is.
  const off = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 900, height: 900 } })
  const plain = await off.newPage()
  await plain.goto(`file://${join(here, 'examples', 'en.deck.html')}`)
  await plain.screenshot({ path: join(out, `${name}-no-script.png`) })
  log(`${name} no script: the page shows ${JSON.stringify((await plain.locator('#deck').innerText()).slice(0, 60))}…`)
  await off.close()

  // A host under a strict policy: Trusted Types with no policy, no inline style.
  const host = await browser.newPage()
  const hostErrors = []
  host.on('pageerror', (e) => hostErrors.push(e.message))
  host.on('console', (m) => { if (m.type() === 'error') hostErrors.push(m.text()) })
  await host.goto('http://localhost:4591/test/host.html')
  await host.waitForFunction(() => window.hostResult, null, { timeout: 10000 }).catch(() => hostErrors.push('host never drew'))
  const hostResult = await host.evaluate(() => window.hostResult?.())
  if (!hostResult || hostResult.violations.length || hostErrors.length) fail(`${name} strict host: ${JSON.stringify(hostResult)} ${hostErrors.join(' | ')}`)
  log(`${name} strict host: ${JSON.stringify(hostResult)}, errors: ${hostErrors.length ? hostErrors.join(' | ') : 'none'}`)
  await host.screenshot({ path: join(out, `${name}-strict-host.png`) })
  await browser.close()
}
server.close()
await writeFile(join(out, `results${only ? `-${only}` : ''}.txt`), results.join('\n') + '\n')
if (failures.length) { console.log(`${failures.length} failed`); process.exitCode = 1 } else console.log('all passed')
