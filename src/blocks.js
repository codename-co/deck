// The drawers a deck opened on its own uses for ```echarts and ```mermaid, each library loaded
// from `base` (a CDN by default) the first time a slide needs it, never before. A chart is data,
// read with JSON.parse; it takes the deck's colours and type, light or dark, and is drawn as SVG.
// A diagram is drawn by Pele from Mermaid's language as SVG, then shown as a picture, so nothing it
// makes runs or joins the page; its words are its picture's text for whoever can't see it. A host (Jean) gives
// its own drawers instead.

/** @typedef {{ base: string, root: HTMLElement, versions?: { echarts?: string, pele?: string } }} Where */

/** @type {Map<string, Promise<any>>} */
const loading = new Map()

/** A classic script, loaded once: from a file:// page, modules from elsewhere are not always let in. @param {string} src @param {string} global */
function script(src, global) {
  if (!loading.has(src)) loading.set(src, new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = src
    tag.onload = () => resolve(/** @type {any} */ (globalThis)[global])
    tag.onerror = reject
    document.head.append(tag)
  }))
  return /** @type {Promise<any>} */ (loading.get(src))
}

/**
 * A library's file: from a CDN's npm mirror, at its version (`https://…/npm/name@1.2.3/file`), or from a
 * node_modules folder, which holds one version (`…/node_modules/name/file`).
 * @param {string} base @param {string} name @param {string} version @param {string} file
 */
export const libraryAt = (base, name, version, file) => (/node_modules\/$/.test(base) ? `${base}${name}/${file}` : `${base}${name}@${version}/${file}`)

/** @param {Where} where */
export function defaultBlocks({ base, root, versions = {} }) {
  const { echarts: chartsAt = '6.1.0', pele: diagramsAt = '1.10.0' } = versions
  /** @type {Set<{ chart: any, option: any, box: HTMLElement }>} */
  const charts = new Set()
  /** @type {any} */
  let colours = null
  root.addEventListener('deck-scheme', (event) => {
    colours = /** @type {CustomEvent} */ (event).detail.colours
    for (const one of charts) one.chart.setOption(themed(one.option, one.box), true)
  })
  // Its type sized with the slide's, its category axis read from the right in a language written so.
  const themed = (/** @type {any} */ option, /** @type {HTMLElement} */ box) => {
    const size = parseFloat(getComputedStyle(box).fontSize) || 16
    const rtl = getComputedStyle(box).direction === 'rtl'
    const small = Math.round(size * 0.6)
    const axis = (/** @type {any} */ given, /** @type {boolean} */ across) => given === undefined ? undefined : [given].flat().map((one) => ({
      axisLabel: { color: colours?.muted, fontSize: small }, axisLine: { lineStyle: { color: colours?.line } }, splitLine: { lineStyle: { color: colours?.line } },
      nameTextStyle: { color: colours?.muted, fontSize: small }, ...(rtl && across && one.type === 'category' ? { inverse: true } : {}), ...(rtl && !across ? { position: 'right' } : {}), ...one,
    }))
    return {
      color: colours?.series, backgroundColor: 'transparent', animation: !matchMedia('(prefers-reduced-motion: reduce)').matches,
      textStyle: { fontFamily: getComputedStyle(root).getPropertyValue('--deck-body') || 'system-ui', color: colours?.ink, fontSize: small },
      ...option,
      title: option.title ? { ...option.title, textStyle: { color: colours?.ink, fontSize: Math.round(size * 0.8), ...option.title?.textStyle } } : undefined,
      legend: option.legend ? { itemWidth: small * 1.6, itemHeight: small, ...option.legend, textStyle: { color: colours?.ink, fontSize: small, ...option.legend?.textStyle } } : undefined,
      grid: { containLabel: true, left: small, right: small, top: option.title ? size * 1.8 : small, bottom: option.legend ? size * 1.6 : small, ...option.grid },
      xAxis: axis(option.xAxis, true), yAxis: axis(option.yAxis, false), toolbox: undefined,
      series: [option.series ?? []].flat().map((one) => (one.type === 'pie' ? { label: { color: colours?.ink, fontSize: small }, ...one } : one)),
    }
  }
  return {
    /** @param {HTMLElement} box @param {string} source */
    async echarts(box, source) {
      const option = JSON.parse(source)
      const echarts = await script(libraryAt(base, 'echarts', chartsAt, 'dist/echarts.min.js'), 'echarts')
      const place = document.createElement('div')
      place.className = 'deck-chart'
      place.setAttribute('role', 'img')
      place.setAttribute('aria-label', String(option.title?.text ?? ''))
      box.append(place)
      const chart = echarts.init(place, null, { renderer: 'svg', locale: document.documentElement.lang?.startsWith('ja') ? 'JA' : 'EN' })
      const one = { chart, option, box }
      charts.add(one)
      chart.setOption(themed(option, box))
      new ResizeObserver(() => { chart.resize(); chart.setOption(themed(option, box), true) }).observe(place)
      Object.assign(box, { chart })
    },
    /**
     * A diagram written in Mermaid's language, drawn by Pele (Obsidian's, MIT): every kind Mermaid
     * 12.1 has, no DOM needed, an SVG with no script or HTML in it. Shown as a picture, its colours
     * the deck's, set as Pele's variables inside it. @param {HTMLElement} box @param {string} source
     */
    async mermaid(box, source) {
      const pele = await script(libraryAt(base, 'pele', diagramsAt, 'dist/pele.global.js'), 'pele')
      const font = getComputedStyle(root).getPropertyValue('--deck-body') || 'system-ui, sans-serif'
      const { svg } = pele.render(source, { fontFamily: font, links: false, images: false, autoDirection: true, maxWidth: Math.max(320, box.clientWidth * 1.4) })
      const look = `--pele-bg:transparent;--pele-fg:${colours?.ink};--pele-muted:${colours?.muted};--pele-line:${colours?.muted};--pele-surface:${colours?.soft};--pele-surface-alt:${colours?.line};--pele-border:${colours?.primary};--pele-accent:${colours?.primary};--pele-font:${font.replace(/[<>"]/g, '')}`
      const picture = document.createElement('img')
      picture.alt = source
      picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/^(<svg\b[^>]*>)/, `$1<style>svg{${look}}</style>`))}`
      const place = document.createElement('div')
      place.className = 'deck-diagram'
      place.append(picture)
      box.append(place)
    },
  }
}
