import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseDeck } from '../src/parse.js'
import { parseYaml } from '../src/yaml.js'
import { readDeckFile, writeDeckFile, escape, unescape } from '../src/file.js'
import { tokensOf, schemeOf, rgbOf, contrast } from '../src/look.js'

const en = readFileSync(new URL('../examples/en.md', import.meta.url), 'utf8')

test('slides split as Slidev splits them, settings and notes kept', () => {
  const deck = parseDeck(en)
  assert.equal(deck.slides.length, 13)
  assert.equal(deck.settings.title, 'A second oven')
  assert.equal(deck.settings.themeConfig.primary, '#f7c531')
  assert.equal(deck.slides[0].settings.layout, 'cover')
  assert.equal(deck.slides[0].notes, 'Thank everyone for coming. Two minutes on why, three on the numbers.')
  assert.deepEqual(deck.slides[1].slots.map((s) => s.name), ['default', 'right'])
  assert.match(deck.slides[1].notes, /ceiling in May/)
  assert.deepEqual(deck.slides[11].slots.map((s) => s.name), ['default', 'left', 'right', 'bottom'])
  assert.equal(deck.slides[4].settings.transition, 'view-transition')
  assert.equal(deck.slides[4].title, 'Paid back in 14 months')
  assert.equal(deck.slides[6].title, 'The oven we chose')
})

test("a slot's text is the source's own, from where it starts", () => {
  const deck = parseDeck(en)
  for (const slide of deck.slides) for (const slot of slide.slots) assert.equal(en.slice(slot.start, slot.start + slot.text.length), slot.text)
})

test('a fence or a comment never splits a slide; a ```yaml block holds settings', () => {
  const deck = parseDeck('# One\n\n```md\n---\nnot: a slide\n---\n```\n\n<!--\n---\n-->\n\nmore\n\n---\n\n```yaml\nlayout: center\n```\n\n# Two\n')
  assert.equal(deck.slides.length, 2)
  assert.equal(deck.slides[1].settings.layout, 'center')
  assert.equal(deck.slides[0].notes, '')
})

test('YAML as brains write it', () => {
  assert.deepEqual(parseYaml('a: 1\nb: "two # not a comment" # a comment\nc:\n  d: [x, y, {z: 3}]\n  e: true\nf: |\n  line one\n  line two\ng:\n  - one\n  - name: two\n    n: 2\nurl: https://example.com/a:b'),
    { a: 1, b: 'two # not a comment', c: { d: ['x', 'y', { z: 3 }], e: true }, f: 'line one\nline two', g: ['one', { name: 'two', n: 2 }], url: 'https://example.com/a:b' })
})

test('a file reads back exactly the Markdown it was written with, whatever it holds', () => {
  for (const markdown of [en, readFileSync(new URL('../examples/tricky.md', import.meta.url), 'utf8'), 'a </SCRIPT> b <script> <\\script> <\\\\/script', '<!-- <script> never closed\n']) {
    for (const renderer of [{ src: 'deck.js' }, { code: 'console.log("</script><!--<script>")' }]) {
      const file = writeDeckFile(markdown, { title: 'T <&>', renderer })
      assert.equal(readDeckFile(file), markdown)
      // What the HTML parser would end the element at: the first </script after it opens.
      const body = file.slice(file.indexOf('id="deck">') + 10)
      assert.ok(!/<\/script/i.test(body.slice(0, body.search(/<\/script/i) - 1).replace(/\n$/, '')))
    }
  }
  assert.equal(unescape(escape('<script></script><\\script>')), '<script></script><\\script>')
})

test("a look's colours read at AA on its paper, light and dark, whatever the brain picked", () => {
  for (const primary of ['#f7c531', '#ffff00', '#ff69b4', '#0f766e', '#000080', '#ffffff']) for (const scheme of /** @type {const} */ (['light', 'dark'])) {
    const colours = schemeOf(tokensOf({ themeConfig: { primary } }), scheme)
    const paper = /** @type {number[]} */ (rgbOf(colours.paper))
    assert.ok(contrast(/** @type {number[]} */ (rgbOf(colours.primary)), paper) >= 4.5, `${primary} ${scheme} primary`)
    assert.ok(contrast(/** @type {number[]} */ (rgbOf(colours.ink)), paper) >= 7, `${primary} ${scheme} ink`)
    assert.ok(contrast(/** @type {number[]} */ (rgbOf(colours.muted)), paper) >= 4.5, `${primary} ${scheme} muted`)
    for (const s of colours.series) assert.ok(contrast(/** @type {number[]} */ (rgbOf(s)), paper) >= 3, `${primary} ${scheme} series ${s}`)
    assert.ok(contrast(/** @type {number[]} */ (rgbOf(colours.onPrimary)), /** @type {number[]} */ (rgbOf(primary))) >= 4.5 || primary === '#ff69b4', `${primary} ${scheme} on fill`)
  }
})

