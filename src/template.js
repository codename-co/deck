// A kit from a company's PowerPoint template (.potx, .pptx, or an Office theme, .thmx), and a kit's tokens out in the W3C's Design Tokens format:
// a module of its own (@codename/deck/template), which a host loads only when it reads or writes one. From the template,
// its theme's colours (the first light its paper, the first dark its ink, the first accent its primary, the six accents a
// chart's colours) and faces (headings', words'); the first picture on its slide master, its logo, in the corner it sits
// in; and each slide layout, a layout of the kit by its name, its placeholders a grid of slots, on the paper its
// background is, with its art: what a slide on it shows besides its placeholders (its background, the master's shapes and
// pictures, its own, their text), drawn as SVG layers behind the words, each kept once among the kit's pictures. The file is read with the platform's own
// DecompressionStream and its XML with regular expressions, as a page under Trusted Types parses no markup. What can't be
// read is left out, with a reason.

import { STANDARD, mergeKits, logoOf, artOf } from './kit.js'
import { contrast, rgbOf } from './look.js'

/** The slide layouts PowerPoint names as deck's own are: a template's take their place. */
const OWN = /** @type {Record<string, string>} */ ({ 'Title Slide': 'cover', 'Title and Content': 'default', 'Section Header': 'section', 'Two Content': 'two-cols-header', 'Title Only': 'center', Blank: 'none' })
const PPTX = ['Title Slide', 'Title and Content', 'Section Header', 'Two Content', 'Comparison', 'Title Only', 'Blank', 'Content with Caption', 'Picture with Caption']
const PICTURES = /** @type {Record<string, string>} */ ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' })
/** The pictures a browser draws in a layout's art, and how large one may be. */
const DRAWN = /** @type {Record<string, string>} */ ({ ...PICTURES, webp: 'image/webp', bmp: 'image/bmp' })
const PICTURE_MB = 2, ART_MB = 3
/** A point is 12,700 of PowerPoint's units: art is drawn in points. */
const EMU = 12700

