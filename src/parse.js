// A deck's Markdown read as Slidev reads it (@slidev/parser's rules): slides between `---` lines;
// a `---` line followed by a line that isn't empty opens that slide's settings, YAML up to the next
// `---` line (or a ```yaml block at the slide's top); the first slide's settings are the deck's
// too (its headmatter); the last HTML comment at a slide's end is the speaker's notes; `::name::`
// on its own line starts a layout's slot. Fenced code and comments never split a slide. Every slide
// and slot keeps where it starts in the source, so an edit made on a slide goes back to its words.
// Read too, as brains write them even when asked for Slidev: Pandoc's and Quarto's fenced divs,
// `::: notes` as the notes, and `:::: columns` holding `::: column`s as slots (what is above them
// the heading, each column a slot, what is under them the foot), never rewritten.
// Pure: no DOM, no Markdown parser.
import { parseYaml } from './yaml.js'

/** @typedef {{ name: string, text: string, start: number }} Slot */
/** @typedef {{ index: number, start: number, end: number, settings: Record<string, any>, slots: Slot[], notes: string, title: string }} Slide */
/** @typedef {{ settings: Record<string, any>, slides: Slide[] }} Deck */

const SLOT = /^::([\w-]+)::\s*$/

/** @param {string} source @returns {Deck} */
export function parseDeck(source) {
  const text = source.replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  const offsets = [0]
  for (const line of lines) offsets.push(/** @type {number} */ (offsets.at(-1)) + line.length + 1)
  /** @type {{ start: number, end: number, matter: [number, number] | null }[]} */
  const ranges = []
  let start = 0, matter = /** @type {[number, number] | null} */ (null), comment = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd()
    if (comment) { comment = commentGoesOn(line, true); continue }
    if (line.startsWith('---') && !/^---\s*-/.test(line)) {
      if (i > start || matter) ranges.push({ start, end: i, matter })
      matter = null
      start = i + 1
      // Settings only when settings follow (a `key:` line), not words: Slidev would take a heading
      // there for settings and lose the slide, as decks brains write often start `---`, `# Title`.
      if (line[3] !== '-' && lines[i + 1]?.trim() && /^\s*([\w-]+\s*:|#\s)/.test(lines[i + 1]) && !/^#{1,6}\s/.test(lines[i + 1])) {
        let j = i + 1
        while (j < lines.length && lines[j].trimEnd() !== '---') j++
        matter = [i + 1, j]
        i = j
        start = j + 1
      }
    } else if (/^\s*(`{3,}|~{3,})/.test(line)) {
      const fence = /** @type {RegExpExecArray} */ (/^\s*(`{3,}|~{3,})/.exec(line))[1]
      let j = i + 1
      while (j < lines.length && !lines[j].trimStart().startsWith(fence)) j++
      if (j < lines.length) i = j
    } else comment = commentGoesOn(line, false)
  }
  if (start < lines.length || matter) ranges.push({ start, end: lines.length, matter })
  // No `---` at all, as a document or a Pandoc deck is written: a slide at each heading of the first
  // two levels, as Pandoc's slide level does, the headmatter staying with the first.
  const last = /** @type {{ start: number, end: number, matter: [number, number] | null }} */ (ranges.at(-1))
  if (ranges.length === 1 && last) {
    let fence = ''
    const heads = []
    for (let i = last.start; i < last.end; i++) {
      const mark = /^\s*(`{3,}|~{3,})/.exec(lines[i])?.[1]
      if (fence) { if (mark && lines[i].trimStart().startsWith(fence)) fence = '' }
      else if (mark) fence = mark
      else if (/^#{1,2}\s+\S/.test(lines[i])) heads.push(i)
    }
    if (heads.length >= 2) {
      ranges.pop()
      const cuts = heads[0] > last.start && !lines.slice(last.start, heads[0]).some((line) => line.trim()) ? heads : [last.start, ...heads.slice(heads[0] === last.start ? 1 : 0)]
      cuts.forEach((at, k) => ranges.push({ start: k === 0 ? last.start : at, end: cuts[k + 1] ?? last.end, matter: k === 0 ? last.matter : null }))
    }
  }
  const slides = ranges.map(({ start, end, matter }, index) => slide(lines, offsets, start, end, matter, index))
    .filter((one, i) => i === 0 || one.slots.some((slot) => slot.text.trim()) || Object.keys(one.settings).length)
  slides.forEach((one, i) => { one.index = i })
  return { settings: slides[0]?.settings ?? {}, slides }
}

/**
 * Pandoc's columns, as the lines where each slot starts: the first column `left`, the next `right`
 * (or `middle`, then `right`, for three), the line after the columns `bottom`. The fences' own lines
 * are left as they are and drawn as nothing. @param {string[]} lines @returns {Map<number, string>}
 */
function columnsOf(lines) {
  /** @type {Map<number, string>} */
  const starts = new Map()
  const open = lines.findIndex((line) => /^:{3,}[ \t]*\{?[ \t]*\.?columns\b/.test(line))
  if (open < 0) return starts
  const fence = /** @type {RegExpExecArray} */ (/^:+/.exec(lines[open]))[0]
  const close = lines.findIndex((line, i) => i > open && line.trim() === fence)
  const cols = lines.map((line, i) => [line, i]).filter(([line, i]) => Number(i) > open && (close < 0 || Number(i) < close) && /^:{3,}[ \t]*\{?[ \t]*\.?col(umn)?\b/.test(String(line))).map(([, i]) => Number(i))
  if (cols.length < 2) return starts
  const names = cols.length === 2 ? ['left', 'right'] : ['left', 'middle', 'right', ...cols.slice(3).map((_, k) => `col-${k + 4}`)]
  cols.forEach((at, k) => starts.set(at, names[k]))
  if (close > 0 && lines.slice(close + 1).some((line) => line.trim())) starts.set(close, 'bottom')
  return starts
}

/** Whether a comment is still open at this line's end. @param {string} line @param {boolean} open */
function commentGoesOn(line, open) {
  let at = 0
  for (;;) {
    if (open) {
      const end = line.indexOf('-->', at)
      if (end < 0) return true
      open = false
      at = end + 3
    } else {
      const begin = line.indexOf('<!--', at)
      if (begin < 0) return false
      const end = line.indexOf('-->', begin + 4)
      if (end < 0) return true
      at = end + 3
    }
  }
}

/**
 * @param {string[]} lines @param {number[]} offsets @param {number} from @param {number} to
 * @param {[number, number] | null} matter @param {number} index @returns {Slide}
 */
function slide(lines, offsets, from, to, matter, index) {
  let settings = matter ? parseYaml(lines.slice(matter[0], matter[1]).join('\n')) : {}
  let top = from
  // Slidev's other way to write settings: a ```yaml block at the slide's top.
  while (top < to && !lines[top].trim()) top++
  if (!matter && /^```ya?ml\s*$/.test(lines[top] ?? '')) {
    let j = top + 1
    while (j < to && !lines[j].startsWith('```')) j++
    settings = parseYaml(lines.slice(top + 1, j).join('\n'))
    from = j + 1
  }
  let body = lines.slice(from, to).join('\n')
  let notes = ''
  // remark's `???` and reveal.js's `Note:`: what follows, to the slide's end, is the notes.
  const after = /^(\?\?\?|Notes?:)[ \t]*(.*)$/m.exec(body)
  if (after && after.index !== undefined && !/^```/m.test(body.slice(after.index))) {
    notes = [after[2], body.slice(after.index + after[0].length)].join('\n').trim()
    body = body.slice(0, after.index)
  }
  // reveal.js's <aside class="notes">, wherever on the slide, as Pandoc's below.
  body = body.replace(/<aside\b[^>]*class=["']?notes["']?[^>]*>([\s\S]*?)<\/aside>/gi, (all, text) => {
    notes += (notes ? '\n' : '') + text.replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ').trim()
    return all.replace(/[^\n]/g, ' ')
  })
  // Pandoc's notes, wherever on the slide: kept as the notes, blanked in place so offsets stay.
  body = body.replace(/^(:{3,})[ \t]*\{?[ \t]*\.?notes[ \t]*\}?[ \t]*\n([\s\S]*?)\n\1[ \t]*$/gm, (all, _, text) => {
    notes += (notes ? '\n' : '') + text.trim()
    return all.replace(/[^\n]/g, ' ')
  })
  const comments = [...body.matchAll(/<!--([\s\S]*?)-->/g)]
  const last = comments.at(-1)
  if (last && last.index !== undefined && !body.slice(last.index + last[0].length).trim()) {
    notes = [last[1].trim(), notes].filter(Boolean).join('\n')
    body = body.slice(0, last.index)
  }
  // Each slot's text is the source's own, from where it starts, so offsets in it are the source's.
  /** @type {Slot[]} */
  const slots = []
  let name = 'default', first = from, fence = ''
  /** @type {string[]} */
  let taken = []
  const push = () => slots.push({ name, text: taken.join('\n'), start: offsets[first] })
  const columns = columnsOf(body.split('\n'))
  for (const [i, line] of body.split('\n').entries()) {
    const mark = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    const marker = SLOT.exec(line) ?? (columns.has(i) ? [line, /** @type {string} */ (columns.get(i))] : null)
    if (fence) { if (mark && line.trimStart().startsWith(fence)) fence = '' }
    else if (mark) fence = mark
    else if (marker) {
      push()
      name = marker[1]
      taken = []
      first = from + i + 1
      continue
    }
    taken.push(line)
  }
  push()
  const kept = slots.filter((slot, i) => i > 0 || slot.text.trim() || slots.length === 1)
  const heading = /^#{1,6}\s+(.+)$/m.exec(body.replace(/^```[\s\S]*?^```/gm, ''))
  return { index, start: offsets[matter ? matter[0] - 1 : from], end: offsets[to] - 1, settings, slots: kept, notes, title: String(settings.title ?? heading?.[1] ?? '').trim() }
}
