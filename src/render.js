// A slide drawn from its Markdown: marked's tokens made into elements with the DOM's own calls, so
// nothing here needs innerHTML, a style attribute or a Trusted Types policy, and a page under any
// policy can draw a deck. Each block that can be changed by hand says where its words are in the
// source (data-edit, offsets), so an edit made on the slide goes back into the Markdown. HTML a
// deck holds is not drawn: Slidev's <v-click> and <v-clicks> become steps, <br> a line break, and
// any other tag gives up its words alone. ```echarts and ```mermaid go to the host's drawers.
import { STANDARD, CORNERS, inferLayout, ALIASES } from './kit.js'

/** @typedef {import('./parse.js').Slide} Slide */
/** @typedef {import('./parse.js').Slot} Slot */
/** @typedef {(element: HTMLElement, source: string) => void | Promise<void>} Drawer */
/** @typedef {{ blocks: Record<string, Drawer>, resolve: (src: string) => string | null, headings: 'real' | 'aria', number: (n: number) => string, total: number, kit: import('./kit.js').Kit, lex: (markdown: string) => any[], slide: string }} Context */

/**
 * @param {string} tag @param {Record<string, string | number | boolean | undefined>} [attributes]
 * @param {(Node | string | null | undefined | false)[]} [children]
 */
export function h(tag, attributes = {}, children = []) {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) if (value !== undefined && value !== false) element.setAttribute(name, value === true ? '' : String(value))
  for (const child of children) if (child || child === '') element.append(child)
  return element
}