/** A zip's files by name, each read when asked. @param {Uint8Array} bytes */
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = bytes.length - 22
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--
  if (end < 0) throw new Error('not a PowerPoint file')
  /** @type {Map<string, () => Promise<Uint8Array>>} */
  const files = new Map()
  for (let at = view.getUint32(end + 16, true), n = view.getUint16(end + 10, true); n > 0; n--) {
    const method = view.getUint16(at + 10, true), size = view.getUint32(at + 20, true), name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + view.getUint16(at + 28, true)))
    const local = view.getUint32(at + 42, true), start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true), data = bytes.subarray(start, start + size)
    files.set(name, async () => (method === 0 ? data : new Uint8Array(await new Response(new Blob([/** @type {BlobPart} */ (data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())))
    at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
  }
  return files
}

/** An attribute's value in a piece of XML. @param {string} xml @param {string} name */
const attr = (xml, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(xml)?.[1]
/** A part's relationships, by their ids, as paths from the package's root. @param {string} rels @param {string} from the part's folder */
const targets = (rels, from) => new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(([one]) => [String(attr(one, 'Id')), new URL(String(attr(one, 'Target')), `file:///${from}/`).pathname.slice(1)]))

/**
 * A kit read from a PowerPoint template, with what couldn't be read.
 * @param {Uint8Array} bytes a .potx, .pptx or .thmx @param {{ name?: string }} [options]
 * @returns {Promise<{ kit: import('./kit.js').Kit, problems: string[] }>}
 */
export async function kitFromTemplate(bytes, { name } = {}) {
  const files = unzip(bytes), problems = /** @type {string[]} */ ([])
  const text = async (/** @type {string} */ path) => new TextDecoder().decode(await (files.get(path)?.() ?? new Uint8Array()))
  // A template's parts are under ppt/, an Office theme's under theme/.
  const master = [...files.keys()].filter((path) => /^(ppt|theme)\/slideMasters\/slideMaster\d+\.xml$/.test(path)).sort()[0]
  if (!master) throw new Error('no slide master: not a PowerPoint template')
  const root = master.split('/')[0], masterXml = await text(master), masterRels = targets(await text(master.replace(/([^/]+)$/, '_rels/$1.rels')), `${root}/slideMasters`)
  const themePath = [...masterRels.values()].find((path) => /theme\/theme\d+\.xml$/.test(path)) ?? `${root}/theme/theme1.xml`, theme = await text(themePath)
  const [cx, cy] = ((size) => [Number(attr(size, 'cx') ?? 12192000), Number(attr(size, 'cy') ?? 6858000)])(/<p:sldSz\b[^>]*>/.exec(await text(`${root}/presentation.xml`))?.[0] ?? '')

  // Its theme: colours by their role, as its master maps them to the paper and the words (bg1, tx1…), faces for headings and words.
  const mapOf = (/** @type {string} */ xml) => Object.fromEntries([...(/<(?:p:clrMap|a:overrideClrMapping)\b[^>]*>/.exec(xml)?.[0] ?? '').matchAll(/(\w+)="(\w+)"/g)].map(([, key, value]) => [key, value]))
  const masterMap = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2', ...mapOf(masterXml) }
  const scheme = Object.fromEntries([...theme.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)>\s*<a:(?:srgbClr\b[^>]*\bval|sysClr\b[^>]*\blastClr)="([0-9A-Fa-f]{6})"/g)].map(([, role, value]) => [role, `#${value.toLowerCase()}`]))
  const face = (/** @type {string} */ part) => attr(new RegExp(`<a:${part}>[\\s\\S]*?<a:latin\\b[^>]*>`).exec(theme)?.[0].replace(/^[\s\S]*<a:latin/, '') ?? '', 'typeface')
  const [heading, body] = [face('majorFont'), face('minorFont')].map((one) => (one && !one.startsWith('+') ? [one, 'ui-sans-serif', 'system-ui', 'sans-serif'] : null))
  /** @type {Record<string, any>} */
  const tokens = Object.fromEntries(/** @type {[string, string][]} */ ([['paper', masterMap.bg1], ['ink', masterMap.tx1], ['primary', 'accent1'], ['muted', masterMap.tx2], ['soft', masterMap.bg2]]).filter(([, role]) => scheme[role]).map(([key, role]) => [key, scheme[role]]))
  const accents = [1, 2, 3, 4, 5, 6].map((n) => scheme[`accent${n}`]).filter(Boolean)
  if (accents.length) tokens.series = accents
  if (heading || body) tokens.fonts = { heading: heading ?? body, body: body ?? heading }

  // Its logo: the first picture on its master that a browser draws, in the corner it sits in.
  let logoPath = ''
  for (const [pic] of masterXml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
    const path = masterRels.get(String(attr(/<a:blip\b[^>]*>/.exec(pic)?.[0] ?? '', 'r:embed'))), type = PICTURES[/\.(\w+)$/.exec(path ?? '')?.[1].toLowerCase() ?? '']
    if (!path || !type || !files.has(path)) continue
    const data = await files.get(path)?.(), url = data && `data:${type};base64,${base64(data)}`
    if (!logoOf(url)) { problems.push(`the logo ${path.split('/').pop()} is larger than 512 KB`); break }
    const [x, y] = ((off) => [Number(attr(off, 'x') ?? 0), Number(attr(off, 'y') ?? 0)])(/<a:off\b[^>]*>/.exec(pic)?.[0] ?? '')
    Object.assign(tokens, { logo: url, logoAt: `${y < cy / 2 ? 'top' : 'bottom'}-${x < cx / 2 ? 'start' : 'end'}` })
    logoPath = path
    break
  }

  // What its art is drawn with: its colours by role, its colour map, its styles' fills and lines, its faces, its pictures.
  const lists = (/** @type {string} */ list) => children(new RegExp(`<a:${list}>([\\s\\S]*?)</a:${list}>`).exec(theme)?.[1] ?? '').map((one) => one.xml)
  /** @type {Art} */
  const art = { scheme: Object.fromEntries(Object.entries(scheme).map(([role, hex]) => [role, rgbOf(hex.slice(1))])), map: masterMap, rels: masterRels, files, size: [cx / EMU, cy / EMU],
    themeRels: targets(await text(themePath.replace(/([^/]+)$/, '_rels/$1.rels')), themePath.replace(/\/[^/]+$/, '')),
    styles: { fill: lists('fillStyleLst'), line: lists('lnStyleLst'), bg: lists('bgFillStyleLst') }, faces: { major: face('majorFont') ?? '', minor: face('minorFont') ?? '' },
    pictures: new Map(), used: new Set(), noted: new Set(), ids: { n: 0 }, defs: [] }
  // The master's shapes, drawn once for each colour map its layouts read them with.
  const underneath = new Map()
  const masterArt = (/** @type {Record<string, string>} */ map) => underneath.get(JSON.stringify(map)) ?? underneath.set(JSON.stringify(map), ((used) => drawTree(treeOf(masterXml), { ...art, map, used, ids: { n: 0 } })
    .then((svg) => ({ svg, used })))(new Set())).get(JSON.stringify(map))
  // A colour as its role is, by the paper it is for: the background's its paper, the words' its ink, the first accent its fill, the second background's soft.
  const roles = /** @type {Record<string, string>} */ (Object.fromEntries([[masterMap.bg2, 'soft'], ['accent1', 'fill'], [masterMap.tx1, 'ink'], [masterMap.bg1, 'paper']].filter(([role]) => scheme[role]).map(([role, paper]) => [scheme[role], paper])))
  const [ink, paper] = [art.scheme[masterMap.tx1] ?? [0, 0, 0], art.scheme[masterMap.bg1] ?? [255, 255, 255]]

  // Its layouts: each placeholder where it sits, else where the master's of its kind sits; its art behind them.
  const placed = (/** @type {string} */ xml) => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap(([sp]) => {
    const ph = /<p:ph\b[^>]*>/.exec(sp)?.[0]
    if (!ph) return []
    const off = /<a:off\b[^>]*>/.exec(sp)?.[0], ext = /<a:ext\b[^>]*>/.exec(sp)?.[0]
    return [{ type: attr(ph, 'type') ?? 'body', name: attr(/<p:cNvPr\b[^>]*>/.exec(sp)?.[0] ?? '', 'name') ?? '', box: off && ext ? [Number(attr(off, 'x')), Number(attr(off, 'y')), Number(attr(ext, 'cx')), Number(attr(ext, 'cy'))] : null }]
  })
  const masterBoxes = placed(masterXml)
  /** @type {Record<string, any>} */
  const layouts = {}, pictures = /** @type {Record<string, string>} */ ({})
  // A layer of art, kept once among the kit's pictures by what it holds: its name, or none where it is too large.
  const layer = (/** @type {string} */ drawn, /** @type {string} */ where) => {
    const url = drawn ? artOf(svgOf(drawn, art.size)) : null
    if (drawn && !url) problems.push(`layout ${where}: a layer of its art is larger than ${ART_MB} MB`)
    if (!url) return []
    let hash = 2166136261
    for (let i = 0; i < url.length; i++) hash = Math.imul(hash ^ url.charCodeAt(i), 16777619) >>> 0
    pictures[`art-${hash.toString(36)}`] = url
    return [`art-${hash.toString(36)}`]
  }
  const paths = [...masterRels.values()].filter((path) => /slideLayouts\/slideLayout\d+\.xml$/.test(path)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]))
  for (const path of paths) {
    const xml = await text(path), title = (attr(/<p:cSld\b[^>]*>/.exec(xml)?.[0] ?? '', 'name') ?? '').replace(/&amp;/g, '&').trim()
    const boxes = placed(xml).filter((one) => !['dt', 'ftr', 'sldNum'].includes(one.type)).map((one) => ({ ...one, box: one.box ?? masterBoxes.find((m) => m.type === one.type || (one.type === 'ctrTitle' && m.type === 'title'))?.box ?? null }))
      .filter((one) => one.box)
    const key = OWN[title] ?? (title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(?=\d)/, 'l-').slice(0, 32) || `layout-${paths.indexOf(path) + 1}`)
    // Its art: its background, the master's shapes unless it hides them, its own; the paper its words read on.
    // Each layer its own SVG, its gradients and patterns numbered from one, so that layers alike are kept once.
    const here = { ...art, map: { ...masterMap, ...mapOf(xml) }, rels: targets(await text(path.replace(/([^/]+)$/, '_rels/$1.rels')), path.replace(/\/[^/]+$/, '')), used: new Set(), ids: { n: 0 } }
    const own = bgOf(xml), back = await backOf(own ?? bgOf(masterXml), { ...here, ids: { n: 0 }, ...(!own && { rels: masterRels }) })
    const under = /<p:sldLayout\b[^>]*\bshowMasterSp="(0|false)"/.test(xml) ? { svg: '', used: new Set() } : await masterArt(here.map)
    const mine = await drawTree(treeOf(xml), here), words = wordsOf(xml, masterXml, here), role = back.rgb ? roles[hexOf(back.rgb)] : undefined
    // Words the template sets light over its art read on ink; else on the paper their background is, a colour of the theme by its role.
    const light = words && contrast(words, ink) > contrast(words, paper)
    const sheet = role === 'fill' ? 'fill' : light && (under.svg || mine || !role) ? 'ink' : role ?? (back.rgb && contrast(back.rgb, ink) < contrast(back.rgb, paper) ? 'ink' : 'paper')
    const layers = [...layer(sheet === role ? '' : back.svg, title || key), ...layer(under.svg, title || key), ...layer(mine, title || key)]
    const layout = gridOf(boxes, cx, cy, layers.length > 0)
    if (!layout) { problems.push(`layout ${title || key}: its placeholders make no grid deck lays out`); continue }
    const logo = logoPath && (here.used.has(logoPath) || under.used.has(logoPath)) ? 'none' : STANDARD.layouts[key]?.logo ?? 'small'
    // Its words aligned as its title is.
    const align = /** @type {Record<string, string>} */ ({ ctr: 'center', r: 'end' })[titleSays(xml, masterXml, /<a:(?:lvl1pPr|pPr)\b[^>]*\balgn="(\w+)"/) ?? ''] ?? 'start'
    layouts[key] = { label: title || key, ...layout, paper: sheet, title: boxes.some((one) => one.type === 'ctrTitle') ? 'huge' : 'normal', logo, align,
      ...(boxes.some((one) => one.type === 'ctrTitle') && { justify: 'center' }), pptx: PPTX.includes(title) ? title : layout.slots.length > 1 ? 'Comparison' : 'Title and Content',
      numbered: /<p:ph\b[^>]*type="sldNum"/.test(xml), ...(layers.length && { art: layers }) }
  }
  // A template has one look: drawn with art, its paper and words by night are its own by day (its main colour is so already).
  if (Object.values(layouts).some((layout) => layout.art)) tokens.dark = Object.fromEntries(['paper', 'ink', 'muted', 'soft'].filter((key) => tokens[key]).map((key) => [key, tokens[key]]))
  const merged = mergeKits({ name: name ?? 'template', tokens, layouts, pictures })
  return { kit: { ...merged.kit, name: name ?? 'template' }, problems: [...problems, ...art.noted, ...merged.problems] }
}

