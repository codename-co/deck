// A deck as a PowerPoint file to change in PowerPoint, Keynote or Google Slides: each layout a
// slide layout of its own (a master, in PptxGenJS's words) with a placeholder for its title and
// each of its slots, so a slide added there looks like the deck's; words as PowerPoint's own text,
// a list's levels as its levels; a table as a table; a chart of bars, lines, areas, pies, rings,
// points or a radar as PowerPoint's own chart, its numbers in the file to change; anything else (a
// diagram, another chart, a picture) as a picture; the speaker's notes as notes; each slide's
// transition as PowerPoint's (Morph where it has one, a fade where it hasn't); the look's colours
// as the file's theme. Read from the deck as drawn, each box where the browser put it, so the file
// looks like the slides, in the scheme shown. PptxGenJS (with its JSZip) is the host's to load.

import { labelOf } from './kit.js'

const W = 13.333, H = 7.5
// Words: a paragraph that is a picture alone on its line is the picture.
const TEXT = 'h1, h2, h3, h4, h5, h6, .deck-h, p:not(.deck-picture), ul, ol, blockquote'

/** @param {string} value rgb(…) or #… @returns {string} six hex digits */
function hexOf(value) {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(value)
  if (m) return [m[1], m[2], m[3]].map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('').toUpperCase()
  return value.replace('#', '').toUpperCase().slice(0, 6) || '000000'
}
/** @param {string} value */
const opaque = (value) => !/rgba\([^)]*,\s*0\)|transparent/.test(value)

/**
 * @param {import('./deck.js').DeckView} view
 * @param {{ PptxGenJS: any, JSZip: any }} libraries
 * @returns {Promise<{ blob: Blob, report: { slides: number, charts: number, pictures: number, tables: number, placeholders: number } }>}
 */
export async function toPptx(view, { PptxGenJS, JSZip }) {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = view.deck.slides[0]?.title ?? ''
  pres.rtlMode = view.dir === 'rtl'
  const rootStyle = getComputedStyle(view.root)
  const firstFont = (/** @type {string} */ stack) => stack.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).find((f) => !/^(ui-|system-ui|-apple|sans-serif|serif|monospace)/.test(f)) ?? 'Arial'
  pres.theme = { headFontFace: firstFont(rootStyle.getPropertyValue('--deck-heading')), bodyFontFace: firstFont(rootStyle.getPropertyValue('--deck-body')) }
  const report = { slides: 0, charts: 0, pictures: 0, tables: 0, placeholders: 0 }
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
        } else if (block.matches('.deck-echarts') && /** @type {any} */ (block).chart) {
          const chart = /** @type {any} */ (block).chart
          if (nativeChart(pres, slide, chart, at, { pt, rtl, lang: view.lang, ink: hexOf(style.color) })) report.charts++
          else { slide.addImage({ data: await pictureOf(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(chart.renderToSVGString())}`, at.w / sx * 2, at.h / sx * 2), ...at }); report.pictures++ }
        } else {
          const img = block.querySelector('img')
          if (img) {
            // A slide's pictures are read as they come near the screen: one not read yet is read now, so that it has its size.
            if (!img.complete) { img.loading = 'eager'; await img.decode().catch(() => {}) }
            const data = await pictureOf(img.src, img.clientWidth * 2, img.clientHeight * 2)
            if (data) { slide.addImage({ data, ...place(img), altText: img.alt }); report.pictures++ }
          }
        }
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
    const scheme = `<a:clrScheme name="Deck"><a:dk1><a:srgbClr val="${colour('ink')}"/></a:dk1><a:lt1><a:srgbClr val="${colour('paper')}"/></a:lt1><a:dk2><a:srgbClr val="${colour('ink')}"/></a:dk2><a:lt2><a:srgbClr val="${colour('soft')}"/></a:lt2>${series.map((c, n) => `<a:accent${n + 1}><a:srgbClr val="${c}"/></a:accent${n + 1}>`).join('')}<a:hlink><a:srgbClr val="${colour('primary')}"/></a:hlink><a:folHlink><a:srgbClr val="${colour('primary')}"/></a:folHlink></a:clrScheme>`
    zip.file('ppt/theme/theme1.xml', theme.replace(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/, scheme))
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
  return { blob, report }
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

/** A picture's data as PNG, drawn at a size; null when it can't be read (another site's, unshared). @param {string} src @param {number} w @param {number} h @param {boolean} [cover] */
async function pictureOf(src, w, h, cover = false) {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w))
    canvas.height = Math.max(1, Math.round(h))
    const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'))
    const iw = img.naturalWidth || w, ih = img.naturalHeight || h
    const scale = cover ? Math.max(canvas.width / iw, canvas.height / ih) : Math.min(canvas.width / iw, canvas.height / ih)
    ctx.drawImage(img, (canvas.width - iw * scale) / 2, (canvas.height - ih * scale) / 2, iw * scale, ih * scale)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
