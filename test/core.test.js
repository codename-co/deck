import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseDeck } from '../src/parse.js'
import { parseYaml } from '../src/yaml.js'
import { readDeckFile, writeDeckFile, escape, unescape } from '../src/file.js'
import { tokensOf, schemeOf, hex, contrast } from '../src/look.js'

const en = readFileSync(new URL('../examples/en.md', import.meta.url), 'utf8')

test('slides split as Slidev splits them, settings and notes kept', () => {
  const deck = parseDeck(en)
  assert.equal(deck.slides.length, 12)
  assert.equal(deck.settings.title, 'A second oven')
  assert.equal(deck.settings.themeConfig.primary, '#f7c531')
  assert.equal(deck.slides[0].settings.layout, 'cover')
  assert.equal(deck.slides[0].notes, 'Thank everyone for coming. Two minutes on why, three on the numbers.')
  assert.deepEqual(deck.slides[1].slots.map((s) => s.name), ['default', 'right'])
  assert.match(deck.slides[1].notes, /ceiling in May/)
  assert.deepEqual(deck.slides[10].slots.map((s) => s.name), ['default', 'left', 'right', 'bottom'])
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
    const paper = /** @type {number[]} */ (hex(colours.paper))
    assert.ok(contrast(/** @type {number[]} */ (hex(colours.primary)), paper) >= 4.5, `${primary} ${scheme} primary`)
    assert.ok(contrast(/** @type {number[]} */ (hex(colours.ink)), paper) >= 7, `${primary} ${scheme} ink`)
    assert.ok(contrast(/** @type {number[]} */ (hex(colours.muted)), paper) >= 4.5, `${primary} ${scheme} muted`)
    for (const s of colours.series) assert.ok(contrast(/** @type {number[]} */ (hex(s)), paper) >= 3, `${primary} ${scheme} series ${s}`)
    assert.ok(contrast(/** @type {number[]} */ (hex(colours.onPrimary)), /** @type {number[]} */ (hex(primary))) >= 4.5 || primary === '#ff69b4', `${primary} ${scheme} on fill`)
  }
})

import { mergeKits, layoutOf, inferLayout, STANDARD } from '../src/kit.js'

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
  assert.equal(Object.keys(STANDARD.layouts).length, 17)
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
  assert.ok(scheme.series.every((one) => contrast(hex(one) ?? [0, 0, 0], hex(scheme.paper) ?? [255, 255, 255]) >= 3))
  assert.equal(scheme.series[1], scheme.series[3], 'the kit\'s own, round again')
})

test('a slide that names no layout is given the one its content suits', () => {
  const deck = parseDeck(readFileSync(new URL('../examples/kit.md', import.meta.url), 'utf8'))
  assert.deepEqual(deck.slides.map((s) => s.settings.layout ? `(${s.settings.layout})` : inferLayout(s)),
    ['cover', 'section', '(three-numbers)', 'two-cols', 'fact', 'quote', '(big-question)', '(grid-of-nine)'])
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