/**
 * What a layout's art is drawn with: the theme's colours by role and the part's colour map, its relationships and the theme's, the theme's
 * fills, lines and faces, the pictures read, those this part drew, what couldn't be drawn, the gradients and patterns a
 * shape paints with, and the group's fill.
 * @typedef {{ scheme: Record<string, number[] | null>, map: Record<string, string>, rels: Map<string, string>, themeRels: Map<string, string>, files: Map<string, () => Promise<Uint8Array>>, size: number[],
 *   styles: { fill: string[], line: string[], bg: string[] }, faces: { major: string, minor: string }, pictures: Map<string, Promise<string | null>>, used: Set<string>,
 *   noted: Set<string>, ids: { n: number }, defs: string[], group?: string }} Art
 */
/** @typedef {{ name: string, tag: string, inner: string, xml: string }} Part */
/** @typedef {{ rgb: number[], alpha: number }} Colour */

/** The elements directly inside a piece of XML, in order: each its name, its opening tag, what it holds, and itself. @param {string | undefined} xml @returns {Part[]} */
function children(xml = '') {
  const out = /** @type {Part[]} */ ([])
  let depth = 0, tag = '', from = 0, at = 0
  for (const m of xml.matchAll(/<(\/?)([\w:]+)[^>]*?(\/?)>/g)) {
    const index = /** @type {number} */ (m.index)
    if (m[1]) { if (--depth === 0) out.push({ name: m[2], tag, inner: xml.slice(from, index), xml: xml.slice(at, index + m[0].length) }) }
    else if (m[3]) { if (!depth) out.push({ name: m[2], tag: m[0], inner: '', xml: m[0] }) }
    else if (!depth++) { tag = m[0]; at = index; from = index + m[0].length }
  }
  return out
}
/** The first element of a name directly inside. @param {string | undefined} xml @param {string} name */
const child = (xml, name) => children(xml).find((one) => one.name === name)
/** A part's tree of shapes. @param {string} xml */
const treeOf = (xml) => /<p:spTree>([\s\S]*)<\/p:spTree>/.exec(xml)?.[1] ?? ''
/** A part's background, if it has one. @param {string} xml */
const bgOf = (xml) => /<p:bg>([\s\S]*?)<\/p:bg>/.exec(xml)?.[1]
/** A number as art writes it. @param {number} value */
const n = (value) => String(Math.round(value * 100) / 100)

/** @param {number[]} rgb */
const hexOf = (rgb) => `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`
/** @param {number} c */
const toLinear = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
/** @param {number} v */
const fromLinear = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055)
/** @param {number[]} rgb @returns {number[]} hue in degrees, saturation and lightness */
function hslOf([r, g, b]) {
  const [x, y, z] = [r / 255, g / 255, b / 255], max = Math.max(x, y, z), min = Math.min(x, y, z), l = (max + min) / 2, d = max - min
  if (!d) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1)), h = max === x ? ((y - z) / d) % 6 : max === y ? (z - x) / d + 2 : (x - y) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}
/** @param {number} h @param {number} s @param {number} l */
function rgbFrom(h, s, l) {
  const c = (1 - Math.abs(2 * Math.min(1, Math.max(0, l)) - 1)) * Math.min(1, s), x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = Math.min(1, Math.max(0, l)) - c / 2
  const [p, q, u] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [p + m, q + m, u + m].map((v) => v * 255)
}
const NAMED = /** @type {Record<string, string>} */ ({ black: '000000', white: 'ffffff', gray: '808080', grey: '808080', red: 'ff0000', green: '008000', blue: '0000ff', yellow: 'ffff00' })

/**
 * The colour an element holds, its own, its role's through the part's map, or (phClr) its style's, with the changes
 * PowerPoint makes to it: lighter or darker, a tint, a shade, see-through. @param {string} xml @param {Art} art @param {Colour | null} [ph]
 * @returns {Colour | null}
 */
function colourOf(xml, art, ph = null) {
  const one = children(xml).find((part) => /^a:(srgbClr|schemeClr|sysClr|prstClr|scrgbClr|hslClr)$/.test(part.name))
  if (!one) return null
  const val = attr(one.tag, 'val') ?? '', number = (/** @type {string} */ key) => Number(attr(one.tag, key) ?? 0) / 100000
  let rgb = one.name === 'a:srgbClr' ? rgbOf(val) : one.name === 'a:sysClr' ? rgbOf(attr(one.tag, 'lastClr') ?? (val === 'window' ? 'ffffff' : '000000'))
    : one.name === 'a:schemeClr' ? (val === 'phClr' ? ph?.rgb ?? null : art.scheme[art.map[val] ?? val] ?? null) : one.name === 'a:prstClr' ? rgbOf(NAMED[val] ?? '808080')
    : one.name === 'a:scrgbClr' ? ['r', 'g', 'b'].map((key) => fromLinear(number(key))) : rgbFrom(Number(attr(one.tag, 'hue') ?? 0) / 60000, number('sat'), number('lum'))
  if (!rgb) return null
  let alpha = val === 'phClr' ? ph?.alpha ?? 1 : 1
  for (const change of children(one.inner)) {
    const by = Number(attr(change.tag, 'val') ?? 100000) / 100000, [h, s, l] = hslOf(rgb)
    if (change.name === 'a:alpha') alpha = by
    else if (change.name === 'a:alphaMod') alpha *= by
    else if (change.name === 'a:lumMod') rgb = rgbFrom(h, s, l * by)
    else if (change.name === 'a:lumOff') rgb = rgbFrom(h, s, l + by)
    else if (change.name === 'a:satMod') rgb = rgbFrom(h, s * by, l)
    else if (change.name === 'a:hueMod') rgb = rgbFrom((h * by) % 360, s, l)
    else if (change.name === 'a:hueOff') rgb = rgbFrom((h + by * 100000 / 60000 + 360) % 360, s, l)
    else if (change.name === 'a:shade') rgb = rgb.map((c) => fromLinear(toLinear(c) * by))
    else if (change.name === 'a:tint') rgb = rgb.map((c) => fromLinear(1 - (1 - toLinear(c)) * by))
  }
  return { rgb, alpha }
}

/** A picture of the part's, as a data: address to draw, once read; null where browsers draw none, or it is too large. @param {string | undefined} id @param {Art} art */
async function hrefOf(id, art) {
  const path = id ? art.rels.get(id) : undefined, read = path && art.files.get(path)
  if (!path || !read) return null
  const type = DRAWN[/\.(\w+)$/.exec(path)?.[1].toLowerCase() ?? ''], file = path.split('/').pop()
  if (!type) { art.noted.add(`the picture ${file} is in a format browsers don't draw`); return null }
  if (!art.pictures.has(path)) art.pictures.set(path, read().then((data) => (data.length > PICTURE_MB * 1024 * 1024 ? (art.noted.add(`the picture ${file} is larger than ${PICTURE_MB} MB`), null) : `data:${type};base64,${base64(data)}`)))
  const href = await art.pictures.get(path)
  if (href) art.used.add(path)
  return href ?? null
}

/**
 * How PowerPoint recolours a picture, as an SVG filter among the part's defs: its greys between two colours (duotone), its
 * brightness and contrast. @param {string} blip @param {Art} art @param {Colour | null} [ph]
 */
