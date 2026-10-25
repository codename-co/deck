// A mind map, from lists as a slide holds them: each item a node, its indentation its branching,
// every list on the slide merged into one tree, as items of the same words at the same place are
// one node, under one root (the item the lists share, else the slide's heading). Laid out as maps
// are drawn by hand: the root in the middle, its branches shared out to either side, the first on
// the side a line ends, clockwise, each branch a tidy tree going outwards. Pure, but for
// `watchMap`, which measures a map's words on its slide and places them, again whenever their size
// or its box's changes, in em of the map's own type, so it holds at any size.

/** @typedef {{ text: string, start: number, end: number, children: Item[], blocks?: { lang: string, text: string }[], step?: boolean, element?: HTMLElement }} Item */
/** @typedef {{ w: number, h: number, children: Box[], x?: number, y?: number, side?: number, span?: number, inner?: number }} Box */
/** @typedef {{ branch: number, depth: number, x1: number, y1: number, x2: number, y2: number }} Line */

const ITEM = /^([ \t]*)(?:[-*+]|\d{1,9}[.)])(?:[ \t]+(?:\[[ xX]\][ \t]+)?|$)/

/**
 * A list's items as a tree, by their indentation, as written: each item's words where they are in the source, from
 * `start` (where the list's own text starts), a line that is no item going on with the item above it, a fenced block
 * under an item (a chart, a diagram) that item's to draw.
 * @param {string} raw @param {number} start @returns {Item[]}
 */
export function itemsOf(raw, start) {
  /** @type {Item[]} */
  const top = []
  /** @type {{ indent: number, item: Item }[]} */
  const open = []
  let at = start
  /** @type {{ fence: string, indent: number, lang: string, lines: string[] } | null} */
  let fenced = null
  for (const line of raw.split('\n')) {
    const from = at
    at += line.length + 1
    if (fenced) {
      if (line.trimStart().startsWith(fenced.fence) && !line.trim().slice(fenced.fence.length).trim()) {
        const item = /** @type {{ item: Item }} */ (open.at(-1)).item
        ;(item.blocks ??= []).push({ lang: fenced.lang, text: fenced.lines.join('\n') })
        fenced = null
      } else fenced.lines.push(line.slice(Math.min(fenced.indent, /^[ \t]*/.exec(line)?.[0].length ?? 0)))
      continue
    }
    const fence = /^([ \t]*)(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence && open.length) { fenced = { fence: fence[2], indent: fence[1].length, lang: fence[3].trim(), lines: [] }; continue }
    const marker = ITEM.exec(line)
    if (marker) {
      const indent = marker[1].replace(/\t/g, '    ').length
      const item = { text: line.slice(marker[0].length).trim(), start: from + marker[0].length, end: from + line.trimEnd().length, children: [] }
      while (open.length && /** @type {{ indent: number }} */ (open.at(-1)).indent >= indent) open.pop()
      ;(open.at(-1)?.item.children ?? top).push(item)
      open.push({ indent, item })
    } else if (line.trim() && open.length) {
      const item = /** @type {{ item: Item }} */ (open.at(-1)).item
      item.text = `${item.text} ${line.trim()}`.trim()
      item.end = from + line.trimEnd().length
    }
  }
  return top
}

/** An item's words as they are compared: no emphasis, no case, one space. @param {string} text */
export const keyOf = (text) => text.normalize('NFC').replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Items merged: of siblings with the same words, the first keeps the others' children, at every level; a step if any
 * was one. Items without words stay apart. @param {Item[]} items @returns {Item[]}
 */
export function mergeItems(items) {
  /** @type {Item[]} */
  const out = []
  /** @type {Map<string, Item>} */
  const seen = new Map()
  for (const item of items) {
    const key = keyOf(item.text), same = key ? seen.get(key) : undefined
    if (same) { same.children.push(...item.children); same.step = same.step || item.step; continue }
    const copy = { ...item, children: [...item.children] }
    if (key) seen.set(key, copy)
    out.push(copy)
  }
  for (const item of out) item.children = mergeItems(item.children)
  return out
}

