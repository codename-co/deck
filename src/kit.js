// A kit: a design system and the layouts that go with it, as data and never as CSS or code, so a
// person, an organisation or a brain can make one and no kit can do more than lay out a slide.
// deck's own kit holds the usual layouts; a host's (an organisation's, a project's) and the deck
// file's own `kit:` go over it, in that order. A layout is a grid: its slots by name, the areas
// they take, its tracks, how its words sit, what paper it is on, how big its logo shows, and the
// PowerPoint layout it is nearest to, and the art a template draws behind it, layers among the kit's
// pictures; a kit may turn one of the usual layouts off. Its tokens may hold a logo, a picture inside
// the kit and never an address, as its pictures are. Everything is checked against a small grammar;
// what fails is dropped, with a reason. Pure.

/** @typedef {{ required?: boolean, max_words?: number, max_chars?: number, items?: [number, number], item_max_words?: number, heading_max_words?: number, kind?: string }} Budget */
/** @typedef {{ label?: Record<string, string> | string, intent?: string, use_when?: string, avoid_when?: string, slots: string[], budgets: Record<string, Budget>, areas: string[][], columns: string[], rows: string[], align: 'start' | 'center' | 'end', justify: 'start' | 'center' | 'end', paper: 'paper' | 'fill' | 'ink' | 'soft', title: 'normal' | 'large' | 'huge', logo: 'big' | 'small' | 'none', pptx: string, numbered: boolean, art?: string[] }} Layout */
/** @typedef {{ name?: string, tokens: Record<string, any>, layouts: Record<string, Layout>, pictures: Record<string, string> }} Kit */

const NAME = /^[a-z][a-z0-9-]{0,31}$/
const TRACK = /^(auto|min-content|max-content|\d{1,2}(\.\d)?fr|\d{1,3}%)$/
const PPTX = ['Title Slide', 'Title and Content', 'Section Header', 'Two Content', 'Comparison', 'Title Only', 'Blank', 'Content with Caption', 'Picture with Caption']
const ENUMS = /** @type {const} */ ({ align: ['start', 'center', 'end'], justify: ['start', 'center', 'end'], paper: ['paper', 'fill', 'ink', 'soft'], title: ['normal', 'large', 'huge'], logo: ['small', 'big', 'none'] })
/** The corners a logo sits in, as `logoAt` names them, the first by default. */
export const CORNERS = ['top-end', 'top-start', 'bottom-end', 'bottom-start']

/**
 * A logo as a kit holds it: a picture inside the kit, PNG, JPEG, GIF, WebP or SVG as a data: address of 512 KB at most,
 * never an address to fetch; else null. @param {unknown} value
 */
export const logoOf = (value) => (typeof value === 'string' && value.length <= 700_000 && /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[a-z0-9+/]+=*$/i.test(value) ? value : null)

/**
 * A picture of a kit's, a layer of a layout's art drawn behind its words over the whole slide: a picture inside the kit as a
 * logo is, or an SVG written out (`data:image/svg+xml,…`), of 3 MB at most, never an address to fetch; else null. @param {unknown} value
 */