function filterOf(blip, art, ph = null) {
  const duotone = child(blip, 'a:duotone'), lum = child(blip, 'a:lum')
  if (!duotone && !lum) return ''
  const id = `a${++art.ids.n}`, [dark, light] = children(duotone?.inner).map((one) => colourOf(one.xml, art, ph)?.rgb ?? [0, 0, 0])
  // Each colour from the grey a pixel is, as sRGB weighs it.
  const row = (/** @type {number} */ i) => ((d) => `${n(d * 0.2126)} ${n(d * 0.7152)} ${n(d * 0.0722)} 0 ${n(dark[i] / 255)}`)((light[i] - dark[i]) / 255)
  const [bright, contrast] = ['bright', 'contrast'].map((key) => Number(attr(lum?.tag ?? '', key) ?? 0) / 100000), slope = contrast < 0 ? 1 + contrast : 1 / Math.max(0.01, 1 - contrast)
  const funcs = ['R', 'G', 'B'].map((c) => `<feFunc${c} type="linear" slope="${n(slope)}" intercept="${n(bright + 0.5 * (1 - slope))}"/>`).join('')
  art.defs.push(`<filter id="${id}" color-interpolation-filters="sRGB">${lum ? `<feComponentTransfer>${funcs}</feComponentTransfer>` : ''}${duotone && light ? `<feColorMatrix type="matrix" values="${row(0)} ${row(1)} ${row(2)} 0 0 0 1 0"/>` : ''}</filter>`)
  return ` filter="url(#${id})"`
}

/**
 * How a fill or a line paints, as SVG's attributes: a colour, a gradient, a picture (the last two among the part's defs), or
 * none; undefined where the part gives none, so that its style's does. @param {string} xml what holds the fill @param {'fill' | 'stroke'} as @param {Art} art @param {Colour | null} [ph]
 * @returns {Promise<string | undefined>}
 */
async function paintOf(xml, as, art, ph = null) {
  for (const one of children(xml)) {
    if (one.name === 'a:noFill') return `${as}="none"`
    if (one.name === 'a:solidFill' || one.name === 'a:pattFill') {
      const colour = colourOf(one.name === 'a:pattFill' ? child(one.inner, 'a:fgClr')?.inner ?? '' : one.inner, art, ph)
      return colour ? `${as}="${hexOf(colour.rgb)}"${colour.alpha < 1 ? ` ${as}-opacity="${n(colour.alpha)}"` : ''}` : `${as}="none"`
    }
    if (one.name === 'a:gradFill') {
      const stops = children(child(one.inner, 'a:gsLst')?.inner).map((gs) => /** @type {const} */ ([Number(attr(gs.tag, 'pos') ?? 0) / 100000, colourOf(gs.inner, art, ph)])).sort((a, b) => a[0] - b[0])
      const id = `a${++art.ids.n}`, path = child(one.inner, 'a:path'), stop = stops.map(([at, colour]) => (colour ? `<stop offset="${n(at)}" stop-color="${hexOf(colour.rgb)}"${colour.alpha < 1 ? ` stop-opacity="${n(colour.alpha)}"` : ''}/>` : '')).join('')
      if (!stop) return `${as}="none"`
      if (path) {
        // From the middle of its rectangle out to the shape's corners.
        const rect = child(path.inner, 'a:fillToRect')?.tag ?? '', [l, t, r, b] = ['l', 't', 'r', 'b'].map((key) => Number(attr(rect, key) ?? 0) / 100000), x = (l + 1 - r) / 2, y = (t + 1 - b) / 2
        art.defs.push(`<radialGradient id="${id}" cx="${n(x)}" cy="${n(y)}" r="${n(Math.hypot(Math.max(x, 1 - x), Math.max(y, 1 - y)))}">${stop}</radialGradient>`)
      } else {
        const angle = (Number(attr(child(one.inner, 'a:lin')?.tag ?? '', 'ang') ?? 0) / 60000) * (Math.PI / 180), dx = Math.cos(angle) / 2, dy = Math.sin(angle) / 2
        art.defs.push(`<linearGradient id="${id}" x1="${n(0.5 - dx)}" y1="${n(0.5 - dy)}" x2="${n(0.5 + dx)}" y2="${n(0.5 + dy)}">${stop}</linearGradient>`)
      }
      return `${as}="url(#${id})"`
    }
    if (one.name === 'a:blipFill') {
      const blip = child(one.inner, 'a:blip'), href = await hrefOf(attr(blip?.tag ?? '', 'r:embed'), art), id = `a${++art.ids.n}`
      if (!href || as !== 'fill') return `${as}="none"`
      const amount = attr(child(blip?.inner, 'a:alphaModFix')?.tag ?? '', 'amt')
      art.defs.push(`<pattern id="${id}" width="1" height="1" patternContentUnits="objectBoundingBox"><image width="1" height="1" preserveAspectRatio="none"${filterOf(blip?.inner ?? '', art, ph)}${
        amount ? ` opacity="${n(Number(amount) / 100000)}"` : ''} xlink:href="${href}"/></pattern>`)
      return `fill="url(#${id})"`
    }
    if (one.name === 'a:grpFill') return art.group ?? `${as}="none"`
  }
  return undefined
}

/** A closed outline through points. @param {...number[]} points */
const poly = (...points) => `M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`
/** A rectangle w by h with its corners rounded, from the top start: top-left, top-right, bottom-right, bottom-left. @param {number} w @param {number} h @param {number[]} r */
const rounded = (w, h, [a, b, c, d]) => `M${n(a)} 0H${n(w - b)}${b ? `A${n(b)} ${n(b)} 0 0 1 ${n(w)} ${n(b)}` : ''}V${n(h - c)}${c ? `A${n(c)} ${n(c)} 0 0 1 ${n(w - c)} ${n(h)}` : ''}H${n(d)}${
  d ? `A${n(d)} ${n(d)} 0 0 1 0 ${n(h - d)}` : ''}V${n(a)}${a ? `A${n(a)} ${n(a)} 0 0 1 ${n(a)} 0` : ''}Z`
/**
 * PowerPoint's own shapes that templates draw with, as outlines in a box w by h; `a(name, fallback)` an adjustment as a share,
 * `m` the box's shorter side. @type {Record<string, (w: number, h: number, a: (name: string, fallback: number) => number, m: number) => string>}
 */
