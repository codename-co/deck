// A deck on a page: its slides drawn into the element given, paged with the bar, the keys a
// presenter's clicker sends, a click or a swipe; each step shown in turn; moved between with the
// transition its settings name, through the View Transitions API; presented full screen, with
// the presenter's view (this slide, the next, the notes, the time) and all slides at once; light
// or dark; changed as Markdown beside the slides, or in place on a slide, live. Host-agnostic:
// the host gives the drawers of ```echarts and ```mermaid, how a picture's address resolves, its
// words, how a slide's Markdown is read (its own marked, with its extensions), and what to do when
// the deck changes or is saved.
import { parseDeck } from './parse.js'
import { renderSlide, h } from './render.js'
import { tokensOf, schemeOf, VOICES } from './look.js'
import { mergeKits } from './kit.js'
import { stringsFor } from './strings.js'
import { Lexer } from 'marked'

/** @typedef {import('./parse.js').Deck} Deck */
/**
 * @typedef {{
 *   source: string, lang?: string, dir?: string, kit?: Record<string, any>, scheme?: 'light' | 'dark' | 'auto',
 *   blocks?: Record<string, import('./render.js').Drawer>, resolve?: (src: string) => string | null,
 *   strings?: Record<string, string>, headings?: 'real' | 'aria', editable?: boolean, lex?: (markdown: string) => any[],
 *   onChange?: (source: string) => void, onSave?: (source: string) => void, onExport?: (deck: DeckView) => void,
 * }} Options
 */

const RTL = /^(ar|he|fa|ur|ps|sd|ug|yi|dv|ckb)\b/i
const ICONS = {
  back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', present: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  presenter: 'M3 5h12v9H3zM18 8h3M18 12h3M6 19h6', grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4', scheme: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z', export: 'M12 4v11M7 10l5 5 5-5M5 20h14',
}

/** @param {string} name */
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  if (name === 'back' || name === 'next') svg.setAttribute('class', 'deck-flip')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', ICONS[/** @type {keyof typeof ICONS} */ (name)])
  svg.append(path)
  return svg
}

/** @typedef {ReturnType<typeof createDeck>} DeckView */

