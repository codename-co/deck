# Drawing decks in a host

A host is a page that draws decks itself. deck builds every element with the DOM's own calls, sets custom properties through the CSSOM rather than style attributes, and needs no Trusted Types policy, so it runs under a policy with `style-src 'self'` and `trusted-types 'none'`. Load `@codename/deck` (with your own `marked` through an import map) or `@codename/deck/bundle`, and `@codename/deck/css` as a stylesheet.

## createDeck(element, options)

```js
import { createDeck } from '@codename/deck'

const view = createDeck(document.querySelector('#deck'), {
  source,                       // the Markdown
  lang: 'fr', dir: 'ltr',       // else the deck's own, else the page's
  kit,                          // the host's kit: an organisation's, a person's, a project's, merged
  scheme: 'auto',               // 'light', 'dark' or 'auto', over the deck's colorSchema
  blocks: { echarts, mermaid }, // drawers for fenced blocks: (box, source, options) => void | Promise<void>, options those after the fence's language
  resolve: (src) => url,        // a picture's address as the page can load it, or null
  strings,                      // the bar's words, and `slide` and `carousel` for screen readers, else deck's own (en, fr, ar, ja)
  lex: (markdown) => tokens,    // how a slide's Markdown is read: the host's own marked, its extensions too; else marked's GFM
  headings: 'aria',             // 'real' (h1–h6) or 'aria' (role=heading), for a deck inside a page
  editable: true,
  onChange: (source) => {},     // after each change, by the Markdown or on a slide
  onSave: (source) => {},       // ⌘S or Ctrl+S
  onExport: (view) => {},       // the bar's Save as PowerPoint
})
```

The view: `source`, `deck` (parsed), `at`, `scheme`, `kit`, `kitProblems`, `lang`, `dir`, `slides()`, `setSource(text)`, `go(index, step)`, `toggle('is-editing' | 'is-presenting' | 'is-overview')`, `present()`, `setScheme(scheme)`, `fitAll()`, `destroy()`.

Events on the element: `deck-scheme` (`detail: { scheme, colours, tokens }`) when the look is set, `deck-move` (`detail: { at, step }`) on each move.

Every block that can be changed by hand carries `data-edit="from-to"`, the offsets of its words in the source, so a host can point at a part of a slide and change it in the Markdown.

## Drawers

`defaultBlocks({ base, root, versions })` gives the drawers a file uses alone: ECharts as SVG in the deck's colours and type, its category axis mirrored right to left; Pele for Mermaid's language, its SVG shown as a picture coloured by Pele's variables (its charts' series too), again when the scheme changes, its words the picture's text, the fence's options its settings and `scale`. Each library loads the first time a slide needs it, from `base` (jsDelivr's npm mirror, or a `node_modules/` folder, `libraryAt()`). A host with a strict policy gives its own: Pele's SVG holds style attributes, so it belongs in an image or a worker's output, not in the page's DOM.

## PowerPoint

```js
const { blob, report } = await toPptx(view, { PptxGenJS, JSZip })
```

A kit from a PowerPoint template, and a kit's tokens out, are `@codename/deck/template`'s (`kitFromTemplate`, `tokensToDtcg`, [kits.md](kits.md)), which a host imports only when it reads or writes one; `logoOf` and `CORNERS` check a kit's logo and its corner before it is kept, and `rgbOf` a colour as deck reads it.

PptxGenJS 4 (its bundle carries JSZip) is the host's to load, on demand. The file is made from the deck as drawn: a slide layout per deck layout, named by its label in the deck's language, with a placeholder for its title and each slot; lists as lists with their levels; tables; mind maps as PowerPoint's own shapes, a box with words for each node and a curve for each line; figures (cards, key figures, timelines, chevrons, programmes, pyramids, bentos, parts face to face or in a matrix, the deck's contents) as PowerPoint's own shapes and boxes of words, a quote's veil over its picture as a see-through rectangle; bars, lines, areas, pies, rings, points and radars as native charts with their numbers, other charts and diagrams as pictures, and pictures, alone on their line or beside the words, as pictures; a layout's art as one picture on its slide layout; notes; transitions; the kit's colours as the theme. `report` counts slides, charts, tables, pictures, placeholders, mind maps and figures.

## Files

- `readDeckFile(html)`: the Markdown, or `null`; never parses the page.
- `writeDeckFile(markdown, { title, lang, dir, renderer, base })`: the page. `renderer` is `{ src }` (default: `rendererUrl()`) or `{ code }`.
- `inlinePictures(source, read, { web, largest })`: the deck with its pictures inside it. `read(place)` gives `{ type, bytes }` for a picture the host holds. Hosts call it on a deck leaving them (a download, a share).
- `deckIn(answer)`: a brain's deck from its answer, mended, with what was mended.