const SHAPES = {
  rect: (w, h) => poly([0, 0], [w, 0], [w, h], [0, h]),
  roundRect: (w, h, a, m) => rounded(w, h, Array(4).fill(m * a('adj', 16667))),
  round1Rect: (w, h, a, m) => rounded(w, h, [0, m * a('adj', 16667), 0, 0]),
  round2SameRect: (w, h, a, m) => rounded(w, h, [m * a('adj1', 16667), m * a('adj1', 16667), m * a('adj2', 0), m * a('adj2', 0)]),
  round2DiagRect: (w, h, a, m) => rounded(w, h, [m * a('adj1', 16667), m * a('adj2', 0), m * a('adj1', 16667), m * a('adj2', 0)]),
  snip1Rect: (w, h, a, m) => ((s) => poly([0, 0], [w - s, 0], [w, s], [w, h], [0, h]))(m * a('adj', 16667)),
  snip2SameRect: (w, h, a, m) => ((s) => poly([s, 0], [w - s, 0], [w, s], [w, h], [0, h], [0, s]))(m * a('adj1', 16667)),
  ellipse: (w, h) => `M0 ${n(h / 2)}A${n(w / 2)} ${n(h / 2)} 0 1 1 ${n(w)} ${n(h / 2)}A${n(w / 2)} ${n(h / 2)} 0 1 1 0 ${n(h / 2)}Z`,
  triangle: (w, h, a) => poly([w * a('adj', 50000), 0], [w, h], [0, h]),
  rtTriangle: (w, h) => poly([0, 0], [w, h], [0, h]),
  diamond: (w, h) => poly([w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]),
  parallelogram: (w, h, a, m) => ((x) => poly([x, 0], [w, 0], [w - x, h], [0, h]))(m * a('adj', 25000)),
  trapezoid: (w, h, a, m) => ((x) => poly([x, 0], [w - x, 0], [w, h], [0, h]))(m * a('adj', 25000)),
  homePlate: (w, h, a, m) => ((x) => poly([0, 0], [x, 0], [w, h / 2], [x, h], [0, h]))(w - m * a('adj', 50000)),
  chevron: (w, h, a, m) => ((x) => poly([0, 0], [w - x, 0], [w, h / 2], [w - x, h], [0, h], [x, h / 2]))(m * a('adj', 50000)),
  pentagon: (w, h) => poly([w / 2, 0], [w, h * 0.382], [w * 0.809, h], [w * 0.191, h], [0, h * 0.382]),
  hexagon: (w, h, a, m) => ((x) => poly([x, 0], [w - x, 0], [w, h / 2], [w - x, h], [x, h], [0, h / 2]))(m * a('adj', 25000)),
  octagon: (w, h, a, m) => ((x) => poly([x, 0], [w - x, 0], [w, x], [w, h - x], [w - x, h], [x, h], [0, h - x], [0, x]))(m * a('adj', 29289)),
  star5: (w, h) => poly(...Array.from({ length: 10 }, (_, i) => ((r, t) => [w / 2 + (w / 2) * r * Math.cos(t), h / 2 + (h / 2) * r * Math.sin(t)])(i % 2 ? 0.382 : 1, -Math.PI / 2 + (i * Math.PI) / 5))),
  line: (w, h) => `M0 0L${n(w)} ${n(h)}`,
  bentConnector2: (w, h) => `M0 0H${n(w)}V${n(h)}`,
  bentConnector3: (w, h, a) => `M0 0H${n(w * a('adj1', 50000))}V${n(h)}H${n(w)}`,
  curvedConnector3: (w, h, a) => ((x) => `M0 0C${n(x)} 0 ${n(x)} ${n(h)} ${n(w)} ${n(h)}`)(w * a('adj1', 50000)),
}
Object.assign(SHAPES, { straightConnector1: SHAPES.line, flowChartProcess: SHAPES.rect, flowChartAlternateProcess: SHAPES.roundRect, flowChartDecision: SHAPES.diamond, flowChartConnector: SHAPES.ellipse })
/** The shapes that are lines alone. */
const LINES = new Set(['line', 'straightConnector1', 'bentConnector2', 'bentConnector3', 'curvedConnector3'])
/** A line's dashes, as a share of its width. */
const DASHES = /** @type {Record<string, number[]>} */ ({ dash: [4, 3], sysDash: [3, 1], dot: [1, 3], sysDot: [1, 1], lgDash: [8, 3], dashDot: [4, 3, 1, 3], lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3], sysDashDot: [3, 1, 1, 1], sysDashDotDot: [3, 1, 1, 1, 1, 1] })

/**
 * A shape's outline in its own box, w by h, as the paths it is drawn with, each filled or stroked or both: one of
 * PowerPoint's own, or its own geometry; null where it has none, undefined where it is one deck doesn't know.
 * @param {string} spPr @param {number} w @param {number} h @returns {{ d: string, fill: boolean, stroke: boolean }[] | null | undefined}
 */
function outlineOf(spPr, w, h) {
  const custom = child(spPr, 'a:custGeom')
  if (custom) {
    return children(child(custom.inner, 'a:pathLst')?.inner).filter((path) => path.name === 'a:path').flatMap((path) => {
      const pw = Number(attr(path.tag, 'w') ?? 0), ph = Number(attr(path.tag, 'h') ?? 0), sx = pw ? w / pw : 1 / EMU, sy = ph ? h / ph : 1 / EMU
      let d = '', at = [0, 0]
      for (const step of children(path.inner)) {
        const points = children(step.inner).filter((pt) => pt.name === 'a:pt').map((pt) => [Number(attr(pt.tag, 'x')) * sx, Number(attr(pt.tag, 'y')) * sy])
        const xy = points.map(([x, y]) => `${n(x)} ${n(y)}`).join(' ')
        if (step.name === 'a:moveTo') d += `M${xy}`
        else if (step.name === 'a:lnTo') d += `L${xy}`
        else if (step.name === 'a:cubicBezTo') d += `C${xy}`
        else if (step.name === 'a:quadBezTo') d += `Q${xy}`
        else if (step.name === 'a:close') d += 'Z'
        else if (step.name === 'a:arcTo') {
          // An arc on the ellipse its radii make, from where the path is, by the angles PowerPoint gives in 60,000ths of a degree.
          const [rx, ry] = [Number(attr(step.tag, 'wR') ?? 0) * sx, Number(attr(step.tag, 'hR') ?? 0) * sy], [start, sweep] = ['stAng', 'swAng'].map((key) => (Number(attr(step.tag, key) ?? 0) / 60000) * (Math.PI / 180))
          const end = [at[0] - rx * Math.cos(start) + rx * Math.cos(start + sweep), at[1] - ry * Math.sin(start) + ry * Math.sin(start + sweep)]
          d += `A${n(rx)} ${n(ry)} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep > 0 ? 1 : 0} ${n(end[0])} ${n(end[1])}`
          at = end
        }
        if (points.length) at = points[points.length - 1]
      }
      return d && !d.includes('NaN') ? [{ d, fill: attr(path.tag, 'fill') !== 'none', stroke: !/^(0|false)$/.test(attr(path.tag, 'stroke') ?? '') }] : []
    })
  }
  const preset = child(spPr, 'a:prstGeom')
  if (!preset) return null
  const kind = attr(preset.tag, 'prst') ?? '', given = Object.fromEntries(children(child(preset.inner, 'a:avLst')?.inner).map((gd) => [attr(gd.tag, 'name'), Number(/^val\s+(-?\d+)$/.exec(attr(gd.tag, 'fmla') ?? '')?.[1])]))
  const d = SHAPES[kind]?.(w, h, (name, fallback) => (Number.isFinite(given[name]) ? given[name] : fallback) / 100000, Math.min(w, h))
  return d ? [{ d, fill: !LINES.has(kind), stroke: true }] : undefined
}

/**
 * Where a part sits, in points: its box, how SVG moves its own box there (its place and its turn about its middle), and
 * its flips. @param {Part | undefined} xfrm
 */
function frameOf(xfrm) {
  const off = child(xfrm?.inner, 'a:off'), ext = child(xfrm?.inner, 'a:ext')
  if (!xfrm || !off || !ext) return null
  const [x, y, w, h] = [attr(off.tag, 'x'), attr(off.tag, 'y'), attr(ext.tag, 'cx'), attr(ext.tag, 'cy')].map((v) => Number(v ?? 0) / EMU)
  const turn = Number(attr(xfrm.tag, 'rot') ?? 0) / 60000, [fh, fv] = ['flipH', 'flipV'].map((key) => /^(1|true)$/.test(attr(xfrm.tag, key) ?? ''))
  return { x, y, w, h, move: `translate(${n(x)} ${n(y)})${turn ? ` rotate(${n(turn)} ${n(w / 2)} ${n(h / 2)})` : ''}`, flip: fh || fv ? ` matrix(${fh ? -1 : 1} 0 0 ${fv ? -1 : 1} ${fh ? n(w) : 0} ${fv ? n(h) : 0})` : '' }
}