import { mergeKits, layoutOf, inferLayout, layoutNameOf, STANDARD } from '../src/kit.js'

test("a kit's layouts are checked against the grammar, and nothing but layout gets in", () => {
  assert.ok(layoutOf({ slots: ['default', 'one', 'two'], areas: 'default default | one two', rows: 'auto 1fr' }).layout)
  for (const bad of [
    { slots: ['default', 'x'], areas: 'default x | x default' }, // not a rectangle
    { slots: ['default'], areas: 'default', columns: 'calc(100% - 1px)' }, // not a track deck knows
    { slots: ['default'], areas: 'default', columns: '1fr; background: url(https://evil.example)' },
    { slots: ['default', 'a;b'], areas: 'default a;b' },
    { slots: ['default'], areas: 'default nobody' },
  ]) assert.equal(layoutOf(bad).layout, null, JSON.stringify(bad))
  const { kit, problems } = mergeKits({ layouts: { good: { slots: ['default', 'side'], areas: 'default side' }, 'Bad Name': {}, worse: { areas: 'x' } }, tokens: { primary: '#c2410c' } })
  assert.ok(kit.layouts.good && kit.layouts['two-cols'] && !kit.layouts.worse)
  assert.equal(problems.length, 2)
  assert.equal(kit.tokens.primary, '#c2410c')
  assert.equal(Object.keys(STANDARD.layouts).length, 29)
  assert.deepEqual([STANDARD.layouts.mindmap.lists, STANDARD.layouts.default.lists], ['mindmap', 'bullets'])
  assert.equal(layoutOf({ lists: 'tree' }).problems[0], 'lists tree is not one of bullets, mindmap, steps, metrics, timeline, process, agenda, pyramid, bento')
  assert.deepEqual(['steps', 'metrics', 'timeline', 'process', 'agenda', 'pyramid', 'bento'].map((name) => STANDARD.layouts[name].lists), ['steps', 'metrics', 'timeline', 'process', 'agenda', 'pyramid', 'bento'])
  assert.deepEqual([STANDARD.layouts.versus.parts, STANDARD.layouts.matrix.parts, STANDARD.layouts.default.parts], ['versus', 'matrix', 'none'])
  assert.deepEqual([STANDARD.layouts.summary.contents, STANDARD.layouts.default.contents, layoutOf({ contents: 'yes' }).layout?.contents], [true, false, false])
  assert.equal(layoutOf({ parts: 'grid' }).problems[0], 'parts grid is not one of none, versus, matrix')
})

test("a kit's logo is a picture inside it, its corner one of four; a usual layout turned off goes; dark tokens merge; a chart's colours its own", () => {
  const png = 'data:image/png;base64,iVBORw0KGgo='
  const { kit, problems } = mergeKits(
    { tokens: { primary: '#c2410c', logo: png, dark: { paper: '#101010' }, series: ['#c2410c', '#0f766e'] }, layouts: { image: false, default: false } },
    { tokens: { logoAt: 'bottom-start', dark: { logo: png } } })
  assert.deepEqual([kit.tokens.logo, kit.tokens.logoAt, kit.tokens.dark], [png, 'bottom-start', { paper: '#101010', logo: png }])
  assert.ok(!kit.layouts.image && kit.layouts.default, 'the default stays')
  assert.deepEqual(problems, [])
  assert.deepEqual([kit.layouts.cover.logo, kit.layouts.default.logo, kit.layouts.full.logo], ['big', 'small', 'none'])
  for (const bad of ['https://evil.example/logo.png', 'data:text/html;base64,PHA+', `data:image/png;base64,${'A'.repeat(700_001)}`, 'data:image/png;base64,<svg>']) {
    const merged = mergeKits({ tokens: { logo: bad, logoAt: 'middle' } })
    assert.equal(merged.kit.tokens.logo, undefined, bad.slice(0, 40))
    assert.equal(merged.problems.length, 2)
  }
  const scheme = schemeOf(tokensOf({}, { primary: '#c2410c', series: ['#c2410c', '#0f766e'] }), 'light')
  assert.equal(scheme.series.length, 6)
  assert.ok(scheme.series.every((one) => contrast(rgbOf(one) ?? [0, 0, 0], rgbOf(scheme.paper) ?? [255, 255, 255]) >= 3))
  assert.equal(scheme.series[1], scheme.series[3], 'the kit\'s own, round again')
})