/**
 * A map laid out, its boxes' sizes given (in em): the root's centre at the middle, its branches shared out to the end
 * side (top to bottom) and the start side (bottom to top) so the two are as tall as they can be alike, each child a gap
 * beyond its parent, siblings stacked and centred on it, spaced out further (up to four times) where the map would be
 * flatter than its box (`aspect`, its width over its height). Each box gets its `x` and `y` (its top start corner, from the
 * map's top start corner, mirrored if `rtl`) and its `side` (1 right of the root, -1 left); gives the map's size and its
 * lines, each from a parent's side to its child's.
 * @param {Box} root @param {{ rtl?: boolean, aspect?: number }} [how] @returns {{ width: number, height: number, lines: Line[] }}
 */
export function layoutMap(root, { rtl = false, aspect = 0 } = {}) {
  let laid = layoutAt(root, rtl, 1)
  if (aspect > 0 && laid.width / laid.height > aspect && layoutAt(root, rtl, 4).height < laid.width / aspect) laid = layoutAt(root, rtl, 4)
  else if (aspect > 0 && laid.width / laid.height > aspect) {
    let low = 1, high = 4
    for (let n = 0; n < 12; n++) { const mid = (low + high) / 2; if (layoutAt(root, rtl, mid).height < laid.width / aspect) low = mid; else high = mid }
    laid = layoutAt(root, rtl, low)
  }
  return laid
}

/** The map laid out with its siblings' spaces so many times the usual. @param {Box} root @param {boolean} rtl @param {number} spread */
function layoutAt(root, rtl, spread) {
  const gap = (/** @type {number} */ depth) => (depth <= 1 ? 2.4 : 1.5)
  const space = (/** @type {number} */ depth) => (depth <= 1 ? 0.8 * spread : 0.3 * Math.sqrt(spread))
  const measure = (/** @type {Box} */ box, /** @type {number} */ depth) => {
    box.inner = box.children.reduce((sum, child) => sum + measure(child, depth + 1), 0) + space(depth + 1) * Math.max(0, box.children.length - 1)
    box.span = Math.max(box.h, box.inner)
    return box.span
  }
  /** @type {Line[]} */
  const lines = []
  // A box at its near edge `x`, in a band from `top`, going out to `side` (1 the end, -1 the start).
  const place = (/** @type {Box} */ box, /** @type {number} */ x, /** @type {number} */ top, /** @type {number} */ side, /** @type {number} */ depth, /** @type {number} */ branch) => {
    const middle = top + /** @type {number} */ (box.span) / 2
    box.x = side > 0 ? x : x - box.w
    box.side = rtl ? -side : side
    box.y = middle - box.h / 2
    let y = middle - /** @type {number} */ (box.inner) / 2
    const far = x + side * box.w
    for (const child of box.children) {
      const near = far + side * gap(depth + 1)
      place(child, near, y, side, depth + 1, branch)
      lines.push({ branch, depth: depth + 1, x1: far, y1: middle, x2: near, y2: y + /** @type {number} */ (child.span) / 2 })
      y += /** @type {number} */ (child.span) + space(depth + 1)
    }
  }
  for (const child of root.children) measure(child, 1)
  root.span = root.h
  root.side = 0
  root.x = -root.w / 2
  root.y = -root.h / 2
  // The branches to the end side, then the rest to the start: the split that makes the two sides nearest in height.
  const tall = (/** @type {Box[]} */ some) => some.reduce((sum, b) => sum + /** @type {number} */ (b.span), 0) + space(1) * Math.max(0, some.length - 1)
  const count = root.children.length
  let split = count
  for (let k = Math.ceil(count / 2); k <= count; k++) if (Math.max(tall(root.children.slice(0, k)), tall(root.children.slice(k))) < Math.max(tall(root.children.slice(0, split)), tall(root.children.slice(split)))) split = k
  for (const [side, some] of /** @type {[number, Box[]][]} */ ([[1, root.children.slice(0, split)], [-1, root.children.slice(split).reverse()]])) {
    let y = -tall(some) / 2
    for (const child of some) {
      const near = side * (root.w / 2 + gap(1))
      place(child, near, y, side, 1, root.children.indexOf(child))
      lines.push({ branch: root.children.indexOf(child), depth: 1, x1: side * root.w / 2, y1: 0, x2: near, y2: y + /** @type {number} */ (child.span) / 2 })
      y += /** @type {number} */ (child.span) + space(1)
    }
  }
  // From the map's top start corner.
  /** @type {Box[]} */
  const all = []
  const walk = (/** @type {Box} */ box) => { all.push(box); box.children.forEach(walk) }
  walk(root)
  const left = Math.min(...all.map((b) => /** @type {number} */ (b.x))), right = Math.max(...all.map((b) => /** @type {number} */ (b.x) + b.w))
  const top = Math.min(...all.map((b) => /** @type {number} */ (b.y))), bottom = Math.max(...all.map((b) => /** @type {number} */ (b.y) + b.h))
  const width = right - left
  const x = (/** @type {number} */ v) => (rtl ? width - (v - left) : v - left)
  for (const box of all) { box.x = rtl ? width - (/** @type {number} */ (box.x) - left) - box.w : /** @type {number} */ (box.x) - left; box.y = /** @type {number} */ (box.y) - top }
  for (const line of lines) Object.assign(line, { x1: x(line.x1), x2: x(line.x2), y1: line.y1 - top, y2: line.y2 - top })
  return { width, height: bottom - top, lines }
}