/** A shape's fill: its own, else its style's, the theme's fill (or background fill) in the style's colour; else none. @param {string} spPr @param {string} style @param {Art} art */
async function fillOf(spPr, style, art) {
  const own = await paintOf(spPr, 'fill', art), ref = child(style, 'a:fillRef'), idx = Number(attr(ref?.tag ?? '', 'idx') ?? 0)
  const themed = idx > 1000 ? art.styles.bg[idx - 1001] : idx ? art.styles.fill[idx - 1] : undefined
  return own ?? (themed && ref && await paintOf(themed, 'fill', { ...art, rels: art.themeRels }, colourOf(ref.inner, art))) ?? 'fill="none"'
}

/** A shape's line: its own, else its style's, the theme's line in the style's colour; its width and dashes; else none. @param {string} spPr @param {string} style @param {Art} art */
async function strokeOf(spPr, style, art) {
  const ln = child(spPr, 'a:ln'), ref = child(style, 'a:lnRef'), idx = Number(attr(ref?.tag ?? '', 'idx') ?? 0), themed = idx ? children(art.styles.line[idx - 1] ?? '')[0] : undefined
  const paint = (ln && await paintOf(ln.inner, 'stroke', art)) ?? (themed && ref && await paintOf(themed.inner, 'stroke', art, colourOf(ref.inner, art)))
  if (!paint || paint === 'stroke="none"') return ''
  const width = Number(attr(ln?.tag ?? '', 'w') ?? attr(themed?.tag ?? '', 'w') ?? 9525) / EMU, dash = DASHES[attr(child(ln?.inner, 'a:prstDash')?.tag ?? child(themed?.inner, 'a:prstDash')?.tag ?? '', 'val') ?? '']
  return ` ${paint} stroke-width="${n(width)}"${dash ? ` stroke-dasharray="${dash.map((one) => n(one * width)).join(' ')}"` : ''}`
}

/**
 * A shape's words, as PowerPoint sets them in its box: each paragraph in its first run's size, weight, colour and face (the
 * theme's where it names one), aligned as it says, wrapped at the box's width as near as a face's average letter goes, the
 * whole at the top, middle or bottom; fields (a slide's number, its date) are left to deck.
 * @param {string} txBody @param {number} w @param {number} h @param {string} style @param {Art} art
 */
function wordsIn(txBody, w, h, style, art) {
  const bodyPr = child(txBody, 'a:bodyPr'), inset = (/** @type {string} */ key, /** @type {number} */ fallback) => Number(attr(bodyPr?.tag ?? '', key) ?? fallback) / EMU
  const [l, t, r, b] = [inset('lIns', 91440), inset('tIns', 45720), inset('rIns', 91440), inset('bIns', 45720)], wraps = attr(bodyPr?.tag ?? '', 'wrap') !== 'none'
  const scale = Number(attr(child(bodyPr?.inner, 'a:normAutofit')?.tag ?? '', 'fontScale') ?? 100000) / 100000, level = child(child(txBody, 'a:lstStyle')?.inner, 'a:lvl1pPr'), given = child(level?.inner, 'a:defRPr')
  const fontRef = child(style, 'a:fontRef'), ink = (fontRef && colourOf(fontRef.inner, art)) ?? { rgb: art.scheme[art.map.tx1 ?? 'dk1'] ?? [0, 0, 0], alpha: 1 }
  const lines = /** @type {{ words: string, size: number, align: string, colour: Colour, face: string, bold: boolean, italic: boolean }[]} */ ([])
  for (const p of children(txBody).filter((one) => one.name === 'a:p')) {
    const runs = children(p.inner).filter((one) => one.name === 'a:r' || one.name === 'a:br'), rPr = child(runs.find((one) => one.name === 'a:r')?.inner, 'a:rPr') ?? child(p.inner, 'a:endParaRPr')
    const own = (/** @type {string} */ key) => attr(rPr?.tag ?? '', key) ?? attr(given?.tag ?? '', key)
    const size = (Number(own('sz') ?? 1800) / 100) * scale, align = attr(child(p.inner, 'a:pPr')?.tag ?? '', 'algn') ?? attr(level?.tag ?? '', 'algn') ?? 'l'
    const colour = colourOf(child(rPr?.inner, 'a:solidFill')?.inner ?? '', art) ?? colourOf(child(given?.inner, 'a:solidFill')?.inner ?? '', art) ?? ink
    const typeface = attr(child(rPr?.inner, 'a:latin')?.tag ?? '', 'typeface') ?? '+mn-lt', face = typeface.startsWith('+mj') ? art.faces.major : typeface.startsWith('+') ? art.faces.minor : typeface
    const text = runs.map((one) => (one.name === 'a:br' ? '\n' : /<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/.exec(one.inner)?.[1] ?? '')).join('')
      .replace(/(&[^;\s]+;)|[^&]+/g, (some, entity) => entity ?? (own('cap') === 'all' ? some.toLocaleUpperCase() : some))
    const room = Math.max(1, Math.floor((w - l - r) / (size * (own('b') === '1' ? 0.6 : 0.55))))
    for (const line of text.split('\n')) {
      // Wrapped where its words would pass the box's width.
      const fits = (/** @type {string} */ words) => words.replace(/&[^;\s]+;/g, '_').length <= room
      const pieces = !wraps ? [line] : line.split(' ').reduce((/** @type {string[]} */ kept, word) => (kept.length && fits(`${kept[kept.length - 1]} ${word}`) ? [...kept.slice(0, -1), `${kept[kept.length - 1]} ${word}`] : [...kept, word]), [])
      for (const words of pieces.length ? pieces : ['']) lines.push({ words, size, align, colour, face, bold: own('b') === '1', italic: own('i') === '1' })
    }
  }
  const tall = lines.reduce((sum, line) => sum + line.size * 1.2, 0), anchor = attr(bodyPr?.tag ?? '', 'anchor') ?? 't'
  let top = anchor === 'ctr' ? t + (h - t - b - tall) / 2 : anchor === 'b' ? h - b - tall : t
  return lines.map((line) => {
    const y = top + line.size * 0.95, [x, at] = line.align === 'ctr' ? [l + (w - l - r) / 2, 'middle'] : line.align === 'r' ? [w - r, 'end'] : [l, 'start']
    top += line.size * 1.2
    return line.words.trim() ? `<text x="${n(x)}" y="${n(y)}" font-size="${n(line.size)}" font-family="${[line.face.replace(/["'&<>]/g, ''), 'ui-sans-serif', 'system-ui', 'sans-serif'].filter(Boolean).map((one) => (/\s/.test(one) ? `'${one}'` : one)).join(', ')}" fill="${
      hexOf(line.colour.rgb)}"${line.colour.alpha < 1 ? ` fill-opacity="${n(line.colour.alpha)}"` : ''}${at === 'start' ? '' : ` text-anchor="${at}"`}${line.bold ? ' font-weight="bold"' : ''}${line.italic ? ' font-style="italic"' : ''} xml:space="preserve">${line.words}</text>` : ''
  }).join('')
}

