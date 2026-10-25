// A deck as a PowerPoint file to change in PowerPoint, Keynote or Google Slides: each layout a
// slide layout of its own (a master, in PptxGenJS's words) with a placeholder for its title and
// each of its slots, so a slide added there looks like the deck's; words as PowerPoint's own text,
// a list's levels as its levels; a table as a table; a chart of bars, lines, areas, pies, rings,
// points or a radar as PowerPoint's own chart, its numbers in the file to change; a mind map as
// PowerPoint's own shapes, its words in boxes joined by curves; a figure (cards, key figures, a
// timeline, chevrons, a programme, a pyramid, a bento, parts face to face or in a matrix, the
// deck's contents) as PowerPoint's own shapes and boxes of words, where the slide has them; anything else (a
// diagram, another chart, a picture) as a picture, a layout's art too, on its slide layout; the speaker's notes as notes; each slide's
// transition as PowerPoint's (Morph where it has one, a fade where it hasn't); the look's colours
// as the file's theme. Read from the deck as drawn, each box where the browser put it, so the file
// looks like the slides, in the scheme shown. PptxGenJS (with its JSZip) is the host's to load.

import { labelOf } from './kit.js'

const W = 13.333, H = 7.5
// Words: a paragraph that is a picture alone on its line is the picture.
const TEXT = 'h1, h2, h3, h4, h5, h6, .deck-h, p:not(.deck-picture), ul, ol, blockquote'

/** @param {string} value rgb(…), color(srgb …) or #… @returns {string} six hex digits */
function hexOf(value) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value)
  if (m) return [m[1], m[2], m[3]].map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase()
  const srgb = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value)
  if (srgb) return [srgb[1], srgb[2], srgb[3]].map((n) => Math.round(Number(n) * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
  return value.replace('#', '').toUpperCase().slice(0, 6) || '000000'
}
/** @param {string} value */
const opaque = (value) => !/rgba\([^)]*,\s*0\)|transparent/.test(value)
/** A colour's alpha, from rgba(…, a) or color(srgb … / a), else 1. @param {string} value */
const alphaOf = (value) => { const m = /rgba\((?:[^,]*,){3}\s*([\d.]+)\s*\)|\/\s*([\d.]+)\s*\)/.exec(value); return value === 'transparent' ? 0 : Number(m?.[1] ?? m?.[2] ?? 1) }

/**
 * @param {import('./deck.js').DeckView} view
 * @param {{ PptxGenJS: any, JSZip: any }} libraries
 * @returns {Promise<{ blob: Blob, report: { slides: number, charts: number, pictures: number, tables: number, placeholders: number, maps: number, figures: number } }>}
 */
