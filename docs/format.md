# The deck file

## The page

A deck is one HTML file, named `<name>.deck.html`. Any browser opens it; the renderer draws and presents it. A host reads its Markdown as text and never runs the page.

````html
<!doctype html>
<html lang="en" dir="ltr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="deck 0.1.0">
<title>A second oven</title>
<style>#deck{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font:1rem/1.6 ui-monospace,Menlo,Consolas,monospace;max-width:72ch;margin:2rem auto;padding:0 1rem}</style>
<body>
<script type="text/markdown" id="deck">
…the Markdown…
</script>
<script src="https://cdn.jsdelivr.net/npm/@codename/deck@0.1.0/dist/deck.js"></script>
</html>
````

- **The Markdown** sits whole in one element, `<script type="text/markdown" id="deck">`, which no browser runs. Nothing inside a script element is decoded, so `R&D` stays `R&D`.
- **One escape.** `<script` and `</script`, in any case, gain a backslash after their `<`, and one more for each already there; reading takes one away. The HTML parser would otherwise end the element at `</script`, and a `<script` after `<!--` would keep it from ending. `readDeckFile(writeDeckFile(md))` gives back `md` exactly.
- **In the body.** Without the explicit `<body>`, the parser would put the element in the head, which is never shown.
- **With scripts off,** the style above shows the Markdown as plain text in the body.
- **The renderer** is linked by default, to this version of the package on jsDelivr (`rendererUrl()`). A host may link another address, or hold the renderer whole (`{ code }`, about 113 KB), its `<!--`, `<script` and `</script` written with `\x3C`. A `data-base` attribute on the renderer's script says where the libraries a slide needs come from: a CDN's npm mirror (the default) or a `node_modules/` folder.
- **Pictures** the deck names by a host's own address are held inside the file as `data:` addresses when it leaves the host (`inlinePictures`). Pictures on the web stay links unless asked for. A page opened from disk can't read back a picture beside it, so a file meant to travel holds its pictures.
- **Title, language and direction** are in the head for whatever reads the page before the renderer does.

## The Markdown

Slidev's form, as `@slidev/parser` splits it, and the parts a deck for knowledge workers needs. Every deck written this way opens in Slidev too; ECharts blocks and kits need an addon there.

### Written and read

