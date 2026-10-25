// The figures a layout draws from what a slide holds, as slides usually show it: a slot's lists as
// a row of numbered cards (steps), of key figures (metrics), a timeline, chevrons (process), a timed
// programme (agenda), a pyramid or a bento; its `##` parts face to face (versus) or four in a
// matrix; the deck's contents (summary). An item's lead, the words in bold it starts with (`**Q1**`,
// `**56%**`, `**6:00 PM**`), is its label and the rest its words, each changed in place as a list's
// are. What is drawn as a shape says so (.deck-shape), and what is words (.deck-words), for
// PowerPoint to write them as its own shapes and boxes of words.
import { h, inline, step, range, block } from './render.js'
import { layoutNameOf } from './kit.js'

/** @typedef {import('./render.js').Context} Context */
/** @typedef {{ tokens: any[], start: number, end: number, blocks: { token: any, start: number }[], step: number }} Entry */
/** @typedef {{ lead: any[] | null, leadAt: [number, number] | null, rest: any[], restAt: [number, number] | null }} Split */

// What may come between a lead and its words: a colon, a dash, a bar, a dot.
const SEP = /^\s*(?:[:：—–|·-]\s*)?/
// A lead not in bold: a time starting a programme's line, a number starting a key figure's.
const TIME = /^\d{1,2}(?:[:h.]\d{2}|h)?(?:\s?[ap]\.?m\.?)?(?:\s?[–-]\s?\d{1,2}(?:[:h.]\d{2}|h)?(?:\s?[ap]\.?m\.?)?)?(?=\s|$)/i
const NUMBER = /^[+−-]?[^\p{L}\p{N}\s]?\d[\d.,  ]*\S*(?=\s|$)/u
const PATTERNS = /** @type {Record<string, RegExp>} */ ({ agenda: TIME, metrics: NUMBER })

/** A paragraph whose every line starts in bold, as key figures are written without a list. @param {any} token */
export const boldLines = (token) => token.type === 'paragraph' && token.raw.trim().split('\n').every((/** @type {string} */ line) => /^\s*(\*\*|__)\S/.test(line))

/**
 * A list's items, or a paragraph's lines that start in bold, as a figure's entries: each one's words (its first line's
 * inline tokens) and where they are in the source, `end` -1 when they run over lines; what is under an item (a list, a
 * chart) its blocks. @param {any} token @param {number} start where its raw starts @param {(markdown: string) => any[]} lex
 * @returns {Entry[]}
 */
export function entriesOf(token, start, lex) {
  if (token.type === 'paragraph') {
    let at = start
    return token.raw.split('\n').flatMap((/** @type {string} */ line) => {
      const from = at
      at += line.length + 1
      const text = line.trim()
      if (!text) return []
      const [first] = lex(text)
      return [{ tokens: first?.tokens ?? [], start: from + line.length - line.trimStart().length, end: from + line.trimEnd().length, blocks: [], step: 0 }]
    })
  }
  let from = 0
  return token.items.map((/** @type {any} */ item) => {
    const offset = token.raw.indexOf(item.raw, from)
    from = offset + item.raw.length
    const itemStart = start + Math.max(0, offset)
    const marker = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/.exec(item.raw)
    const [first, ...rest] = item.tokens
    const words = first && (first.type === 'text' || first.type === 'paragraph') ? first : null
    const at = itemStart + (marker?.[0].length ?? 0)
    return {
      tokens: words ? words.tokens ?? [{ type: 'text', raw: words.text, text: words.text }] : [],
      start: at, end: words && marker && !words.raw.trim().includes('\n') ? at + words.raw.trim().length : -1,
      blocks: (words ? rest : item.tokens).map((/** @type {any} */ inner) => ({ token: inner, start: itemStart + Math.max(0, item.raw.indexOf(inner.raw)) })), step: 0,
    }
  })
}

/**
 * An entry's lead and the rest of its words, each with where it is in the source: the bold it starts with, else for a
 * programme a time and for key figures a number; what comes between them (a colon, a dash) left out.
 * @param {Entry} entry @param {string} kind @returns {Split}
 */