export async function toPptx(view, { PptxGenJS, JSZip }) {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = view.deck.slides[0]?.title ?? ''
  pres.rtlMode = view.dir === 'rtl'
  const rootStyle = getComputedStyle(view.root)
  const firstFont = (/** @type {string} */ stack) => stack.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).find((f) => !/^(ui-|system-ui|-apple|sans-serif|serif|monospace)/.test(f)) ?? 'Arial'
  pres.theme = { headFontFace: firstFont(rootStyle.getPropertyValue('--deck-heading')), bodyFontFace: firstFont(rootStyle.getPropertyValue('--deck-body')) }
  const report = { slides: 0, charts: 0, pictures: 0, tables: 0, placeholders: 0, maps: 0, figures: 0 }
  const rtl = view.dir === 'rtl'
  const slides = view.slides()
  const masters = new Map()
  const transitions = []

  for (const [i, element] of slides.entries()) {
    const box = element.getBoundingClientRect()
    const sx = W / box.width
    const place = (/** @type {Element} */ el) => {
      const r = el.getBoundingClientRect()
      return { x: (r.left - box.left) * sx, y: (r.top - box.top) * sx, w: r.width * sx, h: r.height * sx }
    }
    // Words as wide as their slot, never as their line: PowerPoint sets type a little wider than a browser.
    const across = (/** @type {Element} */ el) => {
      const slot = el.closest('.deck-slot') ?? el
      const { x, w } = place(slot), { y, h } = place(el)
      const pad = getComputedStyle(slot)
      const start = parseFloat(pad.paddingInlineStart) * sx, end = parseFloat(pad.paddingInlineEnd) * sx
      return { x: x + (rtl ? end : start), y, w: w - start - end, h: h * 1.08 }
    }
    // A chart as PowerPoint's own, else as a picture; a diagram or a picture as a picture.
    const figure = async (/** @type {Element} */ block, /** @type {{ x: number, y: number, w: number, h: number }} */ at) => {
      if (block.matches('.deck-echarts') && /** @type {any} */ (block).chart) {
        const chart = /** @type {any} */ (block).chart
        if (nativeChart(pres, slide, chart, at, { pt, rtl, lang: view.lang, ink: hexOf(style.color) })) report.charts++
        else { slide.addImage({ data: await pictureOf(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(chart.renderToSVGString())}`, at.w / sx * 2, at.h / sx * 2), ...at }); report.pictures++ }
        return
      }
      const img = block.querySelector('img')
      if (!img) return
      // A slide's pictures are read as they come near the screen: one not read yet is read now, so that it has its size.
      if (!img.complete) { img.loading = 'eager'; await img.decode().catch(() => {}) }
      const data = await pictureOf(img.src, img.clientWidth * 2, img.clientHeight * 2)
      if (data) { slide.addImage({ data, ...place(img), altText: img.alt }); report.pictures++ }
    }
    // Where a layout centres its words, PowerPoint's box centres them too.
    const anchor = (/** @type {Element} */ slot) => (getComputedStyle(slot).justifyContent === 'center' ? 'middle' : 'top')
    const pt = (/** @type {number} */ px) => Math.round(px * sx * 72 * 10) / 10
    const style = getComputedStyle(element)
    const layout = element.dataset.layout ?? 'default'
    const slots = /** @type {HTMLElement[]} */ ([...element.querySelectorAll('.deck-slot')])
    const firstBlock = slots[0]?.firstElementChild
    const title = firstBlock && firstBlock.matches('h1, h2, h3, .deck-h') ? firstBlock : null

    // One master a layout, its placeholders where the first slide of it has its title and slots.
    // Named as the kit names the layout, in the deck's language, so PowerPoint's Layout menu reads it.
    const definition = view.kit.layouts[layout]
    const masterName = `${definition ? labelOf(definition, layout, view.lang) : layout}${element.classList.contains('deck-class-invert') ? ' (dark)' : ''}`
    if (!masters.has(masterName)) {
      const objects = []
      // The layout's art, its layers as one picture on its paper behind the rest: a slide added in PowerPoint has it too.
      const art = [...element.querySelectorAll('img.deck-art')].map((one) => /** @type {HTMLImageElement} */ (one).src), backdrop = art.length && await pictureOf(art, W * 150, H * 150, false, style.backgroundColor)
      if (backdrop) { objects.push({ image: { data: backdrop, x: 0, y: 0, w: W, h: H } }); report.pictures++ }
      if (title) objects.push({ placeholder: { options: { name: 'title', type: 'title', ...across(title), valign: 'bottom', margin: 0, fontFace: pres.theme.headFontFace, color: hexOf(getComputedStyle(title).color), align: rtl ? 'right' : 'left' }, text: '' } })
      for (const slot of slots) {
        const r = place(slot)
        const top = title && slot === slots[0] ? place(title).y + place(title).h : r.y
        const inner = slot.firstElementChild && slot.firstElementChild !== title ? across(slot.firstElementChild) : { x: r.x, w: r.w }
        objects.push({ placeholder: { options: { name: `body-${slot.dataset.slot}`, type: 'body', x: inner.x, y: top + 0.08, w: inner.w, h: Math.max(0.3, r.y + r.h - top - 0.08), margin: 0, valign: anchor(slot), color: hexOf(getComputedStyle(slot).color) }, text: '' } })
      }
      // The kit's logo as the slide shows it, the one that reads on its paper, on the master: a slide added in PowerPoint has it too.
      const logo = /** @type {HTMLImageElement | undefined} */ ([...element.querySelectorAll('.deck-logo')].find((one) => getComputedStyle(one).display !== 'none'))
      const mark = logo && await pictureOf(logo.src, logo.clientWidth * 3, logo.clientHeight * 3)
      if (logo && mark) { objects.push({ image: { data: mark, ...place(logo) } }); report.pictures++ }
      pres.defineSlideMaster({
        title: masterName, background: { color: hexOf(style.backgroundColor) }, objects,
        slideNumber: definition?.numbered !== false ? { x: rtl ? 0.3 : W - 0.9, y: H - 0.55, w: 0.6, h: 0.3, fontSize: 10, color: hexOf(rootStyle.getPropertyValue('--deck-muted').trim() || '#666666') } : undefined,
      })
      masters.set(masterName, new Set(objects.flatMap((o) => (o.placeholder ? [o.placeholder.options.name] : []))))
    }
    const names = masters.get(masterName)
    const slide = pres.addSlide({ masterName })
    report.slides++

    const background = element.querySelector('.deck-image')
    if (background) {
      const url = /url\("?(.*?)"?\)/.exec(getComputedStyle(background).backgroundImage)?.[1]
      const data = url && await pictureOf(url, background.clientWidth * 2, background.clientHeight * 2, true)
      if (data) { slide.addImage({ data, ...place(background) }); report.pictures++ }
      // The veil over it, as a quote has: the words read on it.
      const veil = getComputedStyle(background, '::after')
      if (veil.content !== 'none' && alphaOf(veil.backgroundColor) > 0) slide.addShape(pres.shapes.RECTANGLE, { ...place(background), fill: { color: hexOf(veil.backgroundColor), transparency: Math.round((1 - alphaOf(veil.backgroundColor)) * 100) }, line: { type: 'none' } })
    }
    if (title && names.has('title')) {
      slide.addText(runs(title, { pt, rtl, lang: view.lang }), { placeholder: 'title' })
      report.placeholders++
    }
    for (const slot of slots) {
      const blocks = [...slot.children].filter((child) => child !== title)
      const textOnly = blocks.length > 0 && blocks.every((child) => child.matches(TEXT))
      if (textOnly && names.has(`body-${slot.dataset.slot}`)) {
        slide.addText(blocks.flatMap((block) => runs(block, { pt, rtl, lang: view.lang })), { placeholder: `body-${slot.dataset.slot}`, valign: anchor(slot), ...(spaced(slot)) })
        report.placeholders++
        continue
      }
      for (const block of blocks) {
        const at = place(block)
        if (block.matches(TEXT)) slide.addText(runs(block, { pt, rtl, lang: view.lang }), { ...across(block), valign: 'top', margin: 0, ...(spaced(slot)) })
        else if (block.matches('pre')) {
          slide.addText(block.textContent?.replace(/\n$/, '') ?? '', { ...at, fontFace: 'Consolas', fontSize: pt(parseFloat(getComputedStyle(block).fontSize)), color: hexOf(getComputedStyle(block).color), fill: { color: hexOf(getComputedStyle(block).backgroundColor) }, valign: 'top', margin: 6, rtlMode: false, align: 'left' })
        } else if (block.matches('.deck-table')) {
          table(slide, block, at, { pt, rtl, lang: view.lang })
          report.tables++
        } else if (block.matches('.deck-mindmap')) {
          await mindmap(pres, slide, /** @type {HTMLElement} */ (block), place, { pt, rtl, lang: view.lang }, figure)
          report.maps++
        } else if (block.matches('.deck-figure')) {
          await drawing(pres, slide, block, place, { pt, rtl, lang: view.lang }, figure)
          report.figures++
        } else await figure(block, at)
      }
    }
    const notes = view.deck.slides[i]?.notes
    if (notes) slide.addNotes(notes)
    const settings = view.deck.slides[i]?.settings ?? {}
    transitions.push(String(settings.transition ?? view.deck.settings.transition ?? 'none').split('|')[0].trim())
  }

  // What PptxGenJS doesn't write: each slide's transition, and the look's colours as the theme.
  const zip = await JSZip.loadAsync(await pres.write({ outputType: 'arraybuffer', compression: true }))
  for (const [i, kind] of transitions.entries()) {
    const path = `ppt/slides/slide${i + 1}.xml`
    const xml = await zip.file(path)?.async('string')
    if (!xml || kind === 'none') continue
    zip.file(path, xml.replace(/<\/p:clrMapOvr>|(?=<p:timing|<\/p:sld>)/, (/** @type {string} */ found) => `${found}${transitionXml(kind, rtl)}`))
  }
  const theme = await zip.file('ppt/theme/theme1.xml')?.async('string')
  if (theme) {
    const colour = (/** @type {string} */ name) => hexOf(rootStyle.getPropertyValue(`--deck-${name}`).trim())
    const series = [colour('fill'), ...[2, 3, 4, 5, 6].map((n) => colour(`series-${n}`))]
    const scheme = /* xml */ `<a:clrScheme name="Deck"><a:dk1><a:srgbClr val="${colour('ink')}"/></a:dk1><a:lt1><a:srgbClr val="${colour('paper')}"/></a:lt1><a:dk2><a:srgbClr val="${colour('ink')}"/></a:dk2><a:lt2><a:srgbClr val="${colour('soft')}"/></a:lt2>${series.map((c, n) => `<a:accent${n + 1}><a:srgbClr val="${c}"/></a:accent${n + 1}>`).join('')}<a:hlink><a:srgbClr val="${colour('primary')}"/></a:hlink><a:folHlink><a:srgbClr val="${colour('primary')}"/></a:folHlink></a:clrScheme>`
    zip.file('ppt/theme/theme1.xml', theme.replace(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/, scheme))
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
  return { blob, report }
}

/**
 * A mind map as PowerPoint's own shapes, where the slide has them: each line a curve in its branch's colour, each of its
 * words a box, filled and outlined as on the slide (the root, the first branches), its words as runs, a chart or a
 * diagram in it as the slide's are.
 * @param {any} pres @param {any} slide @param {HTMLElement} map @param {(el: Element) => { x: number, y: number, w: number, h: number }} place
 * @param {{ pt: (px: number) => number, rtl: boolean, lang: string }} how
 * @param {(block: Element, at: { x: number, y: number, w: number, h: number }) => Promise<void>} figure
 */
async function mindmap(pres, slide, map, place, how, figure) {
  const plane = /** @type {HTMLElement} */ (map.querySelector('.deck-map-plane')), svg = /** @type {SVGSVGElement} */ (map.querySelector('.deck-map-lines'))
  // The plane is shrunk to its box: its type and lines are so much smaller on the slide.
  const scale = plane.getBoundingClientRect().width / (plane.offsetWidth || 1)
  const area = place(svg), units = Number(svg.getAttribute('viewBox')?.split(' ')[2]) || 1, inch = area.w / units
  for (const path of svg.querySelectorAll('path')) {
    const [x1, y1, , , , , x2, y2] = (path.getAttribute('d')?.match(/-?[\d.]+/g) ?? []).map((n, i) => (i % 2 ? area.y : area.x) + Number(n) * inch)
    const x = Math.min(x1, x2), y = Math.min(y1, y2), middle = (x1 + x2) / 2 - x
    const stroke = getComputedStyle(path)
    slide.addShape(pres.shapes.CUSTOM_GEOMETRY, {
      x, y, w: Math.max(0.01, Math.abs(x2 - x1)), h: Math.max(0.01, Math.abs(y2 - y1)), line: { color: hexOf(stroke.stroke), width: Math.round(parseFloat(stroke.strokeWidth) * inch * 72 * 10) / 10 },
      points: [{ x: x1 - x, y: y1 - y }, { x: x2 - x, y: y2 - y, curve: { type: 'cubic', x1: middle, y1: y1 - y, x2: middle, y2: y2 - y } }],
    })
  }
  const small = { ...how, pt: (/** @type {number} */ px) => how.pt(px * scale) }
  for (const node of /** @type {NodeListOf<HTMLElement>} */ (map.querySelectorAll('.deck-map-node'))) {
    const style = getComputedStyle(node), at = place(node)
    const align = style.textAlign === 'left' || style.textAlign === 'right' ? style.textAlign : style.textAlign === 'center' ? 'center' : how.rtl ? 'right' : 'left'
    // A node holding a chart: its words alone, over its box, the chart where it is.
    const label = node.matches('.has-block') ? node.querySelector('.deck-map-words') : node
    const words = label ? runs(label, small).map((run) => ({ ...run, options: { ...run.options, align } })) : []
    const border = parseFloat(style.borderTopWidth) || 0, pad = small.pt(parseFloat(style.paddingInlineStart) || 0) / 72
    const fill = alphaOf(style.backgroundColor) > 0 ? { color: hexOf(style.backgroundColor), transparency: Math.round((1 - alphaOf(style.backgroundColor)) * 100) } : undefined
    // PowerPoint sets type a little wider than a browser: words with no box grow away from their line.
    const wide = fill || border ? at.w * 0.04 : at.w * 0.08
    const x = align === 'left' ? at.x : align === 'right' ? at.x - wide : at.x - wide / 2
    slide.addText(label === node && words.length ? words : '', {
      x, y: at.y, w: at.w + wide, h: at.h, margin: [pad * 72, pad * 72, 0, 0], valign: 'middle', align, wrap: true,
      ...(fill || border ? { shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: Math.min(at.h / 2, small.pt(parseFloat(style.borderTopLeftRadius) || 0) / 72), fill } : {}),
      ...(border ? { line: { color: hexOf(style.borderTopColor), width: Math.round(small.pt(border) * 10) / 10 } } : {}),
    })
    if (label === node) continue
    if (label) slide.addText(words, { ...place(label), margin: 0, valign: 'middle', align: 'center', wrap: true })
    for (const block of node.querySelectorAll('.deck-block')) await figure(block, place(block))
  }
}

/**
 * A figure as PowerPoint's own shapes, as the slide draws them: each shape (a card, a chevron, a level, a dot, a rule) its
 * box, or its polygon, filled and outlined as on the slide, a side's rule a line; then each of its words a box of words
 * where they are, a table as a table, a chart or a diagram as the slide's are.
 * @param {any} pres @param {any} slide @param {Element} root @param {(el: Element) => { x: number, y: number, w: number, h: number }} place
 * @param {{ pt: (px: number) => number, rtl: boolean, lang: string }} how
 * @param {(block: Element, at: { x: number, y: number, w: number, h: number }) => Promise<void>} figure
 */
async function drawing(pres, slide, root, place, how, figure) {
  const inches = (/** @type {number} */ px) => how.pt(px) / 72
  // In the order the slide stacks them: a medallion over the parts it sits between.
  const layer = (/** @type {Element} */ el) => parseInt(getComputedStyle(el).zIndex, 10) || 0
  for (const shape of [...root.querySelectorAll('.deck-shape')].sort((a, b) => layer(a) - layer(b))) {
    const style = getComputedStyle(shape), at = place(shape), box = shape.getBoundingClientRect()
    const fill = alphaOf(style.backgroundColor) > 0 ? { color: hexOf(style.backgroundColor), transparency: Math.round((1 - alphaOf(style.backgroundColor)) * 100) } : undefined
    const sides = /** @type {const} */ (['Top', 'Right', 'Bottom', 'Left']).map((side) => ({ side, width: parseFloat(style[`border${side}Width`]) || 0, colour: style[`border${side}Color`] })).map((one) => ({ ...one, width: alphaOf(one.colour) > 0 ? one.width : 0 }))
    const even = sides.every((one) => Math.abs(one.width - sides[0].width) < 0.1)
    const line = even && sides[0].width > 0 ? { color: hexOf(sides[0].colour), width: Math.round(how.pt(sides[0].width) * 10) / 10 } : { type: 'none' }
    const polygon = /^polygon\((.*)\)$/.exec(style.clipPath)?.[1]
    if (polygon && (fill || even && sides[0].width)) {
      // Its points as the slide clips it: lengths and shares of its box, calc() as CSS writes it.
      const length = (/** @type {string} */ text, /** @type {number} */ size) => [...text.replace(/^calc\(|\)$/g, '').matchAll(/([+-]?)\s*([\d.]+)(%|px)?/g)].reduce((sum, [, sign, n, unit]) => sum + (sign === '-' ? -1 : 1) * (unit === '%' ? (Number(n) / 100) * size : inches(Number(n))), 0)
      const points = polygon.split(/,(?![^(]*\))/).map((pair) => pair.trim().match(/calc\([^)]*\)|[-\d.]+(?:%|px)?/g) ?? []).map(([x = '0', y = '0']) => ({ x: length(x, at.w), y: length(y, at.h) }))
      slide.addShape(pres.shapes.CUSTOM_GEOMETRY, { ...at, fill, line, points: [...points, { close: true }] })
    } else if (fill || line.width) {
      const radius = style.borderTopLeftRadius.endsWith('%') ? (Math.min(box.width, box.height) * parseFloat(style.borderTopLeftRadius)) / 100 : parseFloat(style.borderTopLeftRadius) || 0
      const round = radius >= Math.min(box.width, box.height) / 2 - 0.5
      const kind = round && Math.abs(box.width - box.height) < 1 ? pres.shapes.OVAL : radius > 0 ? pres.shapes.ROUNDED_RECTANGLE : pres.shapes.RECTANGLE
      slide.addShape(kind, { ...at, fill, line, ...(kind === pres.shapes.ROUNDED_RECTANGLE ? { rectRadius: Math.min(at.h / 2, at.w / 2, inches(radius)) } : {}) })
    }
    // A rule on one side alone, as a line.
    if (!even) for (const { side, width, colour } of sides) {
      if (!width) continue
      const thick = inches(width)
      const edge = { Top: { x: at.x, y: at.y + thick / 2, w: at.w, h: 0 }, Bottom: { x: at.x, y: at.y + at.h - thick / 2, w: at.w, h: 0 }, Left: { x: at.x + thick / 2, y: at.y, w: 0, h: at.h }, Right: { x: at.x + at.w - thick / 2, y: at.y, w: 0, h: at.h } }[side]
      slide.addShape(pres.shapes.LINE, { ...edge, line: { color: hexOf(colour), width: Math.round(how.pt(width) * 10) / 10 } })
    }
  }
  for (const words of root.querySelectorAll('.deck-words')) {
    if (words.parentElement?.closest('.deck-words') || !words.textContent?.trim()) continue
    const style = getComputedStyle(words), at = place(words)
    const align = style.textAlign === 'center' ? 'center' : style.textAlign === 'left' || style.textAlign === 'right' ? style.textAlign : (style.textAlign === 'end') !== how.rtl ? 'right' : 'left'
    // PowerPoint sets type a little wider than a browser: words grow away from where they are aligned.
    const wide = at.w * 0.08, x = align === 'left' ? at.x : align === 'right' ? at.x - wide : at.x - wide / 2
    // Words in a shape of their own (a number in its circle) in its middle; others from their top, as their lines may be fewer.
    slide.addText(runs(words, how).map((run) => ({ ...run, options: { ...run.options, align } })), { x, y: at.y, w: at.w + wide, h: at.h, margin: 0, valign: words.matches('.deck-shape') ? 'middle' : 'top', align, wrap: true })
  }
  for (const one of root.querySelectorAll('.deck-table')) table(slide, one, place(one), how)
  for (const block of root.querySelectorAll('.deck-block')) await figure(block, place(block))
}

/** A slot's paragraphs' spacing, from the space under its first block. @param {HTMLElement} slot */
function spaced(slot) {
  const first = slot.firstElementChild
  const after = first ? parseFloat(getComputedStyle(first).marginBlockEnd) : 0
  return { paraSpaceAfter: Math.round(after * 0.5) }
}

/**
 * A block's words as PowerPoint's runs: each paragraph or list item ends its line; bold, italics,
 * code and links kept; a list's level as its indent level.
 * @param {Element} block @param {{ pt: (px: number) => number, rtl: boolean, lang: string }} how @returns {any[]}
 */
function runs(block, how) {
  /** @type {any[]} */
  const out = []
  const paragraph = (/** @type {Element} */ el, /** @type {Record<string, any>} */ extra) => {
    const style = getComputedStyle(el)
    const base = { fontSize: how.pt(parseFloat(style.fontSize)), color: hexOf(style.color), bold: Number(style.fontWeight) >= 600, lang: how.lang, rtlMode: how.rtl, align: style.textAlign === 'center' ? 'center' : how.rtl ? 'right' : 'left', ...extra }
    const pieces = inlineRuns(el, base)
    if (!pieces.length) return
    pieces[pieces.length - 1].options.breakLine = true
    out.push(...pieces)
  }
  const list = (/** @type {Element} */ el, /** @type {number} */ level) => {
    let n = 0
    for (const li of el.children) {
      n++
      const nested = [...li.children].filter((c) => c.matches('ul, ol'))
      const clone = /** @type {Element} */ (li.cloneNode(true))
      for (const c of [...clone.children]) if (c.matches('ul, ol, input')) c.remove()
      li.after(clone)
      paragraph(clone, { bullet: el.tagName === 'OL' ? { type: 'number', startAt: n === 1 ? Number(el.getAttribute('start') ?? 1) : undefined } : true, indentLevel: level })
      clone.remove()
      for (const sub of nested) list(sub, level + 1)
    }
  }
  if (block.matches('ul, ol')) list(block, 0)
  else if (block.matches('blockquote')) for (const p of block.children) paragraph(p, { italic: getComputedStyle(p).fontStyle === 'italic' })
  else paragraph(block, {})
  return out
}

/** @param {Node} node @param {Record<string, any>} base @returns {any[]} */
function inlineRuns(node, base) {
  /** @type {any[]} */
  const out = []
  const walk = (/** @type {Node} */ n, /** @type {Record<string, any>} */ options) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = (n.textContent ?? '').replace(/\s+/g, ' ')
      if (text) out.push({ text, options: { ...options } })
      return
    }
    if (!(n instanceof HTMLElement)) return
    if (n.tagName === 'BR') { if (out.length) out[out.length - 1].options.breakLine = true; return }
    const own = { ...options }
    if (n.matches('strong, b')) { own.bold = true; own.color = hexOf(getComputedStyle(n).color) }
    if (n.matches('em, i')) own.italic = true
    if (n.matches('del, s')) own.strike = 'sngStrike'
    if (n.matches('code')) own.fontFace = 'Consolas'
    if (n.matches('a[href]')) own.hyperlink = { url: n.getAttribute('href') }
    for (const child of n.childNodes) walk(child, own)
  }
  for (const child of node.childNodes) walk(child, base)
  if (out.length) { out[0].text = out[0].text.trimStart(); out[out.length - 1].text = out[out.length - 1].text.trimEnd() }
  return out.filter((run) => run.text)
}

/** @param {any} slide @param {Element} block @param {{ x: number, y: number, w: number, h: number }} at @param {{ pt: (px: number) => number, rtl: boolean, lang: string }} how */
function table(slide, block, at, how) {
  const rows = [...block.querySelectorAll('tr')].map((tr) => [...tr.children].map((cell) => {
    const style = getComputedStyle(cell)
    const align = cell.getAttribute('data-align')
    return { text: cell.textContent?.trim() ?? '', options: {
      bold: cell.tagName === 'TH', fontSize: how.pt(parseFloat(style.fontSize)), color: hexOf(style.color), lang: how.lang, rtlMode: how.rtl,
      align: align === 'center' ? 'center' : (align === 'right') !== how.rtl ? 'right' : 'left',
      border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: cell.tagName === 'TH' ? 1.5 : 0.75, color: hexOf(style.borderBlockEndColor) }, { type: 'none' }],
    } }
  }))
  const widths = [...(block.querySelector('tr')?.children ?? [])].map((cell) => cell.getBoundingClientRect().width)
  const total = widths.reduce((a, b) => a + b, 0) || 1
  slide.addTable(how.rtl ? rows.map((r) => r.reverse()) : rows, { ...at, colW: (how.rtl ? widths.reverse() : widths).map((w) => (w / total) * at.w), margin: 0.06 })
}

/**
 * An ECharts chart as PowerPoint's own, when it is one PowerPoint draws: bars, lines, areas, a pie
 * or a ring, points, a radar; false when it isn't. @returns {boolean}
 */
function nativeChart(/** @type {any} */ pres, /** @type {any} */ slide, /** @type {any} */ chart, /** @type {{ x: number, y: number, w: number, h: number }} */ at, /** @type {{ pt: (px: number) => number, rtl: boolean, lang: string, ink: string }} */ how) {
  const option = chart.getOption()
  const series = /** @type {any[]} */ (option.series ?? [])
  if (!series.length) return false
  const types = new Set(series.map((s) => s.type))
  const colours = /** @type {string[]} */ (option.color ?? []).map(hexOf)
  const value = (/** @type {any} */ v) => (Array.isArray(v) ? Number(v.at(-1)) : typeof v === 'object' && v !== null ? Number(v.value) : Number(v))
  const common = { ...at, showLegend: series.length > 1 || types.has('pie'), legendPos: 'b', legendFontSize: 12, legendColor: how.ink, chartColors: colours, showTitle: Boolean(option.title?.[0]?.text), title: option.title?.[0]?.text, titleFontSize: 16, titleColor: how.ink, catAxisLabelColor: how.ink, valAxisLabelColor: how.ink, dataLabelColor: how.ink, lang: how.lang }
  if (types.size === 1 && (types.has('pie'))) {
    const pie = series[0]
    const ring = Array.isArray(pie.radius) && parseFloat(pie.radius[0]) > 0
    slide.addChart(ring ? pres.charts.DOUGHNUT : pres.charts.PIE, [{ name: pie.name ?? '', labels: pie.data.map((/** @type {any} */ d) => d.name), values: pie.data.map(value) }], { ...common, showPercent: true, showLegend: true, holeSize: ring ? 55 : undefined })
    return true
  }
  if ([...types].every((t) => t === 'bar' || t === 'line')) {
    const horizontal = option.yAxis?.[0]?.type === 'category'
    const labels = (horizontal ? option.yAxis : option.xAxis)?.[0]?.data ?? []
    const of = (/** @type {any} */ s) => [{ name: s.name ?? '', labels: labels.map(String), values: s.data.map(value) }]
    const kind = (/** @type {any} */ s) => (s.type === 'bar' ? pres.charts.BAR : s.areaStyle ? pres.charts.AREA : pres.charts.LINE)
    const axes = { catAxisLabelFontSize: 11, valAxisLabelFontSize: 11, valGridLine: { color: 'D9D9D9', size: 0.5 }, catAxisOrientation: how.rtl && !horizontal ? 'maxMin' : 'minMax', valAxisLabelFormatCode: '#,##0' }
    if (types.size === 1) {
      const data = series.flatMap(of)
      slide.addChart(kind(series[0]), data, { ...common, ...axes, barDir: horizontal ? 'bar' : 'col', barGrouping: series.some((s) => s.stack) ? 'stacked' : 'clustered', lineDataSymbol: 'circle', lineSize: 2 })
    } else slide.addChart(series.map((s) => ({ type: kind(s), data: of(s), options: { barDir: horizontal ? 'bar' : 'col', chartColors: [colours[series.indexOf(s) % colours.length]] } })), { ...common, ...axes })
    return true
  }
  if (types.size === 1 && types.has('scatter')) {
    const points = series[0].data.map((/** @type {any} */ d) => (Array.isArray(d) ? d : [d.value?.[0], d.value?.[1]]))
    slide.addChart(pres.charts.SCATTER, [{ name: 'X', values: points.map((/** @type {any[]} */ p) => p[0]) }, { name: series[0].name ?? 'Y', values: points.map((/** @type {any[]} */ p) => p[1]) }], { ...common, lineSize: 0, lineDataSymbolSize: 8 })
    return true
  }
  if (types.size === 1 && types.has('radar')) {
    const indicators = option.radar?.[0]?.indicator ?? []
    slide.addChart(pres.charts.RADAR, series[0].data.map((/** @type {any} */ d) => ({ name: d.name ?? '', labels: indicators.map((/** @type {any} */ i) => i.name), values: d.value })), { ...common, showLegend: true, radarStyle: 'standard' })
    return true
  }
  return false
}

/** PowerPoint's transition for Slidev's name: Morph (with a fade where it isn't known), a fade, a push. @param {string} kind @param {boolean} rtl */
function transitionXml(kind, rtl) {
  const push = (/** @type {string} */ dir) => `<p:transition spd="med"><p:push dir="${dir}"/></p:transition>`
  if (kind === 'view-transition' || kind === 'morph') return '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition spd="slow"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>'
  if (kind === 'slide-left') return push(rtl ? 'r' : 'l')
  if (kind === 'slide-right') return push(rtl ? 'l' : 'r')
  if (kind === 'slide-up') return push('u')
  if (kind === 'slide-down') return push('d')
  return '<p:transition spd="med"><p:fade/></p:transition>'
}

/**
 * A picture's data as PNG, drawn at a size, or a layout's art, its layers, as JPEG on its paper; null when it can't be read
 * (another site's, unshared). @param {string | string[]} src @param {number} w @param {number} h @param {boolean} [cover] @param {string} [paper]
 */
async function pictureOf(src, w, h, cover = false, paper = '') {
  try {
    const images = await Promise.all([src].flat().map(async (one) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = one
      await img.decode()
      return img
    }))
    const img = images[0]
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w))
    canvas.height = Math.max(1, Math.round(h))
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
    const iw = img.naturalWidth || w, ih = img.naturalHeight || h
    const scale = cover ? Math.max(canvas.width / iw, canvas.height / ih) : Math.min(canvas.width / iw, canvas.height / ih)
    if (!paper) ctx.drawImage(img, (canvas.width - iw * scale) / 2, (canvas.height - ih * scale) / 2, iw * scale, ih * scale)
    else {
      // Art, stretched over the slide as it is drawn there, on its paper, as a JPEG: photographs stay small.
      ctx.fillStyle = paper
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      for (const layer of images) ctx.drawImage(layer, 0, 0, canvas.width, canvas.height)
    }
    return canvas.toDataURL(paper ? 'image/jpeg' : 'image/png', 0.9)
  } catch {
    return null
  }
}