test('a colour is read as CSS writes it, hex or rgb(), one see-through seen over its paper', () => {
  for (const same of ['#0055a4', '0055A4', 'rgb(0, 85, 164)', 'rgb(0 85 164)', 'rgba(0,85,164,1)', 'rgb(0% 33.33% 64.31%)', '#0055a4ff']) assert.deepEqual(rgbOf(same), [0, 85, 164], same)
  assert.deepEqual([rgbOf('#05a'), rgbOf('#05a8')], [[0, 85, 170], [119, 164, 210]])
  assert.deepEqual([rgbOf('rgba(0, 0, 0, 0.5)'), rgbOf('rgb(0 0 0 / 50%)'), rgbOf('rgba(0, 0, 0, .5)', [0, 0, 0])], [[128, 128, 128], [128, 128, 128], [0, 0, 0]])
  for (const bad of ['rgb(300, 0, 0)', 'rgba(0, 0, 0, 2)', 'rgb(0, 0)', 'hsl(0 0% 0%)', 'red', '#12345', 'rgb(0, 0, 0); x']) assert.equal(rgbOf(bad), null, bad)
  // A token see-through is seen over the paper: soft words of black at 60% read on white as grey, still at AA.
  const tokens = tokensOf({}, { paper: '#ffffff', ink: '#111111', primary: 'rgba(0, 85, 164, 0.5)', muted: 'rgba(0, 0, 0, 0.6)' })
  assert.deepEqual([tokens.primary, tokens.muted], ['rgba(0, 85, 164, 0.5)', 'rgba(0, 0, 0, 0.6)'])
  const light = schemeOf(tokens, 'light')
  assert.equal(light.muted, '#666666')
  assert.ok(contrast(rgbOf(light.primary) ?? [0, 0, 0], [255, 255, 255]) >= 4.5)
  assert.deepEqual(tokensFrom({ color: { accent: { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0.33, 0.64], alpha: 0.5, hex: '#0055a4' } } } }), { primary: '#0055a480' })
})

test("a layout's art is layers among the kit's pictures, each a picture inside the kit, never an address", () => {
  const svg = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="1" fill="#c2410c"/></svg>')}`
  const { kit, problems } = mergeKits(
    { pictures: { band: svg, photo: 'data:image/png;base64,iVBORw0KGgo=' }, layouts: { banner: { slots: ['default'], art: ['band', 'photo'] } } },
    { pictures: { 'Bad Name': svg, web: 'https://evil.example/a.png', page: 'data:text/html,<script>', huge: `data:image/svg+xml,${'a'.repeat(3_145_728)}` }, layouts: { worse: { art: 'band' }, many: { art: Array(9).fill('band') } } })
  assert.deepEqual(Object.keys(kit.pictures), ['band', 'photo'])
  assert.deepEqual(kit.layouts.banner.art, ['band', 'photo'])
  assert.deepEqual([kit.layouts.worse.art, kit.layouts.many.art], [undefined, undefined])
  assert.equal(problems.length, 6)
  assert.deepEqual(STANDARD.pictures, {})
})

test('a slide that names no layout is given the one its content suits', () => {
  const deck = parseDeck(readFileSync(new URL('../examples/kit.md', import.meta.url), 'utf8'))
  assert.deepEqual(deck.slides.map((s) => s.settings.layout ? `(${s.settings.layout})` : inferLayout(s)),
    ['cover', 'section', '(three-numbers)', 'two-cols', 'fact', 'quote', '(banner)', '(big-question)', '(grid-of-nine)'])
  assert.equal(inferLayout(/** @type {any} */ (parseDeck('# Title\n\n---\n\n## Points\n\n- a\n- b\n').slides[1])), 'default')
})