/** A shape (or a line between shapes): its outline filled and stroked, its words over it; a placeholder is the grid's. @param {string} xml @param {Art} art */
async function shapeOf(xml, art) {
  if (/<p:ph\b/.test((child(xml, 'p:nvSpPr') ?? child(xml, 'p:nvCxnSpPr'))?.inner ?? '')) return ''
  const spPr = child(xml, 'p:spPr')?.inner ?? '', style = child(xml, 'p:style')?.inner ?? '', at = frameOf(child(spPr, 'a:xfrm')), own = { ...art, defs: /** @type {string[]} */ ([]) }
  if (!at) return ''
  const paths = outlineOf(spPr, at.w, at.h)
  if (paths === undefined) own.noted.add(`the shape ${attr(child(spPr, 'a:prstGeom')?.tag ?? '', 'prst')} is left out`)
  const fill = paths?.some((one) => one.fill) ? await fillOf(spPr, style, own) : 'fill="none"', stroke = paths?.some((one) => one.stroke) ? await strokeOf(spPr, style, own) : ''
  const drawn = (paths ?? []).filter((one) => (one.fill && fill !== 'fill="none"') || (one.stroke && stroke)).map((one) => `<path d="${one.d}" ${one.fill ? fill : 'fill="none"'}${one.stroke ? stroke : ''}/>`).join('')
  const words = wordsIn(child(xml, 'p:txBody')?.inner ?? '', at.w, at.h, style, own)
  return `${own.defs.join('')}${drawn ? `<g transform="${at.move}${at.flip}">${drawn}</g>` : ''}${words ? `<g transform="${at.move}">${words}</g>` : ''}`
}

/** A picture where it sits, cropped as its template crops it, in its shape, see-through as it says, its line round it. @param {string} xml @param {Art} art */
async function pictureOf(xml, art) {
  if (/<p:ph\b/.test(child(xml, 'p:nvPicPr')?.inner ?? '')) return ''
  const fill = child(xml, 'p:blipFill')?.inner ?? '', blip = child(fill, 'a:blip'), spPr = child(xml, 'p:spPr')?.inner ?? '', at = frameOf(child(spPr, 'a:xfrm'))
  // An SVG beside a picture PowerPoint draws in its stead.
  const svg = /<asvg:svgBlip\b[^>]*\br:embed="([^"]+)"/.exec(blip?.inner ?? '')?.[1], href = (svg && await hrefOf(svg, art)) || await hrefOf(attr(blip?.tag ?? '', 'r:embed'), art)
  if (!at || !href) return ''
  const crop = child(fill, 'a:srcRect')?.tag ?? '', [l, t, r, b] = ['l', 't', 'r', 'b'].map((key) => Number(attr(crop, key) ?? 0) / 100000), w = at.w / (1 - l - r || 1), h = at.h / (1 - t - b || 1)
  const amount = attr(child(blip?.inner, 'a:alphaModFix')?.tag ?? '', 'amt'), outline = outlineOf(spPr, at.w, at.h)?.[0], id = outline && !/\bprst="rect"/.test(spPr) ? `a${++art.ids.n}` : ''
  const own = { ...art, defs: /** @type {string[]} */ ([]) }, stroke = outline ? await strokeOf(spPr, child(xml, 'p:style')?.inner ?? '', own) : '', filter = filterOf(blip?.inner ?? '', own)
  return `${own.defs.join('')}<g transform="${at.move}${at.flip}"${amount ? ` opacity="${n(Number(amount) / 100000)}"` : ''}>${id ? `<clipPath id="${id}"><path d="${outline?.d}"/></clipPath><g clip-path="url(#${id})">` : '<g>'}<svg width="${
    n(at.w)}" height="${n(at.h)}"><image x="${n(-l * w)}" y="${n(-t * h)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none"${filter} xlink:href="${href}"/></svg></g>${stroke ? `<path d="${outline?.d}" fill="none"${stroke}/>` : ''}</g>`
}

/** A group: its shapes, from its own place and size into where it sits, filled where they take its fill. @param {string} xml @param {Art} art */
async function groupOf(xml, art) {
  const pr = child(xml, 'p:grpSpPr')?.inner ?? '', xfrm = child(pr, 'a:xfrm'), at = frameOf(xfrm), own = { ...art, defs: /** @type {string[]} */ ([]) }
  const [cx, cy, cw, ch] = [attr(child(xfrm?.inner, 'a:chOff')?.tag ?? '', 'x'), attr(child(xfrm?.inner, 'a:chOff')?.tag ?? '', 'y'), attr(child(xfrm?.inner, 'a:chExt')?.tag ?? '', 'cx'), attr(child(xfrm?.inner, 'a:chExt')?.tag ?? '', 'cy')].map((v) => Number(v ?? 0) / EMU)
  const inner = await drawTree(xml, { ...own, group: await paintOf(pr, 'fill', own) })
  if (!inner) return ''
  return `${own.defs.join('')}<g${at ? ` transform="${at.move}${at.flip} scale(${n(cw ? at.w / cw : 1)} ${n(ch ? at.h / ch : 1)}) translate(${n(-cx)} ${n(-cy)})"` : ''}>${inner}</g>`
}

/** A tree of shapes, pictures and groups, drawn in its order; placeholders, tables and charts are left to the grid. @param {string} xml @param {Art} art @returns {Promise<string>} */
async function drawTree(xml, art) {
  let out = ''
  for (const one of children(xml)) {
    if (one.name === 'mc:AlternateContent') out += await drawTree((child(one.inner, 'mc:Fallback') ?? child(one.inner, 'mc:Choice'))?.inner ?? '', art)
    else if (one.name === 'p:sp' || one.name === 'p:cxnSp') out += await shapeOf(one.inner, art)
    else if (one.name === 'p:pic') out += await pictureOf(one.inner, art)
    else if (one.name === 'p:grpSp') out += await groupOf(one.inner, art)
  }
  return out
}

/**
 * A background: its colour where it is one (the first light where there is none), and the whole slide painted with it, its
 * own fill or its theme's (bgRef), a colour, a gradient or a picture. @param {string | undefined} bg @param {Art} art
 */
async function backOf(bg, art) {
  const pr = child(bg, 'p:bgPr'), ref = child(bg, 'p:bgRef'), idx = Number(attr(ref?.tag ?? '', 'idx') ?? 0), own = { ...art, defs: /** @type {string[]} */ ([]) }
  // A theme without its fills paints the reference's colour.
  const fill = pr?.inner ?? (idx > 1000 ? art.styles.bg[idx - 1001] : idx ? art.styles.fill[idx - 1] : undefined) ?? (ref ? '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' : ''), ph = ref ? colourOf(ref.inner, art) : null
  const solid = child(fill, 'a:solidFill'), rgb = solid ? colourOf(solid.inner, art, ph)?.rgb ?? null : bg ? null : art.scheme.lt1 ?? [255, 255, 255]
  const paint = (await paintOf(fill, 'fill', pr ? own : { ...own, rels: art.themeRels }, ph)) ?? (rgb ? `fill="${hexOf(rgb)}"` : undefined)
  return { rgb, svg: paint && paint !== 'fill="none"' ? `${own.defs.join('')}<rect width="${n(art.size[0])}" height="${n(art.size[1])}" ${paint}/>` : '' }
}

/**
 * Something a layout's title says of its words, a pattern's first group: on the layout, else on the master's title, else in
 * the master's title style. @param {string} xml @param {string} masterXml @param {RegExp} pattern
 */
function titleSays(xml, masterXml, pattern) {
  const title = (/** @type {string} */ part) => pattern.exec(/<p:txBody>[\s\S]*?<\/p:txBody>/.exec([...part.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].find(([sp]) => /<p:ph\b[^>]*type="(title|ctrTitle)"/.test(sp))?.[0] ?? '')?.[0] ?? '')?.[1]
  return title(xml) ?? title(masterXml) ?? pattern.exec(/<p:titleStyle>[\s\S]*?<\/p:titleStyle>/.exec(masterXml)?.[0] ?? '')?.[1]
}