- **Slides** between lines holding only `---`. A `---` followed by a `key:` line opens that slide's settings, YAML up to the next `---` line; a ` ```yaml ` block at a slide's top does the same.
- **The first slide's settings** are the deck's too (its headmatter): `title`, `lang`, `dir`, `colorSchema` (`auto`, `light`, `dark`), `transition`, `theme`, `themeConfig`, `kit`.
- **A slide's settings:** `layout`, `transition` (`slide-left`, `slide-right`, `slide-up`, `fade`, `view-transition`; `a | b` for forward and back), `class` (`invert`, `text-center`), `image`, `background`, `alt`, `title`, `paginate`, and for the deck's contents `hideInToc`, `level` and, on the contents' own slide, `maxDepth`, as Slidev names them.
- **Slots:** `::name::` alone on a line starts the slot of that name; what comes before is `default`.
- **Notes:** the last HTML comment at a slide's end.
- **Steps:** `<v-clicks>` and `</v-clicks>` around a list, each on its own line with empty lines around; `<v-click>` around a block.
- **Code** in fences, with lines marked as Slidev marks them: ` ```ts {2,4-5} `.
- **Charts:** ` ```echarts ` holding an ECharts option as JSON, data only, drawn by ECharts in the deck's colours and type.
- **Diagrams:** ` ```mermaid ` holding Mermaid's language, drawn by Pele, with its own settings (a `---` block with `config:`, `%%{init: {…}}%%`); its colours, a pie's and a chart's too, are the deck's, light or dark.
- **A fence's options,** after its language as Slidev writes them, YAML's flow or JSON: ` ```mermaid {scale: 0.8} ` takes at most that share of its box; the others go to Pele as its settings (`theme` aside: the colours are the deck's). They reach a host's drawer as its third argument.
- **Mind maps:** `layout: mindmap`, its lists drawn as one map (below).
- **Figures:** a layout that draws a slide's lists as cards, key figures, a timeline, chevrons, a programme, a pyramid or a bento, sets its `##` parts face to face or in a matrix, or shows the deck's contents (below).
- **Markdown** as CommonMark and GFM have it: headings, lists, task lists, tables, quotes, emphasis, links, pictures. A picture alone on its line fills what its slot leaves, whole, whatever its own size.

### Added by deck

- ` ```echarts `, `lang` and `dir`.
- `kit`: tokens and layouts as data ([kits.md](kits.md)).
- A layout chosen from what a slide holds when it names none.
- A Morph between two slides that share a heading, a picture or a list item, with `transition: view-transition`.
- A mind map: a slide on `layout: mindmap` (or a kit's layout with `lists: mindmap`) draws its lists as one map.
- Figures drawn from a slide's lists or parts, and the deck's contents, by the layouts below.

### A mind map

````md
---
layout: mindmap
---

## What a second oven changes

### Mornings

- Croissants until noon
- No queue at 7

### Bread

- A batch at noon
  - For the lunch crowd
- Rye on Fridays

### Mornings

- Coffee with the first batch
````

- **Each item a node,** its indentation its branching, at any depth, with any marker; a line that is no item goes on with the item above it.
- **Every list on the slide is merged into one map.** A heading just before a list, other than the one the slide opens with, is that list's node. Items with the same words at the same place (emphasis and case aside) are one node, their children together: the slide above has one `Mornings`, with three children.
- **One root.** When the lists come down to one item, it is the root, and the heading the slide opens with stays its title, unless it says the same. Else the heading the slide opens with is the root, drawn in the middle of the map and not above it; with none, a dot.
- **Laid out** as maps are drawn by hand: the root in the middle, its branches shared out to either side, clockwise from the side a line ends (the right, the left right to left), each branch in a colour of the charts', the whole shrunk to what the slide leaves it and spread out to its height. Paragraphs before or after the lists stay above or under the map.
- **Steps:** lists inside `<v-clicks>` show one branch a click.
- **A chart or a diagram in a node:** a ` ```echarts ` or ` ```mermaid ` block fenced under an item, indented with it, is drawn in that item's node, under its words, at a size of its own.
- **Changed in place,** each node's words as a list item's are, and in PowerPoint as its own shapes: a box with words for each node, a curve for each line.

### Figures

A slide on one of these layouts says what it shows in plain Markdown; the layout draws it. An item's **lead** is the bold it starts with, its label; the rest of its line is its words; a colon or a dash between them is left out. Everything else on the slide (its heading, a line above or under) stays where it is.

| Layout | Written as | Drawn as |
|---|---|---|
| `summary` | a heading | the deck's contents under it (below) |
| `section`, `subsection` | a heading alone | a part's title, on ink; a subsection's, smaller, on the soft fill |
| `statement` | one sentence | the sentence, large, in the middle |
| `quote` | `> words`, who said them under it; `image:` | the quote, over the picture filling the slide behind a veil when it has one |
| `steps` | `- **Find** bakers through the school` | a row of cards, one an item, each numbered |
| `metrics` | `- **56%** of people`, or lines `**56%** of people` | a row of 2 to 4 key figures, big, each over what it counts; a number starting a line is its lead too |
| `timeline` | `- **Q1** The shop fitted` | milestones along a line, each lead over its dot, its words under it |
| `process` | `1. **Sign** the lease` | chevrons, each holding a step's lead, its words under it, pointing the way the language reads |
| `agenda` | `- **6:00 PM** Doors open` | a programme, a time and its words a row, in two columns from seven rows; a time starting a line is its lead too |
| `pyramid` | `- **Love** They tell their friends` | levels stacked, the first the narrowest, on top, the last the widest; each level's words beside it |
| `bento` | `- **A terrace** for forty` | a mosaic: the first item a big tile on the fill, the next 2 to 4 tiles around it |
| `versus` | two `##` parts, each with its words | face to face, a "VS" medallion between them, the second on the fill |
| `matrix` | four `##` parts | a grid of two by two, the top one at the end (the second) on the fill |

- **Items** are every list's on the slide, in order, at their first list's place; an item's own list, chart or diagram, indented under it, is drawn in its card, tile or row. Lines that all start in bold are items too, as key figures are often written without a list.
- **Parts** start at each heading of the level the slide's last heading has. The heading the slide opens with is its title when it is of a higher level (`#` over `##` parts), or when there is one more heading of their level than the parts (`## Where to open`, then two `##`). Parts take everything under their heading: paragraphs, lists, a chart.
- **Steps:** items in `<v-clicks>` show one a click; a `<v-click>` around a list shows the whole figure at once; a `<v-click>` in a part, that block.
- **Right to left,** the figures are mirrored: chevrons point left, the timeline and cards run from the right, the second part sits on the left.
- **Changed in place,** a lead and its words each, as a list item's words are, when the item is one line.
- **In PowerPoint,** each figure is PowerPoint's own shapes (cards, chevrons and levels as their outlines, dots, rules) and boxes of words, where the slide has them.

### The deck's contents

````md
---
layout: summary
---

## What we will cover
````

`summary` lists the deck's parts under the slide's own words, as Slidev's `<Toc>` reads them: each slide's `title`, else its first heading. A slide with `hideInToc: true` is left out, as are the contents' own slide, a cover, an introduction, the end and slides with no title; `hideInToc: false` brings one back.

- **Where the deck has parts** (slides on `section` or `subsection`, or with a `level`), the contents are the parts: a section at level 1, numbered, its subsections under it. Else they are every slide with a title, at its heading's level.
- **`maxDepth`** on the contents' slide keeps the levels above it (2 by default, 1 for sections alone).
- **In two columns** from seven rows. Each row goes to its slide when chosen (a click, or Enter).

### Also read, as brains write it

Brains blend dialects. These are read, never rewritten:

- Pandoc's `::: notes`, `:::: columns` holding `::: column`s (slots `left`, `right`, or `left`, `middle`, `right`; what follows them `bottom`), `::: incremental`.
- remark's `???` and reveal.js's `Note:` (what follows is the notes), reveal.js's `<aside class="notes">`.
- Slides at headings of the first two levels when a deck has no `---` at all, as Pandoc splits a document.
- Steps written as `<li v-click>`.
- A `---` followed by words, which Slidev would take for settings, as a new slide.
- Names brains give layouts: `title`, `two-columns`, `comparison`, `divider`, `thanks`, `toc`, `kpis`, `roadmap`, `schedule`, `vs`, `quadrant`…

`deckIn(answer)` finds a deck in a brain's answer and mends what brains get wrong most: a deck fenced as ` ```markdown ` or with nothing, a chart's fence inside three backticks, settings after an empty line, steps without their empty lines, a chart fenced as ` ```json `, words after a slot's marker.

### Left out

Vue components and expressions, UnoCSS classes, `<style>`, imported slides, Monaco, drawing. Other HTML gives up its words alone.