/** An address a slide may show: the web's, a picture held in the file, or one beside it. @param {string} href */
export function safeUrl(href) {
  const url = String(href ?? '').trim()
  if (/^(https?:|mailto:|blob:|#)/i.test(url) || /^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);/i.test(url)) return url
  if (/^[a-z][\w+.-]*:/i.test(url)) return null
  return url
}

/**
 * A slide, laid out by its layout, with its slots, steps and number.
 * @param {Slide} slide @param {Context} context @returns {{ element: HTMLElement, steps: number }}
 */
export function renderSlide(slide, context) {
  // The layout the slide names, by its name or a name brains give it, else the one its content suits.
  const asked = String(slide.settings.layout ?? '').trim().toLowerCase()
  const layout = context.kit.layouts[asked] ? asked : context.kit.layouts[ALIASES[asked]] ? ALIASES[asked] : inferLayout(slide)
  const definition = context.kit.layouts[layout] ?? STANDARD.layouts.default
  const classes = String(slide.settings.class ?? '').split(/\s+/).filter((name) => ['invert', 'text-center', 'text-left'].includes(name))
  const counter = { step: 0 }
  const slots = new Map(slide.slots.map((slot) => [slot.name, slot]))
  const names = definition.slots
  const section = h('section', {
    class: ['deck-slide', `deck-layout-${layout}`, ...classes.map((name) => `deck-class-${name}`)].join(' '),
    'data-index': slide.index, 'data-layout': layout, 'data-paper': definition.paper, 'data-align': definition.align, 'data-justify': definition.justify, 'data-title': definition.title,
    'aria-roledescription': context.slide, role: 'group',
  })
  // Its grid, from the layout's definition, through the CSSOM: areas named s-<slot>, as `default` is no name CSS allows.
  const canvas = h('div', { class: 'deck-canvas' })
  canvas.style.setProperty('grid-template-areas', definition.areas.map((row) => `"${row.map((cell) => (cell === '.' ? '.' : `s-${cell}`)).join(' ')}"`).join(' '))
  canvas.style.setProperty('grid-template-columns', definition.columns.join(' '))
  canvas.style.setProperty('grid-template-rows', definition.rows.join(' '))
  section.append(canvas)
  const image = slide.settings.image ?? slide.settings.background
  if (typeof image === 'string' && ['image-left', 'image-right', 'image', 'cover'].includes(layout)) {
    const url = context.resolve(image)
    if (url) {
      const picture = h('div', { class: 'deck-image', role: 'img', 'aria-label': String(slide.settings.alt ?? '') || undefined })
      picture.style.setProperty('--deck-image', `url("${url.replace(/["\\\n]/g, encodeURIComponent)}")`)
      canvas.append(picture)
      section.classList.add('has-image')
    }
  }
  for (const name of names) {
    const slot = slots.get(name)
    const element = h('div', { class: 'deck-slot', 'data-slot': name }, slot ? blocks(slot, context, counter) : [])
    element.style.setProperty('grid-area', `s-${name}`)
    canvas.append(element)
  }
  // Slots a layout doesn't have still show, under the rest, rather than being lost.
  for (const slot of slide.slots) if (!names.includes(slot.name)) canvas.append(h('div', { class: 'deck-slot', 'data-slot': slot.name }, blocks(slot, context, counter)))
  if (definition.numbered && slide.settings.paginate !== false) section.append(h('span', { class: 'deck-number', 'aria-hidden': 'true' }, [context.number(slide.index + 1)]))
  // The kit's logo in its corner, small, or big where the layout says (a cover, the end); its dark one beside it, which the
  // stylesheet shows on dark paper, where without one the logo sits on a light plate.
  const { logo, logoAt, dark } = context.kit.tokens, at = CORNERS.includes(logoAt) ? logoAt : CORNERS[0]
  if (logo && definition.logo !== 'none') {
    for (const [src, kind] of [[logo, dark?.logo ? 'has-dark' : ''], [dark?.logo, 'is-dark']]) {
      if (src) section.append(h('img', { class: `deck-logo ${kind}`.trim(), src, alt: '', 'aria-hidden': 'true', 'data-size': definition.logo, 'data-at': at }))
    }
  }
  return { element: section, steps: counter.step }
}

/** @param {Slot} slot @param {Context} context @param {{ step: number }} counter @returns {Node[]} */
function blocks(slot, context, counter) {
  const tokens = context.lex(slot.text)
  /** @type {Node[]} */
  const out = []
  let at = slot.start, mode = /** @type {'' | 'click' | 'clicks'} */ ('')
  for (const token of tokens) {
    const start = at
    at += token.raw.length
    // Pandoc's fences: `::: incremental` shows its list a point a click, as <v-clicks> does; the others, nothing.
    const fences = token.type === 'paragraph' ? token.raw.trim().split('\n').map((/** @type {string} */ line) => line.trim()) : []
    if (fences.length && fences.every((/** @type {string} */ line) => /^:{3,}/.test(line))) {
      for (const fence of fences) {
        if (/^:{3,}[ \t]*\{?[ \t]*\.?incremental\b/.test(fence)) mode = 'clicks'
        else if (/^:{3,}\s*$/.test(fence) && mode === 'clicks') mode = ''
      }
      continue
    }
    if (token.type === 'html') {
      const tag = /^\s*<(\/?)(v-clicks?|br)\b[^>]*>\s*$/i.exec(token.raw)
      if (tag && tag[2] === 'br') out.push(h('br'))
      else if (tag) mode = tag[1] ? '' : /** @type {'click' | 'clicks'} */ (tag[2].toLowerCase() === 'v-clicks' ? 'clicks' : 'click')
      else if (/<li\b/i.test(token.raw)) {
        // A list written as HTML, as brains write Slidev's steps (<li v-click>): its items' words, each
        // a step when it asks to be one.
        const list = h(/<ol\b/i.test(token.raw) ? 'ol' : 'ul', { dir: 'auto' })
        for (const [, attrs, inner] of token.raw.matchAll(/<li\b([^>]*)>([\s\S]*?)(?=<\/li>|<li\b|<\/[ou]l>|$)/gi)) {
          const words = inner.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          if (!words) continue
          const li = h('li', { dir: 'auto' }, [words])
          if (/\bv-click\b/.test(attrs) || mode === 'clicks') step(li, ++counter.step)
          list.append(li)
        }
        if (list.childElementCount) out.push(list)
      } else {
        const words = token.raw.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        if (words) out.push(h('p', {}, [words]))
      }
      continue
    }
    const element = block(token, start, context, mode === 'clicks' ? counter : null)
    if (!element) continue
    if (mode === 'click' || (mode === 'clicks' && token.type !== 'list')) step(element, ++counter.step)
    out.push(element)
  }
  return out
}

/** @param {Element} element @param {number} n */
const step = (element, n) => { element.classList.add('deck-step'); element.setAttribute('data-step', String(n)) }

/**
 * @param {any} token @param {number} start where its raw starts in the source
 * @param {Context} context @param {{ step: number } | null} stepped list items each a step
 * @returns {HTMLElement | null}
 */
function block(token, start, context, stepped) {
  switch (token.type) {
    case 'heading': {
      const head = /^\s*#{1,6}[ \t]+/.exec(token.raw)
      const edit = head ? range(start + head[0].length, start + token.raw.replace(/\s*#*\s*$/, '').length) : undefined
      return context.headings === 'real'
        ? h(`h${token.depth}`, { dir: 'auto', 'data-edit': edit }, inline(token.tokens, context))
        : h('p', { class: `deck-h deck-h${token.depth}`, role: 'heading', 'aria-level': Math.min(6, token.depth + 2), dir: 'auto', 'data-edit': edit }, inline(token.tokens, context))
    }
    case 'paragraph': {
      const lone = token.tokens.length === 1 && token.tokens[0].type === 'image'
      return h('p', { dir: 'auto', class: lone ? 'deck-picture' : undefined, 'data-edit': lone ? undefined : range(start, start + token.raw.trimEnd().length) }, inline(token.tokens, context))
    }
    case 'text': return h('p', { dir: 'auto' }, inline(token.tokens ?? [{ type: 'text', text: token.text }], context))
    // No dir=auto here: the browser would skip its paragraphs, which have their own, and find no letter.
    case 'blockquote': return h('blockquote', {}, children(token.tokens, start, token.raw, context))
    case 'list': {
      let from = 0
      const list = h(token.ordered ? 'ol' : 'ul', { start: token.ordered && token.start !== 1 ? token.start : undefined, class: token.items.some((/** @type {any} */ item) => item.task) ? 'deck-tasks' : undefined })
      for (const item of token.items) {
        const offset = token.raw.indexOf(item.raw, from)
        from = offset + item.raw.length
        const itemStart = start + Math.max(0, offset)
        const marker = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/.exec(item.raw)
        const simple = item.tokens.length === 1 && item.tokens[0].type === 'text' && !/\n\s*\S/.test(item.raw.trim().split('\n').slice(1).join('\n'))
        const li = h('li', { dir: 'auto', 'data-edit': simple && marker ? range(itemStart + marker[0].length, itemStart + item.raw.trimEnd().length) : undefined }, [
          item.task ? h('input', { type: 'checkbox', checked: item.checked, disabled: true, 'aria-label': item.text }) : null,
          ...item.tokens.flatMap((/** @type {any} */ inner) => inner.type === 'text' ? inline(inner.tokens ?? [{ type: 'text', text: inner.text }], context)
            : [block(inner, itemStart + Math.max(0, item.raw.indexOf(inner.raw)), context, null)]),
        ])
        if (stepped) step(li, ++stepped.step)
        list.append(li)
      }
      return list
    }
    case 'code': {
      const info = /^(\S*)\s*(?:\{([^}]*)\})?/.exec(token.lang ?? '') ?? []
      const lang = (info[1] ?? '').toLowerCase()
      const drawer = context.blocks[lang]
      if (drawer) {
        const box = h('div', { class: `deck-block deck-${lang}`, 'data-source': token.text })
        box.append(h('pre', { class: 'deck-block-source', dir: 'ltr' }, [h('code', {}, [token.text])]))
        queueMicrotask(() => Promise.resolve(drawer(box, token.text)).catch(() => box.classList.add('is-failed')))
        return box
      }
      const marked = lines(info[2] ?? '')
      const code = h('code', { class: lang ? `language-${lang}` : undefined })
      for (const [i, line] of token.text.split('\n').entries()) code.append(h('span', { class: marked.has(i + 1) ? 'deck-line is-marked' : 'deck-line' }, [line, '\n']))
      return h('pre', { dir: 'ltr', class: marked.size ? 'has-marks' : undefined, tabindex: 0 }, [code])
    }
    case 'table': {
      const align = (/** @type {string | null} */ a) => a ?? undefined
      return h('div', { class: 'deck-table' }, [h('table', {}, [
        h('thead', {}, [h('tr', {}, token.header.map((/** @type {any} */ cell, /** @type {number} */ i) => h('th', { 'data-align': align(token.align[i]), dir: 'auto' }, inline(cell.tokens, context))))]),
        h('tbody', {}, token.rows.map((/** @type {any[]} */ row) => h('tr', {}, row.map((cell, i) => h('td', { 'data-align': align(token.align[i]), dir: 'auto' }, inline(cell.tokens, context)))))),
      ])])
    }
    default: return null
  }
}

/** @param {any[]} tokens @param {number} start @param {string} raw @param {Context} context */
function children(tokens, start, raw, context) {
  let from = 0
  return tokens.map((token) => {
    const offset = raw.indexOf(token.raw, from)
    from = Math.max(from, offset + token.raw.length)
    return block(token, start + Math.max(0, offset), context, null)
  })
}

/** Line numbers as Slidev marks them, `{2,4-5}`; `|` steps are read as all their lines at once. @param {string} text */
function lines(text) {
  const marked = new Set()
  for (const part of text.split(/[,|]/)) {
    const [a, b] = part.split('-').map((n) => parseInt(n, 10))
    if (Number.isFinite(a)) for (let n = a; n <= (Number.isFinite(b) ? b : a); n++) marked.add(n)
  }
  return marked
}

/** @param {number} from @param {number} to */
const range = (from, to) => (to > from ? `${from}-${to}` : undefined)

/** @param {any[]} tokens @param {Context} context @returns {Node[]} */
export function inline(tokens = [], context) {
  return tokens.flatMap((token) => {
    switch (token.type) {
      case 'text': case 'escape': return token.tokens ? inline(token.tokens, context) : [token.text.replace(/&(amp|lt|gt|quot|#39);/g, (/** @type {string} */ _, /** @type {string} */ e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[/** @type {'amp'} */ (e)])]
      case 'strong': return [h('strong', {}, inline(token.tokens, context))]
      case 'em': return [h('em', {}, inline(token.tokens, context))]
      case 'del': return [h('del', {}, inline(token.tokens, context))]
      case 'codespan': return [h('code', {}, [token.text.replace(/&(amp|lt|gt|quot|#39);/g, (/** @type {string} */ _, /** @type {string} */ e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[/** @type {'amp'} */ (e)])])]
      case 'br': return [h('br')]
      case 'link': {
        const href = safeUrl(token.href)
        return href ? [h('a', { href, rel: 'noopener noreferrer', target: href.startsWith('#') ? undefined : '_blank' }, inline(token.tokens, context))] : inline(token.tokens, context)
      }
      case 'image': {
        const src = context.resolve(token.href)
        return src ? [h('img', { src, alt: token.text, loading: 'lazy' })] : [token.text]
      }
      case 'html': return /^<br\s*\/?>$/i.test(token.raw) ? [h('br')] : []
      default: return token.text ? [token.text] : []
    }
  })
}
