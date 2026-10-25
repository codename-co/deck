// A .deck.html opened on its own, in any browser: the Markdown its page holds read and drawn as
// slides; saved back as the same kind of file, the renderer as it came (linked or held whole);
// saved as PowerPoint with PptxGenJS loaded only then. Libraries come from `data-base` on the
// renderer's script, else jsDelivr's npm mirror.
import { createDeck } from './deck.js'
import { defaultBlocks, libraryAt } from './blocks.js'
import { readDeckFile, writeDeckFile, unescape } from './file.js'
import { toPptx } from './pptx.js'
import css from './deck.css'

const me = /** @type {HTMLScriptElement | null} */ (document.currentScript)
const base = me?.dataset.base ?? 'https://cdn.jsdelivr.net/npm/'

const PAGE = `html, body { margin: 0; } body { min-block-size: 100vh; }
body > .deck { min-block-size: 100vh; padding: clamp(0.5rem, 3vw, 2rem); align-content: center; justify-items: center; background: color-mix(in srgb, var(--deck-ink) 7%, var(--deck-paper)); }
body > .deck > .deck-stage, body > .deck > .deck-bar { inline-size: min(100%, (100vh - 7rem) * 16 / 9); }
body > .deck.is-editing { justify-items: stretch; align-content: start; }
body > .deck.is-editing > .deck-stage, body > .deck.is-editing > .deck-bar, body > .deck.is-presenting > .deck-stage, body > .deck.is-presenting > .deck-bar, body > .deck.is-overview > .deck-stage { inline-size: auto; }
body > .deck:is(.is-presenting, .is-overview) { justify-items: stretch; align-content: start; }`

function boot() {
  const holder = document.getElementById('deck')
  if (!holder) return
  const source = unescape(holder.textContent ?? '').replace(/^\n/, '').replace(/\n$/, '')
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(`${css}\n${PAGE}`)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
  holder.style.display = 'none'
  const root = document.createElement('main')
  document.body.append(root)
  const blocks = defaultBlocks({ base, root })
  /** @type {any} */
  let handle = null
  const view = createDeck(root, {
    source, blocks, lang: document.documentElement.lang || undefined,
    async onSave(text) {
      const settings = view.deck.settings
      const file = writeDeckFile(text, {
        title: String(settings.title ?? view.deck.slides[0]?.title ?? document.title), lang: view.lang, dir: view.dir,
        renderer: me?.src ? { src: me.src } : { code: me?.textContent ?? '' }, generator: document.querySelector('meta[name=generator]')?.getAttribute('content') ?? 'deck',
      })
      const name = decodeURIComponent(location.pathname.split('/').pop() || 'slides.deck.html')
      const picker = /** @type {any} */ (window).showSaveFilePicker
      if (picker) {
        try {
          handle ??= await picker({ suggestedName: name, types: [{ description: 'Deck', accept: { 'text/html': ['.deck.html', '.html'] } }] })
          const writable = await handle.createWritable()
          await writable.write(file)
          await writable.close()
          return
        } catch (error) { if (/** @type {Error} */ (error).name === 'AbortError') return }
      }
      download(new Blob([file], { type: 'text/html' }), name)
    },
    async onExport(deck) {
      const { PptxGenJS, JSZip } = await libraries()
      const { blob } = await toPptx(deck, { PptxGenJS, JSZip })
      download(blob, `${String(deck.deck.settings.title ?? deck.deck.slides[0]?.title ?? 'slides').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'slides'}.pptx`)
    },
  })
  const title = view.deck.settings.title ?? view.deck.slides[0]?.title
  if (title) document.title = String(title)
  const stage = /** @type {HTMLElement | null} */ (root.querySelector('.deck-stage'))
  stage?.focus({ preventScroll: true })
  Object.assign(window, { deckView: view, deckTools: { toPptx, libraries, readDeckFile, writeDeckFile } })
}

async function libraries() {
  if (!(/** @type {any} */ (window).PptxGenJS)) await new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = libraryAt(base, 'pptxgenjs', '4.0.1', 'dist/pptxgen.bundle.js')
    tag.onload = resolve
    tag.onerror = reject
    document.head.append(tag)
  })
  return { PptxGenJS: /** @type {any} */ (window).PptxGenJS, JSZip: /** @type {any} */ (window).JSZip }
}

/** @param {Blob} blob @param {string} name */
function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
else boot()
