// A kit from a company's PowerPoint template (.potx, .pptx, or an Office theme, .thmx), and a kit's tokens out in the W3C's Design Tokens format:
// a module of its own (@codename/deck/template), which a host loads only when it reads or writes one. From the template,
// its theme's colours (the first light its paper, the first dark its ink, the first accent its primary, the six accents a
// chart's colours) and faces (headings', words'); the first picture on its slide master, its logo, in the corner it sits
// in; and each slide layout, a layout of the kit by its name, its placeholders a grid of slots, on the paper its
// background is. The file is read with the platform's own DecompressionStream and its XML with regular expressions, as a
// page under Trusted Types parses no markup. What can't be read is left out, with a reason.

import { STANDARD, mergeKits, logoOf } from './kit.js'

/** The slide layouts PowerPoint names as deck's own are: a template's take their place. */
const OWN = /** @type {Record<string, string>} */ ({ 'Title Slide': 'cover', 'Title and Content': 'default', 'Section Header': 'section', 'Two Content': 'two-cols-header', 'Title Only': 'center', Blank: 'none' })
const PPTX = ['Title Slide', 'Title and Content', 'Section Header', 'Two Content', 'Comparison', 'Title Only', 'Blank', 'Content with Caption', 'Picture with Caption']
const PICTURES = /** @type {Record<string, string>} */ ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml' })

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

  // Its theme: colours by their role, faces for headings and words.
  const scheme = Object.fromEntries([...theme.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6])>\s*<a:(?:srgbClr\b[^>]*\bval|sysClr\b[^>]*\blastClr)="([0-9A-Fa-f]{6})"/g)].map(([, role, value]) => [role, `#${value.toLowerCase()}`]))
  const face = (/** @type {string} */ part) => attr(new RegExp(`<a:${part}>[\\s\\S]*?<a:latin\\b[^>]*>`).exec(theme)?.[0].replace(/^[\s\S]*<a:latin/, '') ?? '', 'typeface')
  const [heading, body] = [face('majorFont'), face('minorFont')].map((one) => (one && !one.startsWith('+') ? [one, 'ui-sans-serif', 'system-ui', 'sans-serif'] : null))
  /** @type {Record<string, any>} */
  const tokens = { ...(scheme.lt1 && { paper: scheme.lt1 }), ...(scheme.dk1 && { ink: scheme.dk1 }), ...(scheme.accent1 && { primary: scheme.accent1 }), ...(scheme.dk2 && { muted: scheme.dk2 }), ...(scheme.lt2 && { soft: scheme.lt2 }) }
  const accents = [1, 2, 3, 4, 5, 6].map((n) => scheme[`accent${n}`]).filter(Boolean)
  if (accents.length) tokens.series = accents
  if (heading || body) tokens.fonts = { heading: heading ?? body, body: body ?? heading }

  // Its logo: the first picture on its master that a browser draws, in the corner it sits in.
  for (const [pic] of masterXml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
    const path = masterRels.get(String(attr(/<a:blip\b[^>]*>/.exec(pic)?.[0] ?? '', 'r:embed'))), type = PICTURES[/\.(\w+)$/.exec(path ?? '')?.[1].toLowerCase() ?? '']
    if (!path || !type || !files.has(path)) continue
    const data = await files.get(path)?.(), url = data && `data:${type};base64,${base64(data)}`
    if (!logoOf(url)) { problems.push(`the logo ${path.split('/').pop()} is larger than 512 KB`); break }
    const [x, y] = ((off) => [Number(attr(off, 'x') ?? 0), Number(attr(off, 'y') ?? 0)])(/<a:off\b[^>]*>/.exec(pic)?.[0] ?? '')
    Object.assign(tokens, { logo: url, logoAt: `${y < cy / 2 ? 'top' : 'bottom'}-${x < cx / 2 ? 'start' : 'end'}` })
    break
  }

  // Its layouts: each placeholder where it sits, else where the master's of its kind sits.
  const placed = (/** @type {string} */ xml) => [...xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)].flatMap(([sp]) => {
    const ph = /<p:ph\b[^>]*>/.exec(sp)?.[0]
    if (!ph) return []
    const off = /<a:off\b[^>]*>/.exec(sp)?.[0], ext = /<a:ext\b[^>]*>/.exec(sp)?.[0]
    return [{ type: attr(ph, 'type') ?? 'body', name: attr(/<p:cNvPr\b[^>]*>/.exec(sp)?.[0] ?? '', 'name') ?? '', box: off && ext ? [Number(attr(off, 'x')), Number(attr(off, 'y')), Number(attr(ext, 'cx')), Number(attr(ext, 'cy'))] : null }]
  })
  const masterBoxes = placed(masterXml)
  const paperOf = (/** @type {string} */ xml) => {
    const fill = /<p:bg>[\s\S]*?<\/p:bg>/.exec(xml)?.[0] ?? '', role = attr(/<a:schemeClr\b[^>]*>/.exec(fill)?.[0] ?? '', 'val'), rgb = attr(/<a:srgbClr\b[^>]*>/.exec(fill)?.[0] ?? '', 'val')?.toLowerCase()
    return role === 'accent1' || (rgb && `#${rgb}` === scheme.accent1) ? 'fill' : role === 'tx1' || role === 'dk1' || (rgb && `#${rgb}` === scheme.dk1) ? 'ink' : role === 'bg2' || role === 'lt2' ? 'soft' : 'paper'
  }
  /** @type {Record<string, any>} */
  const layouts = {}
  const paths = [...masterRels.values()].filter((path) => /slideLayouts\/slideLayout\d+\.xml$/.test(path)).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1]) - Number(/(\d+)\.xml$/.exec(b)?.[1]))
  for (const path of paths) {
    const xml = await text(path), title = (attr(/<p:cSld\b[^>]*>/.exec(xml)?.[0] ?? '', 'name') ?? '').replace(/&amp;/g, '&').trim()
    const boxes = placed(xml).filter((one) => !['dt', 'ftr', 'sldNum'].includes(one.type)).map((one) => ({ ...one, box: one.box ?? masterBoxes.find((m) => m.type === one.type || (one.type === 'ctrTitle' && m.type === 'title'))?.box ?? null }))
      .filter((one) => one.box)
    const key = OWN[title] ?? (title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(?=\d)/, 'l-').slice(0, 32) || `layout-${paths.indexOf(path) + 1}`)
    const layout = gridOf(boxes, cx, cy)
    if (!layout) { problems.push(`layout ${title || key}: its placeholders make no grid deck lays out`); continue }
    layouts[key] = { label: title || key, ...layout, paper: paperOf(xml), title: boxes.some((one) => one.type === 'ctrTitle') ? 'huge' : 'normal', logo: STANDARD.layouts[key]?.logo ?? 'small',
      ...(boxes.some((one) => one.type === 'ctrTitle') && { justify: 'center' }), pptx: PPTX.includes(title) ? title : layout.slots.length > 1 ? 'Comparison' : 'Title and Content',
      numbered: /<p:ph\b[^>]*type="sldNum"/.test(xml) }
  }
  const merged = mergeKits({ name: name ?? 'template', tokens, layouts })
  return { kit: { ...merged.kit, name: name ?? 'template' }, problems: [...problems, ...merged.problems] }
}