export function leadOf(entry, kind) {
  const [first, ...others] = entry.tokens
  const editable = entry.end >= 0
  const after = (/** @type {any[]} */ tokens, /** @type {number} */ from) => {
    const next = tokens[0], cut = next?.type === 'text' ? /** @type {RegExpExecArray} */ (SEP.exec(next.raw))[0].length : 0
    const rest = (cut ? [{ ...next, raw: next.raw.slice(cut), text: next.text.slice(/** @type {RegExpExecArray} */ (SEP.exec(next.text))[0].length) }, ...tokens.slice(1)] : tokens).filter((t) => t.raw.trim() || t.type !== 'text')
    return { rest, restAt: /** @type {[number, number] | null} */ (editable && rest.length && from + cut < entry.end ? [from + cut, entry.end] : null) }
  }
  if (first?.type === 'strong') return { lead: first.tokens, leadAt: editable ? [entry.start + 2, entry.start + first.raw.length - 2] : null, ...after(others, entry.start + first.raw.length) }
  const found = first?.type === 'text' && PATTERNS[kind]?.exec(first.raw)
  if (found) {
    const tail = first.raw.slice(found[0].length)
    return { lead: [{ type: 'text', raw: found[0], text: found[0] }], leadAt: editable ? [entry.start, entry.start + found[0].length] : null, ...after([...(tail ? [{ type: 'text', raw: tail, text: tail }] : []), ...others], entry.start + found[0].length) }
  }
  return { lead: null, leadAt: null, rest: entry.tokens, restAt: editable ? [entry.start, entry.end] : null }
}

/**
 * Where a slot's parts start: at each heading of the level its last heading has, but the heading the slot opens with when
 * there are more of them than the parts asked for (the slide's title, written at their level).
 * @param {any[]} tokens @param {number} count how many parts the layout has @returns {Set<number>}
 */
export function partHeads(tokens, count) {
  const heads = tokens.flatMap((token, i) => (token.type === 'heading' ? [{ depth: token.depth, i }] : []))
  if (!heads.length) return new Set()
  const depth = /** @type {{ depth: number }} */ (heads.at(-1)).depth
  const at = heads.filter((one) => one.depth === depth).map((one) => one.i)
  return new Set(at.length > count && at[0] === tokens.findIndex((token) => token.type !== 'space') ? at.slice(1) : at)
}

/**
 * The deck's contents, as Slidev's <Toc> reads them: each slide's title and level, but a slide with `hideInToc: true`,
 * the contents themselves, a cover, an introduction, the end and slides with no title. Where the deck has parts (slides
 * on `section` or `subsection`, or with a `level`), the parts alone, a section at level 1 and a subsection at 2; else
 * every slide, at its heading's level. `hideInToc: false` brings a slide back. Levels start at 1, `maxDepth` at most.
 * @param {import('./parse.js').Slide[]} slides @param {import('./kit.js').Kit} kit @param {number} at the contents' own slide
 * @param {number} [maxDepth] @returns {{ index: number, title: string, level: number }[]}
 */