export const artOf = (value) => (typeof value === 'string' && value.length <= 3_145_728 && /^data:image\/(?:(?:png|jpeg|gif|webp|svg\+xml);base64,[a-z0-9+/]+=*|svg\+xml,[\w.!~*'()%/+=-]*)$/i.test(value) ? value : null)

/** The names brains give the usual layouts, for the ones deck has. */
export const ALIASES = /** @type {Record<string, string>} */ ({
  title: 'cover', 'title-slide': 'cover', 'two-columns': 'two-cols', 'two-column': 'two-cols', columns: 'two-cols', comparison: 'two-cols-header',
  'three-columns': 'three-cols', 'section-header': 'section', divider: 'section', big: 'fact', number: 'fact', 'image-text': 'image-right', closing: 'end', thanks: 'end',
})

/** deck's own kit: the usual layouts, the ones Slidev names and the ones PowerPoint has, as data. */
export const STANDARD = /** @type {Kit} */ ({
  name: 'standard',
  tokens: {},
  pictures: {},
  layouts: Object.fromEntries(Object.entries(/** @type {Record<string, any>} */ ({
    default: { label: { en: 'Title and content', fr: 'Titre et contenu' }, pptx: 'Title and Content' },
    cover: { label: { en: 'Cover', fr: 'Couverture' }, justify: 'center', paper: 'fill', title: 'huge', logo: 'big', pptx: 'Title Slide', numbered: false },
    intro: { label: { en: 'Introduction', fr: 'Introduction' }, justify: 'center', paper: 'fill', title: 'large', logo: 'big', pptx: 'Title Slide', numbered: false },
    section: { label: { en: 'Section', fr: 'Section' }, justify: 'center', paper: 'ink', title: 'huge', pptx: 'Section Header', numbered: false },
    center: { label: { en: 'Centred', fr: 'Centré' }, justify: 'center', align: 'center', pptx: 'Title Only' },
    statement: { label: { en: 'Statement', fr: 'Affirmation' }, justify: 'center', align: 'center', title: 'large', pptx: 'Title Only' },
    fact: { label: { en: 'Big number', fr: 'Grand chiffre' }, justify: 'center', align: 'center', title: 'huge', pptx: 'Title Only' },
    quote: { label: { en: 'Quote', fr: 'Citation' }, justify: 'center', pptx: 'Title Only' },
    end: { label: { en: 'Closing', fr: 'Clôture' }, justify: 'center', align: 'center', paper: 'fill', title: 'large', logo: 'big', pptx: 'Title Slide', numbered: false },
    full: { label: { en: 'Full', fr: 'Plein cadre' }, logo: 'none', pptx: 'Blank', numbered: false },
    none: { label: { en: 'Blank', fr: 'Vide' }, logo: 'none', pptx: 'Blank', numbered: false },
    'two-cols': { label: { en: 'Two columns', fr: 'Deux colonnes' }, slots: ['default', 'right'], areas: 'default right', columns: '1fr 1fr', pptx: 'Two Content' },
    'two-cols-header': { label: { en: 'Comparison', fr: 'Comparaison' }, slots: ['default', 'left', 'right', 'bottom'], areas: 'default default | left right | bottom bottom', columns: '1fr 1fr', rows: 'auto 1fr auto', pptx: 'Comparison' },
    'three-cols': { label: { en: 'Three columns', fr: 'Trois colonnes' }, slots: ['default', 'left', 'middle', 'right'], areas: 'default default default | left middle right', columns: '1fr 1fr 1fr', rows: 'auto 1fr', pptx: 'Comparison' },
    'image-left': { label: { en: 'Picture left', fr: 'Image à gauche' }, pptx: 'Picture with Caption', justify: 'center' },
    'image-right': { label: { en: 'Picture right', fr: 'Image à droite' }, pptx: 'Picture with Caption', justify: 'center' },
    image: { label: { en: 'Picture', fr: 'Image' }, logo: 'none', pptx: 'Blank', numbered: false },
  })).map(([name, given]) => [name, /** @type {Layout} */ (layoutOf(given).layout)])),
})

/**
 * A layout as given, checked: its slots, areas and tracks in the grammar, its words' place, paper
 * and size among their names. @param {any} given @returns {{ layout: Layout | null, problems: string[] }}
 */
export function layoutOf(given) {
  const problems = []
  if (!given || typeof given !== 'object') return { layout: null, problems: ['not a layout'] }
  // Slots as names, or as a catalog writes them: each a budget, `title` being the heading the
  // default slot opens with rather than a slot of its own.
  /** @type {Record<string, Budget>} */
  const budgets = {}
  const named = Array.isArray(given.slots) || typeof given.slots === 'string' ? [given.slots].flat().map(String)
    : given.slots && typeof given.slots === 'object' ? Object.entries(given.slots).map(([name, budget]) => {
      if (budget && typeof budget === 'object') budgets[name] = clean(budget)
      return name === 'title' ? 'default' : name
    }) : ['default']
  const slots = [...new Set(named)]
  if (!slots.every((slot) => NAME.test(slot))) return { layout: null, problems: ['a slot name is not a-z, 0-9 and -'] }
  if (!slots.includes('default')) slots.unshift('default')
  // Areas as Slidev's and CSS's grid write them, rows split by | or new lines.
  /** @type {string[]} */
  const lines = Array.isArray(given.areas) ? given.areas.map((/** @type {any} */ row) => [row].flat().join(' ')) : String(given.areas ?? slots.join(' ')).split(/\||\n/)
  const rows = lines.map((row) => row.trim().replace(/^"|"$/g, '').split(/\s+/)).filter((row) => row.length && row[0])
  const width = rows[0]?.length ?? 0
  if (!rows.length || rows.some((row) => row.length !== width) || rows.flat().some((cell) => cell !== '.' && !slots.includes(cell))) return { layout: null, problems: ['areas are not a rectangle of its slots'] }
  for (const slot of slots) {
    const cells = rows.flatMap((row, y) => row.map((cell, x) => /** @type {[string, number, number]} */ ([cell, x, y]))).filter(([cell]) => cell === slot)
    if (!cells.length) { if (slot !== 'default') problems.push(`slot ${slot} has no area`); continue }
    const xs = cells.map((c) => c[1]), ys = cells.map((c) => c[2])
    if (cells.length !== (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1)) return { layout: null, problems: [`slot ${slot} is not a rectangle`] }
  }
  const tracks = (/** @type {any} */ value, /** @type {number} */ count) => {
    const list = value === undefined ? Array(count).fill('1fr') : (Array.isArray(value) ? value : String(value).split(/\s+/)).map(String)
    return list.length === count && list.every((t) => TRACK.test(t)) ? list : null
  }
  const columns = tracks(given.columns, width), rowTracks = tracks(given.rows, rows.length)
  if (!columns || !rowTracks) return { layout: null, problems: ['columns or rows are not tracks deck knows (auto, 1fr, 40%…), one per column or row'] }
  const pick = (/** @type {keyof typeof ENUMS} */ key, /** @type {string} */ fallback) => {
    const value = String(given[key] ?? fallback)
    if (!(/** @type {readonly string[]} */ (ENUMS[key])).includes(value)) { problems.push(`${key} ${value} is not one of ${ENUMS[key].join(', ')}`); return fallback }
    return value
  }
  const label = typeof given.label === 'string' || (given.label && typeof given.label === 'object') ? given.label : undefined
  const art = Array.isArray(given.art) && given.art.length <= 8 && given.art.every((/** @type {unknown} */ one) => typeof one === 'string' && NAME.test(one)) ? given.art : undefined
  if (given.art !== undefined && !art) problems.push('art is not 8 names at most')
  const words = (/** @type {any} */ v) => (typeof v === 'string' ? v.slice(0, 300) : undefined)
  return {
    layout: /** @type {Layout} */ ({
      label, intent: words(given.intent), use_when: words(given.use_when), avoid_when: words(given.avoid_when), slots, budgets, areas: rows, columns, rows: rowTracks,
      align: pick('align', 'start'), justify: pick('justify', 'start'), paper: pick('paper', 'paper'), title: pick('title', 'normal'), logo: pick('logo', 'small'),
      pptx: PPTX.includes(given.pptx) ? given.pptx : slots.length > 1 ? 'Comparison' : 'Title and Content', numbered: given.numbered !== false, art,
    }),
    problems,
  }
}

/** A slot's budget, its numbers only. @param {Record<string, any>} given @returns {Budget} */
function clean(given) {
  /** @type {Record<string, any>} */
  const kept = {}
  for (const key of ['max_words', 'max_chars', 'item_max_words', 'heading_max_words']) if (Number.isInteger(given[key]) && given[key] > 0) kept[key] = given[key]
  if (Array.isArray(given.items) && given.items.length === 2 && given.items.every(Number.isInteger)) kept.items = given.items
  if (typeof given.required === 'boolean') kept.required = given.required
  if (typeof given.kind === 'string' && /^[a-z-]{1,20}$/.test(given.kind)) kept.kind = given.kind
  return kept
}

/**
 * Design tokens as the W3C's Design Tokens format (DTCG 2025.10) writes them, read into a kit's:
 * `color.light` and `color.dark` groups (bg, surface, fg, muted, accent) or flat colours, `font.sans`
 * and the like; each `$value` a colour string or a colour object with its `hex` and `alpha`. Tokens already flat
 * pass through. @param {any} given @returns {Record<string, any>}
 */
export function tokensFrom(given) {
  if (!given || typeof given !== 'object') return {}
  if (!JSON.stringify(given).includes('"$value"')) return given
  const value = (/** @type {any} */ t) => (t && typeof t === 'object' && '$value' in t ? t.$value : t)
  // A colour object's alpha kept, as #rrggbbaa.
  const colour = (/** @type {any} */ t) => { const v = value(t); return typeof v === 'string' ? v : typeof v?.hex === 'string' ? `${v.hex}${typeof v.alpha === 'number' && v.alpha < 1 ? Math.round(Math.max(0, v.alpha) * 255).toString(16).padStart(2, '0') : ''}` : undefined }
  const face = (/** @type {any} */ t) => { const v = value(t); return Array.isArray(v) ? v.map(String) : typeof v === 'string' ? [v] : undefined }
  const NAMES = /** @type {const} */ ({ bg: 'paper', background: 'paper', paper: 'paper', fg: 'ink', text: 'ink', ink: 'ink', accent: 'primary', primary: 'primary', muted: 'muted', surface: 'soft', soft: 'soft' })
  const group = (/** @type {any} */ g) => Object.fromEntries(Object.entries(g ?? {}).filter(([k]) => k in NAMES).map(([k, t]) => [NAMES[/** @type {keyof typeof NAMES} */ (k)], colour(t)]).filter(([, v]) => v))
  const colours = given.color ?? given.colour ?? {}
  /** @type {Record<string, any>} */
  const tokens = { ...group(colours), ...group(colours.light) }
  const dark = group(colours.dark)
  if (Object.keys(dark).length) tokens.dark = dark
  const fonts = given.font ?? given.fontFamily ?? {}
  const heading = face(fonts.heading ?? fonts.display ?? fonts.sans), body = face(fonts.body ?? fonts.text ?? fonts.sans)
  if (heading || body) tokens.fonts = { heading: heading ?? body, body: body ?? heading }
  return tokens
}

/**
 * Kits merged, the later over the earlier: their tokens, their dark ones within theirs, their layouts by name and their
 * pictures, each checked; a layout given as false is taken away, but the default. A logo that isn't a picture inside the
 * kit is dropped. @param {...any} kits @returns {{ kit: Kit, problems: string[] }}
 */
export function mergeKits(...kits) {
  /** @type {Kit} */
  const kit = { name: 'standard', tokens: {}, layouts: { ...STANDARD.layouts }, pictures: {} }
  const problems = []
  for (const given of kits) {
    if (!given || typeof given !== 'object') continue
    if (typeof given.name === 'string') kit.name = given.name
    if (given.tokens && typeof given.tokens === 'object') {
      const next = tokensFrom(given.tokens), dark = next.dark && typeof next.dark === 'object' ? { ...kit.tokens.dark, ...next.dark } : kit.tokens.dark
      kit.tokens = { ...kit.tokens, ...next, ...(dark && { dark }) }
    }
    for (const [name, picture] of Object.entries(given.pictures ?? {})) {
      if (NAME.test(name) && artOf(picture)) kit.pictures[name] = picture
      else problems.push(`picture ${name}: not a picture inside the kit`)
    }
    for (const [name, definition] of Object.entries(given.layouts ?? given.types ?? {})) {
      if (!NAME.test(name)) { problems.push(`layout ${name}: not a-z, 0-9 and -`); continue }
      if (definition === false) { if (name !== 'default') delete kit.layouts[name]; continue }
      const { layout, problems: found } = layoutOf(definition)
      problems.push(...found.map((p) => `layout ${name}: ${p}`))
      if (layout) kit.layouts[name] = layout
    }
  }
  for (const [where, tokens] of /** @type {[string, Record<string, any> | undefined][]} */ ([['logo', kit.tokens], ['dark logo', kit.tokens.dark]])) {
    if (tokens?.logo !== undefined && !logoOf(tokens.logo)) { problems.push(`${where}: not a picture inside the kit (PNG, JPEG, GIF, WebP or SVG as data:, 512 KB at most)`); delete tokens.logo }
  }
  if (kit.tokens.logoAt !== undefined && !CORNERS.includes(kit.tokens.logoAt)) { problems.push(`logoAt ${kit.tokens.logoAt} is not one of ${CORNERS.join(', ')}`); delete kit.tokens.logoAt }
  return { kit, problems }
}

/** A layout's name in a language, else its own name. @param {Layout} layout @param {string} name @param {string} lang */
export function labelOf(layout, name, lang) {
  if (typeof layout.label === 'string') return layout.label
  return layout.label?.[lang] ?? layout.label?.[lang.split('-')[0]] ?? layout.label?.en ?? name
}

/**
 * The layout a slide that names none is given, from what it holds, as Pandoc's PowerPoint writer
 * chooses: the first slide is the cover; a heading alone, a section; slots beyond the first, the
 * layout of two (or three) columns that has them; a number alone as its heading, a fact; a quote
 * alone, a quote; else the default. @param {{ index: number, slots: { name: string, text: string }[] }} slide
 */
export function inferLayout(slide) {
  const names = slide.slots.map((slot) => slot.name)
  if (names.includes('middle')) return 'three-cols'
  if (names.includes('left')) return 'two-cols-header'
  if (names.includes('right')) return 'two-cols'
  if (slide.index === 0) return 'cover'
  const text = slide.slots.map((slot) => slot.text).join('\n').trim()
  const lines = text.split('\n').filter((line) => line.trim())
  if (lines.length === 1 && /^#{1,2}\s+\S/.test(lines[0])) return 'section'
  if (/^#\s+[^\s]*\d[\d\s.,%€$£¥]*\S*\s*$/u.test(lines[0] ?? '') && lines.length <= 3 && !/^\s*[-*\d]+[.)]?\s/m.test(lines.slice(1).join('\n'))) return 'fact'
  if (lines.length && lines.every((line, i) => line.startsWith('>') || (i === lines.length - 1 && !line.startsWith('#')))) return lines[0].startsWith('>') ? 'quote' : 'default'
  return 'default'
}