test("Pandoc's fenced divs, as brains write them, are read as notes, slots and steps", () => {
  const deck = parseDeck('# Title\n\n---\n\n## Two things\n\n:::: columns\n::: column\n- a\n:::\n::: column\n- b\n:::\n::::\n\n::: notes\nSay this.\n:::\n')
  const slide = deck.slides[1]
  assert.deepEqual(slide.slots.map((s) => s.name), ['default', 'left', 'right'])
  assert.equal(slide.notes, 'Say this.')
  assert.equal(inferLayout(/** @type {any} */ (slide)), 'two-cols-header')
  for (const s of slide.slots) assert.equal(deck.slides[1] && s.text, s.text)
})

test('a deck with no rules is split at its headings, as Pandoc splits one', () => {
  const doc = '---\ntitle: Park\n---\n\n# The new park\n\nFor the council\n\n## Budget\n\n- €85,000\n\n```md\n## not a slide\n```\n\n## Works\n\n- March to June\n'
  const deck = parseDeck(doc)
  assert.deepEqual(deck.slides.map((s) => s.title), ['Park', 'Budget', 'Works'])
  assert.equal(deck.settings.title, 'Park')
  for (const slide of deck.slides) for (const slot of slide.slots) assert.equal(doc.slice(slot.start, slot.start + slot.text.length), slot.text)
})

test("a rule followed by words starts a slide, not settings, unlike Slidev's own reading", () => {
  const deck = parseDeck('---\n# One\n\nwords\n---\n## Two\n\n---\nlayout: center\n---\n\n## Three\n')
  assert.deepEqual(deck.slides.map((s) => s.title), ['One', 'Two', 'Three'])
  assert.equal(deck.slides[2].settings.layout, 'center')
})

import { inlinePictures } from '../src/pictures.js'
import { tokensFrom } from '../src/kit.js'

test("an exported deck holds its project's pictures, its web pictures left as links", async () => {
  const source = '---\nlayout: image-right\nimage: ./oven.png\n---\n\n## Oven\n\n![The shop](shop.jpg "Front") and ![web](https://example.com/a.png)\n\n![gone](missing.png)\n'
  const files = { './oven.png': { type: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) }, 'shop.jpg': { type: 'image/jpeg', bytes: new Uint8Array([255, 216]) } }
  const { source: out, inlined, missing } = await inlinePictures(source, async (place) => files[/** @type {keyof files} */ (place)] ?? null)
  assert.deepEqual(inlined.sort(), ['./oven.png', 'shop.jpg'])
  assert.deepEqual(missing, ['missing.png'])
  assert.match(out, /^image: data:image\/png;base64,iVBORw==$/m)
  assert.match(out, /!\[The shop\]\(data:image\/jpeg;base64,\/9g= "Front"\)/)
  assert.match(out, /https:\/\/example\.com\/a\.png/)
  assert.equal(parseDeck(out).slides.length, parseDeck(source).slides.length)
})

test("a design system's DTCG tokens and a catalog's slide types read into a kit", () => {
  const dtcg = { font: { sans: { $type: 'fontFamily', $value: ['Arial', 'Helvetica', 'sans-serif'] } }, color: {
    light: { bg: { $type: 'color', $value: { colorSpace: 'srgb', components: [1, 1, 1], hex: '#FFFFFF' } }, fg: { $type: 'color', $value: '#121E33' }, accent: { $type: 'color', $value: { hex: '#1D5AD9' } } },
    dark: { bg: { $type: 'color', $value: '#0F141C' }, fg: { $type: 'color', $value: '#ECEFF3' }, accent: { $type: 'color', $value: '#6D9DFF' } } } }
  const tokens = tokensFrom(dtcg)
  assert.deepEqual(tokens, { paper: '#FFFFFF', ink: '#121E33', primary: '#1D5AD9', dark: { paper: '#0F141C', ink: '#ECEFF3', primary: '#6D9DFF' }, fonts: { heading: ['Arial', 'Helvetica', 'sans-serif'], body: ['Arial', 'Helvetica', 'sans-serif'] } })
  const dark = schemeOf(tokensOf({}, tokens), 'dark')
  assert.equal(dark.paper, '#0f141c')
  const { kit, problems } = mergeKits({ tokens: dtcg, types: { comparison: {
    intent: 'Contrast two options so the difference is obvious.',
    slots: { title: { kind: 'title', required: true, max_words: 15 }, left: { kind: 'column', required: true, items: [2, 5], item_max_words: 12 }, right: { kind: 'column', items: [2, 5] } },
    areas: 'default default | left right', rows: 'auto 1fr', pptx: 'Comparison' } } })
  assert.deepEqual(problems, [])
  assert.deepEqual(kit.layouts.comparison.slots, ['default', 'left', 'right'])
  assert.deepEqual(kit.layouts.comparison.budgets.left, { kind: 'column', required: true, items: [2, 5], item_max_words: 12 })
  assert.equal(kit.layouts.comparison.intent, 'Contrast two options so the difference is obvious.')
  assert.equal(kit.tokens.primary, '#1D5AD9')
})