/**
 * Placeholders as a grid of slots: the titles the default slot, with the box under them across the same columns; the other
 * boxes by the names deck gave them (`body-right`, as its PowerPoint writes them), else `left`, `middle` and `right` side by
 * side, else `s1`, `s2`…; the margins left to deck. @param {{ type: string, name: string, box: number[] | null }[]} boxes
 * @param {number} cx @param {number} cy
 */
function gridOf(boxes, cx, cy) {
  const isTitle = (/** @type {{ type: string }} */ one) => ['title', 'ctrTitle', 'subTitle'].includes(one.type)
  const box = (/** @type {{ box: number[] | null }} */ one) => /** @type {number[]} */ (one.box)
  const across = (/** @type {number[]} */ a, /** @type {number[]} */ b) => Math.abs(a[0] - b[0]) < cx * 0.05 && Math.abs(a[2] - b[2]) < cx * 0.05 && a[1] > b[1]
  const heading = boxes.filter(isTitle), own = (/** @type {{ name: string }} */ one) => /^body-([a-z][a-z0-9-]{0,31})$/.exec(one.name)?.[1]
  const sorted = boxes.filter((one) => !isTitle(one)).sort((a, b) => box(a)[0] - box(b)[0] || box(a)[1] - box(b)[1])
  // The heading's slot's own words: the only box, or the one under the heading across its columns.
  const under = !heading.length ? undefined : sorted.length === 1 && !own(sorted[0]) ? sorted[0] : sorted.find((one) => own(one) === 'default' || (!own(one) && across(box(one), box(heading[0]))))
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
  const lines = (/** @type {number} */ from, /** @type {number} */ size, /** @type {number} */ total) => [...new Set(slots.flatMap(([, b]) => [b[from], b[from] + b[size]]))].sort((a, b) => a - b)
    .reduce((/** @type {number[]} */ kept, at) => (kept.length && at - kept[kept.length - 1] < total * 0.03 ? kept : [...kept, at]), [])
  const xs = lines(0, 2, cx), ys = lines(1, 3, cy)
  const holds = (/** @type {number[]} */ b, /** @type {number} */ x, /** @type {number} */ y) => x >= b[0] - cx * 0.03 && x <= b[0] + b[2] + cx * 0.03 && y >= b[1] - cy * 0.03 && y <= b[1] + b[3] + cy * 0.03
  const areas = ys.slice(1).map((y, r) => xs.slice(1).map((x, c) => slots.find(([, b]) => holds(b, (xs[c] + x) / 2, (ys[r] + y) / 2))?.[0] ?? '.'))
  if (!areas.length || !areas[0].length) return null
  const fr = (/** @type {number[]} */ edges, /** @type {number} */ total) => (edges.length === 2 ? ['1fr'] : edges.slice(1).map((at, i) => `${Math.max(0.1, Math.round(((at - edges[i]) / total) * 100) / 10)}fr`))
  // A row that holds only the heading takes what it needs.
  const rows = fr(ys, cy).map((track, r) => (slots.length > 1 && areas[r].every((cell) => cell === 'default' || cell === '.') ? 'auto' : track))
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