/** A line as a curve leaving its parent and reaching its child level. @param {Line} line */
export const curveOf = ({ x1, y1, x2, y2 }) => `M${x1.toFixed(3)} ${y1.toFixed(3)}C${((x1 + x2) / 2).toFixed(3)} ${y1.toFixed(3)} ${((x1 + x2) / 2).toFixed(3)} ${y2.toFixed(3)} ${x2.toFixed(3)} ${y2.toFixed(3)}`

/**
 * A map drawn by render.js (`.deck-mindmap`, its plane, its lines' SVG with a group a branch, its tree as lists, each
 * item's words a `.deck-map-node`) placed once it is on a page, and again as its words or its box change size: its
 * words where the layout puts them, its lines, the whole shrunk to its box. @param {HTMLElement} map
 */
export function watchMap(map) {
  const plane = /** @type {HTMLElement} */ (map.querySelector('.deck-map-plane'))
  const svg = /** @type {SVGSVGElement} */ (plane.querySelector('.deck-map-lines'))
  const root = /** @type {HTMLElement} */ (plane.querySelector('.deck-map-tree > li'))
  const place = () => {
    if (!map.clientWidth || !map.clientHeight) return
    const em = parseFloat(getComputedStyle(plane).fontSize) || 16
    /** @type {[HTMLElement, Box][]} */
    const placed = []
    const boxOf = (/** @type {Element} */ li) => {
      const node = /** @type {HTMLElement} */ (li.firstElementChild)
      const list = li.lastElementChild?.tagName === 'UL' ? [...li.lastElementChild.children] : []
      /** @type {Box} */
      const box = { w: node.offsetWidth / em, h: node.offsetHeight / em, children: list.map(boxOf) }
      placed.push([node, box])
      return box
    }
    const { width, height, lines } = layoutMap(boxOf(root), { rtl: getComputedStyle(map).direction === 'rtl', aspect: map.clientWidth / map.clientHeight })
    // As shares of the plane: a node's own em is its own type's.
    for (const [node, box] of placed) {
      node.style.setProperty('left', `${(/** @type {number} */ (box.x) / width) * 100}%`)
      node.style.setProperty('top', `${(/** @type {number} */ (box.y) / height) * 100}%`)
      node.setAttribute('data-side', box.side === 1 ? 'right' : box.side === -1 ? 'left' : 'middle')
    }
    plane.style.setProperty('width', `${width}em`)
    plane.style.setProperty('height', `${height}em`)
    svg.setAttribute('viewBox', `0 0 ${width.toFixed(3)} ${height.toFixed(3)}`)
    const groups = [...svg.children]
    for (const group of groups) group.replaceChildren()
    for (const line of lines) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', curveOf(line))
      path.setAttribute('data-depth', String(line.depth))
      groups[line.branch]?.append(path)
    }
    plane.style.setProperty('scale', String(Math.min(1, map.clientWidth / (width * em), map.clientHeight / (height * em))))
  }
  const watcher = new ResizeObserver(place)
  watcher.observe(map)
  for (const node of plane.querySelectorAll('.deck-map-node')) watcher.observe(node)
}