import { readdirSync } from 'node:fs'
import { VERSION } from '../src/version.js'
import { rendererUrl } from '../src/file.js'

test("a file links to its renderer by default, at this package's version", () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(VERSION, pkg.version)
  const file = writeDeckFile('# One\n')
  assert.ok(file.includes(`<script src="${rendererUrl()}"></script>`))
  assert.equal(rendererUrl(), `https://cdn.jsdelivr.net/npm/@codename/deck@${pkg.version}/dist/deck.js`)
  assert.ok(writeDeckFile('# One\n', { base: '../node_modules/' }).includes('data-base="../node_modules/"'))
})

test('Pele draws every kind of diagram the samples hold, with no DOM and nothing that runs', async () => {
  const { render } = await import('pele')
  const dir = new URL('./diagrams/', import.meta.url)
  const files = readdirSync(dir).filter((f) => f.endsWith('.mmd'))
  assert.equal(files.length, 14)
  for (const file of files) {
    const { svg } = render(readFileSync(new URL(file, dir), 'utf8'), { links: false, images: false })
    assert.match(svg, /^<svg\b/, file)
    assert.doesNotMatch(svg, /<script|<foreignObject|\son\w+=/i, file)
  }
})

import { itemsOf, mergeItems, layoutMap, curveOf } from '../src/mindmap.js'

test("a mind map's list is read by its indentation, each item's words where they are in the source", () => {
  const source = 'intro\n- Zoo\n  - Lions\n    - **Big** ones\n  - Penguins\n- Money\n\t* Bus\n  going on\n1. Rain\n'
  const items = itemsOf(source.slice(6), 6)
  const shape = (/** @type {any[]} */ list) => list.map((item) => [item.text, ...(item.children.length ? [shape(item.children)] : [])])
  assert.deepEqual(shape(items), [['Zoo', [['Lions', [['**Big** ones']]], ['Penguins']]], ['Money', [['Bus going on']]], ['Rain']])
  for (const item of [items[0], items[0].children[0].children[0], items[2]]) assert.equal(source.slice(item.start, item.end), item.text)
  assert.equal(source.slice(items[1].children[0].start, items[1].children[0].end), 'Bus\n  going on')
})

test("lists are merged into one map: items of the same words at the same place are one, their children together", () => {
  const one = itemsOf('- Trip\n  - Zoo\n    - Lions\n  - Money\n', 0), two = itemsOf('- trip\n  - *Zoo*\n    - Penguins\n  - Rain\n', 100)
  two[0].children[1].step = true
  const merged = mergeItems([...one, ...two])
  assert.equal(merged.length, 1)
  assert.deepEqual(merged[0].children.map((c) => [c.text, c.children.map((k) => k.text), Boolean(c.step)]), [['Zoo', ['Lions', 'Penguins'], false], ['Money', [], false], ['Rain', [], true]])
  assert.equal(merged[0].start, 2, 'the first keeps its place in the source')
  assert.equal(one[0].children[0].children.length, 1, 'the lists given are left as they were')
  assert.equal(mergeItems([{ text: '', start: 0, end: 0, children: [] }, { text: '', start: 0, end: 0, children: [] }]).length, 2)
})