export function contentsOf(slides, kit, at, maxDepth = 2) {
  const all = slides.map((slide) => {
    const name = layoutNameOf(slide, kit), given = slide.settings.level, hidden = slide.settings.hideInToc
    const depth = /^(#{1,6})\s/m.exec(slide.slots.map((slot) => slot.text).join('\n').replace(/^(`{3,}|~{3,})[\s\S]*?^\1/gm, ''))?.[1].length ?? 1
    const part = Number.isInteger(given) || name === 'section' || name === 'subsection'
    const level = Number.isInteger(given) ? given : name === 'section' ? 1 : name === 'subsection' ? 2 : depth
    const kept = Boolean(slide.title) && (hidden === false || (hidden !== true && slide.index !== at && !kit.layouts[name]?.contents && !['cover', 'intro', 'end'].includes(name)))
    return { index: slide.index, title: slide.title, level, part, kept, shown: hidden === false }
  }).filter((one) => one.kept)
  const chosen = all.some((one) => one.part) ? all.filter((one) => one.part || one.shown) : all
  const top = Math.min(...chosen.map((one) => one.level))
  return chosen.map(({ index, title, level }) => ({ index, title, level: level - top + 1 })).filter((one) => one.level <= Math.max(1, maxDepth))
}

/** Columns for a row of n, wrapping beyond `most`. @param {HTMLElement} figure @param {number} n @param {number} most */
const columns = (figure, n, most) => figure.style.setProperty('grid-template-columns', `repeat(${n <= most ? n : Math.ceil(n / 2)}, minmax(0, 1fr))`)

/**
 * A slot's lists as the figure its layout draws. Entries a click each (<v-clicks>) show their card, milestone, chevron,
 * row, level or tile at their step. @param {string} kind @param {Entry[]} entries @param {Context} context @returns {HTMLElement}
 */
export function listFigure(kind, entries, context) {
  const items = entries.map((entry) => ({ entry, ...leadOf(entry, kind) }))
  const n = items.length
  const figure = h('div', { class: `deck-figure deck-${kind}`, 'data-count': n })
  figure.style.setProperty('--deck-count', String(n))
  /** @typedef {(typeof items)[number]} Item */
  const at = (/** @type {[number, number] | null} */ where) => (where ? range(...where) : undefined)
  const lead = (/** @type {Item} */ item) => (item.lead ? h('span', { class: 'deck-words deck-lead', dir: 'auto', 'data-edit': at(item.leadAt) }, inline(item.lead, context)) : null)
  const text = (/** @type {Item} */ item) => (item.rest.length ? h('span', { class: 'deck-words deck-text', dir: 'auto', 'data-edit': at(item.restAt) }, inline(item.rest, context)) : null)
  // What is under an item: a list as words, a chart or a diagram as itself.
  const more = (/** @type {Item} */ item) => item.entry.blocks.map(({ token, start }) => {
    const element = block(token, start, context, null)
    if (element && !element.matches('.deck-block, .deck-table, pre')) element.classList.add('deck-words')
    return element
  })
  const stepped = (/** @type {Item} */ item, /** @type {(Element | null)[]} */ elements) => { if (item.entry.step) for (const one of elements) if (one) step(one, item.entry.step) }
  const cell = (/** @type {HTMLElement} */ element, /** @type {number} */ column, /** @type {number} */ row) => { element.style.setProperty('grid-column', String(column)); element.style.setProperty('grid-row', String(row)); return element }
  // The lead, else the words, as what a chevron or a level says; the words beside or under it when there is a lead.
  const label = (/** @type {Item} */ item) => lead(item) ?? text(item) ?? h('span', { class: 'deck-words deck-lead' })
  const under = (/** @type {Item} */ item, /** @type {string} */ name) => h('div', { class: name }, [item.lead ? text(item) : null, ...more(item)])
  switch (kind) {
    case 'steps':
      columns(figure, n, 5)
      for (const [i, item] of items.entries()) {
        const card = h('div', { class: 'deck-card deck-shape' }, [h('span', { class: 'deck-words deck-badge deck-shape' }, [context.number(i + 1)]), lead(item), text(item), ...more(item)])
        stepped(item, [card])
        figure.append(card)
      }
      break
    case 'metrics':
      columns(figure, n, 4)
      for (const item of items) {
        const metric = h('div', { class: 'deck-metric deck-shape' }, [lead(item), text(item), ...more(item)])
        stepped(item, [metric])
        figure.append(metric)
      }
      break
    case 'timeline':
      columns(figure, n, 99)
      // The line first, under its dots, from the first to the last.
      figure.append(h('span', { class: 'deck-timeline-line deck-shape' }))
      for (const [i, item] of items.entries()) {
        const parts = [cell(lead(item) ?? h('span', { class: 'deck-lead' }), i + 1, 1), cell(h('span', { class: 'deck-dot deck-shape' }), i + 1, 2), cell(h('div', { class: 'deck-milestone' }, [text(item), ...more(item)]), i + 1, 3)]
        stepped(item, parts)
        figure.append(...parts)
      }
      break
    case 'process':
      columns(figure, n, 99)
      for (const [i, item] of items.entries()) {
        const parts = [cell(h('div', { class: 'deck-chevron deck-shape', 'data-first': i === 0 || undefined, 'data-last': i === n - 1 || undefined }, [label(item)]), i + 1, 1), cell(under(item, 'deck-under'), i + 1, 2)]
        stepped(item, parts)
        figure.append(...parts)
      }
      break
    case 'agenda': {
      // In two columns from seven lines, the first holding the more.
      const halves = n >= 7 ? [items.slice(0, Math.ceil(n / 2)), items.slice(Math.ceil(n / 2))] : [items]
      figure.style.setProperty('grid-template-columns', `repeat(${halves.length}, minmax(0, 1fr))`)
      for (const half of halves) {
        figure.append(h('div', { class: 'deck-agenda-col' }, half.map((item) => {
          const row = h('div', { class: 'deck-row deck-shape' }, [lead(item) ?? h('span', { class: 'deck-lead' }), text(item), ...more(item)])
          stepped(item, [row])
          return row
        })))
      }
      break
    }
    case 'pyramid': {
      // Narrowest at the top, widest at the bottom, each level a band of one triangle; its words held to its top edge.
      const beside = items.some((item) => item.lead && (item.rest.length || item.entry.blocks.length))
      figure.style.setProperty('grid-template-columns', beside ? 'minmax(0, 1.15fr) minmax(0, 1fr)' : 'minmax(0, 30em)')
      const half = (/** @type {number} */ k) => Math.round(5000 * (0.16 + (0.84 * k) / n)) / 100
      for (const [i, item] of items.entries()) {
        const band = cell(h('div', { class: 'deck-level deck-shape' }, [label(item)]), 1, i + 1)
        band.style.setProperty('clip-path', `polygon(${50 - half(i)}% 0%, ${50 + half(i)}% 0%, ${50 + half(i + 1)}% 100%, ${50 - half(i + 1)}% 100%)`)
        band.style.setProperty('padding-inline', `max(0.4em, ${Math.round((50 - half(i)) * 100) / 100}%)`)
        const parts = [band, beside ? cell(under(item, 'deck-beside'), 2, i + 1) : null]
        stepped(item, parts)
        figure.append(...parts.filter((one) => one !== null))
      }
      break
    }
    case 'bento':
      for (const [i, item] of items.entries()) {
        const tile = h('div', { class: `deck-tile deck-shape${i === 0 ? ' is-big' : ''}` }, [lead(item), text(item), ...more(item)])
        stepped(item, [tile])
        figure.append(tile)
      }
      break
  }
  return figure
}

/**
 * A slot's parts as its layout sets them: face to face, the last on the fill, a medallion between each two (versus), or
 * in a grid of two columns, the second, top at the end, on the fill (matrix). Their words stay as they were drawn.
 * @param {string} kind @param {Node[][]} parts @returns {HTMLElement}
 */
export function partsFigure(kind, parts) {
  const figure = h('div', { class: `deck-figure deck-${kind}`, 'data-count': parts.length })
  if (kind === 'versus') figure.style.setProperty('grid-template-columns', parts.map(() => 'minmax(0, 1fr)').join(' auto '))
  for (const [i, children] of parts.entries()) {
    for (const child of children) if (child instanceof HTMLElement && !child.matches('.deck-block, .deck-table, pre, .deck-picture')) child.classList.add('deck-words')
    if (kind === 'versus' && i > 0) figure.append(h('span', { class: 'deck-vs deck-shape deck-words', 'aria-hidden': 'true' }, ['VS']))
    const highlight = parts.length > 1 && (kind === 'versus' ? i === parts.length - 1 : i === 1)
    figure.append(h('div', { class: `deck-part deck-shape${highlight ? ' is-highlight' : ''}` }, children))
  }
  return figure
}

/**
 * The deck's contents as rows, a part's number and its title, each going to its slide when chosen; a subsection under
 * its section, without a number; in two columns from seven rows. @param {Context} context @param {number} at its own slide
 * @param {number} [maxDepth] @returns {HTMLElement | null}
 */
export function contentsFigure(context, at, maxDepth) {
  const entries = context.deck ? contentsOf(context.deck.slides, context.kit, at, maxDepth) : []
  if (!entries.length) return null
  let n = 0
  const rows = entries.map(({ index, title, level }) => {
    const [heading] = context.lex(`# ${title}`)
    return h('div', { class: `deck-row deck-shape${level > 1 ? ' is-sub' : ''}`, 'data-go': index, role: 'link', tabindex: 0 }, [
      h('span', { class: 'deck-words deck-lead' }, level > 1 ? [] : [context.number(++n)]),
      h('span', { class: 'deck-words deck-text', dir: 'auto' }, inline(heading?.tokens ?? [{ type: 'text', text: title }], context)),
    ])
  })
  const halves = rows.length >= 7 ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))] : [rows]
  const figure = h('div', { class: 'deck-figure deck-agenda deck-contents', 'data-count': rows.length }, halves.map((half) => h('div', { class: 'deck-agenda-col' }, half)))
  figure.style.setProperty('grid-template-columns', `repeat(${halves.length}, minmax(0, 1fr))`)
  return figure
}