/** The colour a layout's words are, as its title is; else the first dark. @param {string} xml @param {string} masterXml @param {Art} art */
function wordsOf(xml, masterXml, art) {
  const fill = titleSays(xml, masterXml, /<a:solidFill>([\s\S]*?)<\/a:solidFill>/)
  return (fill && colourOf(fill, art)?.rgb) ?? art.scheme[art.map.tx1 ?? 'dk1'] ?? null
}

/**
 * A layer of art as a picture: an SVG of the slide's size in points, stretched to the slide, written out as a data: address
 * (its pictures inside it already base64, so not again). @param {string} drawn @param {number[]} size
 */
const svgOf = (drawn, [w, h]) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${n(w)} ${n(h)}" preserveAspectRatio="none">${drawn}</svg>`)
  .replace(/%2F/g, '/').replace(/%2B/g, '+').replace(/%3D/g, '=')}`

/**
 * Placeholders as a grid of slots: the titles the default slot, with the box under them across the same columns; the other
 * boxes by the names deck gave them (`body-right`, as its PowerPoint writes them), else `left`, `middle` and `right` side by
 * side, else `s1`, `s2`…; the margins left to deck, or, for a layout with art, the whole slide, each box where the template
 * has it. @param {{ type: string, name: string, box: number[] | null }[]} boxes @param {number} cx @param {number} cy @param {boolean} [whole]
 */
function gridOf(boxes, cx, cy, whole = false) {
  const isTitle = (/** @type {{ type: string }} */ one) => ['title', 'ctrTitle', 'subTitle'].includes(one.type)
  const box = (/** @type {{ box: number[] | null }} */ one) => /** @type {number[]} */ (one.box)
  const across = (/** @type {number[]} */ a, /** @type {number[]} */ b) => Math.abs(a[0] - b[0]) < cx * 0.05 && Math.abs(a[2] - b[2]) < cx * 0.05 && a[1] > b[1]
  const heading = boxes.filter(isTitle), own = (/** @type {{ name: string }} */ one) => /^body-([a-z][a-z0-9-]{0,31})$/.exec(one.name)?.[1]
  const sorted = boxes.filter((one) => !isTitle(one)).sort((a, b) => box(a)[0] - box(b)[0] || box(a)[1] - box(b)[1])
  // The heading's slot's own words: the only box, or the one under the heading across its columns.
  const under = !heading.length ? undefined : sorted.length === 1 && !own(sorted[0]) && box(sorted[0])[1] >= box(heading[0])[1] ? sorted[0] : sorted.find((one) => own(one) === 'default' || (!own(one) && across(box(one), box(heading[0]))))
  const titles = under ? [...heading, under] : heading, others = sorted.filter((one) => one !== under)
  const union = (/** @type {number[][]} */ list) => (list.length ? ((xs, ys, xe, ye) => [xs, ys, xe - xs, ye - ys])(Math.min(...list.map((b) => b[0])), Math.min(...list.map((b) => b[1])),
    Math.max(...list.map((b) => b[0] + b[2])), Math.max(...list.map((b) => b[1] + b[3]))) : null)
  // The default slot: the heading and, when it is the only one, the box under it; else the heading, else the first box.
  const rest = titles.length ? others : others.slice(1)
  const first = titles.length ? /** @type {number[]} */ (union(titles.map(box))) : others.length ? box(others[0]) : [0, 0, cx, cy]
  const side = rest.every((one, i) => !i || box(one)[0] >= (box(rest[i - 1])[0] + box(rest[i - 1])[2]) * 0.98)
  const names = side && rest.length === 2 && titles.length ? ['left', 'right'] : side && rest.length === 3 && titles.length ? ['left', 'middle', 'right'] : side && rest.length === 1 ? ['right'] : side && rest.length === 2 ? ['middle', 'right']
    : rest.map((_, i) => `s${i + 1}`)
  /** @type {[string, number[]][]} */
  const slots = [['default', first], ...rest.map((one, i) => /** @type {[string, number[]]} */ ([own(one) ?? names[i], box(one)]))]
  // The grid's lines, near ones as one, then each cell the slot whose box holds its middle.
  const lines = (/** @type {number} */ from, /** @type {number} */ size, /** @type {number} */ total) => [...new Set([...(whole ? [0, total] : []), ...slots.flatMap(([, b]) => [b[from], b[from] + b[size]])])].sort((a, b) => a - b)
    .reduce((/** @type {number[]} */ kept, at) => (kept.length && at - kept[kept.length - 1] < total * 0.03 ? kept : [...kept, at]), [])
  const xs = lines(0, 2, cx), ys = lines(1, 3, cy)
  // Near enough to a box, but never a margin of the whole slide's.
  const near = whole ? 0.01 : 0.03, holds = (/** @type {number[]} */ b, /** @type {number} */ x, /** @type {number} */ y) => x >= b[0] - cx * near && x <= b[0] + b[2] + cx * near && y >= b[1] - cy * near && y <= b[1] + b[3] + cy * near
  const areas = ys.slice(1).map((y, r) => xs.slice(1).map((x, c) => slots.find(([, b]) => holds(b, (xs[c] + x) / 2, (ys[r] + y) / 2))?.[0] ?? '.'))
  if (!areas.length || !areas[0].length || !areas.flat().includes('default')) return null
  const fr = (/** @type {number[]} */ edges, /** @type {number} */ total) => (edges.length === 2 ? ['1fr'] : edges.slice(1).map((at, i) => `${Math.max(0.1, Math.round(((at - edges[i]) / total) * 100) / 10)}fr`))
  // A row that holds only the heading takes what it needs, but where art is drawn for it.
  const rows = fr(ys, cy).map((track, r) => (!whole && slots.length > 1 && areas[r].every((cell) => cell === 'default' || cell === '.') ? 'auto' : track))
  return { slots: slots.map(([one]) => one), areas: areas.map((row) => row.join(' ')).join(' | '), columns: fr(xs, cx).join(' '), rows: rows.join(' ') }
}

/** Bytes as base64, a piece at a time. @param {Uint8Array} bytes */
function base64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/**
 * A kit's tokens in the W3C's Design Tokens format (DTCG 2025.10), as design tools read them: its colours light and
 * dark, its chart colours and its faces; `tokensFrom()` reads them back. @param {Record<string, any>} tokens
 */
export function tokensToDtcg(tokens) {
  const colour = (/** @type {unknown} */ value) => (typeof value === 'string' ? { $type: 'color', $value: value } : undefined)
  const group = (/** @type {Record<string, any>} */ own) => Object.fromEntries(Object.entries({ bg: own.paper, fg: own.ink, accent: own.primary, muted: own.muted, surface: own.soft }).flatMap(([key, value]) => (colour(value) ? [[key, colour(value)]] : [])))
  const fonts = tokens.fonts ?? {}
  return {
    color: { light: group(tokens), ...(tokens.dark && { dark: group(tokens.dark) }), ...(tokens.series && { series: Object.fromEntries(tokens.series.map((/** @type {string} */ one, /** @type {number} */ i) => [`s${i + 1}`, colour(one)])) }) },
    ...((fonts.heading || fonts.body) && { font: { ...(fonts.heading && { heading: { $type: 'fontFamily', $value: fonts.heading } }), ...(fonts.body && { body: { $type: 'fontFamily', $value: fonts.body } }) } }),
  }
}