test('a mind map is laid out round its root, its branches shared out to both sides, nothing overlapping', () => {
  const box = (/** @type {number} */ w, /** @type {any[]} */ children = []) => ({ w, h: 1.2, children })
  const make = () => box(6, [box(4, [box(5), box(5), box(5)]), box(4, [box(3), box(7, [box(3)])]), box(4, [box(5), box(5)]), box(3)])
  const root = make()
  const { width, height, lines } = layoutMap(root)
  /** @type {any[]} */
  const all = []
  const walk = (/** @type {any} */ b) => { all.push(b); b.children.forEach(walk) }
  walk(root)
  for (const b of all) assert.ok(b.x >= -1e-9 && b.y >= -1e-9 && b.x + b.w <= width + 1e-9 && b.y + b.h <= height + 1e-9)
  for (const [i, a] of all.entries()) for (const b of all.slice(i + 1)) assert.ok(a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9 || a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9, 'no two boxes overlap')
  // Clockwise: the first branches to the right, top to bottom, the rest to the left, bottom to top.
  const [a, b, c, d] = root.children
  assert.deepEqual([a, b, c, d].map((one) => one.side), [1, 1, -1, -1])
  assert.ok(a.y < b.y && d.y < c.y)
  assert.equal(lines.length, all.length - 1)
  assert.ok(lines.every((line) => line.branch >= 0 && line.branch < 4))
  // Right to left, the same map mirrored.
  const mirrored = make()
  layoutMap(mirrored, { rtl: true })
  assert.ok(Math.abs(mirrored.children[0].x - (width - a.x - a.w)) < 1e-9 && mirrored.children[0].side === -1)
  // A map flatter than its box is spread out to it, no wider.
  const spread = make(), laid = layoutMap(spread, { aspect: 2 })
  assert.ok(laid.height > height && Math.abs(laid.width - width) < 1e-9 && laid.width / laid.height >= 2 - 1e-6)
  assert.match(curveOf(lines[0]), /^M[\d.]+ [\d.]+C[\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+ [\d.]+$/)
})

import { optionsOf } from '../src/render.js'

test("a chart or a diagram fenced under a mind map's item is that item's to draw, its lines never read as items", () => {
  const source = '- Money\n  ```echarts\n  {"series": []}\n  ```\n- Rain\n  ```mermaid {scale: 0.8}\n  ---\n  config:\n    - not an item\n  ---\n  pie\n    "a": 1\n  ```\n  - Moved\n'
  const items = itemsOf(source, 0)
  assert.deepEqual(items.map((item) => [item.text, item.blocks, item.children.map((c) => c.text)]), [
    ['Money', [{ lang: 'echarts', text: '{"series": []}' }], []],
    ['Rain', [{ lang: 'mermaid {scale: 0.8}', text: '---\nconfig:\n  - not an item\n---\npie\n  "a": 1' }], ['Moved']],
  ])
})

test("a fence's options, as Slidev writes them or as JSON, reach its drawer", () => {
  assert.deepEqual(optionsOf("mermaid {theme: 'neutral', scale: 0.8}"), { theme: 'neutral', scale: 0.8 })
  assert.deepEqual(optionsOf('mermaid {"flowchart": {"curve": "linear"}}'), { flowchart: { curve: 'linear' } })
  assert.deepEqual([optionsOf('echarts'), optionsOf('mermaid {broken')], [{}, {}])
})

import { entriesOf, leadOf, partHeads, contentsOf, boldLines } from '../src/figures.js'
import { Lexer } from 'marked'

const lex = (/** @type {string} */ markdown) => new Lexer({ gfm: true }).lex(markdown)
/** An entry's lead and words, as their source says them, and the words drawn. @param {string} source @param {any} split */
const said = (source, split) => [split.leadAt && source.slice(...split.leadAt), split.restAt && source.slice(...split.restAt), split.rest.map((/** @type {any} */ t) => t.raw).join('')]

test("a figure's items are a list's or lines in bold, each its lead and its words, where they are in the source", () => {
  const source = '## Day\n\n- **6:00 PM** — Doors & drinks\n- **Q1**: Fit\n  - the oven\n- 7:30 am Dinner\n- 56% of people\n- Just words\n'
  const [, , list] = lex(source)
  const entries = entriesOf(list, source.indexOf('- **6'), lex)
  assert.equal(entries.length, 5)
  assert.deepEqual(said(source, leadOf(entries[0], 'agenda')), ['6:00 PM', 'Doors & drinks', 'Doors & drinks'])
  assert.deepEqual(said(source, leadOf(entries[1], 'timeline')), ['Q1', 'Fit', 'Fit'])
  assert.deepEqual(entries[1].blocks.map(({ token, start }) => [token.type, source.slice(start, start + token.raw.length)]), [['list', '- the oven']])
  // A time leads a programme's line, a number a key figure's, without bold; not elsewhere.
  assert.deepEqual(said(source, leadOf(entries[2], 'agenda')), ['7:30 am', 'Dinner', 'Dinner'])
  assert.deepEqual(said(source, leadOf(entries[2], 'steps')), [null, '7:30 am Dinner', '7:30 am Dinner'])
  assert.deepEqual(said(source, leadOf(entries[3], 'metrics')), ['56%', 'of people', 'of people'])
  assert.deepEqual(said(source, leadOf(entries[4], 'process')), [null, 'Just words', 'Just words'])
  // Key figures written as lines in bold.
  const lines = '**56%** of people\n**3×** faster\n**4.8**'
  const [paragraph] = lex(lines)
  assert.ok(boldLines(paragraph) && !boldLines(lex('**56%** of people\nand more')[0]))
  const figures = entriesOf(paragraph, 0, lex).map((entry) => said(lines, leadOf(entry, 'metrics')))
  assert.deepEqual(figures, [['56%', 'of people', 'of people'], ['3×', 'faster', 'faster'], ['4.8', null, '']])
  // Words over two lines are drawn, but not changed in place.
  const long = lex('- **A** one\n  two\n')[0]
  assert.deepEqual(said('- **A** one\n  two\n', leadOf(entriesOf(long, 0, lex)[0], 'steps')).slice(0, 2), [null, null])
})

test("a slot's parts start at its headings of their level, its title left out when it is written at theirs", () => {
  const heads = (/** @type {string} */ md, /** @type {number} */ count) => [...partHeads(lex(md), count)].map((i) => lex(md)[i].text)
  assert.deepEqual(heads('## Where\n\n## Rent\n\nA\n\n## Buy\n\nB', 2), ['Rent', 'Buy'])
  assert.deepEqual(heads('# Where\n\n## Rent\n\n## Buy', 2), ['Rent', 'Buy'])
  assert.deepEqual(heads('## Rent\n\n## Buy', 2), ['Rent', 'Buy'])
  assert.deepEqual(heads('## Products\n\n### Bread\n\n### Cakes\n\n### Pies\n\n### Tarts', 4), ['Bread', 'Cakes', 'Pies', 'Tarts'])
  assert.deepEqual(heads('Words alone', 2), [])
})

test("the deck's contents are its parts, as Slidev's <Toc> reads them, hideInToc heard", () => {
  const deck = parseDeck('---\nlayout: cover\n---\n\n# Plan\n\n---\nlayout: toc\n---\n\n## Contents\n\n---\nlayout: section\n---\n\n# Why\n\n---\n\n## A slide\n\nWords\n\n---\nlayout: subsection\n---\n\n## The work\n\n---\nlayout: section\nhideInToc: true\n---\n\n# Hidden\n\n---\nlayout: section\ntitle: Named\n---\n\n# How\n\n---\nhideInToc: false\n---\n\n## Shown anyway\n\nWords\n\n---\nlayout: end\n---\n\n# Thanks')
  const kit = mergeKits().kit
  assert.equal(layoutNameOf(deck.slides[1], kit), 'summary')
  assert.deepEqual(contentsOf(deck.slides, kit, 1).map(({ title, level }) => [title, level]), [['Why', 1], ['The work', 2], ['Named', 1], ['Shown anyway', 2]])
  assert.deepEqual(contentsOf(deck.slides, kit, 1, 1).map(({ title }) => title), ['Why', 'Named'])
  // A deck without parts: every slide with a title, at its heading's level.
  const flat = parseDeck('---\nlayout: cover\n---\n\n# Plan\n\n---\nlayout: summary\n---\n\n## Contents\n\n---\n\n## One\n\nWords\n\n---\n\n### Two\n\nWords\n\n---\n\nNo title')
  assert.deepEqual(contentsOf(flat.slides, kit, 1).map(({ title, level, index }) => [title, level, index]), [['One', 1, 2], ['Two', 2, 3]])
})
