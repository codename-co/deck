# deck

Slide decks as one web page. A deck is a `.deck.html` file: its Markdown, in Slidev's form, sits whole inside it, and a small renderer draws and presents it in any browser. Opened with scripts off, the same file shows its Markdown as plain text. The renderer also runs inside a host application, changes a deck live as Markdown or on the slide, and saves it as a PowerPoint whose words, tables and charts stay editable.

````html
<!doctype html>
<html lang="en" dir="ltr">
<meta charset="utf-8">
<title>A second oven</title>
<style>#deck{display:block;white-space:pre-wrap;…}</style>
<body>
<script type="text/markdown" id="deck">
---
title: A second oven
layout: cover
---

# A second oven

Plan for 2027 · Martin's bakery

---
layout: two-cols
---

## Where we are

- 120 croissants a day, sold out by 10

::right::

```echarts
{"xAxis": {"type": "category", "data": ["Jan", "Feb"]}, "yAxis": {}, "series": [{"type": "bar", "data": [96, 104]}]}
```
</script>
<script src="https://cdn.jsdelivr.net/npm/@codename/deck@0.1.0/dist/deck.js"></script>
</html>
````

## What it does

- **Layouts and looks as kits.** Seventeen layouts come with deck, Slidev's names and PowerPoint's usual ones. A kit adds others and a design system (DTCG tokens or a few flat ones) as data, never CSS. A slide that names no layout gets the one its content suits. See [docs/kits.md](docs/kits.md).
- **Light and dark** from the same tokens, every colour held at WCAG AA on its paper.
- **Presenting:** full screen, a clicker's keys, steps (`<v-clicks>`), Slidev's transitions and a Morph that needs nothing written, the presenter's view with notes and a timer, all slides at once.
- **Charts and diagrams:** ` ```echarts ` blocks drawn by ECharts, ` ```mermaid ` blocks drawn by [Pele](https://github.com/obsidianmd/pele) (every kind Mermaid has, from 17 KB a kind), each loaded the first time a slide needs it.
- **Changed three ways on one source:** as Markdown beside the slides, in place on a slide (a double click), or by a host's own means; each change goes back into the Markdown.
- **PowerPoint out, from the browser:** a layout per deck layout with placeholders, lists as lists, tables, native charts with their numbers, notes, transitions, the kit's colours as the theme. PowerPoint opens it without a repair. Keynote is not a target.
- **Every language:** right to left (layouts, charts and tables mirrored), CJK, upright scripts kept upright.
- **Read liberally:** what brains write in other dialects' habits (Pandoc's fenced divs, remark's and reveal.js's notes, headings as slides) is read without being rewritten. See [docs/format.md](docs/format.md).
- **Safe in a strict page:** the renderer builds with the DOM's own calls, sets no style attribute and needs no Trusted Types policy.

## Use it

Open a `.deck.html` file in a browser. Write one with `writeDeckFile(markdown, options)`; read one with `readDeckFile(html)`, which never runs the page. Draw a deck in your own page with `createDeck(element, options)`. The API is in [docs/host.md](docs/host.md).

| Entry | What it is |
|---|---|
| `@codename/deck` (`dist/deck.mjs`) | The module for a host that brings its own `marked` (through an import map) |
| `@codename/deck/bundle` | The same with `marked` inside |
| `@codename/deck/file` (`dist/deck.js`) | The classic script a `.deck.html` links to or holds |
| `@codename/deck/css` | The stylesheet, for a host that loads its own |

A file links to its renderer by default, at this package's version on jsDelivr. A host can name another address, or hold the renderer whole (about 113 KB) for a file meant to work offline. On its way out of a host, a deck holds its pictures inside it as `data:` addresses (`inlinePictures`).

## Commands

```bash
npm install
npm run build          # dist/: deck.js, deck.mjs, deck.bundle.mjs, deck.css
npm test               # node --test: reading, files, kits, looks, pictures, Pele
npm run typecheck      # tsc --noEmit, strict, over src/
npm run test:browsers  # the examples in Chromium and WebKit from disk, offline; PowerPoint export; a strict host
npm run check          # all three
npm run eval           # ask brains for decks (LM Studio on localhost:1234), see eval/
```

Browser tests need Playwright's browsers once: `npx playwright install chromium webkit`.

Commits carry no Co-Authored-By or Claude-Session trailer: `.claude/settings.json` turns Claude Code's attribution off for this repository, and `.githooks/commit-msg` refuses such a trailer whatever makes the commit (`npm install` points git at `.githooks`).

## In this repository

| Path | What it is |
|---|---|
| `src/` | The renderer, its reader, kits, looks, the file, PowerPoint, repairs, pictures; JavaScript with JSDoc, checked by `tsc` |
| `test/` | Unit tests (`node --test`), browser tests, a strict host page, Mermaid samples |
| `examples/` | Decks in English, Arabic, Japanese, one with its own kit, one full of escapes; `make.mjs` writes their `.deck.html` |
| `eval/` | The brain evaluations: a draft skill, requests in four languages, replies, scores |
| `docs/` | The format, kits, the host API, and what phase 0 measured |

## Status

0.1.2, on npm as `@codename/deck`. [docs/findings.md](docs/findings.md) says what was measured.

## Licence

MIT. See [LICENSE](LICENSE).