/** @param {HTMLElement} root @param {Options} options */
export function createDeck(root, options) {
  let source = options.source.replace(/\r\n?/g, '\n')
  let deck = parseDeck(source)
  let at = 0, stepAt = 0
  /** @type {{ element: HTMLElement, steps: number }[]} */
  let drawn = []
  const lang = String(options.lang ?? deck.settings.lang ?? document.documentElement.lang ?? 'en') || 'en'
  const dir = String(options.dir ?? deck.settings.dir ?? (RTL.test(lang) ? 'rtl' : 'ltr'))
  const words = { ...stringsFor(lang), ...options.strings }
  const number = new Intl.NumberFormat(lang).format
  const dark = matchMedia('(prefers-color-scheme: dark)')
  let scheme = /** @type {'light' | 'dark'} */ ('light')
  const started = Date.now()

  root.classList.add('deck')
  root.lang = lang
  root.dir = dir
  const stage = h('div', { class: 'deck-stage', tabindex: 0, role: 'region', 'aria-roledescription': words.carousel, 'aria-label': words.deck })
  const where = h('span', { class: 'deck-where', 'aria-live': 'polite' })
  const button = (/** @type {string} */ name, /** @type {string} */ label, /** @type {() => void} */ act) => {
    const b = h('button', { type: 'button', 'aria-label': label, 'data-act': name }, [icon(name)])
    b.addEventListener('click', act)
    return b
  }
  const back = button('back', words.previous, () => move(-1))
  const next = button('next', words.next, () => move(1))
  const editButton = button('edit', words.edit, () => toggle('is-editing'))
  const presenterButton = button('presenter', words.presenter, () => toggle('is-presenting'))
  const overviewButton = button('grid', words.overview, () => toggle('is-overview'))
  const bar = h('div', { class: 'deck-bar' }, [back, where, next, h('span', { class: 'deck-gap' }),
    overviewButton, presenterButton, options.editable === false ? null : editButton,
    button('scheme', words.scheme, () => { scheme = scheme === 'dark' ? 'light' : 'dark'; paintLook() }),
    options.onExport ? button('export', words.export, () => options.onExport?.(view)) : null,
    document.fullscreenEnabled ? button('present', words.present, () => present()) : null])
  const sourceBox = /** @type {HTMLTextAreaElement} */ (h('textarea', { class: 'deck-source', spellcheck: 'false', 'aria-label': words.source, dir: 'auto' }))
  const nextBox = h('div', { class: 'deck-next' })
  const notes = h('div', { class: 'deck-notes', dir: 'auto', 'aria-label': words.notes })
  const clock = h('span', { class: 'deck-clock' })
  const presenter = h('div', { class: 'deck-presenter' }, [nextBox, notes])
  root.replaceChildren(sourceBox, stage, presenter, bar)
  bar.insertBefore(clock, bar.querySelector('.deck-gap'))

  // The kit: deck's own, under the host's (an organisation's, a project's), under the file's own.
  let kitProblems = /** @type {string[]} */ ([])
  const kitOf = () => {
    const merged = mergeKits(options.kit, deck.settings.kit)
    kitProblems = merged.problems
    return merged.kit
  }

  function paintLook() {
    context.kit = kitOf()
    const tokens = tokensOf(deck.settings, context.kit.tokens)
    const colours = schemeOf(tokens, scheme)
    const stack = (/** @type {string[]} */ faces) => faces.map((f) => (/^[\w-]+$/.test(f) ? f : `"${f.replace(/["\\]/g, '')}"`)).join(', ')
    const voice = tokens.fonts ? { heading: stack(tokens.fonts.heading), body: stack(tokens.fonts.body) } : VOICES[tokens.voice]
    for (const [name, value] of Object.entries({
      paper: colours.paper, ink: colours.ink, muted: colours.muted, line: colours.line, primary: colours.primary,
      fill: tokens.primary, 'on-fill': colours.onPrimary, soft: colours.soft, heading: voice.heading, body: voice.body, radius: `${tokens.radius}px`,
      ...Object.fromEntries(colours.series.map((colour, n) => [`series-${n + 1}`, colour])),
    })) root.style.setProperty(`--deck-${name}`, value)
    root.dataset.scheme = scheme
    root.dispatchEvent(new CustomEvent('deck-scheme', { detail: { scheme, colours, tokens } }))
  }
  const chooseScheme = () => {
    const asked = options.scheme ?? deck.settings.colorSchema ?? 'auto'
    scheme = asked === 'dark' || (asked === 'auto' && dark.matches) ? 'dark' : 'light'
  }

  /** @type {import('./render.js').Context} */
  const context = {
    blocks: options.blocks ?? {}, resolve: options.resolve ?? ((src) => src), headings: options.headings ?? 'real', number: (n) => number(n), total: 0, kit: mergeKits().kit,
    lex: options.lex ?? ((markdown) => new Lexer({ gfm: true }).lex(markdown)), slide: words.slide,
  }

  function draw() {
    context.total = deck.slides.length
    drawn = deck.slides.map((slide) => renderSlide(slide, context))
    for (const [i, { element }] of drawn.entries()) {
      element.setAttribute('aria-label', words.where.replace('{n}', number(i + 1)).replace('{count}', number(drawn.length)))
      element.addEventListener('click', () => { if (root.classList.contains('is-overview')) { toggle('is-overview'); go(i, 0) } })
    }
    stage.replaceChildren(...drawn.map(({ element }) => element))
    at = Math.min(at, drawn.length - 1)
    show()
    requestAnimationFrame(() => fitAll())
  }

  /** Each slot's type shrunk, down to six tenths, until it holds what it says; a slide still over is marked. */
  function fitAll() {
    for (const { element } of drawn) fit(element)
  }
  /** @param {HTMLElement} slide */
  function fit(slide) {
    let over = false
    for (const slot of /** @type {NodeListOf<HTMLElement>} */ (slide.querySelectorAll('.deck-slot'))) {
      let scale = 1
      slot.style.setProperty('--deck-fit', '1')
      while (slot.scrollHeight > slot.clientHeight + 1 && scale > 0.6) slot.style.setProperty('--deck-fit', String((scale = Math.round((scale - 0.05) * 100) / 100)))
      if (slot.scrollHeight > slot.clientHeight + 1) over = true
    }
    if (over) slide.dataset.overflow = 'true'
    else delete slide.dataset.overflow
  }

  function show() {
    for (const [i, { element, steps }] of drawn.entries()) {
      element.classList.toggle('is-shown', i === at)
      element.inert = i !== at && !root.classList.contains('is-overview')
      for (const one of element.querySelectorAll('.deck-step')) one.classList.toggle('is-on', i < at || (i === at && Number(one.getAttribute('data-step')) <= stepAt) || steps === 0)
    }
    where.textContent = `${number(at + 1)} / ${number(drawn.length)}`
    back.toggleAttribute('disabled', at === 0 && stepAt === 0)
    next.toggleAttribute('disabled', at >= drawn.length - 1 && stepAt >= (drawn[at]?.steps ?? 0))
    notes.textContent = deck.slides[at]?.notes || words.noNotes
    const following = deck.slides[at + 1]
    nextBox.replaceChildren(h('span', {}, [following ? words.upNext : words.last]), ...(following ? [renderSlide(following, context).element] : []))
    root.dispatchEvent(new CustomEvent('deck-move', { detail: { at, step: stepAt } }))
  }

  /** A click on, or the next key: the next step, else the next slide. @param {number} by */
  function move(by) {
    const steps = drawn[at]?.steps ?? 0
    if (by > 0 && stepAt < steps) { stepAt++; show(); return }
    if (by < 0 && stepAt > 0) { stepAt--; show(); return }
    const to = at + by
    if (to < 0 || to >= drawn.length) return
    go(to, by > 0 ? 0 : drawn[to].steps)
  }

  /** @param {number} to @param {number} [toStep] */
  function go(to, toStep = 0) {
    if (to === at) { stepAt = toStep; show(); return }
    const forward = to > at
    const settings = deck.slides[forward ? to : at]?.settings ?? {}
    const named = String(settings.transition ?? deck.settings.transition ?? 'none')
    // Slidev's `a | b`: one going forward, the other going back.
    const [ahead, behind] = named.split('|').map((part) => part.trim())
    let kind = forward ? ahead : behind ?? ahead
    if (dir === 'rtl') kind = kind.replace(/-(left|right)$/, (_, side) => (side === 'left' ? '-right' : '-left'))
    if (kind === 'view-transition') kind = 'morph'
    const update = () => { at = to; stepAt = toStep; if (kind === 'morph') name(drawn[to].element); show() }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || kind === 'none' || reduced || root.classList.contains('is-overview')) return update()
    if (kind === 'morph') name(drawn[at].element, drawn[to].element)
    document.documentElement.dataset.deckTransition = kind
    const transition = document.startViewTransition(update)
    // A transition skipped by the next one, as a clicker pressed twice does, is no error.
    transition.ready.catch(() => {})
    transition.finished.finally(() => {
      delete document.documentElement.dataset.deckTransition
      for (const { element } of drawn) for (const one of element.querySelectorAll('[data-morph]')) { /** @type {HTMLElement} */ (one).style.removeProperty('view-transition-name'); one.removeAttribute('data-morph') }
    })
  }

  /**
   * Morph, as Keynote's Magic Move and PowerPoint's Morph do it, with nothing to write: what two
   * slides share (a heading's words, a list item's, a picture, a chart) gets one name on each,
   * so the browser moves it from where it was to where it goes. Called with the slide shown and
   * the next, then with the next alone once it shows. @param {HTMLElement} slide @param {HTMLElement} [toward]
   */
  function name(slide, toward) {
    const key = (/** @type {Element} */ el) => `${el.tagName}:${el.tagName === 'IMG' ? el.getAttribute('src') : (el.textContent ?? '').trim().slice(0, 80)}`
    const parts = (/** @type {HTMLElement} */ s) => /** @type {HTMLElement[]} */ ([...s.querySelectorAll('h1, h2, h3, h4, .deck-h, li, p, img, .deck-block, blockquote, .deck-image')])
    if (toward) {
      const there = new Map(parts(toward).map((el) => [key(el), el]))
      let n = 0
      for (const el of parts(slide)) {
        const match = there.get(key(el))
        if (!match || match.dataset.morph || el.closest('[data-morph]')) continue
        const id = `deck-m${n++}`
        el.dataset.morph = match.dataset.morph = id
        el.style.setProperty('view-transition-name', id)
      }
      return
    }
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (slide.querySelectorAll('[data-morph]'))) {
      const id = /** @type {string} */ (el.dataset.morph)
      for (const old of /** @type {NodeListOf<HTMLElement>} */ (stage.querySelectorAll(`[data-morph="${id}"]`))) if (old !== el) old.style.removeProperty('view-transition-name')
      el.style.setProperty('view-transition-name', id)
    }
  }

  /** @param {string} mode */
  function toggle(mode) {
    for (const other of ['is-editing', 'is-presenting', 'is-overview']) if (other !== mode) root.classList.remove(other)
    root.classList.toggle(mode)
    editButton.setAttribute('aria-pressed', String(root.classList.contains('is-editing')))
    presenterButton.setAttribute('aria-pressed', String(root.classList.contains('is-presenting')))
    overviewButton.setAttribute('aria-pressed', String(root.classList.contains('is-overview')))
    if (root.classList.contains('is-editing')) { sourceBox.value = source; sourceBox.focus() }
    show()
    requestAnimationFrame(() => fitAll())
  }

  function present() {
    stage.requestFullscreen?.().then(() => stage.focus(), () => {})
  }

  /** The source changed, by the Markdown or on a slide: read again, drawn again, where the user is. @param {string} text */
  function setSource(text) {
    source = text.replace(/\r\n?/g, '\n')
    deck = parseDeck(source)
    paintLook()
    draw()
    options.onChange?.(source)
  }

  // Changed as Markdown: drawn again as the user types, the slide under the caret shown.
  let pending = 0
  sourceBox.addEventListener('input', (event) => {
    if (/** @type {InputEvent} */ (event).isComposing) return
    clearTimeout(pending)
    pending = setTimeout(() => setSource(sourceBox.value), 120)
  })
  const followCaret = () => {
    const caret = sourceBox.selectionStart
    const found = deck.slides.findIndex((slide) => caret >= slide.start && caret <= slide.end + 1)
    if (found >= 0 && found !== at) { at = found; stepAt = drawn[found]?.steps ?? 0; show() }
  }
  sourceBox.addEventListener('keyup', followCaret)
  sourceBox.addEventListener('click', followCaret)

  // Changed in place: a double click on words makes them editable; Enter or leaving keeps them.
  stage.addEventListener('dblclick', (event) => {
    if (options.editable === false || document.fullscreenElement) return
    const target = /** @type {HTMLElement | null} */ (/** @type {Element} */ (event.target).closest('[data-edit]'))
    if (!target) return
    const [from, to] = /** @type {string} */ (target.dataset.edit).split('-').map(Number)
    target.contentEditable = 'true'
    target.focus()
    const done = (/** @type {boolean} */ keep) => {
      target.removeEventListener('keydown', key)
      target.removeEventListener('blur', blur)
      target.contentEditable = 'false'
      const words = markdownOf(target)
      if (keep && words !== source.slice(from, to)) setSource(source.slice(0, from) + words + source.slice(to))
      else draw()
    }
    const key = (/** @type {KeyboardEvent} */ e) => {
      if (e.isComposing) return
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(true) }
      if (e.key === 'Escape') { e.preventDefault(); done(false) }
    }
    const blur = () => done(true)
    target.addEventListener('keydown', key)
    target.addEventListener('blur', blur)
  })

  // The keys a clicker sends, and the deck's own.
  root.addEventListener('keydown', (event) => {
    const target = /** @type {HTMLElement} */ (event.target)
    if (target.isContentEditable || target === sourceBox || (target.tagName === 'BUTTON' && (event.key === ' ' || event.key === 'Enter'))) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') { event.preventDefault(); options.onSave?.(source) }
      return
    }
    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight', backward = dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft'
    if (event.altKey || event.ctrlKey || event.metaKey) {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') { event.preventDefault(); options.onSave?.(source) }
      return
    }
    const acts = /** @type {Record<string, () => void>} */ ({
      [forward]: () => move(1), [backward]: () => move(-1), ArrowDown: () => move(1), ArrowUp: () => move(-1), PageDown: () => move(1), PageUp: () => move(-1), ' ': () => move(1),
      Home: () => go(0), End: () => go(drawn.length - 1, drawn.at(-1)?.steps ?? 0), f: present, p: () => toggle('is-presenting'), o: () => toggle('is-overview'), e: () => toggle('is-editing'),
    })
    const act = acts[event.key]
    if (!act) return
    event.preventDefault()
    act()
  })
  stage.addEventListener('click', (event) => {
    if (document.fullscreenElement && !(/** @type {Element} */ (event.target).closest('a, button, input'))) move(1)
  })
  let touch = 0
  stage.addEventListener('touchstart', (event) => { touch = event.touches[0].clientX }, { passive: true })
  stage.addEventListener('touchend', (event) => {
    const dx = event.changedTouches[0].clientX - touch
    if (Math.abs(dx) > 50) move((dx < 0) === (dir !== 'rtl') ? 1 : -1)
  })
  dark.addEventListener('change', () => { chooseScheme(); paintLook() })
  const tick = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000)
    clock.textContent = root.classList.contains('is-presenting') ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : ''
  }, 1000)

  chooseScheme()
  paintLook()
  draw()
  document.fonts?.ready.then(() => fitAll())

  const view = {
    root, stage, get source() { return source }, get deck() { return deck }, get at() { return at }, get scheme() { return scheme }, get kit() { return context.kit }, get kitProblems() { return kitProblems }, lang, dir,
    slides: () => drawn.map(({ element }) => element), setSource, go, toggle, present, fitAll,
    setScheme: (/** @type {'light' | 'dark'} */ value) => { scheme = value; paintLook() },
    destroy: () => clearInterval(tick),
  }
  return view
}

/** The Markdown of words changed in place: bold, italics, code and links kept as Markdown writes them. @param {Node} node @returns {string} */
export function markdownOf(node) {
  let out = ''
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) out += (child.textContent ?? '').replace(/([*_`[\]\\])/g, '\\$1')
    else if (child instanceof HTMLElement) {
      const inner = markdownOf(child)
      out += ({ STRONG: `**${inner}**`, B: `**${inner}**`, EM: `*${inner}*`, I: `*${inner}*`, CODE: `\`${child.textContent}\``, DEL: `~~${inner}~~`, BR: '  \n',
        A: `[${inner}](${child.getAttribute('href') ?? ''})` })[child.tagName] ?? inner
    }
  }
  return out.replace(/ /g, ' ').replace(/\n+$/, '')
}
